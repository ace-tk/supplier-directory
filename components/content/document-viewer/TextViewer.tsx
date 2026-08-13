"use client";

import { useRef, useState } from "react";
import { Download, Maximize2, Minimize2 } from "lucide-react";
import { dataUrlToText } from "@/lib/pdf-client";
import { formatFileSize } from "@/lib/content-ui";
import { downloadDataUrl, IconButton, ViewerChrome, useFullscreen, type ViewerVariant } from "./shared";
import type { DraftAttachment } from "@/types/content";

export function TextViewer({ file, variant = "compact" }: { file: DraftAttachment; variant?: ViewerVariant }) {
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
