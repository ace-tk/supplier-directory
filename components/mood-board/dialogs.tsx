"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Search, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { remixBoardAction, type RemixProposal, type RemixTarget } from "@/services/mood-board-ai";
import { searchSuppliersForDmAction, type SupplierOption } from "@/services/mood-board-bridge";
import { LAYOUT_PRESETS } from "@/lib/mood-board-layouts";
import type { SizeChartRow } from "@/types/mood-board";

// ─── New Board ────────────────────────────────────────────────────────
export function NewBoardDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (o: boolean) => void; onCreate: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      await onCreate(name);
      setName("");
      onOpenChange(false);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Board</DialogTitle>
        </DialogHeader>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Minimal Resort" autoFocus onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating} className="gap-1.5">
            {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create Board
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Size Chart ───────────────────────────────────────────────────────
const DEFAULT_SIZES = ["XS", "S", "M", "L", "XL"];

export function SizeChartDialog({
  open,
  onOpenChange,
  initialRows,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialRows: SizeChartRow[] | null;
  onSave: (rows: SizeChartRow[]) => Promise<void>;
}) {
  const [rows, setRows] = useState<SizeChartRow[]>(initialRows?.length ? initialRows : DEFAULT_SIZES.map((size) => ({ size, bust: "", waist: "", hip: "" })));
  const [saving, setSaving] = useState(false);

  // Reset the editable rows whenever the dialog reopens (adjusted during
  // render, not in an effect, to avoid react-hooks/set-state-in-effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setRows(initialRows?.length ? initialRows : DEFAULT_SIZES.map((size) => ({ size, bust: "", waist: "", hip: "" })));
  }

  function updateCell(index: number, field: keyof SizeChartRow, value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(rows.filter((r) => r.size.trim()));
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Design Size Chart</DialogTitle>
          <DialogDescription>Real, editable measurements — persisted against this board.</DialogDescription>
        </DialogHeader>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="text-left font-medium pb-2">Size</th>
              <th className="text-left font-medium pb-2">Bust</th>
              <th className="text-left font-medium pb-2">Waist</th>
              <th className="text-left font-medium pb-2">Hip</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="pr-1.5 pb-1.5">
                  <Input value={row.size} onChange={(e) => updateCell(i, "size", e.target.value)} className="h-8 w-16" />
                </td>
                <td className="pr-1.5 pb-1.5">
                  <Input value={row.bust} onChange={(e) => updateCell(i, "bust", e.target.value)} className="h-8" placeholder="in" />
                </td>
                <td className="pr-1.5 pb-1.5">
                  <Input value={row.waist} onChange={(e) => updateCell(i, "waist", e.target.value)} className="h-8" placeholder="in" />
                </td>
                <td className="pr-1.5 pb-1.5">
                  <Input value={row.hip} onChange={(e) => updateCell(i, "hip", e.target.value)} className="h-8" placeholder="in" />
                </td>
                <td className="pb-1.5">
                  <button type="button" onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button variant="outline" size="sm" className="gap-1.5 w-fit" onClick={() => setRows((prev) => [...prev, { size: "", bust: "", waist: "", hip: "" }])}>
          <Plus className="h-3.5 w-3.5" /> Add Row
        </Button>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save Chart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── AI Remix ─────────────────────────────────────────────────────────
const REMIX_TARGETS: { value: RemixTarget; label: string }[] = [
  { value: "COLOR_PALETTE", label: "Color Palette" },
  { value: "LAYOUT", label: "Layout" },
  { value: "MATERIAL_DIRECTION", label: "Material Direction" },
  { value: "STYLE_DIRECTION", label: "Style Direction" },
];

export function AiRemixDialog({
  open,
  onOpenChange,
  boardId,
  onApply,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  boardId: string;
  onApply: (proposal: RemixProposal) => void;
}) {
  const [target, setTarget] = useState<RemixTarget | null>(null);
  const [proposal, setProposal] = useState<RemixProposal | null>(null);
  const [loading, setLoading] = useState(false);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      setTarget(null);
      setProposal(null);
    }
  }

  async function handlePreview(t: RemixTarget) {
    setTarget(t);
    setLoading(true);
    setProposal(null);
    const result = await remixBoardAction(boardId, t);
    setLoading(false);
    if (!result.success) return toast.error(result.error);
    setProposal(result.data);
  }

  function handleApply() {
    if (proposal) onApply(proposal);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>AI Remix</DialogTitle>
          <DialogDescription>Preview a structured change before anything on your board is touched.</DialogDescription>
        </DialogHeader>

        {!target && (
          <div className="grid grid-cols-2 gap-2">
            {REMIX_TARGETS.map((t) => (
              <button key={t.value} type="button" onClick={() => handlePreview(t.value)} className="rounded-xl border border-border p-4 text-sm font-medium hover:border-primary/50 hover:bg-primary/5 transition-colors">
                {t.label}
              </button>
            ))}
          </div>
        )}

        {target && loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Generating preview...
          </div>
        )}

        {target && proposal && !loading && (
          <div className="space-y-3">
            <p className="text-sm text-foreground">{proposal.summary}</p>
            {proposal.palette && (
              <div className="flex items-center gap-2">
                {proposal.palette.map((hex) => (
                  <span key={hex} className="w-8 h-8 rounded-full border border-black/10" style={{ backgroundColor: hex }} />
                ))}
              </div>
            )}
            {proposal.layoutPreset && <p className="text-xs text-muted-foreground">Suggested composition: {LAYOUT_PRESETS.find((p) => p.id === proposal.layoutPreset)?.label}</p>}
          </div>
        )}

        <DialogFooter>
          {target && (
            <Button variant="ghost" onClick={() => setTarget(null)} className="mr-auto">
              Back
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {proposal && (
            <Button onClick={handleApply} className="gap-1.5">
              Apply
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Send DM ──────────────────────────────────────────────────────────
export function SendDmDialog({
  open,
  onOpenChange,
  messagesBasePath,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** e.g. "/buyer/messages" or "/crm" — the real CRM conversation route for the current portal. */
  messagesBasePath: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Deferred a tick so the initial setLoading(true) isn't a synchronous
    // setState call inside the effect body (react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      setLoading(true);
      searchSuppliersForDmAction(query).then((r) => {
        if (r.success) setResults(r.data);
        setLoading(false);
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [open, query]);

  function handlePick(supplierId: string) {
    onOpenChange(false);
    router.push(`${messagesBasePath}?supplierId=${supplierId}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Send DM</DialogTitle>
          <DialogDescription>Opens a real conversation in CRM Messages.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search suppliers..." className="pl-8" />
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />}
          {!loading && results.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No suppliers found.</p>}
          {results.map((s) => (
            <button key={s.id} type="button" onClick={() => handlePick(s.id)} className="w-full text-left rounded-lg px-2.5 py-2 hover:bg-muted flex items-center justify-between gap-2">
              <span className="text-sm font-medium truncate">{s.companyName}</span>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
                <MapPin className="h-3 w-3" /> {s.city}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
