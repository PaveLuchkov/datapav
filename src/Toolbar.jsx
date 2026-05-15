import React from 'react';

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function Tip({ label, kbd, children }) {
  return (
    <span className="relative group">
      {children}
      <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <span
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] text-gray-100 font-medium whitespace-nowrap"
          style={{ background: 'rgba(8,8,18,0.97)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}
        >
          {label}
          {kbd && (
            <kbd
              className="text-[10px] text-gray-500 font-mono rounded"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '1px 4px' }}
            >
              {kbd}
            </kbd>
          )}
        </span>
      </span>
    </span>
  );
}

// ─── SVG icon base ────────────────────────────────────────────────────────────

function Ico({ children }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IcoTable = () => (
  <Ico>
    <rect x="1" y="1" width="13" height="13" rx="1.5" />
    <line x1="1" y1="5" x2="14" y2="5" />
    <line x1="5.5" y1="5" x2="5.5" y2="14" />
  </Ico>
);

const IcoFunnel = () => (
  <Ico>
    <path d="M1.5 2h12l-4.5 5.5v4l-3-1.5V7.5z" />
  </Ico>
);

const IcoBraces = () => (
  <Ico>
    <path d="M5.5 1.5c-1.5 0-2 .8-2 2v3c0 1-.5 1.5-1.5 2 1 .5 1.5 1 1.5 2v3c0 1.2.5 2 2 2" />
    <path d="M9.5 1.5c1.5 0 2 .8 2 2v3c0 1 .5 1.5 1.5 2-1 .5-1.5 1-1.5 2v3c0 1.2-.5 2-2 2" />
  </Ico>
);

const IcoGridFour = () => (
  <Ico>
    <rect x="1" y="1" width="5.5" height="5.5" rx="1" />
    <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" />
    <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" />
    <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" />
  </Ico>
);

const IcoNote = () => (
  <Ico>
    <path d="M2 2h11v9.5l-3.5 3.5H2V2z" />
    <path d="M9.5 11.5v3.5l3.5-3.5z" />
    <line x1="4.5" y1="6" x2="10.5" y2="6" />
    <line x1="4.5" y1="9" x2="8" y2="9" />
  </Ico>
);

const IcoMerge = () => (
  <Ico>
    <circle cx="5.5" cy="7.5" r="4" />
    <circle cx="9.5" cy="7.5" r="4" />
  </Ico>
);

const IcoUndo = () => (
  <Ico>
    <path d="M3 7.5A5 5 0 1 1 3.7 11" />
    <polyline points="1,5 3,7.5 5.5,6" />
  </Ico>
);

const IcoRedo = () => (
  <Ico>
    <path d="M12 7.5A5 5 0 1 0 11.3 11" />
    <polyline points="14,5 12,7.5 9.5,6" />
  </Ico>
);

const IcoSparkle = () => (
  <Ico>
    <path d="M7.5 1 L8.4 5.6 L13 7.5 L8.4 9.4 L7.5 14 L6.6 9.4 L2 7.5 L6.6 5.6 Z" />
  </Ico>
);

const IcoSave = () => (
  <Ico>
    <path d="M2 2h8.5l2.5 2.5v8.5H2V2z" />
    <rect x="4.5" y="2" width="4" height="3" rx="0.5" />
    <rect x="3" y="9" width="9" height="4" rx="0.5" />
  </Ico>
);

const IcoFolder = () => (
  <Ico>
    <path d="M1.5 5.5h12v7H1.5z" />
    <path d="M1.5 5.5V4a1 1 0 0 1 1-1h3.5l1.5 2.5" />
  </Ico>
);

const IcoImage = () => (
  <Ico>
    <rect x="1.5" y="3" width="12" height="9" rx="1.5" />
    <circle cx="5.5" cy="6.5" r="1.5" />
    <path d="M1.5 9.5 L4.5 7 L7 9.5 L9.5 7 L13.5 12" />
  </Ico>
);

const IcoSqlIn = () => (
  <Ico>
    <rect x="1.5" y="5" width="10" height="7" rx="1.5" />
    <line x1="1.5" y1="8" x2="11.5" y2="8" />
    <line x1="7.5" y1="2" x2="7.5" y2="5" />
    <polyline points="5.5,2 7.5,0.5 9.5,2" />
  </Ico>
);

const IcoSqlOut = () => (
  <Ico>
    <rect x="1.5" y="3" width="10" height="7" rx="1.5" />
    <line x1="1.5" y1="6" x2="11.5" y2="6" />
    <line x1="7.5" y1="10" x2="7.5" y2="13" />
    <polyline points="5.5,13 7.5,14.5 9.5,13" />
  </Ico>
);

const IcoSearch = () => (
  <Ico>
    <circle cx="6.5" cy="6.5" r="4.5" />
    <line x1="10" y1="10" x2="14" y2="14" />
  </Ico>
);

const IcoCrosshair = () => (
  <Ico>
    <circle cx="7.5" cy="7.5" r="5.5" />
    <circle cx="7.5" cy="7.5" r="2" />
    <line x1="7.5" y1="1" x2="7.5" y2="4" />
    <line x1="7.5" y1="11" x2="7.5" y2="14" />
    <line x1="1" y1="7.5" x2="4" y2="7.5" />
    <line x1="11" y1="7.5" x2="14" y2="7.5" />
  </Ico>
);

// ─── Button ───────────────────────────────────────────────────────────────────

function Btn({ onClick, active, disabled, color, children }) {
  const base = 'w-8 h-8 rounded-lg flex items-center justify-center select-none flex-shrink-0 transition-all duration-100';

  if (disabled) {
    return (
      <button className={`${base} cursor-not-allowed`} style={{ color: 'rgba(255,255,255,0.12)' }}>
        {children}
      </button>
    );
  }

  if (active) {
    return (
      <button
        onClick={onClick}
        className={`${base} cursor-pointer ${color || 'text-white'}`}
        style={{ background: 'rgba(255,255,255,0.1)' }}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`${base} cursor-pointer hover:bg-white/10 active:scale-[0.92] ${color || 'text-[#5e5e7a]'} hover:text-white`}
    >
      {children}
    </button>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────

const Sep = () => (
  <div className="w-px h-5 flex-shrink-0 mx-0.5" style={{ background: 'rgba(255,255,255,0.07)' }} />
);

// ─── Node type maps ───────────────────────────────────────────────────────────

const NODE_ICONS = {
  dataFrameNode: <IcoTable />,
  filterNode:    <IcoFunnel />,
  functionNode:  <IcoBraces />,
  groupByNode:   <IcoGridFour />,
  commentNode:   <IcoNote />,
};

const NODE_KEYS = {
  dataFrameNode: 'D',
  filterNode:    'F',
  functionNode:  'E',
  groupByNode:   'G',
  commentNode:   'C',
};

const NODE_COLORS = {
  dataFrameNode: 'text-blue-400',
  filterNode:    'text-orange-400',
  functionNode:  'text-emerald-400',
  groupByNode:   'text-sky-400',
  commentNode:   'text-yellow-400',
};

// ─── Toolbar ──────────────────────────────────────────────────────────────────

export default function Toolbar({
  addableNodes, onAddNode,
  onSave, onSaveToFile, onLoadFromFile, onExportPng,
  selectedDFCount, onMergeSelected,
  onUndo, onRedo, onAutoLayout, onSearch, onTrackAttr, trackerActive,
  onImportSql, onExportSql,
}) {
  const canMerge = selectedDFCount === 2;

  return (
    <div
      className="absolute top-3 left-1/2 z-10 flex items-center gap-0.5 px-1.5 py-1.5 rounded-xl"
      style={{
        transform: 'translateX(-50%)',
        background: 'rgba(12, 12, 20, 0.93)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {/* Add-node buttons */}
      {addableNodes.map((item) => (
        <Tip key={item.type} label={`Add ${item.label}`} kbd={NODE_KEYS[item.type]}>
          <Btn onClick={() => onAddNode(item.type)} color={NODE_COLORS[item.type]}>
            {NODE_ICONS[item.type] ?? <span className="text-xs">{item.icon}</span>}
          </Btn>
        </Tip>
      ))}

      <Sep />

      <Tip label={canMerge ? 'Merge DataFrames' : 'Select exactly 2 DataFrames'} kbd={canMerge ? 'M' : undefined}>
        <Btn onClick={canMerge ? onMergeSelected : undefined} disabled={!canMerge} color="text-violet-400">
          <IcoMerge />
        </Btn>
      </Tip>

      <Sep />

      <Tip label="Undo" kbd="⌃Z"><Btn onClick={onUndo}><IcoUndo /></Btn></Tip>
      <Tip label="Redo" kbd="⌃Y"><Btn onClick={onRedo}><IcoRedo /></Btn></Tip>

      <Sep />

      <Tip label="Auto-arrange" kbd="L">
        <Btn onClick={onAutoLayout}><IcoSparkle /></Btn>
      </Tip>

      <Sep />

      <Tip label="Save canvas" kbd="⌃S"><Btn onClick={onSaveToFile}><IcoSave /></Btn></Tip>
      <Tip label="Open canvas" kbd="⌃O"><Btn onClick={onLoadFromFile}><IcoFolder /></Btn></Tip>
      <Tip label="Export PNG"><Btn onClick={onExportPng}><IcoImage /></Btn></Tip>

      <Sep />

      <Tip label="Import SQL"><Btn onClick={onImportSql}><IcoSqlIn /></Btn></Tip>
      <Tip label="Export SQL"><Btn onClick={onExportSql}><IcoSqlOut /></Btn></Tip>

      <Sep />

      <Tip label="Search" kbd="⌘K"><Btn onClick={onSearch}><IcoSearch /></Btn></Tip>
      <Tip label="Track attribute" kbd="⌃⇧F">
        <Btn onClick={onTrackAttr} active={trackerActive} color="text-amber-400">
          <IcoCrosshair />
        </Btn>
      </Tip>

      {selectedDFCount > 0 && (
        <span
          className="ml-1 text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
          style={{
            background: 'rgba(255,255,255,0.06)',
            color: canMerge ? '#a78bfa' : 'rgba(255,255,255,0.35)',
          }}
        >
          {selectedDFCount}{canMerge ? ' → merge' : ' sel'}
        </span>
      )}
    </div>
  );
}
