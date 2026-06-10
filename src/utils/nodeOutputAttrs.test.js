// Register migrated node specs so the engine dispatches through them — mirrors
// production (src/index.jsx imports the specs barrel). Migrated types resolve via
// their spec, the rest via the remaining switch; both must produce identical
// results, which is exactly what this characterization suite pins.
import '../nodes/specs';
import {
  inferAggType,
  computeNodeOutputAttributes,
  getUpstreamAttrs,
  getUpstreamChainAttrs,
  traceColumnUpstream,
  traceColumnDownstream,
  flattenUpstream,
} from './nodeOutputAttrs';

// ── Fixture helpers ──────────────────────────────────────────────────────────
// Minimal node/edge factories mirroring the real data shapes. These tests pin
// the CURRENT behavior of the lineage engine so the schema-driven migration
// (which moves each switch-case into a per-node spec) cannot silently regress.

const attr = (id, name, type = 'string') => ({ id, name, type });

const df = (id, label, attributes) => ({
  id, type: 'dataFrameNode', position: { x: 0, y: 0 }, data: { label, attributes },
});
const op = (id, type, label, data) => ({
  id, type, position: { x: 0, y: 0 }, data: { label, ...data },
});

// df-out → df-in edge between two nodes
const dfEdge = (source, target) => ({
  id: `e-${source}-${target}`, source, target, sourceHandle: 'df-out', targetHandle: 'df-in',
});
// arbitrary handle edge
const edge = (source, sourceHandle, target, targetHandle) => ({
  id: `e-${source}-${target}-${targetHandle}`, source, sourceHandle, target, targetHandle,
});

// ── inferAggType ─────────────────────────────────────────────────────────────

describe('inferAggType', () => {
  test('count and nunique are always int', () => {
    expect(inferAggType('count', 'string')).toBe('int');
    expect(inferAggType('nunique', 'float')).toBe('int');
  });
  test('mean is always float', () => {
    expect(inferAggType('mean', 'int')).toBe('float');
  });
  test('sum preserves int/float, else float', () => {
    expect(inferAggType('sum', 'int')).toBe('int');
    expect(inferAggType('sum', 'float')).toBe('float');
    expect(inferAggType('sum', 'string')).toBe('float');
  });
  test('min/max/first/last preserve source type, default string', () => {
    expect(inferAggType('max', 'date')).toBe('date');
    expect(inferAggType('first', undefined)).toBe('string');
  });
});

// ── computeNodeOutputAttributes ──────────────────────────────────────────────

