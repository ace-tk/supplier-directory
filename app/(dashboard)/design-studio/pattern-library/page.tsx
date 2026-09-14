"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Grid3x3, Sparkles, Trash2 } from "lucide-react";
import { StudioNav } from "@/components/design-studio/StudioNav";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/utils/format";
import {
  getRecentRepeatPrintDesignsAction,
  deleteRepeatPrintDesignAction,
  type RepeatPrintDesignSummary,
} from "@/services/repeat-print";

/**
 * Pattern Library — a dedicated view over the same RepeatPrintDesign data
 * Repeat Print Maker already saves (see services/repeat-print.ts). No new
 * data model: this is the "shared asset library" the AI Design Studio
 * workflows read from, surfaced as its own destination instead of being
 * buried at the bottom of Repeat Print Maker.
 */
export default function PatternLibraryPage() {
  const router = useRouter();
  // null = not fetched yet (renders the loading state); an array (possibly
  // empty) once the fetch resolves.
  const [patterns, setPatterns] = useState<RepeatPrintDesignSummary[] | null>(null);

  useEffect(() => {
    getRecentRepeatPrintDesignsAction().then((result) => {
      if (result.success) setPatterns(result.data);
    });
  }, []);

  async function handleDelete(id: string) {
    const result = await deleteRepeatPrintDesignAction(id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Pattern deleted");
    const refreshed = await getRecentRepeatPrintDesignsAction();
    if (refreshed.success) setPatterns(refreshed.data);
  }

  return (
    <div>
      <StudioNav />
      <div className="mt-6">
        <PageHeader title="Pattern Library" description="Saved seamless patterns from Repeat Print Maker — reuse them here or apply them directly in AI Garment Studio's Patterns tool." />
      </div>

      {patterns === null ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading patterns…</div>
      ) : patterns.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <Grid3x3 className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No saved patterns yet.</p>
          <Button onClick={() => router.push("/design-studio/repeat-print")}>
            <Sparkles className="w-4 h-4" /> Create a pattern
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {patterns.map((p) => (
            <div key={p.id} className="group relative rounded-xl overflow-hidden border border-border bg-card">
              <button
                type="button"
                onClick={() => router.push(`/design-studio/repeat-print?open=${p.id}`)}
                className="block w-full text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.tileImage} alt={p.name} className="w-full aspect-square object-cover" />
                <div className="p-2">
                  <p className="text-xs font-semibold text-foreground truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {p.ownerName} · {formatRelativeTime(p.updatedAt)}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(p.id);
                }}
                aria-label={`Delete ${p.name}`}
                className="absolute top-1.5 right-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
