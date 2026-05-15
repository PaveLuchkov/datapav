import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import EditableText from '../../components/EditableText';
import StageBadge from '../../components/StageBadge';
import NodeCodeBlock from '../../components/NodeCodeBlock';
import ColumnSelect from '../../components/ColumnSelect';
import config, { TRANSFORM_OPS } from './config';

const { colors } = config;


const TYPES = ['string', 'int', 'float', 'bool', 'datetime'];

function OpRow({ nodeId, op, columns, onUpdate, onDelete, stop, isTrackedAttr }) {
  const colSelectStyle = {
    flex: '1 1 0', minWidth: 0,
    background: '#2a1200', border: `1px solid #7c2d12`,
    color: '#fdba74', fontSize: '0.75rem', borderRadius: 3,
    padding: '1px 4px', outline: 'none', cursor: 'pointer',
  };
  const colInputStyle = {
    flex: '1 1 0', minWidth: 0,
    background: 'transparent', outline: 'none',
    fontSize: '0.75rem', fontFamily: 'ui-monospace, monospace',
    color: '#fed7aa', caretColor: '#f97316',
    borderBottom: `1px solid #7c2d12`,
  };
  const tracked = isTrackedAttr(op.args?.col) || isTrackedAttr(op.args?.value);
  return (
    <div
      className="flex items-center gap-1.5 group hover:bg-orange-900/30 transition-colors"
      style={{ paddingLeft: 10, paddingRight: 10, minHeight: 32, background: tracked ? 'rgba(245,158,11,0.08)' : undefined }}
    >
      <select
        value={op.type}
        onChange={(e) => { e.stopPropagation(); onUpdate(nodeId, op.id, 'type', e.target.value); }}
        onMouseDown={stop}
        className="text-xs rounded outline-none cursor-pointer"
        style={{ background: '#3a1505', border: `1px solid ${colors.border}`, color: '#fdba74', padding: '1px 4px' }}
      >
        {TRANSFORM_OPS.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>

      {op.type === 'fillna' && (
        <input
          value={op.args.value ?? ''}
          onChange={(e) => onUpdate(nodeId, op.id, 'value', e.target.value)}
          onClick={stop}
          onMouseDown={stop}
          onKeyDown={stop}
          placeholder="value"
          className="flex-1 min-w-0 bg-transparent outline-none text-xs font-mono"
          style={{ color: '#fed7aa', caretColor: '#f97316', borderBottom: `1px solid #7c2d12` }}
        />
      )}

      {op.type === 'astype' && (
        <>
          <ColumnSelect
            value={op.args.col ?? ''}
            onChange={(val) => onUpdate(nodeId, op.id, 'col', val)}
            columns={columns}
            placeholder="— column —"
            emptyPlaceholder="column"
            selectStyle={colSelectStyle}
            inputStyle={colInputStyle}
            stop={stop}
          />
          <select
            value={op.args.type ?? 'string'}
            onChange={(e) => { e.stopPropagation(); onUpdate(nodeId, op.id, 'type_val', e.target.value); }}
            onMouseDown={stop}
            className="text-xs rounded outline-none cursor-pointer"
            style={{ background: '#3a1505', border: `1px solid ${colors.border}`, color: '#fdba74', padding: '1px 4px' }}
          >
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </>
      )}

      {op.type === 'sort_values' && (
        <>
          <ColumnSelect
            value={op.args.col ?? ''}
            onChange={(val) => onUpdate(nodeId, op.id, 'col', val)}
            columns={columns}
            placeholder="— column —"
            emptyPlaceholder="column"
            selectStyle={colSelectStyle}
            inputStyle={colInputStyle}
            stop={stop}
          />
          <button
            onClick={(e) => { stop(e); onUpdate(nodeId, op.id, 'asc', !(op.args.asc ?? true)); }}
            onMouseDown={stop}
            className="text-xs flex-shrink-0 rounded px-1 transition-colors"
            style={{ color: op.args.asc === false ? '#f97316' : '#94a3b8', border: `1px solid #7c2d12` }}
            title="Toggle ascending/descending"
          >
            {op.args.asc === false ? '↓' : '↑'}
          </button>
        </>
      )}

      <button
        onClick={(e) => { stop(e); onDelete(nodeId, op.id); }}
        onMouseDown={stop}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-xs w-4 h-4 flex items-center justify-center flex-shrink-0 ml-auto"
        style={{ color: '#ef4444' }}
      >
        ×
      </button>
    </div>
  );
}

export default function TransformNode({ id, data }) {
  const {
    label, ops = [], connectedAttrs = [],
    onLabelChange, onAddTransformOp, onDeleteTransformOp, onUpdateTransformOp,
    onCodeChange, onStageChange,
    trackerHighlight, code, stage,
  } = data;

  const [codeOpen, setCodeOpen] = useState(false);
  const stop = (e) => e.stopPropagation();

  const isTrackedAttr = (name) => {
    if (!trackerHighlight?.query) return false;
    const t = (name || '').toLowerCase();
    return trackerHighlight.wholeWord ? t === trackerHighlight.query : t.includes(trackerHighlight.query);
  };

  return (
    <div
      className="rounded-lg overflow-visible shadow-xl"
      style={{ background: colors.bg, border: `1px solid ${colors.border}`, minWidth: 280 }}
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
        <span className="font-mono font-bold select-none" style={{ color: colors.handleFill, fontSize: 13 }}>⚙</span>
        <EditableText
          value={label}
          onChange={(val) => onLabelChange(id, val)}
          className="text-white font-semibold text-sm flex-1"
          placeholder="transform"
          borderColorClass="border-orange-400"
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
        {ops.length === 0 && (
          <div className="px-3 py-1 text-xs italic" style={{ color: '#7c2d12' }}>No operations</div>
        )}
        {ops.map((op) => (
          <OpRow
            key={op.id}
            nodeId={id}
            op={op}
            columns={connectedAttrs}
            onUpdate={onUpdateTransformOp}
            onDelete={onDeleteTransformOp}
            stop={stop}
            isTrackedAttr={isTrackedAttr}
          />
        ))}
        <button
          onClick={(e) => { stop(e); onAddTransformOp(id); }}
          onMouseDown={stop}
          className="mx-3 mt-1 mb-1.5 text-xs transition-colors"
          style={{ color: '#c2410c' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#f97316'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#c2410c'; }}
        >
          + add operation
        </button>
      </div>

      {codeOpen && <NodeCodeBlock nodeId={id} code={code} onCodeChange={onCodeChange} borderColor={colors.border} />}
    </div>
  );
}