describe('computeNodeOutputAttributes', () => {
  test('dataFrameNode returns its attributes verbatim', () => {
    const a = df('A', 'A', [attr('a1', 'x', 'int')]);
    expect(computeNodeOutputAttributes(a, [], [a])).toEqual([attr('a1', 'x', 'int')]);
  });

  test('filterNode and concatNode pass upstream through', () => {
    const a = df('A', 'A', [attr('a1', 'x', 'int'), attr('a2', 'y')]);
    const f = op('F', 'filterNode', 'f', {});
    const nodes = [a, f];
    const edges = [dfEdge('A', 'F')];
    expect(computeNodeOutputAttributes(f, edges, nodes)).toEqual([attr('a1', 'x', 'int'), attr('a2', 'y')]);
  });

  test('renameNode renames mapped columns and passes the rest through', () => {
    const a = df('A', 'A', [attr('a1', 'old', 'int'), attr('a2', 'keep')]);
    const r = op('R', 'renameNode', 'r', { mappings: [{ id: 'm1', from: 'old', to: 'new' }] });
    const out = computeNodeOutputAttributes(r, [dfEdge('A', 'R')], [a, r]);
    expect(out).toEqual([attr('m1', 'new', 'int'), attr('a2', 'keep')]);
  });

  test('transformNode applies astype, drop_column, add_column (skipping dup names)', () => {
    const a = df('A', 'A', [attr('a1', 'x', 'int'), attr('a2', 'y')]);
    const t = op('T', 'transformNode', 't', {
      ops: [
        { id: 'op1', type: 'astype', args: { col: 'x', type_val: 'float' } },
        { id: 'op2', type: 'drop_column', args: { col: 'y' } },
        { id: 'op3', type: 'add_column', args: { col: 'w', type_val: 'bool' } },
        { id: 'op4', type: 'add_column', args: { col: 'x', type_val: 'string' } }, // dup -> skipped
      ],
    });
    const out = computeNodeOutputAttributes(t, [dfEdge('A', 'T')], [a, t]);
    expect(out).toEqual([attr('a1', 'x', 'float'), attr('op3', 'w', 'bool')]);
  });

  test('groupByNode outputs keys then aggregations with inferred types', () => {
    const a = df('A', 'A', [attr('a1', 'cat'), attr('a2', 'amt', 'float')]);
    const gb = op('GB', 'groupByNode', 'gb', {
      inputs: [
        { id: 'g1', attrName: 'cat', attrType: 'string', sourceNodeId: 'A' },
        { id: 'g2', attrName: 'amt', attrType: 'float', sourceNodeId: 'A' },
      ],
      groupByInputIds: ['g1'],
      aggregations: [{ id: 'agg1', inputId: 'g2', func: 'sum', outputName: 'total' }],
    });
    const out = computeNodeOutputAttributes(gb, [], [a, gb]);
    expect(out).toEqual([
      { id: 'g1', name: 'cat', type: 'string' },
      { id: 'agg1', name: 'total', type: 'float' },
    ]);
  });

  test('mergeNode unions left then right, deduping by name', () => {
    const l = df('L', 'L', [attr('l1', 'x'), attr('l2', 'y')]);
    const r = df('R', 'R', [attr('r1', 'y'), attr('r2', 'z')]);
    const m = op('M', 'mergeNode', 'm', {});
    const edges = [edge('L', 'df-out', 'M', 'left-in'), edge('R', 'df-out', 'M', 'right-in')];
    const out = computeNodeOutputAttributes(m, edges, [l, r, m]);
    expect(out.map((a) => a.name)).toEqual(['x', 'y', 'z']);
  });

  describe('functionNode', () => {
    const build = (extendMode) => {
      const a = df('A', 'A', [attr('a1', 'x', 'int')]);
      const fn = op('FN', 'functionNode', 'fn', {
        extendMode,
        inputs: [{ id: 'i1', attrName: 'x', attrType: 'int', sourceNodeId: 'A' }],
        outputs: [
          { id: 'o1', name: 'y', type: 'float', fromInputId: 'i1' },
          { id: 'o2', name: 'z', type: 'string' },
        ],
      });
      return { nodes: [a, fn], edges: [dfEdge('A', 'FN')], fn };
    };

    test('without extend mode returns only its own outputs', () => {
      const { nodes, edges, fn } = build(false);
      expect(computeNodeOutputAttributes(fn, edges, nodes)).toEqual([
        { id: 'o1', name: 'y', type: 'float' },
        { id: 'o2', name: 'z', type: 'string' },
      ]);
    });

    test('with extend mode prepends upstream attrs not shadowed by outputs', () => {
      const { nodes, edges, fn } = build(true);
      expect(computeNodeOutputAttributes(fn, edges, nodes)).toEqual([
        attr('a1', 'x', 'int'),
        { id: 'o1', name: 'y', type: 'float' },
        { id: 'o2', name: 'z', type: 'string' },
      ]);
    });
  });
});

// ── getUpstreamAttrs ─────────────────────────────────────────────────────────

describe('getUpstreamAttrs', () => {
  test('dedups by name across multiple df-in sources (first wins)', () => {
    const a = df('A', 'A', [attr('a1', 'x', 'int')]);
    const b = df('B', 'B', [attr('b1', 'x', 'float'), attr('b2', 'y')]);
    const f = op('F', 'filterNode', 'f', {});
    const nodes = [a, b, f];
    const edges = [dfEdge('A', 'F'), dfEdge('B', 'F')];
    const out = getUpstreamAttrs('F', edges, nodes);
    expect(out).toEqual([attr('a1', 'x', 'int'), attr('b2', 'y')]);
  });

  test('respects a custom handleId', () => {
    const l = df('L', 'L', [attr('l1', 'x')]);
    const m = op('M', 'mergeNode', 'm', {});
    const edges = [edge('L', 'df-out', 'M', 'left-in')];
    expect(getUpstreamAttrs('M', edges, [l, m], 'left-in')).toEqual([attr('l1', 'x')]);
    expect(getUpstreamAttrs('M', edges, [l, m], 'df-in')).toEqual([]);
  });
});

