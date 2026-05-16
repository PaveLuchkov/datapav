# Lineage Editor — Session Handoff

## Goal

A web app for a data analyst to visually document DataFrame lineage.
The mental model: you build a graph where nodes are DataFrames (with columns),
edges are derivation relationships between columns, and operator nodes (Merge, Filter, GroupBy)
sit between source and result DataFrames.

End state imagined: open the app, drag columns across DataFrames to show where
each column came from, place operator nodes to document transformations, export the diagram
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
d8bd62f  Этап 3: улучшенный поиск по всему графу
2f981c2  Этап 2: типы колонок в UI GroupByNode и FunctionNode
a8d8ce6  Этап 1: единый источник истины для колонок нод
ba9b4c5  Исправлены иконки в тулбаре и исправлены цвета навазния колонок в function
49d76c6  Fix tracker search for merge node output columns
5ad4d88  Fix ESLint unused vars blocking Vercel build
c4d4069  Add RenameNode, TransformNode, ConcatNode; stage badges, code snippets, column edges, tracker highlights
adfb4cd  handoff update
3cd47a2  track whole word and highlight it
61ea86f  Вопрос для шорткатов
```

---

## File Map

```
src/
├── nodes/                        ← one directory per node type
│   ├── registry.js               ← SINGLE entry point: nodeTypes, isValidConnection,
│   │                                getMinimapColor, ADDABLE_NODES, getDagre*, getNodeDisplayName
│   ├── dataframe/
│   │   ├── index.jsx             ← DataFrameNode component
│   │   ├── config.js             ← colors, dagreWidth/Height, make(), menu, connections
│   │   └── callbacks.js          ← useDataFrameCallbacks(setNodes, setEdges, pushHistory)
│   ├── merge/
│   │   ├── index.jsx             ← MergeNode component (TypeBadge on output columns)
│   │   ├── config.js
│   │   └── callbacks.js          ← useMergeCallbacks(setNodes, pushHistory)
│   ├── function/
│   │   ├── index.jsx             ← FunctionNode component
│   │   ├── config.js
│   │   └── callbacks.js          ← useFunctionCallbacks(setNodes, setEdges, pushHistory)
│   ├── filter/
│   │   ├── index.jsx             ← FilterNode component
│   │   ├── config.js             ← amber/orange colors; connections: [] (universal rule)
│   │   └── callbacks.js          ← useFilterCallbacks(setNodes, pushHistory)
│   ├── groupby/
│   │   ├── index.jsx             ← GroupByNode component (TypeBadge on key/agg outputs)
│   │   ├── config.js             ← sky/cyan colors; connections: [] (universal rule)
│   │   └── callbacks.js          ← useGroupByCallbacks(setNodes, setEdges, pushHistory)
│   ├── rename/
│   │   ├── index.jsx             ← RenameNode component
│   │   ├── config.js
│   │   └── callbacks.js          ← useRenameCallbacks(setNodes, pushHistory)
│   ├── transform/
│   │   ├── index.jsx             ← TransformNode component
│   │   ├── config.js
│   │   └── callbacks.js          ← useTransformCallbacks(setNodes, pushHistory)
│   ├── concat/
│   │   ├── index.jsx             ← ConcatNode component
│   │   ├── config.js
│   │   └── callbacks.js          ← useConcatCallbacks()
│   └── comment/
│       ├── index.jsx             ← CommentNode component
│       ├── config.js             ← NOTE_PALETTE (5 sticky-note colors); no connections
│       └── callbacks.js          ← useCommentCallbacks(setNodes, pushHistory)
├── utils/
│   ├── uid.js                    ← shared ID counter (Date.now() seed)
│   ├── nodeOutputAttrs.js        ← SINGLE SOURCE OF TRUTH for column output per node type:
│   │                                computeNodeOutputAttributes(node, edges, nodes) → Attr[]
│   │                                getUpstreamAttrs(nodeId, edges, nodes, handleId?) → Attr[]
│   │                                inferAggType(func, inputType) → type string
│   └── exportSql.js              ← SQL generation from graph
├── components/
│   ├── AttributeTrackerPanel.jsx ← Track overlay (Ctrl+Shift+F): input + suggestions dropdown
│   ├── ColumnEdge.jsx            ← custom edge type showing column name on hover
│   ├── ColumnSelect.jsx          ← shared column selector with fallback to text input
│   ├── ContextMenu.jsx           ← reads ADDABLE_NODES from registry; node label from getNodeDisplayName
│   ├── DragContext.jsx           ← React Context with useRef for drag state (no re-renders)
│   ├── EditableText.jsx          ← shared inline-edit component (double-click to edit)
│   ├── HighlightedConditionInput.jsx ← textarea with @column syntax highlighting + autocomplete
│   ├── NodeCodeBlock.jsx         ← collapsible code snippet block (toggled via </> button)
│   ├── NodeErrorBoundary.jsx     ← class component; isolates node render crashes
│   ├── SearchModal.jsx           ← Cmd+K search overlay (searches all node types via _outputAttrs)
│   ├── ShortcutsModal.jsx        ← ? keyboard shortcuts reference overlay
│   ├── SqlExportModal.jsx        ← modal showing generated SQL with copy button
│   ├── SqlImportModal.jsx        ← modal to paste SQL SELECT → auto-create DataFrameNode
│   ├── StageBadge.jsx            ← clickable stage pill on node header
│   └── TabBar.jsx                ← canvas tabs bar (add, rename, close, switch)
├── hooks/
│   ├── useAutoLayout.js          ← dagre LR layout; sizes come from registry
│   ├── useCanvasTabs.js          ← multi-canvas tab state; each tab saved to its own localStorage key
│   ├── useContextMenu.js         ← menu state + onPaneContextMenu / onNodeContextMenu
│   ├── useLineagePersistence.js  ← save / load localStorage, export PNG, save/load JSON file
│   └── useLineageState.js        ← state + history; composes per-type callback hooks;
│                                    addNodeOfType(type, x, y) uses registry config.make();
│                                    clipboard/pasteCount refs for copy-paste;
│                                    connectedDFs derived from edges for FunctionNode/ConcatNode;
│                                    connectedAttrs injected via getUpstreamAttrs for
│                                      FilterNode/RenameNode/TransformNode;
│                                    leftDF/rightDF injected via computeNodeOutputAttributes
│                                      for MergeNode (works for chained merges);
│                                    result-DF column sync via useEffect — now covers ALL
│                                      operator nodes (not just MergeNode)
├── constants.js                  ← DRAG_TYPE, STORAGE_KEY, TABS_KEY, ACTIVE_TAB_KEY, canvasKey(),
│                                    JOIN_TYPES, JOIN_ACTIVE_STYLES,
│                                    ATTR_TYPES, ATTR_TYPE_META  (no per-node colors/sizes)
├── App.jsx                       ← UI shell: imports nodeTypes/isValidConnection/getMinimapColor
│                                    from registry; passes addableNodes to Toolbar + ContextMenu;
│                                    owns tracker state (trackerQuery, trackerWholeWord);
│                                    injects trackerHighlight into node.data via trackedNodes memo;
│                                    builds nodesForSearch (adds _outputAttrs field) for SearchModal;
│                                    displayEdges resolves column names for all handle patterns
│                                      incl. aggout- (GroupByNode agg), gbout- (GroupBy keys),
│                                      mout-[LR]- (MergeNode)
└── Toolbar.jsx                   ← add-node buttons rendered from ADDABLE_NODES
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
  - `df-in` (top-left) — receives any `df-out` connection
  - `df-out` (top-right) — sends to any node's `df-in`, or to `left-in`/`right-in` on MergeNode
