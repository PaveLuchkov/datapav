# Lineage Editor — Session Handoff

## Goal

A web app for a data analyst to visually document DataFrame lineage.
The mental model: you build a graph where nodes are DataFrames (with columns),
edges are derivation relationships between columns, and operator nodes (Merge, Filter, GroupBy)
sit between source and result DataFrames.

End state imagined: open the app, drag columns across DataFrames to show where
each column came from, place operator nodes to document transformations, export the diagram
as PNG or save it for the next session.

**Feature status (design docs in `docs/`):** the
[Data Catalog / "Data Map"](docs/data-catalog.md) is built through v2 (known gaps:
no UI to create sources, relationship edges can't be deleted/edited, re-publish
duplicates entries, v3 cross-canvas not started).
[Function subgraphs / "drill in"](docs/function-subgraphs.md) v1 is built — see
"Function subgraphs" below; v2 (cross-boundary tracing) and v3 (reusable modules) remain.

---

## What's Built (current state)

### Stack
- `create-react-app` (CRA) — intentionally chosen for zero-config, despite deprecation warnings
- React Flow (`reactflow`) — canvas, nodes, edges, handles, pan/zoom
- Tailwind CSS v3 — utility styles
- `html-to-image` — PNG export
- `dagre` — auto-layout
- `pako` — deflate/inflate for compressed share URLs

### Dev server
Running at **http://localhost:3001** (port 3000 was occupied).
Start with: `PORT=3001 npm start` from `lineage-editor/`.

