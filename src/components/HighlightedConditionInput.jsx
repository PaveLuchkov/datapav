import React, { useState, useRef, useEffect, useMemo } from 'react';

function buildBackdropHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /@(\w+)/g,
      '<mark style="background:rgba(251,146,60,0.25);color:transparent;border-radius:2px;padding:0 1px">@$1</mark>'
    );
}

// Textarea with @word syntax highlighting via backdrop overlay.
// fieldStyle must include: background, border, color, fontSize, padding,
// fontFamily, lineHeight, borderRadius so backdrop matches layout exactly.
export default function HighlightedConditionInput({
  defaultValue, onChange, placeholder, fieldStyle, onClick, onMouseDown,
}) {
  const [text, setText] = useState(defaultValue || '');
  const taRef = useRef(null);
  const bdRef = useRef(null);

  // auto-resize on mount
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  const syncScroll = () => {
    if (bdRef.current && taRef.current) {
      bdRef.current.scrollTop = taRef.current.scrollTop;
    }
  };

  const handleInput = (e) => {
    const val = e.target.value;
    setText(val);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
    syncScroll();
    onChange(val);
  };

  const backdropHtml = useMemo(() => (text ? buildBackdropHtml(text) : ''), [text]);

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      {/* Backdrop: same layout as textarea, transparent text, marks with amber bg */}
      <div
        ref={bdRef}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: backdropHtml }}
        style={{
          ...fieldStyle,
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          overflow: 'hidden',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          pointerEvents: 'none',
          userSelect: 'none',
          color: 'transparent',
          zIndex: 0,
        }}
      />

      <textarea
        ref={taRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onInput={handleInput}
        onScroll={syncScroll}
        onClick={onClick}
        onMouseDown={onMouseDown}
        rows={1}
        placeholder={placeholder}
        style={{
          ...fieldStyle,
          background: 'transparent',
          position: 'relative',
          zIndex: 1,
        }}
      />
    </div>
  );
}
