import React, { useEffect } from 'react';

const SECTIONS = [
  {
    title: 'Add nodes',
    rows: [
      { keys: ['D'], label: 'Add DataFrame' },
      { keys: ['F'], label: 'Add Filter' },
      { keys: ['E'], label: 'Add Function' },
      { keys: ['G'], label: 'Add Group By' },
      { keys: ['C'], label: 'Add Comment' },
    ],
  },
  {
    title: 'Canvas',
    rows: [
      { keys: ['L'],           label: 'Auto-arrange nodes' },
      { keys: ['M'],           label: 'Merge 2 selected DataFrames' },
      { keys: ['Del', 'Bksp'], label: 'Delete selected' },
    ],
  },
  {
    title: 'History',
    rows: [
      { keys: ['⌃', 'Z'],        label: 'Undo' },
      { keys: ['⌃', 'Y'],        label: 'Redo' },
    ],
  },
  {
    title: 'File',
    rows: [
      { keys: ['⌃', 'S'], label: 'Save canvas to file' },
      { keys: ['⌃', 'O'], label: 'Open canvas from file' },
    ],
  },
  {
    title: 'Tools',
    rows: [
      { keys: ['⌘', 'K'],        label: 'Search nodes & columns' },
      { keys: ['⌃', '⇧', 'F'],   label: 'Toggle attribute tracker' },
      { keys: ['?'],              label: 'Show this help' },
    ],
  },
];

function KbdGroup({ keys }) {
  return (
    <span className="flex items-center gap-0.5">
      {keys.map((k, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-gray-600 text-[10px] mx-0.5">+</span>}
          <kbd
            className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded text-[11px] font-mono font-medium text-gray-300"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 1px 0 rgba(0,0,0,0.4)' }}
          >
            {k}
          </kbd>
        </React.Fragment>
      ))}
    </span>
  );
}

export default function ShortcutsModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(2,6,23,0.75)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'rgba(12,12,22,0.98)', border: '1px solid rgba(255,255,255,0.08)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <span className="text-sm font-semibold text-gray-100">Keyboard shortcuts</span>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-md flex items-center justify-center text-gray-500 hover:text-gray-200 hover:bg-white/10 transition-all text-base leading-none"
          >
            ×
          </button>
        </div>

        {/* Sections */}
        <div className="px-5 py-4 flex flex-col gap-5 overflow-y-auto" style={{ maxHeight: '70vh' }}>
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-2">
                {section.title}
              </div>
              <div className="flex flex-col gap-1">
                {section.rows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                    <span className="text-[13px] text-gray-400">{row.label}</span>
                    <KbdGroup keys={row.keys} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 border-t flex items-center justify-end"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <span className="text-[11px] text-gray-700">
            Press <kbd className="font-mono text-gray-600">?</kbd> anytime to toggle
          </span>
        </div>
      </div>
    </div>
  );
}
