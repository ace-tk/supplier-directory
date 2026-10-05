// Browser test for Phase 4A: the Export dialog, its live info, the pre-flight gate and the server-made preview.
// Run like the other suites (see ../README.md); the page must be able to reach the export API.
const tick = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
const ticks = async (n = 12) => { for (let i = 0; i < n; i++) await tick(); };
const until = async (fn, max = 8000) => { const t0 = performance.now(); while (performance.now() - t0 < max) { if (fn()) return true; await ticks(10); } return false; };
window.requestAnimationFrame = (cb) => { tick().then(() => cb(performance.now())); return 0; };

export default async function run() {
  const ed = window.__pps, ps = ed.ps, L = ed.contentLayer, cv = ed.canvas;
  cv.setPointerCapture = () => {}; ed.emitScheduled = false;
  const R = []; const ok = (name, pass, info) => R.push(`${pass ? 'PASS' : 'FAIL'} 4A ${name}${info !== undefined ? ' — ' + info : ''}`);
  const ev = (type, pt, o = {}) => { const r = cv.getBoundingClientRect(); cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: r.left + pt.x, clientY: r.top + pt.y, button: 0, pointerId: 1, ...o })); };
  const click = (pt, o) => { ev('pointerdown', pt, o); ev('pointerup', pt, o); };
  const key = (k, o = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o }));
  const V = (p) => ps.view.projectToView(p); const st = () => ed.getState();
  const isPC = (it) => !!(it && it.data && it.data.pc);
  const holder = (pc) => pc.children.find((c) => c.data.pcTile); const clipG = (pc) => pc.children.find((c) => c.data.pcClip); const contents = (pc) => holder(pc) ? [...holder(pc).children] : clipG(pc).children.filter((c) => !c.data.derived);
  const dlg = () => document.querySelector('[role=dialog]');
  const q = (sel) => dlg() && dlg().querySelector(sel); const qa = (sel) => (dlg() ? [...dlg().querySelectorAll(sel)] : []);
  const dbtn = (t) => qa('button').find((b) => b.textContent.trim().startsWith(t));
  const label = (t) => qa('label').find((l) => l.textContent.trim().startsWith(t)); const box = (t) => label(t) && label(t).querySelector('input');
  const info = (k) => { const e = q(`[data-info="${k}"]`); return e ? e.textContent.trim() : ''; };
  const setSelect = async (el, value) => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('change', { bubbles: true })); await ticks(20); };
  const typeIn = async (el, value) => { el.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); await ticks(10); el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); el.blur(); await ticks(20); };
  const openDialog = async () => { key('e', { ctrlKey: true }); await until(() => dlg() && /Export for production/.test(dlg().textContent)); await ticks(20); };
  const closeDialog = async () => { const b = dbtn('Close'); if (b) b.click(); await until(() => !dlg()); await ticks(10); };
  const loadImg = async (url, name, dpi) => { const blob = await (await fetch(url)).blob(); const dataUrl = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); }); const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; }); return { asset: { id: 'a' + Math.random().toString(36).slice(2), name, mime: 'image/png', dataUrl, pxWidth: img.naturalWidth, pxHeight: img.naturalHeight, dpi }, img }; };
  /** The preview picture's pixels. */
  const previewPixels = async () => { const im = q('img[alt="Export preview"]'); const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = im.src; }); const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0); return { w: c.width, h: c.height, d: x.getImageData(0, 0, c.width, c.height).data }; };
  const makePreview = async () => { (dbtn('Preview') || dbtn('Refresh preview')).click(); const done = await until(() => q('img[alt="Export preview"]') || q('[role=alert]'), 60000); await ticks(20); return done && !!q('img[alt="Export preview"]'); };
  try {
  // ---------------------------------------------------------------- a layout to export
  const txt = await (await fetch('/leggings-test.svg')).text();
  const inp = [...document.querySelectorAll('input[type=file]')].find((i) => i.accept.includes('.svg'));
  const dt = new DataTransfer(); dt.items.add(new File([txt], 'leggings-test.svg', { type: 'image/svg+xml' })); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
  const ibtn = () => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim().startsWith('Import'));
  await until(() => ibtn()); ibtn().click(); await until(() => L.children.length === 6); await until(() => !dlg()); await ticks(40);
  ed.setTool('pick'); ed.clearSelection(); ed.setDocName('Leggings Floral'); await ticks();
  ed.applyPieceTags(ed.suggestPieceTags().map((s) => ({ id: s.id, size: s.size, piece: s.piece, mirrorOf: s.mirrorOf }))); await ticks();
  const P = () => ed.listPieces(); const piece = (s, n) => P().find((p) => p.size === s && p.piece === n); const item = (s, n) => ed.findById(piece(s, n).id); const pcOf = (s, n) => { const f = item(s, n); return f.parent && isPC(f.parent) ? f.parent : null; };
  const tile = await loadImg('/repeat-tile.png', 'repeat-tile.png', 200); const floral = await loadImg('/floral-print.png', 'floral-print.png', 400);
  const place = async (img, s, n) => { const f = item(s, n); ed.fitRect(f.bounds.expand(3)); await ticks(); await ed.placeRaster(img.asset, img.img, f.bounds.center); await ticks(); ed.beginPlaceInside(); click(V(f.getPointAt(f.length * 0.37))); await ticks(); return pcOf(s, n); };
  { const pc = await place(tile, 'S', 'Front'); ed.editClip(pc); await ticks(); ed.setClipRepeat(true); await ticks(); ed.setClipRepeat({ type: 'half-drop', tileW: 1.5, tileH: 1.5 }); await ticks(); ed.finishClipEdit(); await ticks(); }
  ed.selectPiece(piece('S', 'Front').id); await ticks(); ed.applyToSizes({ mode: 'keep', anchor: 'center', link: false, pairs: true }); await ticks(30);
  { const pc = await place(floral, 'XL', 'Waistband'); ed.editClip(pc); await ticks(); ed.select(contents(pc)); ed.fitClipContent('fill'); await ticks(); ed.finishClipEdit(); await ticks(); }
  ed.clearSelection(); ed.fitPage(); await ticks();
  ed.runPreflight(); // gives every object its id
  const docBefore = JSON.stringify(ed.toDocument().objects); const histBefore = ed.history.index;

  // ---------------------------------------------------------------- the dialog
  await openDialog();
  ok('Ctrl+E opens the Export dialog', !!dlg() && /Export for production/.test(dlg().textContent));
  ok('format TIFF / PDF; TIFF by default', box('TIFF') && box('TIFF').checked && !!box('PDF'));
  ok('area: whole page by default, with Selected size(s) and Selected objects', box('Whole page').checked && !!box('Selected size(s)') && box('Selected objects').disabled);
  const presetSel = q('select[aria-label="Preset"]');
  ok('preset: "Sublimation 150 DPI (RGB)" by default, plus "High quality 300 DPI (RGB)"', presetSel.selectedOptions[0].textContent === 'Sublimation 150 DPI (RGB)' && [...presetSel.options].some((o) => o.textContent === 'High quality 300 DPI (RGB)'));
  ok('defaults: 150 DPI, mirror OFF, cut lines OFF, size labels OFF, white background', q('input[aria-label="Custom DPI"]').value === '150' && !box('Mirror').checked && !box('Include cut lines').checked && !box('Include size labels').checked && q('select[aria-label="Background"]').value === 'white');
  ok('live info: whole page is 163.75 × 37.694 in = 24,563 × 5,654 px at 150 DPI', /^163\.750? × 37\.694 in$/.test(info('inches')) && info('pixels') === '24,563 × 5,654 px', `${info('inches')} · ${info('pixels')} · ${info('bytes')} · ${info('time')}`);
  ok('…with an estimated file size and time, and the file name', /about .*MB/.test(info('bytes')) && /about \d/.test(info('time')) && /^Leggings-Floral_All-sizes_150dpi_\d{4}-\d\d-\d\d_\d{4}\.tif$/.test(info('name')), info('name'));
  const flightText = () => q('section[aria-label="Pre-flight"]').textContent;
  ok('pre-flight has already run when the dialog opens (no click needed)', /Warnings \(\d+\)/.test(flightText()), flightText().slice(10, 90));
  // presets and DPI
  await setSelect(presetSel, 'high-quality-300');
  ok('"High quality 300 DPI": 49,125 × 11,308 px, about 1.67 GB uncompressed', info('pixels') === '49,125 × 11,308 px' && /1\.67 GB uncompressed/.test(info('bytes')) && /_300dpi_/.test(info('name')), info('bytes'));
  await typeIn(q('input[aria-label="Custom DPI"]'), '1000'); const hi = q('input[aria-label="Custom DPI"]').value; await typeIn(q('input[aria-label="Custom DPI"]'), '10'); const lo = q('input[aria-label="Custom DPI"]').value;
  ok('custom DPI is kept between 72 and 600', hi === '600' && lo === '72' && info('pixels') === '11,790 × 2,714 px', `${hi}, ${lo}`);
  await typeIn(q('input[aria-label="Custom DPI"]'), '200'); ok('…a custom value shows as "Custom settings" in the preset list', q('select[aria-label="Preset"]').value === 'custom' && info('pixels') === '32,750 × 7,539 px');
  // save as preset
  const realPrompt = window.prompt; window.prompt = () => 'Test preset 200'; dbtn('Save as preset').click(); await ticks(20); window.prompt = realPrompt;
  const saved = JSON.parse(localStorage.getItem('pps-export-presets') || '[]');
  ok('"Save as preset" keeps the current settings under a name', saved.some((p) => p.name === 'Test preset 200' && p.options.dpi === 200) && q('select[aria-label="Preset"]').selectedOptions[0].textContent === 'Test preset 200');
  await setSelect(q('select[aria-label="Preset"]'), 'sublimation-150'); await setSelect(q('select[aria-label="Preset"]'), saved.find((p) => p.name === 'Test preset 200').id);
  ok('…and choosing it brings them back', q('input[aria-label="Custom DPI"]').value === '200'); localStorage.removeItem('pps-export-presets');
  await setSelect(q('select[aria-label="Preset"]'), 'sublimation-150');

  // ---------------------------------------------------------------- only XL
  box('Selected size(s)').click(); await ticks(20);
  const sizeBoxes = () => qa('[role=group][aria-label="Sizes"] input');
  ok('Selected size(s) lists the sizes from the piece tags: S M L XL XXL XXXL', qa('[role=group][aria-label="Sizes"] label').map((l) => l.textContent.trim()).join(' ') === 'S M L XL XXL XXXL');
  for (const b of sizeBoxes()) if (b.checked) { b.click(); await ticks(10); }
  ok('with no size ticked there is nothing to export', /Tick at least one size/.test(dlg().textContent) && /Choose an area/.test(q('[data-export-status]').textContent));
  qa('[role=group][aria-label="Sizes"] label').find((l) => l.textContent.trim() === 'XL').querySelector('input').click(); await ticks(20);
  const xl = ed.exportArea('sizes', ['XL']).rect; const xlPx = [Math.round(xl.w * 150), Math.round(xl.h * 150)];
  ok('only XL ticked: the area is the XL block with its bleed, and the pixel size follows', info('pixels') === `${xlPx[0].toLocaleString('en-US')} × ${xlPx[1].toLocaleString('en-US')} px` && /_XL_150dpi_/.test(info('name')), `${info('inches')} · ${info('pixels')}`);
  { const fr = item('XL', 'Front').bounds, bk = item('XL', 'Back').bounds, other = item('L', 'Back').bounds, next = item('XXL', 'Front').bounds;
    ok('…it holds every XL piece plus 0.25 in bleed, and no other size', xl.x <= fr.left - 0.25 + 1e-9 && xl.x + xl.w >= bk.right + 0.25 - 1e-9 && xl.y <= fr.top - 0.25 + 1e-9 && xl.x > other.right && xl.x + xl.w < next.left, `x ${xl.x.toFixed(2)}–${(xl.x + xl.w).toFixed(2)} in`); }
  ok('pre-flight is limited to the chosen area (only XL pieces are listed)', qa('section[aria-label="Pre-flight"] [role=listitem]').length > 0 && qa('section[aria-label="Pre-flight"] [role=listitem]').every((r) => /^(XL-|Untagged|Size_XL)/.test(r.textContent.trim())), qa('section[aria-label="Pre-flight"] [role=listitem]').map((r) => r.textContent.trim().split(' ')[0]).join(', '));

  // ---------------------------------------------------------------- preview: plain, then mirror + cut lines
  const okPlain = await makePreview(); const plain = okPlain ? await previewPixels() : null; const pinfo = q('[data-preview-info]') ? q('[data-preview-info]').textContent : (q('[role=alert]') || {}).textContent;
  ok('Preview: a picture comes back from the export renderer', okPlain && /by the export renderer/.test(pinfo), pinfo);
  const pdpi = plain ? plain.w / xl.w : 0;
  ok('…it is the chosen area at low resolution: same proportions, about 20 DPI', !!plain && Math.abs(plain.w - Math.round(xl.w * pdpi)) <= 1 && Math.abs(plain.h - xl.h * pdpi) <= 1 && pdpi >= 19 && pdpi <= 30, plain ? `${plain.w} × ${plain.h} px = ${pdpi.toFixed(1)} DPI` : '');
  const pxAt = (im, xIn, yIn) => { const X = Math.min(im.w - 1, Math.max(0, Math.round((xIn - xl.x) * pdpi))), Y = Math.min(im.h - 1, Math.max(0, Math.round((yIn - xl.y) * pdpi))); const i = (Y * im.w + X) * 4; return [im.d[i], im.d[i + 1], im.d[i + 2]]; };
  const whiteP = (p) => p[0] > 245 && p[1] > 245 && p[2] > 245;
  { const fr = item('XL', 'Front').bounds, wb = item('XL', 'Waistband').bounds, gs = item('XL', 'Gusset').bounds;
    ok('…the prints are where they are in the editor: XL-Front and XL-Waistband printed, the empty gusset and the gaps white', !!plain && !whiteP(pxAt(plain, fr.center.x, fr.center.y)) && !whiteP(pxAt(plain, wb.center.x, wb.center.y)) && whiteP(pxAt(plain, gs.center.x, gs.center.y)) && whiteP(pxAt(plain, xl.x + 0.05, xl.y + 0.05)), plain ? `front ${pxAt(plain, fr.center.x, fr.center.y)} · gusset ${pxAt(plain, gs.center.x, gs.center.y)}` : ''); }
  box('Mirror').click(); await ticks(20);
  ok('changing an option clears the old preview (it would no longer be true)', !q('img[alt="Export preview"]'));
  const okM = await makePreview(); const mir = okM ? await previewPixels() : null;
  { let diff = 0, self = 0, n = 0; if (plain && mir && mir.w === plain.w) for (let y = 0; y < plain.h; y += 2) for (let x = 0; x < plain.w; x += 2) { const a = (y * plain.w + x) * 4, b = (y * plain.w + (plain.w - 1 - x)) * 4; diff += Math.abs(mir.d[a] - plain.d[b]); self += Math.abs(mir.d[a] - plain.d[a]); n++; }
    ok('Mirror: the preview is the same picture flipped left-right', okM && n > 0 && diff / n < 2 && self / n > 10, `mean difference vs flipped ${(diff / n).toFixed(2)}, vs unflipped ${(self / n).toFixed(1)} (0–255)`); }
  box('Mirror').click(); await ticks(10); box('Include cut lines').click(); await ticks(20); await typeIn(q('input[aria-label="Cut line width in points"]'), '6');
  const okC = await makePreview(); const cut = okC ? await previewPixels() : null;
  { const gs = item('XL', 'Gusset'); const edge = gs.children && gs.children.length ? gs.children[0] : gs; const p = edge.getPointAt(edge.length * 0.1); const a = plain ? pxAt(plain, p.x, p.y) : [0, 0, 0], b = cut ? pxAt(cut, p.x, p.y) : [255, 255, 255];
    let darker = 0; if (plain && cut) for (let i = 0; i < plain.d.length; i += 4) if (cut.d[i] + 60 < plain.d[i]) darker++;
    ok('Include cut lines: the outlines are drawn in the preview (and only then)', okC && whiteP(a) && b[0] < 200 && darker > 200, `empty gusset outline: off rgb(${a}) → on rgb(${b}); ${darker} pixels darker`); }
  ok('the dialog and its preview never touch the document', JSON.stringify(ed.toDocument().objects) === docBefore && ed.history.index === histBefore, `same objects ${JSON.stringify(ed.toDocument().objects) === docBefore}, history ${ed.history.index - histBefore}`);
  ok('full-size export is not offered yet (it is built in 4B / 4C)', dbtn('Export TIFF').disabled);
  await closeDialog();

  // ---------------------------------------------------------------- warnings: "Export anyway"
  await openDialog();
  ok('warnings (empty pieces…) do not block: "Export anyway" is offered', /Warnings \(\d+\)/.test(flightText()) && !/Must be fixed/.test(flightText()) && !!box('Export anyway') && /Tick “Export anyway”/.test(q('[data-export-status]').textContent));
  box('Export anyway').click(); await ticks(20); ok('…ticking it clears the way', /^Ready/.test(q('[data-export-status]').textContent.trim()));
  await closeDialog();

  // ---------------------------------------------------------------- a blocking error, on purpose
  const wbPc = pcOf('XL', 'Waistband'); ed.selectPiece(piece('XL', 'Waistband').id); await ticks(); ed.editClip(wbPc); await ticks(); ed.select(contents(wbPc)); ed.setClipContent({ w: 20 }); await ticks(); ed.finishClipEdit(); await ticks(); ed.clearSelection(); await ticks();
  await openDialog();
  const errRows = () => qa('[role=list][aria-label="Must be fixed before export"] [role=listitem]');
  ok('a print blown up to 80 DPI blocks the export: listed in red with the piece and its DPI', errRows().length === 1 && /XL-Waistband/.test(errRows()[0].textContent) && /80 DPI/.test(errRows()[0].textContent) && errRows()[0].dataset.kind === 'dpi', errRows().map((r) => r.textContent).join(' | '));
  ok('…no "Export anyway" for errors; the status says what to do', !box('Export anyway') && /Fix the problems marked in red/.test(q('[data-export-status]').textContent));
  await typeIn(q('input[aria-label="Custom DPI"]'), '72');
  ok('…at a 72 DPI export the same print only warns (it has more pixels than the export needs)', errRows().length === 0 && qa('[role=list][aria-label="Warnings"] [role=listitem]').some((r) => /XL-Waistband/.test(r.textContent) && /80 DPI/.test(r.textContent)));
  await typeIn(q('input[aria-label="Custom DPI"]'), '150'); const z0 = ps.view.zoom; errRows()[0].click(); await until(() => !dlg()); await ticks(30);
  ok('clicking the error closes the dialog and zooms to that piece', !dlg() && ps.view.zoom > z0 * 2 && st().clip && st().clip.label === 'XL-Waistband');
  // other blocking errors
  const a = ed.assets.get(floral.asset.id); const keep = a.dataUrl; a.dataUrl = '';
  const gateMissing = ed.exportPreflight(ed.exportArea('page').rect, 150); a.dataUrl = keep;
  ok('a missing original image blocks the export, naming the piece', !gateMissing.canExport && gateMissing.errors.some((i) => i.kind === 'missing' && i.label === 'XL-Waistband'));
  ed.undo(); await ticks(); // the 80 DPI print is back to normal
  ok('after fixing it the export is no longer blocked', ed.exportPreflight(ed.exportArea('page').rect, 150).canExport);
  // selected objects
  ed.select([L.children[0]]); await ticks(); await openDialog(); box('Selected objects').click(); await ticks(20);
  const sel = ed.exportArea('selection').rect;
  ok('Selected objects: the area is the selection (with bleed)', !box('Selected objects').disabled && /_Selection_150dpi_/.test(info('name')) && info('pixels') === `${Math.round(sel.w * 150).toLocaleString('en-US')} × ${Math.round(sel.h * 150).toLocaleString('en-US')} px`, info('inches'));
  key('Escape'); await ticks(30); if (dlg()) await closeDialog();
  } catch (e) { R.push('FAIL 4A test stopped — ' + e.message + ' @ ' + ((e.stack || '').split('\n')[1] || '').trim()); }
  return { passed: R.filter((x) => x.startsWith('PASS')).length, total: R.length, failed: R.filter((x) => x.startsWith('FAIL')), all: R };
}
