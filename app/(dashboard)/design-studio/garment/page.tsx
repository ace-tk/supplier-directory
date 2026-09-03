"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GarmentInput } from "@/components/garment-studio/GarmentInput";
import { ResultsGallery } from "@/components/garment-studio/ResultsGallery";

// Full-bleed, escaping the normal padded/scrollable portal shell — same
// established pattern as AI Mood Board Studio (components/mood-board/
// MoodBoardStudio.tsx), since the reference itself shows no surrounding
// dashboard chrome at all, just its own header + workspace.
export default function GarmentStudioHomePage() {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="fixed inset-0 z-40 bg-background flex flex-col">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card shrink-0">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-[360px] shrink-0 border-r border-border bg-card px-5 py-5 flex flex-col min-h-0">
          <h1 className="text-base font-semibold text-foreground mb-4 shrink-0">AI Garment Studio</h1>
          <GarmentInput
            onGenerated={(id) => {
              setRefreshKey((k) => k + 1);
              router.push(`/design-studio/garment/${id}`);
            }}
          />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-6 py-5">
          <ResultsGallery refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
}
