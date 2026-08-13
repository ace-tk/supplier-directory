"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { renderDocxToHtml } from "@/lib/docx-client";
import { formatFileSize } from "@/lib/content-ui";
import { downloadDataUrl, IconButton, ViewerChrome, useFullscreen, LoadingState, type ViewerVariant } from "./shared";
import { UnsupportedViewer } from "./UnsupportedViewer";
import type { DraftAttachment } from "@/types/content";

const MIN_SCALE = 0.5;
const MAX_SCALE = 2;

/** Real DOCX rendering via mammoth — structure-preserving HTML (headings,
 * paragraphs, bold/italic, lists, tables, embedded images), not raw XML
 * and not a fabricated summary. */
export function WordViewer({ file, variant = "compact" }: { file: DraftAttachment; variant?: ViewerVariant }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef);
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    renderDocxToHtml(file.dataUrl)
      .then((result) => {
        if (cancelled) return;
        setHtml(result.html);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't preview this document.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

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
      variant={variant}
      toolbar={
        <>
          <span className="text-xs text-muted-foreground">{formatFileSize(file.sizeBytes)}</span>
          <div className="flex items-center gap-1 ml-auto">
            <IconButton label="Zoom out" disabled={loading || scale <= MIN_SCALE} onClick={() => setScale((s) => Math.max(MIN_SCALE, s - 0.1))}>
              <ZoomOut className="h-3.5 w-3.5" />
            </IconButton>
            <span className="text-xs tabular-nums text-muted-foreground min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
            <IconButton label="Zoom in" disabled={loading || scale >= MAX_SCALE} onClick={() => setScale((s) => Math.min(MAX_SCALE, s + 0.1))}>
              <ZoomIn className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton label="Reset zoom" disabled={loading} onClick={() => setScale(1)}>
              <RotateCcw className="h-3.5 w-3.5" />
            </IconButton>
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
        <LoadingState />
      ) : (
        <div
          className="tiptap-content w-full max-w-[8.5in] bg-white text-neutral-900 rounded-lg p-10 border border-border shadow-card transition-transform origin-top"
          style={{ transform: `scale(${scale})` }}
          dangerouslySetInnerHTML={{ __html: html ?? "" }}
        />
      )}
    </ViewerChrome>
  );
}
