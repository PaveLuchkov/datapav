import { useState, useCallback, useMemo } from 'react';

// Function subgraphs ("drill in") — see docs/function-subgraphs.md, v1.
//
// A FunctionNode body is stored as `functionNode.data.subgraph = { nodes, edges }`,
// so it serializes / shares / copy-pastes with the node for free. Drilling in
// swaps the SINGLE editing surface (useLineageState's nodes/edges) to the
// subgraph content — the whole editor (callbacks, companions, tracing,
// validation, undo) works inside unchanged. The surfaces we left are kept on a
// stack; exiting folds the current surface back into its function node.
//
// Persistence safety: while drilled in, the active tab must keep saving the
// ROOT canvas (with live subgraph edits folded in), not the bare subgraph —
// `composedRoot` provides that and is what App feeds to tabs/persistence.
//
// The function's signature appears inside as two read-only proxy DataFrames
// (`data._proxy`): inputs (parameters) and outputs (the return). They are
// re-derived from the function node on every entry, so signature edits outside
// propagate in; attr ids reuse the input/output ids to keep inner edges stable.

const proxyInId = (fnId) => `proxy-in-${fnId}`;
const proxyOutId = (fnId) => `proxy-out-${fnId}`;

// Subgraph surface for a function node: stored body minus stale proxies
// (e.g. after a paste re-ids the function), plus refreshed current proxies.
function prepareSubSurface(fn) {
  const sub = fn.data.subgraph || { nodes: [], edges: [] };
  const inId = proxyInId(fn.id);
  const outId = proxyOutId(fn.id);

  const stale = new Set(
    (sub.nodes || [])
      .filter((n) => n.data?._proxy && n.id !== inId && n.id !== outId)
      .map((n) => n.id)
  );
  let nodes = (sub.nodes || []).filter((n) => !stale.has(n.id));
  const edges = (sub.edges || []).filter((e) => !stale.has(e.source) && !stale.has(e.target));

  const inAttrs = (fn.data.inputs || []).map((i) => ({ id: i.id, name: i.attrName, type: i.attrType || 'string' }));
  const outAttrs = (fn.data.outputs || []).map((o) => ({ id: o.id, name: o.name, type: o.type || 'string' }));
  const fnLabel = fn.data.label || 'function';

  const upsert = (pid, label, attributes, x) => {
    const idx = nodes.findIndex((n) => n.id === pid);
    if (idx >= 0) {
      nodes[idx] = { ...nodes[idx], data: { ...nodes[idx].data, label, attributes } };
    } else {
      nodes = [...nodes, {
        id: pid, type: 'dataFrameNode', position: { x, y: 40 },
        data: { label, attributes, _proxy: true },
      }];
    }
  };
  upsert(inId, `${fnLabel} · inputs`, inAttrs, 0);
  upsert(outId, `${fnLabel} · outputs`, outAttrs, 720);

  return { nodes, edges };
}

// Fold `inner` into `frame`'s function node and return the outer surface.
function foldInto(frame, inner) {
  return {
    nodes: frame.nodes.map((n) => n.id === frame.fnId
      ? { ...n, data: { ...n.data, subgraph: inner } }
      : n),
    edges: frame.edges,
  };
}

export function useSubgraphDrill({ nodes, edges, restoreState }) {
  // Each frame: the surface we left + which function node we drilled into.
  // Current surface (nodes/edges from useLineageState) = subgraph of the top frame.
  const [stack, setStack] = useState([]); // [{ fnId, label, nodes, edges }]

  const enterSubgraph = useCallback((fnId) => {
    const fn = nodes.find((n) => n.id === fnId);
    if (!fn || fn.type !== 'functionNode') return;
    const sub = prepareSubSurface(fn);
    setStack((s) => [...s, { fnId, label: fn.data.label || 'function', nodes, edges }]);
    restoreState(sub.nodes, sub.edges);
  }, [nodes, edges, restoreState]);

  // Exit to the surface stored in frame `depth` (0 = root). Folds every level
  // in between, so closing N levels at once loses nothing.
  const exitToDepth = useCallback((depth) => {
    if (!stack.length || depth < 0 || depth > stack.length - 1) return;
    let surface = { nodes, edges };
    for (let i = stack.length - 1; i >= depth; i--) {
      surface = foldInto(stack[i], surface);
    }
    setStack(stack.slice(0, depth));
    restoreState(surface.nodes, surface.edges);
  }, [stack, nodes, edges, restoreState]);

  const exitOne = useCallback(() => exitToDepth(stack.length - 1), [exitToDepth, stack.length]);

  // Root canvas with the current subgraph edits folded in — what must be
  // persisted/shared/exported while drilled in.
  const composedRoot = useMemo(() => {
    let surface = { nodes, edges };
    for (let i = stack.length - 1; i >= 0; i--) {
      surface = foldInto(stack[i], surface);
    }
    return surface;
  }, [nodes, edges, stack]);

  // Drop the stack without folding — for when the surface is replaced wholesale
  // (tab switch, file/clipboard/URL load). The composedRoot of the previous
  // surface was already auto-saved, so nothing is lost.
  const reset = useCallback(() => setStack([]), []);

  return { stack, enterSubgraph, exitToDepth, exitOne, composedRoot, reset };
}
