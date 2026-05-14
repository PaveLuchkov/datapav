import React, { useState, useCallback, useRef, useMemo } from 'react';
import { uid } from './utils/uid';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';

import Toolbar from './Toolbar';
import { DragProvider } from './components/DragContext';
import ContextMenu from './components/ContextMenu';
import SearchModal from './components/SearchModal';
import AttributeTrackerPanel from './components/AttributeTrackerPanel';
import TabBar from './components/TabBar';
import SqlImportModal from './components/SqlImportModal';
import SqlExportModal from './components/SqlExportModal';
import { generateSql } from './utils/exportSql';
import { useLineageState } from './hooks/useLineageState';
import { useLineagePersistence } from './hooks/useLineagePersistence';
import { useCanvasTabs } from './hooks/useCanvasTabs';
import { useContextMenu } from './hooks/useContextMenu';
import { useAutoLayout } from './hooks/useAutoLayout';
import { nodeTypes, isValidConnection, getMinimapColor, ADDABLE_NODES } from './nodes/registry';

export default function App() {
  const reactFlowWrapper = useRef(null);
  const reactFlowInstance = useRef(null);

  const {
    nodes, edges, onNodesChange, onEdgesChange,
    nodesWithCallbacks, selectedDFs,
    onConnect, onKeyDown, undo, redo,
    addNodeOfType, deleteNode, createMerge, restoreState,
  } = useLineageState();

  const { applyLayout } = useAutoLayout();

  // ── Toast ──────────────────────────────────────────────────────────────

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  const { saveState, loadState, exportPng, saveToFile, loadFromFile } = useLineagePersistence({
    nodes, edges, restoreState, showToast,
  });

  const { tabs, activeTabId, switchTab, addTab, closeTab, renameTab } = useCanvasTabs({
    nodes, edges, restoreState,
  });

  // ── Context menu ───────────────────────────────────────────────────────

  const { menu, closeMenu, onPaneContextMenu, onNodeContextMenu } = useContextMenu(reactFlowWrapper);

  const addNodeOfTypeAtMenu = useCallback((type) => {
    if (!menu || !reactFlowInstance.current) return;
    const { x, y } = reactFlowInstance.current.screenToFlowPosition({ x: menu.flowX, y: menu.flowY });
    addNodeOfType(type, x, y);
    closeMenu();
  }, [menu, addNodeOfType, closeMenu]);

  const deleteNodeFromMenu = useCallback(() => {
    if (!menu) return;
    deleteNode(menu.nodeId);
    closeMenu();
  }, [menu, deleteNode, closeMenu]);

  // ── Toolbar actions ────────────────────────────────────────────────────

  const addNodeCenter = useCallback((type) => {
    const pos = reactFlowInstance.current
      ? reactFlowInstance.current.screenToFlowPosition({ x: 200, y: 200 })
      : { x: 200, y: 200 };
    addNodeOfType(type, pos.x, pos.y);
  }, [addNodeOfType]);

  const handleMergeSelected = useCallback(() => {
    createMerge(selectedDFs);
    closeMenu();
  }, [createMerge, selectedDFs, closeMenu]);

  const handleAutoLayout = useCallback(() => {
    const laid = applyLayout(nodes, edges);
    restoreState(laid, edges);
    setTimeout(() => reactFlowInstance.current?.fitView({ padding: 0.12 }), 50);
  }, [nodes, edges, applyLayout, restoreState]);

  // ── SQL export ────────────────────────────────────────────────────────

  const [sqlExportOpen, setSqlExportOpen] = useState(false);
  const [exportedSql, setExportedSql] = useState('');

  const handleExportSql = useCallback(() => {
    setExportedSql(generateSql(nodes, edges));
    setSqlExportOpen(true);
  }, [nodes, edges]);

  // ── SQL import ────────────────────────────────────────────────────────

  const [sqlImportOpen, setSqlImportOpen] = useState(false);

  const handleSqlImport = useCallback(({ columns, tableName }) => {
    const pos = reactFlowInstance.current
      ? reactFlowInstance.current.screenToFlowPosition({ x: 300, y: 200 })
      : { x: 300, y: 200 };
    addNodeOfType('dataFrameNode', pos.x, pos.y, {
      label: tableName || 'query_result',
      attributes: columns.map((name) => ({ id: uid(), name, type: 'string' })),
    });
  }, [addNodeOfType]);

  // ── Attribute Tracker ──────────────────────────────────────────────────

  const [trackerOpen, setTrackerOpen] = useState(false);
  const [trackerQuery, setTrackerQuery] = useState('');

  const trackerMatchIds = useMemo(() => {
    const q = trackerQuery.trim().toLowerCase();
    if (!trackerOpen || !q) return null;
    const ids = new Set();
    for (const n of nodes) {
      const names = [
        ...(n.data.attributes   || []).map((a) => a.name),
        ...(n.data.inputs       || []).map((i) => i.name),
        ...(n.data.outputs      || []).map((o) => o.name),
        ...(n.data.aggregations || []).map((a) => a.outputName),
      ].filter(Boolean);
      if (names.some((name) => name.toLowerCase().includes(q))) ids.add(n.id);
    }
    return ids;
  }, [trackerOpen, trackerQuery, nodes]);

  const trackerSuggestions = useMemo(() => {
    const q = trackerQuery.trim().toLowerCase();
    if (!trackerOpen || !q) return [];
    const counts = new Map();
    for (const n of nodes) {
      const names = new Set([
        ...(n.data.attributes   || []).map((a) => a.name),
        ...(n.data.inputs       || []).map((i) => i.name),
        ...(n.data.outputs      || []).map((o) => o.name),
        ...(n.data.aggregations || []).map((a) => a.outputName),
      ].filter(Boolean));
      for (const name of names) {
        if (name.toLowerCase().includes(q)) {
          counts.set(name, (counts.get(name) || 0) + 1);
        }
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12)
      .map(([name, count]) => ({ name, count }));
  }, [trackerOpen, trackerQuery, nodes]);

  const trackedNodes = useMemo(() => {
    if (!trackerMatchIds) return nodesWithCallbacks;
    return nodesWithCallbacks.map((n) => {
      const matched = trackerMatchIds.has(n.id);
      return {
        ...n,
        style: matched
          ? { ...n.style, opacity: 1, boxShadow: '0 0 0 2px #f59e0b, 0 0 14px rgba(245,158,11,0.35)', borderRadius: 8, transition: 'all 0.2s ease' }
          : { ...n.style, opacity: 0.12, transition: 'all 0.2s ease' },
      };
    });
  }, [nodesWithCallbacks, trackerMatchIds]);

  const trackedEdges = useMemo(() => {
    if (!trackerMatchIds) return edges;
    return edges.map((e) => {
      const visible = trackerMatchIds.has(e.source) || trackerMatchIds.has(e.target);
      return visible
        ? { ...e, style: { ...e.style, opacity: 1, transition: 'opacity 0.2s ease' } }
        : { ...e, style: { ...e.style, opacity: 0.06, transition: 'opacity 0.2s ease' } };
    });
  }, [edges, trackerMatchIds]);

  // ── Search ─────────────────────────────────────────────────────────────

  const [searchOpen, setSearchOpen] = useState(false);

  const navigateToNode = useCallback((nodeId) => {
    const target = nodes.find((n) => n.id === nodeId);
    if (!target || !reactFlowInstance.current) return;
    reactFlowInstance.current.fitView({ nodes: [target], duration: 600, maxZoom: 1.5, padding: 0.4 });
  }, [nodes]);

  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setSearchOpen(true);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      setTrackerOpen((v) => { if (v) setTrackerQuery(''); return !v; });
      return;
    }
    onKeyDown(e);
  }, [onKeyDown]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <DragProvider>
      <div className="w-screen h-screen bg-slate-900 flex flex-col" onKeyDown={handleKeyDown} tabIndex={0}>
        <div ref={reactFlowWrapper} className="flex-1 min-h-0 relative">
          <ReactFlow
            nodes={trackedNodes}
            edges={trackedEdges}
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
            minZoom={0.05}
            maxZoom={2}
            deleteKeyCode={null}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#1e3a5f" gap={20} size={1} />
            <Controls position="bottom-right" />
            <MiniMap
              nodeColor={getMinimapColor}
              maskColor="rgba(15,23,42,0.7)"
              position="bottom-left"
            />
          </ReactFlow>
        </div>

        <Toolbar
          addableNodes={ADDABLE_NODES}
          onAddNode={addNodeCenter}
          onSave={saveState}
          onLoad={loadState}
          onSaveToFile={saveToFile}
          onLoadFromFile={loadFromFile}
          onExportPng={exportPng}
          selectedDFCount={selectedDFs.length}
          onMergeSelected={handleMergeSelected}
          onUndo={undo}
          onRedo={redo}
          onAutoLayout={handleAutoLayout}
          onSearch={() => setSearchOpen(true)}
          onTrackAttr={() => { setTrackerOpen((v) => { if (v) setTrackerQuery(''); return !v; }); }}
          trackerActive={trackerOpen}
          onImportSql={() => setSqlImportOpen(true)}
          onExportSql={handleExportSql}
        />

        {trackerOpen && (
          <AttributeTrackerPanel
            query={trackerQuery}
            matchCount={trackerMatchIds ? trackerMatchIds.size : 0}
            suggestions={trackerSuggestions}
            onQueryChange={setTrackerQuery}
            onClose={() => { setTrackerOpen(false); setTrackerQuery(''); }}
          />
        )}

        <ContextMenu
          menu={menu}
          addableNodes={ADDABLE_NODES}
          onAddNode={addNodeOfTypeAtMenu}
          onMerge={handleMergeSelected}
          onDelete={deleteNodeFromMenu}
          canMerge={selectedDFs.length === 2}
        />

        {toast && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-blue-700 text-white text-sm shadow-xl pointer-events-none">
            {toast}
          </div>
        )}

        {searchOpen && (
          <SearchModal
            nodes={nodes}
            onNavigate={navigateToNode}
            onClose={() => setSearchOpen(false)}
          />
        )}

        {sqlImportOpen && (
          <SqlImportModal
            onClose={() => setSqlImportOpen(false)}
            onImport={handleSqlImport}
          />
        )}

        {sqlExportOpen && (
          <SqlExportModal
            sql={exportedSql}
            onClose={() => setSqlExportOpen(false)}
          />
        )}

        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSwitch={switchTab}
          onAdd={addTab}
          onClose={closeTab}
          onRename={renameTab}
        />
      </div>
    </DragProvider>
  );
}