### Git history (latest first)
```
b3c5295  feat: broken input state for GroupBy and FunctionNode
45f43d0  feat: break specific columns when source DF is deleted
ea7f96b  fix: generalize broken-column detection to edge-based, not companion-based
6584843  feat: broken column state — orphan companions on operator delete
c7360e8  feat: add_column op in Transform + FunctionNode extend mode
602bcbb  feat: resizable CommentNode via NodeResizer
df139d3  feat: demo canvas on first run (e-commerce order pipeline)
41578f4  feat: clipboard copy/paste + URL share link
5526d7c  handoff (previous session end)
7205eb6  fix: live-sync attrType in GroupBy/FunctionNode inputs from upstream
fbe6777  fix + feat: GroupBy tracing via sourceNodeId; MergeNode editable label
03813cb  feat: FunctionNode output→input linking for lineage tracing
4fe621a  fix + feat: TransformNode/RenameNode overhaul + pass-through fixes
c92e40d  feat: companion DF pattern + column lineage tracing
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
│   │   │                            (companion badge ⊙, broken column rendering, per-row ◎ trace)
│   │   ├── config.js             ← colors, dagreWidth/Height, make(), makeCompanion(), menu, connections
│   │   └── callbacks.js          ← useDataFrameCallbacks(setNodes, setEdges, pushHistory)
│   ├── merge/
│   │   ├── index.jsx             ← MergeNode (editable label, join type + key pairs; companion button)
│   │   ├── config.js
│   │   └── callbacks.js          ← useMergeCallbacks(setNodes, pushHistory)
│   ├── function/
│   │   ├── index.jsx             ← FunctionNode (extend mode ⊕, companion button →●/→○, broken inputs)
│   │   ├── config.js
│   │   └── callbacks.js          ← useFunctionCallbacks (incl. onFunctionExtendModeChange)
│   ├── filter/
│   │   ├── index.jsx             ← FilterNode component
│   │   ├── config.js
│   │   └── callbacks.js          ← useFilterCallbacks(setNodes, pushHistory)
│   ├── groupby/
│   │   ├── index.jsx             ← GroupByNode (companion button, broken input rendering)
│   │   ├── config.js             ← sky/cyan colors; connections: [] (universal rule)
│   │   └── callbacks.js          ← useGroupByCallbacks(setNodes, setEdges, pushHistory)
│   ├── rename/
│   │   ├── index.jsx             ← RenameNode component
│   │   ├── config.js
│   │   └── callbacks.js          ← useRenameCallbacks(setNodes, pushHistory)
│   ├── transform/
│   │   ├── index.jsx             ← TransformNode (add_column op)
│   │   ├── config.js             ← TRANSFORM_OPS includes 'add_column'
│   │   └── callbacks.js          ← useTransformCallbacks(setNodes, pushHistory)
│   ├── concat/
│   │   ├── index.jsx             ← ConcatNode component
│   │   ├── config.js
│   │   └── callbacks.js          ← useConcatCallbacks()
│   └── comment/
│       ├── index.jsx             ← CommentNode (resizable via NodeResizer; @ref highlight)
│       ├── config.js             ← NOTE_PALETTE (5 sticky-note colors); no connections
│       └── callbacks.js          ← useCommentCallbacks(setNodes, pushHistory)
├── utils/
│   ├── uid.js                    ← shared ID counter (Date.now() seed)
│   ├── nodeOutputAttrs.js        ← thin lineage DISPATCHER (per-type rules live in each
│   │                                node's spec, registered via nodes/specs.js):
│   │                                computeNodeOutputAttributes(node, edges, nodes) → Attr[]
│   │                                  → spec.outputs (functionNode extendMode prepends
│   │                                    source attrs; transformNode add_column appends)
│   │                                getUpstreamAttrs(nodeId, edges, nodes, handleId?) → Attr[]
│   │                                inferAggType(func, inputType) → type string
│   │                                traceColumnUpstream(nodeId, colName, edges, nodes) → chain | null
│   │                                  functionNode: if extendMode + col not in outputs, passes through df-in
│   │                                  transformNode: add_column → createdHere: true
│   │                                traceColumnDownstream(nodeId, colName, edges, nodes) → branch[]
│   │                                flattenUpstream(step) → step[] (oldest → newest)
│   └── exportSql.js              ← SQL generation from graph
├── data/
│   └── demoCanvas.json           ← built-in first-run demo: full e-commerce pipeline
│                                    (orders_raw + customers → Filter → Transform → Rename
│                                     → Merge → GroupBy + FunctionNode, two CommentNodes)
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
│   ├── TabBar.jsx                ← canvas tabs bar (add, rename, close, switch)
│   └── TracePanel.jsx            ← column lineage trace panel (right side overlay)
├── hooks/
│   ├── useAutoLayout.js          ← dagre LR layout; sizes come from registry
│   ├── useCanvasTabs.js          ← multi-canvas tab state; each tab saved to its own localStorage key
│   ├── useContextMenu.js         ← menu state + onPaneContextMenu / onNodeContextMenu
│   ├── useLineagePersistence.js  ← save/load localStorage, export PNG, save/load JSON,
│   │                                copyToClipboard / pasteFromClipboard (Ctrl+Shift+C/V),
│   │                                copyShareUrl (pako deflate → base64url → URL hash),
│   │                                loadFromUrlHash (inflate on mount)
│   └── useLineageState.js        ← state + history; spec-driven (iterates SPEC_LIST,
│                                    no per-type switches). companion-producing types
│                                    are those with spec.companion = true (merge,
│                                    groupBy, function, rename, transform);
│                                    addNodeOfType auto-creates companion DF for them;
│                                    DELETE KEY — broken column logic:
│                                      operator deleted → all columns of connected df-out DFs broken;
│                                      DF deleted → specific attrs wired via column edges broken;
│                                      any node deleted → GroupBy/Function inputs with matching
│                                        sourceNodeId marked broken;
│                                    auto-heal useEffect: DFs with broken attrs scan upstream;
│                                      name match → broken cleared, type updated from live upstream;
│                                    attrType live-sync useEffect: GroupBy + FunctionNode inputs
│                                      refreshed from sourceNodeId on every graph change;
│                                    companion sync useEffect: only _companionOf DFs overwritten
├── constants.js                  ← DRAG_TYPE, STORAGE_KEY, TABS_KEY, ACTIVE_TAB_KEY, canvasKey(),
│                                    JOIN_TYPES, JOIN_ACTIVE_STYLES,
│                                    ATTR_TYPES, ATTR_TYPE_META  (no per-node colors/sizes)
├── App.jsx                       ← UI shell; on mount: loadFromUrlHash() → else first-run demo
│                                    (localStorage 'lineage-demo-loaded' flag, loads demoCanvas.json);
│                                    Ctrl+Shift+C / Ctrl+Shift+V shortcuts wired here;
│                                    owns traceState (nodeId + colName + nodeType + nodeLabel);
│                                    traceResult, tracePathNodeIds, tracePathEdgeIds (Sets);
│                                    trackedNodes: trace mode → cyan/blue/dim; else keyword tracker;
│                                    displayEdges: path edges animate cyan, off-path dims to 4%
└── Toolbar.jsx                   ← add-node buttons, copy/paste/share buttons (IcoCopy/IcoPaste/IcoShare)
public/
└── index.html                    ← inline <script> before </head> suppresses ResizeObserver loop
                                     error before CRA's overlay handler registers
```

