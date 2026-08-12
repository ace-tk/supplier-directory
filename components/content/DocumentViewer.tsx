"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  Maximize2,
  Minimize2,
  Loader2,
  FileWarning,
  File as FileIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPdfjs, dataUrlToUint8Array, dataUrlToText } from "@/lib/pdf-client";
import { getFileTypeLabel, isPdf, isText, isImage } from "@/lib/content-file-types";
import { formatFileSize, formatDateTime } from "@/lib/content-ui";
import type { DraftAttachment } from "@/types/content";

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;

function downloadDataUrl(dataUrl: string, fileName: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Renders the actual uploaded document — real pdfjs rendering for PDF,
 * real text for TXT, the real image for image attachments. Formats that
 * can't be safely rendered inline (DOCX/XLSX/PPTX/...) get an honest
 * metadata + download fallback instead of a fake preview.
 */
export function DocumentViewer({ file }: { file: DraftAttachment }) {
  if (isPdf(file.mimeType)) return <PdfViewer file={file} />;
  if (isText(file.mimeType)) return <TextViewer file={file} />;
  if (isImage(file.mimeType)) return <ImageViewer file={file} />;
  return <UnsupportedViewer file={file} />;
}

function ViewerChrome({
  children,
  toolbar,
  containerRef,
}: {
  children: React.ReactNode;
  toolbar: React.ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={containerRef} className="bg-background">
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-border bg-muted/40 flex-wrap">{toolbar}</div>
      <div className="max-h-[420px] overflow-auto flex items-start justify-center p-3 bg-muted/20">{children}</div>
    </div>
  );
}

function useFullscreen(ref: React.RefObject<HTMLDivElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    function onChange() {
      setIsFullscreen(document.fullscreenElement === ref.current);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [ref]);

  function toggle() {
    if (!ref.current) return;
    if (document.fullscreenElement === ref.current) {
      document.exitFullscreen();
    } else {
      ref.current.requestFullscreen?.().catch(() => toast.error("Fullscreen isn't available here."));
    }
  }
  return { isFullscreen, toggle };
}

function PdfViewer({ file }: { file: DraftAttachment }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPdfjs()
      .then((pdfjs) => pdfjs.getDocument({ data: dataUrlToUint8Array(file.dataUrl) }).promise)
      .then((doc) => {
        if (cancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setPageNum(1);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't render this PDF.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Runs once per mount — callers key DocumentViewer by file identity so a
    // different file always gets a fresh instance instead of this effect
    // re-running with a stale `loading`/`error` reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    renderTaskRef.current?.cancel();

    pdfDoc.getPage(pageNum).then((page) => {
      if (cancelled || !canvasRef.current) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      task.promise.catch(() => {});
    });

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageNum, scale]);

  if (error) return <UnsupportedViewer file={file} message={error} />;

  return (
    <ViewerChrome
      containerRef={containerRef}
      toolbar={
        <>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" disabled={loading || pageNum <= 1} onClick={() => setPageNum((p) => p - 1)} aria-label="Previous page">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground min-w-[64px] text-center">
              {loading ? "…" : `${pageNum} / ${numPages}`}
            </span>
            <Button variant="ghost" size="icon-sm" disabled={loading || pageNum >= numPages} onClick={() => setPageNum((p) => p + 1)} aria-label="Next page">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" disabled={scale <= MIN_SCALE} onClick={() => setScale((s) => Math.max(MIN_SCALE, s - 0.1))} aria-label="Zoom out">
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
            <Button variant="ghost" size="icon-sm" disabled={scale >= MAX_SCALE} onClick={() => setScale((s) => Math.min(MAX_SCALE, s + 0.1))} aria-label="Zoom in">
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => downloadDataUrl(file.dataUrl, file.fileName)} aria-label="Download">
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={toggleFullscreen} aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center h-40 w-full text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <canvas ref={canvasRef} className="shadow-card rounded" />
      )}
    </ViewerChrome>
  );
}

function TextViewer({ file }: { file: DraftAttachment }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef);
  // A pure, synchronous decode of the current file — no effect needed;
  // callers key DocumentViewer by file identity for a fresh instance.
  const [text] = useState(() => dataUrlToText(file.dataUrl));

  return (
    <ViewerChrome
      containerRef={containerRef}
      toolbar={
        <>
          <span className="text-xs text-muted-foreground">{formatFileSize(file.sizeBytes)}</span>
          <div className="flex items-center gap-1 ml-auto">
            <Button variant="ghost" size="icon-sm" onClick={() => downloadDataUrl(file.dataUrl, file.fileName)} aria-label="Download">
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={toggleFullscreen} aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </>
      }
    >
      <pre className="w-full text-xs text-foreground whitespace-pre-wrap font-mono bg-card rounded-lg p-3 border border-border">{text}</pre>
    </ViewerChrome>
  );
}

function ImageViewer({ file }: { file: DraftAttachment }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef);

  return (
    <ViewerChrome
      containerRef={containerRef}
      toolbar={
        <>
          <span className="text-xs text-muted-foreground">{formatFileSize(file.sizeBytes)}</span>
          <div className="flex items-center gap-1 ml-auto">
            <Button variant="ghost" size="icon-sm" onClick={() => downloadDataUrl(file.dataUrl, file.fileName)} aria-label="Download">
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={toggleFullscreen} aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </>
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={file.dataUrl} alt={file.fileName} className="max-w-full rounded shadow-card" />
    </ViewerChrome>
  );
}

function UnsupportedViewer({ file, message }: { file: DraftAttachment; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 px-4 text-center">
      {message ? <FileWarning className="h-8 w-8 text-muted-foreground" /> : <FileIcon className="h-8 w-8 text-muted-foreground" />}
      <div>
        <p className="text-sm font-medium text-foreground">{file.fileName}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {message ?? `File uploaded successfully, but inline preview isn't available for ${getFileTypeLabel(file.mimeType)} files.`}
        </p>
        <p className="text-[11px] text-muted-foreground/80 mt-1">
          {getFileTypeLabel(file.mimeType)} · {formatFileSize(file.sizeBytes)}
          {file.createdAt ? ` · Uploaded ${formatDateTime(file.createdAt)}` : ""}
        </p>
      </div>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadDataUrl(file.dataUrl, file.fileName)}>
        <Download className="h-3.5 w-3.5" /> Download
      </Button>
    </div>
  );
}
