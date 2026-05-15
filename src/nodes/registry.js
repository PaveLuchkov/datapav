import React from 'react';
import NodeErrorBoundary from '../components/NodeErrorBoundary';

import DataFrameNode  from './dataframe/index';
import MergeNode      from './merge/index';
import FunctionNode   from './function/index';
import FilterNode     from './filter/index';
import GroupByNode    from './groupby/index';
import CommentNode    from './comment/index';
import RenameNode     from './rename/index';
import ConcatNode     from './concat/index';
import TransformNode  from './transform/index';

import dataframeConfig  from './dataframe/config';
import mergeConfig      from './merge/config';
import functionConfig   from './function/config';
import filterConfig     from './filter/config';
import groupByConfig    from './groupby/config';
import commentConfig    from './comment/config';
import renameConfig     from './rename/config';
import concatConfig     from './concat/config';
import transformConfig  from './transform/config';

// ── Registry ───────────────────────────────────────────────────────────────
// Each entry: { config, component }
// To add a new node type: create nodes/<type>/{index.jsx,config.js,callbacks.js},
// then append one entry here.

export const NODE_REGISTRY = [
  { config: dataframeConfig,  component: DataFrameNode  },
  { config: mergeConfig,      component: MergeNode      },
  { config: functionConfig,   component: FunctionNode   },
  { config: filterConfig,     component: FilterNode     },
  { config: groupByConfig,    component: GroupByNode    },
  { config: commentConfig,    component: CommentNode    },
  { config: renameConfig,     component: RenameNode     },
  { config: concatConfig,     component: ConcatNode     },
  { config: transformConfig,  component: TransformNode  },
];

// ── ReactFlow nodeTypes ────────────────────────────────────────────────────

function withErrorBoundary(NodeComponent) {
  return function BoundedNode(props) {
    return React.createElement(NodeErrorBoundary, null, React.createElement(NodeComponent, props));
  };
}

export const nodeTypes = Object.fromEntries(
  NODE_REGISTRY.map(({ config, component }) => [config.type, withErrorBoundary(component)])
);

// ── MiniMap ────────────────────────────────────────────────────────────────

export function getMinimapColor(node) {
  const entry = NODE_REGISTRY.find((e) => e.config.type === node.type);
  return entry?.config.minimapColor ?? '#1a3a5c';
}

// ── isValidConnection ──────────────────────────────────────────────────────
// Column-level lineage rule applies to all node types.
// Node-level rules come from each config's `connections` array: [srcHandle, tgtHandle].

const nodeRules = NODE_REGISTRY.flatMap(({ config }) =>
  (config.connections ?? []).map(([src, tgt]) => ({ src, tgt }))
);

export function isValidConnection({ sourceHandle, targetHandle }) {
  if (sourceHandle?.endsWith('-source') && targetHandle?.endsWith('-target')) return true;
  if (sourceHandle === 'df-out' && targetHandle === 'df-in') return true;
  return nodeRules.some(({ src, tgt }) => sourceHandle === src && targetHandle === tgt);
}

// ── Add-node menu items ────────────────────────────────────────────────────
// Configs without a `menu` field (e.g. mergeNode) are excluded.

export const ADDABLE_NODES = NODE_REGISTRY
  .filter(({ config }) => config.menu)
  .map(({ config }) => ({ type: config.type, ...config.menu }));

// ── Dagre layout helpers ───────────────────────────────────────────────────

export function getDagreWidth(nodeType) {
  const entry = NODE_REGISTRY.find((e) => e.config.type === nodeType);
  return entry?.config.dagreWidth ?? 220;
}

export function getDagreHeight(node) {
  const entry = NODE_REGISTRY.find((e) => e.config.type === node.type);
  return entry?.config.dagreHeight?.(node) ?? 100;
}

// ── Display name for context menu ─────────────────────────────────────────

export function getNodeDisplayName(nodeType) {
  const entry = NODE_REGISTRY.find((e) => e.config.type === nodeType);
  return entry?.config.menu?.label ?? nodeType;
}