describe('getUpstreamChainAttrs', () => {
  test('walks the full upstream chain, nearest ancestors first, deduped by name', () => {
    // A(x,y) → Transform(drop y) → B(x) → Filter
    const a = df('A', 'A', [attr('a1', 'x', 'int'), attr('a2', 'y')]);
    const t = op('T', 'transformNode', 't', { ops: [{ id: 'o1', op: 'drop_column', args: { col: 'y' } }] });
    const b = df('B', 'B', [attr('b1', 'x', 'int')]);
    const f = op('F', 'filterNode', 'f', {});
    const nodes = [a, t, b, f];
    const edges = [dfEdge('A', 'T'), dfEdge('T', 'B'), dfEdge('B', 'F')];
    const out = getUpstreamChainAttrs('F', edges, nodes);
    // x from the direct source B wins; y resurfaces from A further up the chain
    expect(out.map((o) => o.name).sort()).toEqual(['x', 'y']);
    expect(out.find((o) => o.name === 'x')).toEqual(attr('b1', 'x', 'int'));
  });

  test('is cycle-safe', () => {
    const a = df('A', 'A', [attr('a1', 'x')]);
    const b = df('B', 'B', [attr('b1', 'y')]);
    const edges = [dfEdge('A', 'B'), dfEdge('B', 'A')];
    expect(getUpstreamChainAttrs('B', edges, [a, b]).map((o) => o.name)).toEqual(['x']);
  });
});

// ── traceColumnUpstream ──────────────────────────────────────────────────────

describe('traceColumnUpstream', () => {
  test('plain DataFrame with no incoming df-in edge is terminal', () => {
    const a = df('A', 'A', [attr('a1', 'x')]);
    const step = traceColumnUpstream('A', 'x', [], [a]);
    expect(step).toMatchObject({ nodeId: 'A', colName: 'x', nodeType: 'dataFrameNode', upstream: null });
  });

  test('unknown column on a DataFrame returns null', () => {
    const a = df('A', 'A', [attr('a1', 'x')]);
    expect(traceColumnUpstream('A', 'nope', [], [a])).toBeNull();
  });

  test('result DataFrame traces back through df-in to the operator chain', () => {
    const a = df('A', 'A', [attr('a1', 'x', 'int')]);
    const f = op('F', 'filterNode', 'f', {});
    const r = df('R', 'R', [attr('r1', 'x', 'int')]);
    const nodes = [a, f, r];
    const edges = [dfEdge('A', 'F'), dfEdge('F', 'R')];
    const chain = flattenUpstream(traceColumnUpstream('R', 'x', edges, nodes));
    expect(chain.map((s) => s.nodeId)).toEqual(['A', 'F', 'R']);
  });

  test('renameNode: renamed col traces to original name; unmapped-missing col is null', () => {
    const a = df('A', 'A', [attr('a1', 'old', 'int')]);
    const r = op('R', 'renameNode', 'r', { mappings: [{ id: 'm1', from: 'old', to: 'new' }] });
    const nodes = [a, r];
    const edges = [dfEdge('A', 'R')];
    const renamed = traceColumnUpstream('R', 'new', edges, nodes);
    expect(renamed.upstream).toMatchObject({ nodeId: 'A', colName: 'old' });
    expect(traceColumnUpstream('R', 'ghost', edges, nodes)).toBeNull();
  });

  test('mergeNode resolves the column to the correct side', () => {
    const l = df('L', 'L', [attr('l1', 'x')]);
    const r = df('R', 'R', [attr('r1', 'z')]);
    const m = op('M', 'mergeNode', 'm', {});
    const nodes = [l, r, m];
    const edges = [edge('L', 'df-out', 'M', 'left-in'), edge('R', 'df-out', 'M', 'right-in')];
    expect(traceColumnUpstream('M', 'x', edges, nodes).upstream).toMatchObject({ nodeId: 'L' });
    expect(traceColumnUpstream('M', 'z', edges, nodes).upstream).toMatchObject({ nodeId: 'R' });
  });

  test('groupByNode: key traces through; agg carries aggFunc + inputColName', () => {
    const a = df('A', 'A', [attr('a1', 'cat'), attr('a2', 'amt', 'float')]);
    const gb = op('GB', 'groupByNode', 'gb', {
      inputs: [
        { id: 'g1', attrName: 'cat', attrType: 'string', sourceNodeId: 'A' },
        { id: 'g2', attrName: 'amt', attrType: 'float', sourceNodeId: 'A' },
      ],
      groupByInputIds: ['g1'],
      aggregations: [{ id: 'agg1', inputId: 'g2', func: 'sum', outputName: 'total' }],
    });
    const nodes = [a, gb];
    expect(traceColumnUpstream('GB', 'cat', [], nodes).upstream).toMatchObject({ nodeId: 'A', colName: 'cat' });
    const aggStep = traceColumnUpstream('GB', 'total', [], nodes);
    expect(aggStep).toMatchObject({ aggFunc: 'sum', inputColName: 'amt' });
    expect(aggStep.upstream).toMatchObject({ nodeId: 'A', colName: 'amt' });
  });

  describe('functionNode', () => {
    const base = (extendMode) => {
      const a = df('A', 'A', [attr('a1', 'x', 'int')]);
      const fn = op('FN', 'functionNode', 'fn', {
        extendMode,
        inputs: [{ id: 'i1', attrName: 'x', attrType: 'int', sourceNodeId: 'A' }],
        outputs: [
          { id: 'o1', name: 'y', type: 'float', fromInputId: 'i1' },
          { id: 'o2', name: 'z', type: 'string' },
        ],
      });
      return { nodes: [a, fn], edges: [dfEdge('A', 'FN')] };
    };

    test('linked output traces through its input', () => {
      const { nodes, edges } = base(false);
      expect(traceColumnUpstream('FN', 'y', edges, nodes).upstream).toMatchObject({ nodeId: 'A', colName: 'x' });
    });
    test('unlinked output is createdHere', () => {
      const { nodes, edges } = base(false);
      expect(traceColumnUpstream('FN', 'z', edges, nodes)).toMatchObject({ createdHere: true });
    });
    test('pass-through column resolves only in extend mode', () => {
      const off = base(false);
      expect(traceColumnUpstream('FN', 'x', off.edges, off.nodes)).toBeNull();
      const on = base(true);
      expect(traceColumnUpstream('FN', 'x', on.edges, on.nodes).upstream).toMatchObject({ nodeId: 'A', colName: 'x' });
    });
  });

  test('transformNode: dropped -> null, added -> createdHere, untouched -> passthrough', () => {
    const a = df('A', 'A', [attr('a1', 'x', 'int')]);
    const t = op('T', 'transformNode', 't', {
      ops: [
        { id: 'op1', type: 'drop_column', args: { col: 'gone' } },
        { id: 'op2', type: 'add_column', args: { col: 'w', type_val: 'bool' } },
      ],
    });
    const nodes = [a, t];
    const edges = [dfEdge('A', 'T')];
    expect(traceColumnUpstream('T', 'gone', edges, nodes)).toBeNull();
    expect(traceColumnUpstream('T', 'w', edges, nodes)).toMatchObject({ createdHere: true });
    expect(traceColumnUpstream('T', 'x', edges, nodes).upstream).toMatchObject({ nodeId: 'A', colName: 'x' });
  });
});

