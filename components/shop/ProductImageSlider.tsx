"use client";

import { useState } from "react";
import { motion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const SWIPE_THRESHOLD = 40;

export function ProductImageSlider({ images, alt }: { images: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const hasMultiple = images.length > 1;
  const slideWidthPct = 100 / images.length;

  function go(delta: number) {
    setIndex((i) => (i + delta + images.length) % images.length);
  }

  function handlePanEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -SWIPE_THRESHOLD) go(1);
    else if (info.offset.x > SWIPE_THRESHOLD) go(-1);
  }

  return (
    <div className="relative w-full overflow-hidden">
      <div className="transition-transform duration-300 ease-out group-hover:scale-[1.04]">
        <motion.div
          className="flex"
          style={{ width: `${images.length * 100}%` }}
          animate={{ x: `-${index * slideWidthPct}%` }}
          transition={{ type: "tween", duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          onPanEnd={hasMultiple ? handlePanEnd : undefined}
        >
          {images.map((src, i) => (
            <div key={i} style={{ width: `${slideWidthPct}%` }} className="shrink-0">
              <img
                src={src}
                alt={alt}
                className="block w-full h-auto object-cover select-none"
                loading="lazy"
                draggable={false}
              />
            </div>
          ))}
        </motion.div>
      </div>

      {hasMultiple && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            aria-label="Previous image"
            className="absolute left-2 top-1/2 -translate-y-1/2 hidden sm:flex w-7 h-7 rounded-full bg-black/40 backdrop-blur-md text-white items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/60"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            aria-label="Next image"
            className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:flex w-7 h-7 rounded-full bg-black/40 backdrop-blur-md text-white items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/60"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10 transition-opacity duration-200 group-hover:opacity-0">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex(i);
                }}
                aria-label={`Show image ${i + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200",
                  i === index ? "w-4 bg-white" : "w-1.5 bg-white/50 hover:bg-white/75"
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
