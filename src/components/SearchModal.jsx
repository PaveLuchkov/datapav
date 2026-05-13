import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ATTR_TYPE_META } from '../constants';

const NODE_ICON = {
  dataFrameNode: { symbol: '▣', color: '#60a5fa' },
  functionNode:  { symbol: 'ƒ', color: '#4ade80' },
  mergeNode:     { symbol: '⋈', color: '#c084fc' },
};

function buildResults(query, nodes) {
  const q = query.toLowerCase().trim();
  const results = [];

  for (const node of nodes) {
    const icon = NODE_ICON[node.type] || NODE_ICON.dataFrameNode;

    if (!q) {
      results.push({ key: `${node.id}-label`, nodeId: node.id, nodeLabel: node.data.label, nodeType: node.type, icon, matchKind: 'label' });
      continue;
    }

    if (node.data.label?.toLowerCase().includes(q)) {
      results.push({ key: `${node.id}-label`, nodeId: node.id, nodeLabel: node.data.label, nodeType: node.type, icon, matchKind: 'label' });
    }

    for (const attr of node.data.attributes || []) {
      if (attr.name.toLowerCase().includes(q)) {
        results.push({
          key: `${node.id}-attr-${attr.id}`,
          nodeId: node.id, nodeLabel: node.data.label, nodeType: node.type, icon,
          matchKind: 'column', matchText: attr.name, attrType: attr.type || 'string',
        });
      }
    }

    for (const out of node.data.outputs || []) {
      if (out.name.toLowerCase().includes(q)) {
        results.push({
          key: `${node.id}-out-${out.id}`,
          nodeId: node.id, nodeLabel: node.data.label, nodeType: node.type, icon,
          matchKind: 'column', matchText: out.name,
        });
      }
    }
  }

  return results.slice(0, 30);
}

function Highlight({ text, query }) {
  if (!query || !text) return <span>{text}</span>;
  const q = query.toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(96,165,250,0.25)', color: '#93c5fd', borderRadius: 2 }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </span>
  );
}

export default function SearchModal({ nodes, onNavigate, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const results = useMemo(() => buildResults(query, nodes), [query, nodes]);

  // Reset selection when results change
  useEffect(() => { setSelectedIndex(0); }, [results.length]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex];
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const commit = useCallback((result) => {
    if (!result) return;
    onNavigate(result.nodeId);
    onClose();
  }, [onNavigate, onClose]);

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commit(results[selectedIndex]);
    }
  }, [results, selectedIndex, commit, onClose]);

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ paddingTop: '12vh', background: 'rgba(2,6,23,0.7)', backdropFilter: 'blur(2px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-xl shadow-2xl overflow-hidden"
        style={{ background: '#0f172a', border: '1px solid #1e3a5f' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: '#1e3a5f' }}>
          <span className="text-slate-500 text-sm select-none">⌕</span>
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search nodes and columns…"
            className="flex-1 bg-transparent outline-none text-sm text-slate-100 placeholder-slate-600"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-slate-600 hover:text-slate-400 text-xs select-none"
            >
              ×
            </button>
          )}
          <kbd className="text-xs text-slate-600 border border-slate-700 rounded px-1 py-0.5 select-none">esc</kbd>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: 360 }}>
            {results.map((r, i) => (
              <ResultRow
                key={r.key}
                result={r}
                query={query}
                selected={i === selectedIndex}
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={() => commit(r)}
              />
            ))}
          </div>
        ) : (
          <div className="px-4 py-6 text-center text-sm text-slate-600">
            No matches for <span className="text-slate-400">"{query}"</span>
          </div>
        )}

        {/* Footer hint */}
        <div
          className="px-4 py-1.5 flex gap-4 text-xs text-slate-700 border-t"
          style={{ borderColor: '#1e293b' }}
        >
          <span><kbd className="border border-slate-700 rounded px-1 mr-1">↑↓</kbd>navigate</span>
          <span><kbd className="border border-slate-700 rounded px-1 mr-1">↩</kbd>jump to node</span>
        </div>
      </div>
    </div>
  );
}

function ResultRow({ result, query, selected, onMouseEnter, onClick }) {
  const typeMeta = result.attrType ? ATTR_TYPE_META[result.attrType] : null;

  return (
    <div
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className="flex items-center gap-3 px-4 cursor-pointer transition-colors"
      style={{
        minHeight: 40,
        background: selected ? 'rgba(30,58,95,0.6)' : 'transparent',
        borderLeft: selected ? '2px solid #3b82f6' : '2px solid transparent',
      }}
    >
      {/* Node type icon */}
      <span
        className="text-xs font-mono font-bold flex-shrink-0 w-4 text-center select-none"
        style={{ color: result.icon.color }}
      >
        {result.icon.symbol}
      </span>

      {/* Label + optional column */}
      <div className="flex-1 min-w-0 text-xs">
        {result.matchKind === 'label' ? (
          <span className="text-slate-200">
            <Highlight text={result.nodeLabel} query={query} />
          </span>
        ) : (
          <span className="text-slate-400">
            <span className="text-slate-500">{result.nodeLabel}</span>
            <span className="text-slate-600 mx-1">›</span>
            <span className="text-slate-200">
              <Highlight text={result.matchText} query={query} />
            </span>
          </span>
        )}
      </div>

      {/* Right-side badge */}
      {result.matchKind === 'column' && typeMeta && (
        <span
          className="text-xs flex-shrink-0 rounded px-1 select-none font-mono"
          style={{ fontSize: 9, color: typeMeta.color, background: typeMeta.bg }}
        >
          {typeMeta.abbr}
        </span>
      )}
      {result.matchKind === 'label' && (
        <span className="text-xs text-slate-700 flex-shrink-0 select-none">
          {result.nodeType === 'dataFrameNode' ? 'df'
            : result.nodeType === 'functionNode' ? 'fn'
            : 'merge'}
        </span>
      )}
    </div>
  );
}
