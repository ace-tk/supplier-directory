"use client";

import { useEffect, useState } from "react";
import {
  Palette,
  Layers,
  Shirt,
  Sparkle,
  LayoutGrid,
  StickyNote,
  Wand2,
  ShoppingBag,
  Factory,
  Ruler,
  MessageCircle,
  Send,
  Loader2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getMyAssetsAction, getRealMaterialOptionsAction } from "@/services/mood-board";
import { LAYOUT_PRESETS, type LayoutPreset } from "@/lib/mood-board-layouts";
import type { MoodBoardAssetRecord } from "@/types/mood-board";

const TOOL_BUTTON_CLASS = "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap";

/** Standalone toolbar button (its own <button>). */
function ToolButton({ icon: Icon, label, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={TOOL_BUTTON_CLASS}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

/** Content-only variant (no <button> of its own) for use as a PopoverTrigger's
 * render target's children — PopoverTrigger's `render={<button/>}` already
 * supplies the real <button>, so nesting another <button> inside it here
 * would be invalid HTML and break hydration. */
function ToolButtonLabel({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <>
      <Icon className="h-3.5 w-3.5" /> {label}
    </>
  );
}

export function DesignToolbar({
  palette,
  onAddColor,
  onRemoveColor,
  onAddImageAsset,
  onAddMaterial,
  onApplyLayout,
  onAddNote,
  onOpenRemix,
  onSendToShop,
  onSendToManufacturer,
  onOpenSizeChart,
  onOpenSendDm,
  onAskAi,
}: {
  palette: string[];
  onAddColor: (hex: string) => void;
  onRemoveColor: (hex: string) => void;
  onAddImageAsset: (src: string) => void;
  onAddMaterial: (name: string) => void;
  onApplyLayout: (preset: LayoutPreset) => void;
  onAddNote: () => void;
  onOpenRemix: () => void;
  onSendToShop: () => void;
  onSendToManufacturer: () => void;
  onOpenSizeChart: () => void;
  onOpenSendDm: () => void;
  onAskAi: (question: string) => void;
}) {
  const [materials, setMaterials] = useState<string[]>([]);
  const [prints, setPrints] = useState<MoodBoardAssetRecord[]>([]);
  const [embroideries, setEmbroideries] = useState<MoodBoardAssetRecord[]>([]);
  const [newColor, setNewColor] = useState("#c7422d");
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    getRealMaterialOptionsAction().then((r) => r.success && setMaterials(r.data));
    getMyAssetsAction("PRINT").then((r) => r.success && setPrints(r.data));
    getMyAssetsAction("EMBROIDERY").then((r) => r.success && setEmbroideries(r.data));
  }, []);

  async function handleAsk() {
    if (!question.trim()) return;
    setAsking(true);
    try {
      await onAskAi(question);
      setQuestion("");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-card overflow-x-auto">
      <Popover>
        <PopoverTrigger render={<button type="button" className={TOOL_BUTTON_CLASS} />}>
          <ToolButtonLabel icon={Palette} label="Color" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Board Palette</p>
          <div className="flex flex-wrap gap-1.5">
            {palette.map((hex) => (
              <button key={hex} type="button" onClick={() => onRemoveColor(hex)} className="w-6 h-6 rounded-full border border-black/10" style={{ backgroundColor: hex }} title={`Remove ${hex}`} />
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-8 h-8 rounded border border-border cursor-pointer" />
            <Button size="sm" variant="outline" className="gap-1" onClick={() => onAddColor(newColor)}>
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger render={<button type="button" className={TOOL_BUTTON_CLASS} />}>
          <ToolButtonLabel icon={Shirt} label="Fabric" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Real Materials</p>
          {materials.length === 0 ? (
            <p className="text-xs text-muted-foreground">No product materials found yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {materials.map((m) => (
                <button key={m} type="button" onClick={() => onAddMaterial(m)} className="text-[11px] rounded-full border border-border px-2 py-1 hover:border-primary/50">
                  {m}
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger render={<button type="button" className={TOOL_BUTTON_CLASS} />}>
          <ToolButtonLabel icon={Layers} label="Print" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Your Prints</p>
          {prints.length === 0 ? (
            <p className="text-xs text-muted-foreground">Upload prints from the Library panel to use them here.</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {prints.map((p) => (
                <button key={p.id} type="button" onClick={() => onAddImageAsset(p.dataUrl)} className="aspect-square rounded overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger render={<button type="button" className={TOOL_BUTTON_CLASS} />}>
          <ToolButtonLabel icon={Sparkle} label="Embroidery" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Your Embroidery References</p>
          {embroideries.length === 0 ? (
            <p className="text-xs text-muted-foreground">Upload embroidery references from the Library panel to use them here.</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {embroideries.map((p) => (
                <button key={p.id} type="button" onClick={() => onAddImageAsset(p.dataUrl)} className="aspect-square rounded overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger render={<button type="button" className={TOOL_BUTTON_CLASS} />}>
          <ToolButtonLabel icon={LayoutGrid} label="Layout" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-2 space-y-1">
          {LAYOUT_PRESETS.map((p) => (
            <button key={p.id} type="button" onClick={() => onApplyLayout(p.id)} className="w-full text-left rounded-lg px-2 py-1.5 text-xs hover:bg-muted">
              {p.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <ToolButton icon={StickyNote} label="Notes" onClick={onAddNote} />
      <ToolButton icon={Wand2} label="AI Remix" onClick={onOpenRemix} />

      <div className="w-px h-5 bg-border mx-1 shrink-0" />

      <ToolButton icon={ShoppingBag} label="Send to Shop Page" onClick={onSendToShop} />
      <ToolButton icon={Factory} label="Send to Manufacturer" onClick={onSendToManufacturer} />
      <ToolButton icon={Ruler} label="Design Size Chart" onClick={onOpenSizeChart} />
      <ToolButton icon={MessageCircle} label="Send DM" onClick={onOpenSendDm} />

      <div className="flex-1 min-w-[200px] flex items-center gap-2 ml-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAsk()}
          placeholder="Ask AI for styling suggestions..."
          className="h-8 text-xs"
        />
        <Button size="sm" className="gap-1 shrink-0" disabled={asking} onClick={handleAsk}>
          {asking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Ask AI
        </Button>
      </div>
    </div>
  );
}
