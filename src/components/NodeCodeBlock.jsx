import React from 'react';

export default function NodeCodeBlock({ nodeId, code, onCodeChange, borderColor }) {
  return (
    <div style={{ borderTop: `1px solid ${borderColor}` }}>
      <textarea
        value={code || ''}
        onChange={(e) => onCodeChange(nodeId, e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder="# code snippet…"
        rows={4}
        style={{
          display: 'block',
          width: '100%',
          boxSizing: 'border-box',
          background: 'rgba(0,0,0,0.35)',
          color: '#94a3b8',
          caretColor: '#cbd5e1',
          fontSize: '0.7rem',
          lineHeight: 1.6,
          padding: '6px 10px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          outline: 'none',
          resize: 'vertical',
          border: 'none',
          borderRadius: '0 0 8px 8px',
        }}
      />
    </div>
  );
}