---

## Feature Inventory

### DataFrameNode
- Double-click title or any column name → inline edit (Enter/Escape)
- `+` button in header → add column (**hidden on companion DFs**)
- **Broken column state**: `attr.broken = true` renders red background, strikethrough name, `!` marker, always-visible `×` button; **auto-heals** when upstream with matching name is reconnected (type also updated from live upstream)
- Hover column → grip icon `⠿` → **drag within same node** to reorder
- **Drag column onto a different DataFrame** → column copied + lineage edge created automatically
- Per-column handles: left dot (target) + right dot (source) for manual edge drawing
- Two square handles: `df-in` (top-left), `df-out` (top-right)
- **Type badge** (`str`/`int`/`flt`/`dat`/`bool`) — click to cycle type (**disabled on companion DFs and broken cols**)
- **Companion badge `⊙`**: shown when `data._companionOf` is set; cleared when operator is deleted
- **Trace button `◎`**: per-column on hover — hidden for broken columns

### FunctionNode
- Drop columns onto Inputs panel → creates input entry + edge
- Drag `df-out` → `df-in` on FunctionNode → adds whole DataFrame as named input group
- **Broken input state**: `inp.broken = true` when source node deleted → red row, `!` marker replaces TypeBadge, red handle dot, always-visible `×`; user re-drags to replace
- **Output → Input linking**: compact select per output row (`∅ new` or pick from inputs); linked output name+type auto-fill; tracing follows through
- **Extend mode `⊕`** button in header (active only when `df-in` connected):
  - OFF (default): companion DF contains only function outputs
  - ON: companion DF = all source DF columns + function outputs (no duplicates); models `df['col'] = func(...)`; pass-through columns trace transparently through the function
  - `data.extendMode` flag stored on node; `computeNodeOutputAttributes` prepends upstream attrs when true
- **Companion button `→●` / `→○`**
- `attrType` on inputs is live-synced from upstream; linked outputs updated in same pass

### TransformNode
- **`add_column` op**: new column name (text) + type selector + constant value; column appended to output schema; traces as `createdHere: true` (no upstream); companion DF auto-reflects it
- **`drop_column`, `astype`, `fillna`, `sort_values`, `dropna`, `drop_duplicates`** — existing ops
- **Companion button `→●` / `→○`**; auto-spawns companion on placement

### MergeNode
- **Editable label** via `EditableText` in header (default: `merge`)
- Auto-wires left/right df-out on creation from 2 selected nodes
- Join type toggle: `inner` / `left` / `right` / `outer`
- Key pairs editor
- **Companion button `→●` / `→○`**

### GroupByNode
- **Broken input state**: same as FunctionNode — `inp.broken` renders red with `!`, always-visible `×`; toggle `⊞` hidden for broken inputs
- Left panel (Inputs): drop zone; toggle `⊞` / `○` to mark group-by key
- Right panel (Outputs): group-by keys + aggregation rows
- **Companion button `→●` / `→○`**
- `attrType` live-synced from upstream

### CommentNode
- **Resizable**: `NodeResizer` from reactflow — drag corners/edges to resize; handles only visible when node selected
- 5 palette colors, textarea body, `@ref` highlighting
- `style.width`/`style.height` persisted on node for React Flow resize sync

### FilterNode
- Multi-condition WHERE builder with `@column` autocomplete
- `connectedAttrs` injected from upstream

