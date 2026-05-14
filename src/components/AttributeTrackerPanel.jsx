import React, { useRef, useEffect, useState, useCallback } from 'react';

function Highlight({ text, query }) {
  if (!query || !text) return <span>{text}</span>;
  const q = query.toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(245,158,11,0.25)', color: '#fbbf24', borderRadius: 2 }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </span>
  );
}

export default function AttributeTrackerPanel({ query, matchCount, suggestions, onQueryChange, onClose }) {
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(-1);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Reset active index when suggestions change
  useEffect(() => { setActiveIdx(-1); }, [suggestions]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx >= 0) {
      listRef.current?.children[activeIdx]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIdx]);

  const commit = useCallback((name) => {
    onQueryChange(name);
    setActiveIdx(-1);
    inputRef.current?.focus();
  }, [onQueryChange]);

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }

    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, -1));
        return;
      }
      if (e.key === 'Enter' && activeIdx >= 0) {
        e.preventDefault();
        commit(suggestions[activeIdx].name);
        return;
      }
    }
  }, [suggestions, activeIdx, commit, onClose]);

  const showDropdown = query.trim() && suggestions.length > 0;

  return (
    <div
      className="absolute z-40"
      style={{ top: 56, left: '50%', transform: 'translateX(-50%)', minWidth: 340, pointerEvents: 'all' }}
    >
      {/* Input row */}
      <div
        className="flex items-center gap-2 px-3 py-2 shadow-2xl"
        style={{
          background: '#1c1917',
          border: '1px solid #a16207',
          borderRadius: showDropdown ? '12px 12px 0 0' : 12,
        }}
      >
        <span className="text-amber-500 select-none" style={{ fontSize: 14 }}>◎</span>

        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Отслеживать атрибут по имени…"
          className="flex-1 bg-transparent outline-none text-sm text-slate-100 placeholder-slate-600"
          style={{ minWidth: 200 }}
        />

        {query.trim() && (
          <span
            className="text-xs px-2 py-0.5 rounded-full select-none flex-shrink-0 font-mono"
            style={{
              background: matchCount > 0 ? 'rgba(161,98,7,0.35)' : 'rgba(71,85,105,0.4)',
              color: matchCount > 0 ? '#fbbf24' : '#64748b',
            }}
          >
            {matchCount} {matchCount === 1 ? 'нода' : matchCount >= 2 && matchCount <= 4 ? 'ноды' : 'нод'}
          </span>
        )}

        {query && (
          <button
            onClick={() => { onQueryChange(''); setActiveIdx(-1); }}
            className="text-slate-600 hover:text-slate-400 text-sm select-none"
            title="Очистить"
          >
            ×
          </button>
        )}

        <div className="w-px self-stretch" style={{ background: '#334155' }} />

        <button
          onClick={onClose}
          title="Выйти из режима отслеживания (Esc)"
          className="text-slate-600 hover:text-amber-400 text-xs select-none px-0.5 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Suggestions dropdown */}
      {showDropdown && (
        <div
          ref={listRef}
          className="overflow-y-auto"
          style={{
            background: '#1c1917',
            border: '1px solid #a16207',
            borderTop: '1px solid #44403c',
            borderRadius: '0 0 12px 12px',
            maxHeight: 220,
          }}
        >
          {suggestions.map((s, i) => (
            <div
              key={s.name}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseDown={(e) => { e.preventDefault(); commit(s.name); }}
              className="flex items-center justify-between px-4 cursor-pointer transition-colors"
              style={{
                minHeight: 34,
                background: i === activeIdx ? 'rgba(161,98,7,0.2)' : 'transparent',
                borderLeft: i === activeIdx ? '2px solid #f59e0b' : '2px solid transparent',
              }}
            >
              <span className="text-xs text-slate-200 font-mono">
                <Highlight text={s.name} query={query} />
              </span>
              <span
                className="text-xs ml-3 flex-shrink-0 select-none"
                style={{ color: '#64748b' }}
              >
                {s.count} {s.count === 1 ? 'нода' : s.count >= 2 && s.count <= 4 ? 'ноды' : 'нод'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
