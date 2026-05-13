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
- `dagre` — auto-layout

### Dev server
Running at **http://localhost:3001** (port 3000 was occupied).
Start with: `PORT=3001 npm start` from `lineage-editor/`.

### Git history (latest first)
```
0a2cf8a  Add test suite: 22 tests across App, EditableText, ContextMenu, useLineagePersistence
0332269  Add NodeErrorBoundary to isolate node render crashes
283ac66  Refactor: extract ContextMenu component and useContextMenu hook
999a438  Refactor: extract shared components, constants, and custom hooks
9c10dbb  Fix node ID collisions across sessions by seeding idCounter from Date.now()
f0c0dc8  Fix keyPairs not iterable crash when MergeNode data lacks keyPairs field
7e9bece  Redesign MergeNode: two-panel layout with dropdown key selectors and auto output columns
6af74e3  Add FunctionNode: two-panel black-box operator with grouped inputs and draggable outputs
8394c54  Add MergeNode: visual join operator with type selector and key pairs editor
```

---

## File Map

```
src/
├── components/
│   ├── ContextMenu.jsx       — Presentational context menu (pane / node variants)
│   ├── DragContext.jsx       — React Context with useRef for drag state (no re-renders)
│   ├── EditableText.jsx      — Shared inline-edit component (double-click to edit)
│   ├── NodeErrorBoundary.jsx — Class component; isolates node render crashes
│   └── SearchModal.jsx       — Cmd+K search overlay: label + column search, keyboard nav
├── hooks/
│   ├── useAutoLayout.js      — dagre LR layout; returns applyLayout(nodes, edges)
│   ├── useContextMenu.js     — menu state + onPaneContextMenu / onNodeContextMenu
│   ├── useLineagePersistence.js — save / load localStorage, export PNG
│   └── useLineageState.js    — all nodes/edges state, callbacks, history, graph operations
├── constants.js              — DRAG_TYPE, STORAGE_KEY, COLORS, SIZES, JOIN_TYPES, ATTR_TYPES, ATTR_TYPE_META
├── App.jsx                   — UI shell: ReactFlow wiring, toast, toolbar actions
├── DataFrameNode.jsx         — Custom RF node: editable title, draggable attribute rows, type badges
├── FunctionNode.jsx          — Custom RF node: input drop zone + draggable outputs
├── MergeNode.jsx             — Custom RF node: join type, key pairs, output columns
└── Toolbar.jsx               — Top bar buttons
```

---

## Feature Inventory

### DataFrameNode
- Double-click title or any column name → inline edit (Enter/Escape)
- `+` button in header → add column
- Hover column → `×` appears → delete column (also removes connected edges)
- Hover column → grip icon `⠿` → **drag within same node** to reorder
  - Blue insert-line indicator shows drop position
- **Drag column onto a different DataFrame** → column is copied there + lineage edge created automatically; type is preserved
- Per-column handles: left dot (target) + right dot (source) for manual edge drawing
- Two teal square handles at top corners:
  - `df-in` (top-left) — receives connection from MergeNode output
  - `df-out` (top-right) — sends connection to MergeNode input
- **Type badge** (`str`/`int`/`flt`/`dat`/`bool`) before each column name — click to cycle type; colored per type

### FunctionNode
- Drop columns from any node onto the Inputs panel → creates input entry + edge
- Add/delete/rename output columns
- Outputs are draggable → can link to other nodes
- Inputs grouped by source node label

### MergeNode
- Created by: select exactly 2 DataFrames → toolbar **⋈ Merge** button (or right-click canvas)
- Auto-wires: left DF → L input, right DF → R input, out → new `result_df`
- Join type toggle: `inner` / `left` / `right` / `outer` (color-coded)
- Key pairs editor: add/remove `left_col = right_col` pairs with dropdowns
- Auto-shows output columns from both connected DFs (draggable to link downstream)

### Canvas
- Pan + zoom (React Flow built-in)
- Drag nodes from header area
- Right-click canvas → "Add DataFrame here" / "ƒ Add Function here" (at cursor position)
- Right-click node → "Delete …"
- Select nodes + Delete key → removes nodes and their edges
- Click edge + Delete → removes edge
- `isValidConnection` enforces edge semantics:
  - `-source` → `-target` handles: column lineage only
  - `df-out` → `left-in`/`right-in`: DataFrame to MergeNode
  - `out` → `df-in`: MergeNode to DataFrame

### Undo / Redo
- `Ctrl+Z` / `Cmd+Z` — undo last mutation
- `Ctrl+Y` / `Ctrl+Shift+Z` — redo
- Also exposed as ↩ / ↪ toolbar buttons
- History stack lives in `useLineageState` (max 50 snapshots, refs-based — no re-renders)
- Every mutation (add/delete/reorder/connect/type-change/text-edit) pushes a snapshot beforehand
- Load / restoreState clears both stacks

### Auto-layout
- **⬦ Auto-arrange** toolbar button — runs dagre LR layout, then `fitView`
- `useAutoLayout.js` builds a dagre graph with type-aware node sizes
- Result goes through `restoreState`, so it is itself undoable

