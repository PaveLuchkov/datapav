import { renderHook, act } from '@testing-library/react';
import { useLineagePersistence } from './useLineagePersistence';

const STORAGE_KEY = 'lineage-editor-state';

beforeEach(() => localStorage.clear());

function setup(overrides = {}) {
  const showToast = jest.fn();
  const restoreState = jest.fn();
  const nodes = [{ id: '1', type: 'dataFrameNode', position: { x: 0, y: 0 }, data: { label: 'A', attributes: [] } }];
  const edges = [];
  const { result } = renderHook(() =>
    useLineagePersistence({ nodes, edges, restoreState, showToast, ...overrides })
  );
  return { result, showToast, restoreState, nodes, edges };
}

test('saveState writes nodes and edges to localStorage', () => {
  const { result, nodes, edges } = setup();
  act(() => result.current.saveState());
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
  expect(stored.nodes).toEqual(nodes);
  expect(stored.edges).toEqual(edges);
});

test('saveState shows toast', () => {
  const { result, showToast } = setup();
  act(() => result.current.saveState());
  expect(showToast).toHaveBeenCalledWith('Saved!');
});

test('loadState restores from localStorage', () => {
  const saved = { nodes: [{ id: '99' }], edges: [{ id: 'e1' }] };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  const { result, restoreState } = setup();
  act(() => result.current.loadState());
  expect(restoreState).toHaveBeenCalledWith(saved.nodes, saved.edges);
});

test('loadState shows toast on success', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes: [], edges: [] }));
  const { result, showToast } = setup();
  act(() => result.current.loadState());
  expect(showToast).toHaveBeenCalledWith('Loaded!');
});

test('loadState shows toast when nothing saved', () => {
  const { result, showToast } = setup();
  act(() => result.current.loadState());
  expect(showToast).toHaveBeenCalledWith('Nothing saved yet');
});

test('loadState shows toast on corrupt JSON', () => {
  localStorage.setItem(STORAGE_KEY, 'not-json{{{');
  const { result, showToast } = setup();
  act(() => result.current.loadState());
  expect(showToast).toHaveBeenCalledWith('Failed to load');
});
