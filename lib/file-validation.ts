// Shared upload validation for milestone media/attachments, used both
// client-side (instant feedback) and inside the server actions (defense in
// depth — never trust a client-side check alone).

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
];

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_VIDEO_BYTES = 15 * 1024 * 1024; // 15MB
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10MB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateImage(mimeType: string, sizeBytes: number): FileValidationResult {
  if (!IMAGE_MIME_TYPES.includes(mimeType)) {
    return { valid: false, error: "Only JPEG, PNG, WEBP, or GIF images are supported." };
  }
  if (sizeBytes > MAX_IMAGE_BYTES) {
    return { valid: false, error: "Images must be under 5MB." };
  }
  return { valid: true };
}

export function validateVideo(mimeType: string, sizeBytes: number): FileValidationResult {
  if (!VIDEO_MIME_TYPES.includes(mimeType)) {
    return { valid: false, error: "Only MP4, WEBM, or MOV videos are supported." };
  }
  if (sizeBytes > MAX_VIDEO_BYTES) {
    return { valid: false, error: "Videos must be under 15MB." };
  }
  return { valid: true };
}

export function validateDocument(mimeType: string, sizeBytes: number): FileValidationResult {
  if (!DOCUMENT_MIME_TYPES.includes(mimeType)) {
    return { valid: false, error: "Only PDF, Word, Excel, or ZIP files are supported." };
  }
  if (sizeBytes > MAX_DOCUMENT_BYTES) {
    return { valid: false, error: "Files must be under 10MB." };
  }
  return { valid: true };
}