- **Type badge** (`str`/`int`/`flt`/`dat`/`bool`) before each column name — click to cycle type; colored per type
- **Auto-synced**: if a DataFrameNode is connected via `df-in` to any operator node (MergeNode, FunctionNode, GroupByNode, etc.), its columns are automatically overwritten by `computeNodeOutputAttributes` of the upstream node

### FunctionNode
- Drop columns from any node onto the Inputs panel → creates input entry + edge
- **Drag `df-out` handle from any node → `df-in` on FunctionNode** → adds the whole DataFrame as a named input group with no columns; additional column drops from that same DF appear within the group
- `connectedDFs` is derived live from edges (not stored in node data): any node whose `df-out → df-in` edge targets this function shows up as a group header even if no individual columns are dropped
- Add/delete/rename output columns; each output has explicit type (clickable to cycle)
- Outputs are draggable → carry correct `attrType` in drag payload
- Two square handles at top corners:
  - `df-in` (top-left) — receives DF-level connections
  - `df-out` (top-right) — sends DF-level output downstream

### MergeNode
- Created by: select exactly 2 nodes (any mix of DataFrameNode / MergeNode) → toolbar **⋈ Merge** button (or right-click canvas)
- Auto-wires: left node `df-out → left-in`, right node `df-out → right-in`; **no result_df is auto-created** — user manually connects `df-out` to wherever the output goes
- Join type toggle: `inner` / `left` / `right` / `outer` (color-coded)
- Key pairs editor: add/remove `left_col = right_col` pairs with dropdowns
- Auto-shows output columns from both connected DFs (draggable to link downstream)
  - **TypeBadge displayed** for each output column (L/R side indicator + type)
  - `leftDF/rightDF.attributes` are computed via `computeNodeOutputAttributes` — works correctly for chained merges (MergeNode → MergeNode)
