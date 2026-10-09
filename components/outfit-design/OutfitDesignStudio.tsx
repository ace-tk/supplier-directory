"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Download, ImagePlus, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { validateImage, SUPPORTED_IMAGE_LABEL, MAX_IMAGE_BYTES } from "@/lib/file-validation";
import { StitchLoader, useMinDuration } from "@/components/studio/StitchLoader";
import { prepareUpload, uploadFromDataUrl, type PreparedUpload } from "@/components/studio/prepare-upload";
import {
  OUTFIT_CATEGORIES,
  OUTFIT_GROUPS,
  OUTFIT_MODES,
  OUTFIT_UPLOAD_MAX_PX,
  outfitCategoryLabel,
  type OutfitCategory,
  type OutfitGroup,
  type OutfitMode,
} from "@/lib/outfit-design";
import {
  analyzeOutfitAction,
  deleteOutfitAction,
  generateOutfitAction,
  getOutfitAction,
  listOutfitsAction,
  regenerateOutfitAction,
  type OutfitSummary,
  type OutfitVersionRecord,
} from "@/services/outfit-design";

/** The server calls this screen makes. Passed in so the screen can be exercised without the real AI. */
export interface OutfitDesignActions {
  analyze: typeof analyzeOutfitAction;
  generate: typeof generateOutfitAction;
  regenerate: typeof regenerateOutfitAction;
  get: typeof getOutfitAction;
  list: typeof listOutfitsAction;
  remove: typeof deleteOutfitAction;
}

const REAL_ACTIONS: OutfitDesignActions = {
  analyze: analyzeOutfitAction,
  generate: generateOutfitAction,
  regenerate: regenerateOutfitAction,
  get: getOutfitAction,
  list: listOutfitsAction,
  remove: deleteOutfitAction,
};

type Stage = "idle" | "analyzing" | "generating";

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-[11px] font-semibold text-primary-foreground">{n}</span>
      <span className="text-sm font-semibold text-foreground">{children}</span>
    </div>
  );
}

