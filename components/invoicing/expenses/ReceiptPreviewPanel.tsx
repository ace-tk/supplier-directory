"use client";

import { FileText, Receipt, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

function isImageFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function isPdfFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".pdf");
}

/** Renders the ACTUAL uploaded receipt — a real <img> for images, the
 * browser's native PDF viewer via <iframe> for PDFs (the file is a real
 * URL from the upload endpoint, not a fabricated preview). Anything else
 * gets an honest file-icon + Open fallback. */
export function ReceiptPreviewPanel({
  fileName,
  url,
  onRemove,
}: {
  fileName: string | null;
  url: string | null;
  onRemove?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-foreground truncate">{fileName ? fileName : "Receipt Preview"}</h3>
        {fileName && onRemove && (
          <button type="button" onClick={onRemove} aria-label="Remove receipt" className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {!fileName || !url ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <Receipt className="h-6 w-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">No receipt attached yet.</p>
        </div>
      ) : isImageFile(fileName) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={fileName} className="w-full rounded-lg border border-border object-contain max-h-64 bg-muted" />
      ) : isPdfFile(fileName) ? (
        <iframe src={url} title={fileName} className="w-full h-64 rounded-lg border border-border bg-muted" />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <FileText className="h-6 w-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Preview isn&apos;t available for this file type.</p>
        </div>
      )}

      {fileName && url && (
        <Button variant="outline" size="sm" className="w-full gap-1.5" render={<a href={url} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
          <ExternalLink className="h-3.5 w-3.5" /> Open Original
        </Button>
      )}
    </div>
  );
}