- **Drag payload includes `attrType`** so type is preserved when dragging merge output columns downstream
- **Chained merges**: selecting a MergeNode + another node as sources works the same way
- Square handle: `df-out` (top-right) — purple, source for downstream connections

### FilterNode (amber/orange)
- Square handles at top corners: `df-in` (left) ← from any `df-out`; `df-out` (right) → to any `df-in`
- Header: editable label
- **Multi-condition WHERE builder**:
  - First row is always `where` (non-clickable badge)
  - `+ and` / `+ or` buttons add new condition rows
  - Each added row has a clickable `and`/`or` badge — click to toggle between AND and OR
  - `×` removes a row (available when more than one condition exists)
  - Each expression field is a **`HighlightedConditionInput`** — auto-resizing textarea with:
    - `@column_name` syntax: highlights `@mentions` with amber backdrop as you type
    - Dropdown autocomplete triggered by `@`: suggests column names from upstream DFs **with type badges**
    - Inputs debounced 400 ms before saving
- **Backward compat**: old saves with a single `condition` string are read as one WHERE row
- `connectedAttrs` injected via `getUpstreamAttrs` — types come from the unified utility

### GroupByNode (sky/cyan)
- Square handles at top corners: `df-in` (top-left), `df-out` (top-right) — universal DF-level connections
- **Left panel (Inputs)**: drop zone; drag columns from any node → creates input entry + cyan edge
  - Inputs grouped by source node label
  - Toggle button `⊞` / `○` per input to mark it as a group-by key
  - `×` to delete input (also removes from keys and any aggregations referencing it)
- **Right panel (Outputs)**:
  - *Group by* section: inputs marked as keys appear here with **TypeBadge** and a draggable source handle
  - *Aggregations* section: rows of (column dropdown, function, output name) each with **TypeBadge showing inferred type** and source handle
    - Type inference: `count`/`nunique` → `int`, `mean` → `float`, `sum` → preserves `int`/`float`, `min`/`max`/`first`/`last` → preserves source type
  - Agg functions: `sum` / `nunique` / `mean` / `count` / `min` / `max` / `first` / `last`
- **Drag payload includes `attrType`** for both key outputs and aggregation outputs
- `cloneNodeData` in `useLineageState` remaps inputs + groupByInputIds + aggregation.inputId on paste

### RenameNode (indigo)
- Square handles at top corners: `df-in` (left), `df-out` (right)
- Header: editable label
- Rows of `old_name → new_name` mappings with column selector for old name
- `connectedAttrs` injected from upstream via `getUpstreamAttrs` — type of source column is **preserved** in drag payload (no longer hardcodes `'string'`)
- `computeNodeOutputAttributes` for renameNode: looks up source column type by name from upstream, propagates it to output