export function OutfitDesignStudio({ openId, actions = REAL_ACTIONS }: { openId?: string; actions?: OutfitDesignActions }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<PreparedUpload | null>(null);
  const [match, setMatch] = useState<OutfitCategory | null>(null);
  const [picking, setPicking] = useState(false);
  const [group, setGroup] = useState<OutfitGroup>("Upper");
  const [mode, setMode] = useState<OutfitMode>("standard");
  const [stage, setStage] = useState<Stage>("idle");
  const [outfitId, setOutfitId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [versions, setVersions] = useState<OutfitVersionRecord[]>([]);
  const [shown, setShown] = useState(0);
  const [tab, setTab] = useState<"current" | "history">("current");
  const [history, setHistory] = useState<OutfitSummary[] | null>(null);
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
      let photo: PreparedUpload | null = null;
      try {
        photo = await uploadFromDataUrl(d.sourceImage, "style.jpg");
      } catch {
        // Viewing still works; Generate will ask for the photo again.
      }
      setUpload(photo);
      setOutfitId(d.id);
      setAnalysis(d.analysis);
      setVersions(d.versions);
      setShown(Math.max(0, d.versions.length - 1));
      const last = d.versions[d.versions.length - 1];
      if (last) {
        setMatch({ group: last.matchGroup, name: last.matchCategory });
        setGroup(last.matchGroup);
        setMode(last.mode);
      }
      setTab("current");
      setLoading(false);
    },
    [actions]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads a saved outfit named in the URL; state is set when the server answers
    if (openId) void open(openId);
  }, [openId, open]);

  const loadHistory = useCallback(async () => {
    const result = await actions.list();
    if (result.success) setHistory(result.data);
    else toast.error(result.error);
  }, [actions]);

  /** A new photo means a new outfit: the earlier analysis and results no longer apply. */
  function startFresh() {
    setOutfitId(null);
    setAnalysis(null);
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
      setUpload(await prepareUpload(file, OUTFIT_UPLOAD_MAX_PX));
      startFresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That image couldn't be read.");
    }
  }

  function removeUpload() {
    setUpload(null);
    startFresh();
  }

  function chooseMatch(name: string) {
    setMatch({ group, name });
    setPicking(false);
  }

  async function handleGenerate() {
    if (!upload) return void toast.error("Upload a style image.");
    if (!match) return void toast.error("Choose a matching category.");

    // Same photo as the last result: only a new outfit is needed, the analysis is reused.
    if (outfitId) {
      setStage("generating");
      const result = await actions.regenerate(outfitId, match.group, match.name, mode);
      setStage("idle");
      if (!result.success) return void toast.error(result.error);
      setShown(versions.length);
      setVersions([...versions, result.data]);
      return void toast.success("New outfit generated");
    }

    const form = new FormData();
    form.append("images", new File([upload.blob], upload.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
    setStage("analyzing");
    const read = await actions.analyze(form);
    if (!read.success) {
      setStage("idle");
      return void toast.error(read.error);
    }
    setAnalysis(read.data);

    form.set("group", match.group);
    form.set("category", match.name);
    form.set("mode", mode);
    form.set("analysis", read.data);
    setStage("generating");
    const result = await actions.generate(form);
    setStage("idle");
    if (!result.success) return void toast.error(result.error);
    setOutfitId(result.data.id);
    setVersions([result.data.version]);
    setShown(0);
    setHistory(null);
    toast.success("Outfit generated");
  }

  function handleDownload() {
    if (!current) return;
    const a = document.createElement("a");
    a.href = current.image;
    a.download = `outfit-design-${current.matchCategory.toLowerCase().replace(/\s+/g, "-")}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleDelete(item: OutfitSummary) {
    if (!window.confirm(`Delete "${item.name}" and its ${item.versions} result${item.versions === 1 ? "" : "s"}? This can't be undone.`)) return;
    const result = await actions.remove(item.id);
    if (!result.success) return void toast.error(result.error);
    setHistory((h) => (h ? h.filter((x) => x.id !== item.id) : h));
    if (item.id === outfitId) startFresh();
    toast.success("Outfit deleted");
  }

  const generateLabel = stage === "analyzing" ? "Reading the garment…" : stage === "generating" ? "Designing the outfit…" : outfitId ? "Generate again" : "Generate";
  const modeHint = OUTFIT_MODES.find((m) => m.id === mode)?.hint;

  return (
    <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
      {/* ------------------------------------------------------------ controls */}
      <div className="space-y-6">
        <section aria-label="Upload style image">
          <StepTitle n={1}>Upload Style Image</StepTitle>
          <p className="mb-2 text-xs text-muted-foreground">
            One top or one bottom, on a plain background. {SUPPORTED_IMAGE_LABEL}, up to {MAX_IMAGE_BYTES / (1024 * 1024)}MB.
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

        <section aria-label="Matching categories">
          <StepTitle n={2}>Matching Categories</StepTitle>
          <button
            type="button"
            disabled={busy}
            aria-expanded={picking}
            onClick={() => setPicking((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className={match ? "font-medium text-foreground" : "text-muted-foreground"}>{match ? outfitCategoryLabel(match) : "Select a matching category"}</span>
            <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", picking && "rotate-90")} />
          </button>
          <p className="mt-1 text-xs text-muted-foreground">The kind of garment to design so it matches your upload.</p>
          {picking && (
            <div className="mt-2 rounded-xl border border-border bg-card p-3" role="dialog" aria-label="Matching Categories">
              <div className="mb-3 inline-flex rounded-lg bg-soft p-0.5" role="tablist" aria-label="Garment group">
                {OUTFIT_GROUPS.map((g) => (
                  <button key={g} type="button" role="tab" aria-selected={g === group} onClick={() => setGroup(g)} className={cn("rounded-md px-4 py-1 text-sm font-medium", g === group ? "bg-surface text-pri-text shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    {g}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {OUTFIT_CATEGORIES[group].map((name) => {
                  const selected = match?.group === group && match.name === name;
                  return (
                    <button key={name} type="button" onClick={() => chooseMatch(name)} aria-pressed={selected} className={cn("rounded-lg border px-2.5 py-1 text-sm", selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-soft text-foreground hover:bg-primary/12")}>
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section aria-label="Other parameters">
          <StepTitle n={3}>Other Parameters</StepTitle>
          <label className="block text-xs text-muted-foreground" htmlFor="outfit-mode">
            Generation Mode
          </label>
          <select id="outfit-mode" value={mode} disabled={busy} onChange={(e) => setMode(e.target.value as OutfitMode)} className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary disabled:opacity-50">
            {OUTFIT_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          {modeHint && <p className="mt-1 text-xs text-muted-foreground">{modeHint}</p>}
        </section>

        <Button className="w-full" size="lg" onClick={handleGenerate} disabled={busy || !upload || !match}>
          <Sparkles className="h-4 w-4" />
          {generateLabel}
        </Button>
        {!busy && (!upload || !match) && <p className="-mt-3 text-center text-xs text-muted-foreground">{!upload ? "Upload a style image to begin." : "Choose a matching category to continue."}</p>}
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
              <p className="py-16 text-center text-sm text-muted-foreground">Loading saved outfits…</p>
            ) : !history.length ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No saved outfits yet. Generate one and it will appear here.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {history.map((item) => (
                  <div key={item.id} className="overflow-hidden rounded-[20px] border border-border bg-card" data-history-item>
                    <button type="button" onClick={() => void open(item.id)} className="block w-full text-left" title="Open this outfit">
                      <div className="flex aspect-[4/3] items-center justify-center bg-soft/50">
                        {/* eslint-disable-next-line @next/next/no-img-element -- a stored result image */}
                        {item.latest ? <img src={item.latest} alt={`${item.name} — latest result`} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">No result</span>}
                      </div>
                      <div className="p-3">
                        <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.versions} result{item.versions === 1 ? "" : "s"} · {new Date(item.updatedAt).toLocaleDateString()}
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
          <p className="py-16 text-center text-sm text-muted-foreground">Loading outfit…</p>
        ) : !current && !busy ? (
          <div role="tabpanel" aria-label="Current task" className="mx-auto max-w-2xl text-center">
            <h2 className="mx-auto max-w-md text-xl font-semibold text-foreground">Generate coordinated garments from a single top or bottom.</h2>
            <div className="mt-6 overflow-hidden rounded-[20px] border border-border bg-soft/50">
              {/* eslint-disable-next-line @next/next/no-img-element -- a static illustration of the tool */}
              <img src="/garment-studio/outfit-design.jpg" alt="Example: a blazer on the left, the blazer with a matching skirt on the right" className="w-full" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Upload a top or a bottom, choose what to match it with, then generate.</p>
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
              {analysis && (
                <details className="mt-3 rounded-xl border border-border p-2 text-xs">
                  <summary className="cursor-pointer font-medium text-foreground">Garment read by the AI</summary>
                  <p className="mt-2 whitespace-pre-wrap text-muted-foreground" data-analysis>
                    {analysis}
                  </p>
                </details>
              )}
            </div>
            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                After · {current ? `${outfitCategoryLabel({ group: current.matchGroup, name: current.matchCategory })} · ${OUTFIT_MODES.find((m) => m.id === current.mode)?.label}` : "Outfit"}
              </p>
              <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-[20px] border border-border bg-surface">
                {busyShown ? (
                  <StitchLoader className="py-16" label={stage === "analyzing" ? "Reading the garment…" : "Designing the matching piece… this takes about a minute."} />
                ) : current ? (
                  // eslint-disable-next-line @next/next/no-img-element -- the generated result (a data URL)
                  <img src={current.image} alt="Coordinated outfit" className="max-h-[70vh] max-w-full object-contain" data-result />
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
                  <span className="text-xs text-muted-foreground">Regenerate uses the matching category and mode chosen on the left.</span>
                </div>
              )}

              {versions.length > 1 && (
                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Results ({versions.length})</p>
                  <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Results">
                    {versions.map((v, i) => (
                      <button key={v.id} type="button" role="listitem" onClick={() => setShown(i)} aria-current={i === shown} className={cn("h-24 w-20 shrink-0 overflow-hidden rounded-xl border bg-soft/50", i === shown ? "border-primary ring-2 ring-primary/30" : "border-border")} title={`Result ${i + 1}: ${outfitCategoryLabel({ group: v.matchGroup, name: v.matchCategory })}`}>
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
