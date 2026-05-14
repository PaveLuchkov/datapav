import React, { useCallback, useMemo, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import EditableText from '../../components/EditableText';
import config from './config';

const { colors } = config;

const OP_STYLES = {
  WHERE: { color: '#9a3412', bg: 'rgba(120,53,15,0.4)' },
  AND:   { color: '#86efac', bg: 'rgba(5,46,16,0.55)'  },
  OR:    { color: '#fb923c', bg: 'rgba(67,20,7,0.7)'   },
};

export default function FilterNode({ id, data }) {
  const {
    label, conditions: rawConditions, condition: legacyCondition,
    onLabelChange,
    onAddFilterCondition, onDeleteFilterCondition,
    onUpdateFilterExpr, onToggleFilterOp,
  } = data;

  const stop = (e) => e.stopPropagation();

  const conditions = useMemo(() => {
    if (rawConditions?.length) return rawConditions;
    return [{ id: 'legacy', op: 'WHERE', expr: legacyCondition || '' }];
  }, [rawConditions, legacyCondition]);

  const debounceRefs = useRef(new Map());
  const onExprInput = useCallback((e, condId) => {
    const val = e.target.value;
    clearTimeout(debounceRefs.current.get(condId));
    debounceRefs.current.set(condId, setTimeout(() => onUpdateFilterExpr(id, condId, val), 400));
  }, [id, onUpdateFilterExpr]);

  return (
    <div
      className="rounded-lg overflow-visible shadow-xl"
      style={{ background: colors.bg, border: `1px solid ${colors.border}`, minWidth: 300 }}
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
        {conditions.map((cond, idx) => {
          const opStyle = OP_STYLES[cond.op] || OP_STYLES.AND;
          const canToggle = idx > 0;
          const canDelete = conditions.length > 1;
          return (
            <div key={cond.id} className="flex items-center gap-1.5 mb-1.5">
              <span
                onClick={canToggle ? (e) => { stop(e); onToggleFilterOp(id, cond.id); } : undefined}
                onMouseDown={stop}
                className="text-xs font-mono rounded flex-shrink-0 select-none text-center"
                style={{
                  color: opStyle.color,
                  background: opStyle.bg,
                  padding: '2px 6px',
                  minWidth: 44,
                  cursor: canToggle ? 'pointer' : 'default',
                  opacity: canToggle ? 0.85 : 0.6,
                }}
                title={canToggle ? 'Click to toggle AND / OR' : undefined}
              >
                {cond.op.toLowerCase()}
              </span>
              <input
                key={`${cond.id}-input`}
                type="text"
                defaultValue={cond.expr}
                onInput={(e) => onExprInput(e, cond.id)}
                onChange={() => {}}
                onClick={stop}
                onMouseDown={stop}
                placeholder={idx === 0 ? 'e.g. amount > 100' : 'condition…'}
                className="flex-1 min-w-0 text-xs px-2 py-1 rounded outline-none font-mono"
                style={{
                  background: '#0f0502',
                  border: `1px solid ${colors.border}`,
                  color: '#fed7aa',
                  caretColor: '#fb923c',
                }}
              />
              {canDelete && (
                <button
                  onClick={(e) => { stop(e); onDeleteFilterCondition(id, cond.id); }}
                  onMouseDown={stop}
                  className="text-red-400 hover:text-red-300 text-xs w-4 h-4 flex items-center justify-center flex-shrink-0 transition-colors"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}

        <div className="flex gap-2 mt-0.5">
          {['AND', 'OR'].map((op) => {
            const s = OP_STYLES[op];
            return (
              <button
                key={op}
                onClick={(e) => { stop(e); onAddFilterCondition(id, op); }}
                onMouseDown={stop}
                className="text-xs font-mono px-2 py-0.5 rounded transition-all"
                style={{ color: s.color, border: `1px solid ${s.bg}` }}
                onMouseEnter={(e) => { e.currentTarget.style.background = s.bg; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                + {op.toLowerCase()}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
