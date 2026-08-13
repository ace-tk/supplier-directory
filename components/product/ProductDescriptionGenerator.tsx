"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { runProductDescriptionAction } from "@/lib/ai/run-product-description-action";
import type { GenerateProductDescriptionInput } from "@/lib/validations/product-ai";

/**
 * "Create Product Description" — reuses the centralized runChatCompletion
 * engine (via /api/product/generate-description, the same pattern as
 * Content Management's AI routes) with a small product-specific prompt.
 * Never writes into the Description field automatically: generation always
 * lands in this review dialog first, and only the explicit "Apply" click
 * replaces the field — exactly mirroring AISummaryDialog's review-before-
 * use pattern from Content Management.
 */
export function ProductDescriptionGenerator({
  fields,
  onApply,
}: {
  fields: GenerateProductDescriptionInput;
  onApply: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!fields.productName.trim()) {
      toast.error("Enter a product name first.");
      return;
    }
    setOpen(true);
    setLoading(true);
    setError(null);
    setGenerated(null);
    try {
      const text = await runProductDescriptionAction(fields);
      setGenerated(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI generation failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleApply() {
    if (!generated) return;
    onApply(generated);
    setOpen(false);
    toast.success("Description applied — review and edit as needed.");
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={handleGenerate}>
        <Sparkles className="h-3.5 w-3.5" /> Create Product Description
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Generated Description
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-[100px]">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Generating…
              </div>
            ) : error ? (
              <p className="text-sm text-muted-foreground py-4">{error}</p>
            ) : generated ? (
              <p className="text-sm text-foreground whitespace-pre-wrap">{generated}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {generated ? "Discard" : "Close"}
            </Button>
            {generated && <Button onClick={handleApply}>Apply</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
