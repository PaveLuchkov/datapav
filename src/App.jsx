import React, { useState, useCallback, useRef, useMemo } from 'react';
import { uid } from './utils/uid';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import ColumnEdge from './components/ColumnEdge';
import 'reactflow/dist/style.css';

import Toolbar from './Toolbar';
import { DragProvider } from './components/DragContext';
import ContextMenu from './components/ContextMenu';
import SearchModal from './components/SearchModal';
import AttributeTrackerPanel from './components/AttributeTrackerPanel';
import TabBar from './components/TabBar';
import SqlImportModal from './components/SqlImportModal';
import SqlExportModal from './components/SqlExportModal';
import ShortcutsModal from './components/ShortcutsModal';
import { generateSql } from './utils/exportSql';
import { useLineageState } from './hooks/useLineageState';
import { useLineagePersistence } from './hooks/useLineagePersistence';
import { useCanvasTabs } from './hooks/useCanvasTabs';
import { useContextMenu } from './hooks/useContextMenu';
import { useAutoLayout } from './hooks/useAutoLayout';
import { nodeTypes, isValidConnection, getMinimapColor, ADDABLE_NODES } from './nodes/registry';

const edgeTypes = { columnEdge: ColumnEdge };

function extractConditionRefs(data) {
  const exprs = [
    ...(data.conditions || []).map((c) => c.expr || ''),
    data.condition || '',
  ];
  return exprs.flatMap((expr) => (expr.match(/@(\w+)/g) || []).map((m) => m.slice(1)));
}

