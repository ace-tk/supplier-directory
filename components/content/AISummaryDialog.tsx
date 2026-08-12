"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { runContentAiAction } from "@/lib/ai/run-content-ai-action";

/**
 * AI Summarize — reuses the exact same /api/content/ai-edit endpoint and
 * OpenAI engine as the AI Assistant toolbar (via runContentAiAction), just
 * for read-only summarization rather than in-place replacement. Only
 * offered where there's real, extractable content (bodyHtml) — never a
 * fabricated summary. The caller mounts this fresh on each open (keyed),
 * so "loading" starts correctly from a lazy initializer instead of an
 * effect-driven reset.
 */
export function AISummaryDialog({
  open,
  onOpenChange,
  sourceHtml,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceHtml: string | null;
  title: string;
}) {
  const hasContent = Boolean(sourceHtml && sourceHtml.trim());
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(hasContent);
  const [error, setError] = useState<string | null>(
    hasContent ? null : "There's no extractable content to summarize for this item."
  );

  useEffect(() => {
    if (!hasContent) return;
    runContentAiAction("SUMMARIZE", sourceHtml as string)
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "Summarization failed."))
      .finally(() => setLoading(false));
    // Runs once per mount — the caller remounts this component (via key) each time it's opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCopy() {
    if (!summary) return;
    const text = summary.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    navigator.clipboard.writeText(text).then(() => toast.success("Summary copied"));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> AI Summary — {title}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-[80px]">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Summarizing…
            </div>
          ) : error ? (
            <p className="text-sm text-muted-foreground py-4">{error}</p>
          ) : summary ? (
            <div className="tiptap-content text-sm" dangerouslySetInnerHTML={{ __html: summary }} />
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {summary && (
            <Button onClick={handleCopy} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
