"use client";

import { getFileKind } from "@/lib/content-file-types";
import { PdfViewer } from "./document-viewer/PdfViewer";
import { TextViewer } from "./document-viewer/TextViewer";
import { ImageViewer } from "./document-viewer/ImageViewer";
import { WordViewer } from "./document-viewer/WordViewer";
import { SpreadsheetViewer } from "./document-viewer/SpreadsheetViewer";
import { PresentationViewer } from "./document-viewer/PresentationViewer";
import { LegacyViewer } from "./document-viewer/LegacyViewer";
import { UnsupportedViewer } from "./document-viewer/UnsupportedViewer";
import type { ViewerVariant } from "./document-viewer/shared";
import type { DraftAttachment } from "@/types/content";

/**
 * Routes an attachment to the renderer for its real, validated file
 * kind — real pdfjs rendering for PDF, real mammoth-rendered HTML for
 * DOCX, a real SheetJS-backed grid for XLS/XLSX, a real parsed slide
 * canvas for PPTX, real text for TXT, the real image for image
 * attachments. Legacy binary Office formats (DOC/PPT) and anything
 * genuinely unrecognized get an honest metadata + download fallback
 * instead of a fake preview.
 *
 * `variant="large"` is for the center document-viewer column (a genuinely
 * readable, tall canvas with format-appropriate zoom/fit controls); the
 * default "compact" is unchanged for smaller inline previews (e.g. the
 * Template Library card).
 */
export function DocumentViewer({ file, variant = "compact" }: { file: DraftAttachment; variant?: ViewerVariant }) {
  const kind = getFileKind(file.mimeType, file.fileName);
  switch (kind) {
    case "pdf":
      return <PdfViewer file={file} variant={variant} />;
    case "text":
      return <TextViewer file={file} variant={variant} />;
    case "image":
      return <ImageViewer file={file} variant={variant} />;
    case "docx":
      return <WordViewer file={file} variant={variant} />;
    case "spreadsheet":
      return <SpreadsheetViewer file={file} variant={variant} />;
    case "pptx":
      return <PresentationViewer file={file} variant={variant} />;
    case "doc-legacy":
      return <LegacyViewer file={file} modernFormat="DOCX" />;
    case "ppt-legacy":
      return <LegacyViewer file={file} modernFormat="PPTX" />;
    default:
      return <UnsupportedViewer file={file} />;
  }
}