### TransformNode
- Square handles at top corners: `df-in` (left), `df-out` (right)
- Stores explicit `attributes[]` list (not derived from upstream)
- `connectedAttrs` injected for column reference in ops

### ConcatNode
- Square handles at top corners: `df-in` (left), `df-out` (right)
- Pass-through: `computeNodeOutputAttributes` returns `getUpstreamAttrs` (union of all connected inputs)

### CommentNode (sticky note)
- No handles — pure canvas decoration
- Color picker bar: 5 palette options (yellow / pink / green / blue / purple)
- Body: `<textarea>` with debounced `onCommentTextChange`
- Background IS the note color (light pastels on dark canvas)

### Result-DF column sync
Any DataFrameNode connected via `df-in` to **any operator node** (not just MergeNode) has its attributes **automatically driven** by `computeNodeOutputAttributes` of the upstream node:
- Implemented as a `useEffect` in `useLineageState` watching `nodes` + `edges`
- Covers: MergeNode (previously only this), FunctionNode outputs, GroupByNode (keys + aggs), FilterNode (pass-through), RenameNode (mapped with preserved types)
- Comparison via `JSON.stringify` prevents infinite re-render loop
- The result DF's manual edits to columns are overwritten — it is treated as schema-derived

### Canvas Tabs (Stages)
- **Tab bar** at the bottom of the screen — add, rename (double-click), close tabs
- Each tab is an independent canvas with its own nodes/edges stored under `canvasKey(tabId)` in localStorage
- First load migrates the old single-canvas `STORAGE_KEY` data into tab 1 automatically
- `useCanvasTabs` hook manages tab list (`TABS_KEY`) and active tab (`ACTIVE_TAB_KEY`) in localStorage
- Switching tabs unmounts current ReactFlow and mounts the new one (full state swap via `key` prop)

### Canvas
- Pan + zoom (React Flow built-in); `minZoom: 0.05` / `maxZoom: 2`
- Drag nodes from header area
- Right-click canvas → per-registry add menu + "⋈ Merge selected" (when 2 nodes selected)
- Right-click node → "Delete …"
- Select nodes + Delete key → removes nodes and their edges
- Click edge + Delete → removes edge
- `isValidConnection` assembled from registry: column `-source → -target` (global) + `df-out → df-in` (universal DF-level) + per-node `connections` arrays

### Copy / Paste
- `Ctrl+C` / `Cmd+C` — copies all selected nodes into a `clipboard` ref; resets paste counter
- `Ctrl+D` / `Cmd+D` — pastes clipboard with offset `+40px × pasteCount`; pasted nodes become selected, originals deselect
- Internal IDs remapped on paste via `cloneNodeData()` so handles don't collide:
  - DataFrameNode → attribute IDs
  - FunctionNode → input + output IDs
  - GroupByNode → input IDs, groupByInputIds, aggregation IDs + inputId refs

### Undo / Redo
- `Ctrl+Z` / `Cmd+Z` — undo last mutation
- `Ctrl+Y` / `Ctrl+Shift+Z` — redo
- Also exposed as ↩ / ↪ toolbar buttons
- History stack lives in `useLineageState` (max 50 snapshots, refs-based — no re-renders)
- Every mutation pushes a snapshot beforehand
- Load / restoreState clears both stacks

### Auto-layout
- **⬦ Auto-arrange** toolbar button — runs dagre LR layout, then `fitView`
- `useAutoLayout.js` pulls node sizes from `getDagreWidth` / `getDagreHeight` in registry
- Result goes through `restoreState`, so it is itself undoable

### Search (`Cmd+K`)
- `Cmd+K` / `Ctrl+K` opens a search modal
- **Searches all node types** via `_outputAttrs` field pre-computed by `computeNodeOutputAttributes`:
  - DataFrameNode attributes, FunctionNode outputs, MergeNode output columns,
    FilterNode/RenameNode/TransformNode pass-through columns, GroupByNode keys + agg outputs
  - Also searches FunctionNode/GroupByNode inputs (consuming side)
