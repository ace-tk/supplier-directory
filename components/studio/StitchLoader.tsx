"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const DEFAULT_HELPERS = ["Cutting fabric...", "Stitching seams...", "Adding finishing touches..."];

/**
 * Keeps a loading flag true for at least `ms` after it starts, so a fast
 * action never flashes the loader. Pass the real loading flag; render the loader
 * while the returned value is true. Does not change the original flag.
 */
export function useMinDuration(active: boolean, ms = 400): boolean {
  const [shown, setShown] = useState(active);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  useEffect(() => {
    if (active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror the flag, remembering when it began
      setShown(true);
      setStartedAt((t) => t ?? Date.now());
      return;
    }
    if (startedAt === null) {
      setShown(false);
      return;
    }
    const remaining = Math.max(0, ms - (Date.now() - startedAt));
    const id = window.setTimeout(() => {
      setShown(false);
      setStartedAt(null);
    }, remaining);
    return () => window.clearTimeout(id);
  }, [active, ms, startedAt]);

  return active || shown;
}

interface StitchLoaderProps {
  /** Caption under the animation */
  label?: string;
  /** Texts cycled every 2.5s once the wait passes 5s. Pass [] to disable. */
  helperTexts?: string[];
  className?: string;
}

/**
 * Thread & needle loader for the AI Garment Studio: a dashed thread draws left to
 * right while a needle bobs along its end. Pure CSS (width/transform/opacity),
 * coloured with theme tokens, static under prefers-reduced-motion.
 */
export function StitchLoader({ label = "Stitching your design...", helperTexts = DEFAULT_HELPERS, className }: StitchLoaderProps) {
  const [helperIndex, setHelperIndex] = useState<number | null>(null);

  useEffect(() => {
    if (helperTexts.length === 0) return;
    let cycle: number | undefined;
    const start = window.setTimeout(() => {
      setHelperIndex(0);
      cycle = window.setInterval(() => setHelperIndex((i) => ((i ?? 0) + 1) % helperTexts.length), 2500);
    }, 5000);
    return () => {
      window.clearTimeout(start);
      if (cycle) window.clearInterval(cycle);
    };
  }, [helperTexts]);

  return (
    <div role="status" aria-live="polite" className={cn("flex flex-col items-center gap-3 text-center", className)}>
      <div className="relative h-[60px] w-[240px]" aria-hidden>
        <div
          className="stitch-line absolute left-0 top-[30px] h-0 w-0 border-t-[3px] border-dashed"
          style={{ borderColor: "var(--pri)", animation: "draw 2.4s ease-in-out infinite" }}
        />
        <div className="stitch-needle absolute top-[10px] left-0 size-10" style={{ animation: "nmove 2.4s ease-in-out infinite" }}>
          <svg
            className="stitch-bob size-10"
            viewBox="0 0 40 40"
            fill="none"
            stroke="var(--pri)"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ animation: "bob 0.4s ease-in-out infinite alternate", transformOrigin: "20px 20px" }}
          >
            <path d="M8 34 L30 8" />
            <ellipse cx="30.5" cy="9.5" rx="1.6" ry="3.2" transform="rotate(38 30.5 9.5)" />
          </svg>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="h-4 text-xs text-muted-foreground/80" aria-hidden={helperIndex === null}>
        {helperIndex !== null ? helperTexts[helperIndex] : ""}
      </p>
    </div>
  );
}

/** Fills the content area (shell stays mounted). Use for Studio route loading.tsx files. */
export function StitchLoaderFullscreen({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <StitchLoader label={label} />
    </div>
  );
}
