import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ATTR_TYPE_META } from '../constants';

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

// Returns the partial word after @ at/before cursor, or null if not in an @-mention
function getAtMentionQuery(value, cursor) {
  const before = value.slice(0, cursor);
  const m = before.match(/@(\w*)$/);
  return m ? m[1] : null;
}

export default function HighlightedConditionInput({
  defaultValue, onChange, placeholder, fieldStyle, attrSuggestions = [], onClick, onMouseDown,
}) {
  const [text, setText] = useState(defaultValue || '');
  const [menuQuery, setMenuQuery] = useState(null); // null = closed, string = partial
  const [menuIdx, setMenuIdx]     = useState(0);
  const taRef = useRef(null);
  const bdRef = useRef(null);
  const menuRef = useRef(null);

  // auto-resize on mount
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  const syncScroll = useCallback(() => {
    if (bdRef.current && taRef.current)
      bdRef.current.scrollTop = taRef.current.scrollTop;
  }, []);

  // Filter suggestions based on current @partial
  const menuItems = useMemo(() => {
    if (menuQuery === null) return [];
    const q = menuQuery.toLowerCase();
    return attrSuggestions.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 12);
  }, [menuQuery, attrSuggestions]);

  // Scroll active item into view
  useEffect(() => {
    menuRef.current?.children[menuIdx]?.scrollIntoView({ block: 'nearest' });
  }, [menuIdx]);

  const closeMenu = useCallback(() => {
    setMenuQuery(null);
    setMenuIdx(0);
  }, []);

  const commitSuggestion = useCallback((attr) => {
    const ta = taRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart;
    const before = text.slice(0, cursor);
    const after  = text.slice(cursor);
    const newBefore = before.replace(/@(\w*)$/, `@${attr.name}`);
    const newText = newBefore + after;
    setText(newText);
    onChange(newText);
    closeMenu();
    // Restore focus & move cursor after inserted name
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newBefore.length, newBefore.length);
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    });
  }, [text, onChange, closeMenu]);

  const handleInput = useCallback((e) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart;
    setText(val);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
    syncScroll();
    onChange(val);
    // Check for @-mention
    const q = getAtMentionQuery(val, cursor);
    if (q !== null && attrSuggestions.length > 0) {
      setMenuQuery(q);
      setMenuIdx(0);
    } else {
      closeMenu();
    }
  }, [onChange, syncScroll, attrSuggestions, closeMenu]);

  const handleKeyDown = useCallback((e) => {
    if (menuItems.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault(); e.stopPropagation();
      setMenuIdx((i) => Math.min(i + 1, menuItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation();
      setMenuIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault(); e.stopPropagation();
      commitSuggestion(menuItems[menuIdx]);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      closeMenu();
    }
  }, [menuItems, menuIdx, commitSuggestion, closeMenu]);

  // Close menu when clicking outside
  const handleBlur = useCallback(() => {
    // Small delay so mousedown on menu item fires first
    setTimeout(closeMenu, 150);
  }, [closeMenu]);

  // Also close menu when cursor moves away from @mention
  const handleSelect = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    const q = getAtMentionQuery(ta.value, ta.selectionStart);
    if (q === null) closeMenu();
    else { setMenuQuery(q); setMenuIdx(0); }
  }, [closeMenu]);

  const backdropHtml = useMemo(() => (text ? buildBackdropHtml(text) : ''), [text]);
  const showMenu = menuItems.length > 0 && menuQuery !== null;

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      {/* Backdrop: provides background + @word highlights */}
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
        onKeyDown={handleKeyDown}
        onScroll={syncScroll}
        onBlur={handleBlur}
        onSelect={handleSelect}
        onClick={onClick}
        onMouseDown={onMouseDown}
        rows={1}
        placeholder={placeholder}
        style={{ ...fieldStyle, background: 'transparent', position: 'relative', zIndex: 1 }}
      />

      {/* @-mention autocomplete dropdown */}
      {showMenu && (
        <div
          ref={menuRef}
          className="overflow-y-auto"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            minWidth: '100%',
            maxHeight: 200,
            marginTop: 2,
            background: '#1c0902',
            border: '1px solid #9a3412',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            zIndex: 100,
          }}
        >
          {menuItems.map((attr, i) => {
            const meta = ATTR_TYPE_META[attr.type] || ATTR_TYPE_META.string;
            return (
              <div
                key={attr.name}
                onMouseDown={(e) => { e.preventDefault(); commitSuggestion(attr); }}
                onMouseEnter={() => setMenuIdx(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 10px',
                  cursor: 'pointer',
                  background: i === menuIdx ? 'rgba(251,146,60,0.15)' : 'transparent',
                  borderLeft: i === menuIdx ? '2px solid #fb923c' : '2px solid transparent',
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', color: '#fed7aa' }}>
                  @{attr.name}
                </span>
                <span style={{
                  fontSize: 9,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: meta.color,
                  background: meta.bg,
                  borderRadius: 3,
                  padding: '1px 4px',
                  marginLeft: 8,
                  flexShrink: 0,
                }}>
                  {meta.abbr}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
