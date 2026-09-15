"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Download, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { dataUrlToFile } from "@/lib/file-to-data-url";
import { exportTransparentArtworkAction } from "@/services/embroidery";
import {
  computeProductionSpec,
  computePrintProductionSpec,
  describeThreadColor,
  DECORATION_TECHNIQUES,
  type EmbroideryAnalysis,
  type EmbroiderySettings,
  type PlacementId,
} from "@/lib/embroidery-production";

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

/** Production Readiness — three real, deterministic checkpoints (never a
 * claim of machine-readiness): a source artwork exists, an AI embroidery
 * conversion exists, and a production estimate has been computed. */
function ReadinessRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${done ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/30"}`} />
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

function ThreadColorList({ settings }: { settings: EmbroiderySettings }) {
  if (settings.threadColors.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{DECORATION_TECHNIQUES[settings.technique].colorLabel}</p>
      <div className="space-y-1">
        {settings.threadColors.map((c, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-3.5 h-3.5 rounded-full border border-border shrink-0" style={{ backgroundColor: c.hex }} />
            <span className="text-foreground truncate">{describeThreadColor(c)}</span>
          </div>
        ))}
      </div>
      {settings.threadColors.some((c) => c.pantoneCode) && (
        <p className="mt-1.5 text-[10px] text-muted-foreground">Digital color values are screen approximations and should not be treated as a physical Pantone standard.</p>
      )}
    </div>
  );
}

/** Screen Print / HD Print / Puff Print — deliberately smaller than the
 * embroidery specification below: no stitch/backing estimate exists for a
 * print, and this app doesn't fabricate one (see computePrintProductionSpec). */
function PrintProductionPanel({ settings, placement, sizePercent }: { settings: EmbroiderySettings; placement: PlacementId; sizePercent: number }) {
  const config = DECORATION_TECHNIQUES[settings.technique];
  const spec = computePrintProductionSpec(settings, placement, sizePercent);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Production Readiness</p>
        <div className="space-y-1.5">
          <ReadinessRow label="Preview Ready" done />
          <ReadinessRow label="AI Converted" done />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Specification</p>
          <Badge variant="secondary" className="border-0 text-[10px]">
            Estimated
          </Badge>
        </div>
        <Stat label="Decoration Technique" value={config.productionLabel} />
        <Stat label="Print Size" value={`${spec.widthMm} × ${spec.heightMm} mm`} />
        <Stat label="Color References" value={spec.colorCount} />
      </div>

      <ThreadColorList settings={settings} />

      {spec.note && <p className="text-[10px] text-muted-foreground">{spec.note}</p>}
      <p className="text-[10px] text-muted-foreground">
        This app does not generate production-ready print separation, RIP, or manufacturing files — treat this as a design/creative reference only.
      </p>
    </div>
  );
}

export function ProductionPanel({
  analysis,
  settings,
  placement,
  sizePercent,
}: {
  analysis: EmbroideryAnalysis;
  settings: EmbroiderySettings;
  placement: PlacementId;
  sizePercent: number;
}) {
  if (settings.technique !== "EMBROIDERY") {
    return <PrintProductionPanel settings={settings} placement={placement} sizePercent={sizePercent} />;
  }

  const spec = computeProductionSpec(analysis, settings, placement, sizePercent);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Production Readiness</p>
        <div className="space-y-1.5">
          <ReadinessRow label="Preview Ready" done />
          <ReadinessRow label="AI Converted" done />
          <ReadinessRow label="Production Estimate" done />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Specification</p>
          <Badge variant="secondary" className="border-0 text-[10px]">
            Estimated
          </Badge>
        </div>
        <Stat label="Decoration Technique" value={DECORATION_TECHNIQUES[settings.technique].productionLabel} />
        <Stat label="Design Size" value={`${spec.widthMm} × ${spec.heightMm} mm`} />
        <Stat label="Thread Colors" value={spec.threadColorCount} />
        <Stat label="Estimated Thread Count" value={spec.threadColorCount} />
        <Stat label="Estimated Stitch Count" value={`~${spec.estimatedStitchCount.toLocaleString()}`} />
        <Stat label="Technique" value={spec.technique} />
        <Stat label="Complexity" value={spec.complexity} />
        <Stat label="Backing" value={spec.backingRecommended ? "Recommended" : "Optional"} />
      </div>

      <ThreadColorList settings={settings} />

      {spec.warnings.length > 0 && (
        <div className="space-y-1.5">
          {spec.warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {w}
            </p>
          ))}
          <p className="text-[10px] text-muted-foreground">Estimated stitch count may differ from final machine digitization.</p>
        </div>
      )}
    </div>
  );
}

