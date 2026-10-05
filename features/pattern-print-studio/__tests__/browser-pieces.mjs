// Browser test for Phase 3D: piece tags, the auto-tag helper, Apply to all sizes (keep size / scale with piece),
// linked sizes and mirror pairs. Run like browser-regression.mjs (see ../README.md); needs fixtures/repeat-tile.png and floral-print.png in public/.
const tick = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
const ticks = async (n = 12) => { for (let i = 0; i < n; i++) await tick(); };
const until = async (fn, max = 8000) => { const t0 = performance.now(); while (performance.now() - t0 < max) { if (fn()) return true; await ticks(10); } return false; };
window.requestAnimationFrame = (cb) => { tick().then(() => cb(performance.now())); return 0; };

export default async function run() {
  const ed = window.__pps, ps = ed.ps, L = ed.contentLayer, cv = ed.canvas;
  cv.setPointerCapture = () => {}; ed.emitScheduled = false;
  // A hidden test pane never sizes the overlay canvas; match it to the main canvas so its pixels can be read.
  ed.nodeCanvas.width = cv.width; ed.nodeCanvas.height = cv.height;
  const R = []; const ok = (name, pass, info) => R.push(`${pass ? 'PASS' : 'FAIL'} 3D ${name}${info !== undefined ? ' — ' + info : ''}`);
  const ev = (type, pt, o = {}) => { const r = cv.getBoundingClientRect(); cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: r.left + pt.x, clientY: r.top + pt.y, button: 0, pointerId: 1, ...o })); };
  const click = (pt, o) => { ev('pointerdown', pt, o); ev('pointerup', pt, o); };
  const V = (p) => ps.view.projectToView(p);
  const st = () => ed.getState(); const hist = () => ed.history.index; const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
  const dbtn = (t) => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim().startsWith(t));
  const btn = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t);
  const isPC = (it) => !!(it && it.data && it.data.pc);
  const clipG = (pc) => pc.children.find((c) => c.data.pcClip); const frame = (pc) => pc.children.find((c) => !c.data.pcClip && !c.data.pcTile && !c.data.derived);
  const holder = (pc) => pc.children.find((c) => c.data.pcTile); const contents = (pc) => holder(pc) ? [...holder(pc).children] : clipG(pc).children.filter((c) => !c.data.derived);
  const tiles = (pc) => { const g = clipG(pc).children.find((c) => c.data.pcRepeat); return g ? g.children : []; };
  const loadImg = async (url, name, dpi) => { const blob = await (await fetch(url)).blob(); const dataUrl = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); }); const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; }); return { asset: { id: 'a' + Math.random().toString(36).slice(2), name, mime: 'image/png', dataUrl, pxWidth: img.naturalWidth, pxHeight: img.naturalHeight, dpi }, img }; };
  const notices = []; const origNotice = ed.onNotice; ed.onNotice = (r) => notices.push(r);
  const mctx = cv.getContext('2d'); const dpr = devicePixelRatio;
  const pixel = (p) => { const v = V(p); return mctx.getImageData(Math.round(v.x * dpr), Math.round(v.y * dpr), 1, 1).data; };
  const covered = (pc, n = 300) => { ps.view.update(); const f = frame(pc); const b = f.bounds.intersect(ps.view.bounds); let inside = 0, white = 0; for (let k = 0; k < n * 6 && inside < n; k++) { const p = new ps.Point(b.x + b.width * ((k * 0.6180339) % 1), b.y + b.height * ((k * 0.7548776) % 1)); if (!f.contains(p) || f.getNearestPoint(p).getDistance(p) < 6 / ps.view.zoom) continue; inside++; const d = pixel(p); if (d[0] > 250 && d[1] > 250 && d[2] > 250) white++; } return { inside, white }; };

  try {
  const txt = await (await fetch('/leggings-test.svg')).text();
  const inp = [...document.querySelectorAll('input[type=file]')].find((i) => i.accept.includes('.svg'));
  const dt = new DataTransfer(); dt.items.add(new File([txt], 'leggings-test.svg', { type: 'image/svg+xml' })); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
  await until(() => dbtn('Import')); dbtn('Import').click(); await until(() => L.children.length === 6); await ticks(40);
  ed.setTool('pick'); ed.clearSelection(); await ticks();
  ed.listPieces(); // gives every outline its id
  const h0 = hist(); const imported = JSON.stringify(ed.toDocument().objects);
  const SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  // ---------------------------------------------------------------- tags + auto-tag
  ok('before tagging: pieces are listed, none tagged', ed.listPieces().length >= 18 && ed.listPieces().every((p) => !p.size && !p.piece), ed.listPieces().length + ' outlines');
  const sug = ed.suggestPieceTags(); const bySize = (s) => sug.filter((x) => x.size === s).map((x) => x.piece).sort().join(',');
  ok('auto-tag reads the size labels and suggests 4 pieces for each of the 5 closed sizes', SIZES.slice(0, 5).every((s) => bySize(s) === 'Back,Front,Gusset,Waistband'), SIZES.map((s) => `${s}: ${bySize(s)}`).join(' | '));
  ok('…XXXL has an open leg, so only its closed pieces are offered (the open one cannot hold a print)', bySize('XXXL') === 'Gusset,Leg,Waistband');
  ok('…Back is suggested as the mirror of Front', sug.filter((x) => x.piece === 'Back').every((x) => x.mirrorOf === 'Front') && sug.filter((x) => x.piece === 'Front').every((x) => !x.mirrorOf));
  ok('suggesting changes nothing', JSON.stringify(ed.toDocument().objects) === imported && hist() === h0);
  // The panel: open the Pieces tab, Auto-tag…, check the table, apply.
  btn('Pieces').click(); await ticks(30); btn('Auto-tag…').click(); await until(() => document.querySelector('[role=dialog] table'));
  const rowsShown = document.querySelectorAll('[role=dialog] tbody tr').length; const applyBtn = dbtn('Apply');
  ok('the suggestions are shown in a table for confirmation first', rowsShown === sug.length && /Apply \d+ tags/.test(applyBtn.textContent) && hist() === h0, `${rowsShown} rows, "${applyBtn.textContent.trim()}"`);
  // un-tick XXXL's lone "Leg" and rename nothing else
  const legRow = [...document.querySelectorAll('[role=dialog] tbody tr')].find((tr) => tr.querySelector('input[aria-label="Piece name"]').value === 'Leg'); legRow.querySelector('input[type=checkbox]').click(); await ticks(20);
  let h = hist(); dbtn('Apply').click(); await ticks(40);
  const P = () => ed.listPieces(); const piece = (s, n) => P().find((p) => p.size === s && p.piece === n); const item = (s, n) => ed.findById(piece(s, n).id); const pcOf = (s, n) => { const f = item(s, n); return f.parent && isPC(f.parent) ? f.parent : null; };
  ok('Apply tags every ticked row in one undo step; the un-ticked one stays untagged', hist() - h === 1 && P().filter((p) => p.size).length === sug.length - 1 && !!piece('S', 'Front') && !!piece('XXL', 'Gusset') && !piece('XXXL', 'Leg'));
  // custom edit from the panel, then fix XXXL: close its open leg and tag both legs by hand
  ed.applyPieceTags([{ id: piece('S', 'Gusset').id, size: 'S', piece: 'Crotch gusset' }]); await ticks(); const renamed = !!piece('S', 'Crotch gusset'); ed.undo(); await ticks();
  ok('a tag can be edited by hand (custom names allowed)', renamed && !!piece('S', 'Gusset'));
  const open = ed.listOpenPaths().sort((x, y) => y.nodes - x.nodes)[0]; ed.editOpenPath(open); await ticks(); ed.closeWithLine(); await ticks(); ed.setTool('pick'); await ticks();
  const xl3 = L.children[5]; const legs3 = xl3.getItems({ class: ps.Path }).filter((p) => p.closed && !p.dashArray.length && p.bounds.height > 20).sort((a, b) => a.bounds.x - b.bounds.x);
  ed.applyPieceTags([{ id: ed.idOf(legs3[0]), size: 'XXXL', piece: 'Front' }, { id: ed.idOf(legs3[1]), size: 'XXXL', piece: 'Back', mirrorOf: 'Front' }]); await ticks();
  ok('after closing the XXXL outline, all 6 sizes have Front, Back, Waistband, Gusset', SIZES.every((s) => ['Front', 'Back', 'Waistband', 'Gusset'].every((n) => !!piece(s, n))) && P().filter((p) => p.size).length === 24);
  const dA = JSON.stringify(ed.toDocument()); ok('tags are saved in the file', /"tag":\{"size":"S","piece":"Front"\}/.test(dA) && /"mirrorOf":"Front"/.test(dA));

  // ---------------------------------------------------------------- a repeat print in S-Front
  const tileImg = await loadImg('/repeat-tile.png', 'repeat-tile.png', 200);
  const sFront = item('S', 'Front'); ed.select([L.children[0]]); ed.fitSelection(); await ticks();
  await ed.placeRaster(tileImg.asset, tileImg.img, sFront.bounds.center.add([1.3, -2.1])); await ticks();
  ed.beginPlaceInside(); click(V(sFront.getPointAt(sFront.length * 0.4))); await ticks();
  ed.editClip(pcOf('S', 'Front')); await ticks(); ed.setClipRepeat(true); await ticks(); ed.setClipRepeat({ type: 'half-drop', tileW: 1.5, tileH: 1.5, offsetX: 0.2 }); await ticks(); ed.finishClipEdit(); await ticks();
  const master = () => pcOf('S', 'Front'); const rel = (pc) => { const c = contents(pc)[0].bounds.center, f = frame(pc).bounds.center; return [c.x - f.x, c.y - f.y]; };
  ok('S-Front has a half-drop repeat print', !!master() && master().data.pc.repeat.type === 'half-drop' && st().clip && st().clip.label === 'S-Front');

  // ---------------------------------------------------------------- preview, then apply to all sizes (keep print size)
  ed.selectPiece(piece('S', 'Front').id); await ticks(30);
  const plan = ed.planApplySizes({ mode: 'keep', anchor: 'center', link: false, pairs: false });
  ok('preview summary names the 5 target pieces before anything changes', plan.ok && plan.labels.join(',') === 'M-Front,L-Front,XL-Front,XXL-Front,XXXL-Front' && /Will update 5 pieces: M-Front, L-Front, XL-Front, XXL-Front, XXXL-Front/.test(plan.message), plan.message);
  ed.showApplyPreview({ mode: 'keep', anchor: 'center', link: false, pairs: false }); await ticks(); ed.fitPage(); await ticks(); ed.drawOverlay();
  const nctx = ed.nodeCanvas.getContext('2d'); const hl = (f) => { const v = V(f.bounds.center); return nctx.getImageData(Math.round(v.x * dpr), Math.round(v.y * dpr), 1, 1).data; };
  const tinted = (d) => d[3] > 0 && d[2] > d[0]; ok('preview highlights all target pieces on the page (and not the master)', ['M', 'L', 'XL', 'XXL', 'XXXL'].every((s) => tinted(hl(item(s, 'Front')))) && !tinted(hl(item('S', 'Back'))) && hl(item('S', 'Waistband'))[3] === 0, JSON.stringify([...hl(item('M', 'Front'))]) + ' back ' + JSON.stringify([...hl(item('S', 'Back'))]) + ' band ' + JSON.stringify([...hl(item('S', 'Waistband'))]));
  const panelText = [...document.querySelectorAll('[role=status]')].map((e) => e.textContent).join(' '); ok('the Pieces panel shows the same summary', /Will update/.test(panelText), panelText.slice(0, 90));
  h = hist(); const before = JSON.stringify(ed.toDocument().objects); const res = ed.applyToSizes({ mode: 'keep', anchor: 'center', link: false, pairs: false }); await ticks(30);
  ok('Apply: 5 pieces updated in ONE undo step', res.ok && hist() - h === 1 && ['M', 'L', 'XL', 'XXL', 'XXXL'].every((s) => !!pcOf(s, 'Front')), res.message);
  const mRel = rel(master()); const mR = master().data.pc.repeat;
  ok('keep print size: the same tile size and scale in every size; print sits the same way about the piece centre', ['M', 'L', 'XL', 'XXL', 'XXXL'].every((s) => { const pc = pcOf(s, 'Front'); const r = pc.data.pc.repeat; const q = rel(pc); return r.tileW === mR.tileW && r.scale === mR.scale && r.type === 'half-drop' && near(r.offsetX, mR.offsetX) && near(q[0], mRel[0], 1e-9) && near(q[1], mRel[1], 1e-9) && near(contents(pc)[0].bounds.width, contents(master())[0].bounds.width, 1e-9); }), `tile ${mR.tileW} in, scale ${mR.scale}% in all six`);
  ed.select([L.children[1]]); ed.fitSelection(); await ticks(); const cM = covered(pcOf('M', 'Front')); ed.select([L.children[5]]); ed.fitSelection(); await ticks(); const cX = covered(pcOf('XXXL', 'Front'));
  ok('M and XXXL are filled edge to edge (checked on the pixels)', cM.white === 0 && cM.inside > 150 && cX.white === 0 && cX.inside > 150, `M ${cM.inside} points, XXXL ${cX.inside} points, 0 white`);
  ok('the larger piece simply shows more tiles of the same size', tiles(pcOf('XXXL', 'Front')).length > 0 && Math.abs(tiles(pcOf('XXXL', 'Front'))[0].matrix.a) > 0);
  ed.undo(); await ticks(); ok('one undo removes the print from all 5 pieces', JSON.stringify(ed.toDocument().objects) === before && !pcOf('XXXL', 'Front')); ed.redo(); await ticks();

  // ---------------------------------------------------------------- mirror pairs
  ed.selectPiece(piece('S', 'Front').id); await ticks(); h = hist(); const mr = ed.mirrorPrint(); await ticks(30); const sBack = pcOf('S', 'Back');
  const fC = frame(master()).bounds.center, bC = frame(sBack).bounds.center;
  ok('Mirror print: S-Back gets the print flipped left-right about the piece centre', mr.ok && !!sBack && near(contents(sBack)[0].bounds.center.x - bC.x, -(contents(master())[0].bounds.center.x - fC.x), 1e-9) && near(contents(sBack)[0].bounds.center.y - bC.y, contents(master())[0].bounds.center.y - fC.y, 1e-9) && contents(sBack)[0].matrix.a < 0 && near(sBack.data.pc.repeat.offsetX, -mR.offsetX) && hist() - h === 1, mr.message);
  h = hist(); const r2 = ed.applyToSizes({ mode: 'keep', anchor: 'center', link: false, pairs: true }); await ticks(30);
  ok('Apply to all sizes + mirror pairs: every Back in every size gets the mirrored print, one step', r2.ok && hist() - h === 1 && SIZES.every((s) => { const b = pcOf(s, 'Back'); return b && contents(b)[0].matrix.a < 0 && near(contents(b)[0].bounds.center.x - frame(b).bounds.center.x, -(contents(pcOf(s, 'Front'))[0].bounds.center.x - frame(pcOf(s, 'Front')).bounds.center.x), 1e-9); }), r2.message);

  // ---------------------------------------------------------------- scale with piece + anchors (a placement print on the waistband)
  const floral = await loadImg('/floral-print.png', 'floral-print.png', 400); // 1600 px = 4 in
  const sBand = item('S', 'Waistband'); ed.select([L.children[0]]); ed.fitSelection(); await ticks();
  await ed.placeRaster(floral.asset, floral.img, new ps.Point(sBand.bounds.center.x, sBand.bounds.top + 1)); await ticks(); ed.beginPlaceInside(); click(V(sBand.bounds.center)); await ticks();
  ed.selectPiece(piece('S', 'Waistband').id); await ticks(); const rs = ed.applyToSizes({ mode: 'scale', anchor: 'top', link: false, pairs: false }); await ticks(30);
  const wS = pcOf('S', 'Waistband'), wX = pcOf('XXXL', 'Waistband'); const exp = Math.sqrt((frame(wX).bounds.width * frame(wX).bounds.height) / (frame(wS).bounds.width * frame(wS).bounds.height));
  ok('scale with piece: the placement print grows by the same factor as the piece, never distorted', rs.ok && near(contents(wX)[0].bounds.width / contents(wS)[0].bounds.width, exp, 1e-9) && near(contents(wX)[0].bounds.width, contents(wX)[0].bounds.height, 1e-9), `XXXL print ${(exp * 100).toFixed(1)}% of S`);
  ok('…lined up at top-centre: same distance below the waist edge, scaled, and still centred', near(contents(wX)[0].bounds.center.x, frame(wX).bounds.center.x, 1e-9) && near((contents(wX)[0].bounds.center.y - frame(wX).bounds.top) / (contents(wS)[0].bounds.center.y - frame(wS).bounds.top), exp, 1e-9));
  // reference point
  ed.selectPiece(piece('S', 'Gusset').id); await ticks(); const gS = item('S', 'Gusset'); ed.fitRect(gS.bounds.expand(2)); await ticks(); ed.beginSetRefPoint(); click(V(gS.bounds.center.add([0.9, 0.2]))); await ticks();
  ok('a reference point can be placed on a piece by clicking', !!piece('S', 'Gusset').hasRef && near(gS.data.tag.ref.dx, gS.bounds.width / 2 + 0.9, 0.1) && near(gS.data.tag.ref.dy, gS.bounds.height / 2 + 0.2, 0.1) && /Reference point set on S-Gusset/.test((notices.at(-1) || {}).message || ''));

  // ---------------------------------------------------------------- link sizes
  ed.selectPiece(piece('S', 'Front').id); await ticks(); const rl = ed.applyToSizes({ mode: 'keep', anchor: 'center', link: true, pairs: true }); await ticks(30);
  ok('Link sizes: copies remember their master', rl.ok && pcOf('L', 'Front').data.pc.link && piece('L', 'Front').linkedTo === 'S-Front' && piece('L', 'Back').linkedTo === 'L-Front' && !piece('L', 'Front').differs);
  h = hist(); ed.editClip(master()); await ticks(); ed.setClipRepeat({ tileW: 1, tileH: 1, type: 'mirror' }); await ticks(30); ed.finishClipEdit(); await ticks();
  ok('editing the master updates every linked piece in the same undo step — including the mirrored Backs', hist() - h === 1 && SIZES.every((s) => pcOf(s, 'Front').data.pc.repeat.tileW === 1 && pcOf(s, 'Front').data.pc.repeat.type === 'mirror' && pcOf(s, 'Back').data.pc.repeat.tileW === 1));
  ed.undo(); await ticks(); ok('…and one undo takes them all back', SIZES.every((s) => pcOf(s, 'Front').data.pc.repeat.tileW === 1.5 && pcOf(s, 'Back').data.pc.repeat.tileW === 1.5)); ed.redo(); await ticks();
  // change a linked piece by hand → flagged; re-sync; unlink
  ed.selectPiece(piece('XL', 'Front').id); await ticks(); ed.editClip(pcOf('XL', 'Front')); await ticks(); ed.setClipRepeat({ offsetX: 0.9 }); await ticks(); ed.finishClipEdit(); await ticks();
  ok('a linked piece edited by hand is flagged as differing from its master', piece('XL', 'Front').differs && st().clip.linkDiffers && !piece('L', 'Front').differs);
  const rsn = ed.resyncLink(); await ticks(); ok('Re-sync puts it back in step', rsn.ok && !piece('XL', 'Front').differs && near(pcOf('XL', 'Front').data.pc.repeat.offsetX, pcOf('S', 'Front').data.pc.repeat.offsetX));
  ed.unlinkClip(); await ticks(); ed.editClip(master()); await ticks(); ed.setClipRepeat({ rotation: 10 }); await ticks(30); ed.finishClipEdit(); await ticks();
  ok('Unlink: that piece no longer follows the master; the others still do', !pcOf('XL', 'Front').data.pc.link && pcOf('XL', 'Front').data.pc.repeat.rotation === 0 && pcOf('L', 'Front').data.pc.repeat.rotation === 10 && near(pcOf('L', 'Back').data.pc.repeat.rotation, -10));

  // ---------------------------------------------------------------- undo all, redo all, save / reload
  { const end = JSON.stringify(ed.toDocument().objects); const idx = hist(); while (hist() > h0) ed.undo(); await ticks(); const noIds = (t) => t.replace(/"id":"[^"]+",?/g, ''); const back = noIds(JSON.stringify(ed.toDocument().objects)) === noIds(imported); while (hist() < idx) ed.redo(); await ticks();
    ok('undo all = the imported file; redo all = the same result', back && JSON.stringify(ed.toDocument().objects) === end, `back ${back}, forward ${JSON.stringify(ed.toDocument().objects) === end}, ${idx - h0} steps`); }
  const d1 = JSON.stringify(ed.toDocument()); await ed.loadDocument(JSON.parse(d1)); await ticks(30);
  ok('save → reload identical (tags, links, mirrored repeats)', JSON.stringify(ed.toDocument()) === d1 && ed.listPieces().filter((p) => p.linkedTo).length >= 9, `${(JSON.stringify(JSON.parse(d1).objects).length / 1024).toFixed(0)} KB of objects for ${ed.listPieces().filter((p) => p.hasPrint).length} printed pieces`);
  } catch (e) { R.push('FAIL 3D test stopped — ' + e.message + ' @ ' + ((e.stack || '').split('\n')[1] || '').trim()); }
  ed.onNotice = origNotice;
  return { passed: R.filter((x) => x.startsWith('PASS')).length, total: R.length, failed: R.filter((x) => x.startsWith('FAIL')), all: R };
}
