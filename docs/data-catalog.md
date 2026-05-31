# Design: Data Catalog ("Data Map")

> Status: **proposed** (not built). This captures the agreed vision before
> implementation. Companion idea: [function-subgraphs.md](./function-subgraphs.md).

## Problem

At work there are many tables across many datasources. Tools like DBeaver make it
hard to *remember or find the right one*, and naming drifts across sources
(`RegionID` here, `region_id` there). The lineage editor should double as a
**searchable, connectable map of your data estate** — a place to write tables
down once, find them fast, and paste them into a working pipeline canvas.

It is **not** just a flat list. The vision (user's words, synthesized):

- Convenient to **search and paste** into the main canvas.
- **Aliases** for columns and DataFrames — `RegionID` ↔ `region_id` resolve to
  the same thing.
- **Cascade / cross-canvas**: find a DataFrame from *other* canvases that is
  marked **final**, and reuse it.
- **Connect the dots**: relationships between datasets and between a dataset and
  its **base** (datasource) — at the dataset level, not only column level. The
  catalog is itself *a canvas of DataFrames*.
- **Search like the main canvas**, and **filter by source**: database
  connection, local storage, or manually typed.

## Shape

A **second canvas type — the Data Map** — built on the same React Flow surface as
the pipeline editor, but its nodes are **datasets** and **sources**, and its
edges are **relationships**. It is a *global* asset (shared across all pipeline
tabs), with its own search + source filters, and a "paste into pipeline" action.

```
┌─ Data Map ────────────────────────────────────────────────┐
│  [search: region…]   source: ◉ all ○ db ○ local ○ manual   │
│                                                            │
│   (Prod PG)──belongs──[ dim_region ]──join(region_id)──┐   │
│      base                  │ final                     │   │
│      │                     related                 [ fact_sales ]
│   (Local CSV)──belongs──[ region_lookup ]              │ final
│                            aliases: RegionID, reg_id   │   │
└────────────────────────────────────────────────────────────┘
              click a dataset → "＋ Add to pipeline canvas"
```

## Data model

Stored separately from canvases (it is global, not per-tab). One blob under a new
localStorage key `lineage-catalog`:

```ts
interface Catalog {
  sources: CatalogSource[];
  entries: CatalogEntry[];
  relationships: CatalogRelationship[];
}

interface CatalogSource {
  id: string;
  name: string;                       // "Prod Postgres", "Local files", "Manual"
  kind: 'database' | 'local-storage' | 'manual';
  dialect?: string;                   // e.g. 'postgres' (metadata only — see Privacy)
  description?: string;
  tags?: string[];
}

interface CatalogEntry {              // a dataset / table
  id: string;
  name: string;                       // canonical display name
  aliases?: string[];                 // alternate names: ['RegionID', 'reg_id']
  sourceId?: string;                  // → CatalogSource
  description?: string;
  tags?: string[];
  columns: CatalogColumn[];
  finalized?: boolean;                // curated/published (see "final mark")
  origin?: {                          // provenance
    kind: 'manual' | 'sql-ddl' | 'from-canvas';
    canvasId?: string; nodeId?: string;
  };
  updatedAt: number;
}

interface CatalogColumn {
  name: string;                       // canonical
  aliases?: string[];                 // ['RegionID'] for a canonical 'region_id'
  type: AttrType;                     // reuse existing ATTR_TYPES
  description?: string;
  isKey?: boolean;
}

interface CatalogRelationship {       // an edge in the Data Map
  id: string;
  fromId: string; toId: string;       // entry↔entry, or entry↔source
  kind: 'belongs-to-source' | 'related' | 'join';
  joinKeys?: { left: string; right: string }[];   // optional column-level detail
  label?: string;
  notes?: string;
}
```

### Alias / name reconciliation

Search and matching normalize names so `RegionID`, `region_id`, `Region Id` all
collide: `normalize(s) = s.toLowerCase().replace(/[^a-z0-9]/g, '')`. Explicit
`aliases` extend this for cases normalization can't catch (`reg_id` ↔
`region_id`). A column or entry matches a query if the query normalizes to its
name *or* any alias.

### The "final mark" (cross-canvas discovery)

The node `stage` field already has a `final` value
(`StageBadge`: `raw → staging → gold → final`). Reuse it:

- Any DataFrame in any pipeline canvas with `stage === 'final'` is a **candidate
  catalog asset**.
- The catalog can **scan all `lineage-canvas-{id}` keys**, list finalized DFs as
  discoverable entries, and offer **"Publish to catalog"** (snapshots its
  columns/types into a `CatalogEntry` with `origin.kind = 'from-canvas'`).
- Conversely, dropping a catalog entry onto a pipeline canvas records
  `data.catalogEntryId` on the new DataFrame, so edits can round-trip back.

## Surfaces / UI

- **Mode toggle / tab**: a "Data Map" view alongside the pipeline canvas (reuse
  `useCanvasTabs` patterns or a dedicated toolbar toggle). Two node types:
  `datasetNode`, `sourceNode`; edges are relationships.
- **Catalog search panel**: like `SearchModal`, but over catalog entries —
  matches name/alias/column/tag; **source filter chips** (db / local / manual);
  result → "＋ Add to pipeline canvas" or "focus in Data Map".
- **Add to pipeline**: instantiate a DataFrame via
  `dataframeConfig.make(x, y, { label: entry.name, attributes: entry.columns })`.
- **Publish from pipeline**: a DataFrame (esp. `stage: 'final'`) → new/updated
  `CatalogEntry`.
- **Import schema**: extend the existing SQL DDL import to target the catalog
  (create entries + a `database` source) instead of only the canvas.

## Staging plan

- **v1 — list + paste (no graph).** Data model + `lineage-catalog` store +
  search panel (name/alias/column/tag, source filter) + Add-to-canvas +
  Publish-from-canvas + manual entry editor + SQL DDL → catalog. Delivers the
  core "find and paste" value on its own.
- **v2 — the Data Map graph.** React Flow surface: dataset + source nodes,
  relationship edges ("connect the dots"), visual search/filter, belongs-to-source
  auto-edges.
- **v3 — reconciliation + cross-canvas.** Column-level alias mapping + `join`
  relationships with key pairs; aggregate `stage: 'final'` DFs across all
  canvases; catalog export/import (reuse pako share encoding).

## Decisions / open questions

- **Privacy / client-side.** The app is 100% client-side (no backend). A
  `database` source therefore stores **metadata only** — name, dialect, schema
  description — and schema is populated by **pasting SQL DDL**, not by a live
  connection. Live introspection would require a backend and is out of scope.
- **Data Map: new tab type vs. mode toggle?** (Leaning: a toolbar mode toggle
  that swaps the canvas surface; the catalog is global, not one tab among many.)
- **`finalized` flag vs. reuse `stage: 'final'`?** (Leaning: treat
  `stage === 'final'` as the publish signal; `CatalogEntry.finalized` marks a
  curated catalog entry specifically.)
- **Relationship semantics**: keep `related` loose (just "connect the dots") and
  let `join` carry optional column keys for the analysts who want precision.
