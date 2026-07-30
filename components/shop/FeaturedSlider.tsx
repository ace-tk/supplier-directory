"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FEATURED_SLIDES } from "@/lib/shop-data";
import { cn } from "@/lib/utils";

export function FeaturedSlider({
  onSlideClick,
}: {
  onSlideClick?: (category: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const slides = FEATURED_SLIDES;

  const next = useCallback(() => setIndex((i) => (i + 1) % slides.length), [slides.length]);
  const prev = useCallback(() => setIndex((i) => (i - 1 + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  const slide = slides[index];

  return (
    <div className="relative w-full h-[260px] sm:h-[340px] lg:h-[400px] rounded-3xl overflow-hidden group shadow-elevated">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <img
            src={slide.image}
            alt={slide.title}
            className="w-full h-full object-cover"
            loading={index === 0 ? "eager" : "lazy"}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
          <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10">
            <p className="text-white/70 text-[11px] font-semibold uppercase tracking-widest mb-2">
              Featured
            </p>
            <h2 className="text-white text-2xl sm:text-4xl font-bold tracking-tight mb-2 max-w-lg">
              {slide.title}
            </h2>
            <p className="text-white/80 text-sm sm:text-base max-w-md mb-5">{slide.subtitle}</p>
            <button
              onClick={() => onSlideClick?.(slide.category)}
              className="w-fit px-5 py-2.5 rounded-full bg-white text-slate-900 text-sm font-semibold hover:bg-white/90 active:scale-95 transition-all"
            >
              {slide.cta}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Arrows */}
      <button
        onClick={prev}
        aria-label="Previous slide"
        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/50"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={next}
        aria-label="Next slide"
        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/50"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Indicators */}
      <div className="absolute bottom-4 right-6 flex items-center gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === index ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"
            )}
          />
        ))}
      </div>
    </div>
  );
}
