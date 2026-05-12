import React from 'react';

export default function Toolbar({ onAddNode, onSave, onLoad, onExportPng, selectedDFCount, onMergeSelected }) {
  const canMerge = selectedDFCount === 2;

  return (
    <div
      className="absolute top-3 left-1/2 z-10 flex gap-2 px-4 py-2 rounded-xl border border-slate-700 shadow-xl items-center"
      style={{ transform: 'translateX(-50%)', background: '#1e293b' }}
    >
      <button
        onClick={onAddNode}
        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-700 hover:bg-blue-600 text-white transition-colors"
      >
        + DataFrame
      </button>

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

      <button onClick={onSave} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors">
        Save
      </button>
      <button onClick={onLoad} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors">
        Load
      </button>

      <div className="w-px bg-slate-600 self-stretch" />

      <button onClick={onExportPng} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors">
        Export PNG
      </button>

      {selectedDFCount > 0 && (
        <span className="text-xs text-slate-400 ml-1">
          {selectedDFCount} selected{canMerge ? ' — ready to merge' : ''}
        </span>
      )}
    </div>
  );
}
