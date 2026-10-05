# Pattern Print Studio

A CorelDRAW-style layout and vector editor for garment print production, inside SupplyBase.
Route: `/design-studio/pattern-print-studio` (behind `NEXT_PUBLIC_FEATURE_PATTERN_STUDIO`).

Everything is stored in **inches at full precision**; values are rounded only when shown (3 decimals).
The default page is the leggings sheet, 163.75 × 37.694 in.

| Phase | What it covers | Status |
|---|---|---|
| 1 | Real-size page, rulers, grid, guidelines, snapping, zoom, pick/move/scale/rotate, duplicate, group, align, undo, save/load, SVG/PDF/image import, SVG export | Done |
| 2 | Vector node editing (Shape tool), shaping, convert to curves, trace bitmap | Done |
| 3 | Placing prints inside pattern outlines (PowerClip) | Not started |

## Tools

| Tool | Key | What it does |
|---|---|---|
| Pick | `V`, tap `Space` | Select, move, scale. Click a selected object again for rotate handles. |
| Shape | `F10`, `N`, tap `Space` | Edit the nodes, handles and segments of one curve. |
| Rectangle | `F6` | Drag a rectangle (Ctrl = square, Shift = from centre). |
| Ellipse | `F7` | Drag an ellipse. |
| Text | `F8` | Click, type, Enter. Text uses the bundled Arimo font. |
| Zoom | `Z` | Click or drag to zoom in; Alt / right-click to zoom out. |
| Pan | `H`, hold `Space` | Drag the page. |

### Shape tool (node editing)

- **Click a curve** to show its nodes. A curve inside a group is picked directly; a compound path shows the nodes of every subpath.
- **Select nodes:** click, Shift+click, drag a marquee, Ctrl+A. Esc clears the nodes; Esc again returns to the Pick tool.
- **Move nodes:** drag (uses the Snap To settings; Ctrl keeps the move horizontal or vertical), arrow keys (nudge distance; Shift = ×10), or type exact X / Y in the property bar.
- **Handles:** shown for the selected nodes and the facing handles of their neighbours. Node types: cusp, smooth, symmetrical.
- **Segments:** click the outline to select a segment; drag a curved segment to bend it. *To line* / *To curve* convert it. The segment's length is shown live.
- **Structure:** double-click the outline to add a node exactly there; double-click a node to delete it. Break, Join, Extend curve to close, Close / Open, Reverse, Align nodes.
- **Simplify:** *More → Simplify (reduce nodes)…* shows a pink preview and the node count before → after for a tolerance in inches. Corners sharper than 30° stay sharp. Nothing changes until Apply.
- **Check outlines:** lists every open path in the document and jumps to it. Phase 3 needs closed outlines.
- Text, and rectangles / ellipses drawn with their tools, show "Convert to curves (Ctrl+Q)" until they are converted.

### Object menu

- **Convert to curves** — rectangles, ellipses and text become editable outlines, in place.
- **Combine / Break apart** — several curves become one curve with subpaths (overlaps become holes), and back.
- **Shaping** (also a tab in the right-hand panel) — Weld, Trim, Intersect, Simplify, Front minus back, Back minus front, with a live pink preview and *Leave original* options. The last selected shape is the target: the result keeps its fill and outline.
- **Trace bitmap** — turns an imported PNG / JPG into vector shapes placed exactly over it: black & white or 2–8 colours, threshold, smoothing, detail, remove white background.

## Shortcuts (CorelDRAW style)

On a Mac, `Ctrl` shortcuts also work with `Cmd`, **except Convert to curves: use the Control key**, because Cmd+Q quits the browser.

| Key | Action | Where |
|---|---|---|
| `F10` / `N` | Shape tool | Anywhere |
| `Space` (tap) | Switch Shape ⇄ Pick | Anywhere |
| `Space` (hold + drag) | Pan | Anywhere |
| `V` `Z` `H` `F6` `F7` `F8` | Pick, Zoom, Pan, Rectangle, Ellipse, Text | Anywhere |
| `C` / `S` / `Y` | Make node cusp / smooth / symmetrical | Shape tool |
| `+` / `−` | Add a node at the middle of the selected segment / delete selected nodes | Shape tool |
| `Delete` | Delete selected nodes (Shape tool) or objects (Pick tool) | |
| `Ctrl+A` | All nodes of the curve (Shape tool) or all objects (Pick tool) | |
| `Esc` | Clear node selection → back to Pick tool → clear selection | |
| Arrow keys | Nudge (Shift = ×10) | Nodes or objects |
| `Ctrl+Q` | Convert to curves | |
| `Ctrl+L` / `Ctrl+K` | Combine / Break apart | |
| `Ctrl+G` / `Ctrl+U` | Group / Ungroup | |
| `Ctrl+D` | Duplicate | |
| `Ctrl+Z` / `Ctrl+Shift+Z` or `Ctrl+Y` | Undo / Redo | |
| `Ctrl+C` `Ctrl+X` `Ctrl+V` | Copy, Cut, Paste | |
| `Ctrl+S` `Ctrl+O` `Ctrl+I` `Ctrl+E` | Save, Open, Import, Export SVG | |
| `Ctrl+'` | Show / hide grid | |
| `F4` / `Shift+F4` / `Shift+F2` | Fit all / fit page / fit selection | |
| `Ctrl +` `Ctrl −` `Ctrl 0` | Zoom in, out, 100% | |
| `Ctrl+PageUp/Down`, `Shift+PageUp/Down` | Forward / backward one, to front / to back | |

