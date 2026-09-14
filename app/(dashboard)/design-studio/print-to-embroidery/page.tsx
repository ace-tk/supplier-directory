"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  Grid3x3,
  Loader2,
  Maximize,
  Minus,
  Plus,
  RotateCcw,
  Scissors,
  Shirt,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { EditorHeader, type SaveStatus } from "@/components/embroidery/EditorHeader";
import { ArtworkSourcePicker } from "@/components/embroidery/ArtworkSourcePicker";
import { AnalysisPanel } from "@/components/embroidery/AnalysisPanel";
import { EmbroideryStyleCards } from "@/components/embroidery/EmbroideryStyleCards";
import { ThreadColorsPanel } from "@/components/embroidery/ThreadColorsPanel";
import { RefinePanel } from "@/components/embroidery/RefinePanel";
import { DesignSettingsPanel } from "@/components/embroidery/DesignSettingsPanel";
import { GarmentPreviewPanel, GarmentPreviewCanvas, DEFAULT_GARMENT_PREVIEW, type GarmentPreviewState } from "@/components/embroidery/GarmentPreviewPanel";
import { ProductionPanel, ExportActions } from "@/components/embroidery/ProductionExportPanel";
import { CollapsibleSection } from "@/components/embroidery/CollapsibleSection";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { validateImage } from "@/lib/file-validation";
import { fileToDataUrl, dataUrlToFile } from "@/lib/file-to-data-url";
import { loadImage } from "@/lib/garment-canvas";
import { formatRelativeTime } from "@/utils/format";
import { cn } from "@/lib/utils";
import { DEFAULT_SETTINGS_FROM_ANALYSIS, type EmbroideryAnalysis, type EmbroiderySettings, type GarmentTypeId } from "@/lib/embroidery-production";
import {
  analyzeArtworkAction,
  convertToEmbroideryAction,
  exportTransparentArtworkAction,
  saveEmbroideryDesignAction,
  getRecentEmbroideryDesignsAction,
  getEmbroideryDesignAction,
  deleteEmbroideryDesignAction,
  toggleFavoriteEmbroideryDesignAction,
  type EmbroideryDesignSummary,
} from "@/services/embroidery";

const STAGES = ["Artwork", "Analyze", "Convert", "Refine", "Preview", "Production", "Export"] as const;

interface EditableSnapshot {
  name: string;
  settings: EmbroiderySettings | null;
  garmentPreview: GarmentPreviewState;
  garmentType: GarmentTypeId | null;
  garmentColor: string | null;
}

type LeftTab = "design" | "garment" | "assets";

function StageStepper({ index }: { index: number }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
      {STAGES.map((stage, i) => (
        <div key={stage} className="flex items-center gap-1 shrink-0">
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap",
              i < index ? "text-emerald-600 dark:text-emerald-400" : i === index ? "bg-primary/10 text-primary" : "text-muted-foreground/50"
            )}
          >
            {i < index && <Check className="w-3 h-3" />}
            {stage}
          </span>
          {i < STAGES.length - 1 && <span className="w-3 h-px bg-border shrink-0" />}
        </div>
      ))}
    </div>
  );
}

