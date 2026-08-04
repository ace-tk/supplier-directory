"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { X, Plus, Loader2, FileText } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { formatFileSize } from "@/lib/content-ui";
import {
  addRowImageAction,
  removeRowImageAction,
  addRowAttachmentAction,
  removeRowAttachmentAction,
  updateRowFieldAction,
} from "@/services/catalog";
import type { CatalogRowRecord } from "@/types/catalog";

interface RowDetailSheetProps {
  row: CatalogRowRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRowChange: (row: CatalogRowRecord) => void;
}

export function RowDetailSheet({ row, open, onOpenChange, onRowChange }: RowDetailSheetProps) {
  const [notes, setNotes] = useState(row?.notes ?? "");
  const [description, setDescription] = useState(row?.description ?? "");
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!row) return null;

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !row) return;
    setUploadingImage(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await addRowImageAction(row.id, { dataUrl, mimeType: file.type, sizeBytes: file.size });
      if (!result.success) return toast.error(result.error);
      onRowChange({ ...row, images: [...row.images, result.data] });
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleRemoveImage(imageId: string) {
    if (!row) return;
    const result = await removeRowImageAction(imageId);
    if (!result.success) return toast.error(result.error);
    onRowChange({ ...row, images: row.images.filter((i) => i.id !== imageId) });
  }

  async function handleAttachmentUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !row) return;
    const dataUrl = await fileToDataUrl(file);
    const result = await addRowAttachmentAction(row.id, { fileName: file.name, mimeType: file.type, sizeBytes: file.size, dataUrl });
    if (!result.success) return toast.error(result.error);
    onRowChange({ ...row, attachments: [...row.attachments, result.data] });
  }

  async function handleRemoveAttachment(attachmentId: string) {
    if (!row) return;
    const result = await removeRowAttachmentAction(attachmentId);
    if (!result.success) return toast.error(result.error);
    onRowChange({ ...row, attachments: row.attachments.filter((a) => a.id !== attachmentId) });
  }

  async function handleBlurSave(field: "description" | "notes", value: string) {
    if (!row) return;
    if (value === row[field]) return;
    await updateRowFieldAction(row.id, field, value);
    onRowChange({ ...row, [field]: value });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full flex flex-col">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-lg">{row.productName}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-1 space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Description</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={(e) => handleBlurSave("description", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={(e) => handleBlurSave("notes", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Images</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
                className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
              >
                {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              {row.images.map((img) => (
                <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
                  <img src={img.dataUrl} alt="Row" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(img.id)}
                    className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove image"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Attachments</Label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border-2 border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors w-full"
            >
              <Plus className="h-3.5 w-3.5" /> Attach a file
            </button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleAttachmentUpload} />
            {row.attachments.length > 0 && (
              <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                {row.attachments.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 px-3 py-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-foreground truncate">{a.fileName}</p>
                      <p className="text-[10px] text-muted-foreground">{formatFileSize(a.sizeBytes)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(a.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Remove attachment"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