### RenameNode
- Rows of `old_name → new_name` mappings; pass-through for unmapped columns
- **Companion button**; auto-spawns companion

### Clipboard / Share
- **`Ctrl+Shift+C`** — copy full canvas JSON to clipboard
- **`Ctrl+Shift+V`** — paste canvas from clipboard (replaces current)
- **Share link button** in Toolbar — pako deflate + base64url → URL hash; anyone opening the URL loads the canvas. ~40 KB JSON → ~3–5 KB URL
- On mount: `loadFromUrlHash()` checked first; if no hash and `lineage-demo-loaded` absent in localStorage → load demo canvas once

### Demo Canvas (first run)
- `src/data/demoCanvas.json` — e-commerce order pipeline:
  - `orders_raw` + `customers` → `Filter (completed_only)` → `Transform (clean_orders)` → `Rename (normalize_customers)` → `Merge (enrich_orders)` → `GroupBy (revenue_by_segment)` + `FunctionNode (compute_ltv)`
  - All node types represented; per-column edges for GroupBy/Function inputs; companion edges
  - Two CommentNodes (blue intro with shortcuts, green analysis explanation)
- Loaded exactly once per browser (localStorage flag `lineage-demo-loaded`); clear flag to reset
- To update: edit `demoCanvas.json` and bump the flag

---

## Architecture Notes

### Column / Attribute Data Model

Every column: `{ id, name, type, broken? }` where `type ∈ 'string' | 'int' | 'float' | 'date' | 'bool'`  
`broken: true` is a transient UI flag — does not affect `computeNodeOutputAttributes`, only rendering.

GroupBy/FunctionNode inputs: `{ id, attrName, attrType, sourceNodeId, sourceNodeLabel, sourceAttrId, broken? }`

| Node | Stored fields | Source of truth for output |
|---|---|---|
| DataFrameNode | `attributes[]` | `attributes` directly |
| FunctionNode | `inputs[]`, `outputs[]` (type; `fromInputId`); `extendMode` | `outputs`; if `extendMode`: upstream attrs + outputs |
| GroupByNode | `inputs[]`, `groupByInputIds`, `aggregations[]` | keys from inputs + agg outputs via `inferAggType` |
| MergeNode | nothing — computed | union of left + right node outputs |
| FilterNode | nothing — computed | pass-through of upstream |
| RenameNode | `mappings[]` | upstream columns with mapped ones renamed |
| TransformNode | `ops[]` | upstream columns + `add_column` appended; `drop_column` removed; `astype` type-mutated |
| ConcatNode | nothing — computed | union of all upstream |

### Broken Column Mechanics

Triggered in the Delete key handler in `useLineageState`:

```
Node deleted                         → what breaks
────────────────────────────────────────────────────────
Operator (non-DF)                    → ALL attrs of any DF connected via df-out broken
DataFrame                            → specific attrs in other DFs wired via column-level edges broken
Any node                             → GroupBy/Function inputs with sourceNodeId === deleted.id broken
```

Operator's companion DF: `_companionOf` cleared if its operator is in the delete set.  
Non-companion DFs connected to deleted operator: `_companionOf` untouched (may be undefined already).

**Auto-heal useEffect** (runs on every `nodes`/`edges` change):
```js
// For each DF with broken attrs: getUpstreamAttrs(n.id, edges, nodes)
// If upstream has attr.name === broken.name → broken: false, type updated from upstream
```
No auto-heal for GroupBy/Function inputs — user must re-drag a replacement column.

### FunctionNode Extend Mode

`data.extendMode: boolean` stored on the node.

`computeNodeOutputAttributes` for `functionNode`:
```js
if (!node.data.extendMode) return ownOutputs;
const sourceAttrs = getUpstreamAttrs(node.id, edges, nodes);  // via df-in
const ownNames = new Set(ownOutputs.map(o => o.name));
return [...sourceAttrs.filter(a => !ownNames.has(a.name)), ...ownOutputs];
```

`traceColumnUpstream` for `functionNode`:
- Column in `outputs` → traces through `fromInputId` or returns `createdHere`
- Column NOT in outputs + `extendMode` → passes through df-in edges to upstream (transparent pass-through)

