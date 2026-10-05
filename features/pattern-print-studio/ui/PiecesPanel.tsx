"use client";

import { useEffect, useMemo, useState } from "react";
import { Link2, Repeat2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Editor, EditorState, TagSuggestion } from "../engine/Editor";
import { ANCHOR_LABEL, DEFAULT_APPLY, STANDARD_SIZES, type AnchorMode, type ApplyOptions } from "../engine/pieces";
import { formatUnits, UNIT_LABEL } from "../engine/units";

type Result = { ok: boolean; message: string };
const cell = "h-6 w-full min-w-0 rounded border border-border bg-background px-1 text-[11px] outline-none focus:border-primary";

/** Auto-tag: a table of SUGGESTED sizes and piece names. Nothing is applied until the user confirms. */
function AutoTagDialog({ editor, unit, onClose, onResult }: { editor: Editor; unit: EditorState["settings"]["units"]; onClose: () => void; onResult: (r: Result) => void }) {
  const [rows, setRows] = useState<(TagSuggestion & { use: boolean })[]>(() => editor.suggestPieceTags().map((r) => ({ ...r, use: true })));
  const edit = (i: number, patch: Partial<TagSuggestion & { use: boolean }>) => setRows((all) => all.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const chosen = rows.filter((r) => r.use);
  return (
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Auto-tag pieces</DialogTitle>
        <DialogDescription>Suggested from the size labels in the file and each outline&apos;s shape and position. Check and correct them, then apply. Nothing changes until you do.</DialogDescription>
      </DialogHeader>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No closed outlines were found to tag.</p>
      ) : (
        <div className="max-h-[55vh] overflow-auto rounded-md border border-border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-card text-muted-foreground">
              <tr>
                <th className="w-8 px-2 py-1.5">Use</th>
                <th className="px-2 py-1.5">Found in</th>
                <th className="px-2 py-1.5">
                  Size ({UNIT_LABEL[unit]})
                </th>
                <th className="w-24 px-2 py-1.5">Size tag</th>
                <th className="w-32 px-2 py-1.5">Piece</th>
                <th className="w-28 px-2 py-1.5">Mirror of</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={cn("border-t border-border", !r.use && "opacity-45")} onMouseEnter={() => editor.selectPiece(r.id)}>
                  <td className="px-2 py-1">
                    <input type="checkbox" checked={r.use} aria-label={`Tag ${r.size} ${r.piece}`} onChange={(e) => edit(i, { use: e.target.checked })} />
                  </td>
                  <td className="px-2 py-1 text-muted-foreground">
                    {r.block || "page"}
                    {r.tagged && <span className="ml-1 rounded bg-muted px-1 text-[10px]">tagged</span>}
                  </td>
                  <td className="px-2 py-1 font-mono text-muted-foreground">
                    {formatUnits(r.w, unit)} × {formatUnits(r.h, unit)}
                  </td>
                  <td className="px-2 py-1">
                    <input value={r.size} list="pps-sizes" aria-label="Size tag" onChange={(e) => edit(i, { size: e.target.value })} className={cell} />
                  </td>
                  <td className="px-2 py-1">
                    <input value={r.piece} aria-label="Piece name" onChange={(e) => edit(i, { piece: e.target.value })} className={cell} />
                  </td>
                  <td className="px-2 py-1">
                    <input value={r.mirrorOf} aria-label="Mirror of" placeholder="—" onChange={(e) => edit(i, { mirrorOf: e.target.value })} className={cell} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="pps-sizes">
            {STANDARD_SIZES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!chosen.length}
          onClick={() => {
            onResult(editor.applyPieceTags(chosen));
            onClose();
          }}
        >
          Apply {chosen.length} tag{chosen.length === 1 ? "" : "s"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/** Pieces: Size / Piece tags, mirror pairs, and "Apply to all sizes". */
export function PiecesPanel({ editor, state, onResult }: { editor: Editor; state: EditorState; onResult: (r: Result) => void }) {
  const [autoTag, setAutoTag] = useState(false);
  const [opts, setOpts] = useState<ApplyOptions>(DEFAULT_APPLY);
  const unit = state.settings.units;
  // The list only changes when the document does (or another piece becomes current).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pieces = useMemo(() => editor.listPieces(), [editor, state.docVersion, state.clip?.id, state.clip?.linkDiffers]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const plan = useMemo(() => editor.planApplySizes(opts), [editor, state.docVersion, state.clip?.id, opts]);
  // While this panel is open, the pieces that would be updated are highlighted on the page.
  useEffect(() => {
    editor.showApplyPreview(opts);
    return () => editor.clearApplyPreview();
  }, [editor, opts, state.docVersion, state.clip?.id]);
  const tagged = pieces.filter((p) => p.size || p.piece);
  const untagged = pieces.length - tagged.length;
  const current = pieces.find((p) => p.current);
  const names = [...new Set(tagged.map((p) => p.piece).filter(Boolean))];

  return (
    <div className="flex flex-col gap-3 p-3 text-xs">
      <div className="flex items-center gap-2">
        <Button size="xs" onClick={() => setAutoTag(true)}>
          Auto-tag…
        </Button>
        <span className="text-muted-foreground">
          {tagged.length} tagged{untagged ? ` · ${untagged} not tagged` : ""}
        </span>
      </div>

      {pieces.length === 0 ? (
        <p className="text-muted-foreground">No pattern outlines yet. Import a pattern, then tag its pieces.</p>
      ) : (
        <ul className="-mx-1 max-h-64 overflow-y-auto rounded-md border border-border">
          {pieces.map((p) => (
            <li key={p.id} className={cn("grid grid-cols-[52px_1fr_auto] items-center gap-1 border-b border-border px-1 py-0.5 last:border-b-0", p.current && "bg-primary/10")} onClick={() => editor.selectPiece(p.id)} onDoubleClick={() => editor.selectPiece(p.id, true)}>
              <input
                key={`s${p.size}`}
                defaultValue={p.size}
                list="pps-sizes-panel"
                aria-label="Size"
                placeholder="Size"
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => e.target.value.trim() !== p.size && editor.applyPieceTags([{ id: p.id, size: e.target.value, piece: p.piece, mirrorOf: p.mirrorOf }])}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className={cell}
              />
              <input
                key={`p${p.piece}`}
                defaultValue={p.piece}
                aria-label="Piece name"
                placeholder={`Piece (${formatUnits(p.w, unit)} × ${formatUnits(p.h, unit)})`}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => e.target.value.trim() !== p.piece && editor.applyPieceTags([{ id: p.id, size: p.size, piece: e.target.value, mirrorOf: p.mirrorOf }])}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className={cell}
              />
              <span className="flex items-center gap-1 pr-1 text-muted-foreground">
                {p.repeat && (
                  <span title="Repeat fill">
                    <Repeat2 className="h-3 w-3" />
                  </span>
                )}
                {p.hasPrint ? <span title="Has a print" className="h-2 w-2 rounded-full bg-emerald-500" /> : <span title="No print yet" className="h-2 w-2 rounded-full border border-muted-foreground/50" />}
                {p.linkedTo && (
                  <span title={p.differs ? `Linked to ${p.linkedTo}, but changed since` : `Linked to ${p.linkedTo}`} className={p.differs ? "text-amber-600" : "text-primary"}>
                    <Link2 className="h-3 w-3" />
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <datalist id="pps-sizes-panel">
        {STANDARD_SIZES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <p className="text-[11px] text-muted-foreground">Click a row to select the piece; double-click to zoom to it.</p>

      {current && (
        <div className="grid gap-1.5 rounded-md border border-border p-2">
          <span className="font-medium text-foreground">
            {current.size || "?"}-{current.piece || "?"}
          </span>
          <label className="flex items-center gap-2">
            <span className="shrink-0 text-muted-foreground">Mirror of</span>
            <select
              value={current.mirrorOf}
              aria-label="Mirror of"
              onChange={(e) => editor.applyPieceTags([{ id: current.id, size: current.size, piece: current.piece, mirrorOf: e.target.value }])}
              className="h-6 min-w-0 flex-1 rounded border border-border bg-background px-1 text-[11px]"
            >
              <option value="">— (not a mirror)</option>
              {names
                .filter((n) => n !== current.piece)
                .map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-1.5">
            <Button size="xs" variant="outline" title="Copy this piece's print, flipped left-right, onto the piece(s) marked as its mirror" onClick={() => onResult(editor.mirrorPrint(opts.link))}>
              Mirror print
            </Button>
            <Button size="xs" variant="outline" title="Click a point on a tagged piece (e.g. on its centre-front line) to line prints up there" onClick={() => editor.beginSetRefPoint()}>
              {current.hasRef ? "Move reference point" : "Set reference point"}
            </Button>
          </div>
          {current.linkedTo && (
            <div className={cn("flex flex-wrap items-center gap-1.5", current.differs ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
              {current.differs ? <TriangleAlert className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
              {current.differs ? `Differs from its master ${current.linkedTo}` : `Linked to ${current.linkedTo}`}
              <Button size="xs" variant="outline" onClick={() => onResult(editor.resyncLink())}>
                Re-sync
              </Button>
              <Button size="xs" variant="outline" onClick={() => editor.unlinkClip()}>
                Unlink
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-1.5 rounded-md border border-border p-2">
        <span className="font-medium text-foreground">Apply to all sizes</span>
        <label className="flex items-start gap-2">
          <input type="radio" name="pps-apply-mode" className="mt-0.5" checked={opts.mode === "keep"} onChange={() => setOpts({ ...opts, mode: "keep" })} />
          <span>
            Keep print size <span className="text-muted-foreground">— for repeat / all-over prints</span>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" name="pps-apply-mode" className="mt-0.5" checked={opts.mode === "scale"} onChange={() => setOpts({ ...opts, mode: "scale" })} />
          <span>
            Scale with piece <span className="text-muted-foreground">— for placement prints</span>
          </span>
        </label>
        <label className="flex items-center gap-2">
          <span className="shrink-0 text-muted-foreground">Line up at</span>
          <select value={opts.anchor} aria-label="Reference anchor" onChange={(e) => setOpts({ ...opts, anchor: e.target.value as AnchorMode })} className="h-6 min-w-0 flex-1 rounded border border-border bg-background px-1 text-[11px]">
            {(Object.keys(ANCHOR_LABEL) as AnchorMode[]).map((a) => (
              <option key={a} value={a}>
                {ANCHOR_LABEL[a]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={opts.pairs} onChange={(e) => setOpts({ ...opts, pairs: e.target.checked })} /> Also mirror onto paired pieces
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={opts.link} onChange={(e) => setOpts({ ...opts, link: e.target.checked })} /> Link sizes (later edits follow the master)
        </label>
        <p className={cn("rounded-md border px-2 py-1.5", plan.ok ? "border-primary/40 text-foreground" : "border-border text-muted-foreground")} role="status">
          {plan.message}
        </p>
        <Button size="sm" disabled={!plan.ok} onClick={() => onResult(editor.applyToSizes(opts))}>
          Apply to {plan.labels.length || "all"} piece{plan.labels.length === 1 ? "" : "s"}
        </Button>
      </div>

      <Dialog open={autoTag} onOpenChange={setAutoTag}>
        {autoTag && <AutoTagDialog editor={editor} unit={unit} onClose={() => setAutoTag(false)} onResult={onResult} />}
      </Dialog>
    </div>
  );
}
