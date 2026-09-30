"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, ImagePlus, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PATTERN_SHEET_WIDTH, PatternSheet, type SheetPiece } from "@/components/pattern-to-garment/PatternSheet";
import { validateImage } from "@/lib/file-validation";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { loadImage } from "@/lib/garment-canvas";
import { cn } from "@/lib/utils";
import { analyzePatternPiecesAction, generatePatternGarmentViewAction, type PatternGarmentView } from "@/services/pattern-to-garment";

/** Must match MAX_PIECES in services/pattern-to-garment.ts. */
const MAX_PIECES = 10;
const VIEWS: { key: PatternGarmentView; label: string }[] = [
  { key: "front", label: "Front" },
  { key: "back", label: "Back" },
  { key: "side", label: "Side" },
];
const PIECE_NAMES = ["Front", "Back", "Left Front", "Right Front", "Sleeve", "Collar", "Cuff", "Pocket", "Facing", "Waistband", "Skirt Front", "Skirt Back", "Yoke", "Lapel"];
const GARMENT_TYPES = ["Dress", "Top / Blouse", "Shirt", "Vest / Waistcoat", "Jacket / Blazer", "Skirt", "Trousers", "Jumpsuit", "Coat"];

interface Piece extends SheetPiece {
  /** Downscaled JPEG sent to the AI — keeps several pieces well under the
   * 20MB Server Action body limit. previewUrl keeps the original for the sheet. */
  aiFile: File;
}

type Views = Record<PatternGarmentView, string | null>;
type Stage = "idle" | "analyzing" | PatternGarmentView;

const STAGE_LABEL: Record<Stage, string> = {
  idle: "",
  analyzing: "Reading pattern pieces…",
  front: "Generating front view…",
  back: "Generating back view…",
  side: "Generating side view…",
};

/** Longest side capped, flattened onto white (transparent PNG pieces would
 * otherwise turn black as JPEG), re-encoded as JPEG. */
async function toAiFile(src: string, name: string, maxSide = 1280): Promise<File> {
  const img = await loadImage(src);
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't supported in this browser.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't encode the image."))), "image/jpeg", 0.9)
  );
  return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
}

