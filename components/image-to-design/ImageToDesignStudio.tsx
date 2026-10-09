"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Download, ImagePlus, Minus, Plus, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { validateImage, SUPPORTED_IMAGE_LABEL, MAX_IMAGE_BYTES } from "@/lib/file-validation";
import { StitchLoader, useMinDuration } from "@/components/studio/StitchLoader";
import { prepareUpload, uploadFromDataUrl, type PreparedUpload } from "@/components/studio/prepare-upload";
import {
  IMAGE_DESCRIPTION_MAX_CHARS,
  IMAGE_DIRECTIONS,
  IMAGE_MAX_BLOCKS,
  IMAGE_MAX_COUNT,
  IMAGE_MIN_COUNT,
  IMAGE_MODES,
  IMAGE_SIZES,
  IMAGE_STYLE_CATEGORIES,
  IMAGE_UPLOAD_MAX_PX,
  TARGET_CATEGORY_GROUPS,
  sizeForAspect,
  type ImageDirection,
  type ImageMode,
  type ImageSize,
} from "@/lib/image-to-design";
import {
  deleteImageDesignAction,
  generateImageDesignAction,
  getImageDesignAction,
  listImageDesignsAction,
  readImageAction,
  regenerateImageDesignAction,
  type ImageDesignSummary,
  type ImageVersionRecord,
} from "@/services/image-to-design";

/** The server calls this screen makes. Passed in so the screen can be exercised without the real AI. */
export interface ImageToDesignActions {
  read: typeof readImageAction;
  generate: typeof generateImageDesignAction;
  regenerate: typeof regenerateImageDesignAction;
  get: typeof getImageDesignAction;
  list: typeof listImageDesignsAction;
  remove: typeof deleteImageDesignAction;
}

const REAL_ACTIONS: ImageToDesignActions = {
  read: readImageAction,
  generate: generateImageDesignAction,
  regenerate: regenerateImageDesignAction,
  get: getImageDesignAction,
  list: listImageDesignsAction,
  remove: deleteImageDesignAction,
};

type Stage = "idle" | "reading" | "generating";
type Picker = null | "category" | "target";
type SizeChoice = (typeof IMAGE_SIZES)[number]["id"];

interface Read {
  analysis: string;
  styles: string[];
  blocks: string[];
}

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-[11px] font-semibold text-primary-foreground">{n}</span>
      <span className="text-sm font-semibold text-foreground">{children}</span>
    </div>
  );
}

function Chip({ selected, onClick, children, disabled }: { selected: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-pressed={selected} className={cn("rounded-lg border px-2.5 py-1 text-sm disabled:opacity-50", selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-soft text-foreground hover:bg-primary/12")}>
      {children}
    </button>
  );
}

function imageSizeOf(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = src;
  });
}

