"use client";

import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { StudioNav } from "@/components/design-studio/StudioNav";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadStep } from "@/components/garment-studio/ToolControls";
import { loadImage } from "@/lib/garment-canvas";
import { dataUrlToFile } from "@/lib/file-to-data-url";
import { analyzeFrontDesignAction, generateBackDesignAction, regenerateBackDesignAction, getBackDesignAction } from "@/services/garment-back-design";

type Stage = "idle" | "analyzing" | "generating";

export default function GarmentBackDesignPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { open: openId } = use(searchParams);

  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [frontDataUrl, setFrontDataUrl] = useState<string | null>(null);
  const [backDescription, setBackDescription] = useState("");
  const [designId, setDesignId] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [loadingExisting, setLoadingExisting] = useState(Boolean(openId));

  useEffect(() => {
    if (!openId) return;
    getBackDesignAction(openId).then(async (result) => {
      setLoadingExisting(false);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const d = result.data;
      setDesignId(d.id);
      setFrontDataUrl(d.frontImage);
      setBackDescription(d.backDescription ?? "");
      const latest = d.versions[d.versions.length - 1];
      setBackImage(latest?.image ?? null);
      try {
        setFrontFile(await dataUrlToFile(d.frontImage, "front.png"));
      } catch {
        // Regenerate will just prompt to re-upload if this fails — reopening for viewing still works.
      }
    });
  }, [openId]);

  function handleFileSelected(file: File | null, dataUrl: string | null) {
    setFrontFile(file);
    setFrontDataUrl(dataUrl);
    setDesignId(null);
    setBackImage(null);
  }

  async function handleGenerate() {
    if (!frontFile || !frontDataUrl) {
      toast.error("Upload a front-view style image first.");
      return;
    }

    setStage("analyzing");
    const analysis = await analyzeFrontDesignAction(frontFile);
    if (!analysis.success) {
      toast.error(analysis.error);
      setStage("idle");
      return;
    }

    setStage("generating");
    let width = 1024;
    let height = 1024;
    try {
      const img = await loadImage(frontDataUrl);
      width = img.naturalWidth;
      height = img.naturalHeight;
    } catch {
      // Fall back to the default square size.
    }

    if (designId) {
      const result = await regenerateBackDesignAction(designId, analysis.data, backDescription, width, height);
      setStage("idle");
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setBackImage(result.data.image);
      toast.success("Back design regenerated");
    } else {
      const result = await generateBackDesignAction(frontFile, analysis.data, backDescription, width, height);
      setStage("idle");
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setBackImage(result.data.image);
      setDesignId(result.data.id);
      toast.success("Back design generated");
    }
  }

  function handleDownload() {
    if (!backImage) return;
    const link = document.createElement("a");
    link.href = backImage;
    link.download = "garment-back-design.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const generating = stage !== "idle";
  const generateLabel = stage === "analyzing" ? "Analyzing front design…" : stage === "generating" ? "Generating back design…" : "Generate Back Design";

  return (
    <div>
      <StudioNav />
      <div className="mt-6">
        <PageHeader
          title="Garment Back Design"
          description="Upload the front view of a garment and generate a matching back view — same silhouette, fabric, color palette, and construction details."
        />
      </div>

      {loadingExisting ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading design…</div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">1. Upload style image</p>
              <p className="text-sm text-muted-foreground mb-2">PNG, JPG, JPEG, or WEBP — the front view of the garment.</p>
              <ImageUploadStep dataUrl={frontDataUrl} onChange={handleFileSelected} label="Front garment reference" optional={false} />
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground mb-1">2. Back description (optional)</p>
              <p className="text-sm text-muted-foreground mb-2">Describe anything specific about the back.</p>
              <Textarea
                value={backDescription}
                onChange={(e) => setBackDescription(e.target.value)}
                placeholder='e.g. "Continue the floral print on the back"'
                className="min-h-20 max-h-40 overflow-y-auto"
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground mb-1">3. Generate</p>
              <Button className="w-full" onClick={handleGenerate} disabled={generating || !frontFile}>
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generateLabel}
              </Button>
            </div>
          </div>

          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Front Reference</p>
                <div className="aspect-square rounded-xl border border-border bg-muted/30 overflow-hidden flex items-center justify-center">
                  {frontDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={frontDataUrl} alt="Front reference" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <p className="text-xs text-muted-foreground px-4 text-center">Upload a style image to begin.</p>
                  )}
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Back Design</p>
                <div className="aspect-square rounded-xl border border-border bg-muted/30 overflow-hidden flex items-center justify-center">
                  {generating ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <p className="text-xs">{stage === "analyzing" ? "Analyzing front design…" : "Generating back design…"}</p>
                    </div>
                  ) : backImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={backImage} alt="Generated back design" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <p className="text-xs text-muted-foreground px-4 text-center">Click &quot;Generate Back Design&quot; to see the result here.</p>
                  )}
                </div>
              </div>
            </div>

            {backImage && !generating && (
              <div className="flex items-center gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={handleGenerate}>
                  <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="w-3.5 h-3.5" /> Download
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
