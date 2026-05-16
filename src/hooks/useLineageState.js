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

  callbacks.current = {
    onLabelChange, onCodeChange, onStageChange,
    ...dfCbs, ...mgCbs, ...fnCbs, ...ftCbs, ...gbCbs, ...cmCbs,
    ...rnCbs, ...ctCbs, ...trCbs,
  };

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

  // Sync result-DF attributes whenever a DataFrameNode is connected (via df-in)
  // to any operator node. The operator's output is the single source of truth.
  // Handles chained merges, groupby outputs, function outputs, etc.
  useEffect(() => {
    let changed = false;
    const updated = nodes.map((n) => {
      if (n.type !== 'dataFrameNode') return n;
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
        data: cloneNodeData(n.type, n.data),
      }));
      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...pasted]);
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      pushHistory();
      setEdges((eds) => eds.filter((ed) => !ed.selected));
      setNodes((nds) => {
        const toDelete = new Set(nds.filter((n) => n.selected).map((n) => n.id));
        if (toDelete.size > 0) setEdges((eds) => eds.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target)));
        return nds.filter((n) => !n.selected);
      });
    }
  }, [undo, redo, pushHistory, setEdges, setNodes]);

  // Generic add — looks up config by type, calls config.make()
  const addNodeOfType = useCallback((type, x, y, dataOverrides) => {
    const entry = NODE_REGISTRY.find((e) => e.config.type === type);
    if (!entry) return;
    pushHistory();
    setNodes((nds) => [...nds, entry.config.make(x, y, dataOverrides)]);
  }, [setNodes, pushHistory]);

  const deleteNode = useCallback((nodeId) => {
    pushHistory();
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, [setNodes, setEdges, pushHistory]);

  const createMerge = useCallback((dfs) => {
    pushHistory();
    const [a, b] = dfs;
    const midX = (a.position.x + b.position.x) / 2 + 20;
    const midY = (a.position.y + b.position.y) / 2 - 40;
    const mergeNodeDef = mergeConfig.make(midX, midY);
    const resultDFDef = dataframeConfig.make(midX + 420, midY, { label: 'merge_result', attributes: [] });
    setNodes((nds) => [...nds, mergeNodeDef, resultDFDef]);
    setEdges((eds) => [
      ...eds,
      makeMergeEdge(a.id, 'df-out', mergeNodeDef.id, 'left-in'),
      makeMergeEdge(b.id, 'df-out', mergeNodeDef.id, 'right-in'),
      makeMergeEdge(mergeNodeDef.id, 'df-out', resultDFDef.id, 'df-in'),
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
  };
}
