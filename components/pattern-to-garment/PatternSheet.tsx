"use client";

import { forwardRef } from "react";

/** Fixed export width — the PNG is always this wide, whatever the screen size. */
export const PATTERN_SHEET_WIDTH = 1100;

export interface SheetPiece {
  id: string;
  name: string;
  cutCount: number;
  measurements: string;
  previewUrl: string;
}

interface PatternSheetProps {
  title: string;
  size: string;
  frontView: string | null;
  backView: string | null;
  sideView: string | null;
  pieces: SheetPiece[];
}

/**
 * The downloadable pattern sheet — the generated garment on the left, the
 * designer's own uploaded pieces on a grid on the right, with the labels,
 * cut counts and measurements they typed. Built by the app (not drawn by
 * the AI), so every label and number on it is exactly what was entered.
 *
 * Fixed light colours rather than theme tokens: this is an export artifact
 * and must look the same whether the app is in light or dark mode.
 */
export const PatternSheet = forwardRef<HTMLDivElement, PatternSheetProps>(function PatternSheet(
  { title, size, frontView, backView, sideView, pieces },
  ref
) {
  const extraViews = [
    { label: "Back", src: backView },
    { label: "Side", src: sideView },
  ].filter((v): v is { label: string; src: string } => !!v.src);

  return (
    <div ref={ref} style={{ width: PATTERN_SHEET_WIDTH }} className="grid grid-cols-[400px_1fr] overflow-hidden rounded-xl bg-card text-[#1F2A44]">
      {/* Garment */}
      <div className="flex flex-col bg-[#EFE9E0] p-6">
        <p className="text-[22px] font-semibold italic leading-tight text-[#2B2B2B]">{title || "Pattern to Garment"}</p>
        <div className="mt-5 flex flex-1 items-center justify-center">
          {frontView ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={frontView} alt="Front view" className="max-h-[560px] w-full object-contain" />
          ) : (
            <p className="text-sm text-[#7A7A7A]">Generate the front view to show the garment here.</p>
          )}
        </div>
        {extraViews.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {extraViews.map((v) => (
              <div key={v.label} className="rounded-lg bg-card/70 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.src} alt={`${v.label} view`} className="h-40 w-full object-contain" />
                <p className="mt-1 text-center text-[11px] font-semibold uppercase tracking-wider text-[#5A5A5A]">{v.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pattern pieces */}
      <div
        className="p-6"
        style={{
          backgroundColor: "#FAFAF7",
          backgroundImage: "linear-gradient(#E4E4DE 1px, transparent 1px), linear-gradient(90deg, #E4E4DE 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        <div className="flex flex-col items-center gap-2">
          <p className="rounded-lg bg-[#1F2A44] px-5 py-2 text-[20px] font-semibold text-white">Pattern pieces</p>
          {size && <p className="rounded-md bg-[#1F2A44] px-3 py-1 text-[13px] font-semibold text-white">SIZE {size.toUpperCase()}</p>}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-5">
          {pieces.map((p) => (
            <div key={p.id} className="flex flex-col rounded-lg border border-[#D8D8D0] bg-card/90 p-3">
              <div className="flex h-56 items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.previewUrl} alt={p.name} className="max-h-full max-w-full object-contain" />
              </div>
              <p className="mt-2 text-center text-[14px] font-bold uppercase tracking-wide">
                {p.name} <span className="font-semibold text-[#5A6378]">· cut {p.cutCount}</span>
              </p>
              {p.measurements && <p className="mt-1 text-center text-[12px] leading-snug text-[#4A5268]">{p.measurements}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