- Results show type icon, node name; column matches show `node › column` with type badge
- Click result (or Enter on selected item) → `fitView` to that node with animation
- Arrow keys navigate results, Escape closes
- **`W=` toggle** — exact match mode
- **Icons for all 9 node types** in results (was only 3)

### Attribute Tracker (`Ctrl+Shift+F`)
- Floating panel below toolbar — amber theme
- Type a column name → all nodes containing that attribute glow amber (`box-shadow`); unmatched nodes fade to 12% opacity; unmatched edges fade to 6%
- **Suggestions dropdown**: shows up to 12 matching attribute names from all nodes, sorted by frequency; arrow keys + Enter to select; click to commit
- **Match count badge**: shows how many nodes contain the attribute
- **`W=` toggle** — exact match mode (same as Search)
- **Attribute-level highlight in nodes**: matched attribute rows inside each node get amber background + bold amber text — works in DataFrameNode columns, FunctionNode inputs and outputs
- `trackerHighlight: { query, wholeWord }` is injected into `node.data` via the `trackedNodes` memo in App.jsx; nodes read it directly
- Closing the panel resets query, wholeWord, and all highlight styles

### Column Edges
- Custom edge type `columnEdge` shown when a column-level lineage edge is drawn
- Hover or tracker reveals the source column name as a label on the edge
- App.jsx `displayEdges` resolves column name from `sourceHandle` for all node types:
  - `{attrId}-source` → DataFrameNode attributes or FunctionNode outputs or RenameNode mappings
  - `gbout-{inputId}-source` → GroupByNode key pass-through
  - `aggout-{aggId}-source` → GroupByNode aggregation output name
  - `mout-[LR]-{attrId}-source` → MergeNode L/R output columns

### SQL Export
- Toolbar button → generates SQL and opens `SqlExportModal` with syntax-highlighted output + copy button
- Walks nodes/edges to produce `SELECT … FROM … JOIN … WHERE … GROUP BY` chains
- Covers MergeNode → `JOIN`, FilterNode → `WHERE`, GroupByNode → `GROUP BY`

### SQL Import
- Toolbar button → opens `SqlImportModal`; paste a `SELECT` statement → parses column names and table name → auto-creates a DataFrameNode with columns pre-filled

### Keyboard Shortcuts Reference
- `?` key → opens `ShortcutsModal` overlay listing all keyboard shortcuts
- Also accessible via `?` icon button in toolbar

### Persistence
- Save / Load buttons → `localStorage` per-tab key via `canvasKey(tabId)`
- `Ctrl+S` / `Ctrl+O` → save/load JSON file to disk
- Saves full `{ nodes, edges }` — all positions, types, data, edges
- First load with no saved state → demo graph: `raw_orders`, `raw_customers`, `orders_enriched`

### Export
- Export PNG → `html-to-image` renders React Flow viewport, downloads `lineage.png`
- `pixelRatio: 3` — output is 3× the canvas pixel dimensions for sharp text and lines

---

## Architecture Notes

### Column / Attribute Data Model

Every column is represented as `{ id: string, name: string, type: string }` where `type` is one of:
`'string' | 'int' | 'float' | 'date' | 'bool'`

Each node stores columns differently depending on its role:

| Node | Stored fields | Source of truth for output |
|---|---|---|
| DataFrameNode | `attributes[]` | `attributes` directly |
| FunctionNode | `inputs[]` (attrType), `outputs[]` (type) | `outputs` |
| GroupByNode | `inputs[]` (attrType), `groupByInputIds`, `aggregations[]` | keys from inputs + agg outputs via `inferAggType` |
| MergeNode | nothing — computed | union of left + right node outputs |
| FilterNode | nothing — computed | pass-through of upstream |
| RenameNode | `mappings[]` (from/to names) | mapped names with preserved types |
| TransformNode | `attributes[]` | `attributes` directly |
| ConcatNode | nothing — computed | union of all upstream |

