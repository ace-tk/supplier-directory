import { notFound } from "next/navigation";
import { isPatternStudioEnabled } from "@/features/pattern-print-studio/flag";
import { PatternPrintStudioLoader } from "@/features/pattern-print-studio/PatternPrintStudioLoader";

export default function PatternPrintStudioPage() {
  if (!isPatternStudioEnabled()) notFound();
  return <PatternPrintStudioLoader />;
}
