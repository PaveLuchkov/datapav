import React, { useState, useCallback, useMemo } from 'react';
import { parseSqlSelect } from '../utils/sqlParser';
import { ATTR_TYPE_META } from '../constants';

const PLACEHOLDER = `-- Paste your SELECT query here
SELECT
    order_id,
    toDate(created_at) AS order_date,
    sum(amount)        AS total_amount,
    count()            AS cnt
FROM orders
WHERE status = 'active'
GROUP BY order_id, order_date`;

export default function SqlImportModal({ onClose, onImport }) {
  const [sql, setSql] = useState('');

  const { columns, tableName } = useMemo(() => {
    if (!sql.trim()) return { columns: [], tableName: null };
    return parseSqlSelect(sql);
  }, [sql]);

  const hasResult = columns.length > 0;

  const handleImport = useCallback(() => {
    if (!hasResult) return;
    onImport({ columns, tableName });
    onClose();
  }, [columns, tableName, hasResult, onImport, onClose]);

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
    e.stopPropagation();
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl shadow-2xl flex flex-col"
        style={{ background: '#1e293b', border: '1px solid #334155', width: 560, maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <span className="text-sm font-semibold text-slate-200">Import from SQL</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-lg leading-none">×</button>
        </div>

        {/* SQL textarea */}
        <div className="px-4 pt-3">
          <textarea
            autoFocus
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            placeholder={PLACEHOLDER}
            spellCheck={false}
            rows={10}
            className="w-full rounded-lg text-xs font-mono resize-none outline-none p-3"
            style={{
              background: '#0f172a',
              border: '1px solid #334155',
              color: '#e2e8f0',
              caretColor: '#60a5fa',
              lineHeight: 1.6,
            }}
          />
        </div>

        {/* Preview */}
        <div className="px-4 pt-2 pb-3 flex-1 overflow-y-auto">
          {!sql.trim() && (
            <p className="text-xs text-slate-500 italic">Paste a SELECT query to preview the columns.</p>
          )}
          {sql.trim() && !hasResult && (
            <p className="text-xs text-amber-500">
              No columns detected — make sure the query starts with SELECT and columns have aliases for expressions.
            </p>
          )}
          {hasResult && (
            <>
              <p className="text-xs text-slate-400 mb-2">
                Will create <span className="text-white font-medium">{tableName || 'query_result'}</span> with {columns.length} column{columns.length !== 1 ? 's' : ''}:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {columns.map((col) => (
                  <span
                    key={col}
                    className="px-2 py-0.5 rounded text-xs font-mono"
                    style={{
                      background: 'rgba(30,58,138,0.4)',
                      border: '1px solid #1e3a8a',
                      color: ATTR_TYPE_META.string.color,
                    }}
                  >
                    {col}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!hasResult}
            className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
            style={hasResult
              ? { background: '#1d4ed8', color: '#fff' }
              : { background: '#1e293b', color: '#475569', cursor: 'not-allowed', border: '1px solid #334155' }
            }
          >
            Create node
          </button>
        </div>
      </div>
    </div>
  );
}