`_propagateCol` for downstream tracing uses `computeNodeOutputAttributes` directly (handles both modes).

### Companion DF storage

| Field | Location | Meaning |
|---|---|---|
| `data._companionOf` | DataFrameNode | ID of the operator that owns this companion |
| `data.companionId` | Operator node | ID of its companion DataFrameNode |
| `data.isCompanionEdge` | Edge | Marks the dashed operator→companion connection |
| `attr.broken` | DataFrameNode attribute | Transient: source lost; heals on reconnect |
| `inp.broken` | GroupBy/Function input | Transient: source node deleted; user re-drags |

Companion-producing types are declared per-spec via `spec.companion = true`
(merge, groupBy, function, rename, transform). The old hardcoded
`COMPANION_TYPES` set in `useLineageState` has been removed.

### Share URL encoding (`useLineagePersistence`)
```js
encodeState(nodes, edges):
  JSON.stringify → pako.deflate → Uint8Array → base64url → window.location.hash

decodeState(hash):
  base64url → Uint8Array → pako.inflate → JSON.parse → { nodes, edges }
```

### Column Lineage Tracing — `nodeOutputAttrs.js`

```js
traceColumnUpstream(nodeId, colName, edges, nodes)
  → { nodeId, colName, nodeType, nodeLabel, upstream: chain | null, ...extras }
```

Extras per node type:
- `groupByNode` agg: `aggFunc`, `inputColName`
- `functionNode` own output (no link): `createdHere: true`
- `transformNode` add_column: `createdHere: true`

**`dataFrameNode` case is NOT terminal** — traces through incoming `df-in → df-out` edge to upstream operator.

`_propagateCol` for downstream tracing uses `computeNodeOutputAttributes` for `functionNode` (handles extend mode correctly).

### `computeNodeOutputAttributes` key changes

- **`functionNode`**: if `extendMode`, returns `[...sourceAttrs (not in outputs), ...ownOutputs]`
- **`transformNode`**: collects `add_column` ops and appends `{ id: op.id, name: op.args.col, type: op.args.type_val }` after upstream, skipping names already in upstream

### How `nodesWithCallbacks` enriches nodes

| Node type | Injected field | Source |
|---|---|---|
| `functionNode`, `concatNode` | `connectedDFs` | edges with `targetHandle === 'df-in'` |
| `filterNode`, `renameNode`, `transformNode` | `connectedAttrs` | `getUpstreamAttrs(n.id, edges, nodes)` |
| `mergeNode` | `leftDF`, `rightDF` | `computeNodeOutputAttributes` of L/R source nodes |
| all nodes | `onTraceColumn`, `traceColName` | injected in App.jsx `trackedNodes` memo |
| all nodes | all callbacks | `callbacks.current` ref via `attachCallbacks` |

### Adding a new node type (the spec-driven recipe)

As of the schema-driven refactor, a node type is **one `spec` module + one list
entry** — the engine and `useLineageState` iterate the registry instead of
switching on `node.type`, so there are no longer per-type cases to add in
`nodeOutputAttrs.js` or `useLineageState.js`.

1. `src/nodes/<type>/{config.js, callbacks.js, index.jsx}` — same triad as before
   (config: `make()`/`menu`/`connections`/dagre sizes/colors; callbacks:
   `use<Type>Callbacks`; component: `df-in`/`df-out` Handles at `top: 14`).
2. `src/nodes/<type>/spec.js` — the NodeSpec. Declares `type`, `theme`,
   `component`, `make`, `connect`, `header`, `useCallbacks(ctx)`, and the
   capabilities the engine/state layer read (see below). Add the lineage methods
   `outputs` / `traceUpstream` / `propagateDownstream` (omit them entirely for a
   non-data node like Comment — a type with no registered lineage produces no
   columns).
3. Add one import + one `SPECS` entry in `src/nodes/specs.js`, and one entry in
   `src/nodes/registry.js` (`{ config, component }`, still used for
   `nodeTypes`/minimap/dagre/`ADDABLE_NODES`/`isValidConnection`).

