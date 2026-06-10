import React, { useState, useMemo, useCallback } from 'react';
import { parseCreateTable, parseSqlSelect } from '../utils/sqlParser';

const PLACEHOLDER = `-- Paste a CREATE TABLE (typed columns) …
CREATE TABLE dim_region (
  region_id INT PRIMARY KEY,
  name      VARCHAR(80),
  country   VARCHAR(2)
);

-- … or a SELECT (projected column names)
SELECT order_id, sum(amount) AS total FROM orders GROUP BY order_id`;

// Parse pasted SQL into a previewable dataset. Tries CREATE TABLE first (typed),
// falls back to SELECT (names only → string).
function parse(sql) {
  const ddl = parseCreateTable(sql);
  if (ddl.columns.length) return { mode: 'ddl', tableName: ddl.tableName, columns: ddl.columns };
  const sel = parseSqlSelect(sql);
  return { mode: 'select', tableName: sel.tableName, columns: sel.columns.map((name) => ({ name, type: 'string' })) };
}

export default function CatalogImportModal({ sources, onImport, onClose }) {
  const [sql, setSql] = useState('');
  const [sourceId, setSourceId] = useState('');
  const parsed = useMemo(() => (sql.trim() ? parse(sql) : { mode: null, tableName: null, columns: [] }), [sql]);
  const ok = parsed.columns.length > 0;

  const handleImport = useCallback(() => {
    if (!ok) return;
    onImport({
      name: parsed.tableName || 'imported',
      columns: parsed.columns,
      sourceId: sourceId || null,
      origin: { kind: 'sql-ddl' },
    });
    onClose();
  }, [ok, parsed, sourceId, onImport, onClose]);

  const field = { background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 6, padding: '4px 8px', fontSize: 12, outline: 'none' };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="rounded-xl shadow-2xl flex flex-col" style={{ background: '#1e293b', border: '1px solid #334155', width: 600, maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); e.stopPropagation(); }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <span className="text-sm font-semibold text-slate-200">Import SQL → catalog</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-lg leading-none">×</button>
        </div>

        <div className="px-4 py-3 flex-1 overflow-y-auto min-h-0 space-y-3">
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            placeholder={PLACEHOLDER}
            spellCheck={false}
            className="w-full font-mono text-xs"
            style={{ ...field, height: 200, resize: 'vertical', whiteSpace: 'pre', lineHeight: 1.6 }}
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Source:</span>
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} style={{ ...field, cursor: 'pointer' }}>
              <option value="">— none —</option>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {ok && (
            <div className="rounded-lg p-3" style={{ background: '#0f172a', border: '1px solid #334155' }}>
              <div className="text-xs text-slate-400 mb-1">
                Detected <span style={{ color: '#60a5fa' }}>{parsed.mode === 'ddl' ? 'CREATE TABLE' : 'SELECT'}</span>
                {parsed.tableName ? <> → <span className="font-mono text-slate-200">{parsed.tableName}</span></> : null}
                {parsed.mode === 'select' && <span className="text-slate-500"> (types default to string)</span>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {parsed.columns.map((c, i) => (
                  <span key={i} className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ background: '#1e293b', color: '#cbd5e1' }}>
                    {c.name}<span style={{ color: '#475569' }}>:{c.type}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-700">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300">Cancel</button>
          <button onClick={handleImport} disabled={!ok} className="px-3 py-1.5 text-xs font-medium rounded-lg text-white disabled:opacity-40" style={{ background: '#1d4ed8' }}>
            Import {ok ? `(${parsed.columns.length} cols)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
