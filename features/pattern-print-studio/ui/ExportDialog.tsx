"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CircleCheck, Loader2, OctagonAlert, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Editor, EditorState, PreflightIssue } from "../engine/Editor";
import { requestPreview, requestTiff, saveBlob, uploadOriginals, type PreviewResult } from "../export/client";
import { BUILT_IN_PRESETS, clampDpi, DEFAULT_EXPORT, DPI_MAX, DPI_MIN, estimateExport, exportFileName, formatBytes, formatDuration, type AreaKind, type ExportOptions, type ExportPreset } from "../export/options";
import { usedAssets } from "../export/scene";
import { formatUnits, UNIT_LABEL } from "../engine/units";

const PRESET_KEY = "pps-export-presets";
const field = "h-7 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary";

function loadUserPresets(): ExportPreset[] {
  try {
    const list = JSON.parse(localStorage.getItem(PRESET_KEY) ?? "[]") as ExportPreset[];
    return Array.isArray(list) ? list.filter((p) => p && typeof p.name === "string" && p.options) : [];
  } catch {
    return [];
  }
}

function IssueList({ title, issues, tone, onShow }: { title: string; issues: PreflightIssue[]; tone: "error" | "warning"; onShow: (i: PreflightIssue) => void }) {
  if (!issues.length) return null;
  const Icon = tone === "error" ? OctagonAlert : TriangleAlert;
  return (
    <div className="grid gap-0.5" role="list" aria-label={title}>
      <span className={cn("flex items-center gap-1.5 font-medium", tone === "error" ? "text-red-600" : "text-amber-600")}>
        <Icon className="h-3.5 w-3.5" /> {title} ({issues.length})
      </span>
      {issues.map((issue, n) => (
        <button key={n} type="button" role="listitem" data-kind={issue.kind} className="rounded px-1 py-0.5 text-left hover:bg-accent" title="Close this dialog and zoom to the piece" onClick={() => onShow(issue)}>
          <span className="font-medium text-foreground">{issue.label}</span> <span className="text-muted-foreground">{issue.message}</span>
        </button>
      ))}
    </div>
  );
}

