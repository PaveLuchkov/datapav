import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NodeResizer } from 'reactflow';
import { NOTE_PALETTE } from './config';

function buildBackdropHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /@(\w+)/g,
      '<mark style="background:rgba(251,146,60,0.35);color:transparent;border-radius:2px;padding:0 1px">@$1</mark>'
    );
}

export default function CommentNode({ id, data, selected }) {
  const { text, color, onCommentTextChange, onCommentColorChange } = data;
  const palette = NOTE_PALETTE.find((p) => p.key === color) || NOTE_PALETTE[0];
  const stop = (e) => e.stopPropagation();

  const [localText, setLocalText] = useState(text || '');
  const bdRef = useRef(null);
  const taRef = useRef(null);
  const debounceRef = useRef(null);

  // Sync when state is loaded externally (e.g. load from file)
  useEffect(() => { setLocalText(text || ''); }, [text]);

  const syncScroll = useCallback(() => {
    if (bdRef.current && taRef.current)
      bdRef.current.scrollTop = taRef.current.scrollTop;
  }, []);

  const onTextInput = useCallback((e) => {
    const val = e.target.value;
    setLocalText(val);
    syncScroll();
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onCommentTextChange(id, val), 300);
  }, [id, onCommentTextChange, syncScroll]);

  const backdropHtml = useMemo(() => (localText ? buildBackdropHtml(localText) : ''), [localText]);

  const fieldStyle = {
    fontSize: '0.875rem',
    lineHeight: '1.5',
    padding: '8px 10px',
    fontFamily: 'inherit',
    resize: 'none',
    outline: 'none',
    boxSizing: 'border-box',
    width: '100%',
    height: '100%',
    display: 'block',
  };

  return (
    <>
      <NodeResizer
        color={palette.border}
        isVisible={selected}
        minWidth={200}
        minHeight={100}
        handleStyle={{ width: 8, height: 8, borderRadius: 2, border: `2px solid ${palette.border}` }}
        lineStyle={{ border: `1.5px dashed ${palette.border}`, opacity: 0.6 }}
      />
      <div
        className="rounded-lg shadow-xl flex flex-col overflow-hidden"
        style={{
          background: palette.bg,
          border: `2px solid ${palette.border}`,
          width: '100%',
          height: '100%',
          minWidth: 200,
          minHeight: 100,
          boxSizing: 'border-box',
        }}
        onContextMenu={stop}
      >
        {/* Color picker bar — fixed height, acts as drag handle */}
        <div
          className="flex items-center gap-1.5 px-2 py-1.5 border-b flex-shrink-0 cursor-grab active:cursor-grabbing"
          style={{ borderColor: palette.border }}
        >
          {NOTE_PALETTE.map((p) => (
            <button
              key={p.key}
              onClick={(e) => { stop(e); onCommentColorChange(id, p.key); }}
              onMouseDown={stop}
              title={p.key}
              className="rounded-full flex-shrink-0 transition-transform hover:scale-125"
              style={{
                width: 12, height: 12,
                background: p.bg,
                border: `2px solid ${p.border}`,
                outline: color === p.key ? `2px solid ${p.border}` : 'none',
                outlineOffset: 1,
              }}
            />
          ))}
          <span className="ml-auto text-xs font-semibold select-none opacity-40" style={{ color: palette.text }}>✎</span>
        </div>

        {/* Text area fills remaining height */}
        <div style={{ position: 'relative', flex: '1 1 0', overflow: 'hidden' }}>
          <div
            ref={bdRef}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: backdropHtml }}
            style={{
              ...fieldStyle,
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              background: palette.bg,
              color: 'transparent',
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              pointerEvents: 'none',
              userSelect: 'none',
              zIndex: 0,
            }}
          />
          <textarea
            ref={taRef}
            value={localText}
            onChange={(e) => setLocalText(e.target.value)}
            onInput={onTextInput}
            onScroll={syncScroll}
            onClick={stop}
            onMouseDown={stop}
            placeholder="Add a note…  use @attr to reference columns"
            style={{
              ...fieldStyle,
              background: 'transparent',
              color: palette.text,
              caretColor: palette.border,
              position: 'relative',
              zIndex: 1,
            }}
          />
        </div>
      </div>
    </>
  );
}
