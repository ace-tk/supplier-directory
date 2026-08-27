"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { UploadCloud, X, Sparkles, Loader2 } from "lucide-react";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { validateImage } from "@/lib/file-validation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { suggestGarmentPromptAction, generateGarmentAction } from "@/services/garment-studio";

function useSingleImageUpload() {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | File[]) {
    const f = Array.from(files)[0];
    if (!f) return;
    const check = validateImage(f.type, f.size, f.name);
    if (!check.valid) {
      toast.error(check.error);
      return;
    }
    setFile(f);
    setDataUrl(await fileToDataUrl(f));
  }

  function clear() {
    setFile(null);
    setDataUrl(null);
  }

  return { dataUrl, file, inputRef, handleFiles, clear };
}

function UploadBox({
  dataUrl,
  onPick,
  onRemove,
  inputRef,
  onFiles,
  label,
  hint,
}: {
  dataUrl: string | null;
  onPick: () => void;
  onRemove: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFiles: (files: FileList) => void;
  label: string;
  hint: string;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div>
      {dataUrl ? (
        <div className="rounded-2xl border border-border bg-muted/40 p-4">
          <div className="relative flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dataUrl} alt={label} className="max-h-56 w-auto rounded-lg object-contain" />
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${label}`}
              className="absolute -top-1 -right-1 flex items-center justify-center w-6 h-6 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <Button variant="outline" size="sm" className="w-full mt-3" onClick={onPick}>
            <UploadCloud className="w-3.5 h-3.5" /> Change
          </Button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
          }}
          onClick={onPick}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center cursor-pointer transition-colors",
            dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/40 hover:bg-muted/60"
          )}
        >
          <UploadCloud className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Drag and drop an image</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function GarmentInput({ onGenerated }: { onGenerated: (id: string) => void }) {
  const source = useSingleImageUpload();
  const material = useSingleImageUpload();
  const [prompt, setPrompt] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function handleSourceFiles(files: FileList) {
    // Captured synchronously, before any await: the caller (UploadBox's
    // input onChange) clears e.target.value right after invoking this
    // function, and FileList is a live view of that input — reading it
    // after an await here previously returned an empty list.
    const file = files[0];
    await source.handleFiles(files);
    setSuggestion(null);
    if (!file) return;
    setSuggesting(true);
    const result = await suggestGarmentPromptAction(file);
    setSuggesting(false);
    if (result.success) {
      setSuggestion(result.data);
    } else {
      toast.error(result.error);
    }
  }

  async function handleGenerate() {
    if (!source.file) {
      toast.error("Upload a garment photo or sketch first.");
      return;
    }
    if (!prompt.trim()) {
      toast.error("Describe what you want to generate.");
      return;
    }
    setGenerating(true);
    const result = await generateGarmentAction(source.file, prompt, material.file ?? undefined);
    setGenerating(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    onGenerated(result.data.id);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto scrollbar-thin space-y-6 pr-1">
        <div>
          <p className="text-sm font-semibold text-foreground mb-2">Input image</p>
          <UploadBox
            dataUrl={source.dataUrl}
            onPick={() => source.inputRef.current?.click()}
            onRemove={source.clear}
            inputRef={source.inputRef}
            onFiles={handleSourceFiles}
            label="Input image"
            hint="Garment photo, product photo, or fashion sketch"
          />
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground mb-2">Prompt</p>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the garment you want to generate…"
            className="min-h-24"
          />
          {suggesting && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Reading your image for a prompt suggestion…
            </p>
          )}
          {suggestion && !suggesting && (
            <div className="mt-2 rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Suggestion: </span>
                {suggestion}
              </p>
              <button
                type="button"
                onClick={() => {
                  setPrompt(suggestion);
                  setSuggestion(null);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline mt-1.5"
              >
                <Sparkles className="w-3 h-3" /> Accept suggestion
              </button>
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground mb-2">Material reference</p>
          <UploadBox
            dataUrl={material.dataUrl}
            onPick={() => material.inputRef.current?.click()}
            onRemove={material.clear}
            inputRef={material.inputRef}
            onFiles={material.handleFiles}
            label="Material reference"
            hint="Optional — for textures or material swatches"
          />
        </div>
      </div>

      <Button className="w-full mt-4 shrink-0" onClick={handleGenerate} disabled={generating}>
        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {generating ? "Generating…" : "Generate"}
      </Button>
    </div>
  );
}
