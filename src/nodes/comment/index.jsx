import React, { useCallback, useRef } from 'react';
import { NOTE_PALETTE } from './config';

export default function CommentNode({ id, data }) {
  const { text, color, onCommentTextChange, onCommentColorChange } = data;
  const palette = NOTE_PALETTE.find((p) => p.key === color) || NOTE_PALETTE[0];
  const stop = (e) => e.stopPropagation();

  const debounceRef = useRef(null);
  const onTextInput = useCallback((e) => {
    const val = e.target.value;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onCommentTextChange(id, val), 300);
  }, [id, onCommentTextChange]);

  return (
    <div
      className="rounded-lg shadow-xl overflow-visible"
      style={{
        background: palette.bg,
        border: `2px solid ${palette.border}`,
        minWidth: 180,
        minHeight: 100,
      }}
      onContextMenu={stop}
    >
      {/* Color picker bar */}
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 border-b cursor-grab active:cursor-grabbing"
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
              width: 12,
              height: 12,
              background: p.bg,
              border: `2px solid ${p.border}`,
              outline: color === p.key ? `2px solid ${p.border}` : 'none',
              outlineOffset: 1,
            }}
          />
        ))}
        <span
          className="ml-auto text-xs font-semibold select-none opacity-40"
          style={{ color: palette.text }}
        >
          ✎
        </span>
      </div>

      {/* Text area */}
      <textarea
        defaultValue={text}
        onInput={onTextInput}
        onChange={() => {}}
        onClick={stop}
        onMouseDown={stop}
        placeholder="Add a note..."
        rows={4}
        className="w-full resize-none outline-none text-sm px-2.5 py-2 bg-transparent placeholder-opacity-40"
        style={{
          color: palette.text,
          caretColor: palette.border,
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
}
