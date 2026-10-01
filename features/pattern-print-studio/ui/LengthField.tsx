"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatUnits, parseLength, type DisplayUnit } from "../engine/units";

/**
 * Exact-value length input. Shows `inches` in `unit` (3 decimals); accepts
 * typed units ("30cm", "2in", "12.5"). Commits on Enter or blur.
 */
export function LengthField({
  label,
  inches,
  unit,
  onCommit,
  disabled,
  className,
  title,
}: {
  label: string;
  inches: number | null;
  unit: DisplayUnit;
  onCommit: (inches: number) => void;
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const shown = inches === null ? "" : formatUnits(inches, unit);
  // Only while editing do we hold our own text; otherwise show the live value.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? shown;
  const cancelled = useRef(false);

  function commit() {
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(null);
      return;
    }
    const v = draft === null ? null : parseLength(draft, unit);
    setDraft(null);
    if (v === null || inches === null) return;
    if (Math.abs(v - inches) > 1e-12) onCommit(v);
  }

  return (
    <label className={cn("flex items-center gap-1 text-[11px] text-muted-foreground", className)} title={title}>
      <span className="w-3 shrink-0 text-right font-medium">{label}</span>
      <input
        value={text}
        disabled={disabled || inches === null}
        onFocus={(e) => {
          setDraft(shown);
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
        className="h-6 w-[84px] rounded border border-border bg-background px-1.5 text-right font-mono text-[11px] text-foreground tabular-nums outline-none focus:border-primary disabled:opacity-40"
      />
    </label>
  );
}
