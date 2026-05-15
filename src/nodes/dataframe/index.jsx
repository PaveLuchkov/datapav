import React, { useState, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { useDrag } from '../../components/DragContext';
import EditableText from '../../components/EditableText';
import { DRAG_TYPE, ATTR_TYPES, ATTR_TYPE_META } from '../../constants';
import config from './config';

const { colors } = config;
const ATTR_ROW_HEIGHT = 28;

export default function DataFrameNode({ id, data }) {
  const {
    label, attributes,
    onLabelChange, onAttributeChange, onAttributeTypeChange,
    onAddAttribute, onDeleteAttribute,
    onAttributeDrop, onReorderAttributes,
    trackerHighlight,
  } = data;

  const isTrackedAttr = (name) => {
    if (!trackerHighlight?.query) return false;
    const t = name.toLowerCase();
    return trackerHighlight.wholeWord ? t === trackerHighlight.query : t.includes(trackerHighlight.query);
  };

  const dragRef = useDrag();
  const [isDragOver, setIsDragOver] = useState(false);
  const [insertIndex, setInsertIndex] = useState(null);

  const handleAddAttribute = useCallback((e) => {
    e.stopPropagation();
    onAddAttribute(id);
  }, [id, onAddAttribute]);

  const handleDeleteAttribute = useCallback((e, attrId) => {
    e.stopPropagation();
    onDeleteAttribute(id, attrId);
  }, [id, onDeleteAttribute]);

  const onAttrDragStart = useCallback((e, attr) => {
    e.stopPropagation();
    const drag = { sourceNodeId: id, attrId: attr.id, attrName: attr.name, attrType: attr.type, sourceNodeLabel: label };
    dragRef.current = drag;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(drag));
  }, [id, label, dragRef]);

  const onAttrDragEnd = useCallback(() => {
    dragRef.current = null;
    setInsertIndex(null);
  }, [dragRef]);

  const onAttrDragOver = useCallback((e, index) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
    if (dragRef.current?.sourceNodeId !== id) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const isBefore = e.clientY < rect.top + rect.height / 2;
    setInsertIndex(isBefore ? index : index + 1);
  }, [id, dragRef]);

  const onAttrDrop = useCallback((e) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
    if (dragRef.current?.sourceNodeId !== id) return;
    e.preventDefault();
    e.stopPropagation();
    const payload = JSON.parse(e.dataTransfer.getData(DRAG_TYPE));
    const fromIndex = attributes.findIndex((a) => a.id === payload.attrId);
    const to = insertIndex ?? attributes.length;
    if (fromIndex !== -1 && to !== fromIndex && to !== fromIndex + 1) {
      onReorderAttributes(id, fromIndex, to);
    }
    setInsertIndex(null);
  }, [id, attributes, insertIndex, onReorderAttributes, dragRef]);

  const onNodeDragOver = useCallback((e) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
    if (dragRef.current?.sourceNodeId === id) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, [id, dragRef]);

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
        background: colors.bg,
        minWidth: 200,
        border: isDragOver ? '2px solid #60a5fa' : `1px solid ${colors.border}`,
        boxShadow: isDragOver ? '0 0 0 3px rgba(96,165,250,0.25)' : undefined,
      }}
      onContextMenu={(e) => e.stopPropagation()}
      onDragOver={onNodeDragOver}
      onDragLeave={onNodeDragLeave}
      onDrop={onNodeDrop}
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
        className="px-3 py-2 border-b border-blue-900 flex items-center justify-between cursor-grab active:cursor-grabbing"
        style={{ background: colors.header }}
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

      <div className="py-1">
        {attributes.length === 0 && !isDragOver && (
          <div className="px-3 py-1 text-blue-400 text-xs opacity-50 italic">No columns</div>
        )}

        {insertIndex === 0 && <InsertLine />}

        {attributes.map((attr, index) => {
          const tracked = isTrackedAttr(attr.name);
          return (
          <React.Fragment key={attr.id}>
            <div
              draggable
              onMouseDown={(e) => e.stopPropagation()}
              onDragStart={(e) => onAttrDragStart(e, attr)}
              onDragEnd={onAttrDragEnd}
              onDragOver={(e) => onAttrDragOver(e, index)}
              onDrop={onAttrDrop}
              className="relative flex items-center group hover:bg-blue-900/30 transition-colors cursor-grab active:cursor-grabbing"
              style={{
                paddingLeft: 14, paddingRight: 14, minHeight: ATTR_ROW_HEIGHT,
                background: tracked ? 'rgba(245,158,11,0.08)' : undefined,
              }}
            >
              <Handle
                type="target" position={Position.Left} id={`${attr.id}-target`}
                style={{ left: -5, top: '50%', transform: 'translateY(-50%)', position: 'absolute' }}
              />
              <span className="text-blue-600 mr-1.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity select-none">⠿</span>
              <TypeBadge
                type={attr.type || 'string'}
                onClick={(e) => {
                  e.stopPropagation();
                  const idx = ATTR_TYPES.indexOf(attr.type || 'string');
                  const next = ATTR_TYPES[(idx + 1) % ATTR_TYPES.length];
                  onAttributeTypeChange(id, attr.id, next);
                }}
              />
              <EditableText
                value={attr.name}
                onChange={(val) => onAttributeChange(id, attr.id, val)}
                className={tracked ? 'text-amber-300 text-xs flex-1 font-bold' : 'text-blue-100 text-xs flex-1'}
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
                type="source" position={Position.Right} id={`${attr.id}-source`}
                style={{ right: -5, top: '50%', transform: 'translateY(-50%)', position: 'absolute' }}
              />
            </div>
            {insertIndex === index + 1 && <InsertLine />}
          </React.Fragment>
          );
        })}
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

function TypeBadge({ type, onClick }) {
  const meta = ATTR_TYPE_META[type] || ATTR_TYPE_META.string;
  return (
    <span
      onClick={onClick}
      onMouseDown={(e) => e.stopPropagation()}
      title={`Type: ${type} — click to change`}
      className="mr-1.5 rounded cursor-pointer select-none flex-shrink-0 transition-opacity"
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