### `computeNodeOutputAttributes` — the single source of truth

`src/utils/nodeOutputAttrs.js` exports:

```js
computeNodeOutputAttributes(node, edges, nodes) → { id, name, type }[]
getUpstreamAttrs(nodeId, edges, nodes, handleId?) → { id, name, type }[]
inferAggType(func, inputType) → string
```

**Every** place that needs "what columns does node X output?" must go through `computeNodeOutputAttributes`. It handles recursion (MergeNode → chained upstream). `getUpstreamAttrs` is the deduped union across all `df-in` inputs.

`inferAggType` rules:
- `count`, `nunique` → `'int'`
- `mean` → `'float'`
- `sum` → preserves `'int'` or `'float'`, else `'float'`
- `min`, `max`, `first`, `last` → preserves source type

This function is used both in `computeNodeOutputAttributes` (for GroupByNode output) and directly in `groupby/index.jsx` for rendering type badges.

### Type propagation through drag

Every draggable column row sets `attrType` in the drag payload:

| Source | Payload field | How type is obtained |
|---|---|---|
| DataFrameNode attr | `attr.type` | stored directly |
| FunctionNode output | `output.type` | stored directly |
| MergeNode output row | `attr.type` | from `leftDF/rightDF.attributes` via `computeNodeOutputAttributes` |
| GroupByNode key output | `inp.attrType` | stored in input object |
| GroupByNode agg output | `inferAggType(agg.func, inp?.attrType)` | computed at render time |
| RenameNode output row | `connectedAttrs.find(a => a.name === m.from)?.type` | looked up from upstream |

### How `nodesWithCallbacks` enriches nodes

In `useLineageState.js`, the `nodesWithCallbacks` memo injects computed data into each node's `data` before passing to React Flow:

| Node type | Injected field | Source |
|---|---|---|
| `functionNode`, `concatNode` | `connectedDFs` | edges with `targetHandle === 'df-in'` |
| `filterNode`, `renameNode`, `transformNode` | `connectedAttrs` | `getUpstreamAttrs(n.id, edges, nodes)` |
| `mergeNode` | `leftDF`, `rightDF` | `computeNodeOutputAttributes` of L/R source nodes |

All nodes also get callbacks injected via `attachCallbacks`.

### Result-DF auto-sync

A `useEffect` in `useLineageState` runs on every `nodes`/`edges` change. For each DataFrameNode with a `df-in` edge from a non-DataFrame operator:

```js
const computed = computeNodeOutputAttributes(src, edges, nodes);
if (JSON.stringify(n.data.attributes) !== JSON.stringify(computed)) {
  // overwrite the DataFrameNode's attributes
}
```

This means result DataFrames (the ones you manually place after a MergeNode, FunctionNode, GroupByNode, etc.) are kept in sync automatically. Manual edits to their columns are overwritten.

### Search architecture

`App.jsx` builds `nodesForSearch` by mapping `nodesWithCallbacks` and adding:
```js
data: { ...n.data, _outputAttrs: computeNodeOutputAttributes(n, edges, nodes) }
```

`SearchModal` reads `node.data._outputAttrs` instead of `node.data.attributes`. This means search always reflects what each node actually outputs, regardless of internal storage format.

### Node Registry pattern
Each node type lives in `src/nodes/<type>/` with three files:

| File | Purpose |
|---|---|
| `index.jsx` | React component |
| `config.js` | Static config: `type`, `colors`, `minimapColor`, `dagreWidth`, `dagreHeight(node)`, `make(x, y, dataOverrides?)`, `menu?`, `connections` |
| `callbacks.js` | `use<Type>Callbacks(setNodes, setEdges?, pushHistory)` hook |

