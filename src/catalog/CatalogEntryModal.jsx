import React, { useState, useCallback } from 'react';
import { ATTR_TYPES } from '../constants';
import { uid } from '../utils/uid';

const blankCol = () => ({ _k: uid(), name: '', type: 'string', isKey: false });

// Create or edit a catalog entry (manual flow). `entry` is the existing entry to
// edit, or null to create. `sources` populates the source dropdown.
export default function CatalogEntryModal({ entry, sources, onSave, onClose }) {
  const [name, setName] = useState(entry?.name || '');
  const [sourceId, setSourceId] = useState(entry?.sourceId || '');
  const [aliases, setAliases] = useState((entry?.aliases || []).join(', '));
  const [tags, setTags] = useState((entry?.tags || []).join(', '));
  const [description, setDescription] = useState(entry?.description || '');
  const [columns, setColumns] = useState(
    (entry?.columns || []).map((c) => ({ _k: uid(), name: c.name, type: c.type || 'string', isKey: !!c.isKey })) || []
  );

  const updateCol = (k, patch) => setColumns((cs) => cs.map((c) => c._k === k ? { ...c, ...patch } : c));
  const addCol = () => setColumns((cs) => [...cs, blankCol()]);
  const removeCol = (k) => setColumns((cs) => cs.filter((c) => c._k !== k));

  const csv = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

  const handleSave = useCallback(() => {
    if (!name.trim()) return;
    const draft = {
      ...(entry || {}),
      name: name.trim(),
      sourceId: sourceId || null,
      aliases: csv(aliases),
      tags: csv(tags),
      description: description.trim(),
      columns: columns.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), type: c.type, isKey: c.isKey })),
    };
    onSave(draft);
    onClose();
  }, [name, sourceId, aliases, tags, description, columns, entry, onSave, onClose]);

  const field = { background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 6, padding: '4px 8px', fontSize: 12, outline: 'none' };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="rounded-xl shadow-2xl flex flex-col" style={{ background: '#1e293b', border: '1px solid #334155', width: 560, maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); e.stopPropagation(); }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <span className="text-sm font-semibold text-slate-200">{entry ? 'Edit dataset' : 'New dataset'}</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-lg leading-none">×</button>
        </div>

        <div className="px-4 py-3 flex-1 overflow-y-auto min-h-0 space-y-3">
          <div className="flex gap-2">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="table name" className="flex-1" style={field} />
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} style={{ ...field, cursor: 'pointer' }}>
              <option value="">— no source —</option>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="aliases (comma-separated, e.g. RegionID, reg_id)" className="w-full" style={field} />
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags (comma-separated)" className="w-full" style={field} />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="description" className="w-full" style={field} />

          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-1.5">Columns</div>
            {columns.map((c) => (
              <div key={c._k} className="flex items-center gap-1.5 mb-1.5">
                <input value={c.name} onChange={(e) => updateCol(c._k, { name: e.target.value })} placeholder="column" className="flex-1" style={field} />
                <select value={c.type} onChange={(e) => updateCol(c._k, { type: e.target.value })} style={{ ...field, cursor: 'pointer' }}>
                  {ATTR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button onClick={() => updateCol(c._k, { isKey: !c.isKey })} title="Toggle key" className="text-sm px-1.5 rounded" style={{ color: c.isKey ? '#fcd34d' : '#475569', border: '1px solid #334155' }}>🔑</button>
                <button onClick={() => removeCol(c._k)} className="text-red-400 hover:text-red-300 text-sm w-5">×</button>
              </div>
            ))}
            <button onClick={addCol} className="text-xs text-blue-400 hover:text-blue-300">+ add column</button>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-700">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300">Cancel</button>
          <button onClick={handleSave} disabled={!name.trim()} className="px-3 py-1.5 text-xs font-medium rounded-lg text-white disabled:opacity-40" style={{ background: '#1d4ed8' }}>
            {entry ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
