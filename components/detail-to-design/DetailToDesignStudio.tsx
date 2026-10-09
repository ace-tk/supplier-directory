"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Download, ImagePlus, RefreshCw, Search, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { validateImage, SUPPORTED_IMAGE_LABEL, MAX_IMAGE_BYTES } from "@/lib/file-validation";
import { StitchLoader, useMinDuration } from "@/components/studio/StitchLoader";
import {
  DETAIL_DEFAULT_COUNT,
  DETAIL_MAX_COUNT,
  DETAIL_MIN_COUNT,
  DETAIL_OUTPUT_FORMATS,
  DETAIL_REFERENCE_IDEAS,
  DETAIL_REFERENCE_MAX_CHARS,
  DETAIL_STYLE_CATEGORIES,
  DETAIL_UPLOAD_MAX_PX,
  type DetailOutputFormat,
  type DetailStyleCategory,
} from "@/lib/detail-to-design";
import {
  analyzeDetailAction,
  deleteDetailDesignAction,
  generateDetailDesignAction,
  getDetailDesignAction,
  listDetailDesignsAction,
  regenerateDetailDesignAction,
  type DetailDesignSummary,
  type DetailDesignVersionRecord,
} from "@/services/detail-to-design";

/** The server calls this screen makes. Passed in so the screen can be exercised without the real AI. */
export interface DetailToDesignActions {
  analyze: typeof analyzeDetailAction;
  generate: typeof generateDetailDesignAction;
  regenerate: typeof regenerateDetailDesignAction;
  get: typeof getDetailDesignAction;
  list: typeof listDetailDesignsAction;
  remove: typeof deleteDetailDesignAction;
}

const REAL_ACTIONS: DetailToDesignActions = {
  analyze: analyzeDetailAction,
  generate: generateDetailDesignAction,
  regenerate: regenerateDetailDesignAction,
  get: getDetailDesignAction,
  list: listDetailDesignsAction,
  remove: deleteDetailDesignAction,
};

interface Upload {
  /** What is sent to the server and shown as the preview: the photo reduced to at most 1536 px, as JPEG. */
  dataUrl: string;
  blob: Blob;
  name: string;
}

type Stage = "idle" | "analyzing" | "generating";