`src/nodes/registry.js` assembles everything:
- `nodeTypes` — ReactFlow map (each component wrapped in `NodeErrorBoundary`)
- `isValidConnection` — column-level pattern + `df-out → df-in` universal rule + explicit rules from `config.connections`
- `getMinimapColor(node)` — reads `config.minimapColor`
- `getDagreWidth(type)` / `getDagreHeight(node)` — reads `config.dagreWidth/Height`
- `ADDABLE_NODES` — configs that have a `menu` field (mergeNode has none)
- `getNodeDisplayName(type)` — reads `config.menu.label`

### Standard DF-level handles
Every non-Comment node has two square handles at the header row:

| Handle | Type | Position | Purpose |
|---|---|---|---|
| `df-in` | target | top-left | Receives any `df-out` connection |
| `df-out` | source | top-right | Sends to any `df-in`, or to `left-in`/`right-in` |

Additionally MergeNode has `left-in` (30% from top) and `right-in` (70% from top) as specific inputs for the L/R DataFrames.

`isValidConnection` rules:
```
Column lineage:   *-source  →  *-target       (global, all nodes)
Universal DF:     df-out    →  df-in          (global, all node pairs)
DF → Merge L:     df-out    →  left-in
DF → Merge R:     df-out    →  right-in
```

All edges from `df-out` are purple `#7c3aed`. Column lineage edges use `columnEdge` type (blue `#60a5fa`). GroupBy column input edges are cyan `#0ea5e9` (set at drop time).

### Adding a new node type (the full recipe)
1. Create `src/nodes/<type>/config.js` — define colors, `make()`, `menu`, `connections`
2. Create `src/nodes/<type>/callbacks.js` — export `use<Type>Callbacks` hook
3. Create `src/nodes/<type>/index.jsx` — the React component; add `df-in`/`df-out` Handles at `top: 14` if the node participates in DF-level flow
4. Add **one line** to `registry.js`: `{ config: myConfig, component: MyNode }`
5. Import and compose the callbacks hook in `useLineageState.js`
6. Add case to `computeNodeOutputAttributes` in `src/utils/nodeOutputAttrs.js`

Steps 1–4 auto-update: `nodeTypes`, `isValidConnection`, `ADDABLE_NODES`, `getDagre*`, `getMinimapColor`, search results (via `_outputAttrs`), tracker, result-DF sync.

### Callback pattern
All node mutation callbacks are split into per-type hooks and composed in `useLineageState`:

```js
const dfCbs  = useDataFrameCallbacks(setNodes, setEdges, pushHistory);
const mgCbs  = useMergeCallbacks(setNodes, pushHistory);
const fnCbs  = useFunctionCallbacks(setNodes, setEdges, pushHistory);
const ftCbs  = useFilterCallbacks(setNodes, pushHistory);
const gbCbs  = useGroupByCallbacks(setNodes, setEdges, pushHistory);
const cmCbs  = useCommentCallbacks(setNodes, pushHistory);
const rnCbs  = useRenameCallbacks(setNodes, pushHistory);
const ctCbs  = useConcatCallbacks();
const trCbs  = useTransformCallbacks(setNodes, pushHistory);
callbacks.current = { onLabelChange, onCodeChange, onStageChange,
                      ...dfCbs, ...mgCbs, ...fnCbs, ...ftCbs, ...gbCbs,
                      ...cmCbs, ...rnCbs, ...ctCbs, ...trCbs };
```

Injected into every node's `data` via `attachCallbacks()` + a `callbacks.current` ref
(avoids stale closures without recreating node objects on every render).

`onLabelChange` is shared across all node types that need label editing.

### Canvas Tabs storage layout
```
localStorage keys:
  lineage-tabs          → JSON array of { id, name }
  lineage-active-tab    → active tab id string
  lineage-canvas-{id}   → { nodes, edges } for each tab
  lineage-editor-state  → legacy single-canvas key (migrated to tab 1 on first load)
```

### Undo/Redo pattern
`history` and `future` are plain refs (not state) holding `{ nodes, edges }` snapshots.
`nodesRef`/`edgesRef` mirror current state synchronously so snapshots can be taken
before functional `setNodes`/`setEdges` updates are applied.

