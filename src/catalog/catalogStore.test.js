import { normalizeName, makeEntry, makeSource, entryMatches, searchEntries, emptyCatalog } from './catalogStore';

test('normalizeName collapses case and separators', () => {
  expect(normalizeName('RegionID')).toBe('regionid');
  expect(normalizeName('region_id')).toBe('regionid');
  expect(normalizeName('Region Id')).toBe('regionid');
});

test('makeEntry fills defaults and normalizes columns', () => {
  const e = makeEntry({ name: 'orders', columns: [{ name: 'id', type: 'int' }, { name: 'note' }] });
  expect(e.id).toBeTruthy();
  expect(e.finalized).toBe(false);
  expect(e.origin).toEqual({ kind: 'manual' });
  expect(e.columns).toEqual([
    { name: 'id', type: 'int', aliases: [], description: '', isKey: false },
    { name: 'note', type: 'string', aliases: [], description: '', isKey: false },
  ]);
});

test('entryMatches finds by name, alias, column, and tag (alias-aware)', () => {
  const e = makeEntry({ name: 'dim_region', aliases: ['RegionDim'], tags: ['geo'], columns: [{ name: 'region_id', aliases: ['RegionID'] }] });
  expect(entryMatches(e, 'dim_region')).toBe(true);
  expect(entryMatches(e, 'regiondim')).toBe(true);   // alias
  expect(entryMatches(e, 'RegionID')).toBe(true);     // column alias, normalized
  expect(entryMatches(e, 'geo')).toBe(true);          // tag
  expect(entryMatches(e, 'orders')).toBe(false);
  expect(entryMatches(e, '')).toBe(true);             // empty query matches all
});

test('searchEntries filters by query and source kind', () => {
  const cat = emptyCatalog();
  const db = makeSource({ name: 'Prod PG', kind: 'database' });
  const local = makeSource({ name: 'Local', kind: 'local-storage' });
  cat.sources = [db, local];
  cat.entries = [
    makeEntry({ name: 'orders', sourceId: db.id }),
    makeEntry({ name: 'regions', sourceId: local.id }),
  ];
  expect(searchEntries(cat, { sourceKind: 'database' }).map((e) => e.name)).toEqual(['orders']);
  expect(searchEntries(cat, { query: 'reg' }).map((e) => e.name)).toEqual(['regions']);
  expect(searchEntries(cat, {}).length).toBe(2);
});
