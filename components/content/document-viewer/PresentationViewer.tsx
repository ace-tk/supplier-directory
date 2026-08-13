"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Maximize2, Minimize2, Scan } from "lucide-react";
import { readPptx, type PptxPresentation } from "@/lib/pptx-client";
import { formatFileSize } from "@/lib/content-ui";
import { downloadDataUrl, IconButton, ViewerChrome, useFullscreen, LoadingState, type ViewerVariant } from "./shared";
import { UnsupportedViewer } from "./UnsupportedViewer";
import type { DraftAttachment } from "@/types/content";

// 96px per inch, 914400 EMU per inch — the standard OOXML/CSS pixel ratio.
const EMU_PER_PX = 9525;

/** Real, local PPTX rendering — actual slide text and images positioned
 * from the parsed slide XML on a fixed-aspect canvas, scaled to fit the
 * available width. Not a screenshot, not a mock slide. */
export function PresentationViewer({ file, variant = "compact" }: { file: DraftAttachment; variant?: ViewerVariant }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef);
  const [pres, setPres] = useState<PptxPresentation | null>(null);
  const [slideNum, setSlideNum] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    readPptx(file.dataUrl)
      .then((p) => {
        if (cancelled) return;
        setPres(p);
        setSlideNum(1);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't preview this presentation.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  const nativeWidth = pres ? pres.widthEmu / EMU_PER_PX : 0;
  const nativeHeight = pres ? pres.heightEmu / EMU_PER_PX : 0;

  function fitToContainer() {
    const el = contentRef.current;
    if (!el || !nativeWidth || !nativeHeight) return;
    const availWidth = el.clientWidth - 32;
    const availHeight = el.clientHeight - 32;
    setScale(Math.max(0.1, Math.min(availWidth / nativeWidth, availHeight / nativeHeight)));
  }

  useEffect(() => {
    if (!pres) return;
    fitToContainer();
    window.addEventListener("resize", fitToContainer);
    return () => window.removeEventListener("resize", fitToContainer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pres, variant]);

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

  const slide = pres?.slides[slideNum - 1] ?? null;

  return (
    <ViewerChrome
      containerRef={containerRef}
      contentRef={contentRef}
      variant={variant}
      toolbar={
        <>
          <div className="flex items-center gap-1">
            <IconButton label="Previous slide" disabled={loading || slideNum <= 1} onClick={() => setSlideNum((n) => n - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </IconButton>
            <span className="text-xs tabular-nums text-muted-foreground min-w-[72px] text-center">
              {loading ? "…" : `Slide ${slideNum} / ${pres?.slides.length ?? 0}`}
            </span>
            <IconButton label="Next slide" disabled={loading || slideNum >= (pres?.slides.length ?? 0)} onClick={() => setSlideNum((n) => n + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </IconButton>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground hidden sm:inline">{formatFileSize(file.sizeBytes)}</span>
            <IconButton label="Fit view" disabled={loading} onClick={fitToContainer}>
              <Scan className="h-3.5 w-3.5" />
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
      ) : slide && nativeWidth && nativeHeight ? (
        <div style={{ width: nativeWidth * scale, height: nativeHeight * scale }}>
          <div
            className="relative bg-white shadow-card rounded overflow-hidden origin-top-left"
            style={{ width: nativeWidth, height: nativeHeight, transform: `scale(${scale})` }}
          >
            {slide.shapes.map((shape, i) =>
              shape.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={shape.dataUrl}
                  alt=""
                  className="absolute object-contain"
                  style={{
                    left: shape.x / EMU_PER_PX,
                    top: shape.y / EMU_PER_PX,
                    width: shape.w / EMU_PER_PX,
                    height: shape.h / EMU_PER_PX,
                  }}
                />
              ) : (
                <div
                  key={i}
                  className="absolute text-neutral-900 overflow-hidden"
                  style={{ left: shape.x / EMU_PER_PX, top: shape.y / EMU_PER_PX, width: shape.w / EMU_PER_PX, height: shape.h / EMU_PER_PX }}
                >
                  {shape.paragraphs.map((p, pi) => (
                    <p key={pi} className="leading-tight">
                      {p.runs.map((r, ri) => (
                        <span
                          key={ri}
                          style={{ fontSize: r.sizePt ? `${r.sizePt * (96 / 72)}px` : "16px" }}
                          className={[r.bold ? "font-bold" : "", r.italic ? "italic" : ""].filter(Boolean).join(" ")}
                        >
                          {r.text}
                        </span>
                      ))}
                    </p>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-40 w-full text-sm text-muted-foreground">This slide has no content to show.</div>
      )}
    </ViewerChrome>
  );
}
