import { Info } from "lucide-react";
import type { EmbroideryAnalysis } from "@/lib/embroidery-production";
import { Badge } from "@/components/ui/badge";

const SUITABILITY_STYLE: Record<EmbroideryAnalysis["suitability"], string> = {
  Poor: "bg-red-500/10 text-red-600 dark:text-red-400",
  Fair: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Good: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Excellent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/60 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export function AnalysisPanel({ analysis, loading }: { analysis: EmbroideryAnalysis | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Analyzing artwork…</p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
        </div>
      </div>
    );
  }

  if (!analysis) {
    return <p className="text-sm text-muted-foreground">Upload artwork to run an embroidery analysis.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-foreground">Embroidery Analysis</p>
        <Badge variant="secondary" className="border-0 text-[10px] gap-1">
          <Info className="w-2.5 h-2.5" /> AI estimate
        </Badge>
      </div>
      <div>
        <Stat label="Complexity" value={analysis.complexity} />
        <Stat label="Colors" value={analysis.colorCount} />
        <Stat label="Fine details" value={analysis.fineDetails} />
        <Stat label="Thin lines" value={analysis.thinLines ? "Detected" : "None"} />
        <Stat label="Text" value={analysis.textDetected ? "Detected" : "None"} />
        <Stat label="Gradients" value={analysis.gradients ? "Detected" : "None"} />
        <Stat
          label="Embroidery suitability"
          value={
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${SUITABILITY_STYLE[analysis.suitability]}`}>
              {analysis.suitability}
            </span>
          }
        />
      </div>
      {analysis.colors.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5">
          {analysis.colors.map((c, i) => (
            <span key={`${c}-${i}`} className="h-5 w-5 rounded-full border border-border" style={{ backgroundColor: c }} title={c} />
          ))}
        </div>
      )}
      {analysis.recommendations.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {analysis.recommendations.map((rec, i) => (
            <p key={i} className="text-xs text-muted-foreground leading-relaxed">
              • {rec}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
