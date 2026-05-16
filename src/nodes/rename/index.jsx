import React, { useState, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { useDrag } from '../../components/DragContext';
import EditableText from '../../components/EditableText';
import StageBadge from '../../components/StageBadge';
import NodeCodeBlock from '../../components/NodeCodeBlock';
import ColumnSelect from '../../components/ColumnSelect';
import { DRAG_TYPE } from '../../constants';
import config from './config';

const { colors } = config;

const ROW_HEIGHT = 28;

export default function RenameNode({ id, data }) {
  const {
    label, mappings = [], connectedAttrs = [],
    onLabelChange, onAddMapping, onDeleteMapping, onUpdateMapping,
    onCodeChange, onStageChange,
    trackerHighlight, code, stage,
  } = data;

  const dragRef = useDrag();
  const [codeOpen, setCodeOpen] = useState(false);
  const stop = (e) => e.stopPropagation();

  const isTrackedAttr = (name) => {
    if (!trackerHighlight?.query) return false;
    const t = (name || '').toLowerCase();
    return trackerHighlight.wholeWord ? t === trackerHighlight.query : t.includes(trackerHighlight.query);
  };

  const onRowDragStart = useCallback((e, mapping) => {
    if (!mapping.to) return;
    e.stopPropagation();
    const srcAttr = connectedAttrs.find((a) => a.name === mapping.from);
    const drag = { sourceNodeId: id, attrId: mapping.id, attrName: mapping.to, attrType: srcAttr?.type || 'string', sourceNodeLabel: label };
    dragRef.current = drag;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(drag));
  }, [id, label, connectedAttrs, dragRef]);

  const onRowDragEnd = useCallback(() => { dragRef.current = null; }, [dragRef]);

  const selectStyle = {
    flex: '1 1 0', minWidth: 0,
    background: '#110b2e', border: '1px solid #3730a3',
    color: '#a5b4fc', fontSize: '0.75rem', borderRadius: 3,
    padding: '1px 4px', outline: 'none', cursor: 'pointer',
  };
  const inputStyle = {
    flex: '1 1 0', minWidth: 0,
    background: 'transparent', outline: 'none',
    fontSize: '0.75rem', fontFamily: 'ui-monospace, monospace',
    color: '#a5b4fc', caretColor: '#818cf8',
    borderBottom: '1px solid #3730a3',
  };

  return (
    <div
      className="rounded-lg overflow-visible shadow-xl"
      style={{ background: colors.bg, border: `1px solid ${colors.border}`, minWidth: 260 }}
      onContextMenu={stop}
    >
      <Handle
        type="target" id="df-in" position={Position.Left}
        style={{ top: 14, background: colors.handleFill, border: `2px solid ${colors.handleBorder}`, width: 8, height: 8, borderRadius: 2 }}
      />
      <Handle
        type="source" id="df-out" position={Position.Right}
        style={{ top: 14, background: colors.handleFill, border: `2px solid ${colors.handleBorder}`, width: 8, height: 8, borderRadius: 2 }}
      />

      <div
        className="px-3 py-2 border-b flex items-center gap-2 cursor-grab active:cursor-grabbing"
        style={{ background: colors.header, borderColor: colors.border }}
      >
        <span className="font-mono font-bold select-none" style={{ color: colors.handleFill, fontSize: 13 }}>⟲</span>
        <EditableText
          value={label}
          onChange={(val) => onLabelChange(id, val)}
          className="text-white font-semibold text-sm flex-1"
          placeholder="rename"
          borderColorClass="border-indigo-400"
        />
        <StageBadge nodeId={id} stage={stage} onStageChange={onStageChange} />
        <button
          onClick={(e) => { stop(e); setCodeOpen((v) => !v); }}
          onMouseDown={stop}
          title="Toggle code snippet"
          className="flex-shrink-0 select-none transition-opacity hover:opacity-100 font-mono"
          style={{ fontSize: 10, color: colors.handleFill, opacity: codeOpen ? 1 : 0.4 }}
        >
          {codeOpen ? '[/]' : '</>'}
        </button>
      </div>

      <div className="py-1">
        {mappings.length === 0 && (
          <div className="px-3 py-1 text-xs italic" style={{ color: colors.border }}>No mappings</div>
        )}
        {mappings.map((m) => {
          const tracked = isTrackedAttr(m.from) || isTrackedAttr(m.to);
          return (
          <div
            key={m.id}
            draggable={!!m.to}
            onMouseDown={stop}
            onDragStart={(e) => onRowDragStart(e, m)}
            onDragEnd={onRowDragEnd}
            className="relative flex items-center gap-1.5 group hover:bg-indigo-900/30 transition-colors"
            style={{
              paddingLeft: 10, paddingRight: 22, minHeight: ROW_HEIGHT,
              cursor: m.to ? 'grab' : 'default',
              background: tracked ? 'rgba(245,158,11,0.08)' : undefined,
            }}
          >
            <ColumnSelect
              value={m.from}
              onChange={(val) => onUpdateMapping(id, m.id, 'from', val)}
              columns={connectedAttrs}
              placeholder="— old name —"
              emptyPlaceholder="old_name"
              selectStyle={selectStyle}
              inputStyle={inputStyle}
              stop={stop}
            />
            <span className="flex-shrink-0 select-none text-xs font-mono" style={{ color: '#4f35b0' }}>→</span>
            <input
              value={m.to}
              onChange={(e) => onUpdateMapping(id, m.id, 'to', e.target.value)}
              onClick={stop}
              onMouseDown={stop}
              onKeyDown={stop}
              placeholder="new_name"
              className="flex-1 min-w-0 bg-transparent outline-none text-xs font-mono"
              style={{ color: isTrackedAttr(m.to) ? '#fcd34d' : '#c7d2fe', fontWeight: isTrackedAttr(m.to) ? 700 : undefined, caretColor: '#818cf8', borderBottom: '1px solid #3730a3' }}
            />
            <button
              onClick={(e) => { stop(e); onDeleteMapping(id, m.id); }}
              onMouseDown={stop}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-xs w-4 h-4 flex items-center justify-center flex-shrink-0 absolute right-1"
              style={{ color: '#ef4444' }}
            >
              ×
            </button>
            {m.to && (
              <Handle
                type="source" position={Position.Right} id={`${m.id}-source`}
                style={{
                  right: -5, top: '50%', transform: 'translateY(-50%)',
                  position: 'absolute', background: colors.handleFill,
                  border: `2px solid ${colors.handleBorder}`, width: 8, height: 8,
                }}
              />
            )}
          </div>
          );
        })}
        <button
          onClick={(e) => { stop(e); onAddMapping(id); }}
          onMouseDown={stop}
          className="mx-3 mt-1 mb-1.5 text-xs transition-colors"
          style={{ color: '#6366f1' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#a5b4fc'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#6366f1'; }}
        >
          + add mapping
        </button>
      </div>

      {codeOpen && <NodeCodeBlock nodeId={id} code={code} onCodeChange={onCodeChange} borderColor={colors.border} />}
    </div>
  );
}
