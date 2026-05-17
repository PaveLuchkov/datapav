import React from 'react';
import { flattenUpstream } from '../utils/nodeOutputAttrs';

const NODE_ICON = {
  dataFrameNode: { symbol: '▣', color: '#60a5fa' },
  functionNode:  { symbol: 'ƒ',  color: '#4ade80' },
  mergeNode:     { symbol: '⋈', color: '#c084fc' },
  filterNode:    { symbol: 'σ',  color: '#fb923c' },
  groupByNode:   { symbol: '⊞', color: '#38bdf8' },
  renameNode:    { symbol: '⟲', color: '#818cf8' },
  concatNode:    { symbol: '∪',  color: '#a3e635' },
  transformNode: { symbol: '⊕', color: '#f472b6' },
};

function NodeIcon({ type }) {
  const icon = NODE_ICON[type] || { symbol: '▣', color: '#60a5fa' };
  return (
    <span className="font-mono font-bold flex-shrink-0 select-none" style={{ color: icon.color, fontSize: 10, width: 12 }}>
      {icon.symbol}
    </span>
  );
}

// A single step in the trace path
function TraceStep({ step, isCurrent, onNavigate }) {
  const aggLabel = step.aggFunc ? ` (${step.aggFunc}${step.inputColName ? ` of ${step.inputColName}` : ''})` : '';
  const createdLabel = step.createdHere ? ' ← created here' : '';
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-0.5 cursor-pointer rounded transition-colors hover:bg-white/5"
      style={{
        borderLeft: isCurrent ? '2px solid #06b6d4' : '2px solid transparent',
        background: isCurrent ? 'rgba(6,182,212,0.08)' : 'transparent',
      }}
      onClick={() => onNavigate && onNavigate(step.nodeId)}
    >
      <NodeIcon type={step.nodeType} />
      <span className="text-xs flex-1 truncate" style={{ color: isCurrent ? '#67e8f9' : '#94a3b8' }}>
        {step.nodeLabel}
      </span>
      <span className="text-xs flex-shrink-0 font-mono" style={{ color: isCurrent ? '#22d3ee' : '#475569' }}>
        {step.colName}{aggLabel}{createdLabel}
      </span>
    </div>
  );
}

// Recursive downstream tree renderer
function DownstreamTree({ items, depth, onNavigate }) {
  if (!items?.length) return null;
  return (
    <div style={{ paddingLeft: depth * 10 }}>
      {items.map((item, i) => (
        <div key={`${item.nodeId}-${i}`}>
          <div className="flex items-center gap-1 px-2" style={{ color: '#334155', fontSize: 9, fontFamily: "'JetBrains Mono', monospace", height: 12 }}>
            {'└─'}
          </div>
          <TraceStep step={item} isCurrent={false} onNavigate={onNavigate} />
          {item.downstream?.length > 0 && (
            <DownstreamTree items={item.downstream} depth={depth + 1} onNavigate={onNavigate} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function TracePanel({ traceState, traceResult, onClose, onNavigate }) {
  if (!traceState || !traceResult) return null;

  // flattenUpstream returns [oldest … current], so the last element IS the current node.
  // We display everything before it as "origin" and show current separately as "here".
  const fullChain = flattenUpstream(traceResult.upstream);
  const upstreamChain = fullChain.slice(0, -1); // ancestors only, not the current node
  const hasUpstream = upstreamChain.length > 0;
  const hasDownstream = (traceResult.downstream || []).length > 0;

  const currentStep = fullChain.at(-1) || {
    nodeId: traceState.nodeId,
    colName: traceState.colName,
    nodeType: traceState.nodeType,
    nodeLabel: traceState.nodeLabel,
  };

  return (
    <div
      className="absolute z-40 rounded-xl shadow-2xl overflow-hidden"
      style={{
        top: 56, right: 16,
        width: 300,
        background: '#0c1929',
        border: '1px solid #164e63',
        pointerEvents: 'all',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{ background: '#0f2744', borderColor: '#1e3a5f' }}
      >
        <span style={{ color: '#06b6d4', fontSize: 13 }}>◎</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-slate-400 select-none">Tracing column</div>
          <div className="text-sm font-mono font-bold truncate" style={{ color: '#22d3ee' }}>
            {traceState.colName}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-600 hover:text-slate-400 text-sm select-none flex-shrink-0"
        >
          ×
        </button>
      </div>

      <div className="py-1 overflow-y-auto" style={{ maxHeight: 480 }}>
        {/* Upstream section */}
        {hasUpstream && (
          <>
            <div className="px-3 pt-2 pb-0.5 text-xs select-none uppercase tracking-wider" style={{ color: '#334155' }}>
              ↑ origin
            </div>
            {upstreamChain.map((step, i) => (
              <TraceStep key={`up-${step.nodeId}-${i}`} step={step} isCurrent={false} onNavigate={onNavigate} />
            ))}
            {/* Arrow */}
            <div className="px-3 py-0.5 text-xs select-none" style={{ color: '#1e3a5f', fontFamily: "'JetBrains Mono', monospace" }}>↓</div>
          </>
        )}

        {/* Current node */}
        <div className="px-3 pt-1 pb-0.5 text-xs select-none uppercase tracking-wider" style={{ color: '#164e63' }}>
          ◉ here
        </div>
        <TraceStep step={currentStep} isCurrent={true} onNavigate={onNavigate} />

        {/* Downstream section */}
        {hasDownstream && (
          <>
            <div className="px-3 pt-2 pb-0.5 text-xs select-none uppercase tracking-wider" style={{ color: '#334155' }}>
              ↓ flows to
            </div>
            <DownstreamTree items={traceResult.downstream} depth={0} onNavigate={onNavigate} />
          </>
        )}

        {!hasUpstream && !hasDownstream && (
          <div className="px-3 py-4 text-xs text-center" style={{ color: '#334155' }}>
            No connections found for <span className="font-mono" style={{ color: '#475569' }}>{traceState.colName}</span>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t text-xs text-slate-700" style={{ borderColor: '#0f2744' }}>
        Click a step to navigate · <kbd className="border border-slate-800 rounded px-1">Esc</kbd> to close
      </div>
    </div>
  );
}
