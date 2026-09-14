"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Download, Heart, Loader2, Redo2, Save, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type SaveStatus = "saved" | "unsaved" | "saving";

export function EditorHeader({
  saveStatus,
  isFavorite,
  onToggleFavorite,
  onDuplicate,
  duplicating,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  saving,
  canSave,
  canExport,
  exportContent,
}: {
  saveStatus: SaveStatus;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onDuplicate: () => void;
  duplicating: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  saving: boolean;
  /** False until artwork is loaded — Save/Duplicate no-op without it
   * (see handleSave/handleDuplicate's sourceImage guard), so the buttons
   * must reflect that instead of appearing clickable and doing nothing. */
  canSave: boolean;
  canExport: boolean;
  exportContent: React.ReactNode;
}) {
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="flex items-center gap-3 h-14 shrink-0 border-b border-border bg-card px-4">
      <Link href="/design-studio" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0">
        <ArrowLeft className="w-4 h-4" /> AI Design Studio
      </Link>
      <div className="h-4 w-px bg-border shrink-0" />
      <p className="text-sm font-semibold text-foreground shrink-0">Print → Embroidery</p>
      <SaveStatusDot status={saveStatus} />

      <div className="flex-1" />

      <div className="flex items-center gap-1 shrink-0">
        <IconButton label="Undo" onClick={onUndo} disabled={!canUndo}>
          <Undo2 className="w-4 h-4" />
        </IconButton>
        <IconButton label="Redo" onClick={onRedo} disabled={!canRedo}>
          <Redo2 className="w-4 h-4" />
        </IconButton>
        <div className="h-4 w-px bg-border mx-1" />
        <IconButton label={isFavorite ? "Remove from favorites" : "Add to favorites"} onClick={onToggleFavorite}>
          <Heart className={cn("w-4 h-4", isFavorite && "fill-primary text-primary")} />
        </IconButton>
        <IconButton label="Duplicate" onClick={onDuplicate} disabled={duplicating || !canSave}>
          {duplicating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
        </IconButton>
        <Button variant="outline" size="sm" onClick={() => setExportOpen(true)} disabled={!canExport}>
          <Download className="w-3.5 h-3.5" /> Export
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving || !canSave}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export</DialogTitle>
          </DialogHeader>
          {exportContent}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SaveStatusDot({ status }: { status: SaveStatus }) {
  const config = {
    saved: { color: "bg-emerald-500", label: "Saved" },
    unsaved: { color: "bg-amber-500", label: "Unsaved changes" },
    saving: { color: "bg-amber-500 animate-pulse", label: "Saving…" },
  }[status];
  return (
    <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
      <span className={cn("w-1.5 h-1.5 rounded-full", config.color)} /> {config.label}
    </span>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            {children}
          </button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
