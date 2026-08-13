// Format-kind detection for the Content Editor's document viewer.
//
// Same MIME-first / extension-fallback approach as lib/file-validation.ts —
// browsers frequently report "" or "application/octet-stream" for DOCX/
// XLSX/PPTX, so a recognized extension is trusted whenever the reported
// MIME type is missing/generic.

const TYPE_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.ms-powerpoint": "PPT",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
  "text/plain": "TXT",
  "application/zip": "ZIP",
  "application/x-zip-compressed": "ZIP",
};

const EXTENSION_KIND: Record<string, FileKind> = {
  pdf: "pdf",
  doc: "doc-legacy",
  docx: "docx",
  xls: "spreadsheet",
  xlsx: "spreadsheet",
  ppt: "ppt-legacy",
  pptx: "pptx",
  txt: "text",
  jpg: "image",
  jpeg: "image",
  png: "image",
  webp: "image",
  gif: "image",
};

const EXTENSION_LABEL: Record<string, string> = {
  doc: "DOC",
  docx: "DOCX",
  xls: "XLS",
  xlsx: "XLSX",
  ppt: "PPT",
  pptx: "PPTX",
  pdf: "PDF",
  txt: "TXT",
  zip: "ZIP",
};

function getExtension(fileName?: string): string {
  if (!fileName) return "";
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

export function getFileTypeLabel(mimeType: string, fileName?: string): string {
  if (mimeType.startsWith("image/")) return mimeType.split("/")[1]?.toUpperCase() || "IMAGE";
  if (TYPE_LABELS[mimeType]) return TYPE_LABELS[mimeType];
  const ext = getExtension(fileName);
  return EXTENSION_LABEL[ext] ?? "FILE";
}

/**
 * The renderer family DocumentViewer should route a file to. Kept distinct
 * from "upload is supported" (lib/file-validation.ts) — a file can be a
 * valid upload (doc-legacy, ppt-legacy) without a real inline renderer.
 */
export type FileKind =
  | "pdf"
  | "docx"
  | "doc-legacy"
  | "spreadsheet" // xls and xlsx — SheetJS reads both formats natively
  | "pptx"
  | "ppt-legacy"
  | "text"
  | "image"
  | "unsupported";

const MIME_KIND: Record<string, FileKind> = {
  "application/pdf": "pdf",
  "application/msword": "doc-legacy",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "spreadsheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "spreadsheet",
  "application/vnd.ms-powerpoint": "ppt-legacy",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "text",
};

const GENERIC_MIME_TYPES = new Set(["", "application/octet-stream", "application/x-download", "application/force-download"]);

export function getFileKind(mimeType: string, fileName?: string): FileKind {
  if (mimeType.startsWith("image/")) return "image";
  if (MIME_KIND[mimeType]) return MIME_KIND[mimeType];
  if (GENERIC_MIME_TYPES.has(mimeType)) {
    return EXTENSION_KIND[getExtension(fileName)] ?? "unsupported";
  }
  return "unsupported";
}

/** Formats with a real inline renderer (as opposed to a metadata + download
 * fallback). Kept for callers that only need a yes/no signal. */
export function canPreviewInline(mimeType: string, fileName?: string): boolean {
  const kind = getFileKind(mimeType, fileName);
  return kind !== "unsupported" && kind !== "doc-legacy" && kind !== "ppt-legacy";
}

export function isPdf(mimeType: string, fileName?: string): boolean {
  return getFileKind(mimeType, fileName) === "pdf";
}

export function isText(mimeType: string, fileName?: string): boolean {
  return getFileKind(mimeType, fileName) === "text";
}

export function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}
