"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Download, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { validateImage, SUPPORTED_IMAGE_LABEL, MAX_IMAGE_BYTES } from "@/lib/file-validation";
import { COLLECTION_DEFAULT_COUNT, COLLECTION_MAX_COUNT, COLLECTION_MAX_IMAGES, COLLECTION_MIN_COUNT, COLLECTION_UPLOAD_MAX_PX, type CollectionPlan } from "@/lib/collection-proposal";
import {
  analyzeCollectionAction,
  createCollectionAction,
  createCollectionVersionAction,
  deleteCollectionAction,
  finishCollectionVersionAction,
  generateLookAction,
  getCollectionAction,
  listCollectionsAction,
  type CollectionSummary,
  type CollectionVersionRecord,
} from "@/services/collection-proposal";
import { CollectionBoard } from "@/components/collection-proposal/CollectionBoard";

/** The server calls this screen makes. Passed in so the screen can be exercised without the real AI. */
export interface CollectionActions {
  analyze: typeof analyzeCollectionAction;
  create: typeof createCollectionAction;
  createVersion: typeof createCollectionVersionAction;
  generateLook: typeof generateLookAction;
  finish: typeof finishCollectionVersionAction;
  get: typeof getCollectionAction;
  list: typeof listCollectionsAction;
  remove: typeof deleteCollectionAction;
}

const REAL_ACTIONS: CollectionActions = {
  analyze: analyzeCollectionAction,
  create: createCollectionAction,
  createVersion: createCollectionVersionAction,
  generateLook: generateLookAction,
  finish: finishCollectionVersionAction,
  get: getCollectionAction,
  list: listCollectionsAction,
  remove: deleteCollectionAction,
};

/** Looks drawn at the same time — each is one image call, so this keeps the board fast without flooding the API. */
const LOOK_CONCURRENCY = 3;

interface Upload {
  id: string;
  /** What is sent to the server and shown as the thumbnail: the photo reduced to at most 1536 px, as JPEG. */
  dataUrl: string;
  blob: Blob;
  name: string;
}

type Stage = "idle" | "analyzing" | "generating";

