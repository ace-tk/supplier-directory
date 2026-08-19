"use client";

import { useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
// html2canvas-pro (not the original html2canvas) — this app's Tailwind v4
// theme uses oklch() CSS colors throughout, which the original library
// can't parse and hangs on indefinitely; this fork adds oklch/oklab
// support with an identical API.
import html2canvas from "html2canvas-pro";
import {
  Library,
  LayoutGrid,
  Shapes,
  Type,
  LayoutTemplate,
  Upload,
  Palette as BrandIcon,
  Search,
  Sparkles,
  Save,
  Download,
  Settings,
  X,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MoodBoardCanvas } from "./MoodBoardCanvas";
import { LeftAssetPanel, type LeftTool } from "./LeftAssetPanel";
import { DesignToolbar } from "./DesignToolbar";
import { RightInspector } from "./RightInspector";
import { BottomAiBar, CanvasControls } from "./BottomBar";
import { NewBoardDialog, SizeChartDialog, AiRemixDialog, SendDmDialog } from "./dialogs";
import {
  createBoardAction,
  updateBoardMetaAction,
  addItemAction,
  updateItemAction,
  deleteItemAction,
  bringItemToFrontAction,
} from "@/services/mood-board";
import { askMoodBoardAiAction, type RemixProposal, type AiSuggestion } from "@/services/mood-board-ai";
import { sendMoodBoardToShopAction, sendMoodBoardToManufacturerAction } from "@/services/mood-board-bridge";
import { applyLayoutPreset, type LayoutPreset } from "@/lib/mood-board-layouts";
import type { MoodBoardRecord, MoodBoardSummary, MoodBoardItemRecord, MoodBoardItemContent, SizeChartRow } from "@/types/mood-board";
import type { MoodBoardItemType } from "@/lib/generated/prisma/enums";

const LEFT_TOOLS: { id: LeftTool; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "library", label: "Library", icon: Library },
  { id: "boards", label: "Boards", icon: LayoutGrid },
  { id: "elements", label: "Elements", icon: Shapes },
  { id: "text", label: "Text", icon: Type },
  { id: "layouts", label: "Layouts", icon: LayoutTemplate },
  { id: "uploads", label: "Uploads", icon: Upload },
  { id: "brandkit", label: "Brand Kit", icon: BrandIcon },
];

type HistoryAction =
  | { kind: "add"; item: MoodBoardItemRecord }
  | { kind: "delete"; item: MoodBoardItemRecord }
  | { kind: "update"; itemId: string; before: Partial<MoodBoardItemRecord>; after: Partial<MoodBoardItemRecord> };