function download(href: string, filename: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function PatternToGarmentStudio() {
  const inputRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const [pieces, setPieces] = useState<Piece[]>([]);
  const [title, setTitle] = useState("");
  const [garmentType, setGarmentType] = useState("");
  const [size, setSize] = useState("");
  const [fabric, setFabric] = useState("");
  const [notes, setNotes] = useState("");

  const [analysis, setAnalysis] = useState<string | null>(null);
  const [views, setViews] = useState<Views>({ front: null, back: null, side: null });
  const [stage, setStage] = useState<Stage>("idle");
  const [tab, setTab] = useState<string>("front");
  const [exporting, setExporting] = useState(false);

  // The sheet is a fixed-width export artifact; the on-screen preview is
  // scaled down to fit the panel (offsetHeight ignores the transform).
  const sheetBoxRef = useRef<HTMLDivElement>(null);
  const [sheetScale, setSheetScale] = useState(1);
  const [sheetHeight, setSheetHeight] = useState(0);
  useEffect(() => {
    const box = sheetBoxRef.current;
    const sheet = sheetRef.current;
    if (tab !== "sheet" || !box || !sheet) return;
    const measure = () => {
      setSheetScale(Math.min(1, box.clientWidth / PATTERN_SHEET_WIDTH));
      setSheetHeight(sheet.offsetHeight);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(sheet);
    return () => observer.disconnect();
  }, [tab, pieces.length]);

  const busy = stage !== "idle";

  // Any change to the pieces or details makes earlier assembly notes stale.
  function updatePieces(next: Piece[]) {
    setPieces(next);
    setAnalysis(null);
  }

  async function addFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    const room = MAX_PIECES - pieces.length;
    if (room <= 0) return toast.error(`You can add up to ${MAX_PIECES} pattern pieces.`);
    if (files.length > room) toast.error(`Only the first ${room} image(s) were added — the limit is ${MAX_PIECES} pieces.`);

    const added: Piece[] = [];
    for (const [i, f] of files.slice(0, room).entries()) {
      const check = validateImage(f.type, f.size, f.name);
      if (!check.valid) {
        toast.error(`${f.name}: ${check.error}`);
        continue;
      }
      try {
        const previewUrl = await fileToDataUrl(f);
        const index = pieces.length + added.length;
        added.push({
          id: `${Date.now()}-${i}`,
          // Upload order says nothing about which piece this is — the
          // designer names it (the input suggests PIECE_NAMES).
          name: `Piece ${index + 1}`,
          cutCount: 1,
          measurements: "",
          previewUrl,
          aiFile: await toAiFile(previewUrl, `piece-${index + 1}`),
        });
      } catch {
        toast.error(`${f.name}: couldn't read this image.`);
      }
    }
    if (added.length) updatePieces([...pieces, ...added]);
  }

  function patchPiece(id: string, patch: Partial<Piece>) {
    updatePieces(pieces.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function baseForm(): FormData {
    const form = new FormData();
    for (const p of pieces) form.append("piece", p.aiFile);
    form.append("meta", JSON.stringify(pieces.map((p) => ({ name: p.name, cutCount: p.cutCount, measurements: p.measurements }))));
    form.append("garmentType", garmentType);
    form.append("fabric", fabric);
    form.append("notes", notes);
    return form;
  }

  async function ensureAnalysis(): Promise<string | null> {
    if (analysis) return analysis;
    setStage("analyzing");
    const result = await analyzePatternPiecesAction(baseForm());
    if (!result.success) {
      toast.error(result.error);
      return null;
    }
    setAnalysis(result.data);
    return result.data;
  }

  /** Renders one view. Back/side are conditioned on the current front view. */
  async function generateView(view: PatternGarmentView, notesText: string, front: string | null): Promise<string | null> {
    setStage(view);
    const form = baseForm();
    form.append("view", view);
    form.append("analysis", notesText);
    if (view !== "front") {
      if (!front) {
        toast.error("Generate the front view first.");
        return null;
      }
      form.append("frontView", await toAiFile(front, "front-view", 1536));
    }
    const result = await generatePatternGarmentViewAction(form);
    if (!result.success) {
      toast.error(`${view[0].toUpperCase()}${view.slice(1)} view: ${result.error}`);
      return null;
    }
    setViews((v) => ({ ...v, [view]: result.data }));
    return result.data;
  }

  async function handleGenerateAll() {
    if (pieces.length === 0) return toast.error("Add at least one pattern piece.");
    try {
      const notesText = await ensureAnalysis();
      if (!notesText) return;
      setTab("front");
      const front = await generateView("front", notesText, null);
      if (!front) return;
      // Server Actions run one at a time per client, so these are sequential either way.
      await generateView("back", notesText, front);
      await generateView("side", notesText, front);
      toast.success("Front, back and side views generated");
    } finally {
      setStage("idle");
    }
  }

  async function handleRegenerate(view: PatternGarmentView) {
    try {
      const notesText = await ensureAnalysis();
      if (!notesText) return;
      const result = await generateView(view, notesText, views.front);
      if (result) toast.success(`${view[0].toUpperCase()}${view.slice(1)} view regenerated`);
    } finally {
      setStage("idle");
    }
  }

  async function handleExportSheet() {
    if (!sheetRef.current) return;
    setExporting(true);
    try {
      // Render the sheet at full size (unscaled) for the capture.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      // Lazily imported, same as Mood Board's export — html2canvas-pro
      // (not html2canvas) because the app's Tailwind v4 theme uses oklch().
      const { default: html2canvas } = await import("html2canvas-pro");
      const canvas = await html2canvas(sheetRef.current, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
      download(canvas.toDataURL("image/png"), `${title.trim().replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "pattern-sheet"}.png`);
      toast.success("Pattern sheet downloaded");
    } catch {
      toast.error("Couldn't export the pattern sheet.");
    } finally {
      setExporting(false);
    }
  }

  const hasAnyView = VIEWS.some((v) => views[v.key]);

  return (
    <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
      {/* Inputs */}
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold text-foreground mb-1">1. Upload pattern pieces</p>
          <p className="text-sm text-muted-foreground mb-2">One image per piece — PNG, JPG or WEBP. Name each piece and set how many to cut.</p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border px-4 py-6 text-center transition-colors hover:bg-muted/40",
              dragOver && "border-primary bg-primary/5"
            )}
          >
            <ImagePlus className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Add pattern pieces</p>
            <p className="text-xs text-muted-foreground">Click or drop images · {pieces.length}/{MAX_PIECES}</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {pieces.length > 0 && (
            <div className="mt-3 space-y-3">
              {pieces.map((p) => (
                <div key={p.id} className="flex gap-3 rounded-xl border border-border bg-card p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.previewUrl} alt={p.name} className="h-20 w-16 shrink-0 rounded-md border border-border bg-muted object-contain" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={p.name}
                        onChange={(e) => patchPiece(p.id, { name: e.target.value })}
                        list="pattern-piece-names"
                        placeholder="Piece name"
                        aria-label="Piece name"
                        className="h-7 text-sm"
                      />
                      <div className="flex shrink-0 rounded-md border border-border p-0.5" role="group" aria-label="Cut count">
                        {[1, 2].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => patchPiece(p.id, { cutCount: n })}
                            className={cn(
                              "rounded px-1.5 text-xs font-medium",
                              p.cutCount === n ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            ×{n}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => updatePieces(pieces.filter((x) => x.id !== p.id))}
                        className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
                        aria-label={`Remove ${p.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Input
                      value={p.measurements}
                      onChange={(e) => patchPiece(p.id, { measurements: e.target.value })}
                      placeholder="Measurements (optional), e.g. Bust 94 cm, Length 46 cm"
                      aria-label="Measurements"
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <datalist id="pattern-piece-names">
            {PIECE_NAMES.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>

        <div className="space-y-2.5">
          <p className="text-sm font-semibold text-foreground">2. Garment details (optional)</p>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Design name, e.g. Tailored Vest Dress" aria-label="Design name" />
          <div className="grid grid-cols-[1fr_96px] gap-2">
            <Input
              value={garmentType}
              onChange={(e) => {
                setGarmentType(e.target.value);
                setAnalysis(null);
              }}
              list="pattern-garment-types"
              placeholder="Garment type"
              aria-label="Garment type"
            />
            <Input value={size} onChange={(e) => setSize(e.target.value)} placeholder="Size" aria-label="Size" />
          </div>
          <datalist id="pattern-garment-types">
            {GARMENT_TYPES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <Input value={fabric} onChange={(e) => setFabric(e.target.value)} placeholder="Fabric & colour, e.g. navy wool crepe" aria-label="Fabric and colour" />
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder='Notes, e.g. "4 black buttons, notched lapel"'
            className="min-h-16 max-h-32 overflow-y-auto"
          />
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground mb-1">3. Generate</p>
          <Button className="w-full" onClick={handleGenerateAll} disabled={busy || pieces.length === 0}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {busy ? STAGE_LABEL[stage] : "Generate Front, Back & Side"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">AI visualization of the stitched garment — shape and details follow your pieces, but it isn&apos;t an exact fit simulation.</p>
        </div>
      </div>

      {/* Results */}
      <div className="min-w-0">
        <Tabs value={tab} onValueChange={(v) => v && setTab(v as string)}>
          <TabsList>
            {VIEWS.map((v) => (
              <TabsTrigger key={v.key} value={v.key}>
                {v.label}
                {stage === v.key && <Loader2 className="h-3 w-3 animate-spin" />}
              </TabsTrigger>
            ))}
            <TabsTrigger value="sheet">Pattern sheet</TabsTrigger>
          </TabsList>

          {VIEWS.map((v) => (
            <TabsContent key={v.key} value={v.key} className="mt-4">
              <div className="mx-auto flex aspect-[2/3] max-h-[640px] items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30">
                {stage === v.key ? (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <p className="text-xs">{STAGE_LABEL[v.key]}</p>
                  </div>
                ) : views[v.key] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={views[v.key]!} alt={`${v.label} view`} className="max-h-full max-w-full object-contain" />
                ) : (
                  <p className="px-6 text-center text-xs text-muted-foreground">
                    {stage === "analyzing" ? STAGE_LABEL.analyzing : `Add your pattern pieces and click "Generate Front, Back & Side" to see the ${v.label.toLowerCase()} view here.`}
                  </p>
                )}
              </div>
              {views[v.key] && !busy && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleRegenerate(v.key)} disabled={v.key !== "front" && !views.front}>
                    <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => download(views[v.key]!, `pattern-to-garment-${v.key}.png`)}>
                    <Download className="w-3.5 h-3.5" /> Download
                  </Button>
                </div>
              )}
            </TabsContent>
          ))}

          <TabsContent value="sheet" className="mt-4">
            {pieces.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Add pattern pieces to build the sheet.</p>
            ) : (
              <>
                <div
                  ref={sheetBoxRef}
                  className="overflow-hidden rounded-xl border border-border"
                  style={exporting || !sheetHeight ? undefined : { height: sheetHeight * sheetScale }}
                >
                  <div style={{ width: PATTERN_SHEET_WIDTH, transform: exporting ? undefined : `scale(${sheetScale})`, transformOrigin: "top left" }}>
                    <PatternSheet ref={sheetRef} title={title} size={size} frontView={views.front} backView={views.back} sideView={views.side} pieces={pieces} />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleExportSheet} disabled={exporting || !hasAnyView}>
                    {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Download sheet (PNG)
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
