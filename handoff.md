# Lineage Editor — Session Handoff

## Goal

A web app for a data analyst to visually document DataFrame lineage.
The mental model: you build a graph where nodes are DataFrames (with columns),
edges are derivation relationships between columns, and join operations are
explicit MergeNodes sitting between source and result DataFrames.

End state imagined: open the app, drag columns across DataFrames to show where
each column came from, place a MergeNode to document a join, export the diagram
as PNG or save it for the next session.

---

## What's Built (current state)

### Stack
- `create-react-app` (CRA) — intentionally chosen for zero-config, despite deprecation warnings
- React Flow (`reactflow`) — canvas, nodes, edges, handles, pan/zoom
- Tailwind CSS v3 — utility styles
- `html-to-image` — PNG export

### Dev server
Running at **http://localhost:3001** (port 3000 was occupied).
Start with: `PORT=3001 npm start` from `lineage-editor/`.

### Git history
```
8394c54  Add MergeNode: visual join operator with type selector and key pairs editor
c6a86de  Add drag-to-reorder attributes within a DataFrame node
49a4e05  Add lineage editor: React Flow canvas with drag-to-derive attribute linking
cfe7ead  Initialize project using Create React App
```

---

## File Map

| File | Role |
|---|---|
| `src/App.jsx` | Root: state, all callbacks, ReactFlow wiring, context menu, toolbar actions |
| `src/DataFrameNode.jsx` | Custom RF node: editable title, draggable/reorderable attribute rows, drop zones |
| `src/MergeNode.jsx` | Custom RF node: join type selector, key pairs editor, L/R/out handles |
| `src/Toolbar.jsx` | Top bar: DataFrame, Merge, Save, Load, Export PNG buttons |
| `src/index.css` | Dark theme base + React Flow handle/edge overrides |

---

## Feature Inventory

### DataFrameNode
- Double-click title or any column name → inline edit (Enter/Escape)
- `+` button in header → add column
- Hover column → `×` appears → delete column (also removes connected edges)
- Hover column → grip icon `⠿` → **drag within same node** to reorder
  - Blue insert-line indicator shows drop position
- **Drag column onto a different DataFrame** → column is copied there + lineage edge created automatically
- Per-column handles: left dot (target) + right dot (source) for manual edge drawing
- Two teal square handles at top corners:
  - `df-in` (top-left) — receives connection from MergeNode output
  - `df-out` (top-right) — sends connection to MergeNode input

### MergeNode
- Created by: select exactly 2 DataFrames → toolbar **⋈ Merge** button (or right-click canvas → "⋈ Merge selected DFs")
- Auto-wires: left DF → L input, right DF → R input, out → new `result_df`
- Join type toggle: `inner` / `left` / `right` / `outer` (color-coded)
- Key pairs editor: add/remove `left_col = right_col` pairs, editable inline
- Handles: `left-in` (top-left), `right-in` (bottom-left), `out` (right)

### Canvas
- Pan + zoom (React Flow built-in)
- Drag nodes from header area
- Right-click canvas → "Add DataFrame here" (at cursor flow position)
- Right-click node → "Delete DataFrame" / "Delete Merge"
- Select nodes + Delete key → removes nodes and their edges
- Click edge + Delete → removes edge
- `isValidConnection` enforces edge semantics:
  - `-source` → `-target` handles: column lineage only
  - `df-out` → `left-in`/`right-in`: DataFrame to MergeNode
  - `out` → `df-in`: MergeNode to DataFrame

### Persistence
- Save / Load buttons → `localStorage` key `lineage-editor-state`
- Saves full `{ nodes, edges }` — all node positions, types, data, all edges
- First load with no saved state → demo graph: `raw_orders`, `raw_customers`, `orders_enriched`

### Export
- Export PNG → `html-to-image` renders the React Flow viewport, downloads `lineage.png`
- Fits all nodes into frame before capture

---

## Callback Architecture (important)

All node mutation callbacks live in `App.jsx` and are injected into every node's
`data` object via `attachCallbacks()` + a `callbacks.current` ref pattern.
This avoids stale closures without recreating node objects on every render.

```
callbacks.current = { onLabelChange, onAttributeChange, onAddAttribute,
                      onDeleteAttribute, onReorderAttributes, onAttributeDrop,
                      onJoinTypeChange, onAddKey, onRemoveKey, onUpdateKey }

nodesWithCallbacks = useMemo(() => attachCallbacks(nodes, callbacks.current), [nodes])
```

Nodes call e.g. `data.onLabelChange(id, newLabel)` — never touch state directly.

---

## Drag System

Two independent drag flows share the same HTML5 `draggable` API:

| Drag type | Source | Destination | Effect |
|---|---|---|---|
| Reorder | attribute row | same node | reorder via `onReorderAttributes` |
| Lineage | attribute row | different node | copy column + create edge |

A module-level `activeDrag` variable (set on `dragStart`, cleared on `dragEnd`)
lets `onDragOver` handlers know which type of drag is in progress without
reading `dataTransfer` data (which is blocked during dragover for security).

Attribute rows use `onMouseDown: stopPropagation` to prevent React Flow from
treating the row drag as a node move.

---

## What Failed / Dead Ends

### Tailwind v4 install
`npm install -D tailwindcss postcss autoprefixer` pulled Tailwind v4 which has
no `tailwindcss` CLI binary in node_modules/.bin — `npx tailwindcss init -p`
silently failed. Fixed by pinning `tailwindcss@3`.

### `App.js` shadowing `App.jsx`
CRA scaffolded `App.js`. After creating `App.jsx`, the old file took priority
and the default CRA page kept showing. Fixed by deleting `App.js`, `App.css`,
and `logo.svg`.

### Port conflict
`npm start` hits port 3000 which was already occupied. Must use `PORT=3001 npm start`.

### Attribute drag conflicting with node drag
First attempt used only `e.stopPropagation()` on `dragstart`. React Flow still
captured the mousedown and moved the node. Fix: add `onMouseDown: e.stopPropagation()`
on every draggable attribute row so React Flow never sees the mousedown.

### `dataTransfer.getData` blocked during dragover
Tried to read payload during `onDragOver` to decide reorder vs. lineage.
Browser blocks `.getData()` during drag (only available on `drop`).
Fixed with the `activeDrag` module-level variable set at `dragstart`.

---

## Next Things To Build (not started)

- **GroupBy / Agg node** — same operator pattern as MergeNode (select columns, aggregation functions)
- **Filter node** — document `.query()` or `.loc[]` operations with condition text
- **Edge label tooltips** — show source column name on lineage edges on hover
- **MergeNode: show connected DF names** in L/R slots (requires reading edge graph at render time)
- **Multi-key same-name shortcut** — if left_col == right_col, single input field with `on=` label
- **JSON export** — export the graph as structured lineage JSON (not just PNG)
- **Undo/Redo** — React Flow has `useUndoable` patterns; nothing in place now
