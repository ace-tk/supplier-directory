"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Grid3x3, Loader2, Shirt } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getRecentRepeatPrintDesignsAction, type RepeatPrintDesignSummary } from "@/services/repeat-print";
import { getGarmentDesignsAction, type GarmentDesignSummary } from "@/services/garment-studio";
import { dataUrlToFile } from "@/lib/file-to-data-url";

/**
 * Lets Print → Embroidery pull its source artwork from elsewhere in AI
 * Design Studio instead of re-uploading the same file — Pattern Library
 * (saved Repeat Print tiles) and AI Garment Studio (saved garment images).
 * No new data reads beyond the two actions already used by the Pattern
 * Library page and Studio Home.
 */
export function ArtworkSourcePicker({
  trigger,
  onSelect,
}: {
  trigger: React.ReactNode;
  onSelect: (file: File, dataUrl: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [patterns, setPatterns] = useState<RepeatPrintDesignSummary[] | null>(null);
  const [garments, setGarments] = useState<GarmentDesignSummary[] | null>(null);

  useEffect(() => {
    if (!open) return;
    getRecentRepeatPrintDesignsAction().then((result) => {
      if (result.success) setPatterns(result.data);
    });
    getGarmentDesignsAction("all").then((result) => {
      if (result.success) setGarments(result.data);
    });
  }, [open]);

  async function handlePick(dataUrl: string, name: string) {
    try {
      const file = await dataUrlToFile(dataUrl, `${name}.png`);
      onSelect(file, dataUrl, name);
      setOpen(false);
    } catch {
      toast.error("Couldn't load that image. Please try again.");
    }
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Choose artwork</DialogTitle>
            <DialogDescription>Reuse something already in AI Design Studio.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="patterns">
            <TabsList className="w-full">
              <TabsTrigger value="patterns" className="flex-1">
                <Grid3x3 className="w-3.5 h-3.5" /> Pattern Library
              </TabsTrigger>
              <TabsTrigger value="garments" className="flex-1">
                <Shirt className="w-3.5 h-3.5" /> AI Garment Studio
              </TabsTrigger>
            </TabsList>
            <TabsContent value="patterns" className="pt-3">
              <ImageGrid
                items={patterns?.map((p) => ({ id: p.id, image: p.tileImage, name: p.name })) ?? null}
                emptyLabel="No saved patterns yet — create one in Repeat Print Maker."
                onPick={handlePick}
              />
            </TabsContent>
            <TabsContent value="garments" className="pt-3">
              <ImageGrid
                items={garments?.map((g) => ({ id: g.id, image: g.image, name: g.name })) ?? null}
                emptyLabel="No saved garments yet — create one in AI Garment Studio."
                onPick={handlePick}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ImageGrid({
  items,
  emptyLabel,
  onPick,
}: {
  items: { id: string; image: string; name: string }[] | null;
  emptyLabel: string;
  onPick: (dataUrl: string, name: string) => void;
}) {
  if (items === null) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-80 overflow-y-auto scrollbar-thin">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onPick(item.image, item.name)}
          className="rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image} alt={item.name} className="w-full aspect-square object-cover" />
        </button>
      ))}
    </div>
  );
}
