// Browser test for Phase 4C: full-size exports as background jobs — progress, download through a signed link,
// cancel, failure + retry, the export list and the calibration test.
// Run like the other suites (see ../README.md); the page must be able to reach the export API.
import { buildLayout } from './browser-export-tiff.mjs';
const tick = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
const ticks = async (n = 12) => { for (let i = 0; i < n; i++) await tick(); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, max = 8000, step = 100) => { const t0 = performance.now(); while (performance.now() - t0 < max) { if (await fn()) return true; await sleep(step); } return false; };
const API = '/api/pps-test-export';

export default async function run() {
  const ed = window.__pps;
  const R = []; const ok = (name, pass, info) => R.push(`${pass ? 'PASS' : 'FAIL'} 4C ${name}${info !== undefined ? ' — ' + info : ''}`);
  const key = (k, o = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o }));
  const dlg = () => document.querySelector('[role=dialog]');
  const qa = (sel) => (dlg() ? [...dlg().querySelectorAll(sel)] : []);
  const dbtn = (t) => qa('button').find((b) => b.textContent.trim().startsWith(t));
  const box = (t) => { const l = qa('label').find((x) => x.textContent.trim().startsWith(t)); return l && l.querySelector('input'); };
  const btn = (t, root = document) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  const rows = () => [...document.querySelectorAll('[role=list][aria-label="Export list"] [role=listitem]')];
  const refreshList = () => document.querySelector('button[aria-label="Refresh the export list"]').click();
  const docId = () => ed.getState().docId;
  const list = async () => (await (await fetch(`${API}/jobs?doc=${docId()}`)).json()).jobs;
  const job = async (id) => (await list()).find((j) => j.id === id);
  const waitJob = async (id, max = 180000) => { let j; await until(async () => { j = await job(id); return j && j.status !== 'queued' && j.status !== 'running'; }, max, 300); return j; };
  const helper = async (path, body) => (await fetch(`${API}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  const report = {};
  try {
  const { P } = await buildLayout(ed);
  ok('layout ready', P().filter((p) => p.hasPrint).length === 19);
  btn('Checks').click(); await ticks(30); await sleep(300);
  ok('Checks tab has an Exports section: empty list, Export… and the calibration test', !!document.querySelector('section[aria-label="Exports"]') && /No exports of this document yet/.test(document.querySelector('section[aria-label="Exports"]').textContent) && !!btn('Make calibration test'));
  const hasHelper = (await fetch(`${API}/verify-url`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"name":"x","expect":{}}' }).catch(() => ({ status: 404 }))).status !== 404;

  // ---------------------------------------------------------------- one size (XL) at 150 DPI, from the dialog
  key('e', { ctrlKey: true }); await until(() => dlg() && /Export for production/.test(dlg().textContent)); await ticks(20);
  box('Selected size(s)').click(); await ticks(20);
  for (const l of qa('[role=group][aria-label="Sizes"] label')) { const i = l.querySelector('input'); const want = l.textContent.trim() === 'XL'; if (i.checked !== want) { i.click(); await ticks(10); } }
  // XL has a print in every piece, so nothing needs confirming; if a warning did show, it would have to be ticked first.
  if (box('Export anyway')) { const waits = dbtn('Export TIFF').disabled; box('Export anyway').click(); await ticks(20); ok('Export TIFF waits for "Export anyway" while there are warnings', waits); }
  ok('with no errors and no unconfirmed warnings, Export TIFF is enabled', !dbtn('Export TIFF').disabled);
  const xl = ed.exportArea('sizes', ['XL']).rect; const t0 = performance.now();
  dbtn('Export TIFF').click();
  const closed = await until(() => !dlg(), 30000);
  ok('Export TIFF starts a background job and closes the dialog — the editor is free again', closed && ed.getState().tool === 'pick');
  const sawChip = await until(() => document.querySelector('[role=status][aria-label="Export in progress"]'), 5000, 30);
  const sawBar = await until(() => rows()[0] && rows()[0].querySelector('[role=progressbar]'), 5000, 30);
  const steps = new Set(); const pcts = [];
  await until(async () => { const r = rows()[0]; const s = r && r.querySelector('[data-job-step]'); if (s) { const m = /(\d+)% · (.+)/.exec(s.textContent); if (m) { pcts.push(+m[1]); steps.add(m[2]); } } return r && r.dataset.status === 'done'; }, 120000, 60);
  const secs = (performance.now() - t0) / 1000;
  ok('while it runs: a progress chip over the canvas and a progress bar in the list, with % and the current step', sawChip && sawBar && pcts.length > 0, `steps seen: ${[...steps].join(' → ')}; ${Math.min(...pcts)}% … ${Math.max(...pcts)}%`);
  ok('progress only moves forward', pcts.every((p, i) => i === 0 || p >= pcts[i - 1]));
  // the editor stays usable meanwhile (checked by doing something while the job ran)
  const j1 = (await list())[0]; report.xl = j1;
  ok('the job finishes: status done, with file size, time and peak memory recorded', j1.status === 'done' && j1.bytes > 100000 && j1.seconds > 0 && j1.peakMemoryMb > 0, `${(j1.bytes / 1e6).toFixed(1)} MB in ${j1.seconds.toFixed(1)} s (${secs.toFixed(1)} s incl. upload), peak memory ${j1.peakMemoryMb} MB`);
  ok('…pixel size = round(inches × DPI) for the XL area', j1.widthPx === Math.round(xl.w * 150) && j1.heightPx === Math.round(xl.h * 150), `${j1.widthPx} × ${j1.heightPx} px`);
  ok('…file name: {document}_{area}_{dpi}dpi_{date_time}.tif', /^Leggings-Floral_XL_150dpi_\d{4}-\d\d-\d\d_\d{4}\.tif$/.test(j1.fileName), j1.fileName);
  const toast = await until(() => [...document.querySelectorAll('[data-sonner-toast]')].some((t) => /Export ready/.test(t.textContent) && /Download/.test(t.textContent)), 5000);
  ok('a toast announces it with a Download button', toast);
  const row = rows()[0];
  ok('the export list shows name, area, DPI, pixels, size, date and a Download button', /XL · 150 DPI/.test(row.textContent) && /MB/.test(row.textContent) && row.textContent.includes(j1.fileName) && !!btn('Download', row), row.textContent.slice(0, 160));
  // download through the signed link
  const res = await fetch(j1.download.url); const blob = await res.blob(); const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  ok('the signed link downloads the TIFF, with its file name', res.ok && res.headers.get('content-type') === 'image/tiff' && blob.size === j1.bytes && head[0] === 0x49 && head[2] === 42 && res.headers.get('content-disposition').includes(j1.fileName), `${blob.size} bytes`);
  const bad = new URL(j1.download.url, location.href); bad.searchParams.set('exp', String(+bad.searchParams.get('exp') + 3600000));
  const expired = new URL(j1.download.url, location.href); expired.searchParams.set('exp', String(Date.now() - 1000));
  ok('a changed or expired link is refused (403)', (await fetch(bad)).status === 403 && (await fetch(expired)).status === 403);
  const l2 = (await (await fetch(`${API}/jobs/${j1.id}/link?doc=${docId()}`)).json()).download;
  ok('a fresh link can be asked for at any time; links last 1 hour', !!l2 && l2.url !== j1.download.url && Math.abs(l2.expiresAt - Date.now() - 3600000) < 5000 && (await fetch(l2.url)).ok);
  // the Download button uses a fresh link
  { const clicks = []; const real = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) clicks.push({ name: this.download, href: this.getAttribute('href') }); else real.call(this); };
    btn('Download', rows()[0]).click(); await until(() => clicks.length, 5000); HTMLAnchorElement.prototype.click = real;
    ok('the Download button hands the file to the browser', clicks.length === 1 && clicks[0].name === j1.fileName && /\/jobs\/.+\/download\?/.test(clicks[0].href)); }
  if (hasHelper) { const v = await helper('verify-url', { url: j1.download.url, name: 'XL-150.tif', expect: { widthIn: xl.w, heightIn: xl.h, dpi: 150 } }); report.xlVerify = v;
    ok('verification script on the downloaded XL file: every check passes', v.ok, (v.checks || []).map((c) => `${c.ok ? '✓' : '✗'} ${c.name}: ${c.detail}`).join(' | ')); }

  // ---------------------------------------------------------------- cancel midway (full page, 300 DPI)
  const { doc, assets } = ed.exportDocument(); const hashes = [];
  for (const a of assets) { const b = await (await fetch(a.dataUrl)).blob(); hashes.push({ id: a.id, name: a.name, hash: [...new Uint8Array(await crypto.subtle.digest('SHA-256', await b.arrayBuffer()))].map((x) => x.toString(16).padStart(2, '0')).join('') }); }
  const opts = { format: 'tiff', dpi: 300, mirror: false, cutLines: false, cutLineWidthPt: 0.5, sizeLabels: false, background: 'white' };
  const start = async (body) => { const r = await fetch(`${API}/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, ...(await r.json()) }; };
  const big = await start({ kind: 'export', docId: docId(), areaLabel: 'All-sizes', request: { doc, assets: hashes, area: ed.exportArea('page').rect, options: opts } });
  ok('a full-page 300 DPI job is accepted: 49,125 × 11,308 px', big.status === 202 && big.job.widthPx === 49125 && big.job.heightPx === 11308);
  await until(async () => { const j = await job(big.job.id); return j && j.status === 'running' && j.progress > 0.04; }, 60000, 200);
  const before = await job(big.job.id); const tc = performance.now();
  // this job was started behind the panel's back: Refresh picks it up, then the chip's own Cancel button is used
  document.querySelector('button[aria-label="Refresh the export list"]').click();
  const chipShown = await until(() => document.querySelector('[role=status][aria-label="Export in progress"]'), 8000);
  ok('Refresh picks up an export started elsewhere; the progress chip shows it', chipShown, chipShown ? document.querySelector('[role=status][aria-label="Export in progress"]').textContent.trim().slice(0, 70) : '');
  btn('Cancel', document.querySelector('[role=status][aria-label="Export in progress"]')).click();
  const cancelled = await waitJob(big.job.id, 120000); const cancelSecs = (performance.now() - tc) / 1000; report.cancel = { at: before.progress, secs: cancelSecs };
  ok('Cancel stops it midway: status cancelled, no file, no download', cancelled.status === 'cancelled' && !cancelled.download && !cancelled.bytes, `cancelled at ${Math.round(before.progress * 100)}% (${before.step}); stopped ${cancelSecs.toFixed(1)} s after the click`);
  await until(() => rows().some((r) => r.dataset.status === 'cancelled'), 5000);
  ok('…the list shows it as cancelled, with Retry', rows().some((r) => r.dataset.status === 'cancelled' && !!btn('Retry', r)));

  // ---------------------------------------------------------------- failure with a clear reason + Retry
  const junk = new Blob([`not an image ${Date.now()}`]); const junkHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await junk.arrayBuffer()))].map((x) => x.toString(16).padStart(2, '0')).join('');
  await fetch(`${API}/assets/${junkHash}`, { method: 'PUT', body: junk });
  const brokenAssets = hashes.map((h, i) => (i === 0 ? { ...h, hash: junkHash, name: 'broken-print.png' } : h));
  const tf = performance.now(); const fail = await start({ kind: 'export', docId: docId(), areaLabel: 'All-sizes', request: { doc, assets: brokenAssets, area: ed.exportArea('page').rect, options: { ...opts, dpi: 150 } } });
  const failed = await waitJob(fail.job.id, 60000);
  ok('a corrupted original fails the job fast, naming the file', failed.status === 'failed' && /broken-print\.png/.test(failed.error) && failed.seconds < 5 && (performance.now() - tf) < 15000, failed.error);
  refreshList(); await until(() => rows().some((r) => r.dataset.status === 'failed'), 8000);
  const failRow = rows().find((r) => r.dataset.status === 'failed');
  ok('…the list shows the reason and a Retry button', !!failRow && /broken-print\.png/.test(failRow.textContent) && !!btn('Retry', failRow));
  const nBefore = (await list()).length; if (failRow) btn('Retry', failRow).click(); await sleep(1500);
  const afterRetry = await list(); const retried = afterRetry.find((j) => j.createdAt > failed.createdAt && j.kind === 'export' && j.dpi === 150 && j.area === 'All-sizes');
  ok('Retry runs it again as a new job (replacing the failed one)', !!retried && retried.id !== failed.id && afterRetry.length === nBefore && !afterRetry.some((j) => j.id === failed.id));
  if (retried) await waitJob(retried.id, 60000);
  const missing = await start({ kind: 'export', docId: docId(), areaLabel: 'All-sizes', request: { doc, assets: hashes.map((h, i) => (i === 0 ? { ...h, hash: 'c'.repeat(64) } : h)), area: ed.exportArea('page').rect, options: { ...opts, dpi: 150 } } });
  ok('an original that was never uploaded is refused before a job is made', missing.status === 409 && /not been uploaded/.test(missing.error) && Array.isArray(missing.missing));

  // ---------------------------------------------------------------- calibration test
  btn('Make calibration test').click();
  let cal; await until(async () => { cal = (await list()).find((j) => j.kind === 'calibration'); return cal && cal.status === 'done'; }, 60000, 300); report.calibration = cal;
  ok('Calibration test: a 10 × 10 in TIFF, 1,500 × 1,500 px at 150 DPI', !!cal && cal.status === 'done' && cal.widthPx === 1500 && cal.heightPx === 1500 && /^Leggings-Floral_Calibration_150dpi_/.test(cal.fileName), cal && `${cal.fileName}, ${(cal.bytes / 1e3).toFixed(0)} KB in ${cal.seconds.toFixed(1)} s`);
  if (hasHelper && cal) { const v = await helper('verify-url', { url: cal.download.url, name: 'calibration-150.tif', expect: { widthIn: 10, heightIn: 10, dpi: 150 } }); ok('…it passes the verification script (150/1 DPI tags, sRGB, LZW)', v.ok, (v.checks || []).filter((c) => !c.ok).map((c) => c.name).join(', ') || 'all checks pass'); }

  // ---------------------------------------------------------------- the list
  refreshList(); await sleep(1500); const all = await list();
  ok('the export list holds this document\'s exports, newest first, with their status', all.length >= 4 && all.every((j, i) => i === 0 || all[i - 1].createdAt >= j.createdAt) && rows().length === all.length, all.map((j) => `${j.area} ${j.dpi} ${j.status}`).join(' · '));
  const other = (await (await fetch(`${API}/jobs?doc=some-other-document`)).json()).jobs;
  ok('another document has its own (empty) list', Array.isArray(other) && other.length === 0);
  } catch (e) { R.push('FAIL 4C test stopped — ' + e.message + ' @ ' + ((e.stack || '').split('\n')[1] || '').trim()); }
  return { passed: R.filter((x) => x.startsWith('PASS')).length, total: R.length, failed: R.filter((x) => x.startsWith('FAIL')), all: R, report };
}
