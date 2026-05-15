import React from 'react';

export default function ColumnSelect({
  value,
  onChange,
  columns = [],
  placeholder = '— column —',
  emptyPlaceholder = 'connect a df first',
  selectStyle,
  inputStyle,
  stop,
}) {
  if (columns.length > 0) {
    return (
      <select
        value={value || ''}
        onChange={(e) => { e.stopPropagation(); onChange(e.target.value); }}
        onMouseDown={stop}
        style={selectStyle}
      >
        <option value="">{placeholder}</option>
        {columns.map((c) => (
          <option key={c.id || c.name} value={c.name}>{c.name}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      onClick={stop}
      onMouseDown={stop}
      onKeyDown={stop}
      placeholder={emptyPlaceholder}
      style={inputStyle}
    />
  );
}
