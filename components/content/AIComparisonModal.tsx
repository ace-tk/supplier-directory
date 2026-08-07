"use client";

import { Sparkles, FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function AIComparisonModal({
  actionLabel,
  currentHtml,
  aiHtml,
  onReplace,
  onKeep,
}: {
  actionLabel: string;
  currentHtml: string;
  aiHtml: string;
  onReplace: () => void;
  onKeep: () => void;
}) {
  return (
    <Dialog open onOpenChange={(v) => !v && onKeep()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> {actionLabel} — review changes
          </DialogTitle>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> Current Version
            </div>
            <div className="tiptap-content max-h-[45vh] overflow-y-auto scrollbar-thin px-4 py-3 text-sm" dangerouslySetInnerHTML={{ __html: currentHtml }} />
          </div>
          <div className="rounded-xl border border-primary/30 overflow-hidden">
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-primary/30 bg-primary/10 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" /> AI Version
            </div>
            <div className="tiptap-content max-h-[45vh] overflow-y-auto scrollbar-thin px-4 py-3 text-sm" dangerouslySetInnerHTML={{ __html: aiHtml }} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onKeep}>
            Keep Current
          </Button>
          <Button onClick={onReplace} className="gap-1.5">
            Replace Content <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
