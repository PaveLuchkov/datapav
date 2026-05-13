import React, { useState, useCallback, useRef } from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';

import DataFrameNode from './DataFrameNode';
import MergeNode from './MergeNode';
import FunctionNode from './FunctionNode';
import Toolbar from './Toolbar';
import { DragProvider } from './components/DragContext';
import { useLineageState } from './hooks/useLineageState';
import { useLineagePersistence } from './hooks/useLineagePersistence';

function isValidConnection({ sourceHandle, targetHandle }) {
  if (sourceHandle?.endsWith('-source') && targetHandle?.endsWith('-target')) return true;
  if (sourceHandle === 'df-out' && (targetHandle === 'left-in' || targetHandle === 'right-in')) return true;
  if (sourceHandle === 'out' && targetHandle === 'df-in') return true;
  return false;
}

const nodeTypes = { dataFrameNode: DataFrameNode, mergeNode: MergeNode, functionNode: FunctionNode };

export default function App() {
  const reactFlowWrapper = useRef(null);
  const reactFlowInstance = useRef(null);

  const {
    nodes, edges, onNodesChange, onEdgesChange,
    nodesWithCallbacks, selectedDFs,
    onConnect, onKeyDown,
    addNode, addFunctionNode, deleteNode, createMerge, restoreState,
  } = useLineageState();

  // ── Toast ──────────────────────────────────────────────────────────────

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  const { saveState, loadState, exportPng } = useLineagePersistence({
    nodes, edges, restoreState, showToast,
  });

  // ── Context menu ───────────────────────────────────────────────────────

  const [menu, setMenu] = useState(null);
  const closeMenu = useCallback(() => setMenu(null), []);

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

  const addNodeAtMenu = useCallback(() => {
    if (!menu || !reactFlowInstance.current) return;
    const { x, y } = reactFlowInstance.current.screenToFlowPosition({ x: menu.flowX, y: menu.flowY });
    addNode(x, y);
    setMenu(null);
  }, [menu, addNode]);

  const addFunctionAtMenu = useCallback(() => {
    if (!menu || !reactFlowInstance.current) return;
    const { x, y } = reactFlowInstance.current.screenToFlowPosition({ x: menu.flowX, y: menu.flowY });
    addFunctionNode(x, y);
    setMenu(null);
  }, [menu, addFunctionNode]);

  const deleteNodeFromMenu = useCallback(() => {
    if (!menu) return;
    deleteNode(menu.nodeId);
    setMenu(null);
  }, [menu, deleteNode]);

  // ── Toolbar actions ────────────────────────────────────────────────────

  const addNodeCenter = useCallback(() => {
    const pos = reactFlowInstance.current
      ? reactFlowInstance.current.screenToFlowPosition({ x: 200, y: 200 })
      : { x: 200, y: 200 };
    addNode(pos.x, pos.y);
  }, [addNode]);

  const addFunctionCenter = useCallback(() => {
    const pos = reactFlowInstance.current
      ? reactFlowInstance.current.screenToFlowPosition({ x: 200, y: 200 })
      : { x: 200, y: 200 };
    addFunctionNode(pos.x, pos.y);
  }, [addFunctionNode]);

  const handleMergeSelected = useCallback(() => createMerge(selectedDFs), [createMerge, selectedDFs]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <DragProvider>
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
            <MiniMap
              nodeColor={(n) => n.type === 'mergeNode' ? '#2e1065' : n.type === 'functionNode' ? '#052e16' : '#1a3a5c'}
              maskColor="rgba(15,23,42,0.7)"
              position="bottom-left"
            />
          </ReactFlow>
        </div>

        <Toolbar
          onAddNode={addNodeCenter}
          onAddFunction={addFunctionCenter}
          onSave={saveState}
          onLoad={loadState}
          onExportPng={exportPng}
          selectedDFCount={selectedDFs.length}
          onMergeSelected={handleMergeSelected}
        />

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
                  <button onClick={handleMergeSelected} className="w-full text-left px-4 py-2 text-violet-300 hover:bg-slate-700 transition-colors border-t border-slate-700">
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

        {toast && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-blue-700 text-white text-sm shadow-xl pointer-events-none">
            {toast}
          </div>
        )}
      </div>
    </DragProvider>
  );
}
