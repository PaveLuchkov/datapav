import React, { useState, useCallback, useRef } from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';

import DataFrameNode from './DataFrameNode';
import MergeNode from './MergeNode';
import FunctionNode from './FunctionNode';
import Toolbar from './Toolbar';
import { DragProvider } from './components/DragContext';
import ContextMenu from './components/ContextMenu';
import NodeErrorBoundary from './components/NodeErrorBoundary';
import { useLineageState } from './hooks/useLineageState';
import { useLineagePersistence } from './hooks/useLineagePersistence';
import { useContextMenu } from './hooks/useContextMenu';

function isValidConnection({ sourceHandle, targetHandle }) {
  if (sourceHandle?.endsWith('-source') && targetHandle?.endsWith('-target')) return true;
  if (sourceHandle === 'df-out' && (targetHandle === 'left-in' || targetHandle === 'right-in')) return true;
  if (sourceHandle === 'out' && targetHandle === 'df-in') return true;
  return false;
}

function withErrorBoundary(NodeComponent) {
  return function BoundedNode(props) {
    return <NodeErrorBoundary><NodeComponent {...props} /></NodeErrorBoundary>;
  };
}

const nodeTypes = {
  dataFrameNode: withErrorBoundary(DataFrameNode),
  mergeNode:     withErrorBoundary(MergeNode),
  functionNode:  withErrorBoundary(FunctionNode),
};

export default function App() {
  const reactFlowWrapper = useRef(null);
  const reactFlowInstance = useRef(null);

  const {
    nodes, edges, onNodesChange, onEdgesChange,
    nodesWithCallbacks, selectedDFs,
    onConnect, onKeyDown, undo, redo,
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

  const { menu, closeMenu, onPaneContextMenu, onNodeContextMenu } = useContextMenu(reactFlowWrapper);

  const addNodeAtMenu = useCallback(() => {
    if (!menu || !reactFlowInstance.current) return;
    const { x, y } = reactFlowInstance.current.screenToFlowPosition({ x: menu.flowX, y: menu.flowY });
    addNode(x, y);
    closeMenu();
  }, [menu, addNode, closeMenu]);

  const addFunctionAtMenu = useCallback(() => {
    if (!menu || !reactFlowInstance.current) return;
    const { x, y } = reactFlowInstance.current.screenToFlowPosition({ x: menu.flowX, y: menu.flowY });
    addFunctionNode(x, y);
    closeMenu();
  }, [menu, addFunctionNode, closeMenu]);

  const deleteNodeFromMenu = useCallback(() => {
    if (!menu) return;
    deleteNode(menu.nodeId);
    closeMenu();
  }, [menu, deleteNode, closeMenu]);

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

  const handleMergeSelected = useCallback(() => {
    createMerge(selectedDFs);
    closeMenu();
  }, [createMerge, selectedDFs, closeMenu]);

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
          onUndo={undo}
          onRedo={redo}
        />

        <ContextMenu
          menu={menu}
          onAddNode={addNodeAtMenu}
          onAddFunction={addFunctionAtMenu}
          onMerge={handleMergeSelected}
          onDelete={deleteNodeFromMenu}
          canMerge={selectedDFs.length === 2}
        />

        {toast && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-blue-700 text-white text-sm shadow-xl pointer-events-none">
            {toast}
          </div>
        )}
      </div>
    </DragProvider>
  );
}
