import { useState, useRef } from 'react';

export default function EditableText({ value, onChange, className, placeholder, borderColorClass = 'border-blue-400' }) {
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
        className={`bg-transparent border-b outline-none ${borderColorClass} ${className}`}
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
