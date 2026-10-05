# Pattern Print Studio

A CorelDRAW-style layout and vector editor for garment print production, inside SupplyBase.
Route: `/design-studio/pattern-print-studio` (behind `NEXT_PUBLIC_FEATURE_PATTERN_STUDIO`).

Everything is stored in **inches at full precision**; values are rounded only when shown (3 decimals).
The default page is the leggings sheet, 163.75 × 37.694 in.

| Phase | What it covers | Status |
|---|---|---|
| 1 | Real-size page, rulers, grid, guidelines, snapping, zoom, pick/move/scale/rotate, duplicate, group, align, undo, save/load, SVG/PDF/image import, SVG export | Done |
| 2 | Vector node editing (Shape tool), shaping, convert to curves, trace bitmap | Done |
| 3 | Prints inside pattern outlines (PowerClip), repeat fill, piece tags and all sizes, bleed, seam preview, pre-flight | Done |
| 4 Lite | Production export: print-ready TIFF and editable vector PDF (RGB) | Done |

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

## Prints inside pattern outlines (Phase 3)

### PowerClip workflow

1. **Import the print** (File → Import) and select it.
2. **Place it inside an outline:** *Object → PowerClip: Place inside frame…* and click the outline — or drag the print onto the outline with the **right** mouse button and choose *PowerClip inside*. The print and the outline both stay exactly where they are; the print is only hidden outside the outline. Only closed outlines can hold a print; an open one offers *Check outlines*.
3. **A small bar appears under the piece:** *Edit* (also double-click or Ctrl+click the piece), *Extract* (takes the print back out, in place) and *Lock* (on: the print moves with the piece; off: the piece moves and the print stays).
4. **While editing**, the whole print is shown (faded outside the piece) and the property bar gives exact control: X / Y measured from the frame, W / H, rotation, scale %, a 9-point anchor, **Centre / Fit / Fill / Stretch / Top**, and the print's **effective DPI** (amber under 150, red under 100). Esc or a click outside finishes.
5. **Cut lines:** every piece's outline is drawn on top of its print (View menu: on / off with `Alt+L`, colour, width).

### Repeat fill

While editing a PowerClip, turn on **Repeat**. The print becomes one tile, repeated across the piece: straight, half-drop, half-brick or mirror, with tile size, spacing, offset, rotation and scale %. Drag inside the piece (or use the arrow keys) to shift where the repeat starts. Only the settings are saved, never the tiles, and the fill always covers the piece plus its bleed.

### Sizes workflow (Pieces tab)

1. **Tag the pieces.** *Auto-tag…* reads the size labels in the file ("S", "M", "XL"…) and each outline's shape and position, and shows a table of suggested Size / Piece / Mirror-of tags. Correct it, then apply. Tags can also be typed per piece.
2. **Set up the print in one piece**, e.g. S-Front.
3. **Apply to all sizes.** Choose *Keep print size* (default — right for repeats and all-over prints) or *Scale with piece* (placement prints), and where to line up: piece centre, top-centre (waist) or a reference point placed on each piece. The target pieces are highlighted and a summary is shown ("Will update 5 pieces: M-Front … XXXL-Front") before anything changes. One undo step.
4. **Link sizes** (option): the copies follow later edits of the master. A linked piece changed by hand is flagged; *Re-sync* or *Unlink* it.
5. **Mirror pairs:** give a piece a *Mirror of* (Back is the mirror of Front); *Mirror print* flips the print left-right onto its pair, and *Also mirror onto paired pieces* does it for every size.

### Production checks (Checks tab)

- **Bleed** — the print runs past every cut line by the document bleed (default 0.25 in); a piece can have its own. The cut line stays on the original outline. *Show bleed area* tints it light pink; with it off the screen shows the print cut at the outline, but the bleed is still kept in the file. *Fill* and *Stretch* cover the bleed too.
- **Seam match preview** — *Pick edge A*, click an edge of one piece; *Pick edge B*, click an edge of another (an "edge" is the run of outline between two corners). *Preview seam* shows the two pieces joined along those edges. It is a preview only: nothing in the layout moves. Arrow keys (or the X / Y boxes) move piece B's print; *Apply offset* / Enter moves the real print by that much; Esc closes.
- **Pre-flight** — *Run pre-flight* lists: pieces with no print, white-gap risk (a single print that does not cover outline + bleed), low-DPI bitmaps, open outlines, pieces without tags, and linked pieces that differ from their master. Click a line to zoom to that piece.

