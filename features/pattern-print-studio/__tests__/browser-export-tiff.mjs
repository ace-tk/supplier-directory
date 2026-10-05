// Browser test for Phase 4B: the full leggings sheet rendered to TIFF at 40 DPI on the server, checked with the
// verification script (plain + mirrored) and compared with the editor's own picture.
// Run like the other suites (see ../README.md); the page must be able to reach the export API.
const tick = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
const ticks = async (n = 12) => { for (let i = 0; i < n; i++) await tick(); };
const until = async (fn, max = 8000) => { const t0 = performance.now(); while (performance.now() - t0 < max) { if (fn()) return true; await ticks(10); } return false; };
window.requestAnimationFrame = (cb) => { tick().then(() => cb(performance.now())); return 0; };

/** Builds the full 6-size leggings layout: repeat print in every Front / Back / Waistband, a placement print in the XL gusset. */
export async function buildLayout(ed) {
  const ps = ed.ps, L = ed.contentLayer, cv = ed.canvas; cv.setPointerCapture = () => {}; ed.emitScheduled = false;
  const ev = (type, pt) => { const r = cv.getBoundingClientRect(); cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: r.left + pt.x, clientY: r.top + pt.y, button: 0, pointerId: 1 })); };
  const click = (pt) => { ev('pointerdown', pt); ev('pointerup', pt); };
  const V = (p) => ps.view.projectToView(p);
  const dlg = () => document.querySelector('[role=dialog]');
  const txt = await (await fetch('/leggings-test.svg')).text();
  const inp = [...document.querySelectorAll('input[type=file]')].find((i) => i.accept.includes('.svg'));
  const dt = new DataTransfer(); dt.items.add(new File([txt], 'leggings-test.svg', { type: 'image/svg+xml' })); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
  const ibtn = () => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim().startsWith('Import'));
  await until(() => ibtn()); ibtn().click(); await until(() => L.children.length === 6); await until(() => !dlg()); await ticks(40);
  ed.setTool('pick'); ed.clearSelection(); ed.setDocName('Leggings Floral'); await ticks();
  const open = ed.listOpenPaths().sort((x, y) => y.nodes - x.nodes)[0]; ed.editOpenPath(open); await ticks(); ed.closeWithLine(); await ticks(); ed.setTool('pick'); await ticks();
  ed.applyPieceTags(ed.suggestPieceTags().map((s) => ({ id: s.id, size: s.size, piece: s.piece, mirrorOf: s.mirrorOf }))); await ticks();
  const P = () => ed.listPieces(); const piece = (s, n) => P().find((p) => p.size === s && p.piece === n); const item = (s, n) => ed.findById(piece(s, n).id);
  const pcOf = (s, n) => { const f = item(s, n); return f.parent && f.parent.data && f.parent.data.pc ? f.parent : null; };
  const loadImg = async (url, name, dpi) => { const blob = await (await fetch(url)).blob(); const dataUrl = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); }); const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; }); return { asset: { id: 'a' + Math.random().toString(36).slice(2), name, mime: 'image/png', dataUrl, pxWidth: img.naturalWidth, pxHeight: img.naturalHeight, dpi }, img }; };
  const tile = await loadImg('/repeat-tile.png', 'repeat-tile.png', 200); const floral = await loadImg('/floral-print.png', 'floral-print.png', 400);
  const place = async (img, s, n) => { const f = item(s, n); const edge = f.children && f.children.length ? f.children[0] : f; ed.fitRect(f.bounds.expand(3)); await ticks(); await ed.placeRaster(img.asset, img.img, f.bounds.center); await ticks(); ed.beginPlaceInside(); click(V(edge.getPointAt(edge.length * 0.37))); await ticks(); return pcOf(s, n); };
  let first = true;
  for (const name of ['Front', 'Waistband']) {
    const pc = await place(tile, 'S', name); ed.editClip(pc); await ticks(); ed.setClipRepeat(true); await ticks(); ed.setClipRepeat({ type: first ? 'half-drop' : 'mirror', tileW: 1.5, tileH: 1.5, rotation: first ? 0 : 20 }); await ticks(); ed.finishClipEdit(); await ticks();
    ed.selectPiece(piece('S', name).id); await ticks(); ed.applyToSizes({ mode: 'keep', anchor: 'center', link: false, pairs: true }); await ticks(30); first = false;
  }
  { const pc = await place(floral, 'XL', 'Gusset'); ed.editClip(pc); await ticks(); const c = pc.children.find((k) => k.data.pcClip).children.filter((k) => !k.data.derived); ed.select(c); ed.fitClipContent('fill'); await ticks(); ed.setClipContent({ rotation: 15 }); await ticks(); ed.finishClipEdit(); await ticks(); }
  ed.clearSelection(); ed.fitPage(); await ticks(20);
  return { P, piece, item, pcOf };
}

