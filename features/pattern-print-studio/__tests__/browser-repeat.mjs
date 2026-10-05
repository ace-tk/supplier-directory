// Browser test for Phase 3C: Repeat fill (straight, half-drop, half-brick, mirror), tile size / spacing / offset / rotation / scale,
// live dragging, seams at 800%, save and reload. Run like browser-regression.mjs (see ../README.md); needs fixtures/repeat-tile.png in public/.
const tick = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
const ticks = async (n = 12) => { for (let i = 0; i < n; i++) await tick(); };
const until = async (fn, max = 8000) => { const t0 = performance.now(); while (performance.now() - t0 < max) { if (fn()) return true; await ticks(10); } return false; };
window.requestAnimationFrame = (cb) => { tick().then(() => cb(performance.now())); return 0; };

export default async function run() {
  const ed = window.__pps, ps = ed.ps, L = ed.contentLayer, cv = ed.canvas;
  cv.setPointerCapture = () => {}; ed.emitScheduled = false;
  const R = []; const ok = (name, pass, info) => R.push(`${pass ? 'PASS' : 'FAIL'} 3C ${name}${info !== undefined ? ' — ' + info : ''}`);
  const ev = (type, pt, o = {}) => { const r = cv.getBoundingClientRect(); cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: r.left + pt.x, clientY: r.top + pt.y, button: 0, pointerId: 1, ...o })); };
  const click = (pt, o) => { ev('pointerdown', pt, o); ev('pointerup', pt, o); };
  const drag = (a, b, o) => { ev('pointerdown', a, o); for (let i = 1; i <= 5; i++) ev('pointermove', { x: a.x + (b.x - a.x) * i / 5, y: a.y + (b.y - a.y) * i / 5 }, o); ev('pointerup', b, o); };
  const V = (p) => ps.view.projectToView(p);
  const key = (k, o = {}) => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o })); window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true, ...o })); };
  const st = () => ed.getState(); const hist = () => ed.history.index; const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
  const dbtn = (t) => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim() === t);
  const isPC = (it) => !!(it && it.data && it.data.pc);
  const clipG = (pc) => pc.children.find((c) => c.data.pcClip); const frame = (pc) => pc.children.find((c) => !c.data.pcClip && !c.data.pcTile && !c.data.derived);
  const holder = (pc) => pc.children.find((c) => c.data.pcTile); const tiles = (pc) => { const g = clipG(pc).children.find((c) => c.data.pcRepeat); return g ? g.children : []; };
  const rep = (pc) => pc.data.pc.repeat;
  const loadImg = async (url, name, dpi) => { const blob = await (await fetch(url)).blob(); const dataUrl = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); }); const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; }); return { asset: { id: 'a' + Math.random().toString(36).slice(2), name, mime: 'image/png', dataUrl, pxWidth: img.naturalWidth, pxHeight: img.naturalHeight, dpi }, img }; };
  const mctx = cv.getContext('2d'); const dpr = devicePixelRatio;
  const pixel = (p) => { const v = V(p); return mctx.getImageData(Math.round(v.x * dpr), Math.round(v.y * dpr), 1, 1).data; };
  // Is every sampled point inside the frame covered by the print (no white page showing)?
  const covered = (pc, n = 400) => { ps.view.update(); const f = frame(pc); const b = f.bounds.intersect(ps.view.bounds); let inside = 0, white = 0; for (let k = 0; k < n * 6 && inside < n; k++) { const p = new ps.Point(b.x + b.width * ((k * 0.6180339) % 1), b.y + b.height * ((k * 0.7548776) % 1)); if (!f.contains(p) || f.getNearestPoint(p).getDistance(p) < 6 / ps.view.zoom) continue; inside++; const d = pixel(p); if (d[0] > 250 && d[1] > 250 && d[2] > 250) white++; } return { inside, white }; };

  const txt = await (await fetch('/leggings-test.svg')).text();
  const inp = [...document.querySelectorAll('input[type=file]')].find((i) => i.accept.includes('.svg'));
  const dt = new DataTransfer(); dt.items.add(new File([txt], 'leggings-test.svg', { type: 'image/svg+xml' })); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
  await until(() => dbtn('Import')); dbtn('Import').click(); await until(() => L.children.length === 6); await ticks(40);
  ed.setTool('pick'); ed.clearSelection(); await ticks();
  const g = () => L.children[0]; const tileImg = await loadImg('/repeat-tile.png', 'repeat-tile.png', 200); // 400 px = 2 in
  const h0 = hist(); const imported = JSON.stringify(ed.toDocument().objects);

  // The three pieces of size S: the two legs and the waistband.
  const legs = g().children.filter((c) => c.className === 'Path' && c.closed && !c.dashArray.length && c.bounds.height > 20).sort((a, b) => a.bounds.x - b.bounds.x);
  const band = g().children.find((c) => c.className === 'Path' && c.closed && c.segments.length === 4 && c.bounds.width > c.bounds.height);
  const targets = [legs[0], legs[1], band]; const ids = [];
  ed.select([g()]); ed.fitSelection(); await ticks();
  for (const t of targets) {
    await ed.placeRaster(tileImg.asset, tileImg.img, t.bounds.center); await ticks();
    ed.beginPlaceInside(); click(V(t.getPointAt(t.length * 0.4))); await ticks();
    const pc = g().children.find((c) => isPC(c) && frame(c) === t); ids.push(pc.data.id);
    ed.editClip(pc); await ticks(); ed.setClipRepeat(true); await ticks(); ed.setClipRepeat({ type: 'half-drop' }); await ticks(); ed.finishClipEdit(); await ticks();
  }
  const pcs = () => ids.map((id) => g().children.find((c) => c.data.id === id)); const A = () => pcs()[0];
  ok('all 3 pieces of size S filled with a 2 in tile in half-drop', pcs().every((pc) => pc && rep(pc) && rep(pc).type === 'half-drop' && near(rep(pc).tileW, 2) && tiles(pc).length > 0), pcs().map((pc) => tiles(pc).length + ' tiles').join(', '));
  ok('one hidden tile is kept; the tiles on screen are generated', pcs().every((pc) => holder(pc) && holder(pc).visible === false && holder(pc).children.length === 1 && tiles(pc).every((t) => t.className === 'SymbolItem')));
  const c1 = covered(A()); ok('the repeat covers the whole frame (no white page inside)', c1.inside > 300 && c1.white === 0, `${c1.inside} points sampled, ${c1.white} white`);
  const objs = JSON.stringify(ed.toDocument().objects); ok('saved file holds settings, not tiles', !/pcRepeat|SymbolItem/.test(objs) && (objs.match(/"t":"raster"/g) || []).length === 3, `objects ${(objs.length / 1024).toFixed(0)} KB for ${pcs().reduce((n, pc) => n + tiles(pc).length, 0)} tiles on screen`);

  // --- half-drop geometry on the real items
  const posOf = (pc) => tiles(pc).map((t) => t.matrix.transform(holder(pc).bounds.topLeft)); // where each tile's top-left lands
  { const P = posOf(A()).sort((a, b) => a.y - b.y || a.x - b.x); const xs = [...new Set(P.map((p) => +p.x.toFixed(6)))].sort((a, b) => a - b); const col = (x) => P.filter((p) => near(p.x, x, 1e-6)).map((p) => p.y).sort((a, b) => a - b);
    const a = col(xs[1]), b = col(xs[2]); const grow = tiles(A())[0].matrix.a - 1; // sub-pixel overlap
    ok('half-drop: columns 2 in apart, tiles 2 in apart, next column dropped by half a tile', near(xs[2] - xs[1], 2, 1e-6) && near(a[1] - a[0], 2, 1e-6) && near(Math.abs((b[0] - a[0]) % 2), 1, 1e-6), `column step ${(xs[2] - xs[1]).toFixed(4)}, drop ${Math.abs((b[0] - a[0]) % 2).toFixed(4)}, overlap ${(grow * 2 * ps.view.zoom).toFixed(2)} px`); }

  // --- edit: tile size, spacing, type, scale
  ed.select([g()]); ed.activeClip = A(); ed.editClip(A()); await ticks();
  ok('edit mode shows the repeat controls; nothing is selected as an object', st().clip.editing && st().clip.repeat && st().selectionCount === 0 && !!document.querySelector('select[aria-label="Repeat type"]') && st().clip.tiles.drawn === tiles(A()).length);
  let h = hist(); const n0 = tiles(A()).length; ed.setClipRepeat({ tileW: 1, tileH: 1 }); await ticks();
  ok('tile size 1 in: about four times the tiles, one undo step', near(rep(A()).tileW, 1) && tiles(A()).length > n0 * 3 && hist() - h === 1, `${n0} → ${tiles(A()).length} tiles`);
  ed.setClipRepeat({ gapX: 0.25, gapY: 0.5 }); await ticks(); { const P = posOf(A()); const xs = [...new Set(P.map((p) => +p.x.toFixed(6)))].sort((a, b) => a - b); const ys = P.filter((p) => near(p.x, xs[1], 1e-6)).map((p) => p.y).sort((a, b) => a - b);
    ok('spacing 0.25 / 0.5 in: tiles step by tile + gap', near(xs[2] - xs[1], 1.25, 1e-9) && near(ys[1] - ys[0], 1.5, 1e-9), `step ${(xs[2] - xs[1]).toFixed(3)} × ${(ys[1] - ys[0]).toFixed(3)} in`); }
  ed.setClipRepeat({ gapX: -0.2, gapY: 0 }); await ticks(); ok('negative spacing = overlap is allowed', near(rep(A()).gapX, -0.2) && tiles(A()).length > 0);
  ed.setClipRepeat({ gapX: 0, gapY: 0, tileW: 2, tileH: 2 }); await ticks();
  for (const type of ['straight', 'half-brick', 'mirror']) { ed.setClipRepeat({ type }); await ticks(); const c = covered(A()); const flips = tiles(A()).filter((t) => t.matrix.a < 0 || t.matrix.d < 0).length;
    ok(`${type}: covers the frame${type === 'mirror' ? ', alternate tiles flipped' : ''}`, c.white === 0 && c.inside > 300 && (type === 'mirror' ? flips > tiles(A()).length * 0.6 : flips === 0), `${tiles(A()).length} tiles${type === 'mirror' ? ', ' + flips + ' flipped' : ''}`); }
  ed.setClipRepeat({ type: 'half-drop', scale: 50 }); await ticks(); ok('scale 50%: tile and spacing halve', tiles(A()).length > n0 * 3 && near(Math.abs(tiles(A())[0].matrix.a), 0.5, 0.03)); ed.setClipRepeat({ scale: 100 }); await ticks();
  ed.setClipRepeat({ rotation: 30 }); await ticks(); { const c = covered(A()); const m = tiles(A())[0].matrix; ok('rotation 30° of the whole repeat: still covers the frame', c.white === 0 && c.inside > 300 && near(Math.atan2(-m.b, m.a) * 180 / Math.PI, 30, 1e-6), `${tiles(A()).length} tiles`); } ed.setClipRepeat({ rotation: 0 }); await ticks();

  // --- drag inside the frame = offset, live
  h = hist(); const f = frame(A()); const a = V(f.bounds.center), b = { x: a.x + 30, y: a.y - 20 }; const before = posOf(A())[0].clone();
  ev('pointerdown', a); ev('pointermove', { x: a.x + 15, y: a.y - 10 }); const mid = rep(A()).offsetX; const liveTiles = tiles(A()).length; ev('pointermove', b); ev('pointerup', b); await ticks();
  ok('drag inside the frame shifts the repeat (live), one undo step', near(rep(A()).offsetX * ps.view.zoom, 30, 0.01) && near(rep(A()).offsetY * ps.view.zoom, -20, 0.01) && near(mid * ps.view.zoom, 15, 0.01) && liveTiles > 0 && hist() - h === 1 && !posOf(A())[0].equals(before));
  key('ArrowRight'); await ticks(); ok('arrow keys nudge the repeat offset', near(rep(A()).offsetX * ps.view.zoom, 30 + 0.01 * ps.view.zoom, 0.01) && hist() - h === 2);
  key('Escape'); await ticks(); ok('Esc finishes editing', !st().clip.editing && st().tool === 'pick');

  // --- seams at 800 %
  ed.select([g()]); ed.activeClip = A(); ed.editClip(A()); await ticks(); ed.setClipRepeat({ type: 'straight', offsetX: 0, offsetY: 0 }); await ticks(); ed.finishClipEdit(); await ticks();
  ed.setZoomPct(800); const hb = holder(A()).bounds; ps.view.center = new ps.Point(hb.right, hb.center.y); ed.viewChanged(); await ticks(); ps.view.update();
  const lum = (d) => 0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2]; let hair = 0, checked = 0;
  // A hairline gap would be a thin light line exactly ON the seam, along its whole length. Look 4 px either side of the
  // seam wherever the artwork is the same on both sides, and flag a pixel at the seam that is lighter than both.
  const scan = (data) => { const n = data.length / 4; const L0 = lum(data), LN = lum(data.subarray(data.length - 4)); if (Math.abs(L0 - LN) > 10) return; checked++; const midA = Math.floor(n / 2) - 2, midB = Math.floor(n / 2) + 2; let worst = 0; for (let i = midA; i <= midB; i++) worst = Math.max(worst, lum(data.subarray(i * 4, i * 4 + 4)) - Math.max(L0, LN)); if (worst > 14) hair++; };
  { const vx = V(new ps.Point(hb.right, 0)).x; for (let y = 20; y < cv.clientHeight - 20; y += 1) scan(mctx.getImageData(Math.round((vx - 4) * dpr), Math.round(y * dpr), Math.round(8 * dpr), 1).data); }
  { const vy = V(new ps.Point(0, hb.bottom)).y; if (vy > 10 && vy < cv.clientHeight - 10) for (let x = 20; x < cv.clientWidth - 20; x += 1) scan(mctx.getImageData(Math.round(x * dpr), Math.round((vy - 4) * dpr), 1, Math.round(8 * dpr)).data); }
  // A real seam shows at (nearly) every position; a handful of hits are just fine detail in the artwork crossing the edge.
  ok('zoom 800%: no hairline gap along the seam between tiles', checked > 300 && hair / checked < 0.02, `${checked} seam positions checked, ${hair} lighter than both sides (${(100 * hair / checked).toFixed(1)}%); zoom ${st().zoomPct.toFixed(0)}%`);
  ok('only tiles near the view are built when zoomed in', tiles(A()).length < 40, tiles(A()).length + ' tiles at 800%');
  ed.select([g()]); ed.fitSelection(); await ticks();

  // --- frame edits: the repeat follows
  ed.setTool('shape'); await ticks(); const fr = frame(A()); click(V(fr.segments[4].point.add(fr.segments[5].point).divide(2))); await ticks(); click(V(fr.segments[4].point)); await ticks();
  ed.nudgeNodes(1.5, 0); await ticks(); { const c = covered(A()); ok('Shape tool widens the piece: the repeat still fills it', c.white === 0 && c.inside > 300); } ed.undo(); await ticks(); ed.setTool('pick'); await ticks();
  ed.select([g()]); await ticks(); const art0 = holder(A()).children[0].matrix.values.map((v) => +v.toFixed(9)).join(','); const tw0 = rep(A()).tileW;
  ed.rotateSelection(15); await ticks(); const artM = holder(A()).children[0].matrix; const c15 = covered(A());
  ok('rotate the piece 15°: the repeat turns with it (repeat rotation 15°), tile artwork stays upright, still covers', near(rep(A()).rotation, 15, 1e-9) && near(artM.b, 0, 1e-9) && near(artM.a, +art0.split(',')[0], 1e-9) && c15.white === 0, `repeat rotation ${rep(A()).rotation}°`);
  ed.undo(); await ticks(); const sb = st().selectionBounds; ed.setLockAspect(true); ed.setSelectionGeometry({ w: sb.w * 1.5 }); await ticks();
  ok('scale the piece 150%: tile size grows with it (kept as a number, artwork not resized)', near(rep(A()).tileW, tw0 * 1.5, 1e-9) && near(holder(A()).children[0].matrix.a, +art0.split(',')[0], 1e-9), `tile ${tw0} → ${rep(A()).tileW.toFixed(3)} in`);
  ed.undo(); await ticks();

  // --- too-small tiles are skipped, not frozen
  ed.fitPage(); await ticks(); ed.select([g()]); ed.activeClip = A(); ed.editClip(A()); await ticks(); const t0 = performance.now(); ed.setClipRepeat({ tileW: 0.02, tileH: 0.02 }); await ticks(); const ms = performance.now() - t0;
  ok('a 0.02 in tile at whole-page zoom is not drawn tile by tile (no freeze) and says so', st().clip.tiles.skipped > 6000 && tiles(A()).length === 0 && ms < 1500 && /zoom in/.test(document.body.textContent), `${st().clip.tiles.skipped} tiles skipped in ${ms.toFixed(0)} ms`);
  ed.undo(); await ticks(); ed.finishClipEdit(); await ticks();

  // --- undo all, redo all; save and reload
  { const end = JSON.stringify(ed.toDocument().objects); const idx = hist(); while (hist() > h0) ed.undo(); await ticks(); const back = JSON.stringify(ed.toDocument().objects) === imported; while (hist() < idx) ed.redo(); await ticks();
    ok('undo all = the imported file; redo all = the same result', back && JSON.stringify(ed.toDocument().objects) === end, `${idx - h0} steps`); }
  ed.select([g()]); ed.fitSelection(); await ticks();
  const d1 = JSON.stringify(ed.toDocument()); await ed.loadDocument(JSON.parse(d1)); await ticks(30); const d2 = JSON.stringify(ed.toDocument());
  ed.select([g()]); ed.fitSelection(); await ticks(); const cr = covered(A());
  ok('save → reload identical; tiles are rebuilt and cover the frame again', d1 === d2 && pcs().every((pc) => rep(pc) && tiles(pc).length > 0) && cr.white === 0, `${(JSON.stringify(JSON.parse(d1).objects).length / 1024).toFixed(0)} KB of objects`);

  // --- performance: pan with the three pieces filled
  { ed.fitPage(); await ticks(); const times = []; for (let i = 0; i < 40; i++) { const t = performance.now(); ed.panBy(i % 2 ? 12 : -12, 0); ps.view.update(); mctx.getImageData(0, 0, 1, 1); times.push(performance.now() - t); } const avg = times.reduce((s, x) => s + x, 0) / times.length;
    ok('pan at whole-page zoom with 3 pieces filled', avg < 33, `${avg.toFixed(1)} ms per frame (${Math.round(1000 / avg)} fps), ${pcs().reduce((n, pc) => n + tiles(pc).length, 0)} tiles`); }

  // --- repeat off
  ed.select([g()]); ed.fitSelection(); ed.activeClip = A(); ed.editClip(A()); await ticks(); ed.setClipRepeat(null); await ticks();
  ok('Repeat fill off: back to the single print, in edit mode, at its own size', !rep(A()) && !holder(A()) && tiles(A()).length === 0 && st().clip.editing && st().clipContent && near(st().clipContent.w, 2, 1e-9));
  ed.finishClipEdit(); await ticks();
  return { passed: R.filter((x) => x.startsWith('PASS')).length, total: R.length, failed: R.filter((x) => x.startsWith('FAIL')), all: R };
}