function ExportBody({ editor, state, api, onClose }: { editor: Editor; state: EditorState; api: string; onClose: () => void }) {
  const unit = state.settings.units;
  // The document cannot change while this dialog is open, so the areas are worked out once.
  const areas = useMemo(() => editor.exportAreas(), [editor]);
  const [userPresets, setUserPresets] = useState<ExportPreset[]>(loadUserPresets);
  const presets = [...BUILT_IN_PRESETS, ...userPresets];
  const [presetId, setPresetId] = useState(BUILT_IN_PRESETS[0].id);
  const [opts, setOpts] = useState<ExportOptions>(BUILT_IN_PRESETS[0].options);
  const [kind, setKind] = useState<AreaKind>("page");
  const [sizes, setSizes] = useState<string[]>([]);
  const [dpiText, setDpiText] = useState<string | null>(null);
  const [anyway, setAnyway] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const area = useMemo(() => editor.exportArea(kind, sizes), [editor, kind, sizes]);
  // Pre-flight runs as soon as the dialog opens, and again when the area or DPI changes.
  const flight = useMemo(() => (area ? editor.exportPreflight(area.rect, opts.dpi) : null), [editor, area, opts.dpi]);
  const est = area ? estimateExport(area.rect, opts) : null;
  const blocked = !area || !flight?.canExport;
  const needsConfirm = !!flight?.warnings.length && !anyway;

  const change = (patch: Partial<ExportOptions>) => {
    setOpts((o) => ({ ...o, ...patch }));
    setPresetId("custom");
    setPreview(null);
  };
  const pickPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    setPresetId(id);
    if (p) setOpts({ ...DEFAULT_EXPORT, ...p.options, format: opts.format });
    setPreview(null);
  };
  const savePreset = () => {
    const name = window.prompt("Name for this preset:", `${opts.dpi} DPI${opts.mirror ? " mirrored" : ""}`)?.trim();
    if (!name) return;
    const preset: ExportPreset = { id: `user-${Date.now()}`, name, options: opts };
    const next = [...userPresets.filter((p) => p.name !== name), preset];
    setUserPresets(next);
    setPresetId(preset.id);
    try {
      localStorage.setItem(PRESET_KEY, JSON.stringify(next));
    } catch {
      /* private mode: the preset lasts until the page is closed */
    }
  };
  const setArea = (k: AreaKind, s = sizes) => {
    setKind(k);
    setSizes(s);
    setPreview(null);
    setAnyway(false);
  };
  const show = (issue: PreflightIssue) => {
    onClose();
    editor.showIssue(issue);
  };

  async function makePreview() {
    if (!area) return;
    abort.current?.abort();
    const ctl = (abort.current = new AbortController());
    setError(null);
    setPreview(null);
    try {
      const { doc, assets } = editor.exportDocument();
      const used = usedAssets(doc);
      setBusy(used.length ? "Sending original images…" : "Rendering…");
      const list = await uploadOriginals(api, assets, used, (done, total) => setBusy(`Sending original images… ${done}/${total}`));
      setBusy("Rendering…");
      const result = await requestPreview(api, { doc, assets: list, area: area.rect, options: opts }, ctl.signal);
      if (!ctl.signal.aborted) setPreview(result);
    } catch (err) {
      if (!ctl.signal.aborted) setError(err instanceof Error ? err.message : "The preview could not be made.");
    } finally {
      if (!ctl.signal.aborted) setBusy(null);
    }
  }

  /** Step 4B: a real TIFF from the export renderer at 40 DPI, to check sizes and correctness before full resolution is switched on. */
  const TEST_DPI = 40;
  const [testing, setTesting] = useState<string | null>(null);
  const [tested, setTested] = useState<string | null>(null);
  async function testExport() {
    if (!area) return;
    setError(null);
    setTested(null);
    try {
      const { doc, assets } = editor.exportDocument();
      const used = usedAssets(doc);
      setTesting("Sending original images…");
      const list = await uploadOriginals(api, assets, used);
      setTesting("Rendering the TIFF…");
      const name = exportFileName(state.docName, area.label, TEST_DPI, new Date(), "tiff");
      const out = await requestTiff(api, { doc, assets: list, area: area.rect, options: { ...opts, format: "tiff", dpi: TEST_DPI }, fileName: name });
      saveBlob(out.blob, name);
      setTested(`${name} — ${out.info.width} × ${out.info.height} px, ${formatBytes(out.info.bytes)}, made in ${(out.info.ms / 1000).toFixed(1)} s`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The export could not be made.");
    } finally {
      setTesting(null);
    }
  }

  const fileName = area ? exportFileName(state.docName, area.label, opts.dpi, new Date(), opts.format) : "";
  const dpiShown = dpiText ?? String(opts.dpi);

  return (
    <DialogContent className="sm:max-w-5xl">
      <DialogHeader>
        <DialogTitle>Export for production</DialogTitle>
        <DialogDescription>A print-ready file at exact size, made on the server from the original images. RGB (sRGB).</DialogDescription>
      </DialogHeader>

      <div className="grid max-h-[70vh] gap-4 overflow-y-auto text-xs md:grid-cols-[320px_1fr]">
        <div className="grid content-start gap-3">
          <fieldset className="grid gap-1.5" aria-label="Format">
            <legend className="mb-1 font-medium text-foreground">Format</legend>
            <div className="flex gap-3">
              <label className="flex items-center gap-1.5">
                <input type="radio" name="pps-export-format" checked={opts.format === "tiff"} onChange={() => change({ format: "tiff" })} /> TIFF (print-ready)
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="pps-export-format" checked={opts.format === "pdf"} onChange={() => change({ format: "pdf" })} /> PDF (editable)
              </label>
            </div>
          </fieldset>

          <fieldset className="grid gap-1.5" aria-label="Area">
            <legend className="mb-1 font-medium text-foreground">Area</legend>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="pps-export-area" checked={kind === "page"} onChange={() => setArea("page")} /> Whole page
            </label>
            <label className={cn("flex items-center gap-1.5", !areas.sizes.length && "opacity-50")}>
              <input type="radio" name="pps-export-area" disabled={!areas.sizes.length} checked={kind === "sizes"} onChange={() => setArea("sizes", sizes.length ? sizes : areas.sizes.slice(0, 1).map((s) => s.size))} /> Selected size(s)
              {!areas.sizes.length && <span className="text-muted-foreground">— tag the pieces first (Pieces tab)</span>}
            </label>
            {kind === "sizes" && (
              <div className="ml-5 flex flex-wrap gap-x-3 gap-y-1" role="group" aria-label="Sizes">
                {areas.sizes.map((s) => (
                  <label key={s.size} className="flex items-center gap-1" title={`${s.pieces} piece${s.pieces === 1 ? "" : "s"}`}>
                    <input type="checkbox" checked={sizes.includes(s.size)} onChange={(e) => setArea("sizes", e.target.checked ? [...sizes, s.size] : sizes.filter((x) => x !== s.size))} /> {s.size}
                  </label>
                ))}
              </div>
            )}
            <label className={cn("flex items-center gap-1.5", !areas.selection && "opacity-50")}>
              <input type="radio" name="pps-export-area" disabled={!areas.selection} checked={kind === "selection"} onChange={() => setArea("selection")} /> Selected objects
              {!areas.selection && <span className="text-muted-foreground">— nothing is selected</span>}
            </label>
          </fieldset>

          <div className="grid gap-1.5">
            <span className="font-medium text-foreground">Preset</span>
            <div className="flex gap-1.5">
              <select aria-label="Preset" value={presetId} onChange={(e) => pickPreset(e.target.value)} className={cn(field, "min-w-0 flex-1")}>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                {presetId === "custom" && <option value="custom">Custom settings</option>}
              </select>
              <Button size="sm" variant="outline" onClick={savePreset}>
                Save as preset
              </Button>
            </div>
          </div>

          <div className="grid gap-1.5" role="group" aria-label="Options">
            <span className="font-medium text-foreground">Options</span>
            <label className="flex items-center gap-2">
              <span className="w-24 text-muted-foreground">DPI</span>
              <select aria-label="DPI" value={opts.dpi === 150 || opts.dpi === 300 ? String(opts.dpi) : "custom"} onChange={(e) => e.target.value !== "custom" && change({ dpi: Number(e.target.value) })} className={field}>
                <option value="150">150</option>
                <option value="300">300</option>
                <option value="custom">Custom</option>
              </select>
              <input
                aria-label="Custom DPI"
                value={dpiShown}
                inputMode="numeric"
                onChange={(e) => setDpiText(e.target.value)}
                onBlur={() => {
                  const v = clampDpi(parseFloat(dpiShown));
                  setDpiText(null);
                  if (v !== null && v !== opts.dpi) change({ dpi: v });
                }}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className={cn(field, "w-16 text-right font-mono")}
                title={`${DPI_MIN}–${DPI_MAX}`}
              />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={opts.mirror} onChange={(e) => change({ mirror: e.target.checked })} /> Mirror (flip left-right)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={opts.cutLines} onChange={(e) => change({ cutLines: e.target.checked })} /> Include cut lines
              <input
                aria-label="Cut line width in points"
                key={opts.cutLineWidthPt}
                defaultValue={opts.cutLineWidthPt}
                disabled={!opts.cutLines}
                inputMode="decimal"
                onBlur={(e) => {
                  const v = parseFloat(e.target.value);
                  if (v > 0 && v <= 20 && v !== opts.cutLineWidthPt) change({ cutLineWidthPt: v });
                }}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className={cn(field, "w-14 text-right font-mono disabled:opacity-40")}
              />
              <span className="text-muted-foreground">pt</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={opts.sizeLabels} onChange={(e) => change({ sizeLabels: e.target.checked })} /> Include size labels
            </label>
            <label className="flex items-center gap-2">
              <span className="w-24 text-muted-foreground">Background</span>
              <select aria-label="Background" value={opts.background} onChange={(e) => change({ background: e.target.value as ExportOptions["background"] })} className={field}>
                <option value="white">White</option>
                <option value="transparent">Transparent</option>
              </select>
            </label>
            <span className="text-muted-foreground">Bleed is always included, as set in the Checks tab ({formatUnits(state.settings.bleed.amount, unit)} {UNIT_LABEL[unit]}).</span>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-md border border-border p-2" aria-label="Export info">
            {area && est ? (
              <>
                <dt className="text-muted-foreground">Size</dt>
                <dd className="font-mono" data-info="inches">
                  {formatUnits(area.rect.w, "in")} × {formatUnits(area.rect.h, "in")} in
                </dd>
                <dt className="text-muted-foreground">Pixels</dt>
                <dd className="font-mono" data-info="pixels">
                  {est.width.toLocaleString("en-US")} × {est.height.toLocaleString("en-US")} px
                </dd>
                <dt className="text-muted-foreground">File size</dt>
                <dd data-info="bytes">
                  about {formatBytes(est.fileBytes)} <span className="text-muted-foreground">({formatBytes(est.rawBytes)} uncompressed{est.bigTiff && opts.format === "tiff" ? ", BigTIFF" : ""})</span>
                </dd>
                <dt className="text-muted-foreground">Time</dt>
                <dd data-info="time">about {formatDuration(est.seconds)}</dd>
                <dt className="text-muted-foreground">File name</dt>
                <dd className="break-all font-mono" data-info="name">
                  {fileName}
                </dd>
              </>
            ) : (
              <dd className="col-span-2 text-muted-foreground">{kind === "sizes" ? "Tick at least one size." : "Nothing to export in this area."}</dd>
            )}
          </dl>
        </div>

        <div className="grid content-start gap-3">
          <section className="grid gap-2 rounded-md border border-border p-2" aria-label="Pre-flight">
            <span className="font-medium text-foreground">Pre-flight</span>
            {flight && !flight.errors.length && !flight.warnings.length && (
              <p className="flex items-center gap-1.5 text-emerald-600" role="status">
                <CircleCheck className="h-3.5 w-3.5" /> No problems found in this area.
              </p>
            )}
            {flight && <IssueList title="Must be fixed before export" issues={flight.errors} tone="error" onShow={show} />}
            {flight && <IssueList title="Warnings" issues={flight.warnings} tone="warning" onShow={show} />}
            {flight && flight.canExport && flight.warnings.length > 0 && (
              <label className="flex items-center gap-2 border-t border-border pt-2">
                <input type="checkbox" checked={anyway} onChange={(e) => setAnyway(e.target.checked)} /> Export anyway — I have checked these warnings
              </label>
            )}
          </section>

          <section className="grid gap-2 rounded-md border border-border p-2" aria-label="Preview">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">Preview</span>
              <Button size="sm" variant="outline" disabled={!area || !!busy} onClick={makePreview}>
                {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                {preview ? "Refresh preview" : "Preview"}
              </Button>
              {busy && <span className="text-muted-foreground">{busy}</span>}
              {preview && !busy && (
                <span className="text-muted-foreground" data-preview-info>
                  {preview.width} × {preview.height} px at {Math.round(preview.dpi)} DPI · made in {(preview.ms / 1000).toFixed(1)} s by the export renderer
                </span>
              )}
            </div>
            {error && (
              <p className="text-red-600" role="alert">
                {error}
              </p>
            )}
            {preview?.warnings.map((w, i) => (
              <p key={i} className="text-amber-600">
                {w}
              </p>
            ))}
            <div className="flex min-h-40 items-center justify-center overflow-auto rounded border border-border p-2" style={{ background: "repeating-conic-gradient(#e5e7eb 0% 25%, #f9fafb 0% 50%) 50% / 16px 16px" }}>
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- a data: URL made for this dialog; next/image has nothing to optimise
                <img src={preview.image} alt="Export preview" width={preview.width} height={preview.height} className="h-auto max-h-[46vh] w-auto max-w-full shadow-sm" />
              ) : (
                <span className="rounded bg-background/80 px-2 py-1 text-muted-foreground">{busy ?? "Press Preview to see exactly what will be exported (low resolution)."}</span>
              )}
            </div>
          </section>
        </div>
      </div>

      <DialogFooter>
        <span className="mr-auto self-center text-xs text-muted-foreground" role="status" data-export-status>
          {testing ?? (tested ? `Downloaded ${tested}` : blocked ? (area ? "Fix the problems marked in red to export." : "Choose an area to export.") : needsConfirm ? "Tick “Export anyway” to export with warnings." : "Ready. Full-size export (150 / 300 DPI) arrives in step 4C; the 40 DPI test file uses the same renderer.")}
        </span>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button variant="outline" disabled={blocked || needsConfirm || !!testing || opts.format !== "tiff"} onClick={testExport} title="A real TIFF from the export renderer, at 40 DPI, to check sizes and correctness">
          {testing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          Test export at 40 DPI
        </Button>
        <Button disabled title="Full-size export is built in step 4C">
          Export {opts.format === "pdf" ? "PDF" : "TIFF"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/** File → Export (Ctrl+E). */
export function ExportDialog({ open, onOpenChange, editor, state, api }: { open: boolean; onOpenChange: (o: boolean) => void; editor: Editor; state: EditorState; api: string }) {
  // The body only mounts while open, so it starts fresh (and re-runs pre-flight) every time.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <ExportBody editor={editor} state={state} api={api} onClose={() => onOpenChange(false)} />}
    </Dialog>
  );
}
