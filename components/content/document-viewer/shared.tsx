"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export type ViewerVariant = "compact" | "large";

export function downloadDataUrl(dataUrl: string, fileName: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function IconButton({
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

export function ViewerChrome({
  children,
  toolbar,
  containerRef,
  contentRef,
  variant = "compact",
  contentClassName,
}: {
  children: React.ReactNode;
  toolbar: React.ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  contentRef?: React.RefObject<HTMLDivElement | null>;
  variant?: ViewerVariant;
  contentClassName?: string;
}) {
  const large = variant === "large";
  return (
    <div ref={containerRef} className="bg-background flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-border bg-muted/40 flex-wrap shrink-0">{toolbar}</div>
      <div
        ref={contentRef}
        className={
          contentClassName ??
          (large
            ? "flex-1 min-h-0 overflow-auto flex items-start justify-center p-6 bg-muted/20"
            : "max-h-[420px] overflow-auto flex items-start justify-center p-3 bg-muted/20")
        }
      >
        {children}
      </div>
    </div>
  );
}

export function useFullscreen(ref: React.RefObject<HTMLDivElement | null>) {
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

export function LoadingState() {
  return (
    <div className="flex items-center justify-center h-40 w-full text-muted-foreground gap-2 text-sm">
      <Loader2 className="h-5 w-5 animate-spin" /> Loading document...
    </div>
  );
}
