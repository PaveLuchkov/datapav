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
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toPng } from 'html-to-image';

import DataFrameNode from './DataFrameNode';
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
    data: {
      label,
      attributes: attributes.map(makeAttr),
    },
  };
}

const DEMO_NODES = [
  makeNode('raw_orders', 80, 80, ['order_id', 'customer_id', 'amount', 'created_at']),
  makeNode('raw_customers', 80, 280, ['customer_id', 'name', 'email', 'country']),
  makeNode('orders_enriched', 420, 160, ['order_id', 'customer_name', 'email', 'amount', 'country']),
];

const DEMO_EDGES = [];

function attachCallbacks(nodes, callbacks) {
  return nodes.map((n) => ({
    ...n,
    data: { ...n.data, ...callbacks },
  }));
}

function App() {
  const reactFlowWrapper = useRef(null);
  const reactFlowInstance = useRef(null);

  const callbacks = useRef({});

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Initialize with demo data or localStorage
  const [initialized, setInitialized] = useState(false);
  if (!initialized) {
    setInitialized(true);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { nodes: sn, edges: se } = JSON.parse(saved);
        setNodes(sn);
        setEdges(se);
      } catch {
        setNodes(DEMO_NODES);
        setEdges(DEMO_EDGES);
      }
    } else {
      setNodes(DEMO_NODES);
      setEdges(DEMO_EDGES);
    }
  }

  // --- Node data mutators (stable refs via callbacks.current) ---

  const onLabelChange = useCallback((nodeId, label) => {
    setNodes((nds) =>
      nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, label } } : n)
    );
  }, [setNodes]);

  const onAttributeChange = useCallback((nodeId, attrId, name) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, attributes: n.data.attributes.map((a) => a.id === attrId ? { ...a, name } : a) } }
          : n
      )
    );
  }, [setNodes]);

  const onAddAttribute = useCallback((nodeId) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, attributes: [...n.data.attributes, makeAttr('column')] } }
          : n
      )
    );
  }, [setNodes]);

  const onDeleteAttribute = useCallback((nodeId, attrId) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, attributes: n.data.attributes.filter((a) => a.id !== attrId) } }
          : n
      )
    );
    setEdges((eds) =>
      eds.filter((e) => !e.sourceHandle?.startsWith(attrId) && !e.targetHandle?.startsWith(attrId))
    );
  }, [setNodes, setEdges]);

  const onAttributeDrop = useCallback((targetNodeId, { sourceNodeId, attrId, attrName }) => {
    const newAttr = makeAttr(attrName);
    setNodes((nds) =>
      nds.map((n) =>
        n.id === targetNodeId
          ? { ...n, data: { ...n.data, attributes: [...n.data.attributes, newAttr] } }
          : n
      )
    );
    setEdges((eds) => [
      ...eds,
      {
        id: `e-${attrId}-${newAttr.id}`,
        source: sourceNodeId,
        sourceHandle: `${attrId}-source`,
        target: targetNodeId,
        targetHandle: `${newAttr.id}-target`,
        type: 'smoothstep',
        animated: false,
      },
    ]);
  }, [setNodes, setEdges]);

  callbacks.current = { onLabelChange, onAttributeChange, onAddAttribute, onDeleteAttribute, onAttributeDrop };

  // Inject callbacks into every node's data
  const nodesWithCallbacks = useMemo(
    () => attachCallbacks(nodes, callbacks.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes]
  );

  const nodeTypes = useMemo(() => ({ dataFrameNode: DataFrameNode }), []);

  // --- Edge connection ---
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: false, type: 'smoothstep' }, eds)),
    [setEdges]
  );

  // --- Delete selected edges on Delete key ---
  const onKeyDown = useCallback(
    (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        setEdges((eds) => eds.filter((ed) => !ed.selected));
        setNodes((nds) => nds.filter((nd) => !nd.selected));
      }
    },
    [setEdges, setNodes]
  );

  // --- Context menu ---
  const [menu, setMenu] = useState(null);

  const onPaneContextMenu = useCallback((e) => {
    e.preventDefault();
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    setMenu({ x: e.clientX - bounds.left, y: e.clientY - bounds.top, type: 'pane', flowX: e.clientX, flowY: e.clientY });
  }, []);

  const onNodeContextMenu = useCallback((e, node) => {
    e.preventDefault();
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    setMenu({ x: e.clientX - bounds.left, y: e.clientY - bounds.top, type: 'node', nodeId: node.id });
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  const addNodeAtMenu = useCallback(() => {
    if (!menu || !reactFlowInstance.current) return;
    const pos = reactFlowInstance.current.screenToFlowPosition({ x: menu.flowX, y: menu.flowY });
    const node = makeNode('new_dataframe', pos.x, pos.y, ['column_1']);
    setNodes((nds) => [...nds, node]);
    setMenu(null);
  }, [menu, setNodes]);

  const deleteNode = useCallback(() => {
    if (!menu) return;
    setNodes((nds) => nds.filter((n) => n.id !== menu.nodeId));
    setEdges((eds) =>
      eds.filter((e) => e.source !== menu.nodeId && e.target !== menu.nodeId)
    );
    setMenu(null);
  }, [menu, setNodes, setEdges]);

  // --- Toolbar actions ---
  const addNode = useCallback(() => {
    const pos = reactFlowInstance.current
      ? reactFlowInstance.current.screenToFlowPosition({ x: 200, y: 200 })
      : { x: 200, y: 200 };
    const node = makeNode('new_dataframe', pos.x, pos.y, ['column_1']);
    setNodes((nds) => [...nds, node]);
  }, [setNodes]);

  const saveState = useCallback(() => {
    const state = { nodes, edges };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    showToast('Saved!');
  }, [nodes, edges]);

  const loadState = useCallback(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) { showToast('Nothing saved yet'); return; }
    try {
      const { nodes: sn, edges: se } = JSON.parse(saved);
      setNodes(sn);
      setEdges(se);
      showToast('Loaded!');
    } catch {
      showToast('Failed to load');
    }
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
      backgroundColor: '#0f172a',
      width,
      height,
      style: {
        width,
        height,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    }).then((dataUrl) => {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'lineage.png';
      a.click();
    });
  }, [nodes]);

  // --- Toast ---
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
          <MiniMap
            nodeColor="#1a3a5c"
            maskColor="rgba(15,23,42,0.7)"
            position="bottom-left"
          />
        </ReactFlow>
      </div>

      <Toolbar
        onAddNode={addNode}
        onSave={saveState}
        onLoad={loadState}
        onExportPng={exportPng}
      />

      {/* Context menu */}
      {menu && (
        <div
          className="absolute z-50 rounded-lg border border-slate-600 shadow-2xl overflow-hidden text-sm"
          style={{ left: menu.x, top: menu.y, background: '#1e293b', minWidth: 160 }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {menu.type === 'pane' && (
            <button
              onClick={addNodeAtMenu}
              className="w-full text-left px-4 py-2 text-slate-200 hover:bg-slate-700 transition-colors"
            >
              + Add DataFrame here
            </button>
          )}
          {menu.type === 'node' && (
            <button
              onClick={deleteNode}
              className="w-full text-left px-4 py-2 text-red-400 hover:bg-slate-700 transition-colors"
            >
              Delete DataFrame
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

export default App;
