"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { EditorSidebar, type EditTool } from "@/components/garment-studio/EditorSidebar";
import { EditToolPanel } from "@/components/garment-studio/EditToolPanel";
import { GarmentCanvas, type GarmentCanvasHandle, type PreviewConfig } from "@/components/garment-studio/GarmentCanvas";
import { HistoryPanel } from "@/components/garment-studio/HistoryPanel";
import { PreviewToggle, SettingSlider, ImageUploadStep, PromptStep, ColorPickerStep } from "@/components/garment-studio/ToolControls";
import {
  getGarmentDesignAction,
  changeRegionAction,
  regenerateRegionAction,
  removeRegionAction,
  applyPatternAction,
  applyPrintLogoAction,
  colorizeRegionAction,
  commitGarmentEditAction,
  type GarmentDesignDetail,
} from "@/services/garment-studio";

export default function GarmentEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const canvasRef = useRef<GarmentCanvasHandle>(null);

  const [design, setDesign] = useState<GarmentDesignDetail | null>(null);
  const [activeVersionId, setActiveVersionId] = useState("");
  const [activeTool, setActiveTool] = useState<EditTool>("change");
  const [saving, setSaving] = useState(false);

  const [changePrompt, setChangePrompt] = useState("");
  const [regeneratePrompt, setRegeneratePrompt] = useState("");

  const [patternFile, setPatternFile] = useState<File | null>(null);
  const [patternDataUrl, setPatternDataUrl] = useState<string | null>(null);
  const [patternPreviewOn, setPatternPreviewOn] = useState(false);
  const [patternBrightness, setPatternBrightness] = useState(50);
  const [patternScale, setPatternScale] = useState(100);
  const [patternRotation, setPatternRotation] = useState(0);
  const [patternOffset, setPatternOffset] = useState({ x: 0, y: 0 });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoPreviewOn, setLogoPreviewOn] = useState(false);
  const [logoBrightness, setLogoBrightness] = useState(50);
  const [logoScale, setLogoScale] = useState(100);
  const [logoRotation, setLogoRotation] = useState(0);
  const [logoOffset, setLogoOffset] = useState({ x: 0, y: 0 });

  const [colorHex, setColorHex] = useState("#EF4444");
  const [colorPreviewOn, setColorPreviewOn] = useState(false);
  const [colorBrightness, setColorBrightness] = useState(50);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load(keepVersionId?: string) {
    const result = await getGarmentDesignAction(id);
    if (!result.success) {
      toast.error(result.error);
      router.push("/design-studio/garment");
      return;
    }
    setDesign(result.data);
    const versions = result.data.versions;
    setActiveVersionId(keepVersionId ?? versions[versions.length - 1].id);
  }

  function resetLocalEditorState() {
    canvasRef.current?.clearMask();
    setChangePrompt("");
    setRegeneratePrompt("");
    setPatternPreviewOn(false);
    setLogoPreviewOn(false);
    setColorPreviewOn(false);
  }

  async function afterApply(versionId: string) {
    await load(versionId);
    resetLocalEditorState();
    toast.success("Applied");
  }

  async function requireMaskedImage(): Promise<{ image: Blob; mask: Blob; width: number; height: number } | null> {
    if (!canvasRef.current) return null;
    if (canvasRef.current.isMaskEmpty()) {
      toast.error("Mask an area first.");
      return null;
    }
    const [image, mask] = await Promise.all([canvasRef.current.getImageBlob(), canvasRef.current.getMaskBlob()]);
    const { width, height } = canvasRef.current.getDimensions();
    return { image, mask, width, height };
  }

  /** Runs after any of the six edit-tool actions returns its raw AI
   * result: composites it against the original (outside the mask is
   * guaranteed to stay the original's exact pixels — see
   * GarmentCanvas.compositeWithAiResult) BEFORE persisting anything, then
   * commits that composited image as the new version. The raw AI response
   * is never itself persisted or displayed. */
  async function compositeAndCommit(result: { success: true; data: { image: string; label: string } } | { success: false; error: string }): Promise<string | null> {
    if (!result.success) {
      toast.error(result.error);
      return null;
    }
    if (!canvasRef.current || !design) return null;
    const composited = await canvasRef.current.compositeWithAiResult(result.data.image);
    const commit = await commitGarmentEditAction(design.id, composited, result.data.label);
    if (!commit.success) {
      toast.error(commit.error);
      return null;
    }
    return commit.data.versionId;
  }

  async function handleChangeSave() {
    if (!design) return;
    if (!changePrompt.trim()) return toast.error("Describe the change you want.");
    const inputs = await requireMaskedImage();
    if (!inputs) return;
    setSaving(true);
    const result = await changeRegionAction(design.id, inputs.image, inputs.mask, changePrompt, inputs.width, inputs.height);
    const versionId = await compositeAndCommit(result);
    setSaving(false);
    if (!versionId) return;
    await afterApply(versionId);
  }

  async function handleRegenerateSave() {
    if (!design) return;
    const inputs = await requireMaskedImage();
    if (!inputs) return;
    setSaving(true);
    const result = await regenerateRegionAction(design.id, inputs.image, inputs.mask, regeneratePrompt || undefined, inputs.width, inputs.height);
    const versionId = await compositeAndCommit(result);
    setSaving(false);
    if (!versionId) return;
    await afterApply(versionId);
  }

  async function handleRemoveSave() {
    if (!design) return;
    const inputs = await requireMaskedImage();
    if (!inputs) return;
    setSaving(true);
    const result = await removeRegionAction(design.id, inputs.image, inputs.mask, inputs.width, inputs.height);
    const versionId = await compositeAndCommit(result);
    setSaving(false);
    if (!versionId) return;
    await afterApply(versionId);
  }

  async function handlePatternSave() {
    if (!design) return;
    if (!patternFile) return toast.error("Upload a pattern image first.");
    const inputs = await requireMaskedImage();
    if (!inputs) return;
    setSaving(true);
    const result = await applyPatternAction(design.id, inputs.image, inputs.mask, patternFile, patternScale, patternRotation, patternBrightness, inputs.width, inputs.height);
    const versionId = await compositeAndCommit(result);
    setSaving(false);
    if (!versionId) return;
    setPatternFile(null);
    setPatternDataUrl(null);
    await afterApply(versionId);
  }

  async function handleLogoSave() {
    if (!design) return;
    if (!logoFile) return toast.error("Upload a print or logo image first.");
    const inputs = await requireMaskedImage();
    if (!inputs) return;
    setSaving(true);
    const result = await applyPrintLogoAction(design.id, inputs.image, inputs.mask, logoFile, logoScale, logoRotation, logoBrightness, inputs.width, inputs.height);
    const versionId = await compositeAndCommit(result);
    setSaving(false);
    if (!versionId) return;
    setLogoFile(null);
    setLogoDataUrl(null);
    await afterApply(versionId);
  }

  async function handleColorizeSave() {
    if (!design) return;
    const inputs = await requireMaskedImage();
    if (!inputs) return;
    setSaving(true);
    const result = await colorizeRegionAction(design.id, inputs.image, inputs.mask, colorHex, colorBrightness, inputs.width, inputs.height);
    const versionId = await compositeAndCommit(result);
    setSaving(false);
    if (!versionId) return;
    await afterApply(versionId);
  }

  function handleDownload() {
    const activeVersion = design?.versions.find((v) => v.id === activeVersionId);
    if (!activeVersion) return;
    const link = document.createElement("a");
    link.href = activeVersion.image;
    link.download = `${design!.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (!design) {
    return (
      <div className="fixed inset-0 z-40 bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeVersion = design.versions.find((v) => v.id === activeVersionId) ?? design.versions[design.versions.length - 1];

  let preview: PreviewConfig = null;
  if (activeTool === "patterns" && patternPreviewOn && patternDataUrl) {
    preview = {
      kind: "pattern",
      patternDataUrl,
      scalePercent: patternScale,
      rotationDeg: patternRotation,
      brightnessPercent: patternBrightness,
      offsetX: patternOffset.x,
      offsetY: patternOffset.y,
    };
  } else if (activeTool === "prints-logos" && logoPreviewOn && logoDataUrl) {
    preview = {
      kind: "logo",
      patternDataUrl: logoDataUrl,
      scalePercent: logoScale,
      rotationDeg: logoRotation,
      brightnessPercent: logoBrightness,
      offsetX: logoOffset.x,
      offsetY: logoOffset.y,
    };
  } else if (activeTool === "colorize" && colorPreviewOn) {
    preview = { kind: "colorize", colorHex, brightnessPercent: colorBrightness };
  }

  return (
    <div className="fixed inset-0 z-40 bg-background flex flex-col">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border bg-card shrink-0">
        <button
          type="button"
          onClick={() => router.push("/design-studio/garment")}
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> AI Garment Studio
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
        >
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-20 shrink-0 border-r border-border bg-card overflow-y-auto scrollbar-thin">
          <EditorSidebar active={activeTool} onSelect={setActiveTool} />
        </div>

        <div className="w-[340px] shrink-0 min-h-0 border-r border-border bg-card overflow-hidden">
          {activeTool === "change" && (
            <EditToolPanel
              toolTitle="Change the selected area"
              maskInstruction="Mask an area to describe a change"
              extraSteps={[{ title: "Describe the change", content: <PromptStep value={changePrompt} onChange={setChangePrompt} placeholder="e.g. Make this a puff sleeve" /> }]}
              onSave={handleChangeSave}
              saving={saving}
            />
          )}
          {activeTool === "regenerate" && (
            <EditToolPanel
              toolTitle="Regenerate the selected area"
              maskInstruction="Mask an area to regenerate"
              extraSteps={[{ title: "Guidance (optional)", content: <PromptStep value={regeneratePrompt} onChange={setRegeneratePrompt} placeholder="Leave blank for a fresh interpretation" /> }]}
              saveLabel="Regenerate"
              onSave={handleRegenerateSave}
              saving={saving}
            />
          )}
          {activeTool === "remove" && (
            <EditToolPanel toolTitle="Remove the selected detail" maskInstruction="Mask the detail you want removed" saveLabel="Remove" onSave={handleRemoveSave} saving={saving} />
          )}
          {activeTool === "patterns" && (
            <EditToolPanel
              toolTitle="Apply pattern to selected area"
              maskInstruction="Mask an area to apply your pattern"
              extraSteps={[
                { title: "Upload pattern", content: <ImageUploadStep dataUrl={patternDataUrl} onChange={(f, u) => { setPatternFile(f); setPatternDataUrl(u); }} /> },
                {
                  title: "Adjust settings",
                  content: (
                    <div>
                      <div className="mb-3">
                        <PreviewToggle on={patternPreviewOn} onChange={setPatternPreviewOn} />
                      </div>
                      <SettingSlider label="Brightness" value={patternBrightness} unit="%" min={0} max={100} onChange={setPatternBrightness} />
                      <SettingSlider label="Scale" value={patternScale} unit="%" min={10} max={300} onChange={setPatternScale} />
                      <SettingSlider label="Rotation" value={patternRotation} unit="°" min={0} max={360} onChange={setPatternRotation} />
                    </div>
                  ),
                },
              ]}
              onSave={handlePatternSave}
              saving={saving}
            />
          )}
          {activeTool === "prints-logos" && (
            <EditToolPanel
              toolTitle="Apply print/logo to selected area"
              maskInstruction="Mask an area to apply your print or logo"
              extraSteps={[
                { title: "Upload print/logo", content: <ImageUploadStep dataUrl={logoDataUrl} onChange={(f, u) => { setLogoFile(f); setLogoDataUrl(u); }} /> },
                {
                  title: "Adjust settings",
                  content: (
                    <div>
                      <div className="mb-3">
                        <PreviewToggle on={logoPreviewOn} onChange={setLogoPreviewOn} />
                      </div>
                      <SettingSlider label="Brightness" value={logoBrightness} unit="%" min={0} max={100} onChange={setLogoBrightness} />
                      <SettingSlider label="Scale" value={logoScale} unit="%" min={10} max={300} onChange={setLogoScale} />
                      <SettingSlider label="Rotation" value={logoRotation} unit="°" min={0} max={360} onChange={setLogoRotation} />
                    </div>
                  ),
                },
              ]}
              onSave={handleLogoSave}
              saving={saving}
            />
          )}
          {activeTool === "colorize" && (
            <EditToolPanel
              toolTitle="Colorize the selected area"
              maskInstruction="Mask an area to recolor"
              extraSteps={[
                { title: "Choose color", content: <ColorPickerStep value={colorHex} onChange={setColorHex} /> },
                {
                  title: "Adjust settings",
                  content: (
                    <div>
                      <div className="mb-3">
                        <PreviewToggle on={colorPreviewOn} onChange={setColorPreviewOn} />
                      </div>
                      <SettingSlider label="Brightness" value={colorBrightness} unit="%" min={0} max={100} onChange={setColorBrightness} />
                    </div>
                  ),
                },
              ]}
              saveLabel="Colorize"
              onSave={handleColorizeSave}
              saving={saving}
            />
          )}
        </div>

        <div className="flex-1 min-w-0 min-h-0">
          <GarmentCanvas
            ref={canvasRef}
            imageUrl={activeVersion.image}
            thumbnailUrl={activeVersion.image}
            preview={preview}
            onPatternOffsetChange={
              activeTool === "patterns"
                ? (x, y) => setPatternOffset({ x, y })
                : activeTool === "prints-logos"
                  ? (x, y) => setLogoOffset({ x, y })
                  : undefined
            }
          />
        </div>

        <div className="w-64 shrink-0 min-h-0 border-l border-border bg-card">
          <HistoryPanel versions={design.versions} activeVersionId={activeVersion.id} onSelect={setActiveVersionId} />
        </div>
      </div>
    </div>
  );
}