No Phase 2 shortcut clashes with Phase 1: `C` `S` `Y` only act in the Shape tool, and with Ctrl they are still Copy, Save and Redo.

## How it is built

- `engine/Editor.ts` — owns the Paper.js scope, the view, selection, undo and documents. Tools route through it.
- `engine/shape-tool.ts` — the Shape tool. Node markers and previews are drawn on a separate 2D canvas over the Paper canvas, only for the edited curve and only inside the viewport, at a fixed screen size.
- `engine/node-geometry.ts` — bezier maths with no Paper.js dependency (node types, handle constraints, curve dragging, delete-node fitting).
- `engine/shaping.ts` — boolean operations (planned without touching the document, then applied) and text → outlines.
- `engine/trace/` — tracing: `trace-core.ts` (pure helpers), `trace.worker.ts` (Web Worker), `trace-client.ts`.
- `engine/serialize.ts` — the document format. Phase 2 added two optional fields on paths: `nt` (node types, one letter per node) and `shape` (a rectangle / ellipse not yet converted). Files saved by Phase 1 open unchanged.
- Undo is snapshot-based (last 100 steps). Each step also stores the node selection, so undo / redo restores it.

### Dependencies

| Package | Licence | Used for | Loaded |
|---|---|---|---|
| `paper` | MIT | Canvas, geometry, boolean operations | With the studio route |
| `opentype.js` | MIT | Glyph outlines for Convert to curves | First text conversion |
| `imagetracerjs` | Unlicense (public domain) | Trace bitmap | First use of the Trace dialog, in a Web Worker |
| `vitest` (dev only) | MIT | Unit tests | Never shipped |

Font: **Arimo** (SIL Open Font License 1.1), `public/pattern-print-studio/fonts/`, regular and bold, Latin characters.

## Testing

**Unit tests** — `npm test` (vitest, `__tests__/geometry.test.ts`): units conversion, node type conversion, curve dragging, add / delete node keeping the shape, boolean operation bounds, serialize → deserialize equality, undo history, trace helpers.

If `npm test` stops with "Cannot find native binding", npm skipped an optional platform file. On an Apple-silicon Mac: `npm install --no-save @rolldown/binding-darwin-arm64` (use the package named in the error on other machines).

**Browser regression** — `__tests__/browser-regression.mjs` runs the Phase 1 checks and every Phase 2 test (72 checks) plus a drag-speed measurement, on `__tests__/fixtures/leggings-test.svg`:

1. Copy both files into `public/` and run `npm run dev`.
2. Open the studio, then in the browser console: `(await import('/browser-regression.mjs')).default()`.
3. Read `passed`, `failed` and `perf` in the result. Remove the two copies from `public/` afterwards.

It needs the dev build (it uses the `window.__pps` handle, which production builds leave out).

The leggings fixture is a generated stand-in (6 sizes, 2,236 nodes, one deliberately open outline), not a production pattern.

## Known limitations

- **No skew, twist, envelope or other distortions.** Selected nodes can be moved, not rotated or scaled as a set.
- **Deleting an original node changes the outline slightly** — one curve cannot follow two exactly (a corner node is cut off). Deleting a node that was just added restores the curve exactly.
- **Bounding box of several selected nodes is read-only** (X / Y / W / H are shown, not typed).
- **Handles do not snap**; only nodes snap to grid, guidelines, page and other nodes.
- **Node types of imported curves are worked out from the handles** until a type is set by hand.
- **Shaping works on individual closed shapes** — ungroup first; open outlines and text are refused with a message.
- **Convert to curves uses Arimo outlines.** Text typed in the studio converts exactly. Imported Arial text converts to the near-identical Arimo shapes; other fonts are replaced, with a notice. Latin characters only.
- **Trace:** the final trace runs on at most 1600 px on the long side; photographs produce thousands of shapes (a warning is shown); a bitmap inside a group must be ungrouped first; colours are averaged, so they can differ by a shade.
- **Check outlines** lists every open path with 3+ nodes, including small open marks such as grainline arrowheads; 2-node lines are hidden by default.
- **Simplify's corner angle (30°) is fixed**, not a setting.
- **Single layer** — the status bar always says "Layer 1".
- DXF (AAMA / ASTM) import is not built.