/** Reduces a photo to at most `COLLECTION_UPLOAD_MAX_PX` on its long side, on white, as JPEG. */
async function prepareUpload(file: File): Promise<Upload> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`"${file.name}" couldn't be read as an image.`));
      img.src = url;
    });
    const scale = Math.min(1, COLLECTION_UPLOAD_MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
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

/** Runs the looks through the server a few at a time, in board order. Stops at the first failure. */
async function drawLooks(actions: CollectionActions, proposalId: string, versionId: string, total: number, onOneDone: () => void): Promise<string[] | string> {
  const images: string[] = new Array(total);
  let next = 0;
  let failure: string | null = null;
  const worker = async () => {
    while (next < total && !failure) {
      const index = next++;
      const result = await actions.generateLook(proposalId, versionId, index);
      if (!result.success) {
        failure = result.error;
        return;
      }
      images[index] = result.data;
      onOneDone();
    }
  };
  await Promise.all(Array.from({ length: Math.min(LOOK_CONCURRENCY, total) }, worker));
  return failure ?? images;
}

export function CollectionBoardStudio({ openId, actions = REAL_ACTIONS }: { openId?: string; actions?: CollectionActions }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [count, setCount] = useState(COLLECTION_DEFAULT_COUNT);
  const [stage, setStage] = useState<Stage>("idle");
  const [drawn, setDrawn] = useState(0);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [plan, setPlan] = useState<CollectionPlan | null>(null);
  const [versions, setVersions] = useState<CollectionVersionRecord[]>([]);
  const [shown, setShown] = useState(0);
  const [tab, setTab] = useState<"current" | "history">("current");
  const [history, setHistory] = useState<CollectionSummary[] | null>(null);
  const [loading, setLoading] = useState(Boolean(openId));
  const [dragOver, setDragOver] = useState(false);
  const [exporting, setExporting] = useState(false);

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
      const last = d.versions[d.versions.length - 1];
      setUploads(photos);
      setProposalId(d.id);
      setVersions(d.versions);
      setShown(Math.max(0, d.versions.length - 1));
      setPlan(last ? { model: last.model, coreDNA: last.coreDNA, looks: last.looks } : null);
      setCount(last?.collectionCount ?? COLLECTION_DEFAULT_COUNT);
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

  /** New photos mean a new collection: the earlier plan and boards no longer apply. */
  function startFresh() {
    setProposalId(null);
    setPlan(null);
    setVersions([]);
    setShown(0);
  }

  async function addFiles(files: FileList | File[]) {
    const room = COLLECTION_MAX_IMAGES - uploads.length;
    const list = Array.from(files);
    if (!list.length) return;
    if (list.length > room) toast.info(`Only ${COLLECTION_MAX_IMAGES} images can be used — the first ${Math.max(0, room)} were added.`);
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

  async function handleGenerate() {
    if (!uploads.length) return void toast.error("Upload at least one bestseller image.");
    const total = count;

    // Same photos, same count as the board on screen: reuse its plan and draw a new board.
    if (proposalId && plan && plan.looks.length === total) {
      setStage("generating");
      setDrawn(0);
      const made = await actions.createVersion(proposalId, total, JSON.stringify(plan));
      if (!made.success) return finishWithError(made.error);
      const drawnLooks = await drawLooks(actions, proposalId, made.data.versionId, total, () => setDrawn((d) => d + 1));
      if (typeof drawnLooks === "string") return finishWithError(drawnLooks);
      const saved = await actions.finish(proposalId, made.data.versionId, drawnLooks);
      setStage("idle");
      if (!saved.success) return void toast.error(saved.error);
      setVersions((v) => [...v, saved.data]);
      setShown(versions.length);
      setHistory(null);
      return void toast.success("New collection board generated");
    }

    const form = new FormData();
    for (const u of uploads) form.append("images", new File([u.blob], u.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
    form.set("count", String(total));
    setStage("analyzing");
    const read = await actions.analyze(form);
    if (!read.success) return finishWithError(read.error);

    setPlan(read.data);
    form.set("plan", JSON.stringify(read.data));
    setStage("generating");
    setDrawn(0);
    const created = await actions.create(form);
    if (!created.success) return finishWithError(created.error);
    setProposalId(created.data.proposalId);
    const drawnLooks = await drawLooks(actions, created.data.proposalId, created.data.versionId, total, () => setDrawn((d) => d + 1));
    if (typeof drawnLooks === "string") return finishWithError(drawnLooks);
    const saved = await actions.finish(created.data.proposalId, created.data.versionId, drawnLooks);
    setStage("idle");
    if (!saved.success) return void toast.error(saved.error);
    setVersions([saved.data]);
    setShown(0);
    setHistory(null);
    toast.success("Collection board generated");
  }

  function finishWithError(message: string) {
    setStage("idle");
    toast.error(message);
  }

  async function handleDownload() {
    if (!current || !boardRef.current) return;
    setExporting(true);
    try {
      // Loaded only when a download is asked for.
      const { default: html2canvas } = await import("html2canvas-pro");
      const canvas = await html2canvas(boardRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The board couldn't be exported."))), "image/png"));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `collection-proposal-${current.collectionCount}-looks.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The board couldn't be exported.");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete(item: CollectionSummary) {
    if (!window.confirm(`Delete "${item.name}" and its ${item.versions} board${item.versions === 1 ? "" : "s"}? This can't be undone.`)) return;
    const result = await actions.remove(item.id);
    if (!result.success) return void toast.error(result.error);
    setHistory((h) => (h ? h.filter((x) => x.id !== item.id) : h));
    if (item.id === proposalId) startFresh();
    toast.success("Collection deleted");
  }

  const generateLabel = stage === "analyzing" ? "Reading the bestseller…" : stage === "generating" ? `Designing look ${Math.min(drawn + 1, count)} of ${count}…` : proposalId ? "Generate again" : "Generate";

  return (
    <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
      {/* ------------------------------------------------------------ controls */}
      <div className="space-y-6">
        <section aria-label="Upload bestseller images">
          <StepTitle n={1} aside={`(${uploads.length}/${COLLECTION_MAX_IMAGES})`}>
            Upload Bestseller Images
          </StepTitle>
          <p className="mb-2 text-xs text-muted-foreground">
            1–{COLLECTION_MAX_IMAGES} photos of the same bestselling style. {SUPPORTED_IMAGE_LABEL}, up to {MAX_IMAGE_BYTES / (1024 * 1024)}MB each.
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
            {uploads.length < COLLECTION_MAX_IMAGES && (
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
        </section>

        <section aria-label="Collection count">
          <StepTitle n={2}>Collection Count</StepTitle>
          <div className="flex items-center justify-between text-sm">
            <label htmlFor="collection-count" className="text-muted-foreground">
              Looks in the collection
            </label>
            <span className="font-medium tabular-nums text-foreground" data-collection-count>
              {count}
            </span>
          </div>
          <input
            id="collection-count"
            type="range"
            min={COLLECTION_MIN_COUNT}
            max={COLLECTION_MAX_COUNT}
            step={1}
            value={count}
            disabled={busy}
            onChange={(e) => setCount(Number(e.target.value))}
            className="mt-1 w-full accent-primary disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-muted-foreground">Each look is a complete outfit on the same model, shown in one row with its design details.</p>
        </section>

        <Button className="w-full" onClick={handleGenerate} disabled={busy || !uploads.length}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generateLabel}
        </Button>
        {!busy && !uploads.length && <p className="-mt-3 text-center text-xs text-muted-foreground">Upload a bestseller image to begin.</p>}
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
                        {/* eslint-disable-next-line @next/next/no-img-element -- a stored look image */}
                        {item.latest ? <img src={item.latest} alt={`${item.name} — latest look`} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">No board yet</span>}
                      </div>
                      <div className="p-2">
                        <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.versions} board{item.versions === 1 ? "" : "s"} · {new Date(item.updatedAt).toLocaleDateString()}
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
            <h2 className="mx-auto max-w-md text-xl font-semibold text-foreground">Build a collection proposal around a bestseller, with complete looks and a shared Core DNA.</h2>
            <div className="mt-6 overflow-hidden rounded-xl border border-border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element -- a static illustration of the tool */}
              <img src="/garment-studio/collection-proposal.jpg" alt="Example: a collection board with looks and a Core DNA strip" className="w-full" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Upload your bestseller, choose how many looks you want, then generate.</p>
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
              {plan && (
                <details className="mt-3 rounded-lg border border-border p-2 text-xs">
                  <summary className="cursor-pointer font-medium text-foreground">Model and looks planned by the AI</summary>
                  <p className="mt-2 text-muted-foreground" data-model>
                    {plan.model}
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                    {plan.looks.map((l, i) => (
                      <li key={i}>
                        LOOK {i + 1}: {l.description}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                After · {current ? `${current.collectionCount} look${current.collectionCount === 1 ? "" : "s"} · Collection board` : "Collection board"}
              </p>
              <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30">
                {busy ? (
                  <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground" role="status">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <p className="text-sm">{stage === "analyzing" ? "Reading the bestseller and planning the collection…" : `Drawing look ${Math.min(drawn + 1, count)} of ${count}… this takes a few minutes.`}</p>
                  </div>
                ) : current ? (
                  <div className="w-full">
                    <CollectionBoard boardRef={boardRef} looks={current.looks} coreDNA={current.coreDNA} lookImages={current.lookImages} />
                  </div>
                ) : null}
              </div>

              {current && !busy && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleGenerate}>
                    <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload} disabled={exporting}>
                    {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Download
                  </Button>
                  <span className="text-xs text-muted-foreground">Regenerate keeps the same plan and redraws the looks. Change the count to plan a new collection.</span>
                </div>
              )}

              {versions.length > 1 && (
                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Boards ({versions.length})</p>
                  <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Boards">
                    {versions.map((v, i) => (
                      <button key={v.id} type="button" role="listitem" onClick={() => setShown(i)} aria-current={i === shown} className={cn("h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted/30", i === shown ? "border-primary ring-2 ring-primary/30" : "border-border")} title={`Board ${i + 1}: ${v.collectionCount} looks`}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- a generated look (a data URL) */}
                        <img src={v.lookImages[0]} alt={`Board ${i + 1}`} className="h-full w-full object-cover" />
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
