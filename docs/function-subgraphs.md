# Design: Function subgraphs ("drill in")

> Status: **v1 built** (drill-in sub-canvas, signature proxies, breadcrumbs,
> composed-root persistence — `src/hooks/useSubgraphDrill.js`). v2 (cross-boundary
> tracing/outputs) and v3 (reusable modules) remain. Companion idea:
> [data-catalog.md](./data-catalog.md).

## Problem

Big pipelines get heavy on one flat canvas. The natural mental model (the user's):
build the **main thread top-down**, and when you need detail, **click into a unit**
to see/configure its inner logic — like opening a function that itself calls other
functions. This is the original "expand Function" goal.

## Shape

The **Function node is already a module signature** — it has typed *inputs* and
declared *outputs*. Give it a *body*: double-click to open its **own sub-canvas**
where you wire DataFrames/operators to produce its outputs.

- The Function's inputs appear inside as **input-proxy** nodes (parameters).
- Its outputs appear inside as **output-proxy** nodes (the return).
- The outer canvas shows the collapsed Function box; a **breadcrumb**
  (`pipeline › enrich_orders › …`) tracks depth.

## Why it's feasible on the current architecture

- **Tabs** already manage multiple canvases → "drill in" is a scoped canvas +
  breadcrumb stack.
- **Persistence rides `node.data`** → a subgraph is just
  `functionNode.data.subgraph = { nodes, edges }`; it serializes / shares / undoes
  for free.
- **Tracing is recursive + cycle-safe** → ◎ can descend across the boundary
  (output-proxy → inner graph → input-proxy → outer source).
- **Spec system** → the behavior lives in the Function spec; no other node changes.

## Staging plan

- **v1** — open-in-place sub-canvas with input/output proxies; no cross-boundary
  trace yet. Cures canvas heaviness by collapsing detail into named modules.
- **v2** — tracing + `outputs` computation descend into the subgraph (replace the
  manual `fromInputId` link with the subgraph's actual wiring).
- **v3** — reusable/instanceable modules: define once, drop many; edits propagate.

## Hard parts to resolve in design

- Boundary mapping: outer input edge ↔ inner input-proxy; inner output-proxy ↔
  outer output column.
- Lineage across the boundary (depends on v2).
- Navigation/UX: breadcrumbs, collapse/expand, where "back out" lives.