## Production export (Phase 4 Lite)

*File → Export…* (`Ctrl+E`) makes the files that go to the printer. Everything is rendered **on the server from the original image files**, never from the screen copies. RGB only (sRGB).

### Export workflow

1. **Choose the format** — *TIFF* (print-ready, the main deliverable) or *PDF* (editable vector backup, opens in CorelDRAW / Illustrator).
2. **Choose the area** — the whole page, one or more sizes (from the piece tags; the area is everything belonging to those sizes, bleed included), or the selected objects.
3. **Choose a preset** or set the options: DPI (150, 300, or 72–600), Mirror, Include cut lines (and their width), Include size labels, Background white / transparent. The dialog shows the size in inches, the pixel size (`round(inches × DPI)`), an estimated file size and time, and the file name.
4. **Pre-flight runs by itself** when the dialog opens, for the chosen area. Errors (red) block the export: a missing original image, an open outline holding a print, a print under 100 effective DPI. Warnings (amber) need *Export anyway*: empty or untagged pieces, DPI 100–150, white-gap risk, linked pieces that differ. Click any line to zoom to the piece.
5. **Preview** shows a low-resolution picture (about 20 DPI) made by the same renderer as the final file.
6. **Export** starts a background job and closes the dialog. A progress chip and the *Exports* list (Checks tab) show the percentage and the step; *Cancel* stops it. When it finishes, a toast offers *Download*; a failed job shows its reason and *Retry*.

What is printed: the prints (clipped to outline + bleed, repeats laid out in full) and any free artwork. Pattern linework — piece outlines, notches, grain lines — is printed only with *Include cut lines*, label text only with *Include size labels*, and a tagged piece's own fill never. **Tag the pieces before exporting**: an untagged filled shape counts as artwork and is printed.

### Presets and defaults

| Preset | DPI | Format |
|---|---|---|
| Sublimation 150 DPI (RGB) — default | 150 | TIFF, LZW, 8-bit RGB, white background |
| High quality 300 DPI (RGB) | 300 | the same |

*Save as preset* keeps the current options under a name (in this browser). Mirror, cut lines and size labels are off by default; bleed is always included as set in the Checks tab.

TIFF details: LZW with horizontal predictor, the sRGB ICC profile embedded, resolution tags written as the exact fraction DPI/1 in inches (so the file opens at its true size), BigTIFF automatically above 4 GB of pixel data. Images with another profile (Adobe RGB, CMYK JPEG) are converted to sRGB. File name: `{document}_{area}_{dpi}dpi_{YYYY-MM-DD_HHmm}.tif`.

PDF details: the page is the export area at 72 pt per inch; outlines and vector prints stay vector; each PowerClip is a real clipping path; each image is stored once (sRGB JPEG / PNG byte for byte, optionally downsampled to 300 effective DPI); a repeat's tile is one form XObject used once per position; three layers — *Print*, *Cut lines*, *Size labels* — are always present and switched on according to the options; text is outlines unless *Keep text editable* is ticked. File name: `{document}_{area}_{date}.pdf`.

### Calibration test

*Checks tab → Exports → Make calibration test* writes a 10 × 10 in TIFF with a tick every inch and a 5 in square, at 150 or 300 DPI. Print it once and measure the square's outer edge with a ruler: if it is 5 in, every export at that DPI is at true size.

### Checking a TIFF

```bash
node features/pattern-print-studio/export/verify-tiff.mjs out.tif --width 163.75 --height 37.694 --dpi 150
node features/pattern-print-studio/export/verify-tiff.mjs mirrored.tif --width 163.75 --height 37.694 --dpi 150 --mirror --reference out.tif
```

The script reads the TIFF's tags straight from the file and checks the pixel size, the DPI tags, 8-bit RGB, LZW, the embedded sRGB profile and — against an un-mirrored export of the same thing — the mirror. Exit code 0 means every check passed.

### Where it runs, storage, configuration

