"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, Sparkles, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { suggestForBoardAction, type AiSuggestion } from "@/services/mood-board-ai";
import { addCommentAction } from "@/services/mood-board";
import { formatRelativeTime, initials } from "@/utils/format";
import type { MoodBoardCommentRecord, MoodBoardRecord, SizeChartRow } from "@/types/mood-board";

export function RightInspector({
  board,
  onAddColor,
  onRemoveColor,
  onApplySuggestion,
  onCommentAdded,
  refreshSuggestionsSignal,
}: {
  board: MoodBoardRecord;
  onAddColor: (hex: string) => void;
  onRemoveColor: (hex: string) => void;
  onApplySuggestion: (s: AiSuggestion) => void;
  onCommentAdded: (c: MoodBoardCommentRecord) => void;
  refreshSuggestionsSignal?: number;
}) {
  const [newColor, setNewColor] = useState("#8c6f5a");
  const [suggestions, setSuggestions] = useState<AiSuggestion[] | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  async function loadSuggestions() {
    setLoadingSuggestions(true);
    const result = await suggestForBoardAction(board.id);
    setLoadingSuggestions(false);
    if (!result.success) return toast.error(result.error);
    setSuggestions(result.data);
    setDismissed(new Set());
  }

  const [prevSignal, setPrevSignal] = useState(refreshSuggestionsSignal);
  if (refreshSuggestionsSignal !== prevSignal) {
    setPrevSignal(refreshSuggestionsSignal);
    if (refreshSuggestionsSignal !== undefined) loadSuggestions();
  }

  async function handlePostComment() {
    if (!commentText.trim()) return;
    setPostingComment(true);
    const result = await addCommentAction(board.id, commentText);
    setPostingComment(false);
    if (!result.success) return toast.error(result.error);
    onCommentAdded(result.data);
    setCommentText("");
  }

  const sizeRows: SizeChartRow[] = board.sizeChart ?? [];

  return (
    <div className="w-80 shrink-0 border-l border-border bg-card overflow-y-auto flex flex-col">
      <div className="p-4 space-y-5 flex-1">
        <section className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Color Palette</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {board.palette.map((hex) => (
              <button key={hex} type="button" onClick={() => onRemoveColor(hex)} className="w-6 h-6 rounded-full border border-black/10" style={{ backgroundColor: hex }} title={`Remove ${hex}`} />
            ))}
            <div className="flex items-center gap-1">
              <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-6 h-6 rounded-full border border-border cursor-pointer" />
              <button type="button" onClick={() => onAddColor(newColor)} className="w-6 h-6 rounded-full border border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary/50">
                +
              </button>
            </div>
          </div>
        </section>

        <div className="border-t border-border" />

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">AI Recommendations</p>
            <button type="button" onClick={loadSuggestions} disabled={loadingSuggestions} className="text-[11px] text-primary font-medium hover:underline flex items-center gap-1">
              {loadingSuggestions ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Refresh
            </button>
          </div>
          {!suggestions && !loadingSuggestions && <p className="text-xs text-muted-foreground">Click Refresh for AI suggestions based on this board.</p>}
          <div className="space-y-2">
            {suggestions?.map((s, i) =>
              dismissed.has(i) ? null : (
                <div key={i} className="rounded-lg border border-border p-2.5 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">{s.category}</p>
                  <p className="text-xs text-foreground">{s.suggestion}</p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => onApplySuggestion(s)}>
                      Apply
                    </Button>
                    <button type="button" onClick={() => setDismissed((prev) => new Set(prev).add(i))} className="text-[11px] text-muted-foreground hover:text-foreground">
                      Dismiss
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </section>

        {sizeRows.length > 0 && (
          <>
            <div className="border-t border-border" />
            <section className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Size Chart</p>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-left font-medium py-1">Size</th>
                    <th className="text-left font-medium py-1">Bust</th>
                    <th className="text-left font-medium py-1">Waist</th>
                    <th className="text-left font-medium py-1">Hip</th>
                  </tr>
                </thead>
                <tbody>
                  {sizeRows.map((r) => (
                    <tr key={r.size} className="border-t border-border/60">
                      <td className="py-1 font-medium">{r.size}</td>
                      <td className="py-1">{r.bust || "—"}</td>
                      <td className="py-1">{r.waist || "—"}</td>
                      <td className="py-1">{r.hip || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>

      <div className="border-t border-border p-4 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Notes & Comments</p>
        <div className="space-y-3 max-h-52 overflow-y-auto">
          {board.comments.length === 0 && <p className="text-xs text-muted-foreground">No comments yet.</p>}
          {board.comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0">{initials(c.authorName)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-foreground truncate">{c.authorName}</p>
                  <p className="text-[10px] text-muted-foreground">{formatRelativeTime(c.createdAt)}</p>
                </div>
                <p className="text-xs text-foreground">{c.content}</p>
              </div>
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </div>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <Textarea rows={1} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add a comment..." className="text-xs min-h-8 resize-none" />
          <Button size="icon-sm" disabled={postingComment || !commentText.trim()} onClick={handlePostComment}>
            {postingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
