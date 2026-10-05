// Browser test for PowerClip basics (Phase 3A): place inside frame, edit contents, lock, extract, cut lines, undo, save.
// Run like browser-regression.mjs (see ../README.md); it also needs fixtures/floral-print.png in public/.
const tick = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
const ticks = async (n = 12) => { for (let i = 0; i < n; i++) await tick(); };
const until = async (fn, max = 8000) => { const t0 = performance.now(); while (performance.now() - t0 < max) { if (fn()) return true; await ticks(10); } return false; };
window.requestAnimationFrame = (cb) => { tick().then(() => cb(performance.now())); return 0; };

export default async function run() {
  const ed = window.__pps, ps = ed.ps, L = ed.contentLayer, cv = ed.canvas;
  cv.setPointerCapture = () => {};
  // Written before bleed (3E): these checks look at the print clipped exactly at the cut line, so bleed is off here.
  ed.updateSettings({ bleed: { amount: 0, visible: true } }); ed.emitScheduled = false;
  const black = (v) => v.startsWith('0,0,0,') && v !== '0,0,0,0'; const R = []; window.__partial = R; const ok = (name, pass, info) => R.push(`${pass ? 'PASS' : 'FAIL'} 3A ${name}${info !== undefined ? ' — ' + info : ''}`);
  const ev = (type, pt, o = {}) => { const r = cv.getBoundingClientRect(); cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: r.left + pt.x, clientY: r.top + pt.y, button: 0, pointerId: 1, ...o })); };
  const click = (pt, o) => { ev('pointerdown', pt, o); ev('pointerup', pt, o); };
  const drag = (a, b, o) => { ev('pointerdown', a, o); for (let i = 1; i <= 5; i++) ev('pointermove', { x: a.x + (b.x - a.x) * i / 5, y: a.y + (b.y - a.y) * i / 5 }, o); ev('pointerup', b, o); };
  const dbl = (pt) => { const r = cv.getBoundingClientRect(); click(pt); click(pt); cv.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: r.left + pt.x, clientY: r.top + pt.y, button: 0 })); };
  const V = (p) => ps.view.projectToView(p);
  const key = (k, o = {}) => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o })); window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true, ...o })); };
  const st = () => ed.getState(); const hist = () => ed.history.index; const doc = () => JSON.stringify(ed.toDocument().objects);
  const dbtn = (t) => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim() === t);
  const notices = []; const origNotice = ed.onNotice; ed.onNotice = (r) => { notices.push(r); };
  const isPC = (it) => !!(it && it.data && it.data.pc);
  const clipG = (pc) => pc.children.find((c) => c.data.pcClip); const frame = (pc) => pc.children.find((c) => !c.data.pcClip && !c.data.derived); const contents = (pc) => clipG(pc).children.filter((c) => !c.data.derived);
  const loadImg = async (url, name, dpi) => { const blob = await (await fetch(url)).blob(); const dataUrl = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); }); const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; }); return { asset: { id: 'a' + Math.random().toString(36).slice(2), name, mime: 'image/png', dataUrl, pxWidth: img.naturalWidth, pxHeight: img.naturalHeight, dpi }, img }; };

  // import the leggings file
  const txt = await (await fetch('/leggings-test.svg')).text();
  const inp = [...document.querySelectorAll('input[type=file]')].find((i) => i.accept.includes('.svg'));
  const dt = new DataTransfer(); dt.items.add(new File([txt], 'leggings-test.svg', { type: 'image/svg+xml' })); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
  await until(() => dbtn('Import')); dbtn('Import').click(); await until(() => L.children.length === 6); await ticks(40);
  ed.setTool('pick'); ed.clearSelection(); await ticks();
  const g = () => L.children[0]; const leg0 = g().children[0]; const legId = leg0.data.id; const legGeom = JSON.stringify(leg0.segments.map((s) => [s.point.x, s.point.y]));
  const imported = doc(); const h0 = hist();

  // a floral PNG over the S front piece
  const floral = await loadImg('/floral-print.png', 'floral-print.png', 100); // 1600 px at 100 dpi = 16 in
  await ed.placeRaster(floral.asset, floral.img, leg0.bounds.center.add([1.5, 1])); await ticks();
  const print = ed.selected[0]; const m0 = print.matrix.values.join(','); const printId = print.data.id;
  ed.select([g()]); ed.fitSelection(); await ticks(); ed.select([print]); await ticks();

  // --- place inside frame: menu route, click INSIDE the piece (not on the line)
  const r1 = ed.beginPlaceInside(); await ticks(); const inside = leg0.bounds.center.add([2.2, -6]);
  ev('pointermove', V(inside)); await ticks(); const hoverIsLeg = ed.frameHover === leg0;
  click(V(inside)); await ticks();
  const pc = () => g().children.find(isPC); const P = pc();
  ok('Place inside frame: click inside the piece picks the cut outline (not the dashed stitch line)', r1.ok && st().placing === false && !!P && frame(P) === leg0 && hoverIsLeg, notices.at(-1) && notices.at(-1).message);
  ok('the print keeps its exact position and size (no jump)', contents(P)[0].matrix.values.join(',') === m0 && contents(P)[0].data.id === printId);
  ok('outline is untouched and stays the same object', JSON.stringify(frame(P).segments.map((s) => [s.point.x, s.point.y])) === legGeom && frame(P).data.id === legId);
  ok('one undo step', hist() - h0 === 2, 'import print + place');
  ok('clip hides the print outside the outline', clipG(P).clipped === true && clipG(P).children[0].clipMask === true && clipG(P).children[0].data.derived === true);
  // the print is only visible inside: sample the Paper canvas
  ps.view.update(); const mctx = cv.getContext('2d'); const dpr = devicePixelRatio; const px = (p) => { const v = V(p); return [...mctx.getImageData(Math.round(v.x * dpr), Math.round(v.y * dpr), 1, 1).data].slice(0, 3).join(','); };
  const insidePx = px(leg0.bounds.center.add([2.2, -6])); const outsidePx = px(new ps.Point(leg0.bounds.right + 0.15, leg0.bounds.center.y - 6));
  ok('pixels: print shows inside the frame, page white just outside', insidePx !== '255,255,255' && outsidePx === '255,255,255', `inside ${insidePx} · outside ${outsidePx}`);
  ok('active PowerClip + mini toolbar state', st().clip && st().clip.count === 1 && st().clip.lock === true && !st().clip.editing && !!document.querySelector('[role=toolbar][aria-label=PowerClip]'));
  const rows = st().objects; const gi = rows.findIndex((r) => r.depth === 0 && /Size_S/.test(r.name));
  ok('Objects panel: frame row with its contents as a child', rows[gi + 1] && rows[gi + 1].role === 'clip' && rows[gi + 1].depth === 1 && rows[gi + 2].role === 'content' && rows[gi + 2].depth === 2, rows.slice(gi, gi + 3).map((r) => `${'·'.repeat(r.depth)}${r.role}:${r.name}`).join(' | '));

  // --- cut line overlay
  const nctx = ed.nodeCanvas.getContext('2d'); ed.drawOverlay(); const opx = (p) => { const v = V(p); return [...nctx.getImageData(Math.round(v.x * dpr), Math.round(v.y * dpr), 1, 1).data].join(','); };
  const hem = () => frame(pc()).segments[4].point.add(frame(pc()).segments[5].point).divide(2);
  const on = opx(hem()); key('l', { altKey: true, code: 'KeyL' }); await ticks(); ed.drawOverlay(); const off = opx(hem()); const hidden = st().settings.cutLines.visible === false; key('l', { altKey: true, code: 'KeyL' }); await ticks();
  ok('cut line drawn on top (0.5 pt black); Alt+L hides / shows it', black(on) && off === '0,0,0,0' && hidden && st().settings.cutLines.visible === true, `on ${on} · off ${off}`);
  ed.updateSettings({ cutLines: { visible: true, color: '#ff0000', width: 2 / 72 } }); await ticks(); ed.drawOverlay(); const red = opx(hem()); ed.updateSettings({ cutLines: { visible: true, color: '#000000', width: 0.5 / 72 } }); await ticks();
  ok('cut line colour / width settings', red.startsWith('255,0,0'), red);

  // --- edit contents
  let h = hist(); dbl(V(leg0.bounds.center.add([2.2, -6]))); await ticks();
  ok('double-click the frame → edit contents (whole print visible, veil outside)', st().clip.editing && clipG(pc()).clipped === false && pc().children.some((c) => c.data.pcVeil) && ed.selected[0] === contents(pc())[0] && hist() === h);
  const c0 = contents(pc())[0].position.clone(); const a = V(c0); drag(a, { x: a.x + 30, y: a.y + 20 }); await ticks();
  ok('drag the print inside = one undo step; frame does not move', hist() - h === 1 && Math.abs((contents(pc())[0].position.x - c0.x) * ps.view.zoom - 30) < 0.5 && JSON.stringify(frame(pc()).segments.map((s) => [s.point.x, s.point.y])) === legGeom);
  key('ArrowRight'); await ticks(); ok('arrow keys nudge the print while editing', hist() - h === 2);
  ed.undo(); await ticks(); ok('undo inside edit mode stays in edit mode', st().clip && st().clip.editing && pc().children.some((c) => c.data.pcVeil));
  key('Escape'); await ticks(); ok('Esc finishes editing; frame clips again; frame group selected', !st().clip.editing && clipG(pc()).clipped && !pc().children.some((c) => c.data.pcVeil) && ed.selected[0] === g() && st().tool === 'pick');
  const moved = contents(pc())[0].matrix.values.join(',');
  // finish by clicking outside
  ed.editClip(); await ticks(); click(V(new ps.Point(leg0.bounds.left - 1.2, leg0.bounds.top + 0.3))); await ticks(); ok('click outside finishes editing', !st().clip || !st().clip.editing);
  // Ctrl+click
  ed.select([g()]); await ticks(); click(V(leg0.bounds.center.add([2.2, -4])), { ctrlKey: true }); await ticks(); const ctrlEdit = st().clip && st().clip.editing; ed.finishClipEdit(); await ticks();
  ok('Ctrl+click the frame → edit contents', ctrlEdit);

  // --- move the piece: the print follows
  h = hist(); const before = contents(pc())[0].position.clone(); const fb = frame(pc()).bounds.clone(); ed.select([g()]); await ticks(); ed.translateSelection(3, 1.5); await ticks();
  ok('move the piece: the print follows exactly', Math.abs(contents(pc())[0].position.x - before.x - 3) < 1e-9 && Math.abs(frame(pc()).bounds.x - fb.x - 3) < 1e-9 && Math.abs(clipG(pc()).children[0].bounds.x - fb.x - 3) < 1e-9);
  ed.undo(); await ticks();

  // --- Shape tool: clip + cut line follow node edits live
  ed.setTool('shape'); await ticks(); const f = frame(pc()); click(V(f.segments[4].point.add(f.segments[5].point).divide(2))); await ticks();
  ok('Shape tool picks the frame outline, not the mask or the print', ed.shape.target === f && ed.getState().nodeEdit.total === 8);
  click(V(f.segments[4].point)); await ticks(); ed.nudgeNodes(0, -1); await ticks(); const f2 = frame(pc()); const mask = clipG(pc()).children[0]; ed.drawOverlay();
  const newHem = f2.segments[4].point.add(f2.segments[5].point).divide(2);
  ok('node edit: clip follows the outline', Math.abs(mask.segments[4].point.y - f2.segments[4].point.y) < 1e-12 && mask.segments.length === f2.segments.length);
  ok('node edit: cut line follows the outline', black(opx(newHem)), opx(newHem));
  ed.undo(); await ticks(); ed.setTool('pick'); await ticks();

  // --- undo everything back to the imported file, then redo everything
  { const end = doc(); const endIdx = hist(); while (hist() > h0) ed.undo(); await ticks(); const back = doc() === imported; while (hist() < endIdx) ed.redo(); await ticks();
    ok('undo all steps = the imported file; redo all = the same result', back && doc() === end, `${endIdx - h0} steps`); }

  // --- save / reload
  const d1 = JSON.stringify(ed.toDocument()); await ed.loadDocument(JSON.parse(d1)); await ticks(30); const d2 = JSON.stringify(ed.toDocument());
  ok('save → reload identical; mask not saved; format version 2', d1 === d2 && JSON.parse(d1).version === 2 && !/pcMask|derived/.test(d1) && /"t":"powerclip"/.test(d1), `${(d1.length / 1024).toFixed(0)} KB incl. the image`);
  ok('reloaded PowerClip clips again', !!pc() && clipG(pc()).clipped && contents(pc())[0].matrix.values.join(',') === moved);
  const svgNode = JSON.parse(d1).objects[0].children.find((c) => c.t === 'powerclip'); ok('saved node holds frame + contents + settings only', svgNode && svgNode.frame.t === 'path' && svgNode.contents.length === 1 && svgNode.contents[0].t === 'raster' && svgNode.pc.lock === true);

  // --- extract, then place again with a right-mouse drag
  ed.select([g()]); ed.activeClip = pc(); await ticks(); h = hist(); const ex = ed.extractClip(); await ticks(); const gk = g().children; const raster = g().getItem({ class: ps.Raster });
  ok('Extract: the print comes back out in the same place; outline back in its group', ex.ok && !pc() && raster && raster.matrix.values.join(',') === moved && gk.some((c) => c.data.id === legId) && hist() - h === 1);
  ed.undo(); await ticks(); ok('undo Extract restores the PowerClip', !!pc());
  ed.redo(); await ticks();
  // right-drag needs a page-level print: pull it out of the group first
  const rs = g().getItem({ class: ps.Raster }); L.addChild(rs); ed.commit(); await ticks(); ed.select([rs]); await ticks();
  const legNow = g().children.find((c) => c.data.id === legId); const from = V(rs.position), to = V(legNow.bounds.center.add([2.2, -6]));
  ev('pointerdown', from, { button: 2 }); for (let i = 1; i <= 5; i++) ev('pointermove', { x: from.x + (to.x - from.x) * i / 5, y: from.y + (to.y - from.y) * i / 5 }, { button: 2, buttons: 2 }); ev('pointerup', to, { button: 2 }); await ticks();
  const menu = [...document.querySelectorAll('[role=menu] [role=menuitem]')].map((b) => b.textContent.trim());
  ok('right-mouse drag onto an outline → "PowerClip inside" menu', !!st().clipMenu && menu.includes('PowerClip inside'), menu.join(' / '));
  [...document.querySelectorAll('[role=menu] [role=menuitem]')].find((b) => b.textContent.trim() === 'PowerClip inside').click(); await ticks();
  ok('choose it → placed inside again, print did not move', !!pc() && contents(pc())[0].matrix.values.join(',') === moved && !st().clipMenu);

  // --- lock contents (page-level frame)
  const rect = new ps.Path.Rectangle({ rectangle: new ps.Rectangle(100, 32, 6, 4), insert: false }); rect.strokeColor = new ps.Color('#000'); rect.strokeWidth = 0.01; rect.data.id = 'frameRect'; L.addChild(rect);
  const dot = new ps.Path.Circle({ center: [103, 34], radius: 3, insert: false }); dot.fillColor = new ps.Color('#e63946'); dot.data.id = 'dot'; L.addChild(dot); ed.commit(); await ticks();
  ed.select([dot]); ed.beginPlaceInside(); click(V(new ps.Point(100.4, 32.4))); await ticks(); const top = L.children.find((c) => isPC(c) && c.data.id !== undefined && frame(c).data.id === 'frameRect');
  ok('a vector print in a page-level frame; frame chosen by clicking its line/inside', !!top && contents(top)[0].data.id === 'dot' && ed.selected[0] === top);
  const dp = contents(top)[0].position.clone(); ed.translateSelection(2, 0); await ticks(); const followed = Math.abs(contents(top)[0].position.x - dp.x - 2) < 1e-9; ed.undo(); await ticks();
  const top2 = () => L.children.find((c) => isPC(c) && frame(c).data.id === 'frameRect'); ed.select([top2()]); await ticks(); ed.setClipLock(false); await ticks(); const fx = frame(top2()).bounds.x; ed.translateSelection(2, 0); await ticks();
  ok('Lock ON: print moves with the frame. Lock OFF: frame moves, print stays', followed && Math.abs(frame(top2()).bounds.x - fx - 2) < 1e-9 && Math.abs(contents(top2())[0].position.x - dp.x) < 1e-9 && Math.abs(clipG(top2()).children[0].bounds.x - fx - 2) < 1e-9);
  ed.setClipLock(true); await ticks(); ed.rotateSelection(20); await ticks(); ed.undo(); await ticks();
  const exd = ed.extractClip(); await ticks(); ok('Extract a page-level PowerClip: print selected, frame restored', exd.ok && L.children.some((c) => c.data.id === 'frameRect') && ed.selected[0] && ed.selected[0].data.id === 'dot');

  // --- open outline cannot be a frame
  const xl = L.children[5]; const openLeg = xl.getItems({ class: ps.Path }).filter((p) => !p.closed).sort((x, y) => y.segments.length - x.segments.length)[0];
  ed.select([L.children.find((c) => c.data.id === 'dot')]); ed.beginPlaceInside(); click(V(openLeg.getPointAt(openLeg.length * 0.3))); await ticks(); const n = notices.at(-1); const kids = L.children.length;
  ok('open outline: "Close this outline first" + Check outlines action; nothing changes', n && !n.ok && /Close this outline first/.test(n.message) && n.action === 'check-outlines' && L.children.length === kids, n && n.message);
  ed.fixOpenOutline(); await ticks(); ok('…the action opens that outline in the Shape tool with its ends selected', st().tool === 'shape' && st().nodeEdit && st().nodeEdit.open && st().nodeEdit.selected === 2);
  ed.setTool('pick'); await ticks();

  ed.onNotice = origNotice;
  return { passed: R.filter((r) => r.startsWith('PASS')).length, total: R.length, failed: R.filter((r) => r.startsWith('FAIL')), all: R };
}
