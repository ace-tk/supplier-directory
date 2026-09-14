"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Library, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getRecentRepeatPrintDesignsAction, type RepeatPrintDesignSummary } from "@/services/repeat-print";
import { dataUrlToFile } from "@/lib/file-to-data-url";

/**
 * Bridges Repeat Print Maker's saved patterns into AI Garment Studio's
 * Patterns tool — lets a user pick a Pattern Library tile instead of only
 * ever uploading a fresh file. No new data model: reuses the same
 * RepeatPrintDesign data the Pattern Library page reads.
 */
export function PatternLibraryPicker({ onSelect }: { onSelect: (file: File, dataUrl: string) => void }) {
  const [open, setOpen] = useState(false);
  // null = not fetched yet for this open (renders the loading state); an
  // array (possibly empty) once the fetch resolves.
  const [patterns, setPatterns] = useState<RepeatPrintDesignSummary[] | null>(null);

  useEffect(() => {
    if (!open) return;
    getRecentRepeatPrintDesignsAction().then((result) => {
      if (result.success) setPatterns(result.data);
    });
  }, [open]);

  async function handlePick(p: RepeatPrintDesignSummary) {
    try {
      const file = await dataUrlToFile(p.tileImage, `${p.name}.png`);
      onSelect(file, p.tileImage);
      setOpen(false);
    } catch {
      toast.error("Couldn't load that pattern. Please try again.");
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
        <Library className="w-3.5 h-3.5" /> Browse Pattern Library
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>My Pattern Library</DialogTitle>
            <DialogDescription>Apply a pattern saved from Repeat Print Maker.</DialogDescription>
          </DialogHeader>
          {patterns === null ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : patterns.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No saved patterns yet — create one in Repeat Print Maker.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-80 overflow-y-auto scrollbar-thin">
              {patterns.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePick(p)}
                  className="rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.tileImage} alt={p.name} className="w-full aspect-square object-cover" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