/** Reduces a photo to at most `DETAIL_UPLOAD_MAX_PX` on its long side, on white, as JPEG. */
async function prepareUpload(file: File): Promise<Upload> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`"${file.name}" couldn't be read as an image.`));
      img.src = url;
    });
    const scale = Math.min(1, DETAIL_UPLOAD_MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
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
    return { dataUrl: canvas.toDataURL("image/jpeg", 0.92), blob, name: file.name };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function uploadFromDataUrl(dataUrl: string): Promise<Upload> {
  const blob = await (await fetch(dataUrl)).blob();
  return { dataUrl, blob, name: "detail.jpg" };
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

export function DetailToDesignStudio({ openId, actions = REAL_ACTIONS }: { openId?: string; actions?: DetailToDesignActions }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [reference, setReference] = useState("");
  const [category, setCategory] = useState<DetailStyleCategory | null>(null);
  const [pickingCategory, setPickingCategory] = useState(false);
  const [search, setSearch] = useState("");
  const [format, setFormat] = useState<DetailOutputFormat>("on-model");
  const [count, setCount] = useState(DETAIL_DEFAULT_COUNT);
  const [stage, setStage] = useState<Stage>("idle");
  const [designId, setDesignId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [versions, setVersions] = useState<DetailDesignVersionRecord[]>([]);
  const [shown, setShown] = useState(0);
  const [tab, setTab] = useState<"current" | "history">("current");
  const [history, setHistory] = useState<DetailDesignSummary[] | null>(null);
  const [loading, setLoading] = useState(Boolean(openId));
  const [dragOver, setDragOver] = useState(false);

  const busy = stage !== "idle";
  const busyShown = useMinDuration(busy);
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
      let photo: Upload | null = null;
      try {
        photo = await uploadFromDataUrl(d.sourceImage);
      } catch {
        // Viewing still works; Generate will ask for the photo again.
      }
      setUpload(photo);
      setDesignId(d.id);
      setCategory(d.styleCategory);
      setReference(d.referenceStyle);
      setAnalysis(d.analysis);
      setVersions(d.versions);
      setShown(Math.max(0, d.versions.length - 1));
      const last = d.versions[d.versions.length - 1];
      if (last) {
        setFormat(last.outputFormat);
        setCount(last.designCount);
      }
      setTab("current");
      setLoading(false);
    },
    [actions]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads a saved design named in the URL; state is set when the server answers
    if (openId) void open(openId);
  }, [openId, open]);

  const loadHistory = useCallback(async () => {
    const result = await actions.list();
    if (result.success) setHistory(result.data);
    else toast.error(result.error);
  }, [actions]);

  /** A new photo or a new category means a new design: the earlier analysis and results no longer apply. */
  function startFresh() {
    setDesignId(null);
    setAnalysis(null);
    setVersions([]);
    setShown(0);
  }

  async function addFile(files: FileList | File[]) {
    const file = Array.from(files)[0];
    if (!file) return;
    if (files.length > 1) toast.info("One detail image at a time — the first one was used.");
    const check = validateImage(file.type, file.size, file.name);
    if (!check.valid) return void toast.error(`${file.name}: ${check.error}`);
    try {
      setUpload(await prepareUpload(file));
      startFresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That image couldn't be read.");
    }
  }

  function removeUpload() {
    setUpload(null);
    startFresh();
  }

  function chooseCategory(c: DetailStyleCategory) {
    if (c !== category) startFresh();
    setCategory(c);
    setPickingCategory(false);
    setSearch("");
  }

  async function handleGenerate() {
    if (!upload) return void toast.error("Upload a detail image.");
    if (!category) return void toast.error("Choose a style category.");

    // Same photo and category as the last result: only a new sheet is needed, the analysis is reused.
    if (designId) {
      setStage("generating");
      const result = await actions.regenerate(designId, format, count, reference.trim());
      setStage("idle");
      if (!result.success) return void toast.error(result.error);
      setShown(versions.length);
      setVersions([...versions, result.data]);
      return void toast.success("New designs generated");
    }

    const form = new FormData();
    form.append("images", new File([upload.blob], upload.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
    form.set("styleCategory", category);
    setStage("analyzing");
    const read = await actions.analyze(form);
    if (!read.success) {
      setStage("idle");
      return void toast.error(read.error);
    }
    setAnalysis(read.data);

    form.set("outputFormat", format);
    form.set("designCount", String(count));
    form.set("referenceStyle", reference.trim());
    form.set("analysis", read.data);
    setStage("generating");
    const result = await actions.generate(form);
    setStage("idle");
    if (!result.success) return void toast.error(result.error);
    setDesignId(result.data.id);
    setVersions([result.data.version]);
    setShown(0);
    setHistory(null);
    toast.success("Designs generated");
  }

  function handleDownload() {
    if (!current) return;
    const a = document.createElement("a");
    a.href = current.image;
    a.download = `detail-to-design-${(category ?? "designs").toLowerCase()}-${current.designCount}-concepts.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleDelete(item: DetailDesignSummary) {
    if (!window.confirm(`Delete "${item.name}" and its ${item.versions} result${item.versions === 1 ? "" : "s"}? This can't be undone.`)) return;
    const result = await actions.remove(item.id);
    if (!result.success) return void toast.error(result.error);
    setHistory((h) => (h ? h.filter((x) => x.id !== item.id) : h));
    if (item.id === designId) startFresh();
    toast.success("Detail design deleted");
  }

  const categories = DETAIL_STYLE_CATEGORIES.filter((c) => c.toLowerCase().includes(search.trim().toLowerCase()));
  const generateLabel = stage === "analyzing" ? "Reading the detail…" : stage === "generating" ? "Designing concepts…" : designId ? "Generate again" : "Generate";
  const formatHint = DETAIL_OUTPUT_FORMATS.find((f) => f.id === format)?.hint;

  return (
    <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
      {/* ------------------------------------------------------------ controls */}
      <div className="space-y-6">
        <section aria-label="Upload detail image">
          <StepTitle n={1}>Upload Detail Image</StepTitle>
          <p className="mb-2 text-xs text-muted-foreground">
            A close-up of one detail — a neckline, sleeve, pocket, collar, cuff or trim. {SUPPORTED_IMAGE_LABEL}, up to {MAX_IMAGE_BYTES / (1024 * 1024)}MB.
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
                <img src={upload.dataUrl} alt="Detail reference" className="h-full w-full object-contain" />
                <button type="button" disabled={busy} aria-label="Remove detail image" onClick={removeUpload} className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1 text-foreground shadow hover:bg-background disabled:opacity-50">
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} aria-label="Upload detail image" className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary disabled:opacity-50">
                <ImagePlus className="h-7 w-7" />
                <span className="text-sm">Upload Detail Image</span>
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

        <section aria-label="Reference brand or style">
          <StepTitle n={2} aside={`${reference.length}/${DETAIL_REFERENCE_MAX_CHARS}`}>
            Reference Brand or Style
          </StepTitle>
          <Textarea
            value={reference}
            disabled={busy}
            maxLength={DETAIL_REFERENCE_MAX_CHARS}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Describe reference brand or style (optional)"
            aria-label="Reference brand or style"
            className="min-h-24"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DETAIL_REFERENCE_IDEAS.map((idea) => (
              <button key={idea} type="button" disabled={busy} onClick={() => setReference((r) => (r.trim() ? `${r.trim()}, ${idea.toLowerCase()}` : idea).slice(0, DETAIL_REFERENCE_MAX_CHARS))} className="rounded-full bg-soft px-2.5 py-1 text-xs text-foreground/80 hover:bg-primary/12 hover:text-pri-text disabled:opacity-50">
                {idea}
              </button>
            ))}
          </div>
        </section>

        <section aria-label="Style category">
          <StepTitle n={3}>Style Category</StepTitle>
          <button
            type="button"
            disabled={busy}
            aria-expanded={pickingCategory}
            onClick={() => setPickingCategory((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className={category ? "font-medium text-foreground" : "text-muted-foreground"}>{category ?? "Select"}</span>
            <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", pickingCategory && "rotate-90")} />
          </button>
          {pickingCategory && (
            <div className="mt-2 rounded-xl border border-border bg-card p-3" role="dialog" aria-label="Style Category">
              <label className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-background px-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Please enter" aria-label="Search style categories" className="h-8 w-full bg-transparent text-sm outline-none" autoFocus />
              </label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <button key={c} type="button" onClick={() => chooseCategory(c)} aria-pressed={c === category} className={cn("rounded-lg border px-2.5 py-1 text-sm", c === category ? "border-primary bg-primary text-primary-foreground" : "border-border bg-soft text-foreground hover:bg-primary/12")}>
                    {c}
                  </button>
                ))}
                {!categories.length && <span className="text-xs text-muted-foreground">No category matches “{search}”.</span>}
              </div>
            </div>
          )}
        </section>

        <section aria-label="Output content">
          <StepTitle n={4}>Select Output Content</StepTitle>
          <label className="block text-xs text-muted-foreground" htmlFor="detail-output-type">
            Output Type
          </label>
          <select id="detail-output-type" value={format} disabled={busy} onChange={(e) => setFormat(e.target.value as DetailOutputFormat)} className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary disabled:opacity-50">
            {DETAIL_OUTPUT_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          {formatHint && <p className="mt-1 text-xs text-muted-foreground">{formatHint}</p>}

          <div className="mt-4 flex items-center justify-between text-sm">
            <label htmlFor="detail-design-count" className="text-muted-foreground">
              Design Count
            </label>
            <span className="font-medium tabular-nums text-foreground" data-design-count>
              {count}
            </span>
          </div>
          <input id="detail-design-count" type="range" min={DETAIL_MIN_COUNT} max={DETAIL_MAX_COUNT} step={1} value={count} disabled={busy} onChange={(e) => setCount(Number(e.target.value))} className="mt-1 w-full accent-primary disabled:opacity-50" />
          <p className="mt-1 text-xs text-muted-foreground">How many concepts appear in the result, all in one image. More concepts means each one is smaller.</p>
        </section>

        <Button className="w-full" size="lg" onClick={handleGenerate} disabled={busy || !upload || !category}>
          <Sparkles className="h-4 w-4" />
          {generateLabel}
        </Button>
        {!busy && (!upload || !category) && <p className="-mt-3 text-center text-xs text-muted-foreground">{!upload ? "Upload a detail image to begin." : "Choose a style category to continue."}</p>}
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
              <p className="py-16 text-center text-sm text-muted-foreground">Loading saved designs…</p>
            ) : !history.length ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No saved designs yet. Generate some and they will appear here.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {history.map((item) => (
                  <div key={item.id} className="overflow-hidden rounded-[20px] border border-border bg-card" data-history-item>
                    <button type="button" onClick={() => void open(item.id)} className="block w-full text-left" title="Open this design">
                      <div className="flex aspect-[4/3] items-center justify-center bg-soft/50">
                        {/* eslint-disable-next-line @next/next/no-img-element -- a stored result image */}
                        {item.latest ? <img src={item.latest} alt={`${item.name} — latest result`} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">No result</span>}
                      </div>
                      <div className="p-3">
                        <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.styleCategory} · {item.versions} result{item.versions === 1 ? "" : "s"} · {new Date(item.updatedAt).toLocaleDateString()}
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
          <p className="py-16 text-center text-sm text-muted-foreground">Loading design…</p>
        ) : !current && !busy ? (
          <div role="tabpanel" aria-label="Current task" className="mx-auto max-w-2xl text-center">
            <h2 className="mx-auto max-w-md text-xl font-semibold text-foreground">Turn a neckline, sleeve, pocket or other detail reference into multiple apparel concepts.</h2>
            <div className="mt-6 overflow-hidden rounded-[20px] border border-border bg-soft/50">
              {/* eslint-disable-next-line @next/next/no-img-element -- a static illustration of the tool */}
              <img src="/garment-studio/detail-to-design.jpg" alt="Example: a close-up of a neckline detail on the left, apparel concepts built around it on the right" className="w-full" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Upload a detail, choose its category, then generate.</p>
          </div>
        ) : (
          <div role="tabpanel" aria-label="Current task" className="grid gap-4 xl:grid-cols-[220px_1fr]">
            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Before · Detail</p>
              {upload && (
                <div className="aspect-square overflow-hidden rounded-xl border border-border bg-soft/50">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the user's own upload */}
                  <img src={upload.dataUrl} alt="Detail reference" className="h-full w-full object-cover" />
                </div>
              )}
              {reference.trim() && <p className="mt-2 text-xs text-muted-foreground">Style: {reference.trim()}</p>}
              {analysis && (
                <details className="mt-3 rounded-xl border border-border p-2 text-xs">
                  <summary className="cursor-pointer font-medium text-foreground">Detail read by the AI</summary>
                  <p className="mt-2 whitespace-pre-wrap text-muted-foreground" data-analysis>
                    {analysis}
                  </p>
                </details>
              )}
            </div>
            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                After · {current ? `${current.designCount} concept${current.designCount === 1 ? "" : "s"} · ${DETAIL_OUTPUT_FORMATS.find((f) => f.id === current.outputFormat)?.label}` : "Concepts"}
              </p>
              <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-[20px] border border-border bg-surface">
                {busyShown ? (
                  <StitchLoader className="py-16" label={stage === "analyzing" ? "Reading the detail…" : `Designing ${count} concept${count === 1 ? "" : "s"}… this takes about a minute.`} />
                ) : current ? (
                  // eslint-disable-next-line @next/next/no-img-element -- the generated result (a data URL)
                  <img src={current.image} alt={`${current.designCount} apparel concepts built around the detail`} className="max-h-[70vh] max-w-full object-contain" data-result />
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
                  <span className="text-xs text-muted-foreground">Regenerate uses the style, output type and count chosen on the left.</span>
                </div>
              )}

              {versions.length > 1 && (
                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Results ({versions.length})</p>
                  <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Results">
                    {versions.map((v, i) => (
                      <button key={v.id} type="button" role="listitem" onClick={() => setShown(i)} aria-current={i === shown} className={cn("h-20 w-20 shrink-0 overflow-hidden rounded-xl border bg-soft/50", i === shown ? "border-primary ring-2 ring-primary/30" : "border-border")} title={`Result ${i + 1}: ${v.designCount} concepts`}>
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
