"use client";

import { use, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { StudioNav } from "@/components/design-studio/StudioNav";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ArtworkSourcePicker } from "@/components/embroidery/ArtworkSourcePicker";
import { AnalysisPanel } from "@/components/embroidery/AnalysisPanel";
import { EmbroiderySettingsPanel } from "@/components/embroidery/EmbroiderySettingsPanel";
import { GarmentPreviewPanel, GarmentPreviewCanvas, DEFAULT_GARMENT_PREVIEW, type GarmentPreviewState } from "@/components/embroidery/GarmentPreviewPanel";
import { ProductionExportPanel } from "@/components/embroidery/ProductionExportPanel";
import { validateImage } from "@/lib/file-validation";
import { fileToDataUrl, dataUrlToFile } from "@/lib/file-to-data-url";
import { loadImage } from "@/lib/garment-canvas";
import { formatRelativeTime } from "@/utils/format";
import { DEFAULT_SETTINGS_FROM_ANALYSIS, type EmbroideryAnalysis, type EmbroiderySettings } from "@/lib/embroidery-production";
import {
  analyzeArtworkAction,
  convertToEmbroideryAction,
  saveEmbroideryDesignAction,
  getRecentEmbroideryDesignsAction,
  getEmbroideryDesignAction,
  deleteEmbroideryDesignAction,
  type EmbroideryDesignSummary,
} from "@/services/embroidery";

const STAGES = ["Upload", "Analyze", "Convert", "Refine", "Preview", "Production", "Export"] as const;

