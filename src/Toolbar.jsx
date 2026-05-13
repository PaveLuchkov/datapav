import React from 'react';

export default function Toolbar({
  addableNodes, onAddNode,
  onSave, onLoad, onExportPng,
  selectedDFCount, onMergeSelected,
  onUndo, onRedo, onAutoLayout, onSearch,
}) {
  const canMerge = selectedDFCount === 2;

  return (
    <div
      className="absolute top-3 left-1/2 z-10 flex gap-2 px-4 py-2 rounded-xl border border-slate-700 shadow-xl items-center"
      style={{ transform: 'translateX(-50%)', background: '#1e293b' }}
    >
      {/* Add-node buttons — driven by registry */}
      {addableNodes.map((item) => (
        <button
          key={item.type}
          onClick={() => onAddNode(item.type)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${item.btnClass}`}
        >
          {item.icon} {item.label}
        </button>
      ))}

      <button
        onClick={canMerge ? onMergeSelected : undefined}
        title={canMerge ? 'Merge selected DataFrames' : 'Select exactly 2 DataFrames to merge'}
        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
          canMerge
            ? 'bg-violet-700 hover:bg-violet-600 text-white cursor-pointer'
            : 'bg-slate-800 text-slate-600 cursor-not-allowed'
        }`}
      >
        ⋈ Merge
      </button>

      <div className="w-px bg-slate-600 self-stretch" />

      <button onClick={onUndo} title="Undo (Ctrl+Z)" className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors">↩</button>
      <button onClick={onRedo} title="Redo (Ctrl+Y)" className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors">↪</button>

      <div className="w-px bg-slate-600 self-stretch" />

      <button onClick={onAutoLayout} title="Auto-arrange nodes" className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors">
        ⬦ Auto-arrange
      </button>

      <div className="w-px bg-slate-600 self-stretch" />

      <button onClick={onSave} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors">Save</button>
      <button onClick={onLoad} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors">Load</button>

      <div className="w-px bg-slate-600 self-stretch" />

      <button onClick={onExportPng} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors">Export PNG</button>

      <div className="w-px bg-slate-600 self-stretch" />

      <button
        onClick={onSearch}
        title="Search nodes and columns (Cmd+K)"
        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors flex items-center gap-1.5"
      >
        <span>⌕</span>
        <kbd className="text-slate-500 text-xs" style={{ fontSize: 9 }}>⌘K</kbd>
      </button>

      {selectedDFCount > 0 && (
        <span className="text-xs text-slate-400 ml-1">
          {selectedDFCount} selected{canMerge ? ' — ready to merge' : ''}
        </span>
      )}
    </div>
  );
}
