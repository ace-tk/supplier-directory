// Browser regression for Pattern Print Studio: the Phase 1 checks plus every Phase 2 (2A–2E) test and a
// drag-speed measurement, in one run on the leggings test file. It drives the real editor with pointer
// and keyboard events. How to run it is in ../README.md ("Testing").
const tick = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
const ticks = async (n = 12) => { for (let i = 0; i < n; i++) await tick(); };
const until = async (fn, max = 8000) => { const t0 = performance.now(); while (performance.now() - t0 < max) { if (fn()) return true; await ticks(10); } return false; };
window.requestAnimationFrame = (cb) => { tick().then(() => cb(performance.now())); return 0; };

export default async function run() {
  const ed = window.__pps, ps = ed.ps, L = ed.contentLayer, cv = ed.canvas;
  cv.setPointerCapture = () => {};
  const R = []; const ok = (phase, name, pass, info) => R.push({ phase, name, pass: !!pass, info: info === undefined ? '' : String(info) });
  const ev = (type, pt, o = {}) => { const r = cv.getBoundingClientRect(); cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: r.left + pt.x, clientY: r.top + pt.y, button: 0, pointerId: 1, ...o })); };
  const click = (pt, o) => { ev('pointerdown', pt, o); ev('pointerup', pt, o); };
  const drag = (a, b, o) => { ev('pointerdown', a, o); for (let i = 1; i <= 5; i++) ev('pointermove', { x: a.x + (b.x - a.x) * i / 5, y: a.y + (b.y - a.y) * i / 5 }, o); ev('pointerup', b, o); };
  const dbl = (pt) => { const r = cv.getBoundingClientRect(); click(pt); click(pt); cv.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: r.left + pt.x, clientY: r.top + pt.y, button: 0 })); };
  const V = (p) => ps.view.projectToView(p);
  const key = (k, o = {}) => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o })); window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true, ...o })); };
  const st = () => ed.getState(); const S = () => st().nodeEdit; const hist = () => ed.history.index;
  const doc = () => JSON.stringify(ed.toDocument().objects);
  const dev = (a, b, n = 300) => { let m = 0; for (let i = 0; i <= n; i++) { const p = b.getPointAt(b.length * i / n); m = Math.max(m, a.getNearestPoint(p).getDistance(p)); const q = a.getPointAt(a.length * i / n); m = Math.max(m, b.getNearestPoint(q).getDistance(q)); } return m; };
  const snapSegs = (p) => JSON.stringify(p.segments.map((s) => [s.point.x, s.point.y, s.handleIn.x, s.handleIn.y, s.handleOut.x, s.handleOut.y]));
  const dlg = () => document.querySelector('[role=dialog]');
  const dbtn = (t) => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim() === t);

  // ------------------------------------------------------------ import
  const txt = await (await fetch('/leggings-test.svg')).text();
  const inp = [...document.querySelectorAll('input[type=file]')].find((i) => i.accept.includes('.svg'));
  const dt = new DataTransfer(); dt.items.add(new File([txt], 'leggings-test.svg', { type: 'image/svg+xml' })); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
  await until(() => dbtn('Import')); dbtn('Import').click(); await until(() => L.children.length === 6);
  await ticks(40);
  const imported = doc();
  const totalNodes = () => L.getItems({ class: ps.Path }).reduce((n, p) => n + p.segments.length, 0);
  ok('P1', 'import SVG at real size (6 size groups)', L.children.length === 6 && Math.abs(st().page.width - 163.75) < 1e-9, `${L.children.length} objects, ${totalNodes()} nodes`);
  const g = () => L.children[0]; const leg = () => g().children[0];

  // ------------------------------------------------------------ PHASE 1
  ed.emitScheduled = false; ed.setTool('pick'); ed.clearSelection(); ed.fitPage(); await ticks();
  ok('P1', 'fit page / zoom', st().zoomPct > 1 && st().zoomPct < 100, st().zoomPct.toFixed(1) + '%');
  const g2 = L.children[1]; const hemMid = (p) => p.segments[4].point.add(p.segments[5].point).divide(2);
  click(V(hemMid(g2.children[0]))); await ticks();
  ok('P1', 'pick tool selects the whole group', st().selectionCount === 1 && ed.selected[0] === g2);
  let h = hist(); const b0 = g2.bounds.clone(); const a0 = V(hemMid(g2.children[0])); drag(a0, { x: a0.x + 30, y: a0.y + 15 }); await ticks();
  ok('P1', 'drag move = one undo step', hist() - h === 1 && g2.bounds.x !== b0.x);
  ed.undo(); await ticks(); ok('P1', 'undo restores position exactly', L.children[1].bounds.x === b0.x);
  ed.select([L.children[1]]); await ticks(); key('ArrowRight'); await ticks(); ok('P1', 'arrow nudge 0.01 in', Math.abs(L.children[1].bounds.x - b0.x - 0.01) < 1e-9);
  key('ArrowUp', { shiftKey: true }); await ticks(); ok('P1', 'Shift+arrow nudge ×10', Math.abs(b0.y - L.children[1].bounds.y - 0.1) < 1e-9);
  let k0 = L.children.length; key('d', { ctrlKey: true }); await ticks(); ok('P1', 'duplicate (Ctrl+D)', L.children.length === k0 + 1);
  key('Delete'); await ticks(); ok('P1', 'delete', L.children.length === k0);
  ed.select([L.children[2], L.children[3]]); await ticks(); key('g', { ctrlKey: true }); await ticks(); const grouped = L.children.length; key('u', { ctrlKey: true }); await ticks();
  ok('P1', 'group / ungroup', grouped === k0 - 1 && L.children.length === k0);
  ed.select([L.children[4]]); await ticks(); ed.setSelectionGeometry({ x: 100 }); await ticks(); const sb = st().selectionBounds;
  ok('P1', 'exact X from the property bar', Math.abs(sb.x + sb.w / 2 - st().origin.x - 100) < 1e-9);
  const wb = L.children[4].bounds.clone(); ed.flip('h'); await ticks(); ed.rotateSelection(30); await ticks(); ed.undo(); ed.undo(); await ticks();
  ok('P1', 'mirror + rotate, then undo', Math.abs(L.children[4].bounds.width - wb.width) < 1e-9);
  key("'", { ctrlKey: true }); await ticks(); const gridOn = st().settings.grid.visible; key("'", { ctrlKey: true }); await ticks(); ok('P1', "grid toggle (Ctrl+')", gridOn && !st().settings.grid.visible);
  k0 = L.children.length; ed.setTool('rectangle'); drag({ x: 300, y: 620 }, { x: 360, y: 660 }); await ticks(); ed.setTool('ellipse'); drag({ x: 400, y: 620 }, { x: 460, y: 660 }); await ticks();
  ok('P1', 'rectangle + ellipse tools', L.children.length === k0 + 2);
  ed.addText('XL', new ps.Point(60, 36.5), 1.5); await ticks(); ok('P1', 'text tool', !!st().selectedText && L.children.length === k0 + 3);
  const d1 = JSON.stringify(ed.toDocument()); await ed.loadDocument(JSON.parse(d1)); await ticks(30);
  ok('P1', 'save → reload identical', JSON.stringify(ed.toDocument()) === d1);
  // back to a clean import for Phase 2
  await ed.loadDocument(JSON.parse(d1.replace(/"objects":\[.*?\],"assets"/s, `"objects":${imported},"assets"`))); await ticks(30);
  ok('P1', 'document reset for Phase 2', doc() === imported);

  // ------------------------------------------------------------ 2A
  ed.setTool('pick'); ed.select([g()]); ed.fitSelection(); await ticks(); key('F10'); await ticks();
  ok('2A', 'F10 opens the Shape tool', st().tool === 'shape');
  ok('2A', 'group shows a hint until a curve is clicked', /Click a curve/.test(S().hint || ''));
  click(V(hemMid(leg()))); await ticks(); ok('2A', 'click a curve inside a group → its nodes', S().hasTarget && S().total === 8, S().total + ' nodes');
  const orig = snapSegs(leg()); const O = JSON.parse(orig);
  click(V(leg().segments[2].point)); await ticks(); ok('2A', 'click selects one node', S().selected === 1 && S().point);
  click(V(leg().segments[3].point), { shiftKey: true }); await ticks(); ok('2A', 'Shift+click adds; shows bounding box', S().selected === 2 && S().bounds);
  click(V(leg().segments[3].point), { shiftKey: true }); await ticks(); ok('2A', 'Shift+click again removes', S().selected === 1);
  h = hist(); ed.setNodePosition({ x: 6.5 }); ed.setNodePosition({ y: 20.25 }); await ticks(); const o = st().origin; let n = JSON.parse(snapSegs(leg()));
  ok('2A', 'typed X/Y is exact', n[2][0] - o.x === 6.5 && o.y - n[2][1] === 20.25);
  ok('2A', 'no other node or handle moved', n.every((s, i) => i === 2 || JSON.stringify(s) === JSON.stringify(O[i])));
  ed.nudgeNodes(0.01, 0); await ticks(); ok('2A', 'node nudge 0.01 in', Math.abs(leg().segments[2].point.x - o.x - 6.51) < 1e-9);
  ed.undo(); await ticks(); ok('2A', 'undo keeps the node selected', S().selected === 1 && Math.abs(S().point.x - o.x - 6.5) < 1e-9);
  ed.undo(); ed.undo(); await ticks(); ok('2A', 'undo all = original outline', snapSegs(leg()) === orig);
  h = hist(); const p0 = leg().segments[0].point.clone(); click(V(p0)); await ticks(); let a = V(leg().segments[0].point); drag(a, { x: a.x + 40, y: a.y + 25 }); await ticks();
  ok('2A', 'node drag = one undo step', hist() - h === 1 && Math.abs((leg().segments[0].point.x - p0.x) * ps.view.zoom - 40) < 0.01);
  const p1 = leg().segments[0].point.clone(); a = V(p1); drag(a, { x: a.x + 50, y: a.y + 8 }, { ctrlKey: true }); await ticks();
  ok('2A', 'Ctrl constrains the drag to one axis', leg().segments[0].point.y === p1.y);
  ed.undo(); ed.undo(); await ticks();
  const gx = leg().segments[4].point.x + 0.5; ed.addGuide('v', gx); ed.commit(); await ticks(); click(V(leg().segments[4].point)); await ticks(); a = V(leg().segments[4].point); const tg = V(new ps.Point(gx, leg().segments[4].point.y)); drag(a, { x: tg.x - 3, y: tg.y + 10 }); await ticks();
  ok('2A', 'node snaps exactly onto a guideline', leg().segments[4].point.x === gx);
  ed.undo(); ed.undo(); await ticks();
  click(V(hemMid(leg()))); await ticks(); key('a', { ctrlKey: true }); await ticks(); ok('2A', 'Ctrl+A selects every node of the curve', S().selected === S().total);
  key('Escape'); await ticks(); const e1 = st().tool === 'shape' && S().selected === 0; key('Escape'); await ticks();
  ok('2A', 'Esc clears nodes, Esc again returns to Pick', e1 && st().tool === 'pick' && st().selectionCount === 1);
  key('n'); await ticks(); const nTool = st().tool; key(' '); await ticks(); const sp1 = st().tool; key(' '); await ticks();
  ok('2A', 'N opens Shape tool; Space tap toggles Shape ⇄ Pick', nTool === 'shape' && sp1 === 'pick' && st().tool === 'shape' && S().hasTarget);
  const tl = V(leg().bounds.topLeft), tr = V(leg().bounds.topRight); drag({ x: tl.x - 15, y: tl.y - 15 }, { x: tr.x + 15, y: tr.y + 40 }); await ticks();
  ok('2A', 'marquee selects the nodes inside it', S().selected === 2);
  const statusText = [...document.querySelectorAll('.font-mono span')].map((e) => e.textContent).find((t) => /nodes/.test(t)) || '';
  ok('2A', 'status bar: "Curve on Layer 1 · N nodes · M selected"', /Curve on Layer 1 · 8 nodes · 2 selected/.test(statusText), statusText);
  const comp = g().children.find((c) => c.className === 'CompoundPath'); click(V(comp.children[0].getPointAt(comp.children[0].length * 0.1))); await ticks();
  ok('2A', 'compound path shows nodes of all subpaths', S().subpaths === 2 && S().total === 8);
  const nc = ed.nodeCanvas, ctx = nc.getContext('2d'), dpr = devicePixelRatio; ed.drawOverlay();
  const sizeAt = (p) => { const v = V(p); const row = ctx.getImageData(Math.round((v.x - 10) * dpr), Math.round(v.y * dpr), Math.round(20 * dpr), 1).data; let c = 0; for (let i = 3; i < row.length; i += 4) if (row[i] > 0) c++; return c / dpr; };
  const s1 = sizeAt(comp.children[0].segments[1].point); ed.setZoomPct(400); ps.view.center = comp.children[0].segments[1].point; ed.viewChanged(); await ticks(); const s2 = sizeAt(comp.children[0].segments[1].point);
  ok('2A', 'node markers stay 7 px at every zoom', s1 === 7 && s2 === 7, `${s1}px / ${s2}px`);
  ed.select([g()]); ed.fitSelection(); await ticks();

  // ------------------------------------------------------------ 2B
  click(V(hemMid(leg()))); await ticks(); click(V(leg().segments[2].point)); await ticks();
  ok('2B', 'handles shown for the node and its neighbours', ed.shape.shownHandles().length === 4);
  h = hist(); key('s'); await ticks(); let sg = leg().segments[2];
  ok('2B', 'S = smooth: handles collinear, lengths kept', S().nodeType === 's' && Math.abs(sg.handleIn.x * sg.handleOut.y - sg.handleIn.y * sg.handleOut.x) < 1e-12 && hist() - h === 1);
  key('y'); await ticks(); sg = leg().segments[2]; ok('2B', 'Y = symmetrical: collinear and equal', S().nodeType === 'y' && sg.handleIn.add(sg.handleOut).length < 1e-12);
  let hp = V(sg.point.add(sg.handleOut)); const pt = sg.point.clone(); drag(hp, { x: hp.x + 30, y: hp.y - 20 }); await ticks(); sg = leg().segments[2];
  ok('2B', 'dragging a symmetrical handle mirrors the other', sg.handleIn.add(sg.handleOut).length < 1e-9 && sg.point.equals(pt));
  key('c'); await ticks(); sg = leg().segments[2]; const hin = sg.handleIn.clone(); hp = V(sg.point.add(sg.handleOut)); drag(hp, { x: hp.x + 15, y: hp.y + 25 }); await ticks();
  ok('2B', 'C = cusp: the other handle stays put', S().nodeType === 'c' && leg().segments[2].handleIn.equals(hin));
  key('z', { ctrlKey: true }); await ticks(); key('y', { ctrlKey: true }); await ticks(); ok('2B', 'Ctrl+Z / Ctrl+Y still undo / redo (no clash with C S Y)', S().nodeType === 'c');
  while (hist() > h) ed.undo(); await ticks(); ok('2B', 'undo everything = original outline', snapSegs(leg()) === orig);
  click(V(hemMid(leg()))); await ticks(); const mid = leg().curves[2].getPointAtTime(0.5); h = hist(); a = V(mid); drag(a, { x: a.x + 30, y: a.y + 12 }); await ticks();
  const mv = leg().curves[2].getPointAtTime(0.5).subtract(mid).multiply(ps.view.zoom); n = JSON.parse(snapSegs(leg()));
  ok('2B', 'dragging a curve: grabbed point follows exactly, nodes stay', Math.abs(mv.x - 30) < 0.01 && Math.abs(mv.y - 12) < 0.01 && n.every((s, i) => s[0] === O[i][0] && s[1] === O[i][1]) && hist() - h === 1);
  ed.undo(); await ticks();
  const hm = V(hemMid(leg())); drag(hm, { x: hm.x + 10, y: hm.y + 30 }); await ticks(); ok('2B', 'a straight segment does not move when dragged', snapSegs(leg()) === orig);
  click(hm); await ticks(); const len0 = S().segmentLength; ok('2B', 'segment select + live length readout', S().segments === 1 && Math.abs(len0 - leg().curves[4].length) < 1e-12, len0.toFixed(3) + ' in');
  ed.convertSegments('curve'); await ticks(); const straight = leg().curves[4].hasHandles() && leg().curves[4].isStraight(); drag(hm, { x: hm.x, y: hm.y + 25 }); await ticks(); const bent = !leg().curves[4].isStraight();
  click(V(leg().curves[4].getPointAtTime(0.5))); await ticks(); ed.convertSegments('line'); await ticks();
  ok('2B', 'To curve (still straight) → bend → To line', straight && bent && !leg().curves[4].hasHandles() && Math.abs(leg().curves[4].length - len0) < 1e-12);
  click(V(leg().segments[3].point)); await ticks(); key('y'); await ticks(); const dA = JSON.stringify(ed.toDocument()); await ed.loadDocument(JSON.parse(dA)); await ticks(30);
  ok('2B', 'node types saved and reloaded', JSON.stringify(ed.toDocument()) === dA && /y/.test(leg().data.nt || ''), leg().data.nt);
  await ed.loadDocument(JSON.parse(dA.replace(/"objects":\[.*?\],"assets"/s, `"objects":${imported},"assets"`))); await ticks(30);

  // ------------------------------------------------------------ 2C
  ed.setTool('pick'); ed.select([g()]); ed.fitSelection(); ed.setTool('shape'); await ticks(); click(V(hemMid(leg()))); await ticks();
  const before = leg().clone({ insert: false }); h = hist();
  for (const t of [0.25, 0.5, 0.75]) { dbl(V(before.curves[0].getPointAtTime(t))); await ticks(); }
  ok('2C', 'double-click adds 3 nodes on the waist; shape unchanged', leg().segments.length === 11 && dev(before, leg()) < 1e-5 && hist() - h === 3, 'max change ' + dev(before, leg()).toExponential(1) + ' in');
  const waist = leg().segments.filter((s) => s.point.y < 1.7).sort((x, y) => x.point.x - y.point.x); dbl(V(waist[2].point)); await ticks();
  ok('2C', 'double-click a node deletes it; shape kept', leg().segments.length === 10 && dev(before, leg()) < 1e-5, 'max change ' + dev(before, leg()).toExponential(1) + ' in');
  click(V(leg().curves[3].getPointAtTime(0.5))); await ticks(); key('+'); await ticks(); const plus = leg().segments.length; key('-'); await ticks();
  ok('2C', '+ adds at the segment middle, − deletes; shape kept', plus === 11 && leg().segments.length === 10 && dev(before, leg()) < 1e-5, 'max change ' + dev(before, leg()).toExponential(1) + ' in');
  while (hist() > h) ed.undo(); await ticks();
  click(V(leg().segments[2].point)); await ticks(); ed.breakAtNodes(); await ticks(); const brokeOpen = S().open && S().canJoin && S().selected === 2 && /Open outline/.test(document.body.textContent);
  ed.joinNodes(); await ticks(); ok('2C', 'Break at node (warning shown) then Join back', brokeOpen && !S().open && leg().closed && leg().segments.length === 8 && dev(before, leg()) < 1e-5);
  click(V(leg().segments[0].point)); await ticks(); ed.breakAtNodes(); await ticks(); ed.closeWithLine(); await ticks(); const closed = ed.shape.target.closed;
  ed.reverseDirection(); await ticks(); ed.toggleClosed(); await ticks(); const opened = !ed.shape.target.closed; ed.toggleClosed(); await ticks();
  ok('2C', 'Extend to close, Reverse, Open / Close toggle', closed && opened && ed.shape.target.closed && dev(before, ed.shape.target) < 1e-5);
  const tt = ed.shape.target; click(V(tt.segments[0].point)); click(V(tt.segments[1].point), { shiftKey: true }); await ticks(); ed.alignNodes('h'); await ticks();
  ok('2C', 'Align nodes horizontally', ed.shape.target.segments[0].point.y === ed.shape.target.segments[1].point.y);
  while (hist() > h) ed.undo(); await ticks(); ok('2C', 'undo everything = original outline', snapSegs(leg()) === orig);
  const dense = () => g().children.filter((c) => c.className === 'Path').sort((x, y) => y.segments.length - x.segments.length)[0]; const dOrig = dense().clone({ insert: false });
  click(V(dense().getPointAt(dense().length * 0.31))); await ticks(); h = hist(); ed.previewSimplify(0.01); await ticks(); const pv = S().simplify; const untouched = dense().segments.length === 334 && hist() === h;
  ok('2C', 'Simplify shows before → after without changing anything', pv && pv.before === 334 && pv.after < 60 && untouched, pv && `${pv.before} → ${pv.after} nodes`);
  key('Escape'); await ticks(); const cancelled = !S().simplify && dense().segments.length === 334; ed.previewSimplify(0.01); await ticks(); ed.applySimplify(); await ticks();
  ok('2C', 'Esc cancels; Apply stays within tolerance, one undo step', cancelled && hist() - h === 1 && dev(dOrig, ed.shape.target, 500) < 0.012, `${ed.shape.target.segments.length} nodes, max change ${dev(dOrig, ed.shape.target, 500).toFixed(4)} in`);
  ed.undo(); await ticks();
  const open = ed.listOpenPaths(); const big = open.find((p) => p.nodes > 100);
  ok('2C', 'Check outlines lists the open outline', !!big, `${open.filter((p) => p.nodes > 2).length} open outlines, ${open.filter((p) => p.nodes === 2).length} simple lines`);
  ed.editOpenPath(big); await ticks(); const jumped = S().selected === 2 && S().canJoin; ed.closeWithLine(); await ticks();
  ok('2C', 'jump to it, close it, and it leaves the list', jumped && !S().open && !ed.listOpenPaths().some((p) => p.nodes > 100));
  ed.undo(); await ticks();

  // ------------------------------------------------------------ 2D
  ed.setTool('pick'); ed.addText('XL', new ps.Point(60, 36.5), 1.5); await ticks(); await until(() => document.fonts.check('1px Arimo'), 5000);
  const region = new ps.Rectangle(59.5, 34.8, 3.5, 2.2);
  const render = () => { const c = document.createElement('canvas'), s = 200; c.width = region.width * s; c.height = region.height * s; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.scale(s, s); x.translate(-region.x, -region.y); ed.selected[0].draw(x, new ps.Base({ offset: new ps.Point(0, 0), pixelRatio: 1, viewMatrix: new ps.Matrix(), matrices: [new ps.Matrix()], updateMatrix: true })); return x.getImageData(0, 0, c.width, c.height).data; };
  const A = render(); h = hist(); const cr = await ed.convertToCurves(); await ticks(); const B = render(); let ink = 0, diff = 0; for (let i = 0; i < A.length; i += 4) { if (A[i] < 128) ink++; if ((A[i] < 128) !== (B[i] < 128)) diff++; }
  ok('2D', 'text "XL" → curves looks identical', cr.ok && ed.selected[0].className === 'CompoundPath' && ink > 1000 && diff / ink < 0.005 && hist() - h === 1, `${diff} of ${ink} pixels differ`);
  const xl = ed.selected[0]; ed.setTool('shape'); await ticks(); const oth = snapSegs(xl.children[0]); ed.shape.restore({ target: { id: xl.data.id, path: [] }, nodes: ['1:0'] }); const x0 = xl.children[1].segments[0].point.x; ed.nudgeNodes(0.1, 0); await ticks();
  ok('2D', 'edit one letter\'s node; the other letter is untouched', Math.abs(ed.shape.target.children[1].segments[0].point.x - x0 - 0.1) < 1e-9 && snapSegs(ed.shape.target.children[0]) === oth);
  ed.setTool('pick'); await ticks();
  const mk = (kind, x, y, w, hh, fill) => { const r = kind === 'e' ? new ps.Path.Ellipse({ rectangle: new ps.Rectangle(x, y, w, hh), insert: false }) : new ps.Path.Rectangle({ rectangle: new ps.Rectangle(x, y, w, hh), insert: false }); r.strokeColor = new ps.Color('#000'); r.strokeWidth = 0.01; if (fill) r.fillColor = new ps.Color(fill); r.data.id = 't' + Math.random().toString(36).slice(2); L.addChild(r); return r; };
  ed.setTool('rectangle'); drag({ x: 300, y: 620 }, { x: 360, y: 660 }); await ticks(); ed.setTool('shape'); await ticks(); const hint = S().hint; const rc = await ed.convertToCurves(); await ticks();
  ok('2D', 'rectangle shows the Ctrl+Q hint, then converts', /Convert to curves/.test(hint || '') && rc.ok && S().hasTarget && S().total === 4);
  ed.setTool('pick'); const r1 = mk('r', 100, 32, 3, 2, '#ff0000'), r2 = mk('r', 102, 33, 3, 2, '#00ff00'); ed.commit(); ed.select([r1, r2]); const ub = r1.bounds.unite(r2.bounds); h = hist(); ed.setShaping('weld'); await ticks(); const prevOk = st().shaping.ok; ed.applyShaping(); await ticks(); const w = ed.selected[0];
  ok('2D', 'Weld two rectangles: preview, exact bounds, target fill, one step', prevOk && w.bounds.equals(ub) && w.fillColor.toCSS(true) === '#00ff00' && hist() - h === 1 && Math.abs(w.area) - 11 < 1e-9);
  ed.select([g()]); ed.ungroup(); await ticks(); const lg = ed.selected.find((i) => i.className === 'Path' && i.segments.length === 8 && i.closed && !i.dashArray.length); const lgNodes = lg.segments.map((s) => s.point.x + ',' + s.point.y); const lgB = lg.bounds.clone();
  const hmid = lg.segments[4].point.add(lg.segments[5].point).divide(2); const circ = mk('e', hmid.x - 0.6, hmid.y - 0.6, 1.2, 1.2, null); ed.commit(); ed.select([circ, lg]); ed.setShaping('trim'); await ticks(); ed.applyShaping(); await ticks(); const trm = ed.selected[0]; const now = new Set(trm.segments.map((s) => s.point.x + ',' + s.point.y));
  ok('2D', 'Trim a circle out of a pattern piece: no position drift', lgNodes.every((x) => now.has(x)) && Math.abs(trm.bounds.x - lgB.x) < 1e-9 && Math.abs(trm.bounds.width - lgB.width) < 1e-9 && trm.segments.length > 8, `${trm.segments.length} nodes, all 8 original nodes exact`);
  const fa = mk('r', 110, 30, 1, 1, '#f00'), fb = mk('r', 113, 30, 1, 1, '#0f0'); ed.commit(); ed.select([fa, fb]); ed.setShaping('intersect'); await ticks(); const cnt = L.children.length; const ir = ed.applyShaping();
  ok('2D', 'non-overlapping Intersect: friendly message, nothing changes', !st().shaping.ok && !ir.ok && L.children.length === cnt, ir.message);
  ed.setShaping(null); ed.select([fa, fb]); k0 = L.children.length; key('l', { ctrlKey: true }); await ticks(); const comb = ed.selected[0].className === 'CompoundPath' && L.children.length === k0 - 1; key('k', { ctrlKey: true }); await ticks();
  ok('2D', 'Combine (Ctrl+L) / Break apart (Ctrl+K)', comb && L.children.length === k0 && ed.selected.length === 2);

  // ------------------------------------------------------------ 2E
  const mkImg = async (name, draw, w = 600, hh = 400) => { const c = document.createElement('canvas'); c.width = w; c.height = hh; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, hh); draw(x, w, hh); const url = c.toDataURL('image/png'); const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; }); return { asset: { id: 'a' + Math.random().toString(36).slice(2), name, mime: 'image/png', dataUrl: url, pxWidth: w, pxHeight: hh, dpi: 100 }, img }; };
  const openTrace = async () => { [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Object').click(); await until(() => document.querySelector('[role=menuitem]')); [...document.querySelectorAll('[role=menuitem]')].find((i) => /Trace bitmap/.test(i.textContent)).click(); return until(() => dlg() && /\d+ shapes/.test(dlg().textContent), 12000); };
  const logo = await mkImg('logo.png', (x) => { x.fillStyle = '#000'; x.beginPath(); x.arc(200, 200, 150, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(200, 200, 90, 0, 7); x.fill(); x.fillStyle = '#000'; x.fillRect(400, 80, 120, 240); });
  await ed.placeRaster(logo.asset, logo.img, new ps.Point(20, 10)); await ticks(); const opened2 = await openTrace(); h = hist(); dbtn('Trace and place').click(); await until(() => !dlg(), 20000); await ticks(); const tg1 = ed.selected[0]; const tb = tg1.bounds;
  ok('2E', 'trace a black logo: placed exactly over the image, same size', opened2 && tg1.className === 'Group' && Math.abs(tb.x - 17.5) < 0.01 && Math.abs(tb.y - 8.5) < 0.01 && Math.abs(tb.width - 4.7) < 0.01 && Math.abs(tb.height - 3) < 0.01 && hist() - h === 1, `${tg1.children.length} shapes at ${tb.x.toFixed(3)}, ${tb.y.toFixed(3)} · ${tb.width.toFixed(3)} × ${tb.height.toFixed(3)} in`);
  const tr1 = tg1.children.find((c) => c.className === 'Path'); ed.setTool('shape'); ed.shape.enter(tr1); ed.shape.selectAll(); await ticks(); const tx = tr1.bounds.x; ed.nudgeNodes(0.1, 0); await ticks();
  ok('2E', 'nodes of the traced result can be edited', S().total === tr1.segments.length && Math.abs(ed.shape.target.bounds.x - tx - 0.1) < 1e-9);
  ed.setTool('pick'); const motif = await mkImg('motif.png', (x) => { x.fillStyle = '#d21f3c'; x.beginPath(); x.arc(150, 200, 110, 0, 7); x.fill(); x.fillStyle = '#1f4fd2'; x.fillRect(300, 90, 130, 220); x.fillStyle = '#1fa34a'; x.beginPath(); x.moveTo(470, 320); x.lineTo(580, 320); x.lineTo(525, 120); x.closePath(); x.fill(); });
  await ed.placeRaster(motif.asset, motif.img, new ps.Point(40, 15)); await ticks(); const rr = ed.selected[0]; rr.rotate(30); rr.scale(1.5); ed.commit(); await ticks(); const rm = rr.matrix.clone(), W = rr.width, H = rr.height; const P = (px, py) => rm.transform(new ps.Point((px / 600 - 0.5) * W, (py / 400 - 0.5) * H));
  await openTrace(); dbtn('Colours').click(); await until(() => dlg() && /3 shapes/.test(dlg().textContent), 8000); const photoWarn = /Photo-like/.test(dlg().textContent); dbtn('Trace and place').click(); await until(() => !dlg(), 20000); await ticks(); const tg2 = ed.selected[0];
  const red = tg2.children.find((c) => c.fillColor.red > 0.6 && c.fillColor.green < 0.3), blue = tg2.children.find((c) => c.fillColor.blue > 0.6 && c.fillColor.red < 0.3);
  ok('2E', 'trace a 3-colour motif on a rotated, scaled image: lands on the original', tg2.children.length === 3 && !photoWarn && red.bounds.center.getDistance(P(150, 200)) < 0.01 && blue.bounds.center.getDistance(P(365, 200)) < 0.01, `3 shapes; centres within ${Math.max(red.bounds.center.getDistance(P(150, 200)), blue.bounds.center.getDistance(P(365, 200))).toFixed(4)} in`);
  const dZ = JSON.stringify(ed.toDocument()); await ed.loadDocument(JSON.parse(dZ)); await ticks(30); ok('2E', 'final document saves and reloads identically', JSON.stringify(ed.toDocument()) === dZ);

  // ------------------------------------------------------------ performance (full leggings file)
  await ed.loadDocument(JSON.parse(dZ.replace(/"objects":\[.*?\],"assets":\[.*\]\}$/s, `"objects":${imported},"assets":[]}`))); await ticks(30);
  const perf = { totalNodes: totalNodes(), objects: L.getItems({}).length };
  const mctx = cv.getContext('2d'); const frame = () => { ps.view.update(); mctx.getImageData(0, 0, 1, 1); ctx.getImageData(0, 0, 1, 1); };
  const measure = async (label, setup) => { ed.setTool('pick'); await setup(); ed.setTool('shape'); await ticks(); const d = dense(); click(V(d.getPointAt(d.length * 0.31))); await ticks(); if (label.includes('all')) { key('a', { ctrlKey: true }); await ticks(); } else { click(V(dense().segments[10].point)); await ticks(); }
    const b = V(dense().segments[10].point); ev('pointerdown', b); const times = []; for (let i = 1; i <= 90; i++) { const t0 = performance.now(); ev('pointermove', { x: b.x + i * 0.4, y: b.y + i * 0.3 }); frame(); times.push(performance.now() - t0); } ev('pointerup', { x: b.x + 36, y: b.y + 27 }); await ticks(); ed.undo(); await ticks();
    times.sort((x, y) => x - y); const avg = times.reduce((s, x) => s + x, 0) / times.length; perf[label] = { avgMs: +avg.toFixed(2), p95Ms: +times[Math.floor(times.length * 0.95)].toFixed(2), fps: Math.round(1000 / avg), nodesShown: S() ? S().total : 0 }; };
  await measure('drag 1 node, whole page visible', async () => { ed.fitPage(); await ticks(); });
  await measure('drag 1 node, zoomed to one size', async () => { ed.select([g()]); ed.fitSelection(); await ticks(); });
  await measure('drag all 334 nodes of a piece', async () => { ed.select([g()]); ed.fitSelection(); await ticks(); });
  perf.canvasPx = cv.width + '×' + cv.height; perf.pageVisible = document.visibilityState;
  return { passed: R.filter((r) => r.pass).length, failed: R.filter((r) => !r.pass), total: R.length, all: R.map((r) => `${r.pass ? 'PASS' : 'FAIL'} ${r.phase} ${r.name}${r.info ? ' — ' + r.info : ''}`), perf };
}
