import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, { Background, Controls, useNodesState, useEdgesState, addEdge } from 'reactflow';
import DatasetNode from './datamap/DatasetNode';
import SourceNode from './datamap/SourceNode';
import CatalogEntryModal from './CatalogEntryModal';
import CatalogImportModal from './CatalogImportModal';
import { searchEntries, SOURCE_KINDS } from './catalogStore';

const nodeTypes = { datasetNode: DatasetNode, sourceNode: SourceNode };

const KIND_LABEL = { database: 'database', 'local-storage': 'local', manual: 'manual' };

// The Data Map: a graph of datasets + sources with relationships, searchable and
// filterable by source. See docs/data-catalog.md.
export default function DataMapView({ catalog, api, onAddEntryToPipeline }) {
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);
  const [query, setQuery] = useState('');
  const [sourceKind, setSourceKind] = useState(null);
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, entry = edit
  const [importing, setImporting] = useState(false);

  const matchIds = useMemo(() => {
    if (!query.trim() && !sourceKind) return null;
    return new Set(searchEntries(catalog, { query, sourceKind }).map((e) => e.id));
  }, [catalog, query, sourceKind]);

  // Derive RF nodes/edges from the catalog (+ search highlight). Re-runs whenever
  // the catalog or the filter changes (including after a drag persists position).
  useEffect(() => {
    const countBySource = {};
    for (const e of catalog.entries) if (e.sourceId) countBySource[e.sourceId] = (countBySource[e.sourceId] || 0) + 1;

    const sourceNodes = catalog.sources.map((s, i) => ({
      id: s.id,
      type: 'sourceNode',
      position: s.position || { x: 0, y: i * 150 },
      data: { name: s.name, kind: s.kind, dialect: s.dialect, count: countBySource[s.id] || 0, onDelete: api.removeSource },
    }));

    const sourceName = new Map(catalog.sources.map((s) => [s.id, s.name]));
    const datasetNodes = catalog.entries.map((e, i) => ({
      id: e.id,
      type: 'datasetNode',
      position: e.position || { x: 280 + (i % 3) * 240, y: Math.floor(i / 3) * 260 },
      data: {
        name: e.name, columns: e.columns, aliases: e.aliases || [], finalized: e.finalized,
        sourceName: sourceName.get(e.sourceId),
        highlighted: matchIds ? matchIds.has(e.id) : undefined,
        onAddToPipeline: (id) => onAddEntryToPipeline(catalog.entries.find((x) => x.id === id)),
        onEdit: (id) => setEditing(catalog.entries.find((x) => x.id === id)),
        onDelete: api.removeEntry,
      },
    }));

    const belongsEdges = catalog.entries.filter((e) => e.sourceId).map((e) => ({
      id: `belongs-${e.sourceId}-${e.id}`, source: e.sourceId, target: e.id,
      sourceHandle: 'src-out', targetHandle: 'rel-in', style: { stroke: '#475569', strokeDasharray: '4 4' },
    }));
    const relEdges = catalog.relationships.map((r) => ({
      id: r.id, source: r.fromId, target: r.toId, sourceHandle: 'rel-out', targetHandle: 'rel-in',
      label: r.kind === 'join' ? 'join' : r.label, type: 'smoothstep',
      style: { stroke: '#0ea5e9', strokeWidth: 1.5 },
    }));

    setRfNodes([...sourceNodes, ...datasetNodes]);
    setRfEdges([...belongsEdges, ...relEdges]);
  }, [catalog, matchIds, api, onAddEntryToPipeline, setRfNodes, setRfEdges]);

  const onNodeDragStop = useCallback((_e, node) => {
    if (node.type === 'sourceNode') api.setSourcePosition(node.id, node.position);
    else api.setEntryPosition(node.id, node.position);
  }, [api]);

  const onConnect = useCallback((params) => {
    // Only dataset↔dataset wires become relationships (source links are derived).
    const isDataset = (id) => catalog.entries.some((e) => e.id === id);
    if (isDataset(params.source) && isDataset(params.target)) {
      api.addRelationship({ fromId: params.source, toId: params.target, kind: 'related' });
    } else {
      setRfEdges((eds) => addEdge(params, eds));
    }
  }, [catalog.entries, api, setRfEdges]);

  return (
    <div className="w-full h-full relative">
      {/* Header: search + source filter + create/import */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-2 py-1.5 rounded-xl"
        style={{ background: 'rgba(12,12,20,0.93)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 8px 32px rgba(0,0,0,0.55)' }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search datasets, columns, aliases…"
          className="text-xs outline-none" style={{ background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 6, padding: '4px 8px', width: 220 }} />
        <div className="flex gap-0.5">
          <FilterChip label="all" active={!sourceKind} onClick={() => setSourceKind(null)} />
          {SOURCE_KINDS.map((k) => <FilterChip key={k} label={KIND_LABEL[k]} active={sourceKind === k} onClick={() => setSourceKind(sourceKind === k ? null : k)} />)}
        </div>
        <div className="w-px h-5" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <button onClick={() => setEditing(null)} className="text-xs px-2 py-1 rounded-lg text-blue-300 hover:bg-white/10 transition-colors">＋ dataset</button>
        <button onClick={() => setImporting(true)} className="text-xs px-2 py-1 rounded-lg text-slate-300 hover:bg-white/10 transition-colors">⎘ import SQL</button>
      </div>

      {catalog.entries.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center" style={{ color: '#475569' }}>
            <div className="text-sm">Your data map is empty.</div>
            <div className="text-xs mt-1">Add a dataset, import SQL, or publish a DataFrame from a pipeline.</div>
          </div>
        </div>
      )}

      <ReactFlow
        nodes={rfNodes} edges={rfEdges} nodeTypes={nodeTypes}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop} onConnect={onConnect}
        fitView minZoom={0.1} maxZoom={2} proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e3a5f" gap={20} size={1} />
        <Controls position="bottom-right" />
      </ReactFlow>

      {editing !== undefined && (
        <CatalogEntryModal entry={editing} sources={catalog.sources}
          onSave={(draft) => api.upsertEntry(draft)}
          onClose={() => setEditing(undefined)} />
      )}
      {importing && (
        <CatalogImportModal sources={catalog.sources}
          onImport={(draft) => api.upsertEntry(draft)}
          onClose={() => setImporting(false)} />
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button onClick={onClick} className="text-[11px] px-2 py-0.5 rounded-full transition-colors select-none"
      style={{ background: active ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.05)', color: active ? '#7dd3fc' : '#94a3b8' }}>
      {label}
    </button>
  );
}
