"use client";

import { useRef, useState } from "react";
import { Download, Maximize2, Minimize2, ZoomIn, ZoomOut, Scan } from "lucide-react";
import { formatFileSize } from "@/lib/content-ui";
import { downloadDataUrl, IconButton, ViewerChrome, useFullscreen, type ViewerVariant } from "./shared";
import type { DraftAttachment } from "@/types/content";

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

export function ImageViewer({ file, variant = "compact" }: { file: DraftAttachment; variant?: ViewerVariant }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef);
  const [scale, setScale] = useState(1);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  return (
    <ViewerChrome
      containerRef={containerRef}
      variant={variant}
      toolbar={
        <>
          <span className="text-xs text-muted-foreground">
            {formatFileSize(file.sizeBytes)}
            {dimensions ? ` · ${dimensions.width} × ${dimensions.height}px` : ""}
          </span>
          <div className="flex items-center gap-1 ml-auto">
            <IconButton label="Zoom out" disabled={scale <= MIN_SCALE} onClick={() => setScale((s) => Math.max(MIN_SCALE, s - 0.25))}>
              <ZoomOut className="h-3.5 w-3.5" />
            </IconButton>
            <span className="text-xs tabular-nums text-muted-foreground min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
            <IconButton label="Zoom in" disabled={scale >= MAX_SCALE} onClick={() => setScale((s) => Math.min(MAX_SCALE, s + 0.25))}>
              <ZoomIn className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton label="Fit" onClick={() => setScale(1)}>
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={file.dataUrl}
        alt={file.fileName}
        onLoad={(e) => setDimensions({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
        style={{ transform: `scale(${scale})` }}
        className="max-w-full rounded shadow-card object-contain transition-transform origin-center"
      />
    </ViewerChrome>
  );
}
