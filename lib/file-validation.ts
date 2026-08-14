// Shared upload validation — used both client-side (instant feedback) and
// inside server actions/routes (defense in depth: the server check is the
// real security boundary, the client check is UX only).
//
// Validation is MIME-type-first, with a normalized-extension fallback:
// browsers are inconsistent about the `type` a File reports — some report
// "" (empty) or a generic "application/octet-stream" for less common OS
// file-type associations (this happens for real DOCX/XLSX/PPTX files, not
// just obscure ones). Rather than reject a legitimate document because of
// that, a recognized extension is also accepted when the reported MIME
// type is missing/generic. This is never widened to arbitrary or
// executable extensions — only the exact allow-lists below.

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
];

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"];
const DOCUMENT_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "zip"];

/** Human-readable label for the "unsupported type" message. */
export const SUPPORTED_DOCUMENT_LABEL = "PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, or TXT";
export const SUPPORTED_IMAGE_LABEL = "JPG, PNG, WEBP, or GIF";

// MIME values that mean "the browser couldn't/didn't determine a specific
// type" — only ever used to fall back to extension-based checking, never
// to widen what's accepted beyond the extension allow-lists above.
const GENERIC_MIME_TYPES = new Set(["", "application/octet-stream", "application/x-download", "application/force-download"]);

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_VIDEO_BYTES = 15 * 1024 * 1024; // 15MB
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10MB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/** Pulls the MIME type and approximate byte size out of a base64 data URL,
 * for server actions that receive an already-encoded upload (e.g. avatar,
 * portfolio images) and need to validate it the same way as a raw File. */
export function extractDataUrlMeta(dataUrl: string): { mimeType: string; sizeBytes: number } {
  const match = /^data:(.+);base64,/.exec(dataUrl);
  const mimeType = match?.[1] ?? "";
  const sizeBytes = Math.round((dataUrl.length * 3) / 4);
  return { mimeType, sizeBytes };
}

function getExtension(fileName?: string): string {
  if (!fileName) return "";
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

/** True if the type/name pair matches this allow-list, accounting for a
 * missing/generic browser-reported MIME type via the extension fallback. */
function matchesAllowlist(mimeType: string, fileName: string | undefined, allowedMimeTypes: string[], allowedExtensions: string[]): boolean {
  if (allowedMimeTypes.includes(mimeType)) return true;
  if (GENERIC_MIME_TYPES.has(mimeType)) {
    return allowedExtensions.includes(getExtension(fileName));
  }
  return false;
}

export function validateImage(mimeType: string, sizeBytes: number, fileName?: string): FileValidationResult {
  if (!matchesAllowlist(mimeType, fileName, IMAGE_MIME_TYPES, IMAGE_EXTENSIONS)) {
    return { valid: false, error: `This file type isn't supported. Upload ${SUPPORTED_IMAGE_LABEL}.` };
  }
  if (sizeBytes > MAX_IMAGE_BYTES) {
    return { valid: false, error: `Image is too large. Maximum size is ${MAX_IMAGE_BYTES / (1024 * 1024)}MB.` };
  }
  return { valid: true };
}

export function validateVideo(mimeType: string, sizeBytes: number, fileName?: string): FileValidationResult {
  if (!matchesAllowlist(mimeType, fileName, VIDEO_MIME_TYPES, ["mp4", "webm", "mov"])) {
    return { valid: false, error: "Only MP4, WEBM, or MOV videos are supported." };
  }
  if (sizeBytes > MAX_VIDEO_BYTES) {
    return { valid: false, error: `Video is too large. Maximum size is ${MAX_VIDEO_BYTES / (1024 * 1024)}MB.` };
  }
  return { valid: true };
}

export function validateDocument(mimeType: string, sizeBytes: number, fileName?: string): FileValidationResult {
  if (!matchesAllowlist(mimeType, fileName, DOCUMENT_MIME_TYPES, DOCUMENT_EXTENSIONS)) {
    return { valid: false, error: `This file type isn't supported. Upload ${SUPPORTED_DOCUMENT_LABEL}.` };
  }
  if (sizeBytes > MAX_DOCUMENT_BYTES) {
    return { valid: false, error: `File is too large. Maximum size is ${MAX_DOCUMENT_BYTES / (1024 * 1024)}MB.` };
  }
  return { valid: true };
}

/** Document OR image — the shape most "attach any file" upload surfaces
 * (e.g. Content Management attachments) actually need, with one specific
 * error message instead of two separately-worded failures. */
export function validateDocumentOrImage(mimeType: string, sizeBytes: number, fileName?: string): FileValidationResult {
  const isKnownDocumentType = matchesAllowlist(mimeType, fileName, DOCUMENT_MIME_TYPES, DOCUMENT_EXTENSIONS);
  const isKnownImageType = matchesAllowlist(mimeType, fileName, IMAGE_MIME_TYPES, IMAGE_EXTENSIONS);

  if (!isKnownDocumentType && !isKnownImageType) {
    return { valid: false, error: `This file type isn't supported. Upload ${SUPPORTED_DOCUMENT_LABEL}, ${SUPPORTED_IMAGE_LABEL}.` };
  }

  const maxBytes = isKnownImageType && !isKnownDocumentType ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
  if (sizeBytes > maxBytes) {
    return { valid: false, error: `File is too large. Maximum size is ${maxBytes / (1024 * 1024)}MB.` };
  }
  return { valid: true };
}
