"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Paper.js and the whole editor load only on this route, client-side only.
const PatternPrintStudio = dynamic(() => import("./PatternPrintStudio"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-40 flex items-center justify-center gap-2 bg-background text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading Pattern Print Studio…
    </div>
  ),
});

export function PatternPrintStudioLoader() {
  return <PatternPrintStudio />;
}