function StageStepper({ index }: { index: number }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
      {STAGES.map((stage, i) => (
        <div key={stage} className="flex items-center gap-1 shrink-0">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap ${i <= index ? "bg-primary/10 text-primary" : "text-muted-foreground/60"}`}>{stage}</span>
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

  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [recent, setRecent] = useState<EmbroideryDesignSummary[]>([]);

  useEffect(() => {
    loadRecent();
  }, []);

  useEffect(() => {
    if (openId) handleOpen(openId);
  }, [openId]);

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
    setSettings(DEFAULT_SETTINGS_FROM_ANALYSIS(result.data));
  }

  async function handleArtworkSelected(file: File, dataUrl: string) {
    setSourceFile(file);
    setSourceImage(dataUrl);
    setEmbroideryImage(null);
    setAnalysis(null);
    setSettings(null);
    setSavedId(null);
    setGarmentPreview(DEFAULT_GARMENT_PREVIEW);
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
    });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setSavedId(result.data.id);
    toast.success("Project saved");
    loadRecent();
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
    setSettings(d.settings ?? (d.analysis ? DEFAULT_SETTINGS_FROM_ANALYSIS(d.analysis) : null));
    setGarmentPreview({ ...DEFAULT_GARMENT_PREVIEW, placement: (d.placement as GarmentPreviewState["placement"]) ?? "left-chest" });
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

  // Refine/Preview/Production/Export all unlock together once conversion
  // completes (they're simultaneous panels, not a strict sequence), so the
  // stepper jumps straight to the last stage rather than stopping at
  // "Preview" until a garment happens to be chosen.
  const stageIndex = !sourceImage ? 0 : analyzing || !analysis ? 1 : !embroideryImage ? 2 : STAGES.length - 1;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] min-h-[600px]">
      <StudioNav />
      <div className="mt-6 mb-4">
        <PageHeader title="Print → Embroidery" description="Convert artwork into an embroidery concept and preview it on a garment." className="mb-4" />
        <StageStepper index={stageIndex} />
      </div>

      <div className="flex-1 min-h-0 rounded-2xl border border-border bg-card overflow-hidden flex flex-col lg:flex-row">
        {/* Controls */}
        <div className="lg:w-[300px] shrink-0 border-b lg:border-b-0 lg:border-r border-border overflow-y-auto scrollbar-thin p-4 space-y-6 max-h-[40vh] lg:max-h-none">
          <div>
            <p className="text-sm font-semibold text-foreground mb-2">Artwork</p>
            {sourceImage ? (
              <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()}>
                <UploadCloud className="w-3.5 h-3.5" /> Replace artwork
              </Button>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border bg-muted/40 hover:bg-muted/60 px-4 py-8 text-center cursor-pointer transition-colors"
              >
                <UploadCloud className="w-5 h-5 text-muted-foreground" />
                <p className="text-xs text-foreground">
                  Upload Artwork <br />
                  <span className="text-muted-foreground">PNG or JPG</span>
                </p>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => e.target.files?.length && handleFileInput(e.target.files)} />
            <ArtworkSourcePicker
              trigger={
                <Button variant="ghost" size="sm" className="w-full mt-2">
                  Choose from Pattern Library or Garment Studio
                </Button>
              }
              onSelect={(file, dataUrl) => handleArtworkSelected(file, dataUrl)}
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">Supported formats: PNG, JPG. SVG isn&apos;t supported yet — see Known Limitations.</p>
          </div>

          {sourceImage && !embroideryImage && (
            <Button className="w-full" onClick={handleConvert} disabled={converting || analyzing || !analysis}>
              {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {converting ? "Creating embroidery version…" : "Convert to Embroidery"}
            </Button>
          )}

          {embroideryImage && settings && (
            <EmbroiderySettingsPanel
              settings={settings}
              onChange={setSettings}
              onRegenerate={handleConvert}
              onReset={() => analysis && setSettings(DEFAULT_SETTINGS_FROM_ANALYSIS(analysis))}
              regenerating={converting}
            />
          )}

          {embroideryImage && (
            <GarmentPreviewPanel state={garmentPreview} onChange={setGarmentPreview} embroideryDesignId={savedId} />
          )}
        </div>

        {/* Canvas */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-auto scrollbar-thin p-6">
            {!sourceImage ? (
              <div className="flex h-full items-center justify-center text-center px-6">
                <p className="text-sm text-muted-foreground">Upload or choose artwork to begin.</p>
              </div>
            ) : garmentPreview.garmentImage && embroideryImage ? (
              <GarmentPreviewCanvas state={garmentPreview} embroideryImage={embroideryImage} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 h-full">
                <div className="flex flex-col gap-2 min-h-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Original Artwork</p>
                  <div className="flex-1 rounded-xl border border-border bg-muted/20 overflow-hidden flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sourceImage} alt="Original artwork" className="max-w-full max-h-full object-contain" />
                  </div>
                </div>
                <div className="flex flex-col gap-2 min-h-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Embroidery Version</p>
                  <div className="flex-1 rounded-xl border border-border bg-muted/20 overflow-hidden flex items-center justify-center">
                    {converting ? (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <p className="text-xs">Creating embroidery version…</p>
                      </div>
                    ) : embroideryImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={embroideryImage} alt="Embroidery version" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <p className="text-xs text-muted-foreground px-4 text-center">Run &quot;Convert to Embroidery&quot; to see the result here.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="lg:w-[300px] shrink-0 border-t lg:border-t-0 lg:border-l border-border overflow-y-auto scrollbar-thin p-4 space-y-6 max-h-[40vh] lg:max-h-none">
          <AnalysisPanel analysis={analysis} loading={analyzing} />
          {embroideryImage && analysis && settings && (
            <ProductionExportPanel name={name} analysis={analysis} settings={settings} placement={garmentPreview.placement} sizePercent={garmentPreview.sizePercent} embroideryImage={embroideryImage} />
          )}
        </div>
      </div>

      {/* Main action bar — always visible regardless of scroll position in any panel above */}
      <div className="shrink-0 mt-4 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name"
          className="flex-1 min-w-0 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
        />
        {embroideryImage && (
          <Button variant="outline" onClick={handleConvert} disabled={converting}>
            {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Regenerate
          </Button>
        )}
        <Button onClick={handleSave} disabled={saving || !sourceImage}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      {recent.length > 0 && (
        <div className="mt-6 shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recent Embroidery Projects</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {recent.map((d) => (
              <div key={d.id} className="group relative rounded-xl overflow-hidden border border-border bg-card">
                <button type="button" onClick={() => handleOpen(d.id)} className="block w-full text-left">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.embroideryImage ?? d.sourceImage} alt={d.name} className="w-full aspect-square object-cover" />
                  <div className="p-2">
                    <p className="text-xs font-semibold text-foreground truncate">{d.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {d.ownerName} · {formatRelativeTime(d.updatedAt)}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(d.id);
                  }}
                  aria-label={`Delete ${d.name}`}
                  className="absolute top-1.5 right-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