export function MoodBoardStudio({ initialBoard, initialBoards }: { initialBoard: MoodBoardRecord; initialBoards: MoodBoardSummary[] }) {
  const router = useRouter();
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const [board, setBoard] = useState(initialBoard);
  const [boards] = useState(initialBoards);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [activeLeftTool, setActiveLeftTool] = useState<LeftTool>("library");
  const [zoom, setZoom] = useState(0.63);
  const [fullscreen, setFullscreen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [boardsFilter, setBoardsFilter] = useState("");
  const [boardStripOffset, setBoardStripOffset] = useState(0);

  const [past, setPast] = useState<HistoryAction[]>([]);
  const [future, setFuture] = useState<HistoryAction[]>([]);

  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [sizeChartOpen, setSizeChartOpen] = useState(false);
  const [remixOpen, setRemixOpen] = useState(false);
  const [sendDmOpen, setSendDmOpen] = useState(false);
  const [suggestSignal, setSuggestSignal] = useState<number | undefined>(undefined);
  const [exporting, setExporting] = useState(false);

  function updateLocalItem(id: string, patch: Partial<MoodBoardItemRecord>) {
    setBoard((prev) => ({ ...prev, items: prev.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  }

  function pushHistory(action: HistoryAction) {
    setPast((prev) => [...prev.slice(-24), action]);
    setFuture([]);
  }

  async function handleAddItem(type: MoodBoardItemType, content: MoodBoardItemContent, size?: { width: number; height: number }) {
    setSaving(true);
    const result = await addItemAction(board.id, {
      type,
      positionX: 60 + Math.random() * 200,
      positionY: 60 + Math.random() * 150,
      width: size?.width ?? 220,
      height: size?.height ?? 220,
      content,
    });
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    setBoard((prev) => ({ ...prev, items: [...prev.items, result.data] }));
    pushHistory({ kind: "add", item: result.data });
    setSelectedItemId(result.data.id);
  }

  async function handleDragEnd(id: string, x: number, y: number) {
    const item = board.items.find((i) => i.id === id);
    if (!item || (item.positionX === x && item.positionY === y)) return;
    const before = { positionX: item.positionX, positionY: item.positionY };
    const after = { positionX: x, positionY: y };
    updateLocalItem(id, after);
    setSaving(true);
    const result = await updateItemAction(id, after);
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    pushHistory({ kind: "update", itemId: id, before, after });
  }

  async function handleResizeEnd(id: string, width: number, height: number, x: number, y: number) {
    const item = board.items.find((i) => i.id === id);
    if (!item) return;
    const before = { width: item.width, height: item.height, positionX: item.positionX, positionY: item.positionY };
    const after = { width, height, positionX: x, positionY: y };
    updateLocalItem(id, after);
    setSaving(true);
    const result = await updateItemAction(id, after);
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    pushHistory({ kind: "update", itemId: id, before, after });
  }

  async function handleEditContent(id: string, content: MoodBoardItemContent) {
    const item = board.items.find((i) => i.id === id);
    if (!item) return;
    const before = { content: item.content };
    const after = { content };
    updateLocalItem(id, after);
    setSaving(true);
    const result = await updateItemAction(id, { content });
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    pushHistory({ kind: "update", itemId: id, before, after });
  }

  async function handleDeleteItem(id: string) {
    const item = board.items.find((i) => i.id === id);
    if (!item) return;
    setBoard((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== id) }));
    setSelectedItemId(null);
    setSaving(true);
    const result = await deleteItemAction(id);
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    pushHistory({ kind: "delete", item });
  }

  async function handleSelect(id: string) {
    setSelectedItemId(id);
    const result = await bringItemToFrontAction(id);
    if (result.success) updateLocalItem(id, { zIndex: result.data.zIndex });
  }

  async function applyInverse(action: HistoryAction, direction: "undo" | "redo") {
    if (action.kind === "add") {
      if (direction === "undo") {
        setBoard((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== action.item.id) }));
        await deleteItemAction(action.item.id);
      } else if (action.item.content) {
        const result = await addItemAction(board.id, {
          type: action.item.type,
          positionX: action.item.positionX,
          positionY: action.item.positionY,
          width: action.item.width,
          height: action.item.height,
          content: action.item.content,
        });
        if (result.success) setBoard((prev) => ({ ...prev, items: [...prev.items, result.data] }));
      }
    } else if (action.kind === "delete") {
      if (direction === "undo" && action.item.content) {
        const result = await addItemAction(board.id, {
          type: action.item.type,
          positionX: action.item.positionX,
          positionY: action.item.positionY,
          width: action.item.width,
          height: action.item.height,
          content: action.item.content,
        });
        if (result.success) setBoard((prev) => ({ ...prev, items: [...prev.items, result.data] }));
      } else if (direction === "redo") {
        setBoard((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== action.item.id) }));
        await deleteItemAction(action.item.id);
      }
    } else {
      const patch = direction === "undo" ? action.before : action.after;
      updateLocalItem(action.itemId, patch);
      await updateItemAction(action.itemId, { ...patch, content: patch.content ?? undefined });
    }
  }

  async function handleUndo() {
    const action = past[past.length - 1];
    if (!action) return;
    setPast((prev) => prev.slice(0, -1));
    setFuture((prev) => [...prev, action]);
    await applyInverse(action, "undo");
  }

  async function handleRedo() {
    const action = future[future.length - 1];
    if (!action) return;
    setFuture((prev) => prev.slice(0, -1));
    setPast((prev) => [...prev, action]);
    await applyInverse(action, "redo");
  }

  async function persistPalette(next: string[]) {
    setBoard((prev) => ({ ...prev, palette: next }));
    const result = await updateBoardMetaAction(board.id, { palette: next });
    if (!result.success) toast.error(result.error);
  }
  function handleAddColor(hex: string) {
    if (board.palette.includes(hex)) return;
    persistPalette([...board.palette, hex]);
  }
  function handleRemoveColor(hex: string) {
    persistPalette(board.palette.filter((h) => h !== hex));
  }

  async function handleApplyLayout(preset: LayoutPreset) {
    if (board.items.length === 0) return toast.error("Add some items to the board first.");
    if (typeof window !== "undefined" && !window.confirm("This will rearrange your current items. Continue?")) return;
    const ids = board.items
      .slice()
      .sort((a, b) => a.zIndex - b.zIndex)
      .map((i) => i.id);
    const positions = applyLayoutPreset(preset, ids);
    setBoard((prev) => ({ ...prev, items: prev.items.map((i) => (positions[i.id] ? { ...i, ...positions[i.id] } : i)) }));
    await Promise.all(Object.entries(positions).map(([id, pos]) => updateItemAction(id, pos)));
    toast.success("Layout applied");
  }

  async function handleAskAi(question: string): Promise<void> {
    const result = await askMoodBoardAiAction(board.id, question);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(result.data, { duration: 10000 });
  }

  function handleApplySuggestion(s: AiSuggestion) {
    handleAddItem("NOTE", { kind: "note", title: `AI — ${s.category}`, bullets: [s.suggestion] }, { width: 240, height: 150 });
    toast.success("Added to board as a note");
  }

  function handleApplyRemix(proposal: RemixProposal) {
    if (proposal.target === "COLOR_PALETTE" && proposal.palette) {
      persistPalette(proposal.palette);
      toast.success("Palette updated");
    } else if (proposal.target === "LAYOUT" && proposal.layoutPreset) {
      handleApplyLayout(proposal.layoutPreset);
    } else {
      handleAddItem(
        "NOTE",
        { kind: "note", title: proposal.target === "MATERIAL_DIRECTION" ? "Material Direction" : "Style Direction", bullets: [proposal.summary] },
        { width: 260, height: 170 }
      );
      toast.success("Added to board as a note");
    }
  }

  async function handleSendToShop() {
    const result = await sendMoodBoardToShopAction(board.id);
    if (!result.success) return toast.error(result.error);
    router.push(`/buyer/catalog/${result.data.rowId}/edit`);
  }
  async function handleSendToManufacturer() {
    const result = await sendMoodBoardToManufacturerAction(board.id);
    if (!result.success) return toast.error(result.error);
    router.push(`/buyer/product/${result.data.rowId}/manufacture`);
  }

  async function handleCreateBoard(name: string): Promise<void> {
    const result = await createBoardAction(name);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    router.push(`/buyer/mood-board/${result.data.id}`);
  }
  function handleSwitchBoard(id: string) {
    if (id === board.id) return;
    router.push(`/buyer/mood-board/${id}`);
  }

  async function handleExport() {
    if (!canvasWrapRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(canvasWrapRef.current, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `${board.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "mood-board"}.png`;
      link.click();
      toast.success("Board exported as PNG");
    } catch {
      toast.error("Couldn't export the board.");
    } finally {
      setExporting(false);
    }
  }

  async function handleSaveBoard() {
    setSaving(true);
    const result = await updateBoardMetaAction(board.id, { name: board.name, palette: board.palette, sizeChart: board.sizeChart ?? undefined });
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Board saved");
  }

  async function handleSaveSizeChart(rows: SizeChartRow[]) {
    setBoard((prev) => ({ ...prev, sizeChart: rows }));
    const result = await updateBoardMetaAction(board.id, { sizeChart: rows });
    if (!result.success) toast.error(result.error);
    else toast.success("Size chart saved");
  }

  async function handleRenameBoard(name: string) {
    setBoard((prev) => ({ ...prev, name }));
    await updateBoardMetaAction(board.id, { name });
  }

  const filteredBoards = boards.filter((b) => b.name.toLowerCase().includes(boardsFilter.toLowerCase()));
  const visibleStrip = filteredBoards.slice(boardStripOffset, boardStripOffset + 6);

  return (
    // Always a fullscreen overlay above the dashboard chrome (sidebar/top
    // navbar) — this screen is an immersive design tool per the reference,
    // not a page nested in the normal portal layout. "Close" (header X)
    // is the way back to the rest of the app. The `fullscreen` toggle
    // additionally hides the side panels to maximize canvas space.
    <div className="fixed inset-0 z-40 bg-background flex flex-col">
      {/* A. Header */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-border bg-card">
        <div className="min-w-0">
          <h1 className="text-base font-bold text-foreground leading-tight">AI Mood Board Studio</h1>
          <p className="text-[11px] text-muted-foreground truncate">Collect inspiration, build concepts, and refine your design with AI.</p>
        </div>
        <div className="flex-1 max-w-lg relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={boardsFilter} onChange={(e) => setBoardsFilter(e.target.value)} placeholder="Search inspiration and materials..." className="pl-9 h-9 rounded-full" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSuggestSignal((s) => (s ?? 0) + 1)}>
            <Sparkles className="h-3.5 w-3.5" /> AI Suggest
          </Button>
          <Button size="sm" className="gap-1.5" disabled={saving} onClick={handleSaveBoard}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Board
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={exporting} onClick={handleExport}>
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Export
          </Button>
          <Popover>
            <PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Settings" />}>
              <Settings className="h-4 w-4" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-3 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Board Name</p>
              <Input key={board.name} defaultValue={board.name} onBlur={(e) => handleRenameBoard(e.target.value)} className="h-8 text-sm" />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={() => router.push("/buyer/mood-board")}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* B. Inspiration Boards strip */}
      <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border bg-card overflow-hidden">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">Inspiration Boards</p>
        <button type="button" onClick={() => setBoardStripOffset((o) => Math.max(0, o - 1))} disabled={boardStripOffset === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30 shrink-0">
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-center gap-2 overflow-x-auto flex-1">
          {visibleStrip.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => handleSwitchBoard(b.id)}
              className={`shrink-0 flex items-center gap-2 rounded-lg border px-2 py-1.5 ${b.id === board.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
            >
              <div className="w-8 h-8 rounded bg-muted overflow-hidden shrink-0">
                {b.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.coverImage} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="text-left">
                <p className="text-xs font-medium leading-tight">{b.name}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{b.itemCount} pins</p>
              </div>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setBoardStripOffset((o) => o + 1)} disabled={boardStripOffset + 6 >= filteredBoards.length} className="p-1 rounded hover:bg-muted disabled:opacity-30 shrink-0">
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => setNewBoardOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New Board
        </Button>
      </div>

      {/* C. Secondary design toolbar */}
      <DesignToolbar
        palette={board.palette}
        onAddColor={handleAddColor}
        onRemoveColor={handleRemoveColor}
        onAddImageAsset={(src) => handleAddItem("IMAGE", { kind: "image", src })}
        onAddMaterial={(name) => handleAddItem("MATERIAL", { kind: "material", name }, { width: 140, height: 140 })}
        onApplyLayout={handleApplyLayout}
        onAddNote={() =>
          handleAddItem(
            "NOTE",
            { kind: "note", title: "Design notes", bullets: ["Natural fibers", "Handcrafted details", "Soft, earthy palette", "Effortless elegance"] },
            { width: 240, height: 170 }
          )
        }
        onOpenRemix={() => setRemixOpen(true)}
        onSendToShop={handleSendToShop}
        onSendToManufacturer={handleSendToManufacturer}
        onOpenSizeChart={() => setSizeChartOpen(true)}
        onOpenSendDm={() => setSendDmOpen(true)}
        onAskAi={handleAskAi}
      />

      {/* Main row: left toolbar + asset panel + canvas + right inspector */}
      <div className="flex flex-1 min-h-0">
        {!fullscreen && (
          <div className="w-16 shrink-0 border-r border-border bg-card flex flex-col items-center py-3 gap-1">
            {LEFT_TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveLeftTool(t.id)}
                className={`w-12 flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-medium transition-colors ${
                  activeLeftTool === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>
        )}

        {!fullscreen && (
          <LeftAssetPanel
            activeTool={activeLeftTool}
            boards={boards}
            activeBoardId={board.id}
            onSwitchBoard={handleSwitchBoard}
            onAddImage={(src) => handleAddItem("IMAGE", { kind: "image", src })}
            onAddText={() => handleAddItem("TEXT", { kind: "text", text: "" }, { width: 220, height: 100 })}
            onAddSwatch={(hex) => handleAddItem("COLOR_SWATCH", { kind: "swatch", hex }, { width: 120, height: 120 })}
            onAddMaterial={(name) => handleAddItem("MATERIAL", { kind: "material", name }, { width: 140, height: 140 })}
            onApplyLayout={handleApplyLayout}
          />
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex min-h-0 relative">
            {/* canvasWrapRef stays scoped to just the board content, not the
                zoom/undo controls overlay, so Export captures the board
                itself rather than the surrounding UI chrome. */}
            <div ref={canvasWrapRef} className="flex-1 flex min-h-0">
              <MoodBoardCanvas
                items={board.items}
                palette={board.palette}
                selectedItemId={selectedItemId}
                zoom={zoom}
                onSelect={handleSelect}
                onDeselect={() => setSelectedItemId(null)}
                onDragEnd={handleDragEnd}
                onResizeEnd={handleResizeEnd}
                onDelete={handleDeleteItem}
                onEditContent={handleEditContent}
              />
            </div>
            <CanvasControls
              canUndo={past.length > 0}
              canRedo={future.length > 0}
              onUndo={handleUndo}
              onRedo={handleRedo}
              zoom={zoom}
              onZoomChange={setZoom}
              fullscreen={fullscreen}
              onToggleFullscreen={() => setFullscreen((f) => !f)}
            />
          </div>
          <BottomAiBar onAsk={handleAskAi} onAttachImage={(src) => handleAddItem("IMAGE", { kind: "image", src })} />
        </div>

        {!fullscreen && (
          <RightInspector
            board={board}
            onAddColor={handleAddColor}
            onRemoveColor={handleRemoveColor}
            onApplySuggestion={handleApplySuggestion}
            onCommentAdded={(c) => setBoard((prev) => ({ ...prev, comments: [...prev.comments, c] }))}
            refreshSuggestionsSignal={suggestSignal}
          />
        )}
      </div>

      <NewBoardDialog open={newBoardOpen} onOpenChange={setNewBoardOpen} onCreate={handleCreateBoard} />
      <SizeChartDialog open={sizeChartOpen} onOpenChange={setSizeChartOpen} initialRows={board.sizeChart} onSave={handleSaveSizeChart} />
      <AiRemixDialog open={remixOpen} onOpenChange={setRemixOpen} boardId={board.id} onApply={handleApplyRemix} />
      <SendDmDialog open={sendDmOpen} onOpenChange={setSendDmOpen} />
    </div>
  );
}
