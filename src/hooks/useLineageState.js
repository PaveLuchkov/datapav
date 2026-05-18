import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNodesState, useEdgesState, addEdge, MarkerType } from 'reactflow';
import { getActiveCanvasKey } from '../constants';
import { uid } from '../utils/uid';
import { NODE_REGISTRY } from '../nodes/registry';
import { computeNodeOutputAttributes, getUpstreamAttrs } from '../utils/nodeOutputAttrs';
import { useDataFrameCallbacks }  from '../nodes/dataframe/callbacks';
import { useMergeCallbacks }      from '../nodes/merge/callbacks';
import { useFunctionCallbacks }   from '../nodes/function/callbacks';
import { useFilterCallbacks }     from '../nodes/filter/callbacks';
import { useGroupByCallbacks }    from '../nodes/groupby/callbacks';
import { useCommentCallbacks }    from '../nodes/comment/callbacks';
import { useRenameCallbacks }     from '../nodes/rename/callbacks';
import { useConcatCallbacks }     from '../nodes/concat/callbacks';
import { useTransformCallbacks }  from '../nodes/transform/callbacks';
import dataframeConfig from '../nodes/dataframe/config';
import mergeConfig     from '../nodes/merge/config';

// ── Node clone helpers ─────────────────────────────────────────────────────
// Remaps internal data IDs so pasted nodes don't share handles with originals.

function cloneNodeData(type, data) {
  if (type === 'dataFrameNode') {
    return { ...data, attributes: (data.attributes || []).map((a) => ({ ...a, id: uid() })) };
  }
  if (type === 'functionNode') {
    return {
      ...data,
      inputs:  (data.inputs  || []).map((i) => ({ ...i, id: uid() })),
      outputs: (data.outputs || []).map((o) => ({ ...o, id: uid() })),
    };
  }
  if (type === 'groupByNode') {
    const idMap = new Map();
    const newInputs = (data.inputs || []).map((inp) => { const nid = uid(); idMap.set(inp.id, nid); return { ...inp, id: nid }; });
    return {
      ...data,
      inputs: newInputs,
      groupByInputIds: (data.groupByInputIds || []).map((id) => idMap.get(id) ?? id),
      aggregations: (data.aggregations || []).map((a) => ({ ...a, id: uid(), inputId: idMap.get(a.inputId) ?? a.inputId })),
    };
  }
  if (type === 'renameNode') {
    return { ...data, mappings: (data.mappings || []).map((m) => ({ ...m, id: uid() })) };
  }
  if (type === 'transformNode') {
    return { ...data, ops: (data.ops || []).map((o) => ({ ...o, id: uid() })) };
  }
  return { ...data };
}

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

