import React, { useState, useCallback, useMemo } from 'react';
import { Handle, Position } from 'reactflow';
import { activeDrag, setActiveDrag } from './dragState';

const DRAG_TYPE = 'application/lineage-attr';

function EditableText({ value, onChange, className, placeholder }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const startEdit = (e) => {
    e.stopPropagation();
    setDraft(value);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onChange(trimmed);
    else setDraft(value);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') { setDraft(value); setEditing(false); }
    e.stopPropagation();
  };

  if (editing) {
    return (
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        placeholder={placeholder}
        className={`bg-transparent border-b border-emerald-400 outline-none ${className}`}
        style={{ minWidth: 60, width: Math.max(draft.length * 8, 60) }}
        autoFocus
      />
    );
  }

  return (
    <span
      onDoubleClick={startEdit}
      className={`cursor-text select-none ${className}`}
      title="Double-click to edit"
    >
      {value || <span className="opacity-40">{placeholder}</span>}
    </span>
  );
}

export default function FunctionNode({ id, data }) {
  const {
    label, inputs, outputs,
    onLabelChange,
    onFunctionInputDrop,
    onDeleteFunctionInput,
    onAddFunctionOutput,
    onDeleteFunctionOutput,
    onFunctionOutputChange,
  } = data;

  const [inputsDragOver, setInputsDragOver] = useState(false);

  const groupedInputs = useMemo(() => {
    const groups = new Map();
    for (const inp of inputs) {
      const key = inp.sourceNodeLabel || inp.sourceNodeId;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(inp);
    }
    return [...groups.entries()];
  }, [inputs]);

  // ── Input panel drag handlers ─────────────────────────────────────────

  const onInputPanelDragOver = useCallback((e) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
    if (activeDrag?.sourceNodeId === id) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setInputsDragOver(true);
  }, [id]);

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

  // ── Output attr drag (to link to other nodes) ─────────────────────────

  const onOutputDragStart = useCallback((e, output) => {
    e.stopPropagation();
    const drag = { sourceNodeId: id, attrId: output.id, attrName: output.name, sourceNodeLabel: label };
    setActiveDrag(drag);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(drag));
  }, [id, label]);

  const onOutputDragEnd = useCallback(() => {
    setActiveDrag(null);
  }, []);

  const stop = (e) => e.stopPropagation();

  return (
    <div
      className="rounded-lg overflow-visible shadow-xl"
      style={{
        background: '#052e16',
        border: '1px solid #166534',
        minWidth: 360,
      }}
      onContextMenu={stop}
    >
      {/* Header */}
      <div
        className="px-3 py-2 border-b border-emerald-900 flex items-center gap-2 cursor-grab active:cursor-grabbing"
        style={{ background: '#14532d' }}
      >
        <span className="text-emerald-400 font-mono text-sm select-none font-bold">ƒ</span>
        <EditableText
          value={label}
          onChange={(val) => onLabelChange(id, val)}
          className="text-white font-semibold text-sm flex-1"
          placeholder="function_name"
        />
      </div>

      {/* Body */}
      <div className="flex" style={{ minHeight: 72 }}>

        {/* LEFT: Inputs */}
        <div
          className="py-1 transition-colors"
          style={{
            flex: '1 1 0',
            borderRight: '1px solid rgba(22,101,52,0.5)',
            background: inputsDragOver ? 'rgba(16,185,129,0.08)' : undefined,
            outline: inputsDragOver ? '2px dashed #10b981' : 'none',
            outlineOffset: -2,
          }}
          onDragOver={onInputPanelDragOver}
          onDragLeave={onInputPanelDragLeave}
          onDrop={onInputPanelDrop}
        >
          <div className="px-3 pb-0.5 text-xs text-emerald-700 uppercase tracking-wider font-semibold">
            Inputs
          </div>

          {inputs.length === 0 && (
            <div className="px-3 py-2 text-xs italic" style={{ color: '#166534' }}>
              {inputsDragOver ? 'Drop to add input' : 'Drop columns here'}
            </div>
          )}

          {inputsDragOver && inputs.length > 0 && (
            <div className="px-3 py-0.5 text-xs text-emerald-500 text-center">+ drop to add</div>
          )}

          {groupedInputs.map(([groupLabel, groupItems]) => (
            <div key={groupLabel}>
              <div
                className="px-3 py-0.5 flex items-center gap-1 select-none"
                style={{ color: '#4ade80', fontSize: 10 }}
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600 flex-shrink-0" />
                <span className="truncate font-medium">{groupLabel}</span>
              </div>

              {groupItems.map((inp) => (
                <div
                  key={inp.id}
                  className="relative flex items-center group hover:bg-emerald-900/30 transition-colors"
                  style={{ paddingLeft: 22, paddingRight: 8, minHeight: 24 }}
                >
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={`${inp.id}-target`}
                    style={{
                      left: -5, top: '50%', transform: 'translateY(-50%)',
                      position: 'absolute', background: '#10b981',
                      border: '2px solid #052e16', width: 8, height: 8,
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

        {/* RIGHT: Outputs */}
        <div
          className="py-1"
          style={{ flex: '1 1 0' }}
          onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) e.stopPropagation(); }}
        >
          <div className="px-3 pb-0.5 text-xs text-emerald-700 uppercase tracking-wider font-semibold">
            Outputs
          </div>

          {outputs.length === 0 && (
            <div className="px-3 py-2 text-xs italic" style={{ color: '#166534' }}>No outputs yet</div>
          )}

          {outputs.map((output) => (
            <div
              key={output.id}
              draggable
              onMouseDown={stop}
              onDragStart={(e) => onOutputDragStart(e, output)}
              onDragEnd={onOutputDragEnd}
              className="relative flex items-center group hover:bg-emerald-900/30 transition-colors cursor-grab active:cursor-grabbing"
              style={{ paddingLeft: 8, paddingRight: 22, minHeight: 24 }}
            >
              <EditableText
                value={output.name}
                onChange={(val) => onFunctionOutputChange(id, output.id, val)}
                className="text-emerald-100 text-xs flex-1"
                placeholder="output_col"
              />
              <button
                onClick={(e) => { stop(e); onDeleteFunctionOutput(id, output.id); }}
                onMouseDown={stop}
                className="ml-1 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-300 text-xs w-4 h-4 flex items-center justify-center transition-opacity flex-shrink-0"
              >
                ×
              </button>
              <Handle
                type="source"
                position={Position.Right}
                id={`${output.id}-source`}
                style={{
                  right: -5, top: '50%', transform: 'translateY(-50%)',
                  position: 'absolute', background: '#10b981',
                  border: '2px solid #052e16', width: 8, height: 8,
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
