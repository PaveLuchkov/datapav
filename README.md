# Loom — DataFrame Lineage Editor

> A visual canvas for documenting data transformations: DataFrames, joins, filters, aggregations — all connected as a graph with column-level lineage.

<!-- Add a screenshot or GIF here once you have one -->
<!-- ![Loom demo](./docs/demo.gif) -->

Built for data analysts and engineers who want to *draw* how data flows rather than describe it in text.

---

## Features

### Node types
| Node | Purpose |
|---|---|
| **DataFrame** | Table with typed columns — the main building block |
| **Merge** | Visual JOIN with key pairs and join type selector (inner / left / right / outer) |
| **Filter** | Multi-condition WHERE builder with `@column` syntax |
| **Transform** | Type casts, fillna, drop columns, drop duplicates — with a companion output DF |
| **Rename** | Column rename mappings — with a companion output DF |
| **GroupBy** | Group-by keys + aggregations (sum, mean, count, nunique…) |
| **Function** | Free-form transformation with named inputs, outputs, and pass-through linking |
| **Comment** | Resizable sticky note for annotations (`@ref` highlighting included) |

### Canvas
- **Column-level lineage** — drag a column from one DataFrame onto another to copy it and auto-draw a lineage edge
- **DF-level connections** — connect whole DataFrames to operator nodes via square handles
- **Companion DataFrames** — operator nodes (Filter, Transform, Rename, Merge, GroupBy, Function) auto-generate and sync an output DataFrame; columns update live when the operator changes
- **Attribute Tracker `◎`** — click the trace button on any column to highlight its full upstream/downstream lineage; other nodes fade out
- **Search `⌘K`** — fuzzy search across all node labels and column names, jump to result
- **Auto-layout** — one-click dagre LR arrangement
- **Undo / Redo** — full history (50 snapshots)
- **Copy / Paste** — `⌘C` / `⌘D`, offset on repeated paste
- **Multiple tabs** — work on several canvases in the same session

### Filter `@column` autocomplete
Type `@` inside any Filter condition and get instant suggestions pulled from connected upstream nodes — with type badges (`str`, `int`, `flt`…).

### Sharing
- **Save / Load JSON** — full canvas state in a portable file
- **Copy to clipboard / Paste** — `⌃⇧C` / `⌃⇧V` — share canvas state via clipboard
- **Share link** — generate a compressed URL that encodes the full canvas (~40 KB JSON → ~3–5 KB URL); anyone with the link opens the same state instantly
- **SQL export** — generates `SELECT … FROM … JOIN … WHERE` from the graph
- **SQL import** — paste a `SELECT` query to scaffold a DataFrame node with columns
- **Export PNG** — 3× pixel-ratio render of the current viewport

### First run
On first load the app shows a built-in demo canvas: a complete e-commerce order pipeline with all node types, lineage edges, and usage tips. Clear `lineage-demo-loaded` from localStorage to reset it.

---

## Getting started

```bash
git clone https://github.com/PavelLuchkov/dataloom.git
cd dataloom
npm install
npm start          # opens at http://localhost:3000
```

> If port 3000 is occupied: `PORT=3001 npm start`

No backend, no database — everything lives in `localStorage`.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `⌘K` | Open search |
| `⌘⇧F` | Toggle attribute tracker |
| `⌘Z` | Undo |
| `⌘Y` / `⌘⇧Z` | Redo |
| `⌘C` | Copy selected nodes |
| `⌘D` | Paste |
| `⌃⇧C` | Copy canvas to clipboard |
| `⌃⇧V` | Paste canvas from clipboard |
| `Delete` | Remove selected nodes or edge |
| `@` in Filter | Autocomplete column from connected node |

---

## How it works

1. **Add nodes** from the toolbar or right-click the canvas
2. **Draw DF-level connections** by dragging from the square handle (top-right of any node) to another node's input handle
3. **Drag columns** between DataFrames to copy them and record lineage
4. **Drop columns** onto a Filter / GroupBy / Function input panel to wire them as inputs
5. **Trace lineage** by clicking `◎` on any column — the graph highlights its full lineage path
6. **Share** via the share-link button or export to JSON

---

## Stack

- [React Flow](https://reactflow.dev/) — canvas, nodes, handles, edges
- [React](https://react.dev/) (CRA)
- [Tailwind CSS v3](https://tailwindcss.com/)
- [dagre](https://github.com/dagrejs/dagre) — auto-layout
- [pako](https://github.com/nodeca/pako) — canvas compression for share links
- [html-to-image](https://github.com/bubkoo/html-to-image) — PNG export

---

## License

MIT
