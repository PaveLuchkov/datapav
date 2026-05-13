import dagre from 'dagre';
import { getDagreWidth, getDagreHeight } from '../nodes/registry';

export function useAutoLayout() {
  const applyLayout = (nodes, edges) => {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'LR', nodesep: 48, ranksep: 80, marginx: 40, marginy: 40 });

    for (const node of nodes) {
      g.setNode(node.id, { width: getDagreWidth(node.type), height: getDagreHeight(node) });
    }
    for (const edge of edges) {
      g.setEdge(edge.source, edge.target);
    }

    dagre.layout(g);

    return nodes.map((node) => {
      const { x, y } = g.node(node.id);
      const w = getDagreWidth(node.type);
      const h = getDagreHeight(node);
      return { ...node, position: { x: x - w / 2, y: y - h / 2 } };
    });
  };

  return { applyLayout };
}
