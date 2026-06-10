import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNodesState, useEdgesState, addEdge, MarkerType } from 'reactflow';
import { getActiveCanvasKey } from '../constants';
import { uid } from '../utils/uid';
import { SPEC_LIST, getSpec } from '../nodes/specs';
import { computeNodeOutputAttributes } from '../utils/nodeOutputAttrs';
import dataframeConfig from '../nodes/dataframe/config';
import mergeConfig     from '../nodes/merge/config';

// This hook owns nodes/edges + undo history and is now spec-driven: per-type
// behavior lives in each node's spec (src/nodes/<type>/spec.js), and the loops
// here iterate the registry rather than switching on node.type. The capabilities
// consumed below:
//   spec.useCallbacks(ctx) → per-type handlers (composed generically)
//   spec.inject(node,...)  → extra data the component needs (connectedAttrs, leftDF, …)
//   spec.companion         → operator auto-spawns a result DataFrame
//   spec.clone(data)       → paste remaps internal ids
//   spec.refreshData(...)  → keep frozen input/output types in sync with upstream
//   spec.healBroken(...)   → restore broken columns when a source reappears
//   spec.ownsColumns       → stores columns explicitly (drives delete-break scoping)
//   spec.mergeable         → selectable to spawn a Merge

// ── Demo state ─────────────────────────────────────────────────────────────

const makeAttr = (name, type = 'string') => ({ id: uid(), name, type });

const DEMO_NODES = [
  dataframeConfig.make(80,  80,  { label: 'raw_orders',      attributes: ['order_id','customer_id','amount','created_at'].map((n) => makeAttr(n)) }),
  dataframeConfig.make(80,  300, { label: 'raw_customers',   attributes: ['customer_id','name','email','country'].map((n) => makeAttr(n)) }),
  dataframeConfig.make(500, 180, { label: 'orders_enriched', attributes: ['order_id','customer_name','email','amount','country'].map((n) => makeAttr(n)) }),
];
const DEMO_EDGES = [];

// ── Helpers ────────────────────────────────────────────────────────────────

function attachCallbacks(nodes, cbs) {
  return nodes.map((n) => ({ ...n, data: { ...n.data, ...cbs } }));
}

