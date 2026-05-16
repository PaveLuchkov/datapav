import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import StageBadge from '../../components/StageBadge';
import NodeCodeBlock from '../../components/NodeCodeBlock';
import { JOIN_TYPES, JOIN_ACTIVE_STYLES } from '../../constants';
import config from './config';

const { colors } = config;

export default function MergeNode({ id, data }) {
  const {
    joinType, keyPairs, leftDF, rightDF, companionId,
    onJoinTypeChange, onAddKey, onRemoveKey, onUpdateKey,
    onCodeChange, onStageChange, onCreateCompanion,
    trackerHighlight, code, stage,
  } = data;

  const isTrackedAttr = (name) => {
    if (!trackerHighlight?.query) return false;
    const t = (name || '').toLowerCase();
    return trackerHighlight.wholeWord ? t === trackerHighlight.query : t.includes(trackerHighlight.query);
  };

  const [codeOpen, setCodeOpen] = useState(false);
  const stop = (e) => e.stopPropagation();

  const safeKeyPairs = keyPairs || [];
  const leftCols  = leftDF?.attributes  || [];
  const rightCols = rightDF?.attributes || [];

  return (
    <div
      className="rounded-lg overflow-visible shadow-2xl"
      style={{ background: colors.bg, border: `1px solid ${colors.border}`, minWidth: 300 }}
      onContextMenu={stop}
    >
      <Handle
        type="target" id="left-in" position={Position.Left}
        style={{ top: '30%', background: colors.handleLeft, border: `2px solid ${colors.handleBorder}`, width: 10, height: 10 }}
      />
      <Handle
        type="target" id="right-in" position={Position.Left}
        style={{ top: '70%', background: colors.handleRight, border: `2px solid ${colors.handleBorder}`, width: 10, height: 10 }}
      />
      <Handle
        type="source" id="df-out" position={Position.Right}
        style={{ top: 14, background: colors.handleLeft, border: `2px solid ${colors.handleBorder}`, width: 8, height: 8, borderRadius: 2 }}
      />

      {/* Header */}
      <div
        className="px-3 py-2 border-b border-purple-900 flex items-center gap-2 cursor-grab active:cursor-grabbing"
        style={{ background: colors.header }}
      >
        <span className="text-purple-200 font-bold text-sm tracking-widest select-none">⋈ MERGE</span>
        <StageBadge nodeId={id} stage={stage} onStageChange={onStageChange} />
        <button
          onClick={(e) => { stop(e); setCodeOpen((v) => !v); }}
          onMouseDown={stop}
          title="Toggle code snippet"
          className="flex-shrink-0 select-none transition-opacity hover:opacity-100 font-mono"
          style={{ fontSize: 10, color: '#a78bfa', opacity: codeOpen ? 1 : 0.4 }}
        >
          {codeOpen ? '[/]' : '</>'}
        </button>
        {/* Companion button */}
        <button
          onClick={(e) => { stop(e); if (!companionId) onCreateCompanion(id); }}
          onMouseDown={stop}
          title={companionId ? 'Output companion exists' : 'Create output DataFrame'}
          className="flex-shrink-0 select-none text-xs font-mono transition-colors ml-auto"
          style={{ color: companionId ? '#a78bfa' : '#4c1d95' }}
        >
          {companionId ? '→●' : '→○'}
        </button>
        {/* Join type buttons */}
        <div className="flex gap-0.5">
          {JOIN_TYPES.map((jt) => {
            const active = joinType === jt;
            return (
              <button
                key={jt}
                onClick={(e) => { stop(e); onJoinTypeChange(id, jt); }}
                onMouseDown={stop}
                className="px-1.5 py-0.5 text-xs rounded font-medium transition-colors"
                style={active ? JOIN_ACTIVE_STYLES[jt] : { color: '#a78bfa' }}
              >
                {jt}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body: source labels + join key config */}
      <div className="px-3 py-2" style={{ minHeight: 72 }}>
        {/* Source labels */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-xs font-bold select-none flex-shrink-0" style={{ color: '#7c3aed' }}>L</span>
            <span className="text-xs truncate" style={{ color: leftDF ? '#c4b5fd' : '#4c1d95' }}>
              {leftDF ? leftDF.label : <em>not connected</em>}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-xs font-bold select-none flex-shrink-0" style={{ color: '#9333ea' }}>R</span>
            <span className="text-xs truncate" style={{ color: rightDF ? '#d8b4fe' : '#4c1d95' }}>
              {rightDF ? rightDF.label : <em>not connected</em>}
            </span>
          </div>
        </div>

        {/* Join keys */}
        <div className="text-xs font-semibold uppercase tracking-wider mb-1.5 select-none" style={{ color: '#6d28d9' }}>
          Join keys
        </div>
        {safeKeyPairs.length === 0 && (
          <div className="text-xs italic mb-1" style={{ color: '#4c1d95' }}>No keys — cross join</div>
        )}
        {safeKeyPairs.map((pair, i) => {
          const trackedPair = isTrackedAttr(pair.left) || isTrackedAttr(pair.right);
          return (
            <div key={i} className="flex items-center gap-1 mb-1.5"
              style={trackedPair ? { background: 'rgba(245,158,11,0.08)', borderRadius: 4 } : undefined}
            >
              <select
                value={pair.left}
                onChange={(e) => { stop(e); onUpdateKey(id, i, 'left', e.target.value); }}
                onMouseDown={stop}
                disabled={!leftDF}
                className="text-xs px-1 py-0.5 rounded outline-none transition-colors cursor-pointer disabled:cursor-default"
                style={{ flex: '1 1 0', minWidth: 0, background: '#1e0a3c', border: '1px solid #4c1d95', color: pair.left ? '#c4b5fd' : '#6d28d9' }}
              >
                <option value="">{leftDF ? '— L col —' : 'no L df'}</option>
                {leftCols.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
              <span className="text-xs font-mono select-none flex-shrink-0" style={{ color: '#4c1d95' }}>=</span>
              <select
                value={pair.right}
                onChange={(e) => { stop(e); onUpdateKey(id, i, 'right', e.target.value); }}
                onMouseDown={stop}
                disabled={!rightDF}
                className="text-xs px-1 py-0.5 rounded outline-none transition-colors cursor-pointer disabled:cursor-default"
                style={{ flex: '1 1 0', minWidth: 0, background: '#1e0a3c', border: '1px solid #4c1d95', color: pair.right ? '#d8b4fe' : '#6d28d9' }}
              >
                <option value="">{rightDF ? '— R col —' : 'no R df'}</option>
                {rightCols.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
              <button
                onClick={(e) => { stop(e); onRemoveKey(id, i); }}
                onMouseDown={stop}
                className="text-xs w-4 h-4 flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ color: '#ef4444' }}
              >
                ×
              </button>
            </div>
          );
        })}
        <button
          onClick={(e) => { stop(e); onAddKey(id); }}
          onMouseDown={stop}
          className="text-xs flex items-center gap-1 transition-colors"
          style={{ color: '#6d28d9' }}
        >
          + add key
        </button>
      </div>
      {codeOpen && <NodeCodeBlock nodeId={id} code={code} onCodeChange={onCodeChange} borderColor={colors.border} />}
    </div>
  );
}
