// EVERY browser suite in one run (Phase 1 + 2 regression, 3A–3E, then Phase 4), followed by the
// performance measurement on the full 6-size leggings file with a repeat print in every piece.
// Run on the temporary test page (see ../README.md, "Testing"):
//   const r = await (await import('/browser-all.mjs')).default();  →  r.summary, r.failed, r.performance
const tick = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
const ticks = async (n = 12) => { for (let i = 0; i < n; i++) await tick(); };
const until = async (fn, max = 8000) => { const t0 = performance.now(); while (performance.now() - t0 < max) { if (fn()) return true; await ticks(10); } return false; };

const SUITES = [
  ['Phase 1 + 2', 'browser-regression'],
  ['3A PowerClip', 'browser-powerclip'],
  ['3B Print fit', 'browser-print-fit'],
  ['3C Repeat', 'browser-repeat'],
  ['3D Pieces', 'browser-pieces'],
  ['3E Production', 'browser-production'],
  ['4A Export dialog', 'browser-export'],
];

export async function performance3(ed) {
  const ps = ed.ps, L = ed.contentLayer, cv = ed.canvas; cv.setPointerCapture = () => {}; ed.emitScheduled = false;
  const ev = (type, pt) => { const r = cv.getBoundingClientRect(); cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: r.left + pt.x, clientY: r.top + pt.y, button: 0, pointerId: 1 })); };
  const click = (pt) => { ev('pointerdown', pt); ev('pointerup', pt); };
  const V = (p) => ps.view.projectToView(p);
  const dbtn = (t) => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim().startsWith(t));
  const txt = await (await fetch('/leggings-test.svg')).text();
  const inp = [...document.querySelectorAll('input[type=file]')].find((i) => i.accept.includes('.svg'));
  const dt = new DataTransfer(); dt.items.add(new File([txt], 'leggings-test.svg', { type: 'image/svg+xml' })); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
  await until(() => dbtn('Import')); dbtn('Import').click(); await until(() => L.children.length === 6); await ticks(40);
  ed.setTool('pick'); ed.clearSelection();
  // close the open XXXL leg so all 6 sizes have all 4 pieces, then tag everything
  const open = ed.listOpenPaths().sort((x, y) => y.nodes - x.nodes)[0]; ed.editOpenPath(open); await ticks(); ed.closeWithLine(); await ticks(); ed.setTool('pick'); await ticks();
  ed.applyPieceTags(ed.suggestPieceTags().map((s) => ({ id: s.id, size: s.size, piece: s.piece, mirrorOf: s.mirrorOf }))); await ticks();
  const P = () => ed.listPieces(); const piece = (s, n) => P().find((p) => p.size === s && p.piece === n); const item = (s, n) => ed.findById(piece(s, n).id);
  const blob = await (await fetch('/repeat-tile.png')).blob(); const dataUrl = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
  const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
  for (const name of ['Front', 'Waistband', 'Gusset']) {
    const f = item('S', name); ed.fitRect(f.bounds.expand(3)); await ticks();
    await ed.placeRaster({ id: 'tile-' + name, name: 'repeat-tile.png', mime: 'image/png', dataUrl, pxWidth: img.naturalWidth, pxHeight: img.naturalHeight, dpi: 200 }, img, f.bounds.center); await ticks();
    const edge = f.children && f.children.length ? f.children[0] : f; // the gusset is a compound outline
    ed.beginPlaceInside(); click(V(edge.getPointAt(edge.length * 0.37))); await ticks();
    ed.editClip(item('S', name).parent); await ticks(); ed.setClipRepeat(true); await ticks(); ed.setClipRepeat({ type: 'half-drop', tileW: 1.5, tileH: 1.5 }); await ticks(); ed.finishClipEdit(); await ticks();
    ed.selectPiece(piece('S', name).id); await ticks(); ed.applyToSizes({ mode: 'keep', anchor: 'center', link: true, pairs: true }); await ticks(30);
  }
  ed.clearSelection(); await ticks();
  const printed = P().filter((p) => p.repeat).length;
  const tilesOnScreen = () => ed.clips().reduce((s, pc) => s + (ed.repeatInfo.get(pc)?.tiles ?? 0), 0);
  const measure = async (zoomPct, center) => {
    ed.setZoomPct(zoomPct); ps.view.center = center; ed.viewChanged(); ps.view.update(); await ticks(4);
    const times = []; const N = 60;
    for (let i = 0; i < N; i++) {
      const dir = i < N / 2 ? 1 : -1; const t0 = performance.now();
      ed.panBy(14 * dir, 5 * dir); // one pan step: tiles for the new view are rebuilt, overlay redrawn…
      ps.view.update(); // …and the canvas is painted
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b); const mean = times.reduce((s, t) => s + t, 0) / N; const p95 = times[Math.floor(N * 0.95)];
    return { zoomPct, tiles: tilesOnScreen(), frameMs: +mean.toFixed(1), fps: Math.round(1000 / mean), worstMs: +p95.toFixed(1), worstFps: Math.round(1000 / p95) };
  };
  ed.fitPage(); await ticks();
  const at14 = await measure(14, L.bounds.center);
  const at400 = await measure(400, item('M', 'Front').bounds.center);
  const doc = ed.toDocument(); const json = JSON.stringify(doc);
  return {
    pieces: P().length, piecesWithRepeat: printed, canvasPx: [cv.width, cv.height], devicePixelRatio,
    pan: [at14, at400],
    saveFile: { totalKB: +(json.length / 1024).toFixed(1), objectsKB: +(JSON.stringify(doc.objects).length / 1024).toFixed(1), imagesKB: +(JSON.stringify(doc.assets).length / 1024).toFixed(1), images: doc.assets.length },
    visibility: document.visibilityState,
  };
}

export default async function runAll() {
  const ed = window.__pps; const page = { ...ed.getState().page }; const out = []; const failed = [];
  for (const [label, file] of SUITES) {
    // every suite starts from an empty default document
    ed.setTool('pick'); ed.newDocument(page, 'in'); await ticks(30);
    let r; const t0 = performance.now();
    try { r = await (await import(`/${file}.mjs?v=${Date.now()}`)).default(); } catch (e) { r = { passed: 0, total: 1, failed: [`${label} crashed: ${e.message}`] }; }
    out.push({ suite: label, passed: r.passed, total: r.total, seconds: +((performance.now() - t0) / 1000).toFixed(1) });
    for (const f of r.failed || []) failed.push(`${label}: ${typeof f === 'string' ? f : f.name + (f.info ? ' — ' + f.info : '')}`);
  }
  ed.setTool('pick'); ed.newDocument(page, 'in'); await ticks(30);
  let perf; try { perf = await performance3(ed); } catch (e) { perf = { error: e.message + ' @ ' + ((e.stack || '').split('\n')[1] || '').trim() }; }
  const passed = out.reduce((s, x) => s + x.passed, 0), total = out.reduce((s, x) => s + x.total, 0);
  return { summary: `${passed}/${total} checks passed in ${out.length} suites`, suites: out, failed, performance: perf };
}