**Spec capabilities consumed by `useLineageState`** (all optional — omit to opt out):
`companion` (operator auto-spawns a result DF), `clone(data)` (paste id remap),
`inject(node,edges,nodes)` (extra component props), `refreshData(node,edges,nodes)`
(frozen input/output type sync), `healBroken(node,edges,nodes)` (DataFrame
auto-heal), `ownsColumns` (stores its columns explicitly — drives the
delete-break branch), `mergeable` (selectable to spawn a Merge),
`requiresUpstream` (operator is lint-flagged when it has no df-in source). The
engine (`nodeOutputAttrs.js`) is now a thin dispatcher over `outputs` /
`traceUpstream` / `propagateDownstream`; there is no switch fallback.

**DS feature hooks on the spec (Phase 7):**
- `validate(node, edges, nodes) → Issue[]` — per-type lint rules (e.g. merge with
  no key pairs / key type mismatch, groupby with no keys, empty filter/rename/
  transform/function). Aggregated by `utils/validation.js` (`collectIssues`) which
  also adds generic checks (broken columns/inputs, duplicate output names,
  disconnected operators, dependency cycles) and is surfaced through the
  `useValidation` hook → `ValidationPanel` + the Toolbar flag badge.
- `toPandas(node, ctx) → string` — best-effort codegen. `utils/exportPandas.js`
  (`generatePandas`) topologically orders the graph over df-out edges, assigns a
  python var per node (companion DFs alias their operator's var), and stitches the
  snippets; a node's own `code` field overrides its snippet. Surfaced via the
  Export-pandas toolbar button → `PandasExportModal`.

> Column-level lineage edges (DF→DF column drops, handles `${attrId}-source` →
> `${attrId}-target`) are traced in both directions: DataFrame `traceUpstream`
> follows an incoming `-target` edge, and `traceColumnDownstream` follows outgoing
> `-source` edges. Both trace fns carry a `visited` set to stay finite on cycles.

> Not yet built: DuckDB-WASM live preview/profiling (deferred — would add a large
> WASM dependency + a data-binding flow). The intended shape is a `spec.previewQuery`
> + a `useDataPreview` hook + a preview panel, binding a DataFrame to a loaded
> CSV/Parquet sample.

### Function subgraphs ("drill in") — v1

`src/hooks/useSubgraphDrill.js` + wiring in `App.jsx`. A FunctionNode body lives at
`functionNode.data.subgraph = { nodes, edges }`, so it persists/shares/copies with
the node for free.

- **Drill in**: ⧉ button in the FunctionNode header (injected `onDrillIn` in App's
  `trackedNodes` memo, like `onTraceColumn`). The hook pushes the current surface
  onto a stack and `restoreState`s the subgraph — the ONE editing surface
  (useLineageState) is reused, so all callbacks/companions/validation/undo work
  inside unchanged. `restoreState` clears undo history, so undo can't cross the
  boundary.
- **Signature proxies**: two read-only DataFrames (`data._proxy`) are upserted on
  every entry — `<fn> · inputs` (from `data.inputs`) and `<fn> · outputs` (from
  `data.outputs`). Attr ids reuse the input/output ids so inner edges stay stable
  across re-entries. Stale proxies (wrong fn id, e.g. after paste re-ids) are
  dropped along with their edges. `_proxy` makes DataFrameNode read-only (same
  treatment as `_companionOf`).
- **Exit**: breadcrumb bar (`pipeline › ƒ name › …`) at top-center; ← exits one
  level, crumbs jump multiple levels (`exitToDepth` folds every level in between).
- **Persistence while drilled**: `composedRoot` folds live subgraph edits back
  into the root canvas; App passes it (not the raw surface) to `useCanvasTabs` and
  `useLineagePersistence`, so the tab key always holds the whole pipeline. Tab
  switch / file / clipboard / URL loads go through `restoreRoot`, which resets the
  drill stack first.
- **Known v1 limits**: trace stops at the boundary (proxies are terminal);
  function `outputs` still come from the manual outputs list, not the subgraph
  wiring (v2); PNG export while drilled frames using root-canvas bounds.

### Canvas Tabs storage layout
```
localStorage keys:
  lineage-tabs            → JSON array of { id, name }
  lineage-active-tab      → active tab id string
  lineage-canvas-{id}     → { nodes, edges } for each tab
  lineage-demo-loaded     → flag: demo canvas already shown once
```

---

## What Failed / Dead Ends

### ResizeObserver loop error (CRA dev overlay)
After adding `NodeResizer` to CommentNode, `ResizeObserver loop completed with undelivered notifications` appeared in the CRA error overlay. First fix: added `window.addEventListener('error', ...)` in `src/index.js`. Didn't work — CRA registers its overlay error handler during bundle initialisation, before `index.js` runs, so `stopImmediatePropagation` had no effect.  
**Fix**: moved the suppression `<script>` to `public/index.html` before `</head>` — the browser executes it before the bundle, so our listener registers first.

### Companion cascade-delete creating unrecoverable broken chains
Original delete handler added companion DF id to `toDelete`. When an operator (e.g. Merge) was deleted mid-chain, its companion DF and all downstream nodes lost their source. No way to recover without re-building from scratch.  
**Fix**: companion DFs are NOT deleted. Instead, all their attributes are marked `broken: true` and `_companionOf` is cleared. Downstream edges from the companion survive. User reconnects a replacement source and matching columns auto-heal.

### Companion-based orphan detection not persisting through reconnection cycles
The broken state was triggered only for DFs that had `companionId` on the operator being deleted. After reconnecting a new operator to the orphaned DF, the DF had no companion relationship with the new operator. Deleting the new operator again didn't trigger broken state.  
**Fix**: use edge-based detection — scan ALL `df-out → df-in` edges from the deleted node, mark any target DF as broken. This works regardless of companion status and persists through reconnection cycles.

### Tailwind v4 install
`npm install -D tailwindcss postcss autoprefixer` pulled Tailwind v4 which has no `tailwindcss` CLI binary. Fixed by pinning `tailwindcss@3`.

### GroupBy/FunctionNode frozen attrType (type inheritance bug)
GroupByNode and FunctionNode stored `attrType` frozen at drag time. When an upstream TransformNode executed `astype`, downstream nodes didn't inherit the new type. Fix: `useEffect` in `useLineageState` walks inputs on every graph change, calls `computeNodeOutputAttributes` on `sourceNodeId`, patches `attrType` if diverged. FunctionNode linked outputs refreshed in same pass.

### _propagateCol functionNode checking inputs instead of outputs
Downstream tracing checked `node.data.inputs` for colName presence instead of `outputs`. Fixed.

### TransformNode sync bug (result-DF overwrite)
Any DataFrame connected downstream of a TransformNode had its columns replaced with `[]`. Fix: restrict companion sync to DFs with `_companionOf` set.

### RenameNode dropping pass-through columns
`computeNodeOutputAttributes` for renameNode only returned mapped columns. Fix: pass unmapped upstream columns through unchanged.

---

## Next Things To Build

### Medium priority

**Broken state for Filter/Transform/Rename column references**
These nodes derive columns implicitly via `connectedAttrs` from `getUpstreamAttrs`. When a source DF is deleted, column references in op args (`drop_column`, `astype col`, `fillna col`) become stale. Would require storing explicit column references or adding a validation pass that highlights stale op args.

**Validation layer**
Highlight problems: MergeNode with no key pairs, GroupBy with no keys, disconnected inputs, circular paths.

**Trace from operator nodes**
Currently `◎` trace button is only on DataFrameNode columns. FunctionNode outputs, GroupByNode agg outputs could call `onTraceColumn(nodeId, colName)` directly — infrastructure is ready.

### Lower priority

**Edge label tooltips**
Show source column name on hover for DF-level edges (column edges already show label via `ColumnEdge`).

**GroupByNode aggregation type override**
Manual type selector next to output name for cases where `inferAggType` inference is wrong.

**FilterNode condition autocomplete — full upstream chain**
Currently `@column` autocomplete suggests from directly connected `df-in` nodes only. Could walk full upstream chain via `computeNodeOutputAttributes`.

**Lineage path highlighting in Tracker**
When exact-match tracking, highlight the specific edges on the lineage path. Infrastructure (`traceColumnUpstream` / `traceColumnDownstream`) is ready.
