"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Download, ImagePlus, Loader2, RefreshCw, Search, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { validateImage, SUPPORTED_IMAGE_LABEL, MAX_IMAGE_BYTES } from "@/lib/file-validation";
import { HIT_DEFAULT_GRID, HIT_MAX_GRID, HIT_MAX_IMAGES, HIT_MIN_GRID, HIT_OUTPUT_FORMATS, HIT_STYLE_CATEGORIES, HIT_UPLOAD_MAX_PX, type HitOutputFormat, type HitStyleCategory } from "@/lib/hit-collection";
import {
  analyzeBestsellerAction,
  deleteHitCollectionAction,
  generateHitCollectionAction,
  getHitCollectionAction,
  listHitCollectionsAction,
  regenerateHitCollectionAction,
  type HitCollectionSummary,
  type HitCollectionVersionRecord,
} from "@/services/hit-collection";

/** The server calls this screen makes. Passed in so the screen can be exercised without the real AI. */
export interface HitCollectionActions {
  analyze: typeof analyzeBestsellerAction;
  generate: typeof generateHitCollectionAction;
  regenerate: typeof regenerateHitCollectionAction;
  get: typeof getHitCollectionAction;
  list: typeof listHitCollectionsAction;
  remove: typeof deleteHitCollectionAction;
}

const REAL_ACTIONS: HitCollectionActions = {
  analyze: analyzeBestsellerAction,
  generate: generateHitCollectionAction,
  regenerate: regenerateHitCollectionAction,
  get: getHitCollectionAction,
  list: listHitCollectionsAction,
  remove: deleteHitCollectionAction,
};

interface Upload {
  id: string;
  /** What is sent to the server and shown as the thumbnail: the photo reduced to at most 1536 px, as JPEG. */
  dataUrl: string;
  blob: Blob;
  name: string;
}

type Stage = "idle" | "analyzing" | "generating";

/** Reduces a photo to at most `HIT_UPLOAD_MAX_PX` on its long side, on white, as JPEG — nine of them stay well inside the request limit. */
async function prepareUpload(file: File): Promise<Upload> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`"${file.name}" couldn't be read as an image.`));
      img.src = url;
    });
    const scale = Math.min(1, HIT_UPLOAD_MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser can't prepare images.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The image couldn't be prepared."))), "image/jpeg", 0.92));
    return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, dataUrl: canvas.toDataURL("image/jpeg", 0.92), blob, name: file.name };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function uploadFromDataUrl(dataUrl: string, index: number): Promise<Upload> {
  const blob = await (await fetch(dataUrl)).blob();
  return { id: `saved-${index}`, dataUrl, blob, name: `bestseller-${index + 1}.jpg` };
}

function StepTitle({ n, children, aside }: { n: number; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-[11px] font-semibold text-primary-foreground">{n}</span>
      <span className="text-sm font-semibold text-foreground">{children}</span>
      {aside && <span className="ml-auto text-xs text-muted-foreground">{aside}</span>}
    </div>
  );
}

