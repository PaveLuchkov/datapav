import React, { useState, useCallback, useRef, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  getNodesBounds,
  getViewportForBounds,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toPng } from 'html-to-image';

import DataFrameNode from './DataFrameNode';
import MergeNode from './MergeNode';
import FunctionNode from './FunctionNode';
import Toolbar from './Toolbar';

const STORAGE_KEY = 'lineage-editor-state';

let idCounter = 100;
const uid = () => `${++idCounter}`;

function makeAttr(name) {
  return { id: uid(), name };
}

function makeNode(label, x, y, attributes) {
  const id = uid();
  return {
    id,
    type: 'dataFrameNode',
    position: { x, y },
    data: { label, attributes: attributes.map(makeAttr) },
  };
}

function makeFunctionNode(name, x, y) {
  const id = uid();
  return {
    id,
    type: 'functionNode',
    position: { x, y },
    data: { label: name, inputs: [], outputs: [] },
  };
}

function makeMergeEdge(source, sourceHandle, target, targetHandle) {
  return {
    id: `em-${uid()}`,
    source, sourceHandle,
    target, targetHandle,
    type: 'smoothstep',
    style: { stroke: '#7c3aed', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#7c3aed' },
  };
}

const DEMO_NODES = [
  makeNode('raw_orders',    80,  80, ['order_id', 'customer_id', 'amount', 'created_at']),
  makeNode('raw_customers', 80, 300, ['customer_id', 'name', 'email', 'country']),
  makeNode('orders_enriched', 500, 180, ['order_id', 'customer_name', 'email', 'amount', 'country']),
];
const DEMO_EDGES = [];

function attachCallbacks(nodes, cbs) {
  return nodes.map((n) => ({ ...n, data: { ...n.data, ...cbs } }));
}

// Which handle connections are valid
function isValidConnection({ sourceHandle, targetHandle }) {
  // Attribute lineage: blue dot → blue dot
  if (sourceHandle?.endsWith('-source') && targetHandle?.endsWith('-target')) return true;
  // DataFrame → MergeNode input
  if (sourceHandle === 'df-out' && (targetHandle === 'left-in' || targetHandle === 'right-in')) return true;
  // MergeNode output → DataFrame
  if (sourceHandle === 'out' && targetHandle === 'df-in') return true;
  return false;
}

export default function App() {
  const reactFlowWrapper = useRef(null);
  const reactFlowInstance = useRef(null);
  const callbacks = useRef({});

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Init from localStorage or demo
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
        ? { ...n, data: { ...n.data, keyPairs: [...n.data.keyPairs, { left: '', right: '' }] } }
        : n
    ));
  }, [setNodes]);

  const onRemoveKey = useCallback((nodeId, index) => {
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, keyPairs: n.data.keyPairs.filter((_, i) => i !== index) } }
        : n
    ));
  }, [setNodes]);

  const onUpdateKey = useCallback((nodeId, index, side, value) => {
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, keyPairs: n.data.keyPairs.map((p, i) => i === index ? { ...p, [side]: value } : p) } }
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

  const nodeTypes = useMemo(() => ({ dataFrameNode: DataFrameNode, mergeNode: MergeNode, functionNode: FunctionNode }), []);

  // ── Connections ────────────────────────────────────────────────────────

  const onConnect = useCallback((params) => {
    const isMergeEdge =
      params.sourceHandle === 'df-out' ||
      params.sourceHandle === 'out';

    setEdges((eds) => addEdge(
      isMergeEdge
        ? { ...params, type: 'smoothstep', style: { stroke: '#7c3aed', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#7c3aed' } }
        : { ...params, type: 'smoothstep' },
      eds
    ));
  }, [setEdges]);

  // ── Keyboard ───────────────────────────────────────────────────────────

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

  // ── Context menu ───────────────────────────────────────────────────────

  const [menu, setMenu] = useState(null);

  const selectedDFs = useMemo(
    () => nodes.filter((n) => n.selected && n.type === 'dataFrameNode'),
    [nodes]
  );

  const onPaneContextMenu = useCallback((e) => {
    e.preventDefault();
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    setMenu({ x: e.clientX - bounds.left, y: e.clientY - bounds.top, type: 'pane', flowX: e.clientX, flowY: e.clientY });
  }, []);

  const onNodeContextMenu = useCallback((e, node) => {
    e.preventDefault();
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    setMenu({ x: e.clientX - bounds.left, y: e.clientY - bounds.top, type: 'node', nodeId: node.id, nodeType: node.type });
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  const addNodeAtMenu = useCallback(() => {
    if (!menu || !reactFlowInstance.current) return;
    const pos = reactFlowInstance.current.screenToFlowPosition({ x: menu.flowX, y: menu.flowY });
    setNodes((nds) => [...nds, makeNode('new_dataframe', pos.x, pos.y, ['column_1'])]);
    setMenu(null);
  }, [menu, setNodes]);

  const deleteNodeFromMenu = useCallback(() => {
    if (!menu) return;
    setNodes((nds) => nds.filter((n) => n.id !== menu.nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== menu.nodeId && e.target !== menu.nodeId));
    setMenu(null);
  }, [menu, setNodes, setEdges]);

  // Create merge from 2 selected DataFrames
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
    setMenu(null);
  }, [setNodes, setEdges]);

  // ── Toolbar actions ────────────────────────────────────────────────────

  const addNode = useCallback(() => {
    const pos = reactFlowInstance.current
      ? reactFlowInstance.current.screenToFlowPosition({ x: 200, y: 200 })
      : { x: 200, y: 200 };
    setNodes((nds) => [...nds, makeNode('new_dataframe', pos.x, pos.y, ['column_1'])]);
  }, [setNodes]);

  const addFunctionNode = useCallback(() => {
    const pos = reactFlowInstance.current
      ? reactFlowInstance.current.screenToFlowPosition({ x: 200, y: 200 })
      : { x: 200, y: 200 };
    setNodes((nds) => [...nds, makeFunctionNode('my_function', pos.x, pos.y)]);
  }, [setNodes]);

  const addFunctionAtMenu = useCallback(() => {
    if (!menu || !reactFlowInstance.current) return;
    const pos = reactFlowInstance.current.screenToFlowPosition({ x: menu.flowX, y: menu.flowY });
    setNodes((nds) => [...nds, makeFunctionNode('my_function', pos.x, pos.y)]);
    setMenu(null);
  }, [menu, setNodes]);

  const saveState = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }));
    showToast('Saved!');
  }, [nodes, edges]);

  const loadState = useCallback(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) { showToast('Nothing saved yet'); return; }
    try {
      const { nodes: sn, edges: se } = JSON.parse(saved);
      setNodes(sn); setEdges(se);
      showToast('Loaded!');
    } catch { showToast('Failed to load'); }
  }, [setNodes, setEdges]);

  const exportPng = useCallback(() => {
    const nodesBounds = getNodesBounds(nodes);
    const pad = 40;
    const width = nodesBounds.width + pad * 2;
    const height = nodesBounds.height + pad * 2;
    const viewport = getViewportForBounds(nodesBounds, width, height, 0.5, 2, pad);
    const flowEl = document.querySelector('.react-flow__viewport');
    if (!flowEl) return;
    toPng(flowEl, {
      backgroundColor: '#0f172a', width, height,
      style: { width, height, transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` },
    }).then((dataUrl) => {
      const a = document.createElement('a');
      a.href = dataUrl; a.download = 'lineage.png'; a.click();
    });
  }, [nodes]);

  // ── Toast ──────────────────────────────────────────────────────────────

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }

  return (
    <div className="w-screen h-screen bg-slate-900 relative" onKeyDown={onKeyDown} tabIndex={0}>
      <div ref={reactFlowWrapper} className="w-full h-full">
        <ReactFlow
          nodes={nodesWithCallbacks}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onInit={(inst) => { reactFlowInstance.current = inst; }}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          onPaneClick={closeMenu}
          onNodeClick={closeMenu}
          fitView
          deleteKeyCode={null}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#1e3a5f" gap={20} size={1} />
          <Controls position="bottom-right" />
          <MiniMap nodeColor={(n) => n.type === 'mergeNode' ? '#2e1065' : n.type === 'functionNode' ? '#052e16' : '#1a3a5c'} maskColor="rgba(15,23,42,0.7)" position="bottom-left" />
        </ReactFlow>
      </div>

      <Toolbar
        onAddNode={addNode}
        onAddFunction={addFunctionNode}
        onSave={saveState}
        onLoad={loadState}
        onExportPng={exportPng}
        selectedDFCount={selectedDFs.length}
        onMergeSelected={() => createMerge(selectedDFs)}
      />

      {/* Context menu */}
      {menu && (
        <div
          className="absolute z-50 rounded-lg border border-slate-600 shadow-2xl overflow-hidden text-sm"
          style={{ left: menu.x, top: menu.y, background: '#1e293b', minWidth: 190 }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {menu.type === 'pane' && (
            <>
              <button onClick={addNodeAtMenu} className="w-full text-left px-4 py-2 text-slate-200 hover:bg-slate-700 transition-colors">
                + Add DataFrame here
              </button>
              <button onClick={addFunctionAtMenu} className="w-full text-left px-4 py-2 text-emerald-300 hover:bg-slate-700 transition-colors border-t border-slate-700">
                ƒ Add Function here
              </button>
              {selectedDFs.length === 2 && (
                <button onClick={() => createMerge(selectedDFs)} className="w-full text-left px-4 py-2 text-violet-300 hover:bg-slate-700 transition-colors border-t border-slate-700">
                  ⋈ Merge selected DFs
                </button>
              )}
            </>
          )}
          {menu.type === 'node' && (
            <button onClick={deleteNodeFromMenu} className="w-full text-left px-4 py-2 text-red-400 hover:bg-slate-700 transition-colors">
              Delete {menu.nodeType === 'mergeNode' ? 'Merge' : menu.nodeType === 'functionNode' ? 'Function' : 'DataFrame'}
            </button>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-blue-700 text-white text-sm shadow-xl pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  );
}
