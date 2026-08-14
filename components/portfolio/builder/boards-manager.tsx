"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, X, Loader2, Pencil, Trash2, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import {
  addBoardAction,
  updateBoardAction,
  deleteBoardAction,
  addPinAction,
  deletePinAction,
  type PortfolioBoardInput,
} from "@/services/portfolio";
import type { PortfolioViewModel, PortfolioBoardVM } from "@/types/portfolio";

export function BoardsManager({ data, onChange }: { data: PortfolioViewModel; onChange: (d: PortfolioViewModel) => void }) {
  const [boardDialogOpen, setBoardDialogOpen] = useState(false);
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [boardForm, setBoardForm] = useState<PortfolioBoardInput>({ title: "", description: "" });
  const [savingBoard, setSavingBoard] = useState(false);
  const [openBoardId, setOpenBoardId] = useState<string | null>(null);

  function openAddBoard() {
    setEditingBoardId(null);
    setBoardForm({ title: "", description: "" });
    setBoardDialogOpen(true);
  }

  function openEditBoard(board: PortfolioBoardVM) {
    setEditingBoardId(board.id);
    setBoardForm({ title: board.title, description: board.description ?? "" });
    setBoardDialogOpen(true);
  }

  async function handleSaveBoard() {
    if (!boardForm.title.trim()) return toast.error("Board title is required.");
    setSavingBoard(true);
    const result = editingBoardId ? await updateBoardAction(editingBoardId, boardForm) : await addBoardAction(boardForm);
    setSavingBoard(false);
    if (!result.success) return toast.error(result.error);
    onChange(result.data);
    setBoardDialogOpen(false);
    toast.success(editingBoardId ? "Board updated" : "Board created");
  }

  async function handleDeleteBoard(id: string) {
    const result = await deleteBoardAction(id);
    if (!result.success) return toast.error(result.error);
    onChange(result.data);
    if (openBoardId === id) setOpenBoardId(null);
    toast.success("Board removed");
  }

  const openBoard = data.boards.find((b) => b.id === openBoardId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Boards</h3>
          <p className="text-xs text-muted-foreground">Pinterest-style visual collections — Branding, UI Inspiration, Moodboards, anything you like.</p>
        </div>
        <Button size="sm" onClick={openAddBoard} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Create Board
        </Button>
      </div>

      {data.boards.length === 0 ? (
        <EmptyState icon={LayoutGrid} title="No boards yet" description="Create a board to start collecting visual inspiration and work." action={{ label: "Create Board", onClick: openAddBoard }} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.boards.map((board) => (
            <div key={board.id} className="rounded-xl border border-border overflow-hidden">
              <button type="button" onClick={() => setOpenBoardId(board.id)} className="block w-full text-left">
                <div className="aspect-square bg-muted">
                  {board.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={board.coverImage} alt={board.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No pins yet</div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-foreground truncate">{board.title}</p>
                  <p className="text-xs text-muted-foreground">{board.pins.length} pin{board.pins.length === 1 ? "" : "s"}</p>
                </div>
              </button>
              <div className="px-3 pb-3 flex items-center justify-end gap-0.5">
                <Button variant="ghost" size="icon-sm" onClick={() => openEditBoard(board)} aria-label="Edit board">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteBoard(board.id)} aria-label="Delete board">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={boardDialogOpen} onOpenChange={setBoardDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBoardId ? "Edit Board" : "Create Board"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Title</Label>
              <Input value={boardForm.title} onChange={(e) => setBoardForm((f) => ({ ...f, title: e.target.value }))} placeholder="UI Inspiration" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description (optional)</Label>
              <Textarea rows={2} value={boardForm.description} onChange={(e) => setBoardForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button onClick={handleSaveBoard} disabled={savingBoard} className="gap-1.5">
              {savingBoard && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {editingBoardId ? "Save Changes" : "Create Board"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {openBoard && <BoardPinsDialog board={openBoard} onChange={onChange} onClose={() => setOpenBoardId(null)} />}
    </div>
  );
}

function BoardPinsDialog({
  board,
  onChange,
  onClose,
}: {
  board: PortfolioBoardVM;
  onChange: (d: PortfolioViewModel) => void;
  onClose: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const pins = [...board.pins].sort((a, b) => a.position - b.position);

  async function handleAddPin(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await addPinAction(board.id, { image: dataUrl });
      if (!result.success) return toast.error(result.error);
      onChange(result.data);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeletePin(pinId: string) {
    const result = await deletePinAction(pinId);
    if (!result.success) return toast.error(result.error);
    onChange(result.data);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{board.title}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-2">
          <button
            type="button"
            onClick={() => pinInputRef.current?.click()}
            disabled={uploading}
            className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            <span className="text-xs">Add Pin</span>
          </button>
          <input ref={pinInputRef} type="file" accept="image/*" className="hidden" onChange={handleAddPin} />

          {pins.map((pin) => (
            <div key={pin.id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pin.image} alt={pin.title ?? "Pin"} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => handleDeletePin(pin.id)}
                className="absolute top-1.5 right-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove pin"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        {pins.length === 0 && <p className="text-xs text-muted-foreground">Add visual pins to this board.</p>}
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Done</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
