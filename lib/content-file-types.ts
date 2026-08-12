const TYPE_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
  "text/plain": "TXT",
  "application/zip": "ZIP",
  "application/x-zip-compressed": "ZIP",
};

export function getFileTypeLabel(mimeType: string): string {
  if (mimeType.startsWith("image/")) return mimeType.split("/")[1]?.toUpperCase() || "IMAGE";
  return TYPE_LABELS[mimeType] ?? "FILE";
}

/** Formats this project can actually render inline — everything else falls
 * back to a metadata card + download/open, never a fake preview. */
export function canPreviewInline(mimeType: string): boolean {
  return mimeType === "application/pdf" || mimeType === "text/plain" || mimeType.startsWith("image/");
}

export function isPdf(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

export function isText(mimeType: string): boolean {
  return mimeType === "text/plain";
}

export function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}