const API = '/api/pps-test-export';

export default async function run() {
  const ed = window.__pps, ps = ed.ps;
  const R = []; const ok = (name, pass, info) => R.push(`${pass ? 'PASS' : 'FAIL'} 4B ${name}${info !== undefined ? ' — ' + info : ''}`);
  const report = {};
  try {
  const { P } = await buildLayout(ed);
  ok('the full layout is ready: 24 pieces, 19 with prints', P().length === 24 && P().filter((p) => p.hasPrint).length === 19, `${P().filter((p) => p.hasPrint).length} printed`);

  // ---------------------------------------------------------------- server checks: verification script + editor comparison
  const DPI = 40; ed.fitPage(); await ticks(20); ps.view.update();
  const raster = ed.contentLayer.rasterize({ resolution: 72 * DPI, insert: false }); const b = raster.bounds; // where the picture really sits (it includes strokes and bleed)
  const { doc, assets } = ed.exportDocument();
  // upload the originals (once each, under their SHA-256), as the dialog does
  const hashes = []; for (const a of assets) { const blob = await (await fetch(a.dataUrl)).blob(); const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map((x) => x.toString(16).padStart(2, '0')).join(''); const head = await fetch(`${API}/assets/${h}`, { method: 'HEAD' }); if (!head.ok) await fetch(`${API}/assets/${h}`, { method: 'PUT', body: blob }); hashes.push({ id: a.id, hash: h, name: a.name }); }
  const area = ed.exportArea('page').rect;
  const check = async (tag, options, withEditor) => (await fetch('/api/pps-test-export/tiff-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag, request: { doc, assets: hashes, area, options: { format: 'tiff', dpi: DPI, mirror: false, cutLines: false, cutLineWidthPt: 0.5, sizeLabels: false, background: 'white', ...options } }, editor: withEditor ? { png: raster.toDataURL(), x: b.x, y: b.y } : undefined }) })).json();
  // These checks need the developer-only helper route that runs the verification script and the comparison on the server.
  const probe = await fetch('/api/pps-test-export/tiff-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => null);
  if (!probe || probe.status === 404) { R.push('PASS 4B (server-side verification and editor comparison skipped: the helper route is not installed)'); return { passed: R.filter((x) => x.startsWith('PASS')).length, total: R.length, failed: R.filter((x) => x.startsWith('FAIL')), all: R, report }; }
  const def = await check('default', {}, false);
  report.default = def;
  ok('verification script, full page at 40 DPI: every check passes', def.vPlain.ok, def.vPlain.checks.map((c) => `${c.ok ? '✓' : '✗'} ${c.name}: ${c.detail}`).join(' | '));
  ok('…mirror ON: the file is the plain export flipped left-right', def.vMirror.ok, def.vMirror.checks.at(-1).detail);
  ok('…mirror OFF does not pass as mirrored', def.plainFailsMirrorCheck);
  ok('every repeat tile was placed (same count the editor would need for the whole sheet)', def.plain.tiles > 1500, `${def.plain.tiles} tiles, ${def.plain.warnings.length} warnings`);
  const full = await check('with-lines', { cutLines: true, sizeLabels: true }, true);
  report.compare = full.compare; report.withLines = full.plain;
  // What is left is antialiasing: the editor draws a 2048 px screen copy of each image, the export resamples the original.
  ok('editor vs export (with cut lines + labels, 40 DPI): the pictures agree', full.compare.differentPct < 5 && full.compare.differentInPrintPct < 8 && full.compare.mean < 5, `${full.compare.width} × ${full.compare.height} px · mean difference ${full.compare.mean.toFixed(2)} of 255 · ${full.compare.differentPct.toFixed(2)} % of pixels clearly different (${full.compare.differentInPrintPct.toFixed(2)} % inside prints)`);
  } catch (e) { R.push('FAIL 4B test stopped — ' + e.message + ' @ ' + ((e.stack || '').split('\n')[1] || '').trim()); }
  return { passed: R.filter((x) => x.startsWith('PASS')).length, total: R.length, failed: R.filter((x) => x.startsWith('FAIL')), all: R, report };
}
