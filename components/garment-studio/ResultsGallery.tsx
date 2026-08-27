"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Pencil, ImageOff, Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeTime } from "@/utils/format";
import { getGarmentDesignsAction, toggleSaveGarmentDesignAction, deleteGarmentDesignAction, type GarmentDesignSummary } from "@/services/garment-studio";

type Filter = "all" | "saved" | "edited";

function GalleryGrid({ designs, onToggleSave, onDelete }: { designs: GarmentDesignSummary[]; onToggleSave: (id: string) => void; onDelete: (id: string) => void }) {
  const router = useRouter();

  if (designs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <ImageOff className="w-6 h-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No images yet. Click Generate to add your first images.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {designs.map((d) => (
        <div key={d.id} className="group relative rounded-xl overflow-hidden border border-border bg-card">
          <button type="button" onClick={() => router.push(`/design-studio/garment/${d.id}`)} className="block w-full text-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.image} alt={d.name} className="w-full aspect-[3/4] object-cover" />
            <div className="p-2">
              <p className="text-xs font-semibold text-foreground truncate">{d.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {d.ownerName} · {formatRelativeTime(d.updatedAt)}
                {d.versionCount > 1 ? ` · ${d.versionCount} versions` : ""}
              </p>
            </div>
          </button>
          <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSave(d.id);
              }}
              aria-label={d.isSaved ? "Unsave" : "Save"}
              className="flex items-center justify-center w-6 h-6 rounded-full bg-black/60 text-white"
            >
              <Bookmark className="w-3 h-3" fill={d.isSaved ? "currentColor" : "none"} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(d.id);
              }}
              aria-label={`Delete ${d.name}`}
              className="flex items-center justify-center w-6 h-6 rounded-full bg-black/60 text-white"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
          {d.versionCount > 1 && (
            <div className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white">
              <Pencil className="w-2.5 h-2.5" /> Edited
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ResultsGallery({ refreshKey }: { refreshKey: number }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [designs, setDesigns] = useState<GarmentDesignSummary[]>([]);

  async function load(f: Filter) {
    const result = await getGarmentDesignsAction(f);
    if (result.success) setDesigns(result.data);
  }

  useEffect(() => {
    let cancelled = false;
    getGarmentDesignsAction(filter).then((result) => {
      if (!cancelled && result.success) setDesigns(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [filter, refreshKey]);

  async function handleToggleSave(id: string) {
    const result = await toggleSaveGarmentDesignAction(id);
    if (result.success) load(filter);
  }

  async function handleDelete(id: string) {
    const result = await deleteGarmentDesignAction(id);
    if (result.success) load(filter);
  }

  return (
    <Tabs value={filter} onValueChange={(v) => v && setFilter(v as Filter)}>
      <TabsList variant="line">
        <TabsTrigger value="all">Images {filter === "all" ? `(${designs.length})` : ""}</TabsTrigger>
        <TabsTrigger value="saved">
          <Bookmark className="w-3.5 h-3.5" /> Saved
        </TabsTrigger>
        <TabsTrigger value="edited">
          <Pencil className="w-3.5 h-3.5" /> Edited
        </TabsTrigger>
      </TabsList>
      <div className="mt-4">
        <GalleryGrid designs={designs} onToggleSave={handleToggleSave} onDelete={handleDelete} />
      </div>
    </Tabs>
  );
}
