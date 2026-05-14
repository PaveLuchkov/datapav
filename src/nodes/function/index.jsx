import React, { useState, useCallback, useMemo } from 'react';
import { Handle, Position } from 'reactflow';
import { useDrag } from '../../components/DragContext';
import EditableText from '../../components/EditableText';
import { DRAG_TYPE, DRAG_TYPE_DF } from '../../constants';
import config from './config';

const { colors } = config;
const ROW_HEIGHT = 24;

export default function FunctionNode({ id, data }) {
  const {
    label, inputs, outputs, dfGroups,
    onLabelChange,
    onFunctionInputDrop,
    onDeleteFunctionInput,
    onAddFunctionOutput,
    onDeleteFunctionOutput,
    onFunctionOutputChange,
    onFunctionDFDrop,
    onDeleteDFGroup,
  } = data;

  const dragRef = useDrag();
  const [inputsDragOver, setInputsDragOver] = useState(false);

  const allGroups = useMemo(() => {
    const map = new Map(); // sourceNodeId → { groupId, label, items }
    for (const g of (dfGroups || [])) {
      map.set(g.sourceNodeId, { groupId: g.id, label: g.sourceNodeLabel, items: [] });
    }
    for (const inp of inputs) {
      if (!map.has(inp.sourceNodeId)) {
        map.set(inp.sourceNodeId, { groupId: null, label: inp.sourceNodeLabel || inp.sourceNodeId, items: [] });
      }
      map.get(inp.sourceNodeId).items.push(inp);
    }
    return [...map.values()];
  }, [dfGroups, inputs]);

  const onInputPanelDragOver = useCallback((e) => {
    const hasCol = e.dataTransfer.types.includes(DRAG_TYPE);
    const hasDF  = e.dataTransfer.types.includes(DRAG_TYPE_DF);
    if (!hasCol && !hasDF) return;
    if (dragRef.current?.sourceNodeId === id) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setInputsDragOver(true);
  }, [id, dragRef]);

  const onInputPanelDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setInputsDragOver(false);
  }, []);

  const onInputPanelDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setInputsDragOver(false);
    const rawDF = e.dataTransfer.getData(DRAG_TYPE_DF);
    if (rawDF) {
      const payload = JSON.parse(rawDF);
      if (payload.sourceNodeId !== id) onFunctionDFDrop(id, payload);
      return;
    }
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return;
    const payload = JSON.parse(raw);
    if (payload.sourceNodeId === id) return;
    onFunctionInputDrop(id, payload);
  }, [id, onFunctionInputDrop, onFunctionDFDrop]);

  const onOutputDragStart = useCallback((e, output) => {
    e.stopPropagation();
    const drag = { sourceNodeId: id, attrId: output.id, attrName: output.name, sourceNodeLabel: label };
    dragRef.current = drag;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(drag));
  }, [id, label, dragRef]);

  const onOutputDragEnd = useCallback(() => { dragRef.current = null; }, [dragRef]);

  const stop = (e) => e.stopPropagation();

  return (
    <div
      className="rounded-lg overflow-visible shadow-xl"
      style={{ background: colors.bg, border: `1px solid ${colors.border}`, minWidth: 360 }}
      onContextMenu={stop}
    >
      <div
        className="px-3 py-2 border-b border-emerald-900 flex items-center gap-2 cursor-grab active:cursor-grabbing"
        style={{ background: colors.header }}
      >
        <span className="text-emerald-400 font-mono text-sm select-none font-bold">ƒ</span>
        <EditableText
          value={label}
          onChange={(val) => onLabelChange(id, val)}
          className="text-white font-semibold text-sm flex-1"
          placeholder="function_name"
          borderColorClass="border-emerald-400"
        />
      </div>

      <div className="flex" style={{ minHeight: 72 }}>
        <div
          className="py-1 transition-colors"
          style={{
            flex: '1 1 0',
            borderRight: '1px solid rgba(22,101,52,0.5)',
            background: inputsDragOver ? 'rgba(16,185,129,0.08)' : undefined,
            outline: inputsDragOver ? `2px dashed ${colors.handleFill}` : 'none',
            outlineOffset: -2,
          }}
          onDragOver={onInputPanelDragOver}
          onDragLeave={onInputPanelDragLeave}
          onDrop={onInputPanelDrop}
        >
          <div className="px-3 pb-0.5 text-xs text-emerald-700 uppercase tracking-wider font-semibold">Inputs</div>
          {allGroups.length === 0 && (
            <div className="px-3 py-2 text-xs italic" style={{ color: colors.border }}>
              {inputsDragOver ? 'Drop to add input' : 'Drop columns or DataFrames here'}
            </div>
          )}
          {inputsDragOver && allGroups.length > 0 && (
            <div className="px-3 py-0.5 text-xs text-emerald-500 text-center">+ drop to add</div>
          )}
          {allGroups.map((group) => (
            <div key={group.groupId || group.label}>
              <div className="px-3 py-0.5 flex items-center gap-1 select-none group/grp" style={{ color: '#4ade80', fontSize: 10 }}>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600 flex-shrink-0" />
                <span className="truncate font-medium flex-1">{group.label}</span>
                {group.groupId !== null && group.items.length === 0 && (
                  <button
                    onClick={(e) => { stop(e); onDeleteDFGroup(id, group.groupId); }}
                    onMouseDown={stop}
                    className="text-red-400 opacity-0 group-hover/grp:opacity-100 hover:text-red-300 w-3 h-3 flex items-center justify-center transition-opacity flex-shrink-0"
                    style={{ fontSize: 11 }}
                  >
                    ×
                  </button>
                )}
              </div>
              {group.items.length === 0 && (
                <div className="px-3 py-1 text-xs italic" style={{ color: colors.border, paddingLeft: 22 }}>
                  drag columns to add
                </div>
              )}
              {group.items.map((inp) => (
                <div
                  key={inp.id}
                  className="relative flex items-center group hover:bg-emerald-900/30 transition-colors"
                  style={{ paddingLeft: 22, paddingRight: 8, minHeight: ROW_HEIGHT }}
                >
                  <Handle
                    type="target" position={Position.Left} id={`${inp.id}-target`}
                    style={{
                      left: -5, top: '50%', transform: 'translateY(-50%)',
                      position: 'absolute', background: colors.handleFill,
                      border: `2px solid ${colors.handleBorder}`, width: 8, height: 8,
                    }}
                  />
                  <span className="text-emerald-200 text-xs flex-1 truncate">{inp.attrName}</span>
                  <button
                    onClick={(e) => { stop(e); onDeleteFunctionInput(id, inp.id); }}
                    onMouseDown={stop}
                    className="ml-1 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-300 text-xs w-4 h-4 flex items-center justify-center transition-opacity flex-shrink-0"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div
          className="py-1"
          style={{ flex: '1 1 0' }}
          onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) e.stopPropagation(); }}
        >
          <div className="px-3 pb-0.5 text-xs text-emerald-700 uppercase tracking-wider font-semibold">Outputs</div>
          {outputs.length === 0 && (
            <div className="px-3 py-2 text-xs italic" style={{ color: colors.border }}>No outputs yet</div>
          )}
          {outputs.map((output) => (
            <div
              key={output.id}
              draggable
              onMouseDown={stop}
              onDragStart={(e) => onOutputDragStart(e, output)}
              onDragEnd={onOutputDragEnd}
              className="relative flex items-center group hover:bg-emerald-900/30 transition-colors cursor-grab active:cursor-grabbing"
              style={{ paddingLeft: 8, paddingRight: 22, minHeight: ROW_HEIGHT }}
            >
              <EditableText
                value={output.name}
                onChange={(val) => onFunctionOutputChange(id, output.id, val)}
                className="text-emerald-100 text-xs flex-1"
                placeholder="output_col"
                borderColorClass="border-emerald-400"
              />
              <button
                onClick={(e) => { stop(e); onDeleteFunctionOutput(id, output.id); }}
                onMouseDown={stop}
                className="ml-1 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-300 text-xs w-4 h-4 flex items-center justify-center transition-opacity flex-shrink-0"
              >
                ×
              </button>
              <Handle
                type="source" position={Position.Right} id={`${output.id}-source`}
                style={{
                  right: -5, top: '50%', transform: 'translateY(-50%)',
                  position: 'absolute', background: colors.handleFill,
                  border: `2px solid ${colors.handleBorder}`, width: 8, height: 8,
                }}
              />
            </div>
          ))}
          <button
            onClick={(e) => { stop(e); onAddFunctionOutput(id); }}
            onMouseDown={stop}
            className="mx-3 mt-1 text-xs flex items-center gap-1 transition-colors"
            style={{ color: '#4ade80' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#86efac'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#4ade80'; }}
          >
            + add output
          </button>
        </div>
      </div>
    </div>
  );
}
