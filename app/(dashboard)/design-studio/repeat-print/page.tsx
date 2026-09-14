"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { StudioNav } from "@/components/design-studio/StudioNav";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ReferenceUploader } from "@/components/repeat-print/ReferenceUploader";
import { GenerationProgress, type GenerationStage } from "@/components/repeat-print/GenerationProgress";
import { RepeatResult } from "@/components/repeat-print/RepeatResult";
import { RecentDesigns } from "@/components/repeat-print/RecentDesigns";
import { prepareSeamlessTileInputs } from "@/lib/repeat-print-canvas";
import {
  analyzeReferencePrintAction,
  repairSeamTileAction,
  saveRepeatPrintDesignAction,
  getRecentRepeatPrintDesignsAction,
  getRepeatPrintDesignAction,
  deleteRepeatPrintDesignAction,
  type RepeatPrintDesignSummary,
} from "@/services/repeat-print";

type Phase = "upload" | "generating" | "result";

export default function RepeatPrintMakerPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const { open: openId } = use(searchParams);
  const [phase, setPhase] = useState<Phase>("upload");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [stage, setStage] = useState<GenerationStage>("extracting");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [tileImage, setTileImage] = useState("");
  const [repeatCount, setRepeatCount] = useState(4);
  const [name, setName] = useState("Untitled Print");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [recentDesigns, setRecentDesigns] = useState<RepeatPrintDesignSummary[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadRecent();
  }, []);

  // Deep link from Pattern Library ("Open in Repeat Print Maker" ->
  // /design-studio/repeat-print?open=<id>) — opens the saved design once on
  // arrival, same as clicking it in the Recent Designs grid below.
  useEffect(() => {
    if (openId) handleOpen(openId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  useEffect(() => {
    if (phase !== "generating") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  async function loadRecent() {
    const result = await getRecentRepeatPrintDesignsAction();
    if (result.success) setRecentDesigns(result.data);
  }

  async function handleGenerate() {
    if (referenceImages.length === 0) {
      toast.error("Upload at least one reference image first.");
      return;
    }
    setPhase("generating");
    setStage("extracting");
    setElapsedSeconds(0);

    // EXTRACTING: prepare the real seam boundaries client-side (crop, offset-
    // wrap, mask — see lib/repeat-print-canvas.ts) and get a short real style
    // description from the vision model. Neither step redraws anything.
    let prepared;
    try {
      prepared = await prepareSeamlessTileInputs(referenceImages[0]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't prepare the reference image.");
      setPhase("upload");
      return;
    }

    const analysis = await analyzeReferencePrintAction(referenceImages);
    if (!analysis.success) {
      toast.error(analysis.error);
      setPhase("upload");
      return;
    }

    // GENERATING: repair ONLY the masked seam band. Everything outside the
    // mask is opaque and therefore preserved pixel-for-pixel by the model.
    setStage("generating");
    const repair = await repairSeamTileAction(prepared.wrappedImage, prepared.mask, analysis.data);
    if (!repair.success) {
      toast.error(repair.error);
      setPhase("upload");
      return;
    }

    // TILING: build the live repeat preview from the repaired tile.
    setStage("tiling");
    setTileImage(repair.data);
    setRepeatCount(4);
    setName("Untitled Print");
    setSavedId(null);
    setSaved(false);
    setPhase("result");
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const result = await saveRepeatPrintDesignAction({
      id: savedId ?? undefined,
      name,
      tileImage,
      repeatCount,
      referenceImages,
    });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setSavedId(result.data.id);
    setSaved(true);
    toast.success("Design saved");
    loadRecent();
  }

  async function handleOpen(id: string) {
    const result = await getRepeatPrintDesignAction(id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setReferenceImages(result.data.referenceImages);
    setTileImage(result.data.tileImage);
    setRepeatCount(result.data.repeatCount);
    setName(result.data.name);
    setSavedId(result.data.id);
    setSaved(true);
    setPhase("result");
  }

  async function handleDelete(id: string) {
    const result = await deleteRepeatPrintDesignAction(id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Design deleted");
    if (id === savedId) setSavedId(null);
    loadRecent();
  }

  function handleStartOver() {
    setPhase("upload");
    setReferenceImages([]);
    setTileImage("");
    setSavedId(null);
    setSaved(false);
  }

  return (
    <div>
      <StudioNav />
      <div className="mt-6">
        <PageHeader
          title="Repeat Print Maker"
          description="Create seamless repeating patterns from artwork or reference images."
        />
      </div>

      {phase === "upload" && (
        <div className="max-w-xl rounded-2xl border border-border bg-card p-6">
          <ReferenceUploader images={referenceImages} onChange={setReferenceImages} />
          <p className="text-[11px] text-muted-foreground mt-4">
            AI-generated outputs are drafts for reference only. Always review before use in production.
          </p>
          <Button className="w-full mt-3" onClick={handleGenerate} disabled={referenceImages.length === 0}>
            <Sparkles className="w-4 h-4" /> Generate seamless print
          </Button>
        </div>
      )}

      {phase === "generating" && (
        <div className="max-w-xl rounded-2xl border border-border bg-card">
          <GenerationProgress stage={stage} elapsedSeconds={elapsedSeconds} referenceImage={referenceImages[0]} />
        </div>
      )}

      {phase === "result" && tileImage && (
        <RepeatResult
          referenceImages={referenceImages}
          tileImage={tileImage}
          repeatCount={repeatCount}
          onRepeatCountChange={setRepeatCount}
          name={name}
          onNameChange={(n) => {
            setName(n);
            setSaved(false);
          }}
          onSave={handleSave}
          saving={saving}
          saved={saved}
          onStartOver={handleStartOver}
        />
      )}

      <RecentDesigns designs={recentDesigns} onOpen={handleOpen} onDelete={handleDelete} />
      {recentDesigns.length > 0 && (
        <Link href="/design-studio/pattern-library" className="mt-3 inline-block text-xs font-medium text-primary hover:underline">
          Browse full Pattern Library →
        </Link>
      )}
    </div>
  );
}