export function HitCollectionStudio({ openId, actions = REAL_ACTIONS }: { openId?: string; actions?: HitCollectionActions }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [category, setCategory] = useState<HitStyleCategory | null>(null);
  const [pickingCategory, setPickingCategory] = useState(false);
  const [search, setSearch] = useState("");
  const [format, setFormat] = useState<HitOutputFormat>("on-model");
  const [grid, setGrid] = useState(HIT_DEFAULT_GRID);
  const [stage, setStage] = useState<Stage>("idle");
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [versions, setVersions] = useState<HitCollectionVersionRecord[]>([]);
  const [shown, setShown] = useState(0);
  const [tab, setTab] = useState<"current" | "history">("current");
  const [history, setHistory] = useState<HitCollectionSummary[] | null>(null);
  const [loading, setLoading] = useState(Boolean(openId));
  const [dragOver, setDragOver] = useState(false);

  const busy = stage !== "idle";
  const current = versions[shown] ?? null;

  const open = useCallback(
    async (id: string) => {
      setLoading(true);
      const result = await actions.get(id);
      if (!result.success) {
        setLoading(false);
        return void toast.error(result.error);
      }
      const d = result.data;
      // The stored photos are turned back into uploads first, so everything below is set in one go.
      let photos: Upload[] = [];
      try {
        photos = await Promise.all(d.sourceImages.map(uploadFromDataUrl));
      } catch {
        // Viewing still works; Generate will ask for the photos again.
      }
      setUploads(photos);
      setProposalId(d.id);
      setCategory(d.styleCategory);
      setAnalysis(d.analysis);
      setVersions(d.versions);
      setShown(Math.max(0, d.versions.length - 1));
      const last = d.versions[d.versions.length - 1];
      if (last) {
        setFormat(last.outputFormat);
        setGrid(last.gridCount);
      }
      setTab("current");
      setLoading(false);
    },
    [actions]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads a saved collection named in the URL; state is set when the server answers
    if (openId) void open(openId);
  }, [openId, open]);

  const loadHistory = useCallback(async () => {
    const result = await actions.list();
    if (result.success) setHistory(result.data);
    else toast.error(result.error);
  }, [actions]);

  /** New photos or a new category mean a new collection: the earlier analysis and results no longer apply. */
  function startFresh() {
    setProposalId(null);
    setAnalysis(null);
    setVersions([]);
    setShown(0);
  }

  async function addFiles(files: FileList | File[]) {
    const room = HIT_MAX_IMAGES - uploads.length;
    const list = Array.from(files);
    if (!list.length) return;
    if (list.length > room) toast.info(`Only ${HIT_MAX_IMAGES} images can be used — the first ${Math.max(0, room)} were added.`);
    const added: Upload[] = [];
    for (const file of list.slice(0, Math.max(0, room))) {
      const check = validateImage(file.type, file.size, file.name);
      if (!check.valid) {
        toast.error(`${file.name}: ${check.error}`);
        continue;
      }
      try {
        added.push(await prepareUpload(file));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "That image couldn't be read.");
      }
    }
    if (!added.length) return;
    setUploads((u) => [...u, ...added]);
    startFresh();
  }

  function removeUpload(id: string) {
    setUploads((u) => u.filter((x) => x.id !== id));
    startFresh();
  }

  function chooseCategory(c: HitStyleCategory) {
    if (c !== category) startFresh();
    setCategory(c);
    setPickingCategory(false);
    setSearch("");
  }

  async function handleGenerate() {
    if (!uploads.length) return void toast.error("Upload at least one bestseller image.");
    if (!category) return void toast.error("Choose a style category.");

    // Same photos and category as the last result: only a new sheet is needed, the analysis is reused.
    if (proposalId) {
      setStage("generating");
      const result = await actions.regenerate(proposalId, format, grid);
      setStage("idle");
      if (!result.success) return void toast.error(result.error);
      setShown(versions.length);
      setVersions([...versions, result.data]);
      return void toast.success("New variations generated");
    }

    const form = new FormData();
    for (const u of uploads) form.append("images", new File([u.blob], u.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
    form.set("styleCategory", category);
    setStage("analyzing");
    const read = await actions.analyze(form);
    if (!read.success) {
      setStage("idle");
      return void toast.error(read.error);
    }
    setAnalysis(read.data);

    form.set("outputFormat", format);
    form.set("gridCount", String(grid));
    form.set("analysis", read.data);
    setStage("generating");
    const result = await actions.generate(form);
    setStage("idle");
    if (!result.success) return void toast.error(result.error);
    setProposalId(result.data.id);
    setVersions([result.data.version]);
    setShown(0);
    setHistory(null);
    toast.success("Collection variations generated");
  }

  function handleDownload() {
    if (!current) return;
    const a = document.createElement("a");
    a.href = current.image;
    a.download = `hit-collection-${(category ?? "collection").toLowerCase()}-${current.gridCount}-variations.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleDelete(item: HitCollectionSummary) {
    if (!window.confirm(`Delete "${item.name}" and its ${item.versions} result${item.versions === 1 ? "" : "s"}? This can't be undone.`)) return;
    const result = await actions.remove(item.id);
    if (!result.success) return void toast.error(result.error);
    setHistory((h) => (h ? h.filter((x) => x.id !== item.id) : h));
    if (item.id === proposalId) startFresh();
    toast.success("Collection deleted");
  }

  const categories = HIT_STYLE_CATEGORIES.filter((c) => c.toLowerCase().includes(search.trim().toLowerCase()));
  const generateLabel = stage === "analyzing" ? "Reading the bestseller…" : stage === "generating" ? "Designing variations…" : proposalId ? "Generate again" : "Generate";
  const formatHint = HIT_OUTPUT_FORMATS.find((f) => f.id === format)?.hint;

  return (
    <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
      {/* ------------------------------------------------------------ controls */}
      <div className="space-y-6">
        <section aria-label="Upload bestseller images">
          <StepTitle n={1} aside={`(${uploads.length}/${HIT_MAX_IMAGES})`}>
            Upload Bestseller Images
          </StepTitle>
          <p className="mb-2 text-xs text-muted-foreground">
            1–{HIT_MAX_IMAGES} photos of the same bestselling style. {SUPPORTED_IMAGE_LABEL}, up to {MAX_IMAGE_BYTES / (1024 * 1024)}MB each.
          </p>
          <div
            className={cn("grid grid-cols-4 gap-2 rounded-xl border border-dashed p-2", dragOver ? "border-primary bg-primary/5" : "border-border")}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (!busy) void addFiles(e.dataTransfer.files);
            }}
          >
            {uploads.map((u, i) => (
              <div key={u.id} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the user's own upload */}
                <img src={u.dataUrl} alt={`Bestseller image ${i + 1}`} className="h-full w-full object-cover" />
                <button type="button" disabled={busy} aria-label={`Remove bestseller image ${i + 1}`} onClick={() => removeUpload(u.id)} className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 text-foreground shadow hover:bg-background disabled:opacity-50">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {uploads.length < HIT_MAX_IMAGES && (
              <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} aria-label="Add bestseller images" className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50">
                <ImagePlus className="h-5 w-5" />
                <span className="text-[10px]">Add</span>
              </button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <button
            type="button"
            disabled={!uploads.length || busy}
            aria-expanded={pickingCategory}
            onClick={() => setPickingCategory((v) => !v)}
            className="mt-3 flex w-full items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            title={uploads.length ? "Choose the style category" : "Upload an image first"}
          >
            <span className={category ? "font-medium text-foreground" : "text-muted-foreground"}>{category ?? "Select style category"}</span>
            <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", pickingCategory && "rotate-90")} />
          </button>
          {pickingCategory && (
            <div className="mt-2 rounded-lg border border-border bg-card p-3" role="dialog" aria-label="Style Category">
              <p className="mb-2 text-sm font-semibold text-foreground">Style Category</p>
              <label className="mb-2 flex items-center gap-2 rounded-md border border-border bg-background px-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Please enter" aria-label="Search style categories" className="h-8 w-full bg-transparent text-sm outline-none" autoFocus />
              </label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <button key={c} type="button" onClick={() => chooseCategory(c)} aria-pressed={c === category} className={cn("rounded-md border px-2.5 py-1 text-sm", c === category ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/40 text-foreground hover:bg-muted")}>
                    {c}
                  </button>
                ))}
                {!categories.length && <span className="text-xs text-muted-foreground">No category matches “{search}”.</span>}
              </div>
            </div>
          )}
        </section>

        <section aria-label="Output format">
          <StepTitle n={2}>Output Format</StepTitle>
          <label className="block text-xs text-muted-foreground" htmlFor="hit-output-format">
            Output Format
          </label>
          <select id="hit-output-format" value={format} disabled={busy} onChange={(e) => setFormat(e.target.value as HitOutputFormat)} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary disabled:opacity-50">
            {HIT_OUTPUT_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          {formatHint && <p className="mt-1 text-xs text-muted-foreground">{formatHint}</p>}
        </section>

        <section aria-label="Other parameters">
          <StepTitle n={3}>Other Parameters</StepTitle>
          <div className="flex items-center justify-between text-sm">
            <label htmlFor="hit-grid-count" className="text-muted-foreground">
              Grid Count
            </label>
            <span className="font-medium tabular-nums text-foreground" data-grid-count>
              {grid}
            </span>
          </div>
          <input id="hit-grid-count" type="range" min={HIT_MIN_GRID} max={HIT_MAX_GRID} step={1} value={grid} disabled={busy} onChange={(e) => setGrid(Number(e.target.value))} className="mt-1 w-full accent-primary disabled:opacity-50" />
          <p className="mt-1 text-xs text-muted-foreground">How many variations appear in the result, all in one image. More variations means each one is smaller.</p>
        </section>

        <Button className="w-full" onClick={handleGenerate} disabled={busy || !uploads.length || !category}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generateLabel}
        </Button>
        {!busy && (!uploads.length || !category) && <p className="-mt-3 text-center text-xs text-muted-foreground">{!uploads.length ? "Upload a bestseller image to begin." : "Choose a style category to continue."}</p>}
      </div>

      {/* ------------------------------------------------------------ result */}
      <div className="min-w-0">
        <div className="mb-4 inline-flex rounded-lg border border-border bg-card p-1 text-sm" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "current"} onClick={() => setTab("current")} className={cn("rounded-md px-3 py-1.5 font-medium", tab === "current" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
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
            className={cn("rounded-md px-3 py-1.5 font-medium", tab === "history" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            History
          </button>
        </div>

        {tab === "history" ? (
          <div role="tabpanel" aria-label="History">
            {!history ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Loading saved collections…</p>
            ) : !history.length ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No saved collections yet. Generate one and it will appear here.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {history.map((item) => (
                  <div key={item.id} className="overflow-hidden rounded-xl border border-border bg-card" data-history-item>
                    <button type="button" onClick={() => void open(item.id)} className="block w-full text-left" title="Open this collection">
                      <div className="flex aspect-[4/3] items-center justify-center bg-muted/30">
                        {/* eslint-disable-next-line @next/next/no-img-element -- a stored result image */}
                        {item.latest ? <img src={item.latest} alt={`${item.name} — latest result`} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">No result</span>}
                      </div>
                      <div className="p-2">
                        <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.styleCategory} · {item.versions} result{item.versions === 1 ? "" : "s"} · {new Date(item.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </button>
                    <div className="flex justify-end border-t border-border px-2 py-1">
                      <button type="button" onClick={() => void handleDelete(item)} className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-red-600" aria-label={`Delete ${item.name}`}>
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading collection…</p>
        ) : !current && !busy ? (
          <div role="tabpanel" aria-label="Current task" className="mx-auto max-w-2xl text-center">
            <h2 className="mx-auto max-w-md text-xl font-semibold text-foreground">Extend a bestseller into cohesive style variations while preserving its core design language.</h2>
            <div className="mt-6 overflow-hidden rounded-xl border border-border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element -- a static illustration of the tool */}
              <img src="/garment-studio/hit-collection.jpg" alt="Example: a bestseller on the left, style variations of it on the right" className="w-full" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Upload your bestseller, choose its category, then generate.</p>
          </div>
        ) : (
          <div role="tabpanel" aria-label="Current task" className="grid gap-4 xl:grid-cols-[220px_1fr]">
            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Before · Bestseller</p>
              <div className="grid grid-cols-3 gap-1.5 xl:grid-cols-2">
                {uploads.map((u, i) => (
                  <div key={u.id} className="aspect-square overflow-hidden rounded-lg border border-border bg-muted/30">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the user's own upload */}
                    <img src={u.dataUrl} alt={`Bestseller ${i + 1}`} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
              {analysis && (
                <details className="mt-3 rounded-lg border border-border p-2 text-xs">
                  <summary className="cursor-pointer font-medium text-foreground">Design language read by the AI</summary>
                  <p className="mt-2 whitespace-pre-wrap text-muted-foreground" data-analysis>
                    {analysis}
                  </p>
                </details>
              )}
            </div>
            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                After · {current ? `${current.gridCount} variation${current.gridCount === 1 ? "" : "s"} · ${HIT_OUTPUT_FORMATS.find((f) => f.id === current.outputFormat)?.label}` : "Variations"}
              </p>
              <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30">
                {busy ? (
                  <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground" role="status">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <p className="text-sm">{stage === "analyzing" ? "Reading the bestseller's design language…" : `Designing ${grid} variation${grid === 1 ? "" : "s"}… this takes about a minute.`}</p>
                  </div>
                ) : current ? (
                  // eslint-disable-next-line @next/next/no-img-element -- the generated result (a data URL)
                  <img src={current.image} alt={`${current.gridCount} style variations of the bestseller`} className="max-h-[70vh] max-w-full object-contain" data-result />
                ) : null}
              </div>

              {current && !busy && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleGenerate}>
                    <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                  <span className="text-xs text-muted-foreground">Regenerate uses the format and grid count chosen on the left.</span>
                </div>
              )}

              {versions.length > 1 && (
                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Results ({versions.length})</p>
                  <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Results">
                    {versions.map((v, i) => (
                      <button key={v.id} type="button" role="listitem" onClick={() => setShown(i)} aria-current={i === shown} className={cn("h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted/30", i === shown ? "border-primary ring-2 ring-primary/30" : "border-border")} title={`Result ${i + 1}: ${v.gridCount} variations`}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- a generated result (a data URL) */}
                        <img src={v.image} alt={`Result ${i + 1}`} className="h-full w-full object-cover" />
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
