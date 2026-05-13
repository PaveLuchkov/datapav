import React, { useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { useDrag } from '../../components/DragContext';
import { DRAG_TYPE, JOIN_TYPES, JOIN_ACTIVE_STYLES } from '../../constants';
import config from './config';

const { colors } = config;
const ROW_HEIGHT = 24;

export default function MergeNode({ id, data }) {
  const {
    joinType, keyPairs, leftDF, rightDF,
    onJoinTypeChange, onAddKey, onRemoveKey, onUpdateKey,
  } = data;

  const dragRef = useDrag();
  const stop = (e) => e.stopPropagation();

  const safeKeyPairs = keyPairs || [];
  const leftCols  = leftDF?.attributes  || [];
  const rightCols = rightDF?.attributes || [];

  const onOutputDragStart = useCallback((e, side, attr) => {
    e.stopPropagation();
    const attrId = `mout-${side}-${attr.id}`;
    const drag = { sourceNodeId: id, attrId, attrName: attr.name, sourceNodeLabel: '⋈ merge' };
    dragRef.current = drag;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(drag));
  }, [id, dragRef]);

  const onOutputDragEnd = useCallback(() => { dragRef.current = null; }, [dragRef]);

  return (
    <div
      className="rounded-lg overflow-visible shadow-2xl"
      style={{ background: colors.bg, border: `1px solid ${colors.border}`, minWidth: 360 }}
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
        type="source" id="out" position={Position.Right}
        style={{ top: 14, background: colors.handleLeft, border: `2px solid ${colors.handleBorder}`, width: 8, height: 8, borderRadius: 2 }}
      />

      <div
        className="px-3 py-2 border-b border-purple-900 flex items-center justify-between cursor-grab active:cursor-grabbing"
        style={{ background: colors.header }}
      >
        <span className="text-purple-200 font-bold text-sm tracking-widest select-none">⋈ MERGE</span>
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

      <div className="flex" style={{ minHeight: 80 }}>
        <div className="py-2 border-r border-purple-900/50" style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="px-3 pb-2">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xs font-bold select-none" style={{ color: '#7c3aed', minWidth: 10 }}>L</span>
              <span className="text-xs truncate" style={{ color: leftDF ? '#c4b5fd' : '#4c1d95' }}>
                {leftDF ? leftDF.label : <em>not connected</em>}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold select-none" style={{ color: '#9333ea', minWidth: 10 }}>R</span>
              <span className="text-xs truncate" style={{ color: rightDF ? '#d8b4fe' : '#4c1d95' }}>
                {rightDF ? rightDF.label : <em>not connected</em>}
              </span>
            </div>
          </div>

          <div className="pt-1.5 border-t border-purple-900/40 px-2">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1.5 px-1 select-none" style={{ color: '#6d28d9' }}>
              Join keys
            </div>
            {safeKeyPairs.length === 0 && (
              <div className="text-xs italic px-1 mb-1" style={{ color: '#4c1d95' }}>No keys — cross join</div>
            )}
            {safeKeyPairs.map((pair, i) => (
              <div key={i} className="flex items-center gap-1 mb-1.5">
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
            ))}
            <button
              onClick={(e) => { stop(e); onAddKey(id); }}
              onMouseDown={stop}
              className="text-xs flex items-center gap-1 transition-colors px-1"
              style={{ color: '#6d28d9' }}
            >
              + add key
            </button>
          </div>
        </div>

        <div className="py-2" style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider select-none" style={{ color: '#6d28d9' }}>
            Output
          </div>
          {leftCols.length === 0 && rightCols.length === 0 && (
            <div className="px-3 text-xs italic" style={{ color: '#4c1d95' }}>Connect DFs to see columns</div>
          )}
          {leftCols.map((attr) => (
            <OutputRow key={`L-${attr.id}`} side="L" attr={attr} onDragStart={onOutputDragStart} onDragEnd={onOutputDragEnd} />
          ))}
          {rightCols.map((attr) => (
            <OutputRow key={`R-${attr.id}`} side="R" attr={attr} onDragStart={onOutputDragStart} onDragEnd={onOutputDragEnd} />
          ))}
        </div>
      </div>
    </div>
  );
}

function OutputRow({ side, attr, onDragStart, onDragEnd }) {
  const sideColor = side === 'L' ? '#7c3aed' : '#9333ea';
  return (
    <div
      draggable
      onMouseDown={(e) => e.stopPropagation()}
      onDragStart={(e) => onDragStart(e, side, attr)}
      onDragEnd={onDragEnd}
      className="relative flex items-center group hover:bg-purple-900/30 transition-colors cursor-grab active:cursor-grabbing"
      style={{ paddingLeft: 8, paddingRight: 22, minHeight: ROW_HEIGHT }}
    >
      <span className="text-xs font-bold mr-1.5 flex-shrink-0 select-none" style={{ color: sideColor, fontSize: 9, lineHeight: 1 }}>
        {side}
      </span>
      <span className="text-xs flex-1 truncate" style={{ color: '#e9d5ff' }}>{attr.name}</span>
      <Handle
        type="source" position={Position.Right}
        id={`mout-${side}-${attr.id}-source`}
        style={{
          right: -5, top: '50%', transform: 'translateY(-50%)',
          position: 'absolute', background: sideColor,
          border: `2px solid ${colors.bg}`, width: 8, height: 8,
        }}
      />
    </div>
  );
}
