import * as engine from '../../utils/nodeOutputAttrs';
import { uid } from '../../utils/uid';
import config from './config';
import FunctionNode from './index';
import { useFunctionCallbacks } from './callbacks';

// Function declares its own output columns; each output may derive from an input
// (fromInputId) or be created here. In extend mode it also passes through any
// upstream column it doesn't redefine. Lineage lifted verbatim from the
// functionNode cases in nodeOutputAttrs.js — extend mode is the capability that
// Phase 7's "expand Function" will grow on top of this spec.

const functionSpec = {
  type: config.type,
  theme: 'function',
  minimapColor: config.minimapColor,
  dagre: { width: config.dagreWidth, height: config.dagreHeight },
  make: config.make,
  companion: true,
  connect: { acceptsColumns: true, dfLevel: config.connections },
  menu: config.menu,
  header: { editableLabel: true, code: true },
  component: FunctionNode,

  // Component lists the DataFrames feeding its df-in handle (extend-mode source).
  inject: (node, edges, nodes) => ({
    connectedDFs: edges
      .filter((e) => e.target === node.id && e.targetHandle === 'df-in')
      .map((e) => {
        const src = nodes.find((n) => n.id === e.source);
        return src ? { sourceNodeId: src.id, sourceNodeLabel: src.data.label } : null;
      })
      .filter(Boolean),
  }),

  // ── Lineage ────────────────────────────────────────────────────────────────
  outputs: (node, edges, nodes) => {
    const ownOutputs = (node.data.outputs || []).map((o) => ({
      id: o.id, name: o.name, type: o.type || 'string',
    }));
    if (!node.data.extendMode) return ownOutputs;
    const sourceAttrs = engine.getUpstreamAttrs(node.id, edges, nodes);
    const ownNames = new Set(ownOutputs.map((o) => o.name));
    return [...sourceAttrs.filter((a) => !ownNames.has(a.name)), ...ownOutputs];
  },

  traceUpstream: (node, colName, edges, nodes, visited) => {
    const output = (node.data.outputs || []).find((o) => o.name === colName);
    if (output) {
      const step = { nodeId: node.id, colName, nodeType: node.type, nodeLabel: node.data.label, upstream: null };
      if (output.fromInputId) {
        const inp = (node.data.inputs || []).find((i) => i.id === output.fromInputId);
        if (inp) step.upstream = engine.traceColumnUpstream(inp.sourceNodeId, inp.attrName, edges, nodes, visited);
        return step;
      }
      return { ...step, createdHere: true };
    }
    // extend mode: pass-through column from source DF
    if (node.data.extendMode) {
      const step = { nodeId: node.id, colName, nodeType: node.type, nodeLabel: node.data.label, upstream: null };
      for (const e of edges.filter((e) => e.target === node.id && e.targetHandle === 'df-in')) {
        const r = engine.traceColumnUpstream(e.source, colName, edges, nodes, visited);
        if (r) { step.upstream = r; break; }
      }
      return step.upstream ? step : null;
    }
    return null;
  },

  propagateDownstream: (node, colName, edges, nodes) =>
    engine.computeNodeOutputAttributes(node, edges, nodes).some((a) => a.name === colName) ? colName : null,

  // ── State capabilities ───────────────────────────────────────────────────
  // Paste: fresh ids for inputs and outputs (matches the legacy clone behavior).
  clone: (data) => ({
    ...data,
    inputs:  (data.inputs  || []).map((i) => ({ ...i, id: uid() })),
    outputs: (data.outputs || []).map((o) => ({ ...o, id: uid() })),
  }),

  // Refresh input attrType from live upstream, then cascade into the type of any
  // output derived from that input (fromInputId).
  refreshData: (node, edges, nodes) => {
    let changed = false;
    const inputs = (node.data.inputs || []).map((inp) => {
      const srcNode = nodes.find((s) => s.id === inp.sourceNodeId);
      if (!srcNode) {
        // Source gone: auto-heal if a same-label node with a same-name column
        // reappeared (e.g. the user recreated the deleted DataFrame).
        const healed = engine.rebindBrokenInput(inp, edges, nodes);
        if (healed) { changed = true; return healed; }
        return inp;
      }
      const liveAttr = engine.computeNodeOutputAttributes(srcNode, edges, nodes).find((a) => a.name === inp.attrName);
      if (!liveAttr || liveAttr.type === inp.attrType) return inp;
      changed = true;
      return { ...inp, attrType: liveAttr.type };
    });
    const outputs = (node.data.outputs || []).map((o) => {
      if (!o.fromInputId) return o;
      const inp = inputs.find((i) => i.id === o.fromInputId);
      if (!inp || inp.attrType === o.type) return o;
      changed = true;
      return { ...o, type: inp.attrType };
    });
    return changed ? { ...node.data, inputs, outputs } : null;
  },

  validate: (node) => {
    if (!(node.data.outputs || []).length && !node.data.extendMode) {
      return [{ nodeId: node.id, severity: 'warning', code: 'function-no-outputs', message: 'Function defines no output columns' }];
    }
    return [];
  },

  toPandas: (node, ctx) => {
    const inputs = node.data.inputs || [];
    const up = ctx.upstreamVars(node, 'df-in')[0]
      || (inputs[0]?.sourceNodeId && ctx.varOf(inputs[0].sourceNodeId))
      || '<source>';
    const lines = [`${ctx.var} = ${up}.copy()  # function: ${node.data.label}`];
    for (const o of (node.data.outputs || [])) {
      lines.push(`${ctx.var}['${o.name}'] = None  # TODO: compute ${o.name}`);
    }
    return lines.join('\n');
  },

  useCallbacks: ({ setNodes, setEdges, pushHistory }) => useFunctionCallbacks(setNodes, setEdges, pushHistory),
};

export default functionSpec;
