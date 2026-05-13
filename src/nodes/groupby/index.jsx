import React, { useState, useCallback, useMemo } from 'react';
import { Handle, Position } from 'reactflow';
import { useDrag } from '../../components/DragContext';
import EditableText from '../../components/EditableText';
import { DRAG_TYPE, ATTR_TYPE_META } from '../../constants';
import config, { AGG_FUNCTIONS } from './config';

const { colors } = config;
const ROW_HEIGHT = 26;

export default function GroupByNode({ id, data }) {
  const {
    label, inputs, groupByInputIds, aggregations,
    onLabelChange,
    onGroupByInputDrop, onDeleteGroupByInput, onToggleGroupByKey,
    onAddGroupByAgg, onDeleteGroupByAgg, onUpdateGroupByAgg,
  } = data;

  const dragRef = useDrag();
  const [dropOver, setDropOver] = useState(false);
  const stop = (e) => e.stopPropagation();

  const safeInputs   = useMemo(() => inputs        || [], [inputs]);
  const safeKeys     = useMemo(() => groupByInputIds || [], [groupByInputIds]);
  const safeAggs     = useMemo(() => aggregations   || [], [aggregations]);

  // Group inputs by source node label (like FunctionNode)
  const groupedInputs = useMemo(() => {
    const groups = new Map();
    for (const inp of safeInputs) {
      const key = inp.sourceNodeLabel || inp.sourceNodeId;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(inp);
    }
    return [...groups.entries()];
  }, [safeInputs]);

  const inputOptions = safeInputs;

  // ── Drop zone handlers ────────────────────────────────────────────────────

  const onDragOver = useCallback((e) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
    if (dragRef.current?.sourceNodeId === id) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setDropOver(true);
  }, [id, dragRef]);

  const onDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDropOver(false);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDropOver(false);
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return;
    const payload = JSON.parse(raw);
    if (payload.sourceNodeId === id) return;
    onGroupByInputDrop(id, payload);
  }, [id, onGroupByInputDrop]);

  // ── Output drag (group-by passthrough + agg outputs) ─────────────────────

  const onOutputDragStart = useCallback((e, outId, outName) => {
    e.stopPropagation();
    const drag = { sourceNodeId: id, attrId: outId, attrName: outName, sourceNodeLabel: label };
    dragRef.current = drag;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(drag));
  }, [id, label, dragRef]);

  const onOutputDragEnd = useCallback(() => { dragRef.current = null; }, [dragRef]);

  // ── Key columns shown on right ────────────────────────────────────────────

  const keyInputs = safeInputs.filter((inp) => safeKeys.includes(inp.id));

  return (
    <div
      className="rounded-lg overflow-visible shadow-xl"
      style={{ background: colors.bg, border: `1px solid ${colors.border}`, minWidth: 380 }}
      onContextMenu={stop}
    >
      {/* Header */}
      <div
        className="px-3 py-2 border-b flex items-center gap-2 cursor-grab active:cursor-grabbing"
        style={{ background: colors.header, borderColor: colors.border }}
      >
        <span className="font-bold select-none" style={{ color: '#38bdf8', fontSize: 13 }}>⊞</span>
        <EditableText
          value={label}
          onChange={(val) => onLabelChange(id, val)}
          className="text-white font-semibold text-sm flex-1"
          placeholder="groupby_name"
          borderColorClass="border-sky-400"
        />
      </div>

      <div className="flex" style={{ minHeight: 80 }}>
        {/* ── Left: Inputs ─────────────────────────────────────────────────── */}
        <div
          className="py-1 transition-colors"
          style={{
            flex: '0 0 170px',
            borderRight: '1px solid rgba(22,78,99,0.6)',
            background: dropOver ? 'rgba(14,165,233,0.07)' : undefined,
            outline: dropOver ? `2px dashed ${colors.handleFill}` : 'none',
            outlineOffset: -2,
          }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <div className="px-3 pb-0.5 text-xs font-semibold uppercase tracking-wider select-none" style={{ color: '#0369a1' }}>
            Inputs
          </div>

          {safeInputs.length === 0 && (
            <div className="px-3 py-2 text-xs italic" style={{ color: '#164e63' }}>
              {dropOver ? 'Drop to add' : 'Drop columns here'}
            </div>
          )}
          {dropOver && safeInputs.length > 0 && (
            <div className="px-3 py-0.5 text-xs text-center" style={{ color: colors.handleFill }}>+ drop to add</div>
          )}

          {groupedInputs.map(([groupLabel, groupItems]) => (
            <div key={groupLabel}>
              <div className="px-3 py-0.5 flex items-center gap-1 select-none" style={{ color: '#0ea5e9', fontSize: 10 }}>
                <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#0ea5e9' }} />
                <span className="truncate font-medium">{groupLabel}</span>
              </div>
              {groupItems.map((inp) => {
                const meta = ATTR_TYPE_META[inp.attrType] || ATTR_TYPE_META.string;
                const isKey = safeKeys.includes(inp.id);
                return (
                  <div
                    key={inp.id}
                    className="relative flex items-center group hover:bg-sky-900/20 transition-colors"
                    style={{ paddingLeft: 22, paddingRight: 8, minHeight: ROW_HEIGHT }}
                  >
                    <Handle
                      type="target" position={Position.Left} id={`${inp.id}-target`}
                      style={{
                        left: -5, top: '50%', transform: 'translateY(-50%)',
                        position: 'absolute', background: meta.color,
                        border: `2px solid ${colors.handleBorder}`, width: 8, height: 8,
                      }}
                    />
                    {/* Toggle group-by key */}
                    <button
                      onClick={(e) => { stop(e); onToggleGroupByKey(id, inp.id); }}
                      onMouseDown={stop}
                      title={isKey ? 'Remove from group by' : 'Add to group by'}
                      className="mr-1.5 flex-shrink-0 transition-opacity"
                      style={{ color: isKey ? '#38bdf8' : '#164e63', fontSize: 11, lineHeight: 1 }}
                    >
                      {isKey ? '⊞' : '○'}
                    </button>
                    <span className="text-xs flex-1 truncate" style={{ color: isKey ? '#7dd3fc' : '#4a7a99' }}>
                      {inp.attrName}
                    </span>
                    <button
                      onClick={(e) => { stop(e); onDeleteGroupByInput(id, inp.id); }}
                      onMouseDown={stop}
                      className="ml-1 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-300 text-xs w-4 h-4 flex items-center justify-center transition-opacity flex-shrink-0"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* ── Right: Outputs ────────────────────────────────────────────────── */}
        <div
          className="py-1 flex-1 min-w-0 flex flex-col"
          onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) e.stopPropagation(); }}
        >
          {/* Group by keys (passthrough outputs) */}
          <div className="px-3 pb-0.5 text-xs font-semibold uppercase tracking-wider select-none" style={{ color: '#0369a1' }}>
            Group by
          </div>
          {keyInputs.length === 0 && (
            <div className="px-3 py-1 text-xs italic" style={{ color: '#164e63' }}>
              Toggle ⊞ to add keys
            </div>
          )}
          {keyInputs.map((inp) => {
            const outId = `gbout-${inp.id}`;
            return (
              <div
                key={inp.id}
                draggable
                onMouseDown={stop}
                onDragStart={(e) => onOutputDragStart(e, outId, inp.attrName)}
                onDragEnd={onOutputDragEnd}
                className="relative flex items-center group hover:bg-sky-900/20 transition-colors cursor-grab active:cursor-grabbing"
                style={{ paddingLeft: 8, paddingRight: 22, minHeight: ROW_HEIGHT }}
              >
                <span className="text-xs flex-1 truncate" style={{ color: '#7dd3fc' }}>{inp.attrName}</span>
                <Handle
                  type="source" position={Position.Right} id={`${outId}-source`}
                  style={{
                    right: -5, top: '50%', transform: 'translateY(-50%)',
                    position: 'absolute', background: '#38bdf8',
                    border: `2px solid ${colors.handleBorder}`, width: 8, height: 8,
                  }}
                />
              </div>
            );
          })}

          {/* Divider */}
          <div className="mx-3 my-1" style={{ borderTop: '1px solid rgba(22,78,99,0.5)' }} />

          {/* Aggregation outputs */}
          <div className="px-3 pb-0.5 text-xs font-semibold uppercase tracking-wider select-none" style={{ color: '#0369a1' }}>
            Aggregations
          </div>
          {safeAggs.length === 0 && (
            <div className="px-3 py-0.5 text-xs italic" style={{ color: '#164e63' }}>No aggregations</div>
          )}
          {safeAggs.map((agg) => {
            const outId = `aggout-${agg.id}`;
            const outName = agg.outputName || `${agg.func || 'agg'}`;
            return (
              <div
                key={agg.id}
                className="relative flex items-center group hover:bg-sky-900/20 transition-colors"
                style={{ paddingLeft: 8, paddingRight: 22, minHeight: ROW_HEIGHT }}
              >
                {/* Column selector */}
                <select
                  value={agg.inputId}
                  onChange={(e) => { stop(e); onUpdateGroupByAgg(id, agg.id, 'inputId', e.target.value); }}
                  onMouseDown={stop}
                  className="text-xs px-1 py-0.5 rounded outline-none cursor-pointer"
                  style={{ flex: '1 1 0', minWidth: 0, background: '#021526', border: '1px solid #164e63', color: agg.inputId ? '#7dd3fc' : '#1e6a8a' }}
                >
                  <option value="">col</option>
                  {inputOptions.map((inp) => (
                    <option key={inp.id} value={inp.id}>{inp.attrName}</option>
                  ))}
                </select>

                {/* Function selector */}
                <select
                  value={agg.func}
                  onChange={(e) => { stop(e); onUpdateGroupByAgg(id, agg.id, 'func', e.target.value); }}
                  onMouseDown={stop}
                  className="mx-1 text-xs px-1 py-0.5 rounded outline-none cursor-pointer flex-shrink-0"
                  style={{ background: '#021526', border: '1px solid #164e63', color: '#38bdf8' }}
                >
                  {AGG_FUNCTIONS.map((fn) => <option key={fn} value={fn}>{fn}</option>)}
                </select>

                {/* Output name */}
                <input
                  type="text"
                  value={agg.outputName}
                  onChange={(e) => { stop(e); onUpdateGroupByAgg(id, agg.id, 'outputName', e.target.value); }}
                  onClick={stop}
                  onMouseDown={stop}
                  placeholder="out_col"
                  className="text-xs px-1 py-0.5 rounded outline-none font-mono"
                  style={{ flex: '1 1 0', minWidth: 0, background: '#021526', border: '1px solid #164e63', color: '#e0f2fe' }}
                />

                {/* Delete button */}
                <button
                  onClick={(e) => { stop(e); onDeleteGroupByAgg(id, agg.id); }}
                  onMouseDown={stop}
                  className="ml-1 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-300 text-xs w-4 h-4 flex items-center justify-center transition-opacity flex-shrink-0"
                >
                  ×
                </button>

                {/* Draggable output handle */}
                <div
                  draggable
                  onMouseDown={stop}
                  onDragStart={(e) => onOutputDragStart(e, outId, outName)}
                  onDragEnd={onOutputDragEnd}
                  className="absolute cursor-grab active:cursor-grabbing"
                  style={{ right: 6, top: '50%', transform: 'translateY(-50%)' }}
                  title="Drag to link output"
                >
                  <Handle
                    type="source" position={Position.Right} id={`${outId}-source`}
                    style={{
                      right: -11, top: '50%', transform: 'translateY(-50%)',
                      position: 'absolute', background: '#0ea5e9',
                      border: `2px solid ${colors.handleBorder}`, width: 8, height: 8,
                    }}
                  />
                </div>
              </div>
            );
          })}

          <button
            onClick={(e) => { stop(e); onAddGroupByAgg(id); }}
            onMouseDown={stop}
            className="mx-3 mt-1 mb-1 text-xs transition-colors"
            style={{ color: '#0369a1' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#38bdf8'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#0369a1'; }}
          >
            + add agg
          </button>
        </div>
      </div>
    </div>
  );
}
