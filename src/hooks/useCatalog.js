import { useCallback, useEffect, useState } from 'react';
import { CATALOG_KEY, emptyCatalog, makeEntry, makeSource } from '../catalog/catalogStore';

// localStorage-backed catalog (global across all canvas tabs). Holds datasets
// (entries), datasources (sources), and dataset-level relationships. CRUD here;
// pure search/build helpers live in catalog/catalogStore.js.

function load() {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return emptyCatalog();
    const parsed = JSON.parse(raw);
    return { sources: parsed.sources || [], entries: parsed.entries || [], relationships: parsed.relationships || [] };
  } catch {
    return emptyCatalog();
  }
}

export function useCatalog() {
  const [catalog, setCatalog] = useState(load);

  useEffect(() => {
    try { localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog)); } catch { /* ignore quota */ }
  }, [catalog]);

  // ── Sources ────────────────────────────────────────────────────────────
  const addSource = useCallback((draft) => {
    const source = makeSource(draft);
    setCatalog((c) => ({ ...c, sources: [...c.sources, source] }));
    return source;
  }, []);

  const removeSource = useCallback((sourceId) => {
    setCatalog((c) => ({
      ...c,
      sources: c.sources.filter((s) => s.id !== sourceId),
      entries: c.entries.map((e) => e.sourceId === sourceId ? { ...e, sourceId: null } : e),
    }));
  }, []);

  // ── Entries ────────────────────────────────────────────────────────────
  // Upsert: pass an existing entry (with id) to update, or a draft to create.
  const upsertEntry = useCallback((entryOrDraft) => {
    const entry = entryOrDraft.id && entryOrDraft.columns
      ? { ...entryOrDraft, updatedAt: Date.now() }
      : makeEntry(entryOrDraft);
    setCatalog((c) => {
      const exists = c.entries.some((e) => e.id === entry.id);
      return { ...c, entries: exists ? c.entries.map((e) => e.id === entry.id ? entry : e) : [...c.entries, entry] };
    });
    return entry;
  }, []);

  const removeEntry = useCallback((entryId) => {
    setCatalog((c) => ({
      ...c,
      entries: c.entries.filter((e) => e.id !== entryId),
      relationships: c.relationships.filter((r) => r.fromId !== entryId && r.toId !== entryId),
    }));
  }, []);

  // Snapshot a pipeline DataFrame node into a catalog entry.
  const publishFromNode = useCallback((node, { sourceId = null } = {}) => {
    const draft = {
      name: node.data?.label || 'dataset',
      sourceId,
      columns: (node.data?.attributes || []).map((a) => ({ name: a.name, type: a.type })),
      finalized: node.data?.stage === 'final',
      origin: { kind: 'from-canvas', nodeId: node.id },
    };
    return upsertEntry(draft);
  }, [upsertEntry]);

  // ── Relationships ──────────────────────────────────────────────────────
  const addRelationship = useCallback((rel) => {
    setCatalog((c) => ({ ...c, relationships: [...c.relationships, { id: `rel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, kind: 'related', ...rel }] }));
  }, []);

  const removeRelationship = useCallback((relId) => {
    setCatalog((c) => ({ ...c, relationships: c.relationships.filter((r) => r.id !== relId) }));
  }, []);

  // Persist node positions for the Data Map graph view (stored on the entry).
  const setEntryPosition = useCallback((entryId, position) => {
    setCatalog((c) => ({ ...c, entries: c.entries.map((e) => e.id === entryId ? { ...e, position } : e) }));
  }, []);

  return {
    catalog,
    addSource, removeSource,
    upsertEntry, removeEntry, publishFromNode,
    addRelationship, removeRelationship,
    setEntryPosition,
  };
}
