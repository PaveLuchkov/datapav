function q(name) {
  return /\s/.test(name) ? `"${name}"` : name;
}

function getNode(nodes, id) {
  return nodes.find((n) => n.id === id) ?? null;
}

function mergeToSql(node, nodes, edges) {
  const leftEdge  = edges.find((e) => e.target === node.id && e.targetHandle === 'left-in');
  const rightEdge = edges.find((e) => e.target === node.id && e.targetHandle === 'right-in');
  const outEdge   = edges.find((e) => e.source === node.id && e.sourceHandle === 'out');

  const leftNode   = leftEdge  ? getNode(nodes, leftEdge.source)  : null;
  const rightNode  = rightEdge ? getNode(nodes, rightEdge.source) : null;
  const resultNode = outEdge   ? getNode(nodes, outEdge.target)   : null;

  const { joinType = 'inner', keyPairs = [] } = node.data;
  const leftLabel  = leftNode  ? q(leftNode.data.label)  : '<left_df>';
  const rightLabel = rightNode ? q(rightNode.data.label) : '<right_df>';
  const leftCols   = leftNode  ? (leftNode.data.attributes || []) : [];
  const rightCols  = rightNode ? (rightNode.data.attributes || []) : [];

  const selectLines = [
    ...leftCols.map((a) => `    l.${q(a.name)}`),
    ...rightCols.map((a) => `    r.${q(a.name)}`),
  ];

  const onClauses = keyPairs
    .filter((p) => p.left && p.right)
    .map((p, i) => `${i === 0 ? '  ON ' : '  AND '}l.${q(p.left)} = r.${q(p.right)}`);

  const header = resultNode
    ? `-- ⋈ Merge → ${resultNode.data.label}`
    : '-- ⋈ Merge';

  return [
    header,
    'SELECT',
    selectLines.length ? selectLines.join(',\n') : '    *',
    `FROM ${leftLabel} l`,
    `${joinType.toUpperCase()} JOIN ${rightLabel} r`,
    onClauses.length ? onClauses.join('\n') : '  ON TRUE  -- no key pairs defined',
  ].join('\n') + ';';
}

function filterToSql(node, nodes, edges) {
  const inEdge  = edges.find((e) => e.target === node.id && e.targetHandle === 'filter-in');
  const outEdge = edges.find((e) => e.source === node.id && e.sourceHandle === 'filter-out');
  const inputNode  = inEdge  ? getNode(nodes, inEdge.source)  : null;
  const outputNode = outEdge ? getNode(nodes, outEdge.target) : null;

  const { label = 'filter', condition = '' } = node.data;
  const from = inputNode ? q(inputNode.data.label) : '<source_df>';
  const header = outputNode
    ? `-- σ Filter: ${label} → ${outputNode.data.label}`
    : `-- σ Filter: ${label}`;

  return [
    header,
    'SELECT *',
    `FROM ${from}`,
    condition ? `WHERE ${condition}` : 'WHERE TRUE  -- condition not set',
  ].join('\n') + ';';
}

function groupByToSql(node) {
  const { label = 'groupby', inputs = [], groupByInputIds = [], aggregations = [] } = node.data;

  const keyInputs  = inputs.filter((i) => groupByInputIds.includes(i.id));
  const groupCols  = keyInputs.map((i) => q(i.attrName));

  const sourceTables = [...new Set(inputs.map((i) => i.sourceNodeLabel).filter(Boolean))];
  const fromClause   = sourceTables.length ? sourceTables.map(q).join(', ') : '<source>';

  const selectLines = [
    ...groupCols.map((c) => `    ${c}`),
    ...aggregations.map((agg) => {
      const inp   = inputs.find((i) => i.id === agg.inputId);
      const col   = inp ? q(inp.attrName) : '<col>';
      const alias = agg.outputName || `${agg.func}_${inp?.attrName ?? 'col'}`;
      return `    ${agg.func.toUpperCase()}(${col}) AS ${q(alias)}`;
    }),
  ];

  const lines = [
    `-- ⊞ GroupBy: ${label}`,
    'SELECT',
    selectLines.length ? selectLines.join(',\n') : '    *',
    `FROM ${fromClause}`,
  ];

  if (groupCols.length) {
    lines.push(`GROUP BY ${groupCols.join(', ')}`);
  } else {
    lines.push('-- no GROUP BY keys defined');
  }

  return lines.join('\n') + ';';
}

export function generateSql(nodes, edges) {
  const dfNodes     = nodes.filter((n) => n.type === 'dataFrameNode');
  const mergeNodes  = nodes.filter((n) => n.type === 'mergeNode');
  const filterNodes = nodes.filter((n) => n.type === 'filterNode');
  const gbNodes     = nodes.filter((n) => n.type === 'groupByNode');

  const incomingTargets = new Set(
    edges
      .filter((e) => ['df-in', 'left-in', 'right-in', 'filter-in'].includes(e.targetHandle))
      .map((e) => e.target)
  );

  const sourceDFs = dfNodes.filter((n) => !incomingTargets.has(n.id));
  const parts = [];

  if (sourceDFs.length) {
    const comments = sourceDFs.map((n) => {
      const cols = (n.data.attributes || [])
        .map((a) => `${a.name} (${(a.type || 'string').slice(0, 3)})`)
        .join(', ');
      return `-- Table: ${n.data.label}${cols ? `\n-- Columns: ${cols}` : ''}`;
    });
    parts.push('-- ─── Source Tables ─────────────────────────────────────────\n' + comments.join('\n'));
  }

  if (mergeNodes.length) {
    parts.push(mergeNodes.map((n) => mergeToSql(n, nodes, edges)).join('\n\n'));
  }

  if (filterNodes.length) {
    parts.push(filterNodes.map((n) => filterToSql(n, nodes, edges)).join('\n\n'));
  }

  if (gbNodes.length) {
    parts.push(gbNodes.map((n) => groupByToSql(n)).join('\n\n'));
  }

  return parts.length ? parts.join('\n\n') : '-- No operator nodes to export';
}
