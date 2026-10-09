"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, ImagePlus, Info, Minus, Plus, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { validateImage, SUPPORTED_IMAGE_LABEL, MAX_IMAGE_BYTES } from "@/lib/file-validation";
import { StitchLoader, useMinDuration } from "@/components/studio/StitchLoader";
import { prepareUpload, uploadFromDataUrl, type PreparedUpload } from "@/components/studio/prepare-upload";
import {
  EXTRACT_MAX_COUNT,
  EXTRACT_MIN_COUNT,
  EXTRACT_MODES,
  EXTRACT_SIZES,
  EXTRACT_UPLOAD_MAX_PX,
  REMOVE_CRAFT_HELP,
  TRANSPARENT_HELP,
  extractSizeForAspect,
  type ExtractMode,
  type ExtractSize,
} from "@/lib/graphic-extractor";
import {
  deleteGraphicExtractionAction,
  detectGraphicAction,
  extractGraphicAction,
  getGraphicExtractionAction,
  listGraphicExtractionsAction,
  reextractGraphicAction,
  type ExtractVersionRecord,
  type GraphicExtractionSummary,
} from "@/services/graphic-extractor";

/** The server calls this screen makes. Passed in so the screen can be exercised without the real AI. */
export interface GraphicExtractorActions {
  detect: typeof detectGraphicAction;
  extract: typeof extractGraphicAction;
  reextract: typeof reextractGraphicAction;
  get: typeof getGraphicExtractionAction;
  list: typeof listGraphicExtractionsAction;
  remove: typeof deleteGraphicExtractionAction;
}

const REAL_ACTIONS: GraphicExtractorActions = {
  detect: detectGraphicAction,
  extract: extractGraphicAction,
  reextract: reextractGraphicAction,
  get: getGraphicExtractionAction,
  list: listGraphicExtractionsAction,
  remove: deleteGraphicExtractionAction,
};

type Stage = "idle" | "detecting" | "extracting";
type SizeChoice = (typeof EXTRACT_SIZES)[number]["id"];

interface Found {
  kind: string;
  description: string;
  hasCraft: boolean;
}

/** A transparency checkerboard (theme-aware) so a cut-out graphic is visibly cut out. */
const CHECKERBOARD: React.CSSProperties = {
  backgroundImage: "conic-gradient(var(--soft) 25%, var(--surface) 0 50%, var(--soft) 0 75%, var(--surface) 0)",
  backgroundSize: "20px 20px",
};

function imageSizeOf(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = src;
  });
}

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-[11px] font-semibold text-primary-foreground">{n}</span>
      <span className="text-sm font-semibold text-foreground">{children}</span>
    </div>
  );
}

function Switch({ label, checked, onChange, disabled, help }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; help: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {label}
          <span title={help.join("\n")} className="text-muted-foreground" aria-hidden>
            <Info className="h-3.5 w-3.5" />
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50", checked ? "bg-primary" : "bg-border")}
        >
          <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
        </button>
      </div>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        {help.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
    </div>
  );
}

