import { renderHook, act } from '@testing-library/react';
import '../nodes/specs';
import { useLineageState } from './useLineageState';

// "Same name means reconnect, not duplicate": dropping a column where a
// same-name column/input already exists rebinds the existing one (healing
// broken state) instead of appending a copy. Plus the refreshData auto-heal:
// a broken Function/GroupBy input whose source was deleted rebinds itself when
// a node with the same label and a same-name column reappears.

beforeEach(() => localStorage.clear());

const attr = (id, name, type = 'string', extra = {}) => ({ id, name, type, ...extra });
const df = (id, label, attributes, dataExtra = {}) => ({
  id, type: 'dataFrameNode', position: { x: 0, y: 0 }, data: { label, attributes, ...dataExtra },
});
const op = (id, type, label, data = {}) => ({
  id, type, position: { x: 0, y: 0 }, data: { label, ...data },
});

const seed = (result, nodes, edges = []) =>
  act(() => { result.current.restoreState(nodes, edges); });
const byId = (result, id) => result.current.nodes.find((n) => n.id === id);
const cb = (result, id) => result.current.nodesWithCallbacks.find((n) => n.id === id).data;

test('column drop onto a DF with a same-name column reconnects instead of duplicating', () => {
  const { result } = renderHook(() => useLineageState());
  seed(result, [
    df('A', 'orders', [attr('a1', 'amount', 'float')]),
    df('B', 'report', [attr('b1', 'amount', 'string', { broken: true })]),
  ]);

  act(() => cb(result, 'B').onAttributeDrop('B',
    { sourceNodeId: 'A', attrId: 'a1', attrName: 'amount', attrType: 'float' }, 'b1'));

  const b = byId(result, 'B');
  expect(b.data.attributes).toHaveLength(1); // no duplicate
  expect(b.data.attributes[0]).toMatchObject({ id: 'b1', name: 'amount', type: 'float', broken: false });
  expect(result.current.edges).toHaveLength(1);
  expect(result.current.edges[0]).toMatchObject({ sourceHandle: 'a1-source', targetHandle: 'b1-target' });

  // dropping again does not create a second identical edge
  act(() => cb(result, 'B').onAttributeDrop('B',
    { sourceNodeId: 'A', attrId: 'a1', attrName: 'amount', attrType: 'float' }, 'b1'));
  expect(result.current.edges).toHaveLength(1);
});

test('column drop without a name match still copies the column (old behavior)', () => {
  const { result } = renderHook(() => useLineageState());
  seed(result, [df('A', 'orders', [attr('a1', 'amount', 'float')]), df('B', 'report', [])]);

  act(() => cb(result, 'B').onAttributeDrop('B',
    { sourceNodeId: 'A', attrId: 'a1', attrName: 'amount', attrType: 'float' }, null));

  expect(byId(result, 'B').data.attributes).toHaveLength(1);
  expect(result.current.edges).toHaveLength(1);
});

test('function input drop with same name rebinds in place: id and output links survive', () => {
  const { result } = renderHook(() => useLineageState());
  const fn = op('F', 'functionNode', 'fn', {
    inputs: [{ id: 'i1', attrName: 'amount', attrType: 'string', sourceNodeId: 'GONE', sourceNodeLabel: 'orders', sourceAttrId: 'x', broken: true }],
    outputs: [{ id: 'o1', name: 'ltv', type: 'float', fromInputId: 'i1' }],
  });
  seed(result, [df('A2', 'orders', [attr('a1', 'amount', 'float')]), fn],
    [{ id: 'stale', source: 'GONE', sourceHandle: 'x-source', target: 'F', targetHandle: 'i1-target' }]);

  act(() => cb(result, 'F').onFunctionInputDrop('F',
    { sourceNodeId: 'A2', attrId: 'a1', attrName: 'amount', attrType: 'float', sourceNodeLabel: 'orders' }, 'i1'));

  const f = byId(result, 'F');
  expect(f.data.inputs).toHaveLength(1); // rebound, not appended
  expect(f.data.inputs[0]).toMatchObject({ id: 'i1', sourceNodeId: 'A2', sourceAttrId: 'a1', attrType: 'float', broken: false });
  expect(f.data.outputs[0].fromInputId).toBe('i1'); // link survives
  const edgesToInput = result.current.edges.filter((e) => e.targetHandle === 'i1-target');
  expect(edgesToInput).toHaveLength(1); // stale edge replaced
  expect(edgesToInput[0].source).toBe('A2');
});

test('groupby input drop with same name rebinds: keys and aggregations survive', () => {
  const { result } = renderHook(() => useLineageState());
  const gb = op('G', 'groupByNode', 'gb', {
    inputs: [{ id: 'i1', attrName: 'segment', attrType: 'string', sourceNodeId: 'GONE', sourceNodeLabel: 'orders', sourceAttrId: 'x', broken: true }],
    groupByInputIds: ['i1'],
    aggregations: [{ id: 'ag1', inputId: 'i1', func: 'count', outputName: 'cnt' }],
  });
  seed(result, [df('A3', 'orders', [attr('a1', 'segment', 'string')]), gb]);

  act(() => cb(result, 'G').onGroupByInputDrop('G',
    { sourceNodeId: 'A3', attrId: 'a1', attrName: 'segment', attrType: 'string', sourceNodeLabel: 'orders' }, 'i1'));

  const g = byId(result, 'G');
  expect(g.data.inputs).toHaveLength(1);
  expect(g.data.inputs[0]).toMatchObject({ id: 'i1', sourceNodeId: 'A3', broken: false });
  expect(g.data.groupByInputIds).toEqual(['i1']);
  expect(g.data.aggregations[0].inputId).toBe('i1');
});

test('broken input auto-heals when a same-label DF with the same column reappears', () => {
  const { result } = renderHook(() => useLineageState());
  const fn = op('F2', 'functionNode', 'fn', {
    inputs: [{ id: 'i1', attrName: 'amount', attrType: 'string', sourceNodeId: 'DELETED', sourceNodeLabel: 'orders', sourceAttrId: 'x', broken: true }],
    outputs: [],
  });
  seed(result, [fn]);
  expect(byId(result, 'F2').data.inputs[0].broken).toBe(true);

  // recreate a DataFrame with the same label and a same-name column
  act(() => result.current.addNodeOfType('dataFrameNode', 0, 0, {
    label: 'orders', attributes: [attr('new1', 'amount', 'float')],
  }));

  const inp = byId(result, 'F2').data.inputs[0];
  expect(inp.broken).toBe(false);
  expect(inp.attrType).toBe('float');
  const newDf = result.current.nodes.find((n) => n.type === 'dataFrameNode');
  expect(inp.sourceNodeId).toBe(newDf.id);
  expect(inp.sourceAttrId).toBe('new1');
});
