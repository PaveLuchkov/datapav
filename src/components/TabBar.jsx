import React, { useState, useRef, useEffect } from 'react';

export default function TabBar({ tabs, activeTabId, onSwitch, onAdd, onClose, onRename }) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editingId && inputRef.current) inputRef.current.focus();
  }, [editingId]);

  const startEdit = (e, tab) => {
    e.stopPropagation();
    setEditingId(tab.id);
    setEditValue(tab.name);
  };

  const commitEdit = () => {
    if (editingId && editValue.trim()) onRename(editingId, editValue.trim());
    setEditingId(null);
  };

  const onEditKeyDown = (e) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditingId(null);
    e.stopPropagation();
  };

  return (
    <div
      className="flex items-stretch border-t border-slate-700 flex-shrink-0 overflow-x-auto"
      style={{ background: '#0f172a', height: 34 }}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => onSwitch(tab.id)}
            className="relative flex items-center gap-1.5 px-3 flex-shrink-0 cursor-pointer select-none group transition-colors"
            style={{
              borderRight: '1px solid #1e293b',
              borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
              background: active ? '#1e293b' : 'transparent',
              color: active ? '#f1f5f9' : '#64748b',
              fontSize: 12,
              maxWidth: 180,
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = '#94a3b8'; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = '#64748b'; }}
          >
            {editingId === tab.id ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={onEditKeyDown}
                onClick={(e) => e.stopPropagation()}
                className="bg-transparent outline-none border-b border-blue-400 text-slate-200 min-w-0 w-24"
                style={{ fontSize: 12 }}
              />
            ) : (
              <span
                className="truncate"
                onDoubleClick={(e) => startEdit(e, tab)}
                title={tab.name}
              >
                {tab.name}
              </span>
            )}

            {tabs.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
                className="opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity hover:text-red-400"
                style={{ fontSize: 13, lineHeight: 1, marginLeft: 2 }}
              >
                ×
              </button>
            )}
          </div>
        );
      })}

      <button
        onClick={onAdd}
        className="px-3 flex-shrink-0 transition-colors"
        style={{ color: '#475569', fontSize: 16, lineHeight: 1 }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#475569'; }}
        title="New canvas"
      >
        +
      </button>
    </div>
  );
}