export function GraphicExtractorStudio({ openId, actions = REAL_ACTIONS }: { openId?: string; actions?: GraphicExtractorActions }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<PreparedUpload | null>(null);
  const [aspectSize, setAspectSize] = useState<ExtractSize>("1024x1024");
  const [removeCraft, setRemoveCraft] = useState(false);
  const [transparent, setTransparent] = useState(false);
  const [mode, setMode] = useState<ExtractMode>("standard");
  const [sizeChoice, setSizeChoice] = useState<SizeChoice>("original");
  const [count, setCount] = useState(1);
  const [stage, setStage] = useState<Stage>("idle");
  const [extractionId, setExtractionId] = useState<string | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [versions, setVersions] = useState<ExtractVersionRecord[]>([]);
  const [shown, setShown] = useState(0);
  const [tab, setTab] = useState<"current" | "history">("current");
  const [history, setHistory] = useState<GraphicExtractionSummary[] | null>(null);
  const [loading, setLoading] = useState(Boolean(openId));
  const [dragOver, setDragOver] = useState(false);

  const busy = stage !== "idle";
  const busyShown = useMinDuration(busy);
  const current = versions[shown] ?? null;
  const size: ExtractSize = EXTRACT_SIZES.find((s) => s.id === sizeChoice)?.size ?? aspectSize;

  const open = useCallback(
    async (id: string) => {
      setLoading(true);
      const result = await actions.get(id);
      if (!result.success) {
        setLoading(false);
        return void toast.error(result.error);
      }
      const d = result.data;
      let photo: PreparedUpload | null = null;
      try {
        photo = await uploadFromDataUrl(d.sourceImage, "style.jpg");
        const dims = await imageSizeOf(d.sourceImage);
        setAspectSize(extractSizeForAspect(dims.width, dims.height));
      } catch {
        // Viewing still works; Generate will ask for the photo again.
      }
      setUpload(photo);
      setExtractionId(d.id);
      setFound(d.description ? { kind: d.kind, description: d.description, hasCraft: d.hasCraft } : null);
      setVersions(d.versions);
      setShown(Math.max(0, d.versions.length - 1));
      const last = d.versions[d.versions.length - 1];
      if (last) {
        setRemoveCraft(last.removeCraft);
        setTransparent(last.transparent);
        setMode(last.mode);
        setCount(last.count);
      }
      setTab("current");
      setLoading(false);
    },
    [actions]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads a saved extraction named in the URL; state is set when the server answers
    if (openId) void open(openId);
  }, [openId, open]);

  const loadHistory = useCallback(async () => {
    const result = await actions.list();
    if (result.success) setHistory(result.data);
    else toast.error(result.error);
  }, [actions]);

  /** A new photo means a new extraction: the earlier detection and results no longer apply. */
  function startFresh() {
    setExtractionId(null);
    setFound(null);
    setVersions([]);
    setShown(0);
  }

  async function addFile(files: FileList | File[]) {
    const file = Array.from(files)[0];
    if (!file) return;
    if (files.length > 1) toast.info("One style image at a time — the first one was used.");
    const check = validateImage(file.type, file.size, file.name);
    if (!check.valid) return void toast.error(`${file.name}: ${check.error}`);
    try {
      const prepared = await prepareUpload(file, EXTRACT_UPLOAD_MAX_PX);
      const dims = await imageSizeOf(prepared.dataUrl);
      setAspectSize(extractSizeForAspect(dims.width, dims.height));
      setUpload(prepared);
      startFresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That image couldn't be read.");
    }
  }

  function removeUpload() {
    setUpload(null);
    startFresh();
  }

  async function handleGenerate() {
    if (!upload) return void toast.error("Upload a style image.");
    const settings = { removeCraft, transparent, mode, size, count };

    // Same photo as the last run: only new extractions are needed, the detection is reused.
    if (extractionId) {
      setStage("extracting");
      const result = await actions.reextract(extractionId, settings);
      setStage("idle");
      if (!result.success) return void toast.error(result.error);
      setShown(versions.length);
      setVersions([...versions, result.data]);
      return void (result.data.warning ? toast.warning(result.data.warning) : toast.success("Graphic extracted"));
    }

    const form = new FormData();
    form.append("images", new File([upload.blob], upload.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
    setStage("detecting");
    const detected = await actions.detect(form);
    if (!detected.success) {
      setStage("idle");
      return void toast.error(detected.error);
    }
    const f: Found = { kind: detected.data.kind, description: detected.data.description, hasCraft: detected.data.hasCraft };
    setFound(f);

    form.set("removeCraft", String(removeCraft));
    form.set("transparent", String(transparent));
    form.set("mode", mode);
    form.set("size", size);
    form.set("count", String(count));
    form.set("description", f.description);
    form.set("kind", f.kind);
    form.set("hasCraft", String(f.hasCraft));
    setStage("extracting");
    const result = await actions.extract(form);
    setStage("idle");
    if (!result.success) return void toast.error(result.error);
    setExtractionId(result.data.id);
    setVersions([result.data.version]);
    setShown(0);
    setHistory(null);
    if (result.data.version.warning) toast.warning(result.data.version.warning);
    else toast.success("Graphic extracted");
  }

  function handleDownload(i: number) {
    if (!current) return;
    const a = document.createElement("a");
    a.href = current.images[i];
    a.download = `graphic-extract-${i + 1}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleDelete(item: GraphicExtractionSummary) {
    if (!window.confirm(`Delete "${item.name}" and its ${item.versions} run${item.versions === 1 ? "" : "s"}? This can't be undone.`)) return;
    const result = await actions.remove(item.id);
    if (!result.success) return void toast.error(result.error);
    setHistory((h) => (h ? h.filter((x) => x.id !== item.id) : h));
    if (item.id === extractionId) startFresh();
    toast.success("Extraction deleted");
  }

  const generateLabel = stage === "detecting" ? "Finding the graphic…" : stage === "extracting" ? "Extracting…" : extractionId ? "Extract again" : "Generate";
  const modeHint = EXTRACT_MODES.find((m) => m.id === mode)?.hint;

  return (
    <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
      {/* ------------------------------------------------------------ controls */}
      <div className="space-y-6">
        <section aria-label="Upload style image">
          <StepTitle n={1}>Upload Style Image</StepTitle>
          <p className="mb-2 text-xs text-muted-foreground">
            A product or reference photo that carries a graphic or pattern. {SUPPORTED_IMAGE_LABEL}, up to {MAX_IMAGE_BYTES / (1024 * 1024)}MB.
          </p>
          <div
            className={cn("relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-dashed", dragOver ? "border-primary bg-primary/5" : "border-border bg-soft/40")}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (!busy) void addFile(e.dataTransfer.files);
            }}
          >
            {upload ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the user's own upload */}
                <img src={upload.dataUrl} alt="Style reference" className="h-full w-full object-contain" />
                <button type="button" disabled={busy} aria-label="Remove style image" onClick={removeUpload} className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1 text-foreground shadow hover:bg-background disabled:opacity-50">
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} aria-label="Upload style image" className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary disabled:opacity-50">
                <ImagePlus className="h-7 w-7" />
                <span className="text-sm">Upload Style Image</span>
                <span className="text-xs">or drop it here</span>
              </button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={(e) => {
              if (e.target.files) void addFile(e.target.files);
              e.target.value = "";
            }}
          />
        </section>

        <section aria-label="Other parameters">
          <StepTitle n={2}>Other Parameters</StepTitle>
          <div className="space-y-3">
            <Switch label="Remove Craft" checked={removeCraft} onChange={setRemoveCraft} disabled={busy} help={REMOVE_CRAFT_HELP} />
            <Switch label="Background Transparent" checked={transparent} onChange={setTransparent} disabled={busy} help={[TRANSPARENT_HELP]} />
          </div>

          <label className="mt-4 block text-xs text-muted-foreground" htmlFor="extract-mode">
            Generation Mode
          </label>
          <select id="extract-mode" value={mode} disabled={busy} onChange={(e) => setMode(e.target.value as ExtractMode)} className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary disabled:opacity-50">
            {EXTRACT_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          {modeHint && <p className="mt-1 text-xs text-muted-foreground">{modeHint}</p>}

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground" htmlFor="extract-size">
                Image Size
              </label>
              <select id="extract-size" value={sizeChoice} disabled={busy} onChange={(e) => setSizeChoice(e.target.value as SizeChoice)} className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary disabled:opacity-50">
                {EXTRACT_SIZES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground" id="extract-count-label">
                Number of Images
              </span>
              <div className="mt-1 flex h-10 items-center justify-between rounded-xl border border-border bg-surface px-1" role="group" aria-labelledby="extract-count-label">
                <button type="button" aria-label="Fewer images" disabled={busy || count <= EXTRACT_MIN_COUNT} onClick={() => setCount((c) => c - 1)} className="flex size-8 items-center justify-center rounded-lg hover:bg-soft disabled:opacity-40">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="text-sm font-medium tabular-nums" data-extract-count>
                  {count}
                </span>
                <button type="button" aria-label="More images" disabled={busy || count >= EXTRACT_MAX_COUNT} onClick={() => setCount((c) => c + 1)} className="flex size-8 items-center justify-center rounded-lg hover:bg-soft disabled:opacity-40">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Up to {EXTRACT_MAX_COUNT} images at once. Each is a separate extraction, so you can pick the cleanest.</p>
        </section>

        <Button className="w-full" size="lg" onClick={handleGenerate} disabled={busy || !upload}>
          <Sparkles className="h-4 w-4" />
          {generateLabel}
        </Button>
        {!busy && !upload && <p className="-mt-3 text-center text-xs text-muted-foreground">Upload a style image to begin.</p>}
      </div>

      {/* ------------------------------------------------------------ result */}
      <div className="min-w-0">
        <div className="mb-4 inline-flex rounded-xl border border-border bg-card p-1 text-sm" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "current"} onClick={() => setTab("current")} className={cn("rounded-lg px-3 py-1.5 font-medium", tab === "current" ? "bg-primary/12 text-pri-text" : "text-muted-foreground hover:text-foreground")}>
            Current Task
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "history"}
            onClick={() => {
              setTab("history");
              if (!history) void loadHistory();
            }}
            className={cn("rounded-lg px-3 py-1.5 font-medium", tab === "history" ? "bg-primary/12 text-pri-text" : "text-muted-foreground hover:text-foreground")}
          >
            History
          </button>
        </div>

        {tab === "history" ? (
          <div role="tabpanel" aria-label="History">
            {!history ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Loading saved extractions…</p>
            ) : !history.length ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No saved extractions yet. Extract a graphic and it will appear here.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {history.map((item) => (
                  <div key={item.id} className="overflow-hidden rounded-[20px] border border-border bg-card" data-history-item>
                    <button type="button" onClick={() => void open(item.id)} className="block w-full text-left" title="Open this extraction">
                      <div className="flex aspect-[4/3] items-center justify-center" style={CHECKERBOARD}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- a stored result image */}
                        {item.latest ? <img src={item.latest} alt={`${item.name} — latest result`} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">No result</span>}
                      </div>
                      <div className="p-3">
                        <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.versions} run{item.versions === 1 ? "" : "s"} · {new Date(item.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </button>
                    <div className="flex justify-end border-t border-border px-2 py-1">
                      <button type="button" onClick={() => void handleDelete(item)} className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-soft hover:text-rose-ink" aria-label={`Delete ${item.name}`}>
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading extraction…</p>
        ) : !current && !busy ? (
          <div role="tabpanel" aria-label="Current task" className="mx-auto max-w-2xl text-center">
            <h2 className="mx-auto max-w-md text-xl font-semibold text-foreground">Detect and extract complete patterns from product or reference images.</h2>
            <div className="mt-6 overflow-hidden rounded-[20px] border border-border bg-soft/50">
              {/* eslint-disable-next-line @next/next/no-img-element -- a static illustration of the tool */}
              <img src="/garment-studio/graphic-extractor.jpg" alt="Example: a garment with a printed pattern on the left, the extracted pattern on the right" className="w-full" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Upload a photo with a print on it, choose your options, then generate.</p>
          </div>
        ) : (
          <div role="tabpanel" aria-label="Current task" className="grid gap-4 xl:grid-cols-[220px_1fr]">
            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Before · Style</p>
              {upload && (
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-border bg-soft/50">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the user's own upload */}
                  <img src={upload.dataUrl} alt="Style reference" className="h-full w-full object-contain" />
                </div>
              )}
              {found && (
                <div className="mt-3 space-y-2 text-xs">
                  {found.kind && <span className="inline-block rounded-full bg-sky px-2.5 py-1 font-medium capitalize text-sky-ink">{found.kind}</span>}
                  {found.hasCraft && !removeCraft && <p className="rounded-lg bg-butter px-2.5 py-2 text-butter-ink">Craft effects were detected on this graphic. Turn on Remove Craft for a flat print.</p>}
                  <details className="rounded-xl border border-border p-2">
                    <summary className="cursor-pointer font-medium text-foreground">Graphic found by the AI</summary>
                    <p className="mt-2 whitespace-pre-wrap text-muted-foreground" data-analysis>
                      {found.description}
                    </p>
                  </details>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                After · {current ? `${current.images.length} image${current.images.length === 1 ? "" : "s"}${current.removeCraft ? " · craft removed" : ""}${current.transparent ? " · transparent" : ""}` : "Extracted graphic"}
              </p>
              {busyShown ? (
                <div className="flex min-h-72 items-center justify-center rounded-[20px] border border-border bg-surface">
                  <StitchLoader className="py-16" label={stage === "detecting" ? "Finding the graphic…" : `Extracting ${count} image${count === 1 ? "" : "s"}… this takes about a minute.`} />
                </div>
              ) : current ? (
                <div className={cn("grid gap-3", current.images.length > 1 ? "sm:grid-cols-2" : "")} data-results>
                  {current.images.map((src, i) => (
                    <div key={i} className="relative flex items-center justify-center overflow-hidden rounded-[20px] border border-border" style={current.transparent ? CHECKERBOARD : undefined}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- a generated result (a data URL) */}
                      <img src={src} alt={`Extracted graphic ${i + 1}`} className={cn("max-h-[60vh] max-w-full object-contain", !current.transparent && "bg-white")} data-result />
                      <button type="button" onClick={() => handleDownload(i)} aria-label={`Download extracted graphic ${i + 1}`} className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 text-foreground shadow hover:bg-background">
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {current && !busy && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleGenerate}>
                    <RefreshCw className="h-3.5 w-3.5" /> Extract again
                  </Button>
                  <span className="text-xs text-muted-foreground">Extract again uses the options chosen on the left.</span>
                </div>
              )}

              {versions.length > 1 && (
                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Runs ({versions.length})</p>
                  <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Runs">
                    {versions.map((v, i) => (
                      <button key={v.id} type="button" role="listitem" onClick={() => setShown(i)} aria-current={i === shown} className={cn("h-20 w-20 shrink-0 overflow-hidden rounded-xl border", i === shown ? "border-primary ring-2 ring-primary/30" : "border-border")} style={v.transparent ? CHECKERBOARD : undefined} title={`Run ${i + 1}: ${v.images.length} image${v.images.length === 1 ? "" : "s"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- a generated result (a data URL) */}
                        <img src={v.images[0]} alt={`Run ${i + 1}`} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
