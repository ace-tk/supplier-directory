"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Paperclip, Send, Loader2, Undo2, Redo2, Minus, Plus, Maximize2, Minimize2 } from "lucide-react";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { validateImage } from "@/lib/file-validation";

export function BottomAiBar({ onAsk, onAttachImage }: { onAsk: (question: string) => Promise<void>; onAttachImage: (dataUrl: string) => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSend() {
    if (!value.trim() || busy) return;
    setBusy(true);
    try {
      await onAsk(value);
      setValue("");
    } finally {
      setBusy(false);
    }
  }

  async function handleAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const v = validateImage(file.type, file.size);
    if (!v.valid) return toast.error(v.error);
    const dataUrl = await fileToDataUrl(file);
    onAttachImage(dataUrl);
  }

  return (
    <div className="border-t border-border bg-card px-4 py-2.5">
      <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 max-w-3xl mx-auto">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type notes or ask AI to refine the mood board..."
          className="flex-1 bg-transparent text-sm outline-none min-w-0"
        />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAttach} />
        <button type="button" onClick={() => fileRef.current?.click()} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Attach image">
          <Paperclip className="h-4 w-4" />
        </button>
        {/* No microphone — no voice/STT capability exists anywhere in this
            app (confirmed by audit); omitted rather than faked. */}
        <button type="button" onClick={handleSend} disabled={busy || !value.trim()} className="text-primary hover:text-primary/80 disabled:opacity-40 shrink-0" aria-label="Send">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function CanvasControls({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomChange,
  fullscreen,
  onToggleFullscreen,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomChange: (z: number) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  return (
    <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-full border border-border bg-card shadow-sm px-1.5 py-1 z-20">
      <button type="button" onClick={onUndo} disabled={!canUndo} className="p-1.5 rounded-full hover:bg-muted disabled:opacity-30" aria-label="Undo">
        <Undo2 className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={onRedo} disabled={!canRedo} className="p-1.5 rounded-full hover:bg-muted disabled:opacity-30" aria-label="Redo">
        <Redo2 className="h-3.5 w-3.5" />
      </button>
      <div className="w-px h-4 bg-border mx-0.5" />
      <button type="button" onClick={() => onZoomChange(Math.max(0.4, zoom - 0.1))} className="p-1.5 rounded-full hover:bg-muted" aria-label="Zoom out">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="text-[11px] font-medium tabular-nums w-9 text-center">{Math.round(zoom * 100)}%</span>
      <button type="button" onClick={() => onZoomChange(Math.min(2, zoom + 0.1))} className="p-1.5 rounded-full hover:bg-muted" aria-label="Zoom in">
        <Plus className="h-3.5 w-3.5" />
      </button>
      <div className="w-px h-4 bg-border mx-0.5" />
      <button type="button" onClick={onToggleFullscreen} className="p-1.5 rounded-full hover:bg-muted" aria-label="Toggle fullscreen">
        {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
