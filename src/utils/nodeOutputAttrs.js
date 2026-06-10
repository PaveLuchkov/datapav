// Single source of truth: "what columns does a node output?" and how column
// lineage flows. Used by useLineageState to inject connectedAttrs, leftDF/rightDF
// and to drive the result-DF auto-sync.
//
// Every node type's rules now live in its per-type spec (src/nodes/<type>/spec.js,
// registered via src/nodes/specs.js). These three functions are thin dispatchers:
// they look up the spec's lineage method and delegate. The recursion
// (getUpstreamAttrs, traceColumnUpstream, _propagateCol) re-enters these
// dispatchers, so a spec can trace through any other type. Unknown/unregistered
// types degrade safely (no columns, no lineage) rather than throwing.

import { getLineage } from '../nodes/lineageRegistry';

export function inferAggType(func, inputType) {
  if (func === 'count' || func === 'nunique') return 'int';
  if (func === 'mean') return 'float';
  if (func === 'sum') return (inputType === 'int' || inputType === 'float') ? inputType : 'float';
  // min, max, first, last — preserve source type
  return inputType || 'string';
}

export function computeNodeOutputAttributes(node, edges, nodes) {
  const ls = getLineage(node.type);
  return ls?.outputs ? ls.outputs(node, edges, nodes) : [];
}

// Deduplicated union of output attributes from all nodes connected via df-in
// (or a specific handle) to nodeId.
export function getUpstreamAttrs(nodeId, edges, nodes, handleId = 'df-in') {
  const seen = new Map();
  for (const e of edges) {
    if (e.target !== nodeId || e.targetHandle !== handleId) continue;
    const src = nodes.find((n) => n.id === e.source);
    if (!src) continue;
    for (const attr of computeNodeOutputAttributes(src, edges, nodes)) {
      if (!seen.has(attr.name)) seen.set(attr.name, attr);
    }
  }
  return [...seen.values()];
}

// Union of output attrs over the WHOLE upstream chain (BFS over incoming
// edges), nearest ancestors first. Used for @column autocomplete, where a
// column from further up the pipeline is still a useful suggestion even if a
// middle step renamed or dropped it.
export function getUpstreamChainAttrs(nodeId, edges, nodes) {
  const seen = new Map();
  const visited = new Set([nodeId]);
  let frontier = [nodeId];
  while (frontier.length) {
    const next = [];
    for (const id of frontier) {
      for (const e of edges) {
        if (e.target !== id || visited.has(e.source)) continue;
        visited.add(e.source);
        const src = nodes.find((n) => n.id === e.source);
        if (!src) continue;
        for (const attr of computeNodeOutputAttributes(src, edges, nodes)) {
          if (!seen.has(attr.name)) seen.set(attr.name, attr);
        }
        next.push(e.source);
      }
    }
    frontier = next;
  }
  return [...seen.values()];
}

// ── Column Lineage Tracing ─────────────────────────────────────────────────
//
// traceColumnUpstream: walks the graph backwards from (nodeId, colName)
// Returns a linked chain: { nodeId, colName, nodeType, nodeLabel, upstream, ...extras } | null
//
// extras per node type:
//   groupByNode agg: aggFunc, inputColName
//   functionNode:    createdHere: true

export function traceColumnUpstream(nodeId, colName, edges, nodes, visited = new Set()) {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  // Cycle guard: a graph loop (e.g. wiring a companion result back toward its
  // operator) would otherwise recurse until the stack overflows, which throws
  // mid-render and blanks the canvas. Stop re-entering the same (node, column).
  const key = `${nodeId}::${colName}`;
  if (visited.has(key)) return null;
  visited.add(key);

  const ls = getLineage(node.type);
  return ls?.traceUpstream ? ls.traceUpstream(node, colName, edges, nodes, visited) : null;
}

// traceColumnDownstream: walks the graph forward from (nodeId, colName)
// Returns array of branches (can fan out at concat/merge forks):
//   [{ nodeId, colName, nodeType, nodeLabel, downstream: [...] }]

export function traceColumnDownstream(nodeId, colName, edges, nodes, visited = new Set()) {
  // Cycle guard (see traceColumnUpstream): don't re-expand a (node, column)
  // already on this traversal, so a graph loop can't recurse without bound.
  const key = `${nodeId}::${colName}`;
  if (visited.has(key)) return [];
  visited.add(key);

  const results = [];
  // 1) df-out edges: the column propagates through whatever the target computes.
  for (const e of edges.filter((e) => e.source === nodeId && e.sourceHandle === 'df-out')) {
    const target = nodes.find((n) => n.id === e.target);
    if (!target) continue;
    const propagated = _propagateCol(target, colName, edges, nodes);
    if (propagated === null) continue;
    results.push({
      nodeId: target.id,
      colName: propagated,
      nodeType: target.type,
      nodeLabel: target.data.label,
      downstream: traceColumnDownstream(target.id, propagated, edges, nodes, visited),
    });
  }

  // 2) Explicit per-column wires (a column dragged onto another node). The source
  // handle encodes the attr id; only follow the edge for the column being traced.
  const node = nodes.find((n) => n.id === nodeId);
  if (node) {
    const srcAttrs = computeNodeOutputAttributes(node, edges, nodes);
    for (const e of edges) {
      if (e.source !== nodeId || !e.sourceHandle?.endsWith('-source')) continue;
      const srcAttrId = e.sourceHandle.slice(0, -'-source'.length);
      const srcAttr = srcAttrs.find((a) => a.id === srcAttrId);
      if (!srcAttr || srcAttr.name !== colName) continue;
      const target = nodes.find((n) => n.id === e.target);
      if (!target) continue;
      // Resolve the target column name from its `-target` handle attr id.
      const tgtAttrId = e.targetHandle?.endsWith('-target') ? e.targetHandle.slice(0, -'-target'.length) : null;
      const tgtAttr = computeNodeOutputAttributes(target, edges, nodes).find((a) => a.id === tgtAttrId);
      const targetColName = tgtAttr ? tgtAttr.name : colName;
      results.push({
        nodeId: target.id,
        colName: targetColName,
        nodeType: target.type,
        nodeLabel: target.data.label,
        downstream: traceColumnDownstream(target.id, targetColName, edges, nodes, visited),
      });
    }
  }
  return results;
}

function _propagateCol(targetNode, colName, edges, nodes) {
  const ls = getLineage(targetNode.type);
  return ls?.propagateDownstream ? ls.propagateDownstream(targetNode, colName, edges, nodes) : null;
}

// Flattens the upstream chain into an ordered array [oldest → newest].
export function flattenUpstream(step) {
  const path = [];
  let cur = step;
  while (cur) { path.unshift(cur); cur = cur.upstream; }
  return path;
}