- **There is no separate worker to start.** Export jobs run inside the app's own Node.js server process, one at a time (others wait in line). `npm run dev` or `npm start` is all that is needed locally.
- **It needs a long-running Node server** (a VPS or any always-on Node host). On a serverless platform a background job is cut off when the request ends, so full-size exports will not finish there.
- **Storage is the server's disk**, under the system temp folder (`<tmp>/supplybase-pps-export`): `assets/` holds each uploaded original once, under its SHA-256; `jobs/<user>/<document>/<job>/` holds a job's record, its request and the finished file. The last 20 exports of a document are kept, for 7 days. A server restart or redeploy may empty the temp folder; for production, move `EXPORT_ROOT` (in `export/server/asset-store.ts`) to a persistent folder.
- **Download links are signed and expire after 1 hour**; the Download button always asks for a fresh one. They are signed with the app's existing `JWT_SECRET`.
- **No new environment variables.** The API lives under `/api/pattern-print-studio/export/` and needs a signed-in user (the download link itself needs only its signature).

Measured on the 6-size leggings sheet (19 printed pieces, 2,757 repeat tiles; Apple-silicon Mac, dev server):

| Export | Pixels | Time | File | Peak memory (whole server process) |
|---|---|---|---|---|
| Whole page, 150 DPI TIFF | 24,563 × 5,654 | 82 s | 26 MB | 312 MB |
| Whole page, 300 DPI TIFF | 49,125 × 11,308 | 5 min 31 s | 32 MB | 435 MB |
| One size (XL), 150 DPI TIFF | 3,878 × 5,070 | 9 s | 4.7 MB | 255 MB |
| Whole page, PDF | 11,790 × 2,714 pt | 0.4 s | 0.5 MB | 261 MB |

The test print is a small flat-colour tile; photographic prints give much larger files and take longer.

### Adding CMYK / ICC or cutter files later

Nothing below is built; these are the places to extend.

- **CMYK / ICC output:** colour is decided in two functions of `export/server/render.ts` — `prepareImage` (each original → sRGB) and the end of `renderTiff` (`withIccProfile("srgb")`, 3 channels). A CMYK export converts there with a press profile (libvips can do it), writes 4 channels, and adds a `colour` field to `ExportOptions` in `export/options.ts`. `verify-tiff.mjs` checks photometric = RGB and the profile name; both need a CMYK branch. In `export/server/pdf.ts`, colours are written with `setFillingRgbColor` and images embedded as RGB.
- **Pantone / spot colours:** the scene (`export/scene.ts`) passes colours through as CSS strings; a spot colour needs its own field on the style and a Separation colour space in `pdf.ts`.
- **Cutter files (DXF / PLT):** the cut lines are already separated from the prints by the walker in `export/scene.ts` (`cutLine`) and `export/server/pdf.ts` (the *Cut lines* layer). A DXF / PLT writer is a third consumer of the same document: walk it the same way and write only the outlines, in inches, as polylines (`flattenSegs` in `scene.ts` turns curves into points). Add the format to `ExportFormat` and a branch in `export/server/jobs.ts`.
- **Another storage (S3, Supabase):** only `export/server/asset-store.ts` and the file paths in `export/server/jobs.ts` know about the disk.

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
| Right-mouse drag onto an outline | PowerClip inside | Pick tool |
| Double-click / `Ctrl`+click a PowerClip | Edit the print inside | Pick tool |
| `Esc` | Cancel "place inside" / finish editing a PowerClip / close the seam preview | |
| `Alt+L` | Show / hide cut lines | Anywhere |
| Arrow keys | Shift the repeat (editing a repeat fill) / move piece B's print (seam preview) | |
| `Enter` | Apply the seam offset | Seam preview |
| `Ctrl+G` / `Ctrl+U` | Group / Ungroup | |
| `Ctrl+D` | Duplicate | |
| `Ctrl+Z` / `Ctrl+Shift+Z` or `Ctrl+Y` | Undo / Redo | |
| `Ctrl+C` `Ctrl+X` `Ctrl+V` | Copy, Cut, Paste | |
| `Ctrl+S` `Ctrl+O` `Ctrl+I` `Ctrl+E` | Save, Open, Import, Export… (TIFF / PDF; *Export page as SVG* is in the File menu) | |
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
- `engine/powerclip.ts` — the PowerClip structure: a group holding a clipped group (generated mask + prints), an optional hidden tile holder, and the real outline. Generated parts (mask, repeat tiles) are never saved.
- `engine/clip-fit.ts`, `engine/repeat.ts`, `engine/pieces.ts`, `engine/bleed.ts` — pure maths with no Paper.js dependency: Fit / Fill / DPI, repeat tile positions, size-to-size transforms and mirror, outline offset (bleed) and seam alignment.
- Repeat tiles are Paper symbol instances of one tile definition, built only for the part of each piece that is on screen and rebuilt when the view changes.
- Bleed uses our own outline-offset code (no library): curves are flattened to 0.002 in, edges are moved out with round outside corners and exact inside mitres, and anything closer than the bleed to another part of the outline is cut away.
- Document format version 2 adds a `powerclip` node (`pc` settings, `frame`, `contents`), a `tag` on outlines and `bleed` in the document settings. Older files open unchanged (they get the default 0.25 in bleed).
- `export/` — production export. `options.ts` (options, presets, pixel / file-name arithmetic), `gate.ts` (which pre-flight issues block an export) and `scene.ts` (document → the picture to export, as SVG) are pure and shared by the browser, the server and the tests. `export/server/` runs only on the server: `render.ts` (scene → PNG preview / TIFF, drawn in strips and joined by libvips so the whole image is never in memory), `pdf.ts` (document → editable PDF), `jobs.ts` (background jobs, the export list, signed links), `calibration.ts`, `asset-store.ts`. The preview and the final TIFF go through the same scene and the same rasteriser.
- Undo is snapshot-based (last 100 steps). Each step also stores the node selection, so undo / redo restores it.

