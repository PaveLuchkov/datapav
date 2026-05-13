import { useCallback, useMemo, useRef, useState } from 'react';
import { useNodesState, useEdgesState, addEdge, MarkerType } from 'reactflow';
import { STORAGE_KEY } from '../constants';

let idCounter = Date.now();
const uid = () => `${++idCounter}`;

const makeAttr = (name) => ({ id: uid(), name });

const makeNode = (label, x, y, attributes) => ({
  id: uid(),
  type: 'dataFrameNode',
  position: { x, y },
  data: { label, attributes: attributes.map(makeAttr) },
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
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, label } } : n));
  }, [setNodes]);

  const onAttributeChange = useCallback((nodeId, attrId, name) => {
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, attributes: n.data.attributes.map((a) => a.id === attrId ? { ...a, name } : a) } }
        : n
    ));
  }, [setNodes]);

  const onAddAttribute = useCallback((nodeId) => {
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, attributes: [...n.data.attributes, makeAttr('column')] } }
        : n
    ));
  }, [setNodes]);

  const onDeleteAttribute = useCallback((nodeId, attrId) => {
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, attributes: n.data.attributes.filter((a) => a.id !== attrId) } }
        : n
    ));
    setEdges((eds) =>
      eds.filter((e) => !e.sourceHandle?.startsWith(attrId) && !e.targetHandle?.startsWith(attrId))
    );
  }, [setNodes, setEdges]);

  const onReorderAttributes = useCallback((nodeId, fromIndex, toIndex) => {
    setNodes((nds) => nds.map((n) => {
      if (n.id !== nodeId) return n;
      const attrs = [...n.data.attributes];
      const [moved] = attrs.splice(fromIndex, 1);
      attrs.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, moved);
      return { ...n, data: { ...n.data, attributes: attrs } };
    }));
  }, [setNodes]);

  const onAttributeDrop = useCallback((targetNodeId, { sourceNodeId, attrId, attrName }) => {
    const newAttr = makeAttr(attrName);
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
  }, [setNodes, setEdges]);

  // ── MergeNode callbacks ────────────────────────────────────────────────

  const onJoinTypeChange = useCallback((nodeId, joinType) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, joinType } } : n));
  }, [setNodes]);

  const onAddKey = useCallback((nodeId) => {
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, keyPairs: [...(n.data.keyPairs || []), { left: '', right: '' }] } }
        : n
    ));
  }, [setNodes]);

  const onRemoveKey = useCallback((nodeId, index) => {
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, keyPairs: (n.data.keyPairs || []).filter((_, i) => i !== index) } }
        : n
    ));
  }, [setNodes]);

  const onUpdateKey = useCallback((nodeId, index, side, value) => {
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, keyPairs: (n.data.keyPairs || []).map((p, i) => i === index ? { ...p, [side]: value } : p) } }
        : n
    ));
  }, [setNodes]);

  // ── FunctionNode callbacks ─────────────────────────────────────────────

  const onFunctionInputDrop = useCallback((funcNodeId, { sourceNodeId, attrId, attrName, sourceNodeLabel }) => {
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
  }, [setNodes, setEdges]);

  const onDeleteFunctionInput = useCallback((funcNodeId, inputId) => {
    setNodes((nds) => nds.map((n) =>
      n.id === funcNodeId
        ? { ...n, data: { ...n.data, inputs: n.data.inputs.filter((i) => i.id !== inputId) } }
        : n
    ));
    setEdges((eds) => eds.filter((e) => e.targetHandle !== `${inputId}-target`));
  }, [setNodes, setEdges]);

  const onAddFunctionOutput = useCallback((funcNodeId) => {
    setNodes((nds) => nds.map((n) =>
      n.id === funcNodeId
        ? { ...n, data: { ...n.data, outputs: [...n.data.outputs, makeAttr('output_col')] } }
        : n
    ));
  }, [setNodes]);

  const onDeleteFunctionOutput = useCallback((funcNodeId, outputId) => {
    setNodes((nds) => nds.map((n) =>
      n.id === funcNodeId
        ? { ...n, data: { ...n.data, outputs: n.data.outputs.filter((o) => o.id !== outputId) } }
        : n
    ));
    setEdges((eds) => eds.filter((e) => !e.sourceHandle?.startsWith(outputId) && !e.targetHandle?.startsWith(outputId)));
  }, [setNodes, setEdges]);

  const onFunctionOutputChange = useCallback((funcNodeId, outputId, name) => {
    setNodes((nds) => nds.map((n) =>
      n.id === funcNodeId
        ? { ...n, data: { ...n.data, outputs: n.data.outputs.map((o) => o.id === outputId ? { ...o, name } : o) } }
        : n
    ));
  }, [setNodes]);

  callbacks.current = {
    onLabelChange, onAttributeChange, onAddAttribute, onDeleteAttribute,
    onReorderAttributes, onAttributeDrop,
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
    const isMergeEdge = params.sourceHandle === 'df-out' || params.sourceHandle === 'out';
    setEdges((eds) => addEdge(
      isMergeEdge
        ? { ...params, type: 'smoothstep', style: { stroke: '#7c3aed', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#7c3aed' } }
        : { ...params, type: 'smoothstep' },
      eds
    ));
  }, [setEdges]);

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      setEdges((eds) => eds.filter((ed) => !ed.selected));
      setNodes((nds) => {
        const toDelete = new Set(nds.filter((n) => n.selected).map((n) => n.id));
        if (toDelete.size > 0) setEdges((eds) => eds.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target)));
        return nds.filter((n) => !n.selected);
      });
    }
  }, [setEdges, setNodes]);

  const addNode = useCallback((x, y) => {
    setNodes((nds) => [...nds, makeNode('new_dataframe', x, y, ['column_1'])]);
  }, [setNodes]);

  const addFunctionNode = useCallback((x, y) => {
    setNodes((nds) => [...nds, makeFunctionNode('my_function', x, y)]);
  }, [setNodes]);

  const deleteNode = useCallback((nodeId) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, [setNodes, setEdges]);

  const createMerge = useCallback((dfs) => {
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
  }, [setNodes, setEdges]);

  const restoreState = useCallback((newNodes, newEdges) => {
    setNodes(newNodes);
    setEdges(newEdges);
  }, [setNodes, setEdges]);

  return {
    nodes, edges, onNodesChange, onEdgesChange,
    nodesWithCallbacks, selectedDFs,
    onConnect, onKeyDown,
    addNode, addFunctionNode, deleteNode, createMerge, restoreState,
  };
}
