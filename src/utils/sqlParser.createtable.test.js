import { parseCreateTable, mapSqlType } from './sqlParser';

test('maps common SQL types to ATTR_TYPES', () => {
  expect(mapSqlType('INTEGER')).toBe('int');
  expect(mapSqlType('BIGINT')).toBe('int');
  expect(mapSqlType('VARCHAR(255)')).toBe('string');
  expect(mapSqlType('TEXT')).toBe('string');
  expect(mapSqlType('NUMERIC(10,2)')).toBe('float');
  expect(mapSqlType('DOUBLE PRECISION')).toBe('float');
  expect(mapSqlType('TIMESTAMP')).toBe('date');
  expect(mapSqlType('DATE')).toBe('date');
  expect(mapSqlType('BOOLEAN')).toBe('bool');
});

test('parses a CREATE TABLE into typed columns', () => {
  const sql = `CREATE TABLE public.orders (
    order_id   BIGINT NOT NULL,
    customer   VARCHAR(120),
    amount     NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMP,
    is_paid    BOOLEAN
  )`;
  const { tableName, columns } = parseCreateTable(sql);
  expect(tableName).toBe('orders'); // schema stripped
  expect(columns).toEqual([
    { name: 'order_id', type: 'int' },
    { name: 'customer', type: 'string' },
    { name: 'amount', type: 'float' },
    { name: 'created_at', type: 'date' },
    { name: 'is_paid', type: 'bool' },
  ]);
});

test('skips table-level constraints', () => {
  const sql = `CREATE TABLE t (
    id INT,
    region_id INT,
    PRIMARY KEY (id),
    CONSTRAINT fk_region FOREIGN KEY (region_id) REFERENCES region(id),
    UNIQUE (region_id)
  )`;
  const { columns } = parseCreateTable(sql);
  expect(columns.map((c) => c.name)).toEqual(['id', 'region_id']);
});

test('handles IF NOT EXISTS and quoted identifiers', () => {
  const { tableName, columns } = parseCreateTable('CREATE TABLE IF NOT EXISTS "Region" ("RegionID" int, "name" text)');
  expect(tableName).toBe('Region');
  expect(columns).toEqual([{ name: 'RegionID', type: 'int' }, { name: 'name', type: 'string' }]);
});

test('returns empty for non-DDL input', () => {
  expect(parseCreateTable('SELECT * FROM x')).toEqual({ tableName: null, columns: [] });
});
