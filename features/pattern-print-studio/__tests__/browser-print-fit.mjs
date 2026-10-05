// Browser test for Phase 3B: exact adjustment of a print inside a PowerClip (X/Y/W/H/rotation, quick fits, anchor, DPI).
// Run like browser-regression.mjs (see ../README.md); it also needs fixtures/floral-print.png in public/.
const tick = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
const ticks = async (n = 12) => { for (let i = 0; i < n; i++) await tick(); };
const until = async (fn, max = 8000) => { const t0 = performance.now(); while (performance.now() - t0 < max) { if (fn()) return true; await ticks(10); } return false; };
window.requestAnimationFrame = (cb) => { tick().then(() => cb(performance.now())); return 0; };

export default async function run() {
  const ed = window.__pps, ps = ed.ps, L = ed.contentLayer, cv = ed.canvas;
  cv.setPointerCapture = () => {}; ed.emitScheduled = false;
  const R = []; const ok = (name, pass, info) => R.push(`${pass ? 'PASS' : 'FAIL'} 3B ${name}${info !== undefined ? ' — ' + info : ''}`);
  const key = (k, o = {}) => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o })); window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true, ...o })); };
  const st = () => ed.getState(); const C = () => st().clipContent; const hist = () => ed.history.index;
  const dbtn = (t) => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim() === t);
  const btn = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t);
  const isPC = (it) => !!(it && it.data && it.data.pc);
  const clipG = (pc) => pc.children.find((c) => c.data.pcClip); const frame = (pc) => pc.children.find((c) => !c.data.pcClip && !c.data.derived); const contents = (pc) => clipG(pc).children.filter((c) => !c.data.derived);
  const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
  const loadImg = async (url, name, dpi) => { const blob = await (await fetch(url)).blob(); const dataUrl = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); }); const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; }); return { asset: { id: 'a' + Math.random().toString(36).slice(2), name, mime: 'image/png', dataUrl, pxWidth: img.naturalWidth, pxHeight: img.naturalHeight, dpi }, img }; };

  const txt = await (await fetch('/leggings-test.svg')).text();
  const inp = [...document.querySelectorAll('input[type=file]')].find((i) => i.accept.includes('.svg'));
  const dt = new DataTransfer(); dt.items.add(new File([txt], 'leggings-test.svg', { type: 'image/svg+xml' })); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
  await until(() => dbtn('Import')); dbtn('Import').click(); await until(() => L.children.length === 6); await ticks(40);
  ed.setTool('pick'); ed.clearSelection(); await ticks();
  const g = () => L.children[0]; const leg0 = g().children[0];
  // a small tile image (400 px) so scaling it up drives the DPI down
  const tile = await loadImg('/repeat-tile.png', 'repeat-tile.png', 200); // 400 px at 200 dpi = 2 in
  await ed.placeRaster(tile.asset, tile.img, leg0.bounds.center.add([1, 1])); await ticks();
  ed.select([g()]); ed.fitSelection(); await ticks(); ed.select([L.children.find((c) => c.className === 'Raster')]); await ticks();
  ed.beginPlaceInside(); const r = cv.getBoundingClientRect(); const at = ps.view.projectToView(leg0.bounds.center.add([-2, -3]));
  for (const type of ['pointerdown', 'pointerup']) cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: r.left + at.x, clientY: r.top + at.y, button: 0, pointerId: 1 }));
  await ticks(); const pc = () => g().children.find(isPC); const F = () => frame(pc()).bounds; const print = () => contents(pc())[0];
  ok('setup: a 2 in tile (400 px) placed inside the S front piece', !!pc() && near(print().bounds.width, 2, 1e-9));
  ok('no print controls outside edit mode', C() === null);

  ed.editClip(pc()); await ticks();
  ok('edit mode: property bar shows the print relative to the frame', C() && near(C().w, 2) && near(C().h, 2) && near(C().rotation, 0) && !C().multiple && [...document.querySelectorAll('span')].some((s) => s.textContent.trim() === 'Print in frame'));
  ok('DPI comes from the original file: 400 px over 2 in = 200 DPI, no warning', near(C().dpi, 200, 1e-6) && C().dpiLevel === 'ok', C().dpi.toFixed(1) + ' DPI');
  ok('default anchor = centre; X/Y are the print centre relative to the frame centre (Y up)', st().refPoint === 4 && near(C().x, print().bounds.center.x - F().center.x) && near(C().y, F().center.y - print().bounds.center.y));

  // --- quick fits
  let h = hist(); ed.fitClipContent('center'); await ticks();
  ok('Center: print centre on frame centre, one undo step', near(C().x, 0) && near(C().y, 0) && hist() - h === 1 && near(C().w, 2));
  ed.fitClipContent('fit'); await ticks(); let b = print().bounds;
  ok('Fit: whole print inside the frame, proportions kept', near(C().w, C().h) && near(b.width, F().width, 1e-9) && b.height <= F().height + 1e-9 && b.left >= F().left - 1e-9 && b.right <= F().right + 1e-9, `${C().w.toFixed(3)} in wide in a ${F().width.toFixed(3)} × ${F().height.toFixed(3)} frame`);
  ed.fitClipContent('fill'); await ticks(); b = print().bounds;
  ok('Fill: print covers the whole frame, no gaps, proportions kept', near(C().w, C().h) && b.left <= F().left + 1e-9 && b.right >= F().right - 1e-9 && b.top <= F().top + 1e-9 && b.bottom >= F().bottom - 1e-9 && near(b.height, F().height, 1e-9), `${C().w.toFixed(3)} × ${C().h.toFixed(3)} in`);
  ok('DPI warning appears when the small image is scaled up: red below 100', C().dpiLevel === 'bad' && C().dpi < 100 && /print may look blurry/.test(document.body.textContent), Math.round(C().dpi) + ' DPI');
  const alertEl = document.querySelector('[role=alert]'); ok('…shown as a red alert in the property bar', !!alertEl && /red/.test(alertEl.className), alertEl && alertEl.textContent);
  ed.setClipContent({ w: 3 }); await ticks(); const lowEl = document.querySelector('[role=alert]');
  ok('yellow between 100 and 150 DPI (400 px over 3 in = 133)', C().dpiLevel === 'low' && near(C().dpi, 400 / 3, 1e-6) && near(C().h, 3) && lowEl && /yellow/.test(lowEl.className), lowEl && lowEl.textContent);
  ed.fitClipContent('fill'); await ticks();

  // --- rotate 15°, Fill still covers
  h = hist(); ed.setClipContent({ rotation: 15 }); await ticks();
  ok('type rotation 15°: print turns about its centre, size unchanged, one step', near(C().rotation, 15, 1e-9) && near(C().w, C().h, 1e-9) && hist() - h === 1, C().rotation.toFixed(3) + '°');
  const wBefore = C().w; ed.fitClipContent('fill'); await ticks();
  const m = print().matrix; const inside = (pt) => { const l = m.inverseTransform(pt); return Math.abs(l.x) <= print().width / 2 + 1e-6 && Math.abs(l.y) <= print().height / 2 + 1e-6; };
  ok('Fill with the print rotated: every corner of the frame is still covered', [F().topLeft, F().topRight, F().bottomLeft, F().bottomRight].every(inside) && C().w > wBefore && near(C().rotation, 15, 1e-9), `grew from ${wBefore.toFixed(3)} to ${C().w.toFixed(3)} in`);

  // --- exact offsets, anchor
  h = hist(); ed.setClipContent({ x: 1.25 }); ed.setClipContent({ y: -0.5 }); await ticks();
  ok('type exact offsets: X 1.250, Y −0.500 from the frame centre', near(C().x, 1.25, 1e-9) && near(C().y, -0.5, 1e-9) && near(print().bounds.center.x - F().center.x, 1.25, 1e-9) && near(print().bounds.center.y - F().center.y, 0.5, 1e-9) && hist() - h === 2);
  ed.setRefPoint(1); await ticks(); ok('anchor top-centre: numbers are now measured top-centre to top-centre', near(C().x, print().bounds.topCenter.x - F().topCenter.x, 1e-9) && near(C().y, F().top - print().bounds.top, 1e-9));
  ed.setClipContent({ x: 0, y: 0 }); await ticks(); ok('X 0, Y 0 at that anchor = aligned top-centre', near(print().bounds.topCenter.x, F().topCenter.x, 1e-9) && near(print().bounds.top, F().top, 1e-9));
  ed.setRefPoint(4); ed.setClipContent({ rotation: 0 }); await ticks(); ed.fitClipContent('fit'); await ticks(); ed.fitClipContent('top'); await ticks();
  ok('Top button: top-centre of the print on top-centre of the frame (waistband)', near(print().bounds.top, F().top, 1e-9) && near(print().bounds.center.x, F().center.x, 1e-9));
  ed.setRefPoint(0); ed.fitClipContent('fit'); await ticks(); ok('Fit lines up at the chosen anchor (top-left)', near(print().bounds.left, F().left, 1e-9) && near(print().bounds.top, F().top, 1e-9)); ed.setRefPoint(4); await ticks();

  // --- W / H, lock aspect
  ed.setLockAspect(true); ed.setClipContent({ w: 4 }); await ticks(); const centre = print().bounds.center.clone();
  ok('W with lock aspect (default on): H follows', st().lockAspect && near(C().w, 4, 1e-9) && near(C().h, 4, 1e-9));
  ed.setLockAspect(false); ed.setClipContent({ h: 6 }); await ticks();
  ok('lock off: H alone changes; the anchor point stays put', near(C().w, 4, 1e-9) && near(C().h, 6, 1e-9) && near(print().bounds.center.x, centre.x, 1e-9) && near(print().bounds.center.y, centre.y, 1e-9));
  ed.setLockAspect(true); await ticks();

  // --- Stretch asks first
  h = hist(); btn('Stretch').click(); await ticks(30); const asked = hist() === h && /distorted/.test(document.body.textContent);
  const go = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Stretch anyway'); if (go) go.click(); await ticks(30);
  ok('Stretch asks before distorting; "Stretch anyway" then matches the frame exactly', asked && !!go && near(print().bounds.width, F().width, 1e-9) && near(print().bounds.height, F().height, 1e-9) && hist() - h === 1);

  // --- nudge inside, Shift ×10
  const x0 = C().x; key('ArrowRight'); await ticks(); const n1 = C().x - x0; key('ArrowUp', { shiftKey: true }); await ticks();
  ok('arrow keys nudge the print inside (0.01 in); Shift = ×10', near(n1, 0.01, 1e-9) && near(C().y, 0.1, 1e-9));

  // --- vector print remembers its rotation
  ed.finishClipEdit(); await ticks();
  const rect = new ps.Path.Rectangle({ rectangle: new ps.Rectangle(100, 30, 6, 4), insert: false }); rect.strokeColor = new ps.Color('#000'); rect.strokeWidth = 0.01; rect.data.id = 'fr'; L.addChild(rect);
  const bar = new ps.Path.Rectangle({ rectangle: new ps.Rectangle(101, 31, 3, 1), insert: false }); bar.fillColor = new ps.Color('#1d3557'); bar.data.id = 'bar'; L.addChild(bar); ed.commit(); await ticks();
  ed.select([bar]); ed.beginPlaceInside(); const p2 = ps.view.projectToView(new ps.Point(100.3, 30.3)); const r2 = cv.getBoundingClientRect();
  for (const type of ['pointerdown', 'pointerup']) cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: r2.left + p2.x, clientY: r2.top + p2.y, button: 0, pointerId: 1 }));
  await ticks(); const top = () => L.children.find((c) => isPC(c) && frame(c).data.id === 'fr'); ed.editClip(top()); await ticks();
  ed.setClipContent({ rotation: 30 }); await ticks();
  ok('vector print: rotation 30° is remembered; W/H stay its own 3 × 1, DPI not shown', near(C().rotation, 30, 1e-9) && near(C().w, 3, 1e-6) && near(C().h, 1, 1e-6) && C().dpi === null && !document.querySelector('[role=alert]'));
  ed.setClipContent({ w: 4.5 }); await ticks(); ok('…and W scales it along its own width, not skewed', near(C().w, 4.5, 1e-6) && near(C().h, 1.5, 1e-6) && near(C().rotation, 30, 1e-9));
  ed.finishClipEdit(); await ticks(); const d1 = JSON.stringify(ed.toDocument()); await ed.loadDocument(JSON.parse(d1)); await ticks(30);
  ok('save → reload identical, rotation kept', JSON.stringify(ed.toDocument()) === d1 && /"rot":30/.test(d1));
  ed.editClip(top()); await ticks(); ok('after reload the rotation still reads 30°', near(C().rotation, 30, 1e-9) && near(C().w, 4.5, 1e-6)); ed.finishClipEdit(); await ticks();
  return { passed: R.filter((x) => x.startsWith('PASS')).length, total: R.length, failed: R.filter((x) => x.startsWith('FAIL')), all: R };
}
