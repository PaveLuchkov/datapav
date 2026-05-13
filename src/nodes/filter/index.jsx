import React, { useCallback, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import EditableText from '../../components/EditableText';
import config from './config';

const { colors } = config;

export default function FilterNode({ id, data }) {
  const { label, condition, onLabelChange, onFilterConditionChange } = data;
  const stop = (e) => e.stopPropagation();

  const debounceRef = useRef(null);
  const onConditionInput = useCallback((e) => {
    const val = e.target.value;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onFilterConditionChange(id, val), 400);
  }, [id, onFilterConditionChange]);

  return (
    <div
      className="rounded-lg overflow-visible shadow-xl"
      style={{ background: colors.bg, border: `1px solid ${colors.border}`, minWidth: 260 }}
      onContextMenu={stop}
    >
      <Handle
        type="target" id="filter-in" position={Position.Left}
        style={{ top: '50%', background: colors.handleFill, border: `2px solid ${colors.handleBorder}`, width: 10, height: 10 }}
      />
      <Handle
        type="source" id="filter-out" position={Position.Right}
        style={{ top: '50%', background: colors.handleFill, border: `2px solid ${colors.handleBorder}`, width: 10, height: 10 }}
      />

      <div
        className="px-3 py-2 border-b flex items-center gap-2 cursor-grab active:cursor-grabbing"
        style={{ background: colors.header, borderColor: colors.border }}
      >
        <span className="font-mono font-bold select-none" style={{ color: '#fb923c', fontSize: 13 }}>σ</span>
        <EditableText
          value={label}
          onChange={(val) => onLabelChange(id, val)}
          className="text-white font-semibold text-sm flex-1"
          placeholder="filter_name"
          borderColorClass="border-orange-400"
        />
      </div>

      <div className="px-3 py-2">
        <div className="text-xs font-semibold uppercase tracking-wider mb-1.5 select-none" style={{ color: '#9a3412' }}>
          WHERE
        </div>
        <input
          type="text"
          defaultValue={condition}
          onInput={onConditionInput}
          onChange={() => {}}
          onClick={stop}
          onMouseDown={stop}
          placeholder="e.g. amount > 100"
          className="w-full text-xs px-2 py-1.5 rounded outline-none font-mono"
          style={{
            background: '#0f0502',
            border: `1px solid ${colors.border}`,
            color: '#fed7aa',
            caretColor: '#fb923c',
          }}
        />
      </div>
    </div>
  );
}