### Copy/Paste pattern
`clipboard` ref stores an array of node objects at copy time.
`pasteCount` ref tracks how many times the current clipboard has been pasted (for offset accumulation).
`cloneNodeData(type, data)` — module-level helper in `useLineageState.js` — remaps internal IDs per node type so pasted nodes don't share handle IDs with originals.

### Drag system
All drag flows share the HTML5 `draggable` API + `DragContext` ref:

| Drag type | Source | Destination | Effect |
|---|---|---|---|
| Reorder | attribute row | same DataFrame | reorder via `onReorderAttributes` |
| Lineage | attribute row | different DataFrame | copy column + edge (type preserved) |
| Function input | attribute row | FunctionNode input panel | add input entry + edge |
| GroupBy input | attribute row | GroupByNode input panel | add input entry + cyan edge |
| Merge output | MergeNode output row | any node | lineage edge (type preserved) |
| GroupBy output | group-by key or agg row | any node | lineage edge (type from `inferAggType`) |

DF-level connections (e.g. DataFrame → FunctionNode, MergeNode → FilterNode) use React Flow's
native handle drag, not the HTML5 DragContext system.

`DragContext` read happens synchronously in event handlers — no re-renders triggered.

---

## What Failed / Dead Ends

### Tailwind v4 install
`npm install -D tailwindcss postcss autoprefixer` pulled Tailwind v4 which has
no `tailwindcss` CLI binary — `npx tailwindcss init -p` silently failed. Fixed by pinning `tailwindcss@3`.

### `App.js` shadowing `App.jsx`
CRA scaffolded `App.js`. After creating `App.jsx`, the old file took priority.
Fixed by deleting `App.js`, `App.css`, and `logo.svg`.

### Port conflict
`npm start` hits port 3000 which was already occupied. Must use `PORT=3001 npm start`.

### Attribute drag conflicting with node drag
First attempt used only `e.stopPropagation()` on `dragstart`. React Flow still
captured the mousedown and moved the node. Fix: `onMouseDown: e.stopPropagation()`
on every draggable attribute row.

### `dataTransfer.getData` blocked during dragover
Tried to read payload during `onDragOver` to decide reorder vs. lineage.
Browser blocks `.getData()` during drag (only available on `drop`).
Fixed with the `DragContext` ref set at `dragstart`.

### HTML5 drag on node header for DF-level drop
Attempted to make the DataFrameNode header `draggable` with a separate `DRAG_TYPE_DF` so the
whole frame could be dropped onto FunctionNode. Two problems: (1) React Flow 11 uses `pointerdown`
not `mousedown`, so `stopPropagation` on mousedown didn't block node movement; (2) `nodrag` class
prevents RF dragging but confusingly disables the header as a node-move handle.
**Resolution**: abandoned HTML5 approach entirely; instead added a `df-in` React Flow Handle to
FunctionNode so the standard handle-drag mechanism is used — consistent with all other DF connections.

---

## Next Things To Build

### Medium priority

**Validation layer**
Highlight problems: MergeNode with no key pairs, disconnected inputs, circular paths.

**Edge label tooltips**
Show source column name on hover — use `<EdgeLabelRenderer>` overlay.
(Column edge labels already appear via `ColumnEdge` custom type, but only on DF-level edges.)

**FilterNode condition autocomplete — upstream chain**
Currently `@column` autocomplete only suggests columns from nodes connected directly via `df-in`.
Could extend to also suggest from nodes connected anywhere upstream in the lineage chain by
using `computeNodeOutputAttributes` recursively. The infrastructure is ready; just change
`getUpstreamAttrs` call depth or add a recursive traversal option.

### Lower priority

**Lineage path highlighting in Tracker**
When exact-match tracking a column, highlight not just nodes that contain it, but the specific
edges connecting those nodes (the lineage path). Currently all edges between matched nodes are
highlighted, not just the column-specific ones. Could walk `computeNodeOutputAttributes` chain
to build the precise path.

**GroupByNode aggregation type override**
Currently aggregation output type is always inferred via `inferAggType`. Could add a manual
override (type selector next to the output name field) for cases where inference is wrong.
