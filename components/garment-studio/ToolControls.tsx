"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { UploadCloud, X } from "lucide-react";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { validateImage } from "@/lib/file-validation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function PreviewToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn("flex items-center gap-2.5 select-none", "text-sm text-foreground")}
    >
      <span className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors", on ? "bg-primary" : "bg-muted-foreground/30")}>
        <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", on ? "translate-x-[18px]" : "translate-x-0.5")} />
      </span>
      Preview
    </button>
  );
}

export function SettingSlider({
  label,
  value,
  unit,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-foreground">{label}</span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {Math.round(value)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
        aria-label={label}
      />
    </div>
  );
}

export function ImageUploadStep({
  dataUrl,
  onChange,
}: {
  dataUrl: string | null;
  onChange: (file: File | null, dataUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(files: FileList) {
    const f = Array.from(files)[0];
    if (!f) return;
    const check = validateImage(f.type, f.size, f.name);
    if (!check.valid) {
      toast.error(check.error);
      return;
    }
    onChange(f, await fileToDataUrl(f));
  }

  if (dataUrl) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-3 relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl} alt="Uploaded reference" className="w-full h-32 object-cover rounded-lg" />
        <button
          type="button"
          onClick={() => onChange(null, null)}
          aria-label="Remove"
          className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => inputRef.current?.click()}>
          <UploadCloud className="w-3.5 h-3.5" /> Change
        </Button>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => e.target.files?.length && handleFiles(e.target.files)} />
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors",
        dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/40 hover:bg-muted/60"
      )}
    >
      <UploadCloud className="w-4 h-4 text-muted-foreground" />
      <p className="text-xs text-foreground">
        Drag and drop an image
        <br />
        or <span className="text-primary underline">choose a file</span>{" "}
        <span className="text-muted-foreground">(optional)</span>
      </p>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => e.target.files?.length && handleFiles(e.target.files)} />
    </div>
  );
}

export function PromptStep({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="min-h-20" />;
}

const COLOR_SWATCHES = ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#14B8A6", "#3B82F6", "#6366F1", "#A855F7", "#EC4899", "#78716C", "#111827", "#FFFFFF"];

export function ColorPickerStep({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <div>
      <div className="grid grid-cols-6 gap-2 mb-3">
        {COLOR_SWATCHES.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => onChange(hex)}
            aria-label={hex}
            className={cn("w-full aspect-square rounded-lg border-2 transition-transform", value.toLowerCase() === hex.toLowerCase() ? "border-primary scale-105" : "border-border")}
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 rounded border border-border cursor-pointer" aria-label="Custom color" />
        <span className="text-xs text-muted-foreground uppercase tabular-nums">{value}</span>
      </div>
    </div>
  );
}
