// Single source of truth: "what columns does a node output?"
// Used by useLineageState to inject connectedAttrs, leftDF/rightDF,
// and to drive the result-DF auto-sync.

export function inferAggType(func, inputType) {
  if (func === 'count' || func === 'nunique') return 'int';
  if (func === 'mean') return 'float';
  if (func === 'sum') return (inputType === 'int' || inputType === 'float') ? inputType : 'float';
  // min, max, first, last — preserve source type
  return inputType || 'string';
}

export function computeNodeOutputAttributes(node, edges, nodes) {
  switch (node.type) {
    case 'dataFrameNode':
      return node.data.attributes || [];

    case 'functionNode':
      return (node.data.outputs || []).map((o) => ({
        id: o.id, name: o.name, type: o.type || 'string',
      }));

    case 'filterNode':
    case 'concatNode':
      return getUpstreamAttrs(node.id, edges, nodes);

    case 'renameNode': {
      const upstream = getUpstreamAttrs(node.id, edges, nodes);
      const upByName = new Map(upstream.map((a) => [a.name, a]));
      return (node.data.mappings || [])
        .filter((m) => m.to)
        .map((m) => {
          const src = upByName.get(m.from);
          return { id: m.id, name: m.to, type: src?.type || 'string' };
        });
    }

    case 'transformNode':
      return node.data.attributes || [];

    case 'groupByNode': {
      const inputs = node.data.inputs || [];
      const keys = (node.data.groupByInputIds || [])
        .map((gid) => inputs.find((i) => i.id === gid))
        .filter(Boolean)
        .map((i) => ({ id: i.id, name: i.attrName, type: i.attrType || 'string' }));
      const aggs = (node.data.aggregations || [])
        .filter((a) => a.outputName)
        .map((a) => {
          const inp = inputs.find((i) => i.id === a.inputId);
          return { id: a.id, name: a.outputName, type: inferAggType(a.func, inp?.attrType) };
        });
      return [...keys, ...aggs];
    }

    case 'mergeNode': {
      const leftEdge  = edges.find((e) => e.target === node.id && e.targetHandle === 'left-in');
      const rightEdge = edges.find((e) => e.target === node.id && e.targetHandle === 'right-in');
      const leftNode  = leftEdge  ? nodes.find((n) => n.id === leftEdge.source)  : null;
      const rightNode = rightEdge ? nodes.find((n) => n.id === rightEdge.source) : null;
      const lAttrs = leftNode  ? computeNodeOutputAttributes(leftNode,  edges, nodes) : [];
      const rAttrs = rightNode ? computeNodeOutputAttributes(rightNode, edges, nodes) : [];
      const seen = new Set(lAttrs.map((a) => a.name));
      return [...lAttrs, ...rAttrs.filter((a) => !seen.has(a.name))];
    }

    default:
      return [];
  }
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

// ── Column Lineage Tracing ─────────────────────────────────────────────────
//
// traceColumnUpstream: walks the graph backwards from (nodeId, colName)
// Returns a linked chain: { nodeId, colName, nodeType, nodeLabel, upstream, ...extras } | null
//
// extras per node type:
//   groupByNode agg: aggFunc, inputColName
//   functionNode:    createdHere: true

export function traceColumnUpstream(nodeId, colName, edges, nodes) {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  switch (node.type) {
    case 'dataFrameNode': {
      if (!(node.data.attributes || []).some((a) => a.name === colName)) return null;
      const step = { nodeId, colName, nodeType: node.type, nodeLabel: node.data.label, upstream: null };
      // If this DF is the output of an operator (companion or manual result DF),
      // trace back through the incoming df-in edge instead of stopping here.
      const inEdge = edges.find(
        (e) => e.target === nodeId && e.targetHandle === 'df-in' && e.sourceHandle === 'df-out'
      );
      if (inEdge) {
        const src = nodes.find((n) => n.id === inEdge.source);
        if (src) step.upstream = traceColumnUpstream(src.id, colName, edges, nodes);
      }
      return step;
    }

    case 'filterNode':
    case 'concatNode': {
      const step = { nodeId, colName, nodeType: node.type, nodeLabel: node.data.label, upstream: null };
      for (const e of edges.filter((e) => e.target === nodeId && e.targetHandle === 'df-in')) {
        const r = traceColumnUpstream(e.source, colName, edges, nodes);
        if (r) { step.upstream = r; break; }
      }
      return step;
    }

    case 'renameNode': {
      const mapping = (node.data.mappings || []).find((m) => m.to === colName);
      if (!mapping) return null;
      const step = { nodeId, colName, nodeType: node.type, nodeLabel: node.data.label, upstream: null };
      for (const e of edges.filter((e) => e.target === nodeId && e.targetHandle === 'df-in')) {
        const r = traceColumnUpstream(e.source, mapping.from, edges, nodes);
        if (r) { step.upstream = r; break; }
      }
      return step;
    }

    case 'mergeNode': {
      const leftEdge  = edges.find((e) => e.target === nodeId && e.targetHandle === 'left-in');
      const rightEdge = edges.find((e) => e.target === nodeId && e.targetHandle === 'right-in');
      const leftNode  = leftEdge  ? nodes.find((n) => n.id === leftEdge.source)  : null;
      const rightNode = rightEdge ? nodes.find((n) => n.id === rightEdge.source) : null;
      const step = { nodeId, colName, nodeType: node.type, nodeLabel: node.data.label, upstream: null };
      if (leftNode && computeNodeOutputAttributes(leftNode, edges, nodes).some((a) => a.name === colName)) {
        step.upstream = traceColumnUpstream(leftNode.id, colName, edges, nodes);
        return step;
      }
      if (rightNode && computeNodeOutputAttributes(rightNode, edges, nodes).some((a) => a.name === colName)) {
        step.upstream = traceColumnUpstream(rightNode.id, colName, edges, nodes);
        return step;
      }
      return step;
    }

    case 'groupByNode': {
      const inputs = node.data.inputs || [];
      const groupByInputIds = node.data.groupByInputIds || [];
      const keyInp = inputs.find((i) => groupByInputIds.includes(i.id) && i.attrName === colName);
      if (keyInp) {
        const step = { nodeId, colName, nodeType: node.type, nodeLabel: node.data.label, upstream: null };
        for (const e of edges.filter((e) => e.target === nodeId && e.targetHandle === 'df-in')) {
          const r = traceColumnUpstream(e.source, colName, edges, nodes);
          if (r) { step.upstream = r; break; }
        }
        return step;
      }
      const agg = (node.data.aggregations || []).find((a) => a.outputName === colName);
      if (agg) {
        const inp = inputs.find((i) => i.id === agg.inputId);
        const step = { nodeId, colName, nodeType: node.type, nodeLabel: node.data.label, aggFunc: agg.func, inputColName: inp?.attrName, upstream: null };
        if (inp) {
          for (const e of edges.filter((e) => e.target === nodeId && e.targetHandle === 'df-in')) {
            const r = traceColumnUpstream(e.source, inp.attrName, edges, nodes);
            if (r) { step.upstream = r; break; }
          }
        }
        return step;
      }
      return null;
    }

    case 'functionNode': {
      if (!(node.data.outputs || []).some((o) => o.name === colName)) return null;
      return { nodeId, colName, nodeType: node.type, nodeLabel: node.data.label, upstream: null, createdHere: true };
    }

    case 'transformNode': {
      const step = { nodeId, colName, nodeType: node.type, nodeLabel: node.data.label, upstream: null };
      for (const e of edges.filter((e) => e.target === nodeId && e.targetHandle === 'df-in')) {
        const r = traceColumnUpstream(e.source, colName, edges, nodes);
        if (r) { step.upstream = r; break; }
      }
      return step;
    }

    default:
      return null;
  }
}

// traceColumnDownstream: walks the graph forward from (nodeId, colName)
// Returns array of branches (can fan out at concat/merge forks):
//   [{ nodeId, colName, nodeType, nodeLabel, downstream: [...] }]

export function traceColumnDownstream(nodeId, colName, edges, nodes) {
  const results = [];
  // Follow all df-out edges from this node
  const outEdges = edges.filter((e) => e.source === nodeId && e.sourceHandle === 'df-out');

  for (const e of outEdges) {
    const target = nodes.find((n) => n.id === e.target);
    if (!target) continue;
    const propagated = _propagateCol(target, colName, edges, nodes);
    if (propagated === null) continue;
    results.push({
      nodeId: target.id,
      colName: propagated,
      nodeType: target.type,
      nodeLabel: target.data.label,
      downstream: traceColumnDownstream(target.id, propagated, edges, nodes),
    });
  }
  return results;
}

function _propagateCol(targetNode, colName, edges, nodes) {
  switch (targetNode.type) {
    case 'dataFrameNode':
      return (targetNode.data.attributes || []).some((a) => a.name === colName) ? colName : null;

    case 'filterNode':
    case 'concatNode':
    case 'transformNode':
      return computeNodeOutputAttributes(targetNode, edges, nodes).some((a) => a.name === colName) ? colName : null;

    case 'renameNode': {
      const mapping = (targetNode.data.mappings || []).find((m) => m.from === colName);
      if (mapping?.to) return mapping.to;
      return computeNodeOutputAttributes(targetNode, edges, nodes).some((a) => a.name === colName) ? colName : null;
    }

    case 'mergeNode':
      return computeNodeOutputAttributes(targetNode, edges, nodes).some((a) => a.name === colName) ? colName : null;

    case 'groupByNode': {
      const inputs = targetNode.data.inputs || [];
      const inp = inputs.find((i) => i.attrName === colName);
      if (inp && (targetNode.data.groupByInputIds || []).includes(inp.id)) return colName;
      const agg = (targetNode.data.aggregations || []).find((a) => {
        const si = inputs.find((i) => i.id === a.inputId);
        return si?.attrName === colName;
      });
      return agg?.outputName || null;
    }

    case 'functionNode':
      return (targetNode.data.inputs || []).some((i) => i.attrName === colName) ? colName : null;

    default:
      return null;
  }
}

// Flattens the upstream chain into an ordered array [oldest → newest].
export function flattenUpstream(step) {
  const path = [];
  let cur = step;
  while (cur) { path.unshift(cur); cur = cur.upstream; }
  return path;
}