### Dependencies

| Package | Licence | Used for | Loaded |
|---|---|---|---|
| `paper` | MIT | Canvas, geometry, boolean operations | With the studio route |
| `opentype.js` | MIT | Glyph outlines for Convert to curves | First text conversion |
| `imagetracerjs` | Unlicense (public domain) | Trace bitmap | First use of the Trace dialog, in a Web Worker |
| `sharp` | Apache-2.0 | Export: rasterising the scene, colour conversion, writing TIFF | Server only |
| `pdf-lib` | MIT | Export: writing the editable PDF | Server only |
| `vitest` (dev only) | MIT | Unit tests | Never shipped |

Font: **Arimo** (SIL Open Font License 1.1), `public/pattern-print-studio/fonts/`, regular and bold, Latin characters.

## Testing

**Unit tests** — `npm test` (vitest, 121 tests in `__tests__/*.test.ts`): units, node types, curve dragging, add / delete node, boolean operations, serialize → deserialize, undo history, trace helpers (`geometry`); PowerClip structure, save / load equality, Fit / Fill / DPI (`powerclip`); repeat tile positions (`repeat`); apply-to-all-sizes maths and the mirror transform (`pieces`); bleed offset and seam alignment (`bleed`); export pixel-size / DPI maths, mirror, export area, file naming, the pre-flight gate rules, the scene, and real renders — clipping, bleed, no hairline seams in repeats, strips identical to a single render, and the **TIFF verification script run on a small sample document** (`export`); background jobs, signed links, cancel, retry, the 20-export list and the calibration sheet (`export-jobs`); the PDF — page size, clipping paths, images stored once, tile reuse, layers, text, downsampling, and on macOS a comparison with the system PDF engine (`export-pdf`). `npm test` is the command to run in CI; it needs no browser and no server.

If `npm test` stops with "Cannot find native binding", npm skipped an optional platform file. On an Apple-silicon Mac: `npm install --no-save @rolldown/binding-darwin-arm64` (use the package named in the error on other machines).

**Browser regression** — `__tests__/browser-all.mjs` runs every browser suite in one go on the 6-size leggings file, then measures editor performance:

| Suite | File | Checks |
|---|---|---|
| Phase 1 + 2 | `browser-regression.mjs` | 72 |
| 3A PowerClip | `browser-powerclip.mjs` | 34 |
| 3B Print fit | `browser-print-fit.mjs` | 26 |
| 3C Repeat | `browser-repeat.mjs` | 27 |
| 3D Pieces | `browser-pieces.mjs` | 32 |
| 3E Production | `browser-production.mjs` | 53 |
| 4A Export dialog | `browser-export.mjs` | 35 |
| 4B TIFF render | `browser-export-tiff.mjs` | 6 |
| 4C + 4D Export jobs, PDF | `browser-export-jobs.mjs` | 34 |

The suites drive the real studio, so they need a page that can be opened without signing in and an export API to match. A helper script creates both for local use and removes them again:

