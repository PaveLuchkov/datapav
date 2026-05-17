# DataPav — DataFrame Lineage Editor

> A visual canvas for mapping data pipelines and interactively tracing column-level dependencies.

Built for data analysts and engineers who want to *draw* how data flows rather than describe it in text.

**[Live Demo](https://dataloom.lpavs.com/) · [GitHub](https://github.com/PaveLuchkov/dataloom)**

---

## What it does

When refactoring complex analytical scripts or parsing legacy repositories, the same bottleneck always appears: **how to quickly trace the origin of a specific data attribute.** Once a column passes through a sequence of joins, filters, renames, and custom transformations, its trail is easily lost in the codebase.

DataPav lets you build a visual graph of your pipeline and click any column to instantly highlight its full upstream path — all locally, with no backend or sign-up.

---

## Demo

**Drag columns between DataFrames to wire lineage edges:**

![Column drop demo](public/assets/columndrop.gif)

**Click any column to trace its full upstream path:**

![Lineage tracking demo](public/assets/lineage.gif)

**Search across all nodes and columns:**

![Search demo](public/assets/search.gif)

---

## Use Cases

### Python — Refactoring Pandas / Polars pipelines
You need to modify the calculation logic of a `user_segment` column at the start of a script, but don't know where it gets renamed or used to compute downstream metrics like LTV. Map the script's core logic onto the canvas — clicking `user_segment` at the final output instantly isolates its lineage graph so you can refactor without breaking downstream dependencies.

### SQL — Visualizing CTEs and ETL logic
A final query produces an adjusted metric like `revenue_adjusted` across hundreds of lines and multiple CTEs. Instead of parsing the SQL from bottom to top, model the query visually: use *Merge* nodes for JOIN keys and *Filter* nodes for WHERE clauses. The origin of any metric becomes visible at a single glance.

### Memory optimization — Eliminating dead-weight columns
Unused columns (large string fields, temporary metadata, redundant IDs) bloat RAM across in-memory pipelines. Trace the lineage of any attribute to instantly see if it ever reaches a downstream aggregation or export. If it leads to a dead end, safely drop it early with `.drop(columns=[...])`.

---

## Features

### Node types
| Node | Purpose |
|---|---|
| **DataFrame** | Table with typed columns — the main building block |
| **Merge** | Visual JOIN with key pairs and join type (inner / left / right / outer) |
| **Filter** | Multi-condition WHERE builder with `@column` syntax |
| **Transform** | Type casts, fillna, drop columns, drop duplicates |
| **Rename** | Column rename mappings |
| **GroupBy** | Group-by keys + aggregations (sum, mean, count, nunique…) |
| **Function** | Free-form transformation with named inputs, outputs, and pass-through linking |
| **Comment** | Resizable sticky note with `@ref` highlighting |

### Canvas
- **Column-level lineage** — drag a column from one DataFrame onto another to copy it and auto-draw a lineage edge
- **Attribute Tracker `◎`** — click any column to highlight its full upstream/downstream path; everything else fades out
- **Search `⌘K`** — fuzzy search across all node labels and column names
- **Auto-layout** — one-click dagre LR arrangement
- **Undo / Redo** — full history (50 snapshots)
- **Multiple tabs** — work on several canvases in the same session

### Sharing & export
- **Save / Load JSON** — full canvas state in a portable file
- **Share link** — compressed URL encoding the full canvas (~40 KB JSON → ~3–5 KB URL)
- **Copy / Paste canvas** — `⌃⇧C` / `⌃⇧V`
- **SQL export / import** — generate SELECT queries from the graph or scaffold nodes from a query
- **Export PNG** — 3× pixel-ratio render of the current viewport

### Privacy
Runs entirely in browser localStorage. No data is sent to external servers. Export/import as local JSON or run offline via npm.

---

## Getting Started

```bash
git clone https://github.com/PavelLuchkov/dataloom.git
cd dataloom
npm install
npm start          # opens at http://localhost:3000
```

> If port 3000 is occupied: `PORT=3001 npm start`

On first load the app shows a built-in demo canvas with all node types, lineage edges, and usage tips.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `⌘K` | Open search |
| `⌃⇧F` | Toggle attribute tracker |
| `⌘Z` / `⌘Y` | Undo / Redo |
| `⌘C` / `⌘D` | Copy / Paste selected nodes |
| `⌃⇧C` / `⌃⇧V` | Copy / Paste full canvas |
| `Delete` | Remove selected nodes or edge |
| `@` in Filter | Autocomplete column from connected node |

---

## Alternatives

| Tool | When to choose DataPav instead |
|---|---|
| **Miro / Draw.io** | When you need interactive column-level trace, not just static boxes and arrows |
| **dbt docs** | For projects built without dbt, or quick sketching without boilerplate YAML |
| **Enterprise platforms** *(OpenLineage, Monte Carlo)* | When you need a zero-config local tool without DevOps or compliance overhead |

---

## Stack

- [React Flow](https://reactflow.dev/) — canvas, nodes, handles, edges
- [React](https://react.dev/) (CRA) + [Tailwind CSS v3](https://tailwindcss.com/)
- [dagre](https://github.com/dagrejs/dagre) — auto-layout
- [pako](https://github.com/nodeca/pako) — canvas compression for share links
- [html-to-image](https://github.com/bubkoo/html-to-image) — PNG export

---

## License

MIT
