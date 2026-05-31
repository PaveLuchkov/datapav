import React from 'react';
import { Handle, Position } from 'reactflow';
import { ATTR_TYPE_META } from '../../constants';

// A dataset/table in the Data Map. Square handles on both sides let you wire
// dataset↔dataset relationships ("connect the dots"); the left handle also
// receives the belongs-to-source edge.
export default function DatasetNode({ id, data }) {
  const { name, columns = [], aliases = [], finalized, sourceName, highlighted, onAddToPipeline, onEdit, onDelete } = data;
  const stop = (e) => e.stopPropagation();

  return (
    <div
      className="rounded-lg overflow-hidden shadow-xl"
      style={{
        background: '#0f2744',
        border: `1px solid ${highlighted ? '#38bdf8' : finalized ? '#15803d' : '#1e4d8c'}`,
        minWidth: 190,
        opacity: highlighted === false ? 0.25 : 1,
        transition: 'all 0.15s ease',
      }}
      onContextMenu={stop}
    >
      <Handle type="target" position={Position.Left} id="rel-in" style={{ background: '#0d9488', width: 8, height: 8, borderRadius: 2, border: '2px solid #042f2e' }} />
      <Handle type="source" position={Position.Right} id="rel-out" style={{ background: '#0d9488', width: 8, height: 8, borderRadius: 2, border: '2px solid #042f2e' }} />

      <div className="px-3 py-1.5 flex items-center gap-2 border-b" style={{ background: '#1a3a5c', borderColor: '#1e4d8c' }}>
        <span className="font-bold select-none" style={{ color: '#60a5fa', fontSize: 12 }}>▣</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{name}</div>
          {(sourceName || aliases.length > 0) && (
            <div className="text-[10px] truncate" style={{ color: '#64748b' }}>
              {sourceName}{sourceName && aliases.length ? ' · ' : ''}{aliases.length ? `aka ${aliases.join(', ')}` : ''}
            </div>
          )}
        </div>
        {finalized && <span className="text-[9px] px-1 rounded select-none" style={{ background: 'rgba(21,128,61,0.5)', color: '#bbf7d0' }}>final</span>}
      </div>

      <div className="py-1 max-h-44 overflow-y-auto">
        {columns.length === 0 && <div className="px-3 py-1 text-xs italic" style={{ color: '#334155' }}>no columns</div>}
        {columns.map((c, i) => {
          const meta = ATTR_TYPE_META[c.type] || ATTR_TYPE_META.string;
          return (
            <div key={i} className="px-3 py-0.5 flex items-center gap-1.5">
              <span className="rounded select-none flex-shrink-0" style={{ fontSize: 9, lineHeight: '14px', padding: '0 4px', color: meta.color, background: meta.bg, fontFamily: "'JetBrains Mono', monospace" }}>{meta.abbr}</span>
              <span className="text-xs truncate" style={{ color: c.isKey ? '#fcd34d' : '#cbd5e1' }}>{c.isKey ? '🔑 ' : ''}{c.name}</span>
            </div>
          );
        })}
      </div>

      <div className="flex border-t" style={{ borderColor: '#1e3a5f' }}>
        <button onClick={(e) => { stop(e); onAddToPipeline?.(id); }} onMouseDown={stop} className="flex-1 py-1 text-[11px] text-blue-300 hover:bg-blue-900/40 transition-colors" title="Add to pipeline canvas">＋ pipeline</button>
        <button onClick={(e) => { stop(e); onEdit?.(id); }} onMouseDown={stop} className="px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-700/40 transition-colors" title="Edit">✎</button>
        <button onClick={(e) => { stop(e); onDelete?.(id); }} onMouseDown={stop} className="px-2 py-1 text-[11px] text-red-400 hover:bg-red-900/30 transition-colors" title="Remove from catalog">×</button>
      </div>
    </div>
  );
}
