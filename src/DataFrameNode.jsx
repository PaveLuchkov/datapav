import React, { useState, useCallback, useRef } from 'react';
import { Handle, Position } from 'reactflow';

const DRAG_TYPE = 'application/lineage-attr';

// Module-level: track what's being dragged so dragOver can distinguish same-node vs cross-node
let activeDrag = null;

function EditableText({ value, onChange, className, placeholder }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  const startEdit = (e) => {
    e.stopPropagation();
    setDraft(value);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
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
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        placeholder={placeholder}
        className={`bg-transparent border-b border-blue-400 outline-none ${className}`}
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

export default function DataFrameNode({ id, data }) {
  const {
    label, attributes,
    onLabelChange, onAttributeChange, onAddAttribute, onDeleteAttribute,
    onAttributeDrop, onReorderAttributes,
  } = data;

  const [isDragOver, setIsDragOver] = useState(false);
  // insertIndex: where the reorder line shows (0 = before first, attrs.length = after last)
  const [insertIndex, setInsertIndex] = useState(null);

  const handleAddAttribute = useCallback((e) => {
    e.stopPropagation();
    onAddAttribute(id);
  }, [id, onAddAttribute]);

  const handleDeleteAttribute = useCallback((e, attrId) => {
    e.stopPropagation();
    onDeleteAttribute(id, attrId);
  }, [id, onDeleteAttribute]);

  // ── Attribute row events ────────────────────────────────────────────────

  const onAttrDragStart = useCallback((e, attr) => {
    e.stopPropagation();
    activeDrag = { sourceNodeId: id, attrId: attr.id, attrName: attr.name };
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(activeDrag));
  }, [id]);

  const onAttrDragEnd = useCallback(() => {
    activeDrag = null;
    setInsertIndex(null);
  }, []);

  const onAttrDragOver = useCallback((e, index) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
    if (activeDrag?.sourceNodeId !== id) return; // cross-node drag — let it bubble up to node container

    e.preventDefault();
    e.stopPropagation(); // prevent node container from showing "Drop to add & link"

    const rect = e.currentTarget.getBoundingClientRect();
    const isBefore = e.clientY < rect.top + rect.height / 2;
    setInsertIndex(isBefore ? index : index + 1);
  }, [id]);

  const onAttrDrop = useCallback((e) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
    if (activeDrag?.sourceNodeId !== id) return; // let node container handle cross-node

    e.preventDefault();
    e.stopPropagation();

    const payload = JSON.parse(e.dataTransfer.getData(DRAG_TYPE));
    const fromIndex = attributes.findIndex((a) => a.id === payload.attrId);
    const to = insertIndex ?? attributes.length;

    if (fromIndex !== -1 && to !== fromIndex && to !== fromIndex + 1) {
      onReorderAttributes(id, fromIndex, to);
    }
    setInsertIndex(null);
  }, [id, attributes, insertIndex, onReorderAttributes]);

  // ── Node container events (cross-node drops only) ───────────────────────

  const onNodeDragOver = useCallback((e) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
    if (activeDrag?.sourceNodeId === id) return; // same-node handled by rows above
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, [id]);

  const onNodeDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false);
  }, []);

  const onNodeDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return;
    const payload = JSON.parse(raw);
    if (payload.sourceNodeId === id) return;
    onAttributeDrop(id, payload);
  }, [id, onAttributeDrop]);

  return (
    <div
      className="rounded-lg overflow-visible shadow-xl transition-all"
      style={{
        background: '#0f2744',
        minWidth: 200,
        border: isDragOver ? '2px solid #60a5fa' : '1px solid #1e4d8c',
        boxShadow: isDragOver ? '0 0 0 3px rgba(96,165,250,0.25)' : undefined,
      }}
      onContextMenu={(e) => e.stopPropagation()}
      onDragOver={onNodeDragOver}
      onDragLeave={onNodeDragLeave}
      onDrop={onNodeDrop}
    >
      {/* Node-level handles for Merge connections (teal squares, top corners) */}
      <Handle
        type="target" id="df-in" position={Position.Left}
        style={{ top: 14, background: '#0d9488', border: '2px solid #042f2e', width: 8, height: 8, borderRadius: 2 }}
      />
      <Handle
        type="source" id="df-out" position={Position.Right}
        style={{ top: 14, background: '#0d9488', border: '2px solid #042f2e', width: 8, height: 8, borderRadius: 2 }}
      />

      {/* Header */}
      <div
        className="px-3 py-2 border-b border-blue-900 flex items-center justify-between cursor-grab active:cursor-grabbing"
        style={{ background: '#1a3a5c' }}
      >
        <EditableText
          value={label}
          onChange={(val) => onLabelChange(id, val)}
          className="text-white font-semibold text-sm"
          placeholder="DataFrame"
        />
        <button
          onClick={handleAddAttribute}
          onMouseDown={(e) => e.stopPropagation()}
          className="ml-2 text-blue-300 hover:text-white text-xs font-bold leading-none w-5 h-5 flex items-center justify-center rounded hover:bg-blue-700 transition-colors"
          title="Add attribute"
        >
          +
        </button>
      </div>

      {isDragOver && (
        <div className="px-3 py-1 text-blue-300 text-xs text-center border-b border-blue-700 bg-blue-900/30">
          Drop to add & link
        </div>
      )}

      {/* Attributes */}
      <div className="py-1">
        {attributes.length === 0 && !isDragOver && (
          <div className="px-3 py-1 text-blue-400 text-xs opacity-50 italic">No columns</div>
        )}

        {insertIndex === 0 && <InsertLine />}

        {attributes.map((attr, index) => (
          <React.Fragment key={attr.id}>
            <div
              draggable
              onMouseDown={(e) => e.stopPropagation()}
              onDragStart={(e) => onAttrDragStart(e, attr)}
              onDragEnd={onAttrDragEnd}
              onDragOver={(e) => onAttrDragOver(e, index)}
              onDrop={onAttrDrop}
              className="relative flex items-center group hover:bg-blue-900/30 transition-colors cursor-grab active:cursor-grabbing"
              style={{ paddingLeft: 14, paddingRight: 14, minHeight: 28 }}
            >
              <Handle
                type="target"
                position={Position.Left}
                id={`${attr.id}-target`}
                style={{ left: -5, top: '50%', transform: 'translateY(-50%)', position: 'absolute' }}
              />

              <span className="text-blue-600 mr-1.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity select-none">⠿</span>

              <EditableText
                value={attr.name}
                onChange={(val) => onAttributeChange(id, attr.id, val)}
                className="text-blue-100 text-xs flex-1"
                placeholder="column"
              />

              <button
                onClick={(e) => handleDeleteAttribute(e, attr.id)}
                onMouseDown={(e) => e.stopPropagation()}
                className="ml-1 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-300 text-xs w-4 h-4 flex items-center justify-center transition-opacity"
                title="Delete attribute"
              >
                ×
              </button>

              <Handle
                type="source"
                position={Position.Right}
                id={`${attr.id}-source`}
                style={{ right: -5, top: '50%', transform: 'translateY(-50%)', position: 'absolute' }}
              />
            </div>

            {insertIndex === index + 1 && <InsertLine />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function InsertLine() {
  return (
    <div className="relative flex items-center px-3" style={{ height: 4 }}>
      <div className="w-full h-0.5 rounded-full bg-blue-400" />
    </div>
  );
}