export function ExportActions({ name, embroideryImage, analysis, settings, placement, sizePercent }: {
  name: string;
  embroideryImage: string;
  analysis: EmbroideryAnalysis;
  settings: EmbroiderySettings;
  placement: PlacementId;
  sizePercent: number;
}) {
  const [exportingTransparent, setExportingTransparent] = useState(false);
  const isEmbroidery = settings.technique === "EMBROIDERY";

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
    const decorationLine = `Decoration Technique: ${DECORATION_TECHNIQUES[settings.technique].productionLabel}`;
    const lines = isEmbroidery
      ? (() => {
          const spec = computeProductionSpec(analysis, settings, placement, sizePercent);
          return [
            `EMBROIDERY SPECIFICATION — ${name || "Untitled Embroidery"}`,
            "",
            decorationLine,
            `Design Size: ${spec.widthMm} x ${spec.heightMm} mm`,
            `Thread Colors: ${spec.threadColorCount}`,
            ...settings.threadColors.map((c, i) => `  ${i + 1}. ${describeThreadColor(c)}`),
            `Estimated Stitch Count: ~${spec.estimatedStitchCount.toLocaleString()} (estimated)`,
            `Technique: ${spec.technique}`,
            `Complexity: ${spec.complexity} (AI estimate)`,
            `Backing: ${spec.backingRecommended ? "Recommended" : "Optional"}`,
            "",
            ...(spec.warnings.length ? ["Warnings:", ...spec.warnings.map((w) => `- ${w}`)] : []),
            ...(settings.threadColors.some((c) => c.pantoneCode) ? ["", "Digital color values are screen approximations and should not be treated as a physical Pantone standard."] : []),
            "",
            "Note: stitch count and complexity are AI/heuristic estimates, not output from a machine embroidery digitization engine.",
          ];
        })()
      : (() => {
          const spec = computePrintProductionSpec(settings, placement, sizePercent);
          return [
            `PRODUCTION SPECIFICATION — ${name || "Untitled Design"}`,
            "",
            decorationLine,
            `Print Size: ${spec.widthMm} x ${spec.heightMm} mm`,
            `Color References: ${spec.colorCount}`,
            ...settings.threadColors.map((c, i) => `  ${i + 1}. ${describeThreadColor(c)}`),
            "",
            ...(spec.note ? [spec.note] : []),
            ...(settings.threadColors.some((c) => c.pantoneCode) ? ["Digital color values are screen approximations and should not be treated as a physical Pantone standard."] : []),
            "",
            "Note: this app does not generate production-ready print separation, RIP, or manufacturing files — treat this as a design/creative reference only.",
          ];
        })();
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, `${name || "embroidery"}-spec.txt`);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => downloadDataUrl(embroideryImage, `${name || "embroidery"}-preview.png`)}>
        <ImageIcon className="w-3.5 h-3.5" /> Preview Export (PNG)
      </Button>
      <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleTransparentExport} disabled={exportingTransparent}>
        {exportingTransparent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
        {exportingTransparent ? "Removing background…" : "Transparent Artwork"}
      </Button>
      <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleSummaryExport}>
        <FileText className="w-3.5 h-3.5" /> Production Specification (.txt)
      </Button>

      {isEmbroidery && (
        <div className="pt-2 mt-1 border-t border-border/60 space-y-1.5">
          {["DST", "PES", "EXP"].map((format) => (
            <div key={format} className="flex items-center justify-between text-xs text-muted-foreground/70">
              <span className="flex items-center gap-1.5">
                <Download className="w-3 h-3" /> {format} (machine-ready embroidery file)
              </span>
              <Badge variant="secondary" className="border-0 text-[10px]">
                Coming Soon
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