// ── traceColumnDownstream ────────────────────────────────────────────────────

describe('traceColumnDownstream', () => {
  test('propagates a column forward through a chain', () => {
    const a = df('A', 'A', [attr('a1', 'x', 'int')]);
    const f = op('F', 'filterNode', 'f', {});
    const r = df('R', 'R', [attr('r1', 'x', 'int')]);
    const nodes = [a, f, r];
    const edges = [dfEdge('A', 'F'), dfEdge('F', 'R')];
    const branches = traceColumnDownstream('A', 'x', edges, nodes);
    expect(branches).toHaveLength(1);
    expect(branches[0]).toMatchObject({ nodeId: 'F', colName: 'x' });
    expect(branches[0].downstream[0]).toMatchObject({ nodeId: 'R', colName: 'x' });
  });

  test('renameNode renames the column as it propagates forward', () => {
    const a = df('A', 'A', [attr('a1', 'old', 'int')]);
    const r = op('R', 'renameNode', 'r', { mappings: [{ id: 'm1', from: 'old', to: 'new' }] });
    const nodes = [a, r];
    const edges = [dfEdge('A', 'R')];
    expect(traceColumnDownstream('A', 'old', edges, nodes)[0]).toMatchObject({ nodeId: 'R', colName: 'new' });
  });

  test('a column not present downstream stops the branch', () => {
    const a = df('A', 'A', [attr('a1', 'x')]);
    const t = op('T', 'transformNode', 't', { ops: [{ id: 'op1', type: 'drop_column', args: { col: 'x' } }] });
    const nodes = [a, t];
    const edges = [dfEdge('A', 'T')];
    expect(traceColumnDownstream('A', 'x', edges, nodes)).toEqual([]);
  });
});

// ── flattenUpstream ──────────────────────────────────────────────────────────

