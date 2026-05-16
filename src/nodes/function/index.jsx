import React, { useState, useCallback, useMemo } from 'react';
import { Handle, Position } from 'reactflow';
import { useDrag } from '../../components/DragContext';
import EditableText from '../../components/EditableText';
import StageBadge from '../../components/StageBadge';
import NodeCodeBlock from '../../components/NodeCodeBlock';
import { DRAG_TYPE, ATTR_TYPES, ATTR_TYPE_META } from '../../constants';
import config from './config';

const { colors } = config;
const ROW_HEIGHT = 24;

export default function FunctionNode({ id, data }) {
  const {
    label, inputs, outputs, connectedDFs, companionId,
    onLabelChange,
    onFunctionInputDrop,
    onDeleteFunctionInput,
    onAddFunctionOutput,
    onDeleteFunctionOutput,
    onFunctionOutputChange,
    onFunctionOutputTypeChange,
    onFunctionOutputLinkChange,
    onCodeChange, onStageChange, onCreateCompanion,
    trackerHighlight, code, stage,
  } = data;

  const [codeOpen, setCodeOpen] = useState(false);

  const isTrackedAttr = (name) => {
    if (!trackerHighlight?.query) return false;
    const t = name.toLowerCase();
    return trackerHighlight.wholeWord ? t === trackerHighlight.query : t.includes(trackerHighlight.query);
  };

  const dragRef = useDrag();
  const [inputsDragOver, setInputsDragOver] = useState(false);

  const allGroups = useMemo(() => {
    const map = new Map(); // sourceNodeId → { label, items }
    for (const df of (connectedDFs || [])) {
      map.set(df.sourceNodeId, { label: df.sourceNodeLabel, items: [] });
    }
    for (const inp of inputs) {
      if (!map.has(inp.sourceNodeId)) {
        map.set(inp.sourceNodeId, { label: inp.sourceNodeLabel || inp.sourceNodeId, items: [] });
      }
      map.get(inp.sourceNodeId).items.push(inp);
    }
    return [...map.values()];
  }, [connectedDFs, inputs]);

  const onInputPanelDragOver = useCallback((e) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
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
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return;
    const payload = JSON.parse(raw);
    if (payload.sourceNodeId === id) return;
    onFunctionInputDrop(id, payload);
  }, [id, onFunctionInputDrop]);

  const onOutputDragStart = useCallback((e, output) => {
    e.stopPropagation();
    const drag = { sourceNodeId: id, attrId: output.id, attrName: output.name, attrType: output.type || 'string', sourceNodeLabel: label };
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
      <Handle
        type="target" id="df-in" position={Position.Left}
        style={{ top: 14, background: colors.handleFill, border: `2px solid ${colors.handleBorder}`, width: 8, height: 8, borderRadius: 2 }}
      />
      <Handle
        type="source" id="df-out" position={Position.Right}
        style={{ top: 14, background: colors.handleFill, border: `2px solid ${colors.handleBorder}`, width: 8, height: 8, borderRadius: 2 }}
      />
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
        <StageBadge nodeId={id} stage={stage} onStageChange={onStageChange} />
        <button
          onClick={(e) => { e.stopPropagation(); setCodeOpen((v) => !v); }}
          onMouseDown={(e) => e.stopPropagation()}
          title="Toggle code snippet"
          className="flex-shrink-0 select-none transition-opacity hover:opacity-100 font-mono"
          style={{ fontSize: 10, color: colors.handleFill, opacity: codeOpen ? 1 : 0.4 }}
        >
          {codeOpen ? '[/]' : '</>'}
        </button>
        {/* Companion button */}
        <button
          onClick={(e) => { e.stopPropagation(); if (!companionId) onCreateCompanion(id); }}
          onMouseDown={(e) => e.stopPropagation()}
          title={companionId ? 'Output companion exists' : 'Create output DataFrame'}
          className="flex-shrink-0 select-none text-xs font-mono transition-colors"
          style={{ color: companionId ? colors.handleFill : 'rgba(74,222,128,0.25)' }}
        >
          {companionId ? '→●' : '→○'}
        </button>
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
            <div key={group.label}>
              <div className="px-3 py-0.5 flex items-center gap-1 select-none" style={{ color: '#4ade80', fontSize: 10 }}>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600 flex-shrink-0" />
                <span className="truncate font-medium">{group.label}</span>
              </div>
              {group.items.length === 0 && (
                <div className="px-3 py-1 text-xs italic" style={{ color: colors.border, paddingLeft: 22 }}>
                  drag columns to add
                </div>
              )}
              {group.items.map((inp) => {
                const tracked = isTrackedAttr(inp.attrName);
                return (
                <div
                  key={inp.id}
                  className="relative flex items-center group hover:bg-emerald-900/30 transition-colors"
                  style={{
                    paddingLeft: 22, paddingRight: 8, minHeight: ROW_HEIGHT,
                    background: tracked ? 'rgba(245,158,11,0.08)' : undefined,
                  }}
                >
                  <Handle
                    type="target" position={Position.Left} id={`${inp.id}-target`}
                    style={{
                      left: -5, top: '50%', transform: 'translateY(-50%)',
                      position: 'absolute', background: colors.handleFill,
                      border: `2px solid ${colors.handleBorder}`, width: 8, height: 8,
                    }}
                  />
                  <TypeBadge type={inp.attrType || 'string'} />
                  <span
                    className="text-xs flex-1 truncate"
                    style={{ color: tracked ? '#fcd34d' : '#d1fae5', fontWeight: tracked ? 700 : undefined }}
                  >{inp.attrName}</span>
                  <button
                    onClick={(e) => { stop(e); onDeleteFunctionInput(id, inp.id); }}
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

        <div
          className="py-1"
          style={{ flex: '1 1 0' }}
          onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) e.stopPropagation(); }}
        >
          <div className="px-3 pb-0.5 text-xs text-emerald-700 uppercase tracking-wider font-semibold">Outputs</div>
          {outputs.length === 0 && (
            <div className="px-3 py-2 text-xs italic" style={{ color: colors.border }}>No outputs yet</div>
          )}
          {outputs.map((output) => {
            const tracked = isTrackedAttr(output.name);
            const isLinked = !!(output.fromInputId && inputs.find((i) => i.id === output.fromInputId));
            return (
            <div
              key={output.id}
              draggable
              onMouseDown={stop}
              onDragStart={(e) => onOutputDragStart(e, output)}
              onDragEnd={onOutputDragEnd}
              className="relative flex items-center group hover:bg-emerald-900/30 transition-colors cursor-grab active:cursor-grabbing"
              style={{
                paddingLeft: 8, paddingRight: 22, minHeight: ROW_HEIGHT,
                background: tracked ? 'rgba(245,158,11,0.08)' : undefined,
              }}
            >
              {/* Link select: pick an input to wire this output to for tracing */}
              <select
                value={output.fromInputId || ''}
                onChange={(e) => { stop(e); onFunctionOutputLinkChange(id, output.id, e.target.value || null); }}
                onMouseDown={stop}
                title={isLinked ? 'Linked to input — click to change' : 'Link to input for lineage tracing'}
                className="flex-shrink-0 rounded outline-none cursor-pointer"
                style={{
                  fontSize: 9, padding: '1px 2px', marginRight: 4,
                  background: isLinked ? 'rgba(16,185,129,0.15)' : 'transparent',
                  border: `1px solid ${isLinked ? colors.handleFill : '#166534'}`,
                  color: isLinked ? colors.handleFill : '#4ade8066',
                  maxWidth: 64,
                }}
              >
                <option value="">∅ new</option>
                {inputs.map((inp) => (
                  <option key={inp.id} value={inp.id}>{inp.attrName}</option>
                ))}
              </select>
              <TypeBadge
                type={output.type}
                onClick={(e) => {
                  stop(e);
                  const idx = ATTR_TYPES.indexOf(output.type);
                  onFunctionOutputTypeChange(id, output.id, ATTR_TYPES[(idx + 1) % ATTR_TYPES.length]);
                }}
              />
              <EditableText
                value={output.name}
                onChange={(val) => onFunctionOutputChange(id, output.id, val)}
                className={tracked ? 'text-amber-300 text-xs flex-1 font-bold' : 'text-emerald-100 text-xs flex-1'}
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
            );
          })}
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
      {codeOpen && <NodeCodeBlock nodeId={id} code={code} onCodeChange={onCodeChange} borderColor={colors.border} />}
    </div>
  );
}

function TypeBadge({ type, onClick }) {
  const meta = ATTR_TYPE_META[type] || ATTR_TYPE_META.string;
  return (
    <span
      onClick={onClick}
      onMouseDown={(e) => e.stopPropagation()}
      title={`Type: ${type}${onClick ? ' — click to change' : ''}`}
      className={`mr-1.5 rounded select-none flex-shrink-0 ${onClick ? 'cursor-pointer transition-opacity hover:opacity-80' : 'cursor-default'}`}
      style={{
        fontSize: 9,
        lineHeight: '14px',
        padding: '0 4px',
        color: meta.color,
        background: meta.bg,
        fontFamily: 'monospace',
      }}
    >
      {meta.abbr}
    </span>
  );
}
