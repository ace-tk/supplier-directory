"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Download, FileText, Image as ImageIcon, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { dataUrlToFile } from "@/lib/file-to-data-url";
import { exportTransparentArtworkAction } from "@/services/embroidery";
import { computeProductionSpec, type EmbroideryAnalysis, type EmbroiderySettings, type PlacementId } from "@/lib/embroidery-production";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/60 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function ProductionExportPanel({
  name,
  analysis,
  settings,
  placement,
  sizePercent,
  embroideryImage,
}: {
  name: string;
  analysis: EmbroideryAnalysis;
  settings: EmbroiderySettings;
  placement: PlacementId;
  sizePercent: number;
  embroideryImage: string;
}) {
  const [exportingTransparent, setExportingTransparent] = useState(false);
  const spec = computeProductionSpec(analysis, settings, placement, sizePercent);

  async function handleTransparentExport() {
    setExportingTransparent(true);
    try {
      const file = await dataUrlToFile(embroideryImage, "embroidery.png");
      const result = await exportTransparentArtworkAction(file);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      downloadDataUrl(result.data, `${name || "embroidery"}-transparent.png`);
    } finally {
      setExportingTransparent(false);
    }
  }

  function handleSummaryExport() {
    const lines = [
      `EMBROIDERY SPECIFICATION — ${name || "Untitled Embroidery"}`,
      "",
      `Design Size: ${spec.widthMm} x ${spec.heightMm} mm`,
      `Thread Colors: ${spec.threadColorCount}`,
      `Estimated Stitch Count: ~${spec.estimatedStitchCount.toLocaleString()} (estimated)`,
      `Technique: ${spec.technique}`,
      `Complexity: ${spec.complexity} (AI estimate)`,
      `Backing: ${spec.backingRecommended ? "Recommended" : "Optional"}`,
      "",
      ...(spec.warnings.length ? ["Warnings:", ...spec.warnings.map((w) => `- ${w}`)] : []),
      "",
      "Note: stitch count and complexity are AI/heuristic estimates, not output from a machine embroidery digitization engine.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, `${name || "embroidery"}-spec.txt`);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-foreground">Embroidery Specification</p>
          <Badge variant="secondary" className="border-0 text-[10px] gap-1">
            <Info className="w-2.5 h-2.5" /> Estimated
          </Badge>
        </div>
        <Stat label="Design Size" value={`${spec.widthMm} × ${spec.heightMm} mm`} />
        <Stat label="Thread Colors" value={spec.threadColorCount} />
        <Stat label="Estimated Stitch Count" value={`~${spec.estimatedStitchCount.toLocaleString()}`} />
        <Stat label="Technique" value={spec.technique} />
        <Stat label="Complexity" value={spec.complexity} />
        <Stat label="Backing" value={spec.backingRecommended ? "Recommended" : "Optional"} />

        {spec.warnings.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {spec.warnings.map((w, i) => (
              <p key={i} className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {w}
              </p>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground mb-2">Export</p>
        <div className="space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => downloadDataUrl(embroideryImage, `${name || "embroidery"}-preview.png`)}>
            <ImageIcon className="w-3.5 h-3.5" /> Embroidery Preview PNG
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleTransparentExport} disabled={exportingTransparent}>
            {exportingTransparent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
            {exportingTransparent ? "Removing background…" : "Transparent Artwork"}
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleSummaryExport}>
            <FileText className="w-3.5 h-3.5" /> Production Specification (.txt)
          </Button>
        </div>

        <div className="mt-3 pt-3 border-t border-border/60 space-y-1.5">
          {["DST", "PES", "EXP"].map((format) => (
            <div key={format} className="flex items-center justify-between text-xs text-muted-foreground/70">
              <span className="flex items-center gap-1.5">
                <Download className="w-3 h-3" /> {format} (machine embroidery file)
              </span>
              <Badge variant="secondary" className="border-0 text-[10px]">
                Coming Soon
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