export function ImageToDesignStudio({ openId, actions = REAL_ACTIONS }: { openId?: string; actions?: ImageToDesignActions }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<PreparedUpload | null>(null);
  const [aspectSize, setAspectSize] = useState<ImageSize>("1024x1024");
  const [styleCategory, setStyleCategory] = useState("");
  const [direction, setDirection] = useState<ImageDirection>("category");
  const [description, setDescription] = useState("");
  const [targetCategory, setTargetCategory] = useState("");
  const [targetStyle, setTargetStyle] = useState("");
  const [blocks, setBlocks] = useState<string[]>([]);
  const [picker, setPicker] = useState<Picker>(null);
  const [mode, setMode] = useState<ImageMode>("standard");
  const [sizeChoice, setSizeChoice] = useState<SizeChoice>("original");
  const [count, setCount] = useState(1);
  const [stage, setStage] = useState<Stage>("idle");
  const [designId, setDesignId] = useState<string | null>(null);
  const [read, setRead] = useState<Read | null>(null);
  const [versions, setVersions] = useState<ImageVersionRecord[]>([]);
  const [shown, setShown] = useState(0);
  const [tab, setTab] = useState<"current" | "history">("current");
  const [history, setHistory] = useState<ImageDesignSummary[] | null>(null);
  const [loading, setLoading] = useState(Boolean(openId));
  const [dragOver, setDragOver] = useState(false);

  const busy = stage !== "idle";
  const busyShown = useMinDuration(busy);
  const current = versions[shown] ?? null;
  const dir = IMAGE_DIRECTIONS.find((d) => d.id === direction)!;
  const size: ImageSize = IMAGE_SIZES.find((s) => s.id === sizeChoice)?.size ?? aspectSize;

  /** The one value the direction's picker holds, for the button label. */
  const pickerValue = direction === "category" ? targetCategory : direction === "style" ? targetStyle : direction === "shape" ? (blocks.length ? `${blocks.length} selected` : "") : "";

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
        setAspectSize(sizeForAspect(dims.width, dims.height));
      } catch {
        // Viewing still works; Generate will ask for the photo again.
      }
      setUpload(photo);
      setDesignId(d.id);
      setStyleCategory(d.styleCategory);
      setRead(d.analysis ? { analysis: d.analysis, styles: d.styleOptions, blocks: d.blockOptions } : null);
      setVersions(d.versions);
      setShown(Math.max(0, d.versions.length - 1));
      const last = d.versions[d.versions.length - 1];
      if (last) {
        setDirection(last.direction);
        setDescription(last.description);
        setTargetCategory(last.direction === "category" ? last.target : "");
        setTargetStyle(last.direction === "style" ? last.target : "");
        setBlocks(last.blocks);
        setMode(last.mode);
        setCount(last.count);
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

  /** A new photo means a new design: the earlier read and results no longer apply. */
  function startFresh() {
    setDesignId(null);
    setRead(null);
    setVersions([]);
    setShown(0);
    setTargetStyle("");
    setBlocks([]);
  }

  async function addFile(files: FileList | File[]) {
    const file = Array.from(files)[0];
    if (!file) return;
    if (files.length > 1) toast.info("One style image at a time — the first one was used.");
    const check = validateImage(file.type, file.size, file.name);
    if (!check.valid) return void toast.error(`${file.name}: ${check.error}`);
    try {
      const prepared = await prepareUpload(file, IMAGE_UPLOAD_MAX_PX);
      const dims = await imageSizeOf(prepared.dataUrl);
      setAspectSize(sizeForAspect(dims.width, dims.height));
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

  function formFor(u: PreparedUpload) {
    const form = new FormData();
    form.append("images", new File([u.blob], u.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
    if (styleCategory) form.set("styleCategory", styleCategory);
    return form;
  }

  /** Reads the garment once (description + picker suggestions); returns it, or null after showing the error. */
  async function ensureRead(): Promise<Read | null> {
    if (read) return read;
    if (!upload) return null;
    setStage("reading");
    const result = await actions.read(formFor(upload));
    setStage("idle");
    if (!result.success) {
      toast.error(result.error);
      return null;
    }
    setRead(result.data);
    return result.data;
  }

  async function openTargetPicker() {
    // The category list needs no photo; the style / block suggestions are made from it.
    if (direction !== "category" && !upload) return void toast.error("Upload a style image first.");
    setPicker(picker === "target" ? null : "target");
    if (direction !== "category" && !read) await ensureRead();
  }

  function toggleBlock(b: string) {
    setBlocks((cur) => (cur.includes(b) ? cur.filter((x) => x !== b) : cur.length >= IMAGE_MAX_BLOCKS ? cur : [...cur, b]));
  }

  const target = direction === "category" ? targetCategory : direction === "style" ? targetStyle : "";

  function settings() {
    return { direction, target, blocks: direction === "shape" ? blocks : [], description: description.trim(), mode, size, count };
  }

  function ready(): string | null {
    if (!upload) return "Upload a style image to begin.";
    if (direction === "category" && !targetCategory) return "Choose a target category to continue.";
    if (direction === "style" && !targetStyle && !description.trim()) return "Choose a target style or describe it to continue.";
    if (direction === "shape" && !blocks.length && !description.trim()) return "Choose block elements or describe the silhouette to continue.";
    if (direction === "custom" && !description.trim()) return "Describe the change you want to continue.";
    return null;
  }

  async function handleGenerate() {
    const missing = ready();
    if (missing || !upload) return void toast.error(missing ?? "Upload a style image.");
    const s = settings();

    // Same photo as the last result: only new images are needed, the read is reused.
    if (designId) {
      setStage("generating");
      const result = await actions.regenerate(designId, s);
      setStage("idle");
      if (!result.success) return void toast.error(result.error);
      setShown(versions.length);
      setVersions([...versions, result.data]);
      return void toast.success(result.data.images.length < s.count ? `${result.data.images.length} of ${s.count} images generated` : "New designs generated");
    }

    const r = await ensureRead();
    if (!r) return;
    const form = formFor(upload);
    form.set("direction", s.direction);
    form.set("target", s.target);
    form.set("blocks", JSON.stringify(s.blocks));
    form.set("description", s.description);
    form.set("mode", s.mode);
    form.set("size", s.size);
    form.set("count", String(s.count));
    form.set("analysis", r.analysis);
    form.set("styleOptions", JSON.stringify(r.styles));
    form.set("blockOptions", JSON.stringify(r.blocks));
    setStage("generating");
    const result = await actions.generate(form);
    setStage("idle");
    if (!result.success) return void toast.error(result.error);
    setDesignId(result.data.id);
    setVersions([result.data.version]);
    setShown(0);
    setHistory(null);
    toast.success(result.data.version.images.length < s.count ? `${result.data.version.images.length} of ${s.count} images generated` : "Designs generated");
  }

  function handleDownload(i: number) {
    if (!current) return;
    const a = document.createElement("a");
    a.href = current.images[i];
    a.download = `image-to-design-${current.direction}-${i + 1}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleDelete(item: ImageDesignSummary) {
    if (!window.confirm(`Delete "${item.name}" and its ${item.versions} result${item.versions === 1 ? "" : "s"}? This can't be undone.`)) return;
    const result = await actions.remove(item.id);
    if (!result.success) return void toast.error(result.error);
    setHistory((h) => (h ? h.filter((x) => x.id !== item.id) : h));
    if (item.id === designId) startFresh();
    toast.success("Image design deleted");
  }

  const missing = ready();
  const generateLabel = stage === "reading" ? "Reading the garment…" : stage === "generating" ? "Designing…" : designId ? "Generate again" : "Generate";
  const modeHint = IMAGE_MODES.find((m) => m.id === mode)?.hint;

  return (
    <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
      {/* ------------------------------------------------------------ controls */}
      <div className="space-y-6">
        <section aria-label="Upload style image">
          <StepTitle n={1}>Upload Style Image</StepTitle>
          <p className="mb-2 text-xs text-muted-foreground">
            A clear photo of one garment. {SUPPORTED_IMAGE_LABEL}, up to {MAX_IMAGE_BYTES / (1024 * 1024)}MB.
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

          <p className="mb-1 mt-4 text-xs font-medium text-muted-foreground">Style Category (Optional)</p>
          <button
            type="button"
            disabled={busy}
            aria-expanded={picker === "category"}
            onClick={() => setPicker(picker === "category" ? null : "category")}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className={styleCategory ? "font-medium text-foreground" : "text-muted-foreground"}>{styleCategory || "Select"}</span>
            <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", picker === "category" && "rotate-90")} />
          </button>
          {picker === "category" && (
            <div className="mt-2 flex flex-wrap gap-1.5 rounded-xl border border-border bg-card p-3" role="dialog" aria-label="Style Category">
              {IMAGE_STYLE_CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  selected={c === styleCategory}
                  onClick={() => {
                    if (c !== styleCategory) startFresh();
                    setStyleCategory(c === styleCategory ? "" : c);
                    setPicker(null);
                  }}
                >
                  {c}
                </Chip>
              ))}
            </div>
          )}
        </section>

        <section aria-label="Redesign direction and target">
          <StepTitle n={2}>Select Redesign Direction and Target</StepTitle>
          <div className="mb-3 grid grid-cols-4 gap-1 rounded-xl bg-soft p-1" role="radiogroup" aria-label="Redesign direction">
            {IMAGE_DIRECTIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={d.id === direction}
                disabled={busy}
                onClick={() => {
                  setDirection(d.id);
                  setPicker(null);
                }}
                className={cn("rounded-lg px-2 py-1.5 text-sm font-medium disabled:opacity-50", d.id === direction ? "bg-surface text-pri-text shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="image-description" className="text-xs font-medium text-muted-foreground">
              {dir.descriptionLabel}
            </label>
            <span className="text-xs text-muted-foreground">
              {description.length}/{IMAGE_DESCRIPTION_MAX_CHARS}
            </span>
          </div>
          <Textarea id="image-description" value={description} disabled={busy} maxLength={IMAGE_DESCRIPTION_MAX_CHARS} onChange={(e) => setDescription(e.target.value)} placeholder={dir.placeholder} className="min-h-24" />

          {dir.pickerLabel && (
            <>
              <p className="mb-1 mt-4 text-xs font-medium text-muted-foreground">{dir.pickerLabel}</p>
              <button
                type="button"
                disabled={busy}
                aria-expanded={picker === "target"}
                onClick={() => void openTargetPicker()}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className={pickerValue ? "font-medium text-foreground" : "text-muted-foreground"}>{pickerValue || "Select"}</span>
                <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", picker === "target" && "rotate-90")} />
              </button>
              {picker === "target" && (
                <div className="mt-2 rounded-xl border border-border bg-card p-3" role="dialog" aria-label={dir.pickerLabel}>
                  {direction === "category" ? (
                    <div className="space-y-3">
                      {TARGET_CATEGORY_GROUPS.map((g) => (
                        <div key={g.group}>
                          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{g.group}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {g.items.map((item) => (
                              <Chip
                                key={item}
                                selected={item === targetCategory}
                                onClick={() => {
                                  setTargetCategory(item);
                                  setPicker(null);
                                }}
                              >
                                {item}
                              </Chip>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !read ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">{stage === "reading" ? "Reading your garment for suggestions…" : "Suggestions appear once the garment has been read."}</p>
                  ) : direction === "style" ? (
                    <>
                      <p className="mb-2 text-xs text-muted-foreground">Suggested for this garment (AI-generated, for reference).</p>
                      <div className="flex flex-wrap gap-1.5">
                        {read.styles.map((s) => (
                          <Chip
                            key={s}
                            selected={s === targetStyle}
                            onClick={() => {
                              setTargetStyle(s === targetStyle ? "" : s);
                              setPicker(null);
                            }}
                          >
                            {s}
                          </Chip>
                        ))}
                        {!read.styles.length && <span className="text-xs text-muted-foreground">No suggestions — describe the style above instead.</span>}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="mb-2 text-xs text-muted-foreground">Elements to keep as they are (up to {IMAGE_MAX_BLOCKS}). Suggested for this garment (AI-generated, for reference).</p>
                      <div className="flex flex-wrap gap-1.5">
                        {read.blocks.map((b) => (
                          <Chip key={b} selected={blocks.includes(b)} onClick={() => toggleBlock(b)}>
                            {b}
                          </Chip>
                        ))}
                        {!read.blocks.length && <span className="text-xs text-muted-foreground">No suggestions — describe the silhouette above instead.</span>}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        <section aria-label="Generation settings">
          <StepTitle n={3}>Generation Settings</StepTitle>
          <label className="block text-xs text-muted-foreground" htmlFor="image-mode">
            Generation Mode
          </label>
          <select id="image-mode" value={mode} disabled={busy} onChange={(e) => setMode(e.target.value as ImageMode)} className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary disabled:opacity-50">
            {IMAGE_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          {modeHint && <p className="mt-1 text-xs text-muted-foreground">{modeHint}</p>}

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground" htmlFor="image-size">
                Image Size
              </label>
              <select id="image-size" value={sizeChoice} disabled={busy} onChange={(e) => setSizeChoice(e.target.value as SizeChoice)} className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary disabled:opacity-50">
                {IMAGE_SIZES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground" id="image-count-label">
                Number of Images
              </span>
              <div className="mt-1 flex h-10 items-center justify-between rounded-xl border border-border bg-surface px-1" role="group" aria-labelledby="image-count-label">
                <button type="button" aria-label="Fewer images" disabled={busy || count <= IMAGE_MIN_COUNT} onClick={() => setCount((c) => c - 1)} className="flex size-8 items-center justify-center rounded-lg hover:bg-soft disabled:opacity-40">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="text-sm font-medium tabular-nums" data-image-count>
                  {count}
                </span>
                <button type="button" aria-label="More images" disabled={busy || count >= IMAGE_MAX_COUNT} onClick={() => setCount((c) => c + 1)} className="flex size-8 items-center justify-center rounded-lg hover:bg-soft disabled:opacity-40">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Up to {IMAGE_MAX_COUNT} images at once, so you can compare directions. Each is its own AI run.</p>
        </section>

        <Button className="w-full" size="lg" onClick={handleGenerate} disabled={busy || Boolean(missing)}>
          <Sparkles className="h-4 w-4" />
          {generateLabel}
        </Button>
        {!busy && missing && <p className="-mt-3 text-center text-xs text-muted-foreground">{missing}</p>}
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
          <p className="py-16 text-center text-sm text-muted-foreground">Loading design…</p>
        ) : !current && !busy ? (
          <div role="tabpanel" aria-label="Current task" className="mx-auto max-w-2xl text-center">
            <h2 className="mx-auto max-w-md text-xl font-semibold text-foreground">Create new style options from an existing garment image.</h2>
            <div className="mt-6 overflow-hidden rounded-[20px] border border-border bg-soft/50">
              {/* eslint-disable-next-line @next/next/no-img-element -- a static illustration of the tool */}
              <img src="/garment-studio/image-to-design.jpg" alt="Example: a garment photo on the left, new style options generated from it on the right" className="w-full" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Upload a garment, choose how to redesign it, then generate.</p>
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
              {read && (
                <details className="mt-3 rounded-xl border border-border p-2 text-xs">
                  <summary className="cursor-pointer font-medium text-foreground">Garment read by the AI</summary>
                  <p className="mt-2 whitespace-pre-wrap text-muted-foreground" data-analysis>
                    {read.analysis}
                  </p>
                </details>
              )}
            </div>
            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                After · {current ? `${current.images.length} image${current.images.length === 1 ? "" : "s"} · ${IMAGE_DIRECTIONS.find((d) => d.id === current.direction)?.label}${current.target ? ` · ${current.target}` : ""}` : "Designs"}
              </p>
              {busyShown ? (
                <div className="flex min-h-72 items-center justify-center rounded-[20px] border border-border bg-surface">
                  <StitchLoader className="py-16" label={stage === "reading" ? "Reading the garment…" : `Designing ${count} image${count === 1 ? "" : "s"}… this takes about a minute.`} />
                </div>
              ) : current ? (
                <div className={cn("grid gap-3", current.images.length > 1 ? "sm:grid-cols-2" : "")} data-results>
                  {current.images.map((src, i) => (
                    <div key={i} className="group relative flex items-center justify-center overflow-hidden rounded-[20px] border border-border bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element -- a generated result (a data URL) */}
                      <img src={src} alt={`Design ${i + 1}`} className="max-h-[60vh] max-w-full object-contain" data-result />
                      <button type="button" onClick={() => handleDownload(i)} aria-label={`Download design ${i + 1}`} className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 text-foreground shadow hover:bg-background">
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {current && !busy && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleGenerate}>
                    <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                  </Button>
                  <span className="text-xs text-muted-foreground">Regenerate uses the direction and settings chosen on the left.</span>
                </div>
              )}

              {versions.length > 1 && (
                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Runs ({versions.length})</p>
                  <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Runs">
                    {versions.map((v, i) => (
                      <button key={v.id} type="button" role="listitem" onClick={() => setShown(i)} aria-current={i === shown} className={cn("h-20 w-20 shrink-0 overflow-hidden rounded-xl border bg-soft/50", i === shown ? "border-primary ring-2 ring-primary/30" : "border-border")} title={`Run ${i + 1}: ${v.images.length} image${v.images.length === 1 ? "" : "s"}`}>
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