const COMPANION_TYPES = new Set(['mergeNode', 'groupByNode', 'functionNode', 'renameNode', 'transformNode']);

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

  // ── Per-type callbacks ────────────────────────────────────────────────────

  const dfCbs  = useDataFrameCallbacks(setNodes, setEdges, pushHistory);
  const mgCbs  = useMergeCallbacks(setNodes, pushHistory);
  const fnCbs  = useFunctionCallbacks(setNodes, setEdges, pushHistory);
  const ftCbs  = useFilterCallbacks(setNodes, pushHistory);
  const gbCbs  = useGroupByCallbacks(setNodes, setEdges, pushHistory);
  const cmCbs  = useCommentCallbacks(setNodes, pushHistory);
  const rnCbs  = useRenameCallbacks(setNodes, pushHistory);
  const ctCbs  = useConcatCallbacks();
  const trCbs  = useTransformCallbacks(setNodes, pushHistory);

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

  const nodesWithCallbacks = useMemo(() => {
    const enriched = nodes.map((n) => {
      if (n.type === 'functionNode' || n.type === 'concatNode') {
        const connectedDFs = edges
          .filter((e) => e.target === n.id && e.targetHandle === 'df-in')
          .map((e) => {
            const src = nodes.find((nd) => nd.id === e.source);
            return src ? { sourceNodeId: src.id, sourceNodeLabel: src.data.label } : null;
          })
          .filter(Boolean);
        return { ...n, data: { ...n.data, connectedDFs } };
      }
      if (n.type === 'filterNode' || n.type === 'renameNode' || n.type === 'transformNode') {
        const connectedAttrs = getUpstreamAttrs(n.id, edges, nodes);
        return { ...n, data: { ...n.data, connectedAttrs } };
      }
      if (n.type === 'mergeNode') {
        const leftEdge  = edges.find((e) => e.target === n.id && e.targetHandle === 'left-in');
        const rightEdge = edges.find((e) => e.target === n.id && e.targetHandle === 'right-in');
        const leftNode  = leftEdge  ? nodes.find((nd) => nd.id === leftEdge.source)  : null;
        const rightNode = rightEdge ? nodes.find((nd) => nd.id === rightEdge.source) : null;
        return {
          ...n,
          data: {
            ...n.data,
            leftDF:  leftNode  ? { id: leftNode.id,  label: leftNode.data.label,  attributes: computeNodeOutputAttributes(leftNode,  edges, nodes) } : null,
            rightDF: rightNode ? { id: rightNode.id, label: rightNode.data.label, attributes: computeNodeOutputAttributes(rightNode, edges, nodes) } : null,
          },
        };
      }
      return n;
    });
    return attachCallbacks(enriched, callbacks.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  // Sync attributes of companion DFs from their operator's output.
  // Only applies to DFs marked with _companionOf — regular DFs connected downstream
  // are NOT overwritten so the user can freely edit them.
  useEffect(() => {
    let changed = false;
    const updated = nodes.map((n) => {
      if (n.type !== 'dataFrameNode' || !n.data._companionOf) return n;
      const inEdge = edges.find((e) => e.target === n.id && e.targetHandle === 'df-in' && e.sourceHandle === 'df-out');
      if (!inEdge) return n;
      const src = nodes.find((nd) => nd.id === inEdge.source);
      if (!src || src.type === 'dataFrameNode') return n;
      const computed = computeNodeOutputAttributes(src, edges, nodes);
      if (JSON.stringify(n.data.attributes) === JSON.stringify(computed)) return n;
      changed = true;
      return { ...n, data: { ...n.data, attributes: computed } };
    });
    if (changed) setNodes(updated);
  }, [nodes, edges, setNodes]);

  // Refresh attrType in GroupByNode and FunctionNode inputs when upstream schema changes.
  // These nodes freeze attrType at drag time — this keeps them live without requiring re-drag.
  useEffect(() => {
    let anyChanged = false;
    const updated = nodes.map((n) => {
      if (n.type !== 'groupByNode' && n.type !== 'functionNode') return n;
      let nodeChanged = false;

      const refreshedInputs = (n.data.inputs || []).map((inp) => {
        const srcNode = nodes.find((s) => s.id === inp.sourceNodeId);
        if (!srcNode) return inp;
        const srcAttrs = computeNodeOutputAttributes(srcNode, edges, nodes);
        const liveAttr = srcAttrs.find((a) => a.name === inp.attrName);
        if (!liveAttr || liveAttr.type === inp.attrType) return inp;
        nodeChanged = true;
        return { ...inp, attrType: liveAttr.type };
      });

      if (n.type === 'functionNode') {
        const refreshedOutputs = (n.data.outputs || []).map((o) => {
          if (!o.fromInputId) return o;
          const inp = refreshedInputs.find((i) => i.id === o.fromInputId);
          if (!inp || inp.attrType === o.type) return o;
          nodeChanged = true;
          return { ...o, type: inp.attrType };
        });
        if (!nodeChanged) return n;
        anyChanged = true;
        return { ...n, data: { ...n.data, inputs: refreshedInputs, outputs: refreshedOutputs } };
      }

      if (!nodeChanged) return n;
      anyChanged = true;
      return { ...n, data: { ...n.data, inputs: refreshedInputs } };
    });
    if (anyChanged) setNodes(updated);
  }, [nodes, edges, setNodes]);

  // Auto-heal broken attributes: when a DF with broken columns gains upstream sources,
  // attributes whose names match are restored (broken: false) with the live type.
  useEffect(() => {
    let anyChanged = false;
    const updated = nodes.map((n) => {
      if (n.type !== 'dataFrameNode') return n;
      const hasBroken = (n.data.attributes || []).some((a) => a.broken);
      if (!hasBroken) return n;
      const upstreamAttrs = getUpstreamAttrs(n.id, edges, nodes);
      if (!upstreamAttrs.length) return n;
      const byName = new Map(upstreamAttrs.map((a) => [a.name, a]));
      let nodeChanged = false;
      const healed = (n.data.attributes || []).map((a) => {
        if (!a.broken || !byName.has(a.name)) return a;
        nodeChanged = true;
        return { ...a, broken: false, type: byName.get(a.name).type };
      });
      if (!nodeChanged) return n;
      anyChanged = true;
      return { ...n, data: { ...n.data, attributes: healed } };
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
    () => nodes.filter((n) => n.selected && (n.type === 'dataFrameNode' || n.type === 'mergeNode')),
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
        // Strip companionId so the cloned operator doesn't reference the original's companion
        data: { ...cloneNodeData(n.type, n.data), companionId: undefined },
      }));
      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...pasted]);
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      pushHistory();
      setEdges((eds) => eds.filter((ed) => !ed.selected));
      const selected = nodesRef.current.filter((n) => n.selected);
      const toDelete = new Set(selected.map((n) => n.id));
      // Any DF directly connected to a deleted operator's df-out has its columns marked broken
      // so downstream chains stay intact. This works regardless of companion status, so the
      // behaviour persists through reconnection cycles (delete → reconnect → delete again).
      // toOrphan: DF ids whose ALL columns go broken (operator deleted)
      // brokenAttrIds: specific attribute ids that go broken (source DF deleted)
      const toOrphan = new Set();           // DF ids: all columns go broken
      const brokenAttrIds = new Set();      // specific DF attr ids go broken
      const brokenNodeInputs = new Map();   // nodeId → Set<inputId> for GroupBy/Function
      for (const n of selected) {
        if (n.type !== 'dataFrameNode') {
          for (const e of edgesRef.current) {
            if (e.source !== n.id || e.sourceHandle !== 'df-out') continue;
            const target = nodesRef.current.find((nd) => nd.id === e.target && nd.type === 'dataFrameNode');
            if (target) toOrphan.add(target.id);
          }
        } else {
          for (const e of edgesRef.current) {
            if (e.source !== n.id || !e.sourceHandle?.endsWith('-source')) continue;
            const targetAttrId = e.targetHandle?.replace('-target', '');
            if (targetAttrId) brokenAttrIds.add(targetAttrId);
          }
        }
        // GroupBy and FunctionNode inputs referencing this deleted node
        for (const nd of nodesRef.current) {
          if (nd.type !== 'groupByNode' && nd.type !== 'functionNode') continue;
          const hit = (nd.data.inputs || []).filter((inp) => inp.sourceNodeId === n.id);
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
            const hasAttrHits = n.type === 'dataFrameNode' &&
              (n.data.attributes || []).some((a) => brokenAttrIds.has(a.id));
            const inputHits = brokenNodeInputs.get(n.id);
            if (!isOrphan && !hasAttrHits && !inputHits) return n;
            return {
              ...n,
              data: {
                ...n.data,
                _companionOf: toDelete.has(n.data._companionOf) ? undefined : n.data._companionOf,
                attributes: (n.data.attributes || []).map((a) => ({
                  ...a,
                  broken: isOrphan || brokenAttrIds.has(a.id) ? true : a.broken,
                })),
                inputs: inputHits
                  ? (n.data.inputs || []).map((inp) =>
                      inputHits.has(inp.id) ? { ...inp, broken: true } : inp
                    )
                  : n.data.inputs,
              },
            };
          })
      );
      setEdges((eds) => eds.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target)));
    }
  }, [undo, redo, pushHistory, setEdges, setNodes]);

  // Generic add — looks up config by type, calls config.make()
  // Operator nodes (merge/groupby/function) auto-spawn a companion DF to the right.
  const addNodeOfType = useCallback((type, x, y, dataOverrides) => {
    const entry = NODE_REGISTRY.find((e) => e.config.type === type);
    if (!entry) return;
    pushHistory();
    const newNode = entry.config.make(x, y, dataOverrides);
    if (COMPANION_TYPES.has(type)) {
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
    ...dfCbs, ...mgCbs, ...fnCbs, ...ftCbs, ...gbCbs, ...cmCbs,
    ...rnCbs, ...ctCbs, ...trCbs,
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
  };
}
