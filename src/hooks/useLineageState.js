import { useCallback, useMemo, useRef, useState } from 'react';
import { useNodesState, useEdgesState, addEdge, MarkerType } from 'reactflow';
import { STORAGE_KEY } from '../constants';

let idCounter = Date.now();
const uid = () => `${++idCounter}`;

const makeAttr = (name, type = 'string') => ({ id: uid(), name, type });

const makeNode = (label, x, y, attributes) => ({
  id: uid(),
  type: 'dataFrameNode',
  position: { x, y },
  data: { label, attributes: attributes.map((a) => makeAttr(a)) },
});

const makeFunctionNode = (name, x, y) => ({
  id: uid(),
  type: 'functionNode',
  position: { x, y },
  data: { label: name, inputs: [], outputs: [] },
});

const makeMergeEdge = (source, sourceHandle, target, targetHandle) => ({
  id: `em-${uid()}`,
  source, sourceHandle,
  target, targetHandle,
  type: 'smoothstep',
  style: { stroke: '#7c3aed', strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#7c3aed' },
});

const DEMO_NODES = [
  makeNode('raw_orders',      80,  80, ['order_id', 'customer_id', 'amount', 'created_at']),
  makeNode('raw_customers',   80, 300, ['customer_id', 'name', 'email', 'country']),
  makeNode('orders_enriched', 500, 180, ['order_id', 'customer_name', 'email', 'amount', 'country']),
];
const DEMO_EDGES = [];

function attachCallbacks(nodes, cbs) {
  return nodes.map((n) => ({ ...n, data: { ...n.data, ...cbs } }));
}

export function useLineageState() {
  const callbacks = useRef({});
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // ── History ────────────────────────────────────────────────────────────
  const history = useRef([]);
  const future  = useRef([]);
  // Always-current refs so snapshots can be taken synchronously
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

  // ── Init ───────────────────────────────────────────────────────────────

  const [initialized, setInitialized] = useState(false);
  if (!initialized) {
    setInitialized(true);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { nodes: sn, edges: se } = JSON.parse(saved);
        setNodes(sn); setEdges(se);
      } catch { setNodes(DEMO_NODES); setEdges(DEMO_EDGES); }
    } else {
      setNodes(DEMO_NODES); setEdges(DEMO_EDGES);
    }
  }

  // ── DataFrame callbacks ────────────────────────────────────────────────

  const onLabelChange = useCallback((nodeId, label) => {
    pushHistory();
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, label } } : n));
  }, [setNodes, pushHistory]);

  const onAttributeChange = useCallback((nodeId, attrId, name) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, attributes: n.data.attributes.map((a) => a.id === attrId ? { ...a, name } : a) } }
        : n
    ));
  }, [setNodes, pushHistory]);

  const onAttributeTypeChange = useCallback((nodeId, attrId, type) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, attributes: n.data.attributes.map((a) => a.id === attrId ? { ...a, type } : a) } }
        : n
    ));
  }, [setNodes, pushHistory]);

  const onAddAttribute = useCallback((nodeId) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, attributes: [...n.data.attributes, makeAttr('column')] } }
        : n
    ));
  }, [setNodes, pushHistory]);

  const onDeleteAttribute = useCallback((nodeId, attrId) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, attributes: n.data.attributes.filter((a) => a.id !== attrId) } }
        : n
    ));
    setEdges((eds) =>
      eds.filter((e) => !e.sourceHandle?.startsWith(attrId) && !e.targetHandle?.startsWith(attrId))
    );
  }, [setNodes, setEdges, pushHistory]);

  const onReorderAttributes = useCallback((nodeId, fromIndex, toIndex) => {
    pushHistory();
    setNodes((nds) => nds.map((n) => {
      if (n.id !== nodeId) return n;
      const attrs = [...n.data.attributes];
      const [moved] = attrs.splice(fromIndex, 1);
      attrs.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, moved);
      return { ...n, data: { ...n.data, attributes: attrs } };
    }));
  }, [setNodes, pushHistory]);

  const onAttributeDrop = useCallback((targetNodeId, { sourceNodeId, attrId, attrName, attrType }) => {
    pushHistory();
    const newAttr = makeAttr(attrName, attrType || 'string');
    setNodes((nds) => nds.map((n) =>
      n.id === targetNodeId
        ? { ...n, data: { ...n.data, attributes: [...n.data.attributes, newAttr] } }
        : n
    ));
    setEdges((eds) => [...eds, {
      id: `e-${attrId}-${newAttr.id}`,
      source: sourceNodeId, sourceHandle: `${attrId}-source`,
      target: targetNodeId, targetHandle: `${newAttr.id}-target`,
      type: 'smoothstep',
    }]);
  }, [setNodes, setEdges, pushHistory]);

  // ── MergeNode callbacks ────────────────────────────────────────────────

  const onJoinTypeChange = useCallback((nodeId, joinType) => {
    pushHistory();
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, joinType } } : n));
  }, [setNodes, pushHistory]);

  const onAddKey = useCallback((nodeId) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, keyPairs: [...(n.data.keyPairs || []), { left: '', right: '' }] } }
        : n
    ));
  }, [setNodes, pushHistory]);

  const onRemoveKey = useCallback((nodeId, index) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, keyPairs: (n.data.keyPairs || []).filter((_, i) => i !== index) } }
        : n
    ));
  }, [setNodes, pushHistory]);

  const onUpdateKey = useCallback((nodeId, index, side, value) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, keyPairs: (n.data.keyPairs || []).map((p, i) => i === index ? { ...p, [side]: value } : p) } }
        : n
    ));
  }, [setNodes, pushHistory]);

  // ── FunctionNode callbacks ─────────────────────────────────────────────

  const onFunctionInputDrop = useCallback((funcNodeId, { sourceNodeId, attrId, attrName, sourceNodeLabel }) => {
    pushHistory();
    const newInput = { id: uid(), attrName, sourceNodeId, sourceNodeLabel: sourceNodeLabel || sourceNodeId, sourceAttrId: attrId };
    setNodes((nds) => nds.map((n) =>
      n.id === funcNodeId
        ? { ...n, data: { ...n.data, inputs: [...n.data.inputs, newInput] } }
        : n
    ));
    setEdges((eds) => [...eds, {
      id: `e-fn-${attrId}-${newInput.id}`,
      source: sourceNodeId, sourceHandle: `${attrId}-source`,
      target: funcNodeId, targetHandle: `${newInput.id}-target`,
      type: 'smoothstep',
      style: { stroke: '#10b981', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
    }]);
  }, [setNodes, setEdges, pushHistory]);

  const onDeleteFunctionInput = useCallback((funcNodeId, inputId) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === funcNodeId
        ? { ...n, data: { ...n.data, inputs: n.data.inputs.filter((i) => i.id !== inputId) } }
        : n
    ));
    setEdges((eds) => eds.filter((e) => e.targetHandle !== `${inputId}-target`));
  }, [setNodes, setEdges, pushHistory]);

  const onAddFunctionOutput = useCallback((funcNodeId) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === funcNodeId
        ? { ...n, data: { ...n.data, outputs: [...n.data.outputs, makeAttr('output_col')] } }
        : n
    ));
  }, [setNodes, pushHistory]);

  const onDeleteFunctionOutput = useCallback((funcNodeId, outputId) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === funcNodeId
        ? { ...n, data: { ...n.data, outputs: n.data.outputs.filter((o) => o.id !== outputId) } }
        : n
    ));
    setEdges((eds) => eds.filter((e) => !e.sourceHandle?.startsWith(outputId) && !e.targetHandle?.startsWith(outputId)));
  }, [setNodes, setEdges, pushHistory]);

  const onFunctionOutputChange = useCallback((funcNodeId, outputId, name) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === funcNodeId
        ? { ...n, data: { ...n.data, outputs: n.data.outputs.map((o) => o.id === outputId ? { ...o, name } : o) } }
        : n
    ));
  }, [setNodes, pushHistory]);

  callbacks.current = {
    onLabelChange, onAttributeChange, onAttributeTypeChange,
    onAddAttribute, onDeleteAttribute, onReorderAttributes, onAttributeDrop,
    onJoinTypeChange, onAddKey, onRemoveKey, onUpdateKey,
    onFunctionInputDrop, onDeleteFunctionInput,
    onAddFunctionOutput, onDeleteFunctionOutput, onFunctionOutputChange,
  };

  // ── Derived state ──────────────────────────────────────────────────────

  const nodesWithCallbacks = useMemo(() => {
    const enriched = nodes.map((n) => {
      if (n.type !== 'mergeNode') return n;
      const leftEdge  = edges.find((e) => e.target === n.id && e.targetHandle === 'left-in');
      const rightEdge = edges.find((e) => e.target === n.id && e.targetHandle === 'right-in');
      const leftNode  = leftEdge  ? nodes.find((nd) => nd.id === leftEdge.source)  : null;
      const rightNode = rightEdge ? nodes.find((nd) => nd.id === rightEdge.source) : null;
      return {
        ...n,
        data: {
          ...n.data,
          leftDF:  leftNode  ? { id: leftNode.id,  label: leftNode.data.label,  attributes: leftNode.data.attributes  || [] } : null,
          rightDF: rightNode ? { id: rightNode.id, label: rightNode.data.label, attributes: rightNode.data.attributes || [] } : null,
        },
      };
    });
    return attachCallbacks(enriched, callbacks.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const selectedDFs = useMemo(
    () => nodes.filter((n) => n.selected && n.type === 'dataFrameNode'),
    [nodes]
  );

  // ── Graph operations ───────────────────────────────────────────────────

  const onConnect = useCallback((params) => {
    pushHistory();
    const isMergeEdge = params.sourceHandle === 'df-out' || params.sourceHandle === 'out';
    setEdges((eds) => addEdge(
      isMergeEdge
        ? { ...params, type: 'smoothstep', style: { stroke: '#7c3aed', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#7c3aed' } }
        : { ...params, type: 'smoothstep' },
      eds
    ));
  }, [setEdges, pushHistory]);

  const onKeyDown = useCallback((e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
      e.preventDefault(); undo(); return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
      e.preventDefault(); redo(); return;
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

  const addNode = useCallback((x, y) => {
    pushHistory();
    setNodes((nds) => [...nds, makeNode('new_dataframe', x, y, ['column_1'])]);
  }, [setNodes, pushHistory]);

  const addFunctionNode = useCallback((x, y) => {
    pushHistory();
    setNodes((nds) => [...nds, makeFunctionNode('my_function', x, y)]);
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
    const mergeId = uid();
    const mergeNode = {
      id: mergeId,
      type: 'mergeNode',
      position: { x: midX, y: midY },
      data: { joinType: 'inner', keyPairs: [] },
    };
    const resultNode = makeNode('result_df', midX + 300, midY + 20, []);
    setNodes((nds) => [...nds, mergeNode, resultNode]);
    setEdges((eds) => [
      ...eds,
      makeMergeEdge(a.id, 'df-out', mergeId, 'left-in'),
      makeMergeEdge(b.id, 'df-out', mergeId, 'right-in'),
      makeMergeEdge(mergeId, 'out', resultNode.id, 'df-in'),
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
    addNode, addFunctionNode, deleteNode, createMerge, restoreState,
  };
}