const makeMergeEdge = (source, sourceHandle, target, targetHandle) => ({
  id: `em-${uid()}`,
  source, sourceHandle, target, targetHandle,
  type: 'smoothstep',
  style: { stroke: '#7c3aed', strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#7c3aed' },
});

// Dashed edge that visually marks the operator→companion relationship
const makeCompanionEdge = (operatorId, companionId) => ({
  id: `ecomp-${uid()}`,
  source: operatorId,
  sourceHandle: 'df-out',
  target: companionId,
  targetHandle: 'df-in',
  type: 'smoothstep',
  style: { stroke: '#334155', strokeWidth: 1.5, strokeDasharray: '5 4' },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#334155' },
  data: { isCompanionEdge: true },
});

// ── Hook ───────────────────────────────────────────────────────────────────

export function useLineageState() {
  const callbacks  = useRef({});
  const clipboard  = useRef([]);
  const pasteCount = useRef(0);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // ── History ──────────────────────────────────────────────────────────────

  const history = useRef([]);
  const future  = useRef([]);
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const pushHistory = useCallback(() => {
    history.current = [...history.current.slice(-49), { nodes: nodesRef.current, edges: edgesRef.current }];
    future.current = [];
  }, []);

  const undo = useCallback(() => {
    if (!history.current.length) return;
    const prev = history.current[history.current.length - 1];
    future.current = [{ nodes: nodesRef.current, edges: edgesRef.current }, ...future.current.slice(0, 49)];
    history.current = history.current.slice(0, -1);
    setNodes(prev.nodes);
    setEdges(prev.edges);
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    if (!future.current.length) return;
    const next = future.current[0];
    history.current = [...history.current.slice(-49), { nodes: nodesRef.current, edges: edgesRef.current }];
    future.current = future.current.slice(1);
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [setNodes, setEdges]);

  // ── Init ─────────────────────────────────────────────────────────────────

  const [initialized, setInitialized] = useState(false);
  if (!initialized) {
    setInitialized(true);
    const saved = localStorage.getItem(getActiveCanvasKey());
    if (saved) {
      try {
        const { nodes: sn, edges: se } = JSON.parse(saved);
        setNodes(sn); setEdges(se);
      } catch { setNodes(DEMO_NODES); setEdges(DEMO_EDGES); }
    } else {
      setNodes(DEMO_NODES); setEdges(DEMO_EDGES);
    }
  }

  // ── Per-type callbacks (composed from the spec registry) ───────────────────
  // SPEC_LIST is a module-constant array, so iterating it calls the same hooks in
  // the same order every render — the Rules of Hooks invariant holds.

  const ctx = { setNodes, setEdges, pushHistory };
  const composedCallbacks = {};
  for (const spec of SPEC_LIST) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    Object.assign(composedCallbacks, spec.useCallbacks ? spec.useCallbacks(ctx) : {});
  }

  const onLabelChange = useCallback((nodeId, label) => {
    pushHistory();
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, label } } : n));
  }, [setNodes, pushHistory]);

  const onCodeChange = useCallback((nodeId, code) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, code } } : n));
  }, [setNodes]);

  const onStageChange = useCallback((nodeId, stage) => {
    pushHistory();
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, stage } } : n));
  }, [setNodes, pushHistory]);

  // ── Derived state ─────────────────────────────────────────────────────────

  // Each spec optionally injects extra data its component needs (connected
  // columns/DataFrames, merge input schemas, …) — replaces the old per-type switch.
  const nodesWithCallbacks = useMemo(() => {
    const enriched = nodes.map((n) => {
      const inject = getSpec(n.type)?.inject;
      return inject ? { ...n, data: { ...n.data, ...inject(n, edges, nodes) } } : n;
    });
    return attachCallbacks(enriched, callbacks.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  // Sync attributes of companion DFs from their operator's output. Only applies
  // to DFs marked with _companionOf whose upstream is a companion-producing
  // operator — regular downstream DFs are left editable.
  useEffect(() => {
    let changed = false;
    const updated = nodes.map((n) => {
      if (!n.data._companionOf) return n;
      const inEdge = edges.find((e) => e.target === n.id && e.targetHandle === 'df-in' && e.sourceHandle === 'df-out');
      if (!inEdge) return n;
      const src = nodes.find((nd) => nd.id === inEdge.source);
      if (!src || !getSpec(src.type)?.companion) return n;
      const computed = computeNodeOutputAttributes(src, edges, nodes);
      if (JSON.stringify(n.data.attributes) === JSON.stringify(computed)) return n;
      changed = true;
      return { ...n, data: { ...n.data, attributes: computed } };
    });
    if (changed) setNodes(updated);
  }, [nodes, edges, setNodes]);

  // Refresh frozen input/output types from live upstream schema (GroupBy/Function).
  useEffect(() => {
    let anyChanged = false;
    const updated = nodes.map((n) => {
      const refresh = getSpec(n.type)?.refreshData;
      if (!refresh) return n;
      const newData = refresh(n, edges, nodes);
      if (!newData) return n;
      anyChanged = true;
      return { ...n, data: newData };
    });
    if (anyChanged) setNodes(updated);
  }, [nodes, edges, setNodes]);

  // Auto-heal broken columns when a matching-named upstream source reappears.
  useEffect(() => {
    let anyChanged = false;
    const updated = nodes.map((n) => {
      const heal = getSpec(n.type)?.healBroken;
      if (!heal) return n;
      const newData = heal(n, edges, nodes);
      if (!newData) return n;
      anyChanged = true;
      return { ...n, data: newData };
    });
    if (anyChanged) setNodes(updated);
  }, [nodes, edges, setNodes]);

  // If a companion DF is manually deleted, clear the stale companionId on its operator.
  useEffect(() => {
    const companionIds = new Set(nodes.filter((n) => n.data?._companionOf).map((n) => n.id));
    let changed = false;
    const updated = nodes.map((n) => {
      if (n.data?.companionId && !companionIds.has(n.data.companionId)) {
        changed = true;
        return { ...n, data: { ...n.data, companionId: undefined } };
      }
      return n;
    });
    if (changed) setNodes(updated);
  }, [nodes, setNodes]);

  const selectedDFs = useMemo(
    () => nodes.filter((n) => n.selected && getSpec(n.type)?.mergeable),
    [nodes]
  );

  // ── Graph operations ───────────────────────────────────────────────────────

  const OPERATOR_EDGE_COLOR = {
    'df-out': '#7c3aed',
  };

  const onConnect = useCallback((params) => {
    pushHistory();
    const color = OPERATOR_EDGE_COLOR[params.sourceHandle];
    const isColumnEdge = params.sourceHandle?.endsWith('-source');
    setEdges((eds) => addEdge(
      color
        ? { ...params, type: 'smoothstep', style: { stroke: color, strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color } }
        : isColumnEdge
          ? { ...params, type: 'columnEdge', style: { stroke: '#60a5fa', strokeWidth: 1.5 } }
          : { ...params, type: 'smoothstep', style: { stroke: '#60a5fa', strokeWidth: 2 } },
      eds
    ));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setEdges, pushHistory]);

  const onKeyDown = useCallback((e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      const selected = nodesRef.current.filter((n) => n.selected);
      if (!selected.length) return;
      e.preventDefault();
      clipboard.current = selected;
      pasteCount.current = 0;
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      if (!clipboard.current.length) return;
      e.preventDefault();
      pasteCount.current += 1;
      const offset = pasteCount.current * 40;
      pushHistory();
      const pasted = clipboard.current.map((n) => ({
        ...n,
        id: uid(),
        selected: true,
        position: { x: n.position.x + offset, y: n.position.y + offset },
        // Spec.clone remaps internal ids; strip companionId so the clone doesn't
        // reference the original's companion DF.
        data: { ...(getSpec(n.type)?.clone?.(n.data) ?? { ...n.data }), companionId: undefined },
      }));
      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...pasted]);
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      pushHistory();
      setEdges((eds) => eds.filter((ed) => !ed.selected));
      const selected = nodesRef.current.filter((n) => n.selected);
      const toDelete = new Set(selected.map((n) => n.id));
      // A column-owning DataFrame deletion breaks specific downstream attributes
      // (via column edges); any other (operator) deletion orphans the whole
      // downstream DataFrame it feeds via df-out. Driven by spec.ownsColumns so it
      // stays correct as new node types are added.
      const toOrphan = new Set();           // DF ids: all columns go broken
      const brokenAttrIds = new Set();      // specific DF attr ids go broken
      const brokenNodeInputs = new Map();   // nodeId → Set<inputId> for column-input nodes
      for (const n of selected) {
        if (!getSpec(n.type)?.ownsColumns) {
          for (const e of edgesRef.current) {
            if (e.source !== n.id || e.sourceHandle !== 'df-out') continue;
            const target = nodesRef.current.find((nd) => nd.id === e.target && getSpec(nd.type)?.ownsColumns);
            if (target) toOrphan.add(target.id);
          }
        } else {
          for (const e of edgesRef.current) {
            if (e.source !== n.id || !e.sourceHandle?.endsWith('-source')) continue;
            const targetAttrId = e.targetHandle?.replace('-target', '');
            if (targetAttrId) brokenAttrIds.add(targetAttrId);
          }
        }
        // Any node carrying column-level inputs that reference this deleted node.
        for (const nd of nodesRef.current) {
          if (!Array.isArray(nd.data.inputs)) continue;
          const hit = nd.data.inputs.filter((inp) => inp.sourceNodeId === n.id);
          if (!hit.length) continue;
          if (!brokenNodeInputs.has(nd.id)) brokenNodeInputs.set(nd.id, new Set());
          for (const inp of hit) brokenNodeInputs.get(nd.id).add(inp.id);
        }
      }
      setNodes((nds) =>
        nds
          .filter((n) => !toDelete.has(n.id))
          .map((n) => {
            const isOrphan = toOrphan.has(n.id);
            const hasAttrHits = getSpec(n.type)?.ownsColumns &&
              (n.data.attributes || []).some((a) => brokenAttrIds.has(a.id));
            const inputHits = brokenNodeInputs.get(n.id);
            const losesCompanion = n.data._companionOf && toDelete.has(n.data._companionOf);
            if (!isOrphan && !hasAttrHits && !inputHits && !losesCompanion) return n;
            // Scope each write to fields the node actually has (code-review fix):
            // don't fabricate an empty attributes array on operators, etc.
            const data = { ...n.data };
            if (losesCompanion) data._companionOf = undefined;
            if (isOrphan || hasAttrHits) {
              data.attributes = (n.data.attributes || []).map((a) => ({
                ...a,
                broken: isOrphan || brokenAttrIds.has(a.id) ? true : a.broken,
              }));
            }
            if (inputHits) {
              data.inputs = (n.data.inputs || []).map((inp) =>
                inputHits.has(inp.id) ? { ...inp, broken: true } : inp
              );
            }
            return { ...n, data };
          })
      );
      setEdges((eds) => eds.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target)));
    }
  }, [undo, redo, pushHistory, setEdges, setNodes]);

  // Generic add — looks up the spec by type, calls spec.make().
  // Operators (spec.companion) auto-spawn a companion result DF to the right.
  const addNodeOfType = useCallback((type, x, y, dataOverrides) => {
    const spec = getSpec(type);
    if (!spec) return;
    pushHistory();
    const newNode = spec.make(x, y, dataOverrides);
    if (spec.companion) {
      const companionId = uid();
      const label = newNode.data.label ? `${newNode.data.label}_output` : 'output';
      const companion = dataframeConfig.makeCompanion(companionId, newNode.id, x + 420, y, [], label);
      const nodeWithCompanion = { ...newNode, data: { ...newNode.data, companionId } };
      setNodes((nds) => [...nds, nodeWithCompanion, companion]);
      setEdges((eds) => [...eds, makeCompanionEdge(newNode.id, companionId)]);
    } else {
      setNodes((nds) => [...nds, newNode]);
    }
  }, [setNodes, setEdges, pushHistory]);

  // Cascade-delete: when an operator is deleted, also remove its companion DF.
  const deleteNode = useCallback((nodeId) => {
    pushHistory();
    const opNode = nodesRef.current.find((n) => n.id === nodeId);
    const toDelete = new Set([nodeId]);
    if (opNode?.data?.companionId) toDelete.add(opNode.data.companionId);
    setNodes((nds) => nds.filter((n) => !toDelete.has(n.id)));
    setEdges((eds) => eds.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target)));
  }, [setNodes, setEdges, pushHistory]);

  // Manually create a companion DF for an operator that doesn't have one yet.
  const onCreateCompanion = useCallback((operatorNodeId) => {
    const opNode = nodesRef.current.find((n) => n.id === operatorNodeId);
    if (!opNode || opNode.data?.companionId) return;
    pushHistory();
    const companionId = uid();
    const label = opNode.data.label ? `${opNode.data.label}_output` : 'output';
    const companion = dataframeConfig.makeCompanion(
      companionId, operatorNodeId,
      opNode.position.x + 420, opNode.position.y,
      [], label
    );
    setNodes((nds) => [
      ...nds.map((n) => n.id === operatorNodeId ? { ...n, data: { ...n.data, companionId } } : n),
      companion,
    ]);
    setEdges((eds) => [...eds, makeCompanionEdge(operatorNodeId, companionId)]);
  }, [setNodes, setEdges, pushHistory]);

  // All per-frame callbacks bundled for nodesWithCallbacks injection
  callbacks.current = {
    onLabelChange, onCodeChange, onStageChange, onCreateCompanion,
    ...composedCallbacks,
  };

  const createMerge = useCallback((dfs) => {
    pushHistory();
    const [a, b] = dfs;
    const midX = (a.position.x + b.position.x) / 2 + 20;
    const midY = (a.position.y + b.position.y) / 2 - 40;
    const companionId = uid();
    const mergeNodeDef = { ...mergeConfig.make(midX, midY), data: { ...mergeConfig.make(midX, midY).data, companionId } };
    const companion = dataframeConfig.makeCompanion(companionId, mergeNodeDef.id, midX + 380, midY, [], 'merge_result');
    setNodes((nds) => [...nds, mergeNodeDef, companion]);
    setEdges((eds) => [
      ...eds,
      makeMergeEdge(a.id, 'df-out', mergeNodeDef.id, 'left-in'),
      makeMergeEdge(b.id, 'df-out', mergeNodeDef.id, 'right-in'),
      makeCompanionEdge(mergeNodeDef.id, companionId),
    ]);
  }, [setNodes, setEdges, pushHistory]);

  const restoreState = useCallback((newNodes, newEdges) => {
    history.current = [];
    future.current = [];
    setNodes(newNodes);
    setEdges(newEdges);
  }, [setNodes, setEdges]);

  return {
    nodes, edges, onNodesChange, onEdgesChange,
    nodesWithCallbacks, selectedDFs,
    onConnect, onKeyDown, undo, redo,
    addNodeOfType, deleteNode, createMerge, restoreState,
    onCreateCompanion,
    // raw setters + history hook for cross-cutting features (subgraph proxy
    // write-through) that surgically patch the surface without restoreState
    setNodes, setEdges, pushHistory,
  };
}
