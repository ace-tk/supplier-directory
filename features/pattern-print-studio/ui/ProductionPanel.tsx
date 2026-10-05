"use client";

import { useState } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PREFLIGHT_LABEL, type Editor, type EditorState, type PreflightIssue, type PreflightKind, type SeamState } from "../engine/Editor";
import { formatUnits, UNIT_LABEL } from "../engine/units";
import { LengthField } from "./LengthField";

type Result = { ok: boolean; message: string };
const KINDS = Object.keys(PREFLIGHT_LABEL) as PreflightKind[];

/** Production safety: bleed, seam match preview, and the pre-flight check. */
export function ProductionPanel({ editor, state, onResult, children }: { editor: Editor; state: EditorState; onResult: (r: Result) => void; children?: React.ReactNode }) {
  const unit = state.settings.units;
  const bleed = state.settings.bleed;
  const clip = state.clip;
  const seam = state.seam;
  const [report, setReport] = useState<{ issues: PreflightIssue[]; version: number } | null>(null);
  const stale = !!report && report.version !== state.docVersion;

  return (
    <div className="grid gap-3 p-2 text-xs">
      <section className="grid gap-1.5 rounded-md border border-border p-2" aria-label="Bleed">
        <span className="font-medium text-foreground">Bleed</span>
        <p className="text-muted-foreground">The print runs this far past every cut line, so no white shows if the cut is slightly off. The cut line itself never moves.</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Document ({UNIT_LABEL[unit]})</span>
          <LengthField label="" inches={bleed.amount} unit={unit} onCommit={(v) => editor.updateSettings({ bleed: { ...bleed, amount: Math.max(0, v) } })} title="Bleed for every piece that has no bleed of its own" />
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={bleed.visible} onChange={(e) => editor.updateSettings({ bleed: { ...bleed, visible: e.target.checked } })} /> Show bleed area (light pink tint)
        </label>
        {clip ? (
          <div className="grid gap-1 border-t border-border pt-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-muted-foreground" title={clip.label ?? "Selected piece"}>
                {clip.label ?? "Selected piece"}
              </span>
              <LengthField label="" inches={clip.bleed} unit={unit} onCommit={(v) => editor.setClipBleed(Math.max(0, v))} title="This piece's own bleed" />
            </div>
            {clip.ownBleed ? (
              <button type="button" className="justify-self-start text-primary hover:underline" onClick={() => editor.setClipBleed(null)}>
                Use the document bleed again
              </button>
            ) : (
              <span className="text-muted-foreground">Follows the document bleed. Type a value to give this piece its own.</span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">Select a piece with a print to give it its own bleed.</span>
        )}
      </section>

      <section className="grid gap-1.5 rounded-md border border-border p-2" aria-label="Seam match">
        <span className="font-medium text-foreground">Seam match preview</span>
        <p className="text-muted-foreground">Pick the two edges that get sewn together (e.g. the side seams of Front and Back), then preview them joined. Nothing in the layout moves.</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Button size="sm" variant={seam.picking === "a" ? "default" : "outline"} onClick={() => editor.beginPickSeam("a")} title="Then click the edge on the first piece">
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-orange-500" /> {seam.a ? `A: ${seam.a}` : "Pick edge A"}
          </Button>
          <Button size="sm" variant={seam.picking === "b" ? "default" : "outline"} onClick={() => editor.beginPickSeam("b")} title="Then click the edge on the second piece">
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-teal-600" /> {seam.b ? `B: ${seam.b}` : "Pick edge B"}
          </Button>
        </div>
        {seam.picking && <p className="text-primary">Now click that edge on the outline of the piece…</p>}
        <div className="flex gap-1.5">
          <Button size="sm" className="flex-1" disabled={!seam.a || !seam.b || !!seam.preview} onClick={() => onResult(editor.previewSeam())}>
            Preview seam
          </Button>
          <Button size="sm" variant="ghost" disabled={!seam.a && !seam.b} onClick={() => editor.clearSeam()}>
            Clear
          </Button>
        </div>
      </section>

      <section className="grid gap-1.5 rounded-md border border-border p-2" aria-label="Pre-flight">
        <span className="font-medium text-foreground">Pre-flight check</span>
        <Button size="sm" onClick={() => setReport({ issues: editor.runPreflight(), version: editor.getState().docVersion })}>
          {report ? "Run again" : "Run pre-flight"}
        </Button>
        {report && stale && <p className="text-amber-600">The document changed since this check — run it again.</p>}
        {report && report.issues.length === 0 && (
          <p className="flex items-center gap-1.5 text-emerald-600" role="status">
            <CircleCheck className="h-3.5 w-3.5" /> No problems found.
          </p>
        )}
        {report && report.issues.length > 0 && (
          <div className="grid gap-2" role="list" aria-label="Pre-flight issues">
            <p className="text-muted-foreground" role="status">
              {report.issues.length} issue{report.issues.length === 1 ? "" : "s"} — click one to zoom to it.
            </p>
            {KINDS.filter((k) => report.issues.some((i) => i.kind === k)).map((k) => {
              const list = report.issues.filter((i) => i.kind === k);
              return (
                <div key={k} className="grid gap-0.5">
                  <span className="font-medium text-foreground">
                    {PREFLIGHT_LABEL[k]} ({list.length})
                  </span>
                  {list.map((issue, n) => (
                    <button key={n} type="button" role="listitem" data-kind={issue.kind} className="flex items-start gap-1.5 rounded px-1 py-1 text-left hover:bg-accent" onClick={() => editor.showIssue(issue)} title="Zoom to this piece">
                      <TriangleAlert className={cn("mt-0.5 h-3 w-3 shrink-0", issue.level === "error" ? "text-red-600" : "text-amber-500")} />
                      <span className="min-w-0">
                        <span className="font-medium text-foreground">{issue.label}</span> <span className="text-muted-foreground">{issue.message}</span>
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </section>
      {children}
    </div>
  );
}

/** Floating bar shown while the seam preview is open. */
export function SeamBar({ editor, seam, unit, onResult }: { editor: Editor; seam: SeamState; unit: EditorState["settings"]["units"]; onResult: (r: Result) => void }) {
  const pv = seam.preview;
  if (!pv) return null;
  const moved = Math.hypot(pv.dx, pv.dy) > 1e-9;
  return (
    <div role="toolbar" aria-label="Seam preview" className="fixed left-1/2 top-32 z-40 flex -translate-x-1/2 flex-wrap items-center gap-2 rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <span className="font-medium text-foreground">
        Seam preview: {seam.a} + {seam.b}
      </span>
      <span className="text-muted-foreground">preview only — the layout has not moved</span>
      {pv.canNudge ? (
        <>
          <span className="text-muted-foreground">Arrow keys move the print of {seam.b}:</span>
          <LengthField label="X" inches={pv.dx} unit={unit} onCommit={(v) => editor.setSeamOffset(v, pv.dy)} />
          <LengthField label="Y" inches={pv.dy} unit={unit} onCommit={(v) => editor.setSeamOffset(pv.dx, v)} />
          <Button size="sm" disabled={!moved} onClick={() => onResult(editor.applySeamOffset())} title="Move the real print of piece B by this much (Enter)">
            Apply offset{moved ? ` (${formatUnits(pv.dx, unit)}, ${formatUnits(pv.dy, unit)})` : ""}
          </Button>
        </>
      ) : (
        <span className="text-muted-foreground">{seam.b} has no print to move.</span>
      )}
      <Button size="sm" variant="outline" onClick={() => editor.closeSeamPreview()} title="Close the preview (Esc)">
        Close
      </Button>
    </div>
  );
}