### Search (`Cmd+K`)
- `Cmd+K` / `Ctrl+K` opens a search modal
- Searches node labels and column names (DataFrameNode attributes, FunctionNode inputs/outputs)
- Results show type icon, node name; column matches show `node › column` with type badge
- Click result (or Enter on selected item) → `fitView` to that node with animation
- Arrow keys navigate results, Escape closes
- Empty query shows all nodes as quick-pick list

### Persistence
- Save / Load buttons → `localStorage` key `lineage-editor-state`
- Saves full `{ nodes, edges }` — all positions, types, data, edges
- First load with no saved state → demo graph: `raw_orders`, `raw_customers`, `orders_enriched`

### Export
- Export PNG → `html-to-image` renders React Flow viewport, downloads `lineage.png`
- Fits all nodes into frame before capture

---

## Architecture Notes

### Callback pattern
All node mutation callbacks live in `useLineageState` and are injected into every
node's `data` object via `attachCallbacks()` + a `callbacks.current` ref pattern.
This avoids stale closures without recreating node objects on every render.

```
callbacks.current = { onLabelChange, onAttributeChange, ... }
nodesWithCallbacks = useMemo(() => attachCallbacks(enriched, callbacks.current), [nodes, edges])
```

### Undo/Redo pattern
`history` and `future` are plain refs (not state) holding `{ nodes, edges }` snapshots.
`nodesRef`/`edgesRef` mirror current state synchronously so snapshots can be taken
before functional `setNodes`/`setEdges` updates are applied.

### Drag system
Two independent drag flows share the same HTML5 `draggable` API:

| Drag type | Source | Destination | Effect |
|---|---|---|---|
| Reorder | attribute row | same node | reorder via `onReorderAttributes` |
| Lineage | attribute row | different DataFrame | copy column + create edge |
| Function input | attribute row | FunctionNode input panel | add input entry + edge |
| Merge output | MergeNode output row | any node | create lineage edge |

`DragContext` (React Context + `useRef`) stores the active drag payload.
Read happens synchronously in event handlers — no re-renders triggered.

### Error isolation
Each node type is wrapped with `NodeErrorBoundary` via `withErrorBoundary()` in App.jsx.
A crash in one node renders an inline error card, not a blank canvas.

---

## What Failed / Dead Ends

### Tailwind v4 install
`npm install -D tailwindcss postcss autoprefixer` pulled Tailwind v4 which has
no `tailwindcss` CLI binary in node_modules/.bin — `npx tailwindcss init -p`
silently failed. Fixed by pinning `tailwindcss@3`.

### `App.js` shadowing `App.jsx`
CRA scaffolded `App.js`. After creating `App.jsx`, the old file took priority.
Fixed by deleting `App.js`, `App.css`, and `logo.svg`.

### Port conflict
`npm start` hits port 3000 which was already occupied. Must use `PORT=3001 npm start`.

### Attribute drag conflicting with node drag
First attempt used only `e.stopPropagation()` on `dragstart`. React Flow still
captured the mousedown and moved the node. Fix: add `onMouseDown: e.stopPropagation()`
on every draggable attribute row.

### `dataTransfer.getData` blocked during dragover
Tried to read payload during `onDragOver` to decide reorder vs. lineage.
Browser blocks `.getData()` during drag (only available on `drop`).
Fixed with the `DragContext` ref set at `dragstart`.

---

## Next Things To Build

### Medium priority

**Export to SQL**
The graph already contains all structure needed to generate:
```sql
SELECT l.order_id, r.name, r.email
FROM raw_orders l
INNER JOIN raw_customers r ON l.customer_id = r.customer_id
```
Walk nodes/edges in `useLineagePersistence`, generate SQL string, copy to clipboard
or download as `.sql`. Start with MergeNode → `JOIN`, DataFrameNode → `FROM`.

**Copy / paste nodes (`Ctrl+C` / `Ctrl+D`)**
Duplicating a DataFrame with the same columns is a frequent operation.
Store copied node in a ref, paste offset by (+40, +40).

### Lower priority

**Comments / annotation nodes**
Free-text sticky notes on the canvas.
A fourth node type with no handles, just a textarea.

**Import from schema**
Upload a JSON or CSV → auto-create DataFrameNode(s) with columns pre-filled.
Useful for bootstrapping from an existing data model.

**Validation layer**
Highlight problems:
- MergeNode with no key pairs (unintentional cross join)
- Disconnected MergeNode inputs
- Circular lineage paths

**Multiple canvases / tabs**
Multiple independent graphs in one session.
Each tab saves to its own `localStorage` key.

**GroupBy / Agg node**
Same operator pattern as MergeNode.
Select input columns, pick aggregation function (`sum`, `mean`, `count`, etc.),
name output columns.

**Filter node**
Document `.query()` / `.loc[]` / `WHERE` operations.
Single input, single output, a condition text field in the body.

**Edge label tooltips**
Show the source column name on hover over a lineage edge.
ReactFlow supports custom edge components — add a `<EdgeLabelRenderer>` overlay.
