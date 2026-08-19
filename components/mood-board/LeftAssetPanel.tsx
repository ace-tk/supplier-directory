"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, ImageOff, Loader2, Type, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { validateImage } from "@/lib/file-validation";
import { uploadAssetAction, getMyAssetsAction, getRealMaterialOptionsAction, deleteAssetAction } from "@/services/mood-board";
import { LAYOUT_PRESETS, type LayoutPreset } from "@/lib/mood-board-layouts";
import type { MoodBoardAssetRecord, MoodBoardSummary } from "@/types/mood-board";
import type { MoodBoardAssetKind } from "@/lib/generated/prisma/enums";

export type LeftTool = "library" | "boards" | "elements" | "text" | "layouts" | "uploads" | "brandkit";

function AssetGrid({ assets, loading, emptyLabel, onPick, onDelete }: { assets: MoodBoardAssetRecord[]; loading: boolean; emptyLabel: string; onPick: (a: MoodBoardAssetRecord) => void; onDelete?: (id: string) => void }) {
  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (assets.length === 0) return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  return (
    <div className="grid grid-cols-2 gap-2">
      {assets.map((a) => (
        <button key={a.id} type="button" onClick={() => onPick(a)} className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.dataUrl} alt={a.fileName} className="w-full h-full object-cover" />
          {onDelete && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onDelete(a.id);
              }}
              className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100"
            >
              ×
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function UploadTile({ uploading, onClick }: { uploading: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={uploading}
      className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
    >
      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      <span className="text-[9px]">Upload</span>
    </button>
  );
}

export function LeftAssetPanel({
  activeTool,
  boards,
  activeBoardId,
  onSwitchBoard,
  onAddImage,
  onAddText,
  onAddSwatch,
  onAddMaterial,
  onApplyLayout,
}: {
  activeTool: LeftTool;
  boards: MoodBoardSummary[];
  activeBoardId: string;
  onSwitchBoard: (id: string) => void;
  onAddImage: (src: string) => void;
  onAddText: () => void;
  onAddSwatch: (hex: string) => void;
  onAddMaterial: (name: string) => void;
  onApplyLayout: (preset: LayoutPreset) => void;
}) {
  const [assets, setAssets] = useState<Record<string, MoodBoardAssetRecord[]>>({});
  const [loadingKind, setLoadingKind] = useState<MoodBoardAssetKind | null>(null);
  const [materials, setMaterials] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadKindRef = useRef<MoodBoardAssetKind>("UPLOAD");

  async function loadAssets(kind: MoodBoardAssetKind) {
    setLoadingKind(kind);
    const result = await getMyAssetsAction(kind);
    if (result.success) setAssets((prev) => ({ ...prev, [kind]: result.data }));
    setLoadingKind(null);
  }

  useEffect(() => {
    // Deferred a tick so loadAssets' initial setLoadingKind(...) isn't a
    // synchronous setState call inside the effect body itself
    // (react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      if (activeTool === "library") {
        loadAssets("REFERENCE");
        loadAssets("PRINT");
        loadAssets("EMBROIDERY");
      }
      if (activeTool === "uploads") loadAssets("UPLOAD");
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool]);

  useEffect(() => {
    getRealMaterialOptionsAction().then((r) => {
      if (r.success) setMaterials(r.data);
    });
  }, []);

  function openUpload(kind: MoodBoardAssetKind) {
    uploadKindRef.current = kind;
    fileInputRef.current?.click();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const v = validateImage(file.type, file.size);
    if (!v.valid) return toast.error(v.error);
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await uploadAssetAction({ kind: uploadKindRef.current, fileName: file.name, dataUrl });
      if (!result.success) return toast.error(result.error);
      setAssets((prev) => ({ ...prev, [uploadKindRef.current]: [result.data, ...(prev[uploadKindRef.current] ?? [])] }));
      toast.success("Uploaded");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string, kind: MoodBoardAssetKind) {
    const result = await deleteAssetAction(id);
    if (!result.success) return toast.error(result.error);
    setAssets((prev) => ({ ...prev, [kind]: (prev[kind] ?? []).filter((a) => a.id !== id) }));
  }

  const PALETTE_SEED = ["#111111", "#F5EDE4", "#B5A48C", "#8C6F5A", "#4A5A3E", "#C7422D"];

  return (
    <div className="w-64 shrink-0 border-r border-border bg-card overflow-y-auto p-4 space-y-5">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {activeTool === "library" && (
        <>
          <section className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Reference Models</p>
            <AssetGrid assets={assets.REFERENCE ?? []} loading={loadingKind === "REFERENCE"} emptyLabel="No reference images yet." onPick={(a) => onAddImage(a.dataUrl)} />
            <UploadTile uploading={uploading} onClick={() => openUpload("REFERENCE")} />
          </section>
          <section className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Layout Ideas</p>
            <div className="grid grid-cols-2 gap-2">
              {LAYOUT_PRESETS.map((p) => (
                <button key={p.id} type="button" onClick={() => onApplyLayout(p.id)} className="aspect-square rounded-lg border border-border bg-muted/50 flex items-center justify-center text-[10px] text-center px-1 text-muted-foreground hover:border-primary/50">
                  {p.label}
                </button>
              ))}
            </div>
          </section>
          <section className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Prints</p>
            <AssetGrid assets={assets.PRINT ?? []} loading={loadingKind === "PRINT"} emptyLabel="No prints uploaded yet." onPick={(a) => onAddImage(a.dataUrl)} />
            <UploadTile uploading={uploading} onClick={() => openUpload("PRINT")} />
          </section>
          <section className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Embroideries</p>
            <AssetGrid assets={assets.EMBROIDERY ?? []} loading={loadingKind === "EMBROIDERY"} emptyLabel="No embroidery references yet." onPick={(a) => onAddImage(a.dataUrl)} />
            <UploadTile uploading={uploading} onClick={() => openUpload("EMBROIDERY")} />
          </section>
        </>
      )}

      {activeTool === "boards" && (
        <section className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Your Boards</p>
          <div className="space-y-1.5">
            {boards.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onSwitchBoard(b.id)}
                className={`w-full flex items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs ${b.id === activeBoardId ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
              >
                <div className="w-8 h-8 rounded bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                  {b.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.coverImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageOff className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{b.name}</p>
                  <p className="text-muted-foreground">{b.itemCount} items</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {activeTool === "elements" && (
        <section className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Color Swatches</p>
          <div className="grid grid-cols-6 gap-2">
            {PALETTE_SEED.map((hex) => (
              <button key={hex} type="button" onClick={() => onAddSwatch(hex)} className="w-7 h-7 rounded-full border border-black/10" style={{ backgroundColor: hex }} aria-label={`Add ${hex} swatch`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground pt-2">Click a color to add it as a swatch on the canvas.</p>
        </section>
      )}

      {activeTool === "text" && (
        <section className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Text</p>
          <Button variant="outline" className="w-full gap-1.5" onClick={onAddText}>
            <Type className="h-3.5 w-3.5" /> Add Text Box
          </Button>
        </section>
      )}

      {activeTool === "layouts" && (
        <section className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Layout Ideas</p>
          <div className="space-y-2">
            {LAYOUT_PRESETS.map((p) => (
              <button key={p.id} type="button" onClick={() => onApplyLayout(p.id)} className="w-full rounded-lg border border-border p-2.5 text-left hover:border-primary/50">
                <p className="text-xs font-medium">{p.label}</p>
                <p className="text-[10px] text-muted-foreground">{p.description}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {activeTool === "uploads" && (
        <section className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Your Uploads</p>
          <div className="grid grid-cols-2 gap-2">
            <UploadTile uploading={uploading} onClick={() => openUpload("UPLOAD")} />
            {(assets.UPLOAD ?? []).map((a) => (
              <button key={a.id} type="button" onClick={() => onAddImage(a.dataUrl)} className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.dataUrl} alt={a.fileName} className="w-full h-full object-cover" />
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(a.id, "UPLOAD");
                  }}
                  className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100"
                >
                  ×
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {activeTool === "brandkit" && (
        <section className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Brand Kit</p>
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <Palette className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-xs font-medium">Coming Soon</p>
            <p className="text-[11px] text-muted-foreground mt-1">SupplyBase doesn&apos;t have a company/brand-kit module yet — no logo, brand color, or font data exists to show here honestly.</p>
          </div>
          {materials.length > 0 && (
            <div className="pt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Real Materials In Use</p>
              <div className="flex flex-wrap gap-1">
                {materials.slice(0, 10).map((m) => (
                  <button key={m} type="button" onClick={() => onAddMaterial(m)} className="text-[10px] rounded-full border border-border px-2 py-0.5 hover:border-primary/50">
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