export default function PrintToEmbroideryPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { open: openId } = use(searchParams);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("Untitled Embroidery");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [sourceDims, setSourceDims] = useState<{ width: number; height: number } | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<EmbroideryAnalysis | null>(null);

  const [converting, setConverting] = useState(false);
  const [embroideryImage, setEmbroideryImage] = useState<string | null>(null);
  const [settings, setSettings] = useState<EmbroiderySettings | null>(null);

  const [garmentPreview, setGarmentPreview] = useState<GarmentPreviewState>(DEFAULT_GARMENT_PREVIEW);
  const [garmentType, setGarmentType] = useState<GarmentTypeId | null>(null);
  const [garmentColor, setGarmentColor] = useState<string | null>(null);

  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);

  const [recent, setRecent] = useState<EmbroideryDesignSummary[]>([]);

  const [leftTab, setLeftTab] = useState<LeftTab>("design");
  const [leftSheetOpen, setLeftSheetOpen] = useState(false);
  const [rightSheetOpen, setRightSheetOpen] = useState(false);
  const [zoom, setZoom] = useState(100);

  // Undo/Redo — a real history stack over the editable parameters (name,
  // refinement settings, garment placement/transform, garment metadata).
  // Deliberately does NOT cover sourceImage/embroideryImage/analysis: those
  // are AI-generated document content produced by an explicit, costly
  // Convert/Regenerate action, not something to silently rewind — the same
  // anti-drift reasoning that keeps Regenerate always sourced from the
  // original artwork (see services/embroidery.ts).
  const historyRef = useRef<EditableSnapshot[]>([]);
  const historyIndexRef = useRef(0);
  const isApplyingHistory = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, forceHistoryRender] = useState(0);

  useEffect(() => {
    loadRecent();
  }, []);

  useEffect(() => {
    if (openId) handleOpen(openId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  useEffect(() => {
    if (isApplyingHistory.current) {
      isApplyingHistory.current = false;
      return;
    }
    if (!settings) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      commitHistory({ name, settings, garmentPreview, garmentType, garmentColor });
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name, settings, garmentPreview, garmentType, garmentColor]);

  function commitHistory(snap: EditableSnapshot) {
    const truncated = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current = [...truncated, snap].slice(-50);
    historyIndexRef.current = historyRef.current.length - 1;
    forceHistoryRender((v) => v + 1);
  }

  function resetHistory(snap: EditableSnapshot) {
    historyRef.current = [snap];
    historyIndexRef.current = 0;
    forceHistoryRender((v) => v + 1);
  }

  function applySnapshot(snap: EditableSnapshot) {
    isApplyingHistory.current = true;
    setName(snap.name);
    setSettings(snap.settings);
    setGarmentPreview(snap.garmentPreview);
    setGarmentType(snap.garmentType);
    setGarmentColor(snap.garmentColor);
  }

  function handleUndo() {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    applySnapshot(historyRef.current[historyIndexRef.current]);
    forceHistoryRender((v) => v + 1);
  }

  function handleRedo() {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    applySnapshot(historyRef.current[historyIndexRef.current]);
    forceHistoryRender((v) => v + 1);
  }

  async function loadRecent() {
    const result = await getRecentEmbroideryDesignsAction();
    if (result.success) setRecent(result.data);
  }

  async function runAnalysis(dataUrl: string) {
    setAnalyzing(true);
    setAnalysis(null);
    const result = await analyzeArtworkAction(dataUrl);
    setAnalyzing(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setAnalysis(result.data);
    const initialSettings = DEFAULT_SETTINGS_FROM_ANALYSIS(result.data);
    setSettings(initialSettings);
    resetHistory({ name, settings: initialSettings, garmentPreview: DEFAULT_GARMENT_PREVIEW, garmentType: null, garmentColor: null });
  }

  async function handleArtworkSelected(file: File, dataUrl: string) {
    setSourceFile(file);
    setSourceImage(dataUrl);
    setEmbroideryImage(null);
    setAnalysis(null);
    setSettings(null);
    setSavedId(null);
    setIsFavorite(false);
    setDirty(true);
    setGarmentPreview(DEFAULT_GARMENT_PREVIEW);
    setLeftTab("design");
    // Reset undo/redo immediately, not after analysis resolves — otherwise
    // clicking Undo during the analysis window could restore a stale
    // settings/garmentPreview snapshot left over from the previous artwork.
    resetHistory({ name, settings: null, garmentPreview: DEFAULT_GARMENT_PREVIEW, garmentType: null, garmentColor: null });
    try {
      const img = await loadImage(dataUrl);
      setSourceDims({ width: img.naturalWidth, height: img.naturalHeight });
    } catch {
      setSourceDims({ width: 1024, height: 1024 });
    }
    runAnalysis(dataUrl);
  }

  async function handleFileInput(files: FileList) {
    const f = Array.from(files)[0];
    if (!f) return;
    const check = validateImage(f.type, f.size, f.name);
    if (!check.valid) {
      toast.error(check.error);
      return;
    }
    handleArtworkSelected(f, await fileToDataUrl(f));
  }

  async function handleRemoveBackground() {
    if (!sourceFile) return;
    setRemovingBg(true);
    const result = await exportTransparentArtworkAction(sourceFile);
    setRemovingBg(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    const newFile = await dataUrlToFile(result.data, "artwork.png");
    toast.success("Background removed — re-analyzing new artwork.");
    handleArtworkSelected(newFile, result.data);
  }

  async function handleConvert() {
    if (!sourceFile || !settings || !sourceDims) return;
    setConverting(true);
    const result = await convertToEmbroideryAction(sourceFile, settings, sourceDims.width, sourceDims.height);
    setConverting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setEmbroideryImage(result.data);
    setDirty(true);
  }

  async function handleSave() {
    if (!sourceImage) return;
    setSaving(true);
    const result = await saveEmbroideryDesignAction({
      id: savedId ?? undefined,
      name,
      sourceImage,
      embroideryImage,
      analysis,
      settings,
      placement: garmentPreview.placement,
      garmentPreview: garmentPreview as unknown as Record<string, unknown>,
      isFavorite,
      garmentType,
      garmentColor,
    });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setSavedId(result.data.id);
    setDirty(false);
    toast.success("Project saved");
    loadRecent();
  }

  async function handleDuplicate() {
    if (!sourceImage) return;
    setDuplicating(true);
    const result = await saveEmbroideryDesignAction({
      name: `${name} (Copy)`,
      sourceImage,
      embroideryImage,
      analysis,
      settings,
      placement: garmentPreview.placement,
      garmentPreview: garmentPreview as unknown as Record<string, unknown>,
      isFavorite: false,
      garmentType,
      garmentColor,
    });
    setDuplicating(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Duplicated — see it under Assets → Recent designs");
    loadRecent();
  }

  async function handleToggleFavorite() {
    if (savedId) {
      const result = await toggleFavoriteEmbroideryDesignAction(savedId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setIsFavorite(result.data.isFavorite);
    } else {
      setIsFavorite((v) => !v);
      setDirty(true);
    }
  }

  async function handleOpen(id: string) {
    const result = await getEmbroideryDesignAction(id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    const d = result.data;
    setSavedId(d.id);
    setName(d.name);
    setSourceImage(d.sourceImage);
    setEmbroideryImage(d.embroideryImage);
    setAnalysis(d.analysis);
    setIsFavorite(d.isFavorite);
    setGarmentType((d.garmentType as GarmentTypeId | null) ?? null);
    setGarmentColor(d.garmentColor);
    setDirty(false);
    const nextSettings = d.settings ?? (d.analysis ? DEFAULT_SETTINGS_FROM_ANALYSIS(d.analysis) : null);
    setSettings(nextSettings);
    // Restores the full saved transform when present; falls back to just
    // the placement column for rows saved before garmentPreview existed.
    const savedPreview = d.garmentPreview;
    const nextGarmentPreview: GarmentPreviewState =
      savedPreview && typeof savedPreview === "object"
        ? { ...DEFAULT_GARMENT_PREVIEW, ...(savedPreview as Partial<GarmentPreviewState>) }
        : { ...DEFAULT_GARMENT_PREVIEW, placement: (d.placement as GarmentPreviewState["placement"]) ?? "left-chest" };
    setGarmentPreview(nextGarmentPreview);
    resetHistory({ name: d.name, settings: nextSettings, garmentPreview: nextGarmentPreview, garmentType: (d.garmentType as GarmentTypeId | null) ?? null, garmentColor: d.garmentColor });
    try {
      const file = await dataUrlToFile(d.sourceImage, "artwork.png");
      setSourceFile(file);
      const img = await loadImage(d.sourceImage);
      setSourceDims({ width: img.naturalWidth, height: img.naturalHeight });
    } catch {
      setSourceDims({ width: 1024, height: 1024 });
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteEmbroideryDesignAction(id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    if (id === savedId) setSavedId(null);
    toast.success("Project deleted");
    loadRecent();
  }

  function handleApplyToGarment() {
    if (garmentPreview.garmentId && savedId && !dirty) return; // rendered as a real Link below
    setLeftTab("garment");
    setLeftSheetOpen(true);
    if (dirty) {
      toast.message("Save your changes first — Garment Studio would otherwise load the last saved version.");
    } else {
      toast.message(savedId ? "Choose a garment to apply this design to." : "Save this project and choose a garment first.");
    }
  }

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  const saveStatus: SaveStatus = saving ? "saving" : dirty ? "unsaved" : "saved";
  const stageIndex = !sourceImage ? 0 : analyzing || !analysis ? 1 : !embroideryImage ? 2 : STAGES.length - 1;
  const canExport = Boolean(embroideryImage && analysis && settings);

  return (
    <div className="fixed inset-0 z-40 bg-background flex flex-col">
      <EditorHeader
        saveStatus={saveStatus}
        isFavorite={isFavorite}
        onToggleFavorite={handleToggleFavorite}
        onDuplicate={handleDuplicate}
        duplicating={duplicating}
        canUndo={historyIndexRef.current > 0}
        canRedo={historyIndexRef.current < historyRef.current.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSave={handleSave}
        saving={saving}
        canSave={Boolean(sourceImage)}
        canExport={canExport}
        exportContent={
          canExport ? (
            <ExportActions name={name} embroideryImage={embroideryImage!} analysis={analysis!} settings={settings!} placement={garmentPreview.placement} sizePercent={garmentPreview.sizePercent} />
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">Convert artwork to embroidery first.</p>
          )
        }
      />

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left panel — desktop */}
        <div className="hidden lg:flex lg:w-[280px] shrink-0 border-r border-border bg-card flex-col overflow-hidden">
          <LeftPanelContent
            leftTab={leftTab}
            setLeftTab={setLeftTab}
            sourceImage={sourceImage}
            fileInputRef={fileInputRef}
            onFileInput={handleFileInput}
            onArtworkSelected={handleArtworkSelected}
            onRemoveBackground={handleRemoveBackground}
            removingBg={removingBg}
            onCenter={() => markDirty(setGarmentPreview)({ ...garmentPreview, offsetX: 0, offsetY: 0 })}
            onFit={() => markDirty(setGarmentPreview)({ ...garmentPreview, sizePercent: 100 })}
            garmentPreview={garmentPreview}
            onGarmentPreviewChange={markDirty(setGarmentPreview)}
            garmentType={garmentType}
            garmentColor={garmentColor}
            onGarmentTypeChange={markDirty(setGarmentType)}
            onGarmentColorChange={markDirty(setGarmentColor)}
            embroideryDesignId={savedId}
            dirty={dirty}
            recent={recent}
            onOpen={handleOpen}
            onDelete={handleDelete}
          />
        </div>

        {/* Canvas */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="lg:hidden flex items-center gap-2 px-3 py-2 border-b border-border bg-card shrink-0">
            <Button variant="outline" size="sm" onClick={() => setLeftSheetOpen(true)}>
              Design / Garment / Assets
            </Button>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setRightSheetOpen(true)}>
              Settings
            </Button>
          </div>

          <div className="px-4 py-2.5 border-b border-border bg-card shrink-0">
            <StageStepper index={stageIndex} />
          </div>

          <div className="flex-1 min-h-0 bg-muted/30 relative overflow-hidden">
            {!sourceImage ? (
              <div className="flex h-full items-center justify-center text-center px-6">
                <div>
                  <UploadCloud className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Upload or choose artwork to begin.</p>
                </div>
              </div>
            ) : garmentPreview.garmentImage && embroideryImage ? (
              <>
                <GarmentPreviewCanvas state={garmentPreview} onChange={markDirty(setGarmentPreview)} embroideryImage={embroideryImage} zoom={zoom} />
                <span className="absolute top-3 left-3 rounded-full bg-card border border-border px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                  Preview — approximate placement
                </span>
              </>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 h-full p-6">
                <div className="flex flex-col gap-2 min-h-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Original Artwork</p>
                  <div className="flex-1 rounded-xl border border-border bg-card overflow-hidden flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sourceImage} alt="Original artwork" className="max-w-full max-h-full object-contain" />
                  </div>
                </div>
                <div className="flex flex-col gap-2 min-h-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Embroidery Version</p>
                  <div className="flex-1 rounded-xl border border-border bg-card overflow-hidden flex items-center justify-center">
                    {converting ? (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <p className="text-xs">Creating embroidery version…</p>
                      </div>
                    ) : embroideryImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={embroideryImage} alt="Embroidery version" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <p className="text-xs text-muted-foreground px-4 text-center">Run &quot;Convert to Embroidery&quot; below to see the result here.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Canvas-local action strip — Convert lives here, next to what it acts on, always visible without scrolling. */}
          {sourceImage && !embroideryImage && (
            <div className="shrink-0 border-t border-border bg-card px-4 py-3 flex items-center justify-center">
              <Button onClick={handleConvert} disabled={converting || analyzing || !analysis}>
                {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {converting ? "Creating embroidery version…" : analyzing ? "Analyzing artwork…" : "Convert to Embroidery"}
              </Button>
            </div>
          )}

          {garmentPreview.garmentImage && embroideryImage && (
            <div className="lg:hidden shrink-0 border-t border-border bg-card px-3 py-2 flex items-center justify-center gap-2">
              <ZoomControls zoom={zoom} onZoom={setZoom} />
            </div>
          )}
        </div>

        {/* Right panel — desktop */}
        <div className="hidden lg:flex lg:w-[300px] shrink-0 border-l border-border bg-card flex-col overflow-hidden">
          <RightPanelContent
            analyzing={analyzing}
            analysis={analysis}
            embroideryImage={embroideryImage}
            settings={settings}
            onSettingsChange={markDirty(setSettings)}
            onRegenerate={handleConvert}
            regenerating={converting}
            garmentPreview={garmentPreview}
            onGarmentPreviewChange={markDirty(setGarmentPreview)}
            zoom={zoom}
            onZoom={setZoom}
            showZoom={Boolean(garmentPreview.garmentImage && embroideryImage)}
            name={name}
          />
        </div>
      </div>

      {/* Bottom action bar — always visible, independent of any panel scroll position */}
      <div className="shrink-0 flex items-center gap-3 border-t border-border bg-card px-4 py-2.5">
        <input
          value={name}
          onChange={(e) => markDirty(setName)(e.target.value)}
          placeholder="Project name"
          className="flex-1 min-w-0 max-w-[220px] bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
        />
        <div className="flex-1 hidden sm:block" />
        {garmentPreview.garmentId && savedId && !dirty ? (
          <Link
            href={`/design-studio/garment/${garmentPreview.garmentId}?tool=prints-logos&embroideryId=${savedId}`}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-primary hover:bg-accent transition-colors"
          >
            <Shirt className="w-3.5 h-3.5" /> Apply to Garment <ArrowRight className="w-3 h-3" />
          </Link>
        ) : (
          <Button variant="outline" size="sm" onClick={handleApplyToGarment} disabled={!embroideryImage}>
            <Shirt className="w-3.5 h-3.5" /> Apply to Garment
          </Button>
        )}
        <Button onClick={handleSave} disabled={saving || !sourceImage}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {saving ? "Saving…" : "Save Design"}
        </Button>
      </div>

      {/* Mobile/tablet drawers */}
      <Sheet open={leftSheetOpen} onOpenChange={setLeftSheetOpen}>
        <SheetContent side="left" className="w-full sm:max-w-sm flex flex-col">
          <SheetHeader>
            <SheetTitle>Design Studio</SheetTitle>
          </SheetHeader>
          <LeftPanelContent
            leftTab={leftTab}
            setLeftTab={setLeftTab}
            sourceImage={sourceImage}
            fileInputRef={fileInputRef}
            onFileInput={handleFileInput}
            onArtworkSelected={handleArtworkSelected}
            onRemoveBackground={handleRemoveBackground}
            removingBg={removingBg}
            onCenter={() => markDirty(setGarmentPreview)({ ...garmentPreview, offsetX: 0, offsetY: 0 })}
            onFit={() => markDirty(setGarmentPreview)({ ...garmentPreview, sizePercent: 100 })}
            garmentPreview={garmentPreview}
            onGarmentPreviewChange={markDirty(setGarmentPreview)}
            garmentType={garmentType}
            garmentColor={garmentColor}
            onGarmentTypeChange={markDirty(setGarmentType)}
            onGarmentColorChange={markDirty(setGarmentColor)}
            embroideryDesignId={savedId}
            dirty={dirty}
            recent={recent}
            onOpen={(id) => {
              handleOpen(id);
              setLeftSheetOpen(false);
            }}
            onDelete={handleDelete}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={rightSheetOpen} onOpenChange={setRightSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-sm flex flex-col">
          <SheetHeader>
            <SheetTitle>Embroidery Settings</SheetTitle>
          </SheetHeader>
          <RightPanelContent
            analyzing={analyzing}
            analysis={analysis}
            embroideryImage={embroideryImage}
            settings={settings}
            onSettingsChange={markDirty(setSettings)}
            onRegenerate={handleConvert}
            regenerating={converting}
            garmentPreview={garmentPreview}
            onGarmentPreviewChange={markDirty(setGarmentPreview)}
            zoom={zoom}
            onZoom={setZoom}
            showZoom={Boolean(garmentPreview.garmentImage && embroideryImage)}
            name={name}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ZoomControls({ zoom, onZoom }: { zoom: number; onZoom: (z: number) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-background px-1 py-1">
      <Button variant="ghost" size="icon-xs" onClick={() => onZoom(Math.max(50, zoom - 10))} aria-label="Zoom out">
        <Minus className="w-3.5 h-3.5" />
      </Button>
      <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">{zoom}%</span>
      <Button variant="ghost" size="icon-xs" onClick={() => onZoom(Math.min(200, zoom + 10))} aria-label="Zoom in">
        <Plus className="w-3.5 h-3.5" />
      </Button>
      <div className="h-4 w-px bg-border mx-0.5" />
      <Button variant="ghost" size="icon-xs" onClick={() => onZoom(100)} aria-label="Fit">
        <Maximize className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="icon-xs" onClick={() => onZoom(100)} aria-label="Reset zoom">
        <RotateCcw className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

function LeftPanelContent({
  leftTab,
  setLeftTab,
  sourceImage,
  fileInputRef,
  onFileInput,
  onArtworkSelected,
  onRemoveBackground,
  removingBg,
  onCenter,
  onFit,
  garmentPreview,
  onGarmentPreviewChange,
  garmentType,
  garmentColor,
  onGarmentTypeChange,
  onGarmentColorChange,
  embroideryDesignId,
  dirty,
  recent,
  onOpen,
  onDelete,
}: {
  leftTab: LeftTab;
  setLeftTab: (t: LeftTab) => void;
  sourceImage: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileInput: (files: FileList) => void;
  onArtworkSelected: (file: File, dataUrl: string) => void;
  onRemoveBackground: () => void;
  removingBg: boolean;
  onCenter: () => void;
  onFit: () => void;
  garmentPreview: GarmentPreviewState;
  onGarmentPreviewChange: (s: GarmentPreviewState) => void;
  garmentType: GarmentTypeId | null;
  garmentColor: string | null;
  onGarmentTypeChange: (t: GarmentTypeId) => void;
  onGarmentColorChange: (hex: string) => void;
  embroideryDesignId: string | null;
  dirty: boolean;
  recent: EmbroideryDesignSummary[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex border-b border-border shrink-0">
        {(
          [
            ["design", "Design"],
            ["garment", "Garment"],
            ["assets", "Assets"],
          ] as [LeftTab, string][]
        ).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setLeftTab(tab)}
            className={cn(
              "flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors",
              leftTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-4">
        {leftTab === "design" && (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Artwork</p>
              {sourceImage ? (
                <div className="rounded-lg overflow-hidden border border-border mb-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sourceImage} alt="Current artwork" className="w-full aspect-square object-contain bg-muted/30" />
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-muted/40 hover:bg-muted/60 px-4 py-8 text-center cursor-pointer transition-colors"
                >
                  <UploadCloud className="w-5 h-5 text-muted-foreground" />
                  <p className="text-xs text-foreground">
                    Upload Artwork <br />
                    <span className="text-muted-foreground">PNG or JPG</span>
                  </p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => e.target.files?.length && onFileInput(e.target.files)} />
              <div className="space-y-1.5">
                {sourceImage && (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()}>
                    <UploadCloud className="w-3.5 h-3.5" /> Replace artwork
                  </Button>
                )}
                <ArtworkSourcePicker
                  trigger={
                    <Button variant="ghost" size="sm" className="w-full">
                      Choose from Pattern Library or Garment Studio
                    </Button>
                  }
                  onSelect={(file, dataUrl) => onArtworkSelected(file, dataUrl)}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">PNG, JPG. SVG isn&apos;t supported yet.</p>
            </div>

            {sourceImage && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Quick Actions</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button variant="outline" size="sm" onClick={onRemoveBackground} disabled={removingBg}>
                    {removingBg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scissors className="w-3.5 h-3.5" />}
                    Remove BG
                  </Button>
                  <Button variant="outline" size="sm" onClick={onCenter} disabled={!garmentPreview.garmentImage}>
                    Center
                  </Button>
                  <Button variant="outline" size="sm" onClick={onFit} disabled={!garmentPreview.garmentImage}>
                    Fit to canvas
                  </Button>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  &quot;Remove BG&quot; re-runs the artwork through AI background removal and re-analyzes the result.
                </p>
              </div>
            )}
          </div>
        )}

        {leftTab === "garment" && (
          <GarmentPreviewPanel
            state={garmentPreview}
            onChange={onGarmentPreviewChange}
            garmentType={garmentType}
            garmentColor={garmentColor}
            onGarmentTypeChange={onGarmentTypeChange}
            onGarmentColorChange={onGarmentColorChange}
            embroideryDesignId={embroideryDesignId}
            dirty={dirty}
          />
        )}

        {leftTab === "assets" && (
          <div className="space-y-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Pattern Library &amp; Garment Studio</p>
              <ArtworkSourcePicker
                trigger={
                  <Button variant="outline" size="sm" className="w-full">
                    <Grid3x3 className="w-3.5 h-3.5" /> Browse assets
                  </Button>
                }
                onSelect={(file, dataUrl) => onArtworkSelected(file, dataUrl)}
              />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Recent Designs</p>
              {recent.length === 0 ? (
                <p className="text-xs text-muted-foreground">No saved embroidery projects yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {recent.map((d) => (
                    <div key={d.id} className="group relative rounded-lg overflow-hidden border border-border bg-card">
                      <button type="button" onClick={() => onOpen(d.id)} className="block w-full text-left">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={d.embroideryImage ?? d.sourceImage} alt={d.name} className="w-full aspect-square object-cover" />
                        <div className="p-1.5">
                          <p className="text-[11px] font-medium text-foreground truncate">{d.name}</p>
                          <p className="text-[9px] text-muted-foreground truncate">{formatRelativeTime(d.updatedAt)}</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(d.id);
                        }}
                        aria-label={`Delete ${d.name}`}
                        className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RightPanelContent({
  analyzing,
  analysis,
  embroideryImage,
  settings,
  onSettingsChange,
  onRegenerate,
  regenerating,
  garmentPreview,
  onGarmentPreviewChange,
  zoom,
  onZoom,
  showZoom,
  name,
}: {
  analyzing: boolean;
  analysis: EmbroideryAnalysis | null;
  embroideryImage: string | null;
  settings: EmbroiderySettings | null;
  onSettingsChange: (s: EmbroiderySettings) => void;
  onRegenerate: () => void;
  regenerating: boolean;
  garmentPreview: GarmentPreviewState;
  onGarmentPreviewChange: (s: GarmentPreviewState) => void;
  zoom: number;
  onZoom: (z: number) => void;
  showZoom: boolean;
  name: string;
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-4 space-y-4">
      {showZoom && (
        <div className="hidden lg:flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Canvas</p>
          <ZoomControls zoom={zoom} onZoom={onZoom} />
        </div>
      )}

      <CollapsibleSection title="Analysis">
        <AnalysisPanel analysis={analysis} loading={analyzing} />
      </CollapsibleSection>

      {settings && (
        <CollapsibleSection title="Embroidery Style">
          <EmbroideryStyleCards value={settings.style} onChange={(id) => onSettingsChange({ ...settings, style: id })} />
        </CollapsibleSection>
      )}

      {settings && (
        <CollapsibleSection title="Thread Colors" badge={<span className="text-[10px] text-muted-foreground">{settings.threadColors.length}</span>}>
          <ThreadColorsPanel colors={settings.threadColors} onChange={(colors) => onSettingsChange({ ...settings, threadColors: colors })} />
        </CollapsibleSection>
      )}

      {embroideryImage && (
        <CollapsibleSection title="Design Settings">
          <DesignSettingsPanel state={garmentPreview} onChange={onGarmentPreviewChange} />
        </CollapsibleSection>
      )}

      {settings && embroideryImage && (
        <CollapsibleSection title="Refine">
          <RefinePanel settings={settings} onChange={onSettingsChange} onRegenerate={onRegenerate} onReset={() => analysis && onSettingsChange(DEFAULT_SETTINGS_FROM_ANALYSIS(analysis))} regenerating={regenerating} />
        </CollapsibleSection>
      )}

      {embroideryImage && analysis && settings && (
        <CollapsibleSection title="Production">
          <ProductionPanel analysis={analysis} settings={settings} placement={garmentPreview.placement} sizePercent={garmentPreview.sizePercent} />
        </CollapsibleSection>
      )}

      {embroideryImage && analysis && settings && (
        <CollapsibleSection title="Export" defaultOpen={false}>
          <ExportActions name={name} embroideryImage={embroideryImage} analysis={analysis} settings={settings} placement={garmentPreview.placement} sizePercent={garmentPreview.sizePercent} />
        </CollapsibleSection>
      )}
    </div>
  );
}