function extractAllAttrNames(data) {
  return [
    // dataframe
    ...(data.attributes   || []).map((a) => a.name),
    // function node inputs/outputs (use .name)
    ...(data.inputs       || []).map((i) => i.name || i.attrName),
    ...(data.outputs      || []).map((o) => o.name),
    // groupby aggregations
    ...(data.aggregations || []).map((a) => a.outputName),
    // rename: from + to fields
    ...(data.mappings     || []).flatMap((m) => [m.from, m.to]),
    // transform: column args
    ...(data.ops          || []).map((op) => op.args?.col),
    // merge join key pairs
    ...(data.keyPairs     || []).flatMap((p) => [p.left, p.right]),
    // merge output columns (injected from connected DFs into nodesWithCallbacks)
    ...(data.leftDF?.attributes  || []).map((a) => a.name),
    ...(data.rightDF?.attributes || []).map((a) => a.name),
    // filter condition @refs
    ...extractConditionRefs(data),
  ].filter(Boolean);
}

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
  const [trackerWholeWord, setTrackerWholeWord] = useState(false);

  const trackerMatchIds = useMemo(() => {
    const q = trackerQuery.trim().toLowerCase();
    if (!trackerOpen || !q) return null;
    const ids = new Set();
    for (const n of nodesWithCallbacks) {
      const names = extractAllAttrNames(n.data);
      const hit = trackerWholeWord
        ? names.some((name) => name.toLowerCase() === q)
        : names.some((name) => name.toLowerCase().includes(q));
      if (hit) ids.add(n.id);
    }
    return ids;
  }, [trackerOpen, trackerQuery, trackerWholeWord, nodesWithCallbacks]);

  const trackerSuggestions = useMemo(() => {
    const q = trackerQuery.trim().toLowerCase();
    if (!trackerOpen || !q) return [];
    const counts = new Map();
    for (const n of nodesWithCallbacks) {
      const names = new Set(extractAllAttrNames(n.data));
      for (const name of names) {
        const hit = trackerWholeWord
          ? name.toLowerCase() === q
          : name.toLowerCase().includes(q);
        if (hit) counts.set(name, (counts.get(name) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12)
      .map(([name, count]) => ({ name, count }));
  }, [trackerOpen, trackerQuery, trackerWholeWord, nodesWithCallbacks]);

  const trackedNodes = useMemo(() => {
    if (!trackerMatchIds) return nodesWithCallbacks;
    const highlight = { query: trackerQuery.trim().toLowerCase(), wholeWord: trackerWholeWord };
    return nodesWithCallbacks.map((n) => {
      const matched = trackerMatchIds.has(n.id);
      return {
        ...n,
        data: { ...n.data, trackerHighlight: matched ? highlight : null },
        style: matched
          ? { ...n.style, opacity: 1, boxShadow: '0 0 0 2px #f59e0b, 0 0 14px rgba(245,158,11,0.35)', borderRadius: 8, transition: 'all 0.2s ease' }
          : { ...n.style, opacity: 0.12, transition: 'all 0.2s ease' },
      };
    });
  }, [nodesWithCallbacks, trackerMatchIds, trackerQuery, trackerWholeWord]);

  const trackedEdges = useMemo(() => {
    if (!trackerMatchIds) return edges;
    return edges.map((e) => {
      const visible = trackerMatchIds.has(e.source) || trackerMatchIds.has(e.target);
      return visible
        ? { ...e, style: { ...e.style, opacity: 1, transition: 'opacity 0.2s ease' } }
        : { ...e, style: { ...e.style, opacity: 0.06, transition: 'opacity 0.2s ease' } };
    });
  }, [edges, trackerMatchIds]);

  const displayEdges = useMemo(() => {
    const base = trackerMatchIds ? trackedEdges : edges;
    return base.map((e) => {
      if (e.type !== 'columnEdge') return e;
      const attrId = e.sourceHandle?.slice(0, -7); // strip '-source'
      if (!attrId) return e;
      const src = nodes.find((n) => n.id === e.source);
      if (!src) return e;
      const name =
        (src.data.attributes || []).find((a) => a.id === attrId)?.name ||
        (src.data.outputs    || []).find((o) => o.id === attrId)?.name ||
        (src.data.mappings   || []).find((m) => m.id === attrId)?.to   ||
        (() => { const m = attrId.match(/^gbout-(.+)$/); return m ? (src.data.inputs||[]).find((i) => i.id === m[1])?.attrName : null; })() ||
        (() => { const m = attrId.match(/^mout-[LR]-(.+)$/); if (!m) return null; return [...(src.data.leftDF?.attributes||[]),...(src.data.rightDF?.attributes||[])].find((a) => a.id === m[1])?.name; })() ||
        null;
      return name ? { ...e, data: { ...e.data, label: name } } : e;
    });
  }, [trackedEdges, edges, trackerMatchIds, nodes]);

  // ── Search ─────────────────────────────────────────────────────────────

  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const navigateToNode = useCallback((nodeId) => {
    const target = nodes.find((n) => n.id === nodeId);
    if (!target || !reactFlowInstance.current) return;
    reactFlowInstance.current.fitView({ nodes: [target], duration: 600, maxZoom: 1.5, padding: 0.4 });
  }, [nodes]);

  const handleKeyDown = useCallback((e) => {
    const inInput = ['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable;

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
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveToFile();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
      e.preventDefault();
      loadFromFile();
      return;
    }

    if (!inInput && !e.ctrlKey && !e.metaKey && !e.altKey && e.key === '?') {
      e.preventDefault();
      setShortcutsOpen((v) => !v);
      return;
    }

    if (!inInput && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      const pos = reactFlowInstance.current
        ? reactFlowInstance.current.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
        : { x: 400, y: 300 };
      switch (e.key.toLowerCase()) {
        case 'd': e.preventDefault(); addNodeOfType('dataFrameNode', pos.x, pos.y); return;
        case 'f': e.preventDefault(); addNodeOfType('filterNode',    pos.x, pos.y); return;
        case 'e': e.preventDefault(); addNodeOfType('functionNode',  pos.x, pos.y); return;
        case 'g': e.preventDefault(); addNodeOfType('groupByNode',   pos.x, pos.y); return;
        case 'c': e.preventDefault(); addNodeOfType('commentNode',   pos.x, pos.y); return;
        case 'l': e.preventDefault(); handleAutoLayout(); return;
        case 'm': if (selectedDFs.length === 2) { e.preventDefault(); createMerge(selectedDFs); } return;
        default: break;
      }
    }

    onKeyDown(e);
  }, [onKeyDown, saveToFile, loadFromFile, addNodeOfType, handleAutoLayout, selectedDFs, createMerge]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <DragProvider>
      <div className="w-screen h-screen bg-slate-900 flex flex-col" onKeyDown={handleKeyDown} tabIndex={0}>
        <div ref={reactFlowWrapper} className="flex-1 min-h-0 relative">
          <ReactFlow
            nodes={trackedNodes}
            edges={displayEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
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
            wholeWord={trackerWholeWord}
            matchCount={trackerMatchIds ? trackerMatchIds.size : 0}
            suggestions={trackerSuggestions}
            onQueryChange={setTrackerQuery}
            onWholeWordChange={setTrackerWholeWord}
            onClose={() => { setTrackerOpen(false); setTrackerQuery(''); setTrackerWholeWord(false); }}
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

        {/* Help button */}
        <button
          onClick={() => setShortcutsOpen((v) => !v)}
          title="Keyboard shortcuts (?)"
          className="fixed top-3 right-3 z-20 w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-semibold transition-all duration-150 hover:scale-110"
          style={{
            background: shortcutsOpen ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: shortcutsOpen ? '#e2e8f0' : 'rgba(255,255,255,0.3)',
            boxShadow: shortcutsOpen ? '0 0 0 2px rgba(148,163,184,0.2)' : 'none',
          }}
        >
          ?
        </button>

        {shortcutsOpen && (
          <ShortcutsModal onClose={() => setShortcutsOpen(false)} />
        )}
      </div>
    </DragProvider>
  );
}