describe('flattenUpstream', () => {
  test('orders the chain oldest -> newest', () => {
    const step = { nodeId: 'C', upstream: { nodeId: 'B', upstream: { nodeId: 'A', upstream: null } } };
    expect(flattenUpstream(step).map((s) => s.nodeId)).toEqual(['A', 'B', 'C']);
  });
  test('handles a null step', () => {
    expect(flattenUpstream(null)).toEqual([]);
  });
});

// ── Cycle safety ─────────────────────────────────────────────────────────────
// A graph loop (e.g. a companion result wired back toward its operator) must not
// recurse without bound — an unguarded trace threw RangeError mid-render, which
// blanked the canvas. The visited-set guard keeps tracing finite.
describe('trace cycle safety', () => {
  const cyclicDFs = () => {
    const a = df('A', 'a', [attr('a1', 'x', 'int')]);
    const b = df('B', 'b', [attr('b1', 'x', 'int')]);
    return { nodes: [a, b], edges: [dfEdge('A', 'B'), dfEdge('B', 'A')] };
  };

  test('traceColumnUpstream terminates on a df cycle', () => {
    const { nodes, edges } = cyclicDFs();
    expect(() => traceColumnUpstream('A', 'x', edges, nodes)).not.toThrow();
    expect(traceColumnUpstream('A', 'x', edges, nodes)).toMatchObject({ nodeId: 'A', colName: 'x' });
  });

  test('traceColumnDownstream terminates on a df cycle', () => {
    const { nodes, edges } = cyclicDFs();
    expect(() => traceColumnDownstream('A', 'x', edges, nodes)).not.toThrow();
    expect(Array.isArray(traceColumnDownstream('A', 'x', edges, nodes))).toBe(true);
  });

  test('a self-referential operator→companion loop terminates', () => {
    // M(merge) -> C(companion), and C wired back into M's left input.
    const m = op('M', 'mergeNode', 'm', {});
    const c = df('C', 'result', [attr('c1', 'x', 'int')], {});
    c.data._companionOf = 'M';
    const nodes = [m, c];
    const edges = [
      { id: 'ecomp', source: 'M', target: 'C', sourceHandle: 'df-out', targetHandle: 'df-in', data: { isCompanionEdge: true } },
      { id: 'eback', source: 'C', target: 'M', sourceHandle: 'df-out', targetHandle: 'left-in' },
    ];
    expect(() => traceColumnUpstream('C', 'x', edges, nodes)).not.toThrow();
  });
});

// ── Column-level lineage edges (DF→DF column drop) ───────────────────────────
// Dragging a column from one DataFrame onto another creates a per-column edge
// (`${srcAttrId}-source` → `${tgtAttrId}-target`), not a df-out/df-in edge.
// Tracing must follow these in both directions.
describe('column-level lineage edges', () => {
  const colEdge = (source, srcAttrId, target, tgtAttrId) => ({
    id: `c-${source}-${target}`, source, sourceHandle: `${srcAttrId}-source`,
    target, targetHandle: `${tgtAttrId}-target`, type: 'columnEdge',
  });

  test('traceColumnUpstream follows a column edge back to the source DataFrame', () => {
    const a = df('A', 'src', [attr('a1', 'x', 'int')]);
    const b = df('B', 'dst', [attr('b1', 'x', 'int')]);
    const edges = [colEdge('A', 'a1', 'B', 'b1')];
    const chain = flattenUpstream(traceColumnUpstream('B', 'x', edges, [a, b]));
    expect(chain.map((s) => s.nodeId)).toEqual(['A', 'B']);
  });

  test('traceColumnDownstream follows a column edge forward to the target DataFrame', () => {
    const a = df('A', 'src', [attr('a1', 'x', 'int')]);
    const b = df('B', 'dst', [attr('b1', 'x', 'int')]);
    const edges = [colEdge('A', 'a1', 'B', 'b1')];
    const out = traceColumnDownstream('A', 'x', edges, [a, b]);
    expect(out.map((s) => s.nodeId)).toEqual(['B']);
  });

  test('a column edge to a renamed target column resolves the target column name', () => {
    const a = df('A', 'src', [attr('a1', 'x', 'int')]);
    const b = df('B', 'dst', [attr('b1', 'x_copy', 'int')]);
    const edges = [colEdge('A', 'a1', 'B', 'b1')];
    const out = traceColumnDownstream('A', 'x', edges, [a, b]);
    expect(out[0]).toMatchObject({ nodeId: 'B', colName: 'x_copy' });
  });
});
