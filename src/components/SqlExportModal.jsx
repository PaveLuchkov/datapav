import React, { useCallback, useState } from 'react';

export default function SqlExportModal({ sql, onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(sql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [sql]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lineage-${new Date().toISOString().slice(0, 10)}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sql]);

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
        style={{ background: '#1e293b', border: '1px solid #334155', width: 660, maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <span className="text-sm font-semibold text-slate-200">Export SQL</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-lg leading-none">×</button>
        </div>

        <div className="px-4 pt-3 pb-1 flex-1 overflow-y-auto min-h-0">
          <pre
            className="w-full rounded-lg text-xs font-mono p-3 overflow-auto"
            style={{
              background: '#0f172a',
              border: '1px solid #334155',
              color: '#e2e8f0',
              lineHeight: 1.7,
              maxHeight: '55vh',
              whiteSpace: 'pre',
            }}
          >
            {sql}
          </pre>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
          >
            ⬇ Download .sql
          </button>
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
            style={{ background: copied ? '#15803d' : '#1d4ed8', color: '#fff' }}
          >
            {copied ? '✓ Copied!' : 'Copy to clipboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
