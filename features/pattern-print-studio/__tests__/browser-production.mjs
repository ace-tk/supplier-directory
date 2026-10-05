// Browser test for Phase 3E: bleed, seam match preview, pre-flight.
// Run like browser-regression.mjs (see ../README.md); needs fixtures/repeat-tile.png and floral-print.png in public/.
const tick = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
const ticks = async (n = 12) => { for (let i = 0; i < n; i++) await tick(); };
const until = async (fn, max = 8000) => { const t0 = performance.now(); while (performance.now() - t0 < max) { if (fn()) return true; await ticks(10); } return false; };
window.requestAnimationFrame = (cb) => { tick().then(() => cb(performance.now())); return 0; };

export default async function run() {
  const ed = window.__pps, ps = ed.ps, L = ed.contentLayer, cv = ed.canvas;
  cv.setPointerCapture = () => {}; ed.emitScheduled = false;
  if (ed.nodeCanvas.width !== cv.width) { ed.nodeCanvas.width = cv.width; ed.nodeCanvas.height = cv.height; }
  const R = []; const ok = (name, pass, info) => R.push(`${pass ? 'PASS' : 'FAIL'} 3E ${name}${info !== undefined ? ' — ' + info : ''}`);
  const ev = (type, pt, o = {}) => { const r = cv.getBoundingClientRect(); cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: r.left + pt.x, clientY: r.top + pt.y, button: 0, pointerId: 1, ...o })); };
  const click = (pt, o) => { ev('pointerdown', pt, o); ev('pointerup', pt, o); };
  const key = (k, o = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o }));
  const V = (p) => ps.view.projectToView(p);
  const st = () => ed.getState(); const hist = () => ed.history.index; const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
  const dbtn = (t) => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim().startsWith(t));
  const btn = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  const isPC = (it) => !!(it && it.data && it.data.pc);
  const clipG = (pc) => pc.children.find((c) => c.data.pcClip); const frame = (pc) => pc.children.find((c) => !c.data.pcClip && !c.data.pcTile && !c.data.derived);
  const mask = (pc) => clipG(pc).children.find((c) => c.data.pcMask);
  const holder = (pc) => pc.children.find((c) => c.data.pcTile); const contents = (pc) => holder(pc) ? [...holder(pc).children] : clipG(pc).children.filter((c) => !c.data.derived);
  const loadImg = async (url, name, dpi) => { const blob = await (await fetch(url)).blob(); const dataUrl = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); }); const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; }); return { asset: { id: 'a' + Math.random().toString(36).slice(2), name, mime: 'image/png', dataUrl, pxWidth: img.naturalWidth, pxHeight: img.naturalHeight, dpi }, img }; };
  const notices = []; const origNotice = ed.onNotice; ed.onNotice = (r) => notices.push(r);
  const dpr = devicePixelRatio; const mctx = cv.getContext('2d'); const nctx = ed.nodeCanvas.getContext('2d');
  const px = (ctx, p) => { const v = V(p); return [...ctx.getImageData(Math.round(v.x * dpr), Math.round(v.y * dpr), 1, 1).data]; };
  const white = (d) => d[3] === 0 || (d[0] > 250 && d[1] > 250 && d[2] > 250);
  const redraw = async () => { await ticks(); ps.view.update(); ed.drawOverlay(); };
  try {
  const txt = await (await fetch('/leggings-test.svg')).text();
  const inp = [...document.querySelectorAll('input[type=file]')].find((i) => i.accept.includes('.svg'));
  const dt = new DataTransfer(); dt.items.add(new File([txt], 'leggings-test.svg', { type: 'image/svg+xml' })); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
  await until(() => dbtn('Import')); dbtn('Import').click(); await until(() => L.children.length === 6); await ticks(40);
  ed.setTool('pick'); ed.clearSelection(); await ticks();
  ed.applyPieceTags(ed.suggestPieceTags().map((s) => ({ id: s.id, size: s.size, piece: s.piece, mirrorOf: s.mirrorOf }))); await ticks();
  const P = () => ed.listPieces(); const piece = (s, n) => P().find((p) => p.size === s && p.piece === n); const item = (s, n) => ed.findById(piece(s, n).id); const pcOf = (s, n) => { const f = item(s, n); return f.parent && isPC(f.parent) ? f.parent : null; };
  const tile = await loadImg('/repeat-tile.png', 'repeat-tile.png', 200); const floral = await loadImg('/floral-print.png', 'floral-print.png', 400);
  const place = async (img, s, n, at) => { const f = item(s, n); ed.fitRect(f.bounds.expand(3)); await ticks(); await ed.placeRaster(img.asset, img.img, at ? at(f) : f.bounds.center); await ticks(); ed.beginPlaceInside(); click(V(f.getPointAt(f.length * 0.37))); await ticks(); return pcOf(s, n); };
  const repeatIn = async (s, n) => { const pc = await place(tile, s, n); ed.editClip(pc); await ticks(); ed.setClipRepeat(true); await ticks(); ed.setClipRepeat({ type: 'half-drop', tileW: 1.5, tileH: 1.5 }); await ticks(); ed.finishClipEdit(); await ticks(); return pcOf(s, n); };

  // ================================================================ BLEED
  ok('a new document has a 0.25 in bleed, shown', st().settings.bleed.amount === 0.25 && st().settings.bleed.visible === true);
  await repeatIn('S', 'Front'); const front = () => pcOf('S', 'Front'); const f0 = frame(front()).pathData; const fb = frame(front()).bounds.clone();
  const grown = (pc, d, e = 0.004) => { const m = mask(pc).bounds, f = frame(pc).bounds; return near(m.left, f.left - d, e) && near(m.right, f.right + d, e) && near(m.top, f.top - d, e) && near(m.bottom, f.bottom + d, e); };
  ok('the print is clipped to the outline grown outward by 0.25 in on every side', grown(front(), 0.25), `clip ${mask(front()).bounds.width.toFixed(3)} × ${mask(front()).bounds.height.toFixed(3)} in for a ${fb.width.toFixed(3)} × ${fb.height.toFixed(3)} in piece`);
  { const m = mask(front()); const pts = m.segments.map((s) => s.point); const f = frame(front()); let minD = Infinity, maxD = 0; for (let i = 0; i < pts.length; i += 3) { const d = f.getNearestPoint(pts[i]).getDistance(pts[i]); minD = Math.min(minD, d); maxD = Math.max(maxD, d); }
    ok('…everywhere along the curved outline: the clip edge is 0.25 in from the cut line, never closer', minD > 0.2499 && maxD < 0.254 && pts.every((p) => !f.contains(p)), `${pts.length} points, distance ${minD.toFixed(4)}–${maxD.toFixed(4)} in`);
    ok('…and it has no self-intersections', m.getIntersections(m).length === 0 && Math.abs(m.area) > Math.abs(f.area)); }
  ok('the cut line (the outline itself) is untouched', frame(front()).pathData === f0);

  // 800 % zoom on the side of the leg
  const f = frame(front()); const off = f.length * 0.3; const edgeP = f.getPointAt(off); let nrm = f.getNormalAt(off); if (f.contains(edgeP.add(nrm.multiply(0.05)))) nrm = nrm.multiply(-1);
  ps.view.center = edgeP; ed.setZoomPct(800); ps.view.center = edgeP; ed.viewChanged(); await redraw();
  const at = (d) => edgeP.add(nrm.multiply(d));
  ok('at 800 %: zoom is 800 %', st().zoomPct === 800, st().zoomPct + ' %');
  ok('at 800 %: the print fills the piece AND the bleed, and stops at the bleed edge', !white(px(mctx, at(-0.1))) && !white(px(mctx, at(0.1))) && !white(px(mctx, at(0.22))) && white(px(mctx, at(0.3))), `inside ${px(mctx, at(-0.1)).slice(0, 3)} · bleed ${px(mctx, at(0.1)).slice(0, 3)} · beyond ${px(mctx, at(0.3)).slice(0, 3)}`);
  const cutPx = px(nctx, at(0)); const edgePx = px(nctx, at(0.25));
  ok('at 800 %: the cut line is drawn ON the original outline — not on the bleed edge', cutPx[3] > 150 && cutPx[0] < 60 && cutPx[1] < 60 && cutPx[2] < 60 && !(edgePx[3] > 150 && edgePx[0] < 60 && edgePx[1] < 60), `on outline rgba(${cutPx}) · on bleed edge rgba(${edgePx})`);
  const tintIn = px(nctx, at(0.12)), tintOut = px(nctx, at(-0.12)), tintFar = px(nctx, at(0.3));
  ok('the bleed area has a light tint; the piece itself and the page outside do not', tintIn[3] > 20 && tintIn[3] < 120 && tintIn[0] > tintIn[1] && tintOut[3] === 0 && tintFar[3] === 0, `bleed rgba(${tintIn})`);
  // hide
  ed.toggleBleed(); await redraw();
  ok('Hide bleed: the screen shows the print cut at the outline again, no tint; the bleed amount is kept', white(px(mctx, at(0.1))) && !white(px(mctx, at(-0.1))) && px(nctx, at(0.12))[3] === 0 && st().settings.bleed.amount === 0.25 && grown(front(), 0, 1e-6));
  ed.toggleBleed(); await redraw(); ok('Show bleed brings it back', !white(px(mctx, at(0.1))) && grown(front(), 0.25));
  // document amount
  ed.updateSettings({ bleed: { amount: 0.5, visible: true } }); await redraw();
  ok('changing the document bleed to 0.5 in re-clips every print; the cut line still does not move', grown(front(), 0.5, 0.006) && !white(px(mctx, at(0.4))) && white(px(mctx, at(0.56))) && frame(front()).pathData === f0 && px(nctx, at(0))[3] > 150);
  ed.updateSettings({ bleed: { amount: 0.25, visible: true } }); await redraw();
  // per piece
  ed.selectPiece(piece('S', 'Front').id); await ticks(); let h = hist(); ed.setClipBleed(0.6); await redraw();
  ok('a piece can have its own bleed (0.6 in), one undo step', grown(front(), 0.6, 0.006) && st().clip.ownBleed && st().clip.bleed === 0.6 && hist() - h === 1 && !white(px(mctx, at(0.5))));
  ed.undo(); await redraw(); ok('…undo puts it back on the document bleed', grown(front(), 0.25) && !st().clip?.ownBleed);
  ed.redo(); await ticks(); ed.selectPiece(piece('S', 'Front').id); await ticks();
  const dB = JSON.stringify(ed.toDocument()); ok('bleed is saved: the document setting and the piece override', /"bleed":\{"amount":0.25,"visible":true\}/.test(dB) && /"bleed":0.6/.test(dB) && !/pcMask/.test(dB));
  ed.setClipBleed(null); await ticks(); ok('"Use the document bleed again" removes the override', grown(front(), 0.25) && !st().clip.ownBleed);
  // the frame is edited: the bleed follows
  ed.setTool('shape'); await ticks(); click(V(frame(front()).getPointAt(frame(front()).length * 0.3))); await ticks();
  { const fr = frame(front()); const seg = fr.segments[Math.floor(fr.segments.length / 2)]; click(V(seg.point)); await ticks(); ed.nudgeNodes(0.5, 0); await ticks(); ed.drawOverlay();
    ok('editing the outline with the Shape tool: the bleed follows the new shape live', grown(front(), 0.25, 0.006) && frame(front()).pathData !== f0); ed.undo(); await ticks(); }
  ed.setTool('pick'); await ticks();
  // the panel
  btn('Checks').click(); await ticks(30);
  ok('Checks panel: Bleed, Seam match and Pre-flight sections', !!document.querySelector('section[aria-label="Bleed"]') && !!document.querySelector('section[aria-label="Seam match"]') && !!document.querySelector('section[aria-label="Pre-flight"]'));
  { const box = document.querySelector('section[aria-label="Bleed"] input[type=checkbox]'); box.click(); await ticks(20); const offNow = st().settings.bleed.visible === false; box.click(); await ticks(20); ok('…the "Show bleed area" switch works from the panel', offNow && st().settings.bleed.visible === true); }

  // ================================================================ SEAM MATCH PREVIEW
  ed.selectPiece(piece('S', 'Front').id); await ticks(); ed.mirrorPrint(); await ticks(30); // S-Back gets the mirrored repeat
  const back = () => pcOf('S', 'Back'); ed.clearSelection(); ed.fitRect(L.children[0].bounds.expand(1)); await redraw();
  const fF = frame(front()), fBk = frame(back());
  // side seams: the edge of Front facing Back, and the edge of Back facing Front
  const facing = fBk.bounds.center.x > fF.bounds.center.x; const sideA = fF.getNearestPoint(new ps.Point(facing ? fF.bounds.right : fF.bounds.left, fF.bounds.center.y)); const sideB = fBk.getNearestPoint(new ps.Point(facing ? fBk.bounds.left : fBk.bounds.right, fBk.bounds.center.y));
  btn('Pick edge A').click(); await ticks(20); const pickingA = st().seam.picking === 'a'; click(V(sideA)); await ticks(20);
  ok('Pick edge A, then a click on the Front side seam picks that edge', pickingA && st().seam.a === 'S-Front' && st().seam.picking === null && /Edge A picked on S-Front/.test(notices.at(-1).message));
  ed.beginPickSeam('b'); click(V(sideB)); await ticks(20);
  ok('Pick edge B on the Back side seam', st().seam.b === 'S-Back');
  const eA = ed.seamPathOf(ed.seamA), eB = ed.seamPathOf(ed.seamB);
  ok('each picked edge is the whole seam from corner to corner (not one small segment)', eA.length > fF.bounds.height * 0.6 && eB.length > fBk.bounds.height * 0.6 && eA.segments.length > 2 && near(eA.length, eB.length, 0.5), `A ${eA.length.toFixed(1)} in, B ${eB.length.toFixed(1)} in of a ${fF.bounds.height.toFixed(1)} in leg`);
  ed.drawOverlay(); { const d = px(nctx, sideA); ok('picked edges are highlighted on the page (A orange)', d[3] > 100 && d[0] > 200 && d[1] > 80 && d[1] < 160, `rgba(${d})`); }
  const docBefore = JSON.stringify(ed.toDocument()); const hBefore = hist(); const zoomBefore = ps.view.zoom, centerBefore = ps.view.center.clone();
  btn('Preview seam').click(); await ticks(30); await redraw();
  const pv = () => ed.seamPreview;
  ok('Preview seam opens a preview; the real layout and the undo history are untouched', !!st().seam.preview && JSON.stringify(ed.toDocument()) === docBefore && hist() === hBefore && ed.seamLayer.children.length === 3);
  { const mid = (p) => p.firstSegment.point.add(p.lastSegment.point).divide(2); const dir = (p) => p.lastSegment.point.subtract(p.firstSegment.point).normalize(); const a = pv().edgeA, b = pv().edgeB; const cross = Math.abs(dir(a).cross(dir(b)));
    const side = (p) => dir(a).cross(p.subtract(a.firstSegment.point)); const outA = pv().outlines[0], outB = pv().outlines[1];
    ok('in the preview the two seams are joined: midpoints meet, seams line up, and Back lies on the far side from Front', mid(a).getDistance(mid(b)) < 1e-6 && cross < 1e-6 && side(outA.bounds.center) * side(outB.bounds.center) < 0, `gap ${mid(a).getDistance(mid(b)).toExponential(1)} in`);
    ok('…Back keeps its true size and shape (turned and moved only)', near(Math.abs(outB.area), Math.abs(fBk.area), 1e-6) && near(outB.length, fBk.length, 1e-6));
    const pA = px(mctx, outA.bounds.center), pB = px(mctx, outB.bounds.center); ok('…both pieces are drawn with their prints', !white(pA) && !white(pB), `A ${pA.slice(0, 3)} B ${pB.slice(0, 3)}`);
    ok('…the SeamBar is shown with Apply and Close', !!document.querySelector('[role=toolbar][aria-label="Seam preview"]') && !!btn('Close')); }
  click(V(pv().outlines[0].bounds.center)); await ticks(); ok('clicking in the preview selects / moves nothing', st().selectionCount === 0 && JSON.stringify(ed.toDocument()) === docBefore);
  // nudge with the arrow keys
  const rB0 = { ...back().data.pc.repeat }; key('ArrowRight'); key('ArrowRight'); key('ArrowRight'); key('ArrowUp'); await ticks(20);
  const nudge = st().settings.nudge; ok('arrow keys nudge the print of piece B inside the preview', near(st().seam.preview.dx, 3 * nudge) && near(st().seam.preview.dy, nudge) && st().seam.preview.canNudge, `${st().seam.preview.dx}, ${st().seam.preview.dy}`);
  ok('…still preview only: the real Back print has not moved', JSON.stringify(ed.toDocument()) === docBefore && hist() === hBefore);
  ed.setSeamOffset(0.4, -0.2); await ticks(20); const prevB = ed.seamLayer.children[2]; const prevRepeat = { ...prevB.data.pc.repeat };
  ok('the preview copy of Back shows the shifted repeat', !near(prevRepeat.offsetX, rB0.offsetX) || !near(prevRepeat.offsetY, rB0.offsetY), `offset ${prevRepeat.offsetX.toFixed(3)}, ${prevRepeat.offsetY.toFixed(3)}`);
  const framesBefore = P().map((p) => { const b = ed.findById(p.id).bounds; return [b.x, b.y, b.width, b.height].join(); }).join('|');
  key('Enter'); await ticks(30);
  const rB1 = back().data.pc.repeat;
  ok('Apply offset: the REAL Back print gets exactly the previewed shift, in one undo step, and the preview closes', !st().seam.preview && hist() - hBefore === 1 && near(rB1.offsetX, prevRepeat.offsetX, 1e-9) && near(rB1.offsetY, prevRepeat.offsetY, 1e-9) && ed.seamLayer.children.length === 0, `repeat offset ${rB0.offsetX.toFixed(3)},${rB0.offsetY.toFixed(3)} → ${rB1.offsetX.toFixed(3)},${rB1.offsetY.toFixed(3)}`);
  ok('…no piece moved — only the print', P().map((p) => { const b = ed.findById(p.id).bounds; return [b.x, b.y, b.width, b.height].join(); }).join('|') === framesBefore);
  ok('…the view is back where it was', near(ps.view.zoom, zoomBefore, 1e-9) && ps.view.center.getDistance(centerBefore) < 1e-6);
  ed.undo(); await ticks(); ok('one undo takes the offset back', JSON.stringify(ed.toDocument().objects) === JSON.stringify(JSON.parse(docBefore).objects)); ed.redo(); await ticks();
  // a single (non-repeat) print as piece B, closed with Esc first
  await place(floral, 'S', 'Waistband'); ed.clearSelection(); ed.fitRect(L.children[0].bounds.expand(1)); await redraw();
  const fW = frame(pcOf('S', 'Waistband')); ed.beginPickSeam('a'); click(V(frame(front()).getNearestPoint(new ps.Point(frame(front()).bounds.center.x, frame(front()).bounds.top)))); await ticks();
  ed.beginPickSeam('b'); click(V(fW.getNearestPoint(new ps.Point(fW.bounds.center.x, fW.bounds.bottom)))); await ticks();
  ok('another pair: Front waist edge + Waistband lower edge', st().seam.a === 'S-Front' && st().seam.b === 'S-Waistband');
  const r1 = ed.previewSeam(); await ticks(20); const c0 = contents(pcOf('S', 'Waistband'))[0].bounds.center.clone(); ed.setSeamOffset(0.3, 0.1); await ticks(); key('Escape'); await ticks(20);
  ok('Esc closes the preview without changing anything', r1.ok && !st().seam.preview && contents(pcOf('S', 'Waistband'))[0].bounds.center.getDistance(c0) < 1e-12);
  ed.previewSeam(); await ticks(20); ed.setSeamOffset(0.3, 0.1); await ticks(20); const pc0 = contents(ed.seamLayer.children[2])[0]; const mInv = new ps.Matrix(...pv().m).inverted(); const shown = mInv.transform(pc0.bounds.center);
  btn('Apply offset').click(); await ticks(30); const c1 = contents(pcOf('S', 'Waistband'))[0].bounds.center;
  ok('a single print is moved too: by the previewed amount (0.316 in), landing exactly where the preview showed it', near(c1.getDistance(c0), Math.hypot(0.3, 0.1), 1e-9) && c1.getDistance(shown) < 1e-6);
  ed.beginPickSeam('b'); click(V(frame(front()).bounds.center)); await ticks(); ok('a click away from any outline picks nothing and says so', !notices.at(-1).ok && /Click on the outline/.test(notices.at(-1).message));
  ed.clearSeam(); await ticks(); ok('Clear forgets both edges', !st().seam.a && !st().seam.b);

  // ================================================================ PRE-FLIGHT (a file with deliberate mistakes)
  // clean pieces: S-Front + S-Back (repeat). Mistakes:
  //  1. empty: S-Gusset (and every other piece that has no print)
  //  2. white gap: S-Waistband — a 4 in print in a 14 in band
  //  3. low DPI: L-Front — the 1600 px print blown up to 20 in (80 DPI)
  //  4. open outline: the XXXL leg
  //  5. untagged: M-Gusset's tag removed
  //  6. linked but different: M-Front linked to S-Front, then changed by hand
  //  + one fully covered single print (M-Waistband, filled) that must NOT be reported
  const big = await place(floral, 'L', 'Front'); ed.editClip(big); await ticks(); ed.select(contents(big)); ed.setClipContent({ w: 20 }); await ticks(); ed.finishClipEdit(); await ticks();
  const good = await place(floral, 'M', 'Waistband'); ed.editClip(good); await ticks(); ed.select(contents(good)); ed.fitClipContent('fill'); await ticks(); ed.finishClipEdit(); await ticks();
  ed.applyPieceTags([{ id: piece('M', 'Gusset').id, size: '', piece: '' }]); await ticks();
  ed.selectPiece(piece('S', 'Front').id); await ticks(); ed.applyToSizes({ mode: 'keep', anchor: 'center', link: true, pairs: false }); await ticks(30);
  // L-Front already had a print: put the low-DPI one back for this check
  const linkedM = pcOf('M', 'Front'); ed.selectPiece(piece('M', 'Front').id); await ticks(); ed.editClip(linkedM); await ticks(); ed.setClipRepeat({ offsetX: 0.77 }); await ticks(); ed.finishClipEdit(); await ticks();
  ed.clearSelection(); await ticks();
  const issues = ed.runPreflight(); const of = (k) => issues.filter((i) => i.kind === k); const has = (k, label) => of(k).some((i) => i.label === label);
  ok('1. pieces with no print are listed (S-Gusset …), pieces with a print are not', has('empty', 'S-Gusset') && !has('empty', 'S-Front') && !has('empty', 'S-Waistband') && of('empty').length === P().filter((p) => !p.hasPrint).length, `${of('empty').length} empty pieces`);
  ok('2. white-gap risk: the small print in S-Waistband is listed; the filled M-Waistband and the repeats are not', has('gap', 'S-Waistband') && !has('gap', 'M-Waistband') && !has('gap', 'S-Front') && !has('gap', 'S-Back'), (of('gap')[0] || {}).message);
  const lowLabel = pcOf('L', 'Front') && !pcOf('L', 'Front').data.pc.repeat ? 'L-Front' : null;
  { // after "apply to all sizes" L-Front holds the repeat; blow a tile up instead so there is a low-DPI print on the page
    const pcL = pcOf('L', 'Front'); ed.selectPiece(piece('L', 'Front').id); await ticks(); ed.unlinkClip(); await ticks(); ed.editClip(pcL); await ticks(); ed.setClipRepeat({ scale: 400 }); await ticks(); ed.finishClipEdit(); await ticks(); ed.clearSelection(); }
  const issues2 = ed.runPreflight(); const of2 = (k) => issues2.filter((i) => i.kind === k);
  ok('3. low DPI: the tile enlarged 4× in L-Front (200 → 50 DPI) is listed with its DPI; the 200 DPI ones are not', of2('dpi').some((i) => i.label === 'L-Front' && /50 DPI/.test(i.message) && i.level === 'error') && !of2('dpi').some((i) => i.label === 'S-Front'), (of2('dpi')[0] || {}).message + (lowLabel ? '' : ''));
  ok('4. the open XXXL outline is listed; grain lines, notches and dashed stitch lines are not', of2('open').length === 1 && /Open outline: \d+ nodes/.test(of2('open')[0].message), (of2('open')[0] || {}).message);
  ok('5. the untagged piece is listed', of2('untagged').length === 1 && /Untagged piece/.test(of2('untagged')[0].label), (of2('untagged')[0] || {}).label + ' ' + (of2('untagged')[0] || {}).message);
  ok('6. the linked piece that was changed by hand is listed; linked pieces still in step are not', of2('link').length === 1 && of2('link')[0].label === 'M-Front' && /Linked to S-Front/.test(of2('link')[0].message));
  // the panel
  btn('Run pre-flight').click(); await ticks(40); const rows = [...document.querySelectorAll('[aria-label="Pre-flight issues"] [role=listitem]')];
  ok('the Checks panel lists every issue, grouped under the six headings', rows.length === issues2.length && ['Pieces with no print', 'White-gap risk', 'Low DPI prints', 'Open outlines', 'Pieces without tags', 'Linked pieces that differ'].every((t) => document.querySelector('section[aria-label="Pre-flight"]').textContent.includes(t)), `${rows.length} issues shown`);
  ed.fitPage(); await ticks(); const z0 = ps.view.zoom; rows.find((r) => r.dataset.kind === 'gap').click(); await ticks(30);
  { const b = frame(pcOf('S', 'Waistband')).bounds; ok('clicking an issue zooms to that piece and selects it', ps.view.zoom > z0 * 1.5 && ps.view.bounds.contains(b) && b.width > ps.view.bounds.width * 0.4 && st().clip && st().clip.label === 'S-Waistband', `zoomed in ${(ps.view.zoom / z0).toFixed(1)}×`); }
  [...document.querySelectorAll('[aria-label="Pre-flight issues"] [role=listitem]')].find((r) => r.dataset.kind === 'open').click(); await ticks(30);
  ok('clicking the open outline opens it in the Shape tool with its loose ends selected', st().tool === 'shape' && st().nodeEdit && st().nodeEdit.open && st().nodeEdit.selected === 2);
  // fix two mistakes, run again
  ed.closeWithLine(); await ticks(); ed.setTool('pick'); await ticks(); ed.selectPiece(piece('S', 'Waistband').id); await ticks(); const wb = pcOf('S', 'Waistband'); ed.editClip(wb); await ticks(); ed.select(contents(wb)); ed.fitClipContent('fill'); await ticks(); ed.finishClipEdit(); await ticks();
  const issues3 = ed.runPreflight();
  ok('after fixing them (close the outline, Fill the frame) the two issues are gone', !issues3.some((i) => i.kind === 'open') && !issues3.some((i) => i.kind === 'gap' && i.label === 'S-Waistband'));
  { // "Fill" covers the outline; with bleed the print must cover outline + bleed
    const g = issues3.filter((i) => i.kind === 'gap'); ok('…and Fill covers the bleed too (no white-gap left on that piece)', !g.some((i) => i.label === 'S-Waistband'), g.map((i) => i.label).join(',') || 'no gap issues'); }

  // ================================================================ save / reload, undo all / redo all
  const d1 = JSON.stringify(ed.toDocument()); await ed.loadDocument(JSON.parse(d1)); await ticks(30);
  ok('save → reload identical; bleed setting and clips rebuilt', JSON.stringify(ed.toDocument()) === d1 && st().settings.bleed.amount === 0.25 && grown(pcOf('S', 'Front'), 0.25));
  } catch (e) { R.push('FAIL 3E test stopped — ' + e.message + ' @ ' + ((e.stack || '').split('\n')[1] || '').trim()); }
  ed.onNotice = origNotice;
  return { passed: R.filter((x) => x.startsWith('PASS')).length, total: R.length, failed: R.filter((x) => x.startsWith('FAIL')), all: R };
}
