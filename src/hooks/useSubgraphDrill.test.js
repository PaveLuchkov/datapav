import { renderHook, act } from '@testing-library/react';
import '../nodes/specs';
import { useLineageState } from './useLineageState';
import { useSubgraphDrill } from './useSubgraphDrill';

// Function subgraphs v1 (docs/function-subgraphs.md): drilling into a
// FunctionNode swaps the editing surface to its data.subgraph, mirrors the
// signature as read-only proxy DataFrames, folds edits back on exit, and
// exposes a composedRoot so persistence keeps saving the whole pipeline.

beforeEach(() => localStorage.clear());

const fnNode = (id, label, { inputs = [], outputs = [], subgraph } = {}) => ({
  id, type: 'functionNode', position: { x: 0, y: 0 },
  data: { label, inputs, outputs, ...(subgraph ? { subgraph } : {}) },
});
const df = (id, label, attributes = []) => ({
  id, type: 'dataFrameNode', position: { x: 0, y: 0 }, data: { label, attributes },
});

function setup(nodes = [], edges = []) {
  const { result } = renderHook(() => {
    const state = useLineageState();
    const drill = useSubgraphDrill(state);
    return { state, drill };
  });
  act(() => result.current.state.restoreState(nodes, edges));
  return result;
}

const FN = fnNode('fn1', 'enrich', {
  inputs: [{ id: 'i1', attrName: 'amount', attrType: 'float', sourceNodeId: 'X' }],
  outputs: [{ id: 'o1', name: 'ltv', type: 'float' }],
});

test('enterSubgraph swaps the surface to the subgraph with signature proxies', () => {
  const result = setup([FN, df('A', 'orders')]);

  act(() => result.current.drill.enterSubgraph('fn1'));

  const ids = result.current.state.nodes.map((n) => n.id).sort();
  expect(ids).toEqual(['proxy-in-fn1', 'proxy-out-fn1']);
  const pin = result.current.state.nodes.find((n) => n.id === 'proxy-in-fn1');
  expect(pin.data._proxy).toBe(true);
  expect(pin.data.attributes).toEqual([{ id: 'i1', name: 'amount', type: 'float' }]);
  const pout = result.current.state.nodes.find((n) => n.id === 'proxy-out-fn1');
  expect(pout.data.attributes).toEqual([{ id: 'o1', name: 'ltv', type: 'float' }]);
  expect(result.current.drill.stack).toHaveLength(1);
});

test('exitOne folds subgraph edits into the function node and restores the outer surface', () => {
  const result = setup([FN, df('A', 'orders')]);

  act(() => result.current.drill.enterSubgraph('fn1'));
  act(() => result.current.state.addNodeOfType('dataFrameNode', 100, 100, { label: 'inner_df' }));
  act(() => result.current.drill.exitOne());

  expect(result.current.drill.stack).toHaveLength(0);
  const ids = result.current.state.nodes.map((n) => n.id).sort();
  expect(ids).toEqual(['A', 'fn1']);
  const fn = result.current.state.nodes.find((n) => n.id === 'fn1');
  const subLabels = fn.data.subgraph.nodes.map((n) => n.data.label);
  expect(subLabels).toContain('inner_df');
  expect(subLabels).toContain('enrich · inputs');
});

test('re-entering refreshes proxies from the signature but keeps the body', () => {
  const result = setup([FN]);
  act(() => result.current.drill.enterSubgraph('fn1'));
  act(() => result.current.state.addNodeOfType('dataFrameNode', 100, 100, { label: 'inner_df' }));
  act(() => result.current.drill.exitOne());

  // rename the function output, then drill back in
  act(() => {
    const cur = result.current.state.nodes;
    result.current.state.restoreState(cur.map((n) => n.id === 'fn1'
      ? { ...n, data: { ...n.data, outputs: [{ id: 'o1', name: 'ltv_score', type: 'float' }] } }
      : n), []);
  });
  act(() => result.current.drill.enterSubgraph('fn1'));

  const pout = result.current.state.nodes.find((n) => n.id === 'proxy-out-fn1');
  expect(pout.data.attributes[0].name).toBe('ltv_score');
  expect(result.current.state.nodes.some((n) => n.data.label === 'inner_df')).toBe(true);
});

test('composedRoot folds live subgraph edits into the root canvas while drilled in', () => {
  const result = setup([FN, df('A', 'orders')]);
  act(() => result.current.drill.enterSubgraph('fn1'));
  act(() => result.current.state.addNodeOfType('dataFrameNode', 100, 100, { label: 'inner_df' }));

  const root = result.current.drill.composedRoot;
  expect(root.nodes.map((n) => n.id).sort()).toEqual(['A', 'fn1']);
  const fn = root.nodes.find((n) => n.id === 'fn1');
  expect(fn.data.subgraph.nodes.some((n) => n.data.label === 'inner_df')).toBe(true);
});

test('nested drill-in and exitToDepth(0) folds every level back to the root', () => {
  const result = setup([FN]);
  act(() => result.current.drill.enterSubgraph('fn1'));
  // build an inner function and drill into it
  act(() => result.current.state.addNodeOfType('functionNode', 50, 50));
  const innerFn0 = result.current.state.nodes.find((n) => n.type === 'functionNode');
  const innerFnId = innerFn0.id;
  act(() => result.current.drill.enterSubgraph(innerFnId));
  expect(result.current.drill.stack.map((f) => f.label)).toEqual(['enrich', innerFn0.data.label]);

  act(() => result.current.state.addNodeOfType('dataFrameNode', 10, 10, { label: 'deep_df' }));
  act(() => result.current.drill.exitToDepth(0));

  expect(result.current.drill.stack).toHaveLength(0);
  const fn = result.current.state.nodes.find((n) => n.id === 'fn1');
  const innerFn = fn.data.subgraph.nodes.find((n) => n.id === innerFnId);
  expect(innerFn.data.subgraph.nodes.some((n) => n.data.label === 'deep_df')).toBe(true);
});

test('stale proxies from a pasted (re-id-ed) function are dropped on entry', () => {
  const pasted = fnNode('fn2', 'enrich_copy', {
    inputs: [], outputs: [],
    subgraph: {
      nodes: [
        { id: 'proxy-in-fn1', type: 'dataFrameNode', position: { x: 0, y: 0 }, data: { label: 'old · inputs', attributes: [], _proxy: true } },
        df('B', 'body_df'),
      ],
      edges: [{ id: 'e1', source: 'proxy-in-fn1', target: 'B' }],
    },
  });
  const result = setup([pasted]);
  act(() => result.current.drill.enterSubgraph('fn2'));

  const ids = result.current.state.nodes.map((n) => n.id).sort();
  expect(ids).toEqual(['B', 'proxy-in-fn2', 'proxy-out-fn2']);
  expect(result.current.state.edges).toHaveLength(0); // dangling edge dropped
});
