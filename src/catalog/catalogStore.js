// Pure catalog helpers (no React, no storage) — unit-testable. The useCatalog
// hook wraps these with localStorage persistence. See docs/data-catalog.md.

import { uid } from '../utils/uid';

export const CATALOG_KEY = 'lineage-catalog';
export const SOURCE_KINDS = ['database', 'local-storage', 'manual'];

export const emptyCatalog = () => ({ sources: [], entries: [], relationships: [] });

// Normalize a name so RegionID / region_id / "Region Id" all collide.
export function normalizeName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Build a catalog entry from a column list (used by manual / SQL / publish flows).
export function makeEntry({ name, sourceId = null, columns = [], aliases = [], tags = [], description = '', origin, finalized = false }) {
  return {
    id: uid(),
    name: name || 'untitled',
    aliases,
    sourceId,
    description,
    tags,
    columns: columns.map((c) => ({
      name: c.name,
      type: c.type || 'string',
      aliases: c.aliases || [],
      description: c.description || '',
      isKey: !!c.isKey,
    })),
    finalized,
    origin: origin || { kind: 'manual' },
    updatedAt: Date.now(),
  };
}

export function makeSource({ name, kind = 'manual', dialect, description = '', tags = [] }) {
  return { id: uid(), name: name || kind, kind, dialect, description, tags };
}

// Does an entry match a free-text query (by name, alias, column name/alias, tag)?
export function entryMatches(entry, query) {
  const q = normalizeName(query);
  if (!q) return true;
  const hay = [
    entry.name,
    ...(entry.aliases || []),
    ...(entry.tags || []),
    ...(entry.columns || []).flatMap((c) => [c.name, ...(c.aliases || [])]),
  ];
  return hay.some((h) => normalizeName(h).includes(q));
}

// Filter entries by query + optional source kind ('database'|'local-storage'|'manual'|null).
export function searchEntries(catalog, { query = '', sourceKind = null } = {}) {
  const sourceById = new Map((catalog.sources || []).map((s) => [s.id, s]));
  return (catalog.entries || []).filter((e) => {
    if (sourceKind) {
      const kind = sourceById.get(e.sourceId)?.kind || 'manual';
      if (kind !== sourceKind) return false;
    }
    return entryMatches(e, query);
  });
}
