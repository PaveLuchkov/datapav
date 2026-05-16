// Single source of truth: "what columns does a node output?"
// Used by useLineageState to inject connectedAttrs, leftDF/rightDF,
// and to drive the result-DF auto-sync.

function inferAggType(func, inputType) {
  if (func === 'count' || func === 'nunique') return 'int';
  if (func === 'mean') return 'float';
  if (func === 'sum') return (inputType === 'int' || inputType === 'float') ? inputType : 'float';
  // min, max, first, last — preserve source type
  return inputType || 'string';
}

export function computeNodeOutputAttributes(node, edges, nodes) {
  switch (node.type) {
    case 'dataFrameNode':
      return node.data.attributes || [];

    case 'functionNode':
      return (node.data.outputs || []).map((o) => ({
        id: o.id, name: o.name, type: o.type || 'string',
      }));

    case 'filterNode':
    case 'concatNode':
      return getUpstreamAttrs(node.id, edges, nodes);

    case 'renameNode': {
      const upstream = getUpstreamAttrs(node.id, edges, nodes);
      const upByName = new Map(upstream.map((a) => [a.name, a]));
      return (node.data.mappings || [])
        .filter((m) => m.to)
        .map((m) => {
          const src = upByName.get(m.from);
          return { id: m.id, name: m.to, type: src?.type || 'string' };
        });
    }

    case 'transformNode':
      return node.data.attributes || [];

    case 'groupByNode': {
      const inputs = node.data.inputs || [];
      const keys = (node.data.groupByInputIds || [])
        .map((gid) => inputs.find((i) => i.id === gid))
        .filter(Boolean)
        .map((i) => ({ id: i.id, name: i.attrName, type: i.attrType || 'string' }));
      const aggs = (node.data.aggregations || [])
        .filter((a) => a.outputName)
        .map((a) => {
          const inp = inputs.find((i) => i.id === a.inputId);
          return { id: a.id, name: a.outputName, type: inferAggType(a.func, inp?.attrType) };
        });
      return [...keys, ...aggs];
    }

    case 'mergeNode': {
      const leftEdge  = edges.find((e) => e.target === node.id && e.targetHandle === 'left-in');
      const rightEdge = edges.find((e) => e.target === node.id && e.targetHandle === 'right-in');
      const leftNode  = leftEdge  ? nodes.find((n) => n.id === leftEdge.source)  : null;
      const rightNode = rightEdge ? nodes.find((n) => n.id === rightEdge.source) : null;
      const lAttrs = leftNode  ? computeNodeOutputAttributes(leftNode,  edges, nodes) : [];
      const rAttrs = rightNode ? computeNodeOutputAttributes(rightNode, edges, nodes) : [];
      const seen = new Set(lAttrs.map((a) => a.name));
      return [...lAttrs, ...rAttrs.filter((a) => !seen.has(a.name))];
    }

    default:
      return [];
  }
}

// Deduplicated union of output attributes from all nodes connected via df-in
// (or a specific handle) to nodeId.
export function getUpstreamAttrs(nodeId, edges, nodes, handleId = 'df-in') {
  const seen = new Map();
  for (const e of edges) {
    if (e.target !== nodeId || e.targetHandle !== handleId) continue;
    const src = nodes.find((n) => n.id === e.source);
    if (!src) continue;
    for (const attr of computeNodeOutputAttributes(src, edges, nodes)) {
      if (!seen.has(attr.name)) seen.set(attr.name, attr);
    }
  }
  return [...seen.values()];
}
