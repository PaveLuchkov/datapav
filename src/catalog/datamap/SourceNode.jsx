import React from 'react';
import { Handle, Position } from 'reactflow';

const KIND_META = {
  database:        { icon: '🗄', label: 'database',      color: '#a78bfa', bg: '#2e1065', border: '#4c1d95' },
  'local-storage': { icon: '💾', label: 'local storage', color: '#34d399', bg: '#064e3b', border: '#065f46' },
  manual:          { icon: '✎', label: 'manual',         color: '#fbbf24', bg: '#451a03', border: '#92400e' },
};

// A datasource ("base") in the Data Map. Datasets connect to it via the
// belongs-to-source relationship.
export default function SourceNode({ id, data }) {
  const { name, kind = 'manual', dialect, count = 0, highlighted, onDelete } = data;
  const meta = KIND_META[kind] || KIND_META.manual;
  const stop = (e) => e.stopPropagation();

  return (
    <div
      className="rounded-lg shadow-xl px-3 py-2"
      style={{ background: meta.bg, border: `1px solid ${meta.border}`, minWidth: 150, opacity: highlighted === false ? 0.25 : 1, transition: 'all 0.15s ease' }}
      onContextMenu={stop}
    >
      <Handle type="source" position={Position.Right} id="src-out" style={{ background: meta.color, width: 8, height: 8, border: `2px solid ${meta.border}` }} />
      <div className="flex items-center gap-2">
        <span className="select-none" style={{ fontSize: 14 }}>{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: meta.color }}>{name}</div>
          <div className="text-[10px]" style={{ color: '#94a3b8' }}>{dialect || meta.label} · {count} table{count === 1 ? '' : 's'}</div>
        </div>
        <button onClick={(e) => { stop(e); onDelete?.(id); }} onMouseDown={stop} className="text-[11px] text-red-400 hover:text-red-300 transition-colors" title="Remove source">×</button>
      </div>
    </div>
  );
}
