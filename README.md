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
| **GroupBy** | Group-by keys + aggregations (sum, mean, count, nunique…) |
| **Function** | Free-form transformation with named inputs and outputs |
| **Comment** | Sticky note for annotations |

### Canvas
- **Column-level lineage** — drag a column from one DataFrame onto another to copy it and auto-draw a lineage edge
- **DF-level connections** — connect whole DataFrames to Merge / Filter / GroupBy / Function nodes via square handles
- **Attribute Tracker `◎`** — type an attribute name to highlight every node that contains it; other nodes fade out; `@refs` in Filter conditions are tracked too
- **Search `⌘K`** — fuzzy search across all node labels and column names, jump to result
- **Auto-layout** — one-click dagre LR arrangement
- **Undo / Redo** — full history (50 snapshots)
- **Copy / Paste** — `⌘C` / `⌘D`, offset on repeated paste

### Filter `@column` autocomplete
Type `@` inside any Filter condition and get instant suggestions pulled from connected upstream nodes — with type badges (`str`, `int`, `flt`…).

### Import / Export
- **Save / Load JSON** — full canvas state in a portable file
- **SQL export** — generates `SELECT … FROM … JOIN … WHERE` from the graph
- **SQL import** — paste a `SELECT` query to scaffold a DataFrame node with columns
- **Export PNG** — 3× pixel-ratio render of the current viewport
- **Multiple tabs** — work on several canvases in the same session

---

## Getting started

```bash
git clone https://github.com/YOUR_USERNAME/loom.git
cd loom
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
| `Delete` | Remove selected nodes or edge |
| `@` in Filter | Autocomplete column from connected node |

---

## How it works

1. **Add nodes** from the toolbar or right-click the canvas
2. **Draw DF-level connections** by dragging from the square handle (top-right corner of any node) to another node's input handle (top-left)
3. **Drag columns** between DataFrames to copy them and record where they came from
4. **Drop columns** onto a Filter / GroupBy / Function input panel to wire them as inputs
5. **Save** to a JSON file to share or resume the diagram later

---

## Stack

- [React Flow](https://reactflow.dev/) — canvas, nodes, handles, edges
- [React](https://react.dev/) (CRA)
- [Tailwind CSS v3](https://tailwindcss.com/)
- [dagre](https://github.com/dagrejs/dagre) — auto-layout
- [html-to-image](https://github.com/bubkoo/html-to-image) — PNG export

---

## License

MIT
