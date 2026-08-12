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
  RotateCw,
  StretchHorizontal,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { getPdfjs, dataUrlToUint8Array, dataUrlToText } from "@/lib/pdf-client";
import { getFileTypeLabel, isPdf, isText, isImage } from "@/lib/content-file-types";
import { formatFileSize, formatDateTime } from "@/lib/content-ui";
import type { DraftAttachment } from "@/types/content";

const MIN_SCALE = 0.25;
const MAX_SCALE = 3;

type ViewerVariant = "compact" | "large";

function downloadDataUrl(dataUrl: string, fileName: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function IconButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant={active ? "secondary" : "ghost"} size="icon-sm" disabled={disabled} onClick={onClick} aria-label={label} />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Renders the actual uploaded document — real pdfjs rendering for PDF,
 * real text for TXT, the real image for image attachments. Formats that
 * can't be safely rendered inline (DOCX/XLSX/PPTX/...) get an honest
 * metadata + download fallback instead of a fake preview.
 *
 * `variant="large"` is for the center document-viewer column (a genuinely
 * readable, tall canvas with Fit Width/Fit Page); the default "compact" is
 * unchanged for smaller inline previews (e.g. the Template Library card).
 */
export function DocumentViewer({ file, variant = "compact" }: { file: DraftAttachment; variant?: ViewerVariant }) {
  if (isPdf(file.mimeType)) return <PdfViewer file={file} variant={variant} />;
  if (isText(file.mimeType)) return <TextViewer file={file} variant={variant} />;
  if (isImage(file.mimeType)) return <ImageViewer file={file} variant={variant} />;
  return <UnsupportedViewer file={file} />;
}

function ViewerChrome({
  children,
  toolbar,
  containerRef,
  contentRef,
  variant = "compact",
}: {
  children: React.ReactNode;
  toolbar: React.ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  contentRef?: React.RefObject<HTMLDivElement | null>;
  variant?: ViewerVariant;
}) {
  const large = variant === "large";
  return (
    <div ref={containerRef} className="bg-background flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-border bg-muted/40 flex-wrap shrink-0">{toolbar}</div>
      <div
        ref={contentRef}
        className={
          large
            ? "flex-1 min-h-0 overflow-auto flex items-start justify-center p-6 bg-muted/20"
            : "max-h-[420px] overflow-auto flex items-start justify-center p-3 bg-muted/20"
        }
      >
        {children}
      </div>
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

function PdfViewer({ file, variant = "compact" }: { file: DraftAttachment; variant?: ViewerVariant }) {
  const large = variant === "large";
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  // Natural (scale-1) size of the currently-rendered page — used by Fit
  // Width/Fit Page to compute a scale from the real page dimensions rather
  // than a guessed constant.
  const naturalSizeRef = useRef<{ width: number; height: number } | null>(null);
  // The large center-column viewer auto-fits its first page to the
  // available width instead of always opening at a fixed 100% — a panel
  // narrower than the document (e.g. on a smaller desktop or mobile)
  // would otherwise force horizontal scrolling before the user even
  // touches a zoom control.
  const autoFitDoneRef = useRef(false);
  // Bumped by the error state's "Retry Preview" action to re-run the load
  // effect below without needing a fresh DocumentViewer instance.
  const [retryKey, setRetryKey] = useState(0);

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
        if (!cancelled) setError("File uploaded, but preview couldn't be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Callers key DocumentViewer by file identity so a different file always
    // gets a fresh instance; `retryKey` is the only other intentional
    // re-run trigger (the "Retry Preview" action below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    renderTaskRef.current?.cancel();

    pdfDoc.getPage(pageNum).then((page) => {
      if (cancelled || !canvasRef.current) return;
      const natural = { width: page.getViewport({ scale: 1 }).width, height: page.getViewport({ scale: 1 }).height };
      naturalSizeRef.current = natural;

      if (large && !autoFitDoneRef.current) {
        autoFitDoneRef.current = true;
        const availWidth = contentRef.current ? contentRef.current.clientWidth - 48 : 0;
        if (availWidth > 0 && availWidth < natural.width) {
          setScale(Math.max(MIN_SCALE, availWidth / natural.width));
          return; // the scale change re-triggers this effect at the fitted size
        }
      }

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
  }, [pdfDoc, pageNum, scale, large]);

  function fitWidth() {
    const natural = naturalSizeRef.current;
    const availWidth = contentRef.current?.clientWidth;
    if (!natural || !availWidth) return;
    setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, (availWidth - 48) / natural.width)));
  }

  function fitPage() {
    const natural = naturalSizeRef.current;
    const el = contentRef.current;
    if (!natural || !el) return;
    const availWidth = el.clientWidth - 48;
    const availHeight = el.clientHeight - 48;
    setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(availWidth / natural.width, availHeight / natural.height))));
  }

  if (error) {
    return (
      <UnsupportedViewer
        file={file}
        message={error}
        onRetry={() => {
          setError(null);
          setLoading(true);
          setRetryKey((k) => k + 1);
        }}
      />
    );
  }

  return (
    <ViewerChrome
      containerRef={containerRef}
      contentRef={contentRef}
      variant={variant}
      toolbar={
        <>
          <div className="flex items-center gap-1">
            <IconButton label="Previous page" disabled={loading || pageNum <= 1} onClick={() => setPageNum((p) => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </IconButton>
            <span className="text-xs tabular-nums text-muted-foreground min-w-[64px] text-center">
              {loading ? "…" : `${pageNum} / ${numPages}`}
            </span>
            <IconButton label="Next page" disabled={loading || pageNum >= numPages} onClick={() => setPageNum((p) => p + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </IconButton>
          </div>
          <div className="flex items-center gap-1">
            <IconButton label="Zoom out" disabled={scale <= MIN_SCALE} onClick={() => setScale((s) => Math.max(MIN_SCALE, s - 0.1))}>
              <ZoomOut className="h-3.5 w-3.5" />
            </IconButton>
            <span className="text-xs tabular-nums text-muted-foreground min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
            <IconButton label="Zoom in" disabled={scale >= MAX_SCALE} onClick={() => setScale((s) => Math.min(MAX_SCALE, s + 0.1))}>
              <ZoomIn className="h-3.5 w-3.5" />
            </IconButton>
            {large && (
              <>
                <IconButton label="Fit width" disabled={loading} onClick={fitWidth}>
                  <StretchHorizontal className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton label="Fit page" disabled={loading} onClick={fitPage}>
                  <Square className="h-3.5 w-3.5" />
                </IconButton>
              </>
            )}
            <IconButton label="Download" onClick={() => downloadDataUrl(file.dataUrl, file.fileName)}>
              <Download className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton label={isFullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen} active={isFullscreen}>
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </IconButton>
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

function TextViewer({ file, variant = "compact" }: { file: DraftAttachment; variant?: ViewerVariant }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef);
  // A pure, synchronous decode of the current file — no effect needed;
  // callers key DocumentViewer by file identity for a fresh instance.
  const [text] = useState(() => dataUrlToText(file.dataUrl));

  return (
    <ViewerChrome
      containerRef={containerRef}
      variant={variant}
      toolbar={
        <>
          <span className="text-xs text-muted-foreground">{formatFileSize(file.sizeBytes)}</span>
          <div className="flex items-center gap-1 ml-auto">
            <IconButton label="Download" onClick={() => downloadDataUrl(file.dataUrl, file.fileName)}>
              <Download className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton label={isFullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen} active={isFullscreen}>
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </IconButton>
          </div>
        </>
      }
    >
      <pre
        className={
          variant === "large"
            ? "w-full max-w-3xl text-sm text-foreground whitespace-pre-wrap font-mono bg-card rounded-lg p-6 border border-border shadow-card"
            : "w-full text-xs text-foreground whitespace-pre-wrap font-mono bg-card rounded-lg p-3 border border-border"
        }
      >
        {text}
      </pre>
    </ViewerChrome>
  );
}

function ImageViewer({ file, variant = "compact" }: { file: DraftAttachment; variant?: ViewerVariant }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef);

  return (
    <ViewerChrome
      containerRef={containerRef}
      variant={variant}
      toolbar={
        <>
          <span className="text-xs text-muted-foreground">{formatFileSize(file.sizeBytes)}</span>
          <div className="flex items-center gap-1 ml-auto">
            <IconButton label="Download" onClick={() => downloadDataUrl(file.dataUrl, file.fileName)}>
              <Download className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton label={isFullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen} active={isFullscreen}>
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </IconButton>
          </div>
        </>
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={file.dataUrl} alt={file.fileName} className="max-w-full rounded shadow-card object-contain" />
    </ViewerChrome>
  );
}

function UnsupportedViewer({ file, message, onRetry }: { file: DraftAttachment; message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 px-4 text-center w-full">
      {message ? <FileWarning className="h-8 w-8 text-muted-foreground" /> : <FileIcon className="h-8 w-8 text-muted-foreground" />}
      <div>
        <p className="text-sm font-medium text-foreground">{file.fileName}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {message ?? `Inline preview isn't available for ${getFileTypeLabel(file.mimeType)} files.`}
        </p>
        <p className="text-[11px] text-muted-foreground/80 mt-1">
          {getFileTypeLabel(file.mimeType)} · {formatFileSize(file.sizeBytes)}
          {file.createdAt ? ` · Uploaded ${formatDateTime(file.createdAt)}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {onRetry && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
            <RotateCw className="h-3.5 w-3.5" /> Retry Preview
          </Button>
        )}
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadDataUrl(file.dataUrl, file.fileName)}>
          <Download className="h-3.5 w-3.5" /> Download
        </Button>
      </div>
    </div>
  );
}
