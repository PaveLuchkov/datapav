import React, { useState, useCallback } from 'react';
import { useDrag } from '../../components/DragContext';
import { NodeShell, NodeHeader, AttrRow, useTrackedAttr, useDragSource, useDropZone } from '../../components/node';
import { THEMES } from '../../theme';
import { DRAG_TYPE, ATTR_TYPES } from '../../constants';

const theme = THEMES.dataframe;

export default function DataFrameNode({ id, data }) {
  const {
    label, attributes, _companionOf, _proxy,
    onLabelChange, onAttributeChange, onAttributeTypeChange,
    onAddAttribute, onDeleteAttribute,
    onAttributeDrop, onReorderAttributes,
    onCodeChange, onStageChange, onTraceColumn,
    trackerHighlight, traceColName, code, stage,
  } = data;

  const [codeOpen, setCodeOpen] = useState(false);
  const [insertIndex, setInsertIndex] = useState(null);

  const isTrackedAttr = useTrackedAttr(trackerHighlight);
  const dragRef = useDrag();
  const { startDrag, endDrag } = useDragSource(id, label);
  // External column dropped onto the node → copy it and wire a lineage edge.
  const { dropOver, dragHandlers } = useDropZone(id, (payload) => onAttributeDrop(id, payload));

  // ── Same-node reorder (the insert-line drag) ───────────────────────────────
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

  // Subgraph proxies (_proxy) mirror the outer function's signature — read-only
  // like companions; their columns are refreshed from the function on drill-in.
  const readOnly = !!_companionOf || !!_proxy;

  return (
    <NodeShell
      nodeId={id}
      theme={theme}
      dragOver={dropOver}
      containerHandlers={dragHandlers}
      code={code}
      codeOpen={codeOpen}
      onCodeChange={onCodeChange}
    >
      <NodeHeader
        nodeId={id}
        label={label}
        theme={theme}
        onLabelChange={onLabelChange}
        labelPlaceholder="DataFrame"
        companionBadge={readOnly}
        stage={stage}
        onStageChange={onStageChange}
        codeOpen={codeOpen}
        onToggleCode={() => setCodeOpen((v) => !v)}
        onAdd={readOnly ? undefined : onAddAttribute}
      />

      {dropOver && (
        <div className="px-3 py-1 text-blue-300 text-xs text-center border-b border-blue-700 bg-blue-900/30">
          Drop to add &amp; link
        </div>
      )}

      <div className="py-1">
        {attributes.length === 0 && !dropOver && (
          <div className="px-3 py-1 text-blue-400 text-xs opacity-50 italic">No columns</div>
        )}

        {insertIndex === 0 && <InsertLine />}

        {attributes.map((attr, index) => (
          <React.Fragment key={attr.id}>
            <AttrRow
              attr={attr}
              tracked={isTrackedAttr(attr.name)}
              tracing={traceColName === attr.name}
              readOnly={readOnly}
              draggable
              rowHandlers={{
                onMouseDown: (e) => e.stopPropagation(),
                onDragStart: (e) => startDrag(e, { attrId: attr.id, attrName: attr.name, attrType: attr.type }),
                onDragEnd: () => { endDrag(); setInsertIndex(null); },
                onDragOver: (e) => onAttrDragOver(e, index),
                onDrop: onAttrDrop,
              }}
              onTypeCycle={() => {
                const idx = ATTR_TYPES.indexOf(attr.type || 'string');
                onAttributeTypeChange(id, attr.id, ATTR_TYPES[(idx + 1) % ATTR_TYPES.length]);
              }}
              onRename={(val) => onAttributeChange(id, attr.id, val)}
              onTrace={onTraceColumn ? () => onTraceColumn(id, attr.name) : undefined}
              onDelete={() => onDeleteAttribute(id, attr.id)}
            />
            {insertIndex === index + 1 && <InsertLine />}
          </React.Fragment>
        ))}
      </div>
    </NodeShell>
  );
}

function InsertLine() {
  return (
    <div className="relative flex items-center px-3" style={{ height: 4 }}>
      <div className="w-full h-0.5 rounded-full bg-blue-400" />
    </div>
  );
}