1. `bash features/pattern-print-studio/__tests__/dev-test-routes.sh up`, then `npm run dev`.
2. Open `http://localhost:3000/pps-test`, then in the browser console: `await (await import('/browser-all.mjs')).default()`. It takes about three minutes (it really exports, and cancels a 300 DPI job).
3. Read `summary`, `failed` and `performance` in the result.
4. `bash features/pattern-print-studio/__tests__/dev-test-routes.sh down` — **always, before committing**: the test routes skip the sign-in check (they answer 404 in production builds, but must never be deployed).

Each suite can also be run on its own on a freshly loaded page: `(await import('/browser-repeat.mjs')).default()`. They use the `window.__pps` handle, which production builds leave out. The 3A–3D suites switch the bleed off, because they check the print clipped exactly at the cut line.

**Performance (Phase 3 final check)** — all 24 pieces of the 6 sizes filled with a 1.5 in half-drop repeat, bleed on, 2276 × 1612 px canvas, Apple-silicon Mac. Time for one pan step (rebuild the tiles for the new view, redraw the overlay, paint the canvas):

| Zoom | Tiles on screen | Average | Slowest 5 % |
|---|---|---|---|
| 14 % (whole sheet) | 1,607 | 20.8 ms ≈ 48 fps | 31.9 ms ≈ 31 fps |
| 400 % | 7 | 2.0 ms (display-limited, 60 fps) | 2.8 ms |

Save file for that document: 190 KB (108 KB of objects, 82 KB of images — the 400 px tile). The measurement was taken with the browser pane in the background, so treat it as a guide and check by eye.

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
- **PowerClip frames must be closed outlines.** A print inside a group's piece works, but prints cannot be nested (a PowerClip inside a PowerClip).
- **Repeat fill:** a tile so small that one piece would need more than 6,000 copies on screen is not drawn at that zoom (zoom in to see it). The tile is one print or group; there is no pattern-swatch library.
- **Apply to all sizes works by piece name** — the same name must exist in the other sizes. *Scale with piece* uses one factor from the pieces' areas, so the print never distorts but does not follow a change of proportions.
- **Auto-tag only suggests.** It reads size labels that are text (or text converted in the studio) and guesses names from shape: tall = Front / Back, wide = Waistband, the rest = Gusset.
- **Linked sizes are copies that can drift**: a linked piece edited by hand is flagged, not blocked.
- **Bleed is a polyline** (curves flattened to 0.002 in on screen, 0.0005 in in exports). The old *Export page as SVG* still clips prints at the cut line; the TIFF and PDF exports include the bleed.
- **Export is RGB only** (sRGB). No CMYK / ICC press profiles, no Pantone, no cutter files (DXF / PLT) — see "Adding CMYK / ICC or cutter files later".
- **Export needs an always-on Node server and keeps its files in the server's temp folder** (7 days, last 20 per document). One export renders at a time.
- **Cancelling an export takes effect between strips**: a few seconds at 150 DPI, up to about half a minute at 300 DPI.
- **Pixel sizes are whole numbers**, so a size can be off by up to half a pixel: the 37.694 in page is 5,654 px at 150 DPI = 37.693 in.
- **An untagged filled shape is exported as artwork.** Tag every pattern piece, or its shading is printed.
- **PDF:** editable text uses Helvetica / Arial and is not embedded (outlines are the default); clip paths that include bleed are many short straight lines; PDF viewers can show hairlines between the tiles of a rotated repeat on screen (tiles overlap by 0.003 in, which covers them at print resolution). The PDF has been checked with pdf.js and macOS Preview's engine, **not yet in CorelDRAW or Illustrator**.
- **The export list is per user and per document id**; a document saved before Phase 4 gets its id the first time it is opened.
- **Seam preview lines the two edges up by their end points.** Curved seams therefore show a small gap or overlap along the curve; it is a visual check, not a sewing simulation. It moves the print only, never rotates it.
- **Pre-flight's white-gap check looks at each print's box**, not at transparent areas inside a PNG, and is not run for repeat fills (they always cover the piece).
- **Pre-flight's open-outline check skips grain lines, notches and dashed lines** (anything whose ends are further apart than a quarter of its length).
- **Single layer** — the status bar always says "Layer 1".
- DXF (AAMA / ASTM) import is not built.
