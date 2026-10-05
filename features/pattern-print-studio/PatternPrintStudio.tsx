"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, Grid3x3, Magnet, Redo2, Ruler as RulerIcon, ScanLine, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Editor, type EditorState } from "./engine/Editor";
import { exportSvg } from "./engine/export-svg";
import { parsePdf } from "./engine/import-pdf";
import { parseRaster } from "./engine/import-raster";
import { parseSvg } from "./engine/import-svg";
import { clearDraft, DOC_EXTENSION, downloadText, loadDraft, safeFileName, saveDraft, type Draft } from "./engine/storage";
import type { SnapSettings, ToolId } from "./engine/types";
import { formatUnits, UNIT_LABEL } from "./engine/units";
import { CalibrateDialog, ImportDialog, NewDocumentDialog, type PendingImport } from "./ui/Dialogs";
import { AlignPanel, ObjectsPanel, Toolbox } from "./ui/Panels";
import { PropertyBar } from "./ui/PropertyBar";
import { Ruler, RULER_SIZE } from "./ui/Ruler";

const AUTOSAVE_MS = 30_000;
const IMPORT_ACCEPT = ".svg,.pdf,.png,.jpg,.jpeg,.tif,.tiff,.dxf";
const noopSubscribe = () => () => {};
const nullState = () => null;

// F10 is CorelDRAW's Shape tool key; N is a second key for keyboards where F10 is a media key.
const TOOL_KEYS: Record<string, ToolId> = { v: "pick", n: "shape", F10: "shape", z: "zoom", h: "pan", F6: "rectangle", F7: "ellipse", F8: "text" };
/** A Space press shorter than this (with no panning) toggles Shape ⇄ Pick; longer = hold-to-pan. */
const SPACE_TAP_MS = 250;

function isTypingTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

export default function PatternPrintStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const openInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const pdfBytesRef = useRef<{ bytes: ArrayBuffer; name: string } | null>(null);
  const spaceDownAt = useRef(0);
  const [editor, setEditor] = useState<Editor | null>(null);
  const state = useSyncExternalStore(editor?.subscribe ?? noopSubscribe, editor?.getState ?? nullState, nullState) as EditorState | null;

  const [panel, setPanel] = useState<"objects" | "align">("objects");
  const [newOpen, setNewOpen] = useState(false);
  const [calibrateOpen, setCalibrateOpen] = useState(false);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [textAt, setTextAt] = useState<{ x: number; y: number } | null>(null);

  // Editor lifecycle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ed = new Editor(canvas);
    ed.onTextRequest = (at) => setTextAt(at);
    setEditor(ed);
    // Dev-only handle for debugging/verification; compiled out of production builds.
    if (process.env.NODE_ENV !== "production") (window as unknown as { __pps?: Editor }).__pps = ed;
    loadDraft().then((d) => {
      if (d && (d.doc.objects.length > 0 || d.doc.guides.length > 0)) setDraft(d);
    });
    return () => ed.destroy();
  }, []);

  // Autosave draft every 30s (only when something changed).
  useEffect(() => {
    if (!editor) return;
    const t = setInterval(() => {
      if (!editor.takeDraftDirty()) return;
      saveDraft(editor.toDocument())
        .then(() => setDraftSavedAt(Date.now()))
        .catch(() => toast.error("Autosave failed — the draft is too large for this browser's storage."));
    }, AUTOSAVE_MS);
    return () => clearInterval(t);
  }, [editor]);

  // Warn before leaving with unsaved changes.
  const unsaved = state?.unsaved ?? false;
  useEffect(() => {
    if (!unsaved) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [unsaved]);

  // ---------------------------------------------------------------- file actions
  const save = useCallback(() => {
    if (!editor) return;
    const doc = editor.toDocument();
    downloadText(JSON.stringify(doc), `${safeFileName(doc.name)}${DOC_EXTENSION}`, "application/json");
    editor.markSaved();
    saveDraft(doc)
      .then(() => setDraftSavedAt(Date.now()))
      .catch(() => {});
    toast.success("Document saved");
  }, [editor]);

  const exportPageSvg = useCallback(() => {
    if (!editor) return;
    const doc = editor.toDocument();
    downloadText(exportSvg(doc), `${safeFileName(doc.name)}.svg`, "image/svg+xml");
    toast.success(`Exported SVG at ${formatUnits(doc.page.width, "in")} × ${formatUnits(doc.page.height, "in")} in`);
  }, [editor]);

  async function openFile(file: File) {
    if (!editor) return;
    try {
      const doc = JSON.parse(await file.text());
      await editor.loadDocument(doc);
      setDraft(null);
      toast.success(`Opened ${file.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open this file.");
    }
  }

  async function importFile(file: File) {
    if (!editor) return;
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    try {
      if (ext === "svg") setPending(await parseSvg(editor.ps, await file.text(), file.name));
      else if (ext === "pdf") {
        const bytes = await file.arrayBuffer();
        pdfBytesRef.current = { bytes, name: file.name };
        setPending(await parsePdf(editor.ps, bytes.slice(0), file.name, 1));
      } else if (["png", "jpg", "jpeg", "tif", "tiff"].includes(ext)) setPending(await parseRaster(file));
      else if (ext === "dxf") toast.info("DXF (AAMA/ASTM) import is planned for a later phase. For now, export the pattern from CorelDRAW as SVG or PDF.");
      else toast.error("Unsupported file type.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed.");
    }
  }

  // ---------------------------------------------------------------- keyboard
  useEffect(() => {
    if (!editor) return;
    const down = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key;
      const st = editor.getState();
      if (k === " ") {
        e.preventDefault();
        if (!e.repeat) spaceDownAt.current = performance.now();
        editor.setSpaceDown(true);
        return;
      }
      const shapeTool = st.tool === "shape";
      if (mod) {
        const lower = k.toLowerCase();
        const handled = () => e.preventDefault();
        if (lower === "z" && !e.shiftKey) return handled(), editor.undo();
        if ((lower === "z" && e.shiftKey) || lower === "y") return handled(), editor.redo();
        if (lower === "d") return handled(), editor.duplicate();
        if (lower === "c") return handled(), editor.copy();
        if (lower === "x") return handled(), editor.cut();
        if (lower === "v") return handled(), editor.paste();
        if (lower === "a") return handled(), shapeTool ? editor.selectAllNodes() : editor.selectAll();
        if (lower === "g") return handled(), editor.group();
        if (lower === "u") return handled(), editor.ungroup();
        if (k === "'" || e.code === "Quote") return handled(), editor.toggleGrid();
        if (lower === "s") return handled(), save();
        if (lower === "o") return handled(), openInputRef.current?.click();
        if (lower === "i") return handled(), importInputRef.current?.click();
        if (lower === "e") return handled(), exportPageSvg();
        if (k === "=" || k === "+") return handled(), editor.zoomBy(2);
        if (k === "-") return handled(), editor.zoomBy(0.5);
        if (k === "0") return handled(), editor.setZoomPct(100);
        if (k === "PageUp") return handled(), editor.order("forward");
        if (k === "PageDown") return handled(), editor.order("backward");
        return;
      }
      if (e.shiftKey && k === "PageUp") return e.preventDefault(), editor.order("front");
      if (e.shiftKey && k === "PageDown") return e.preventDefault(), editor.order("back");
      if (k === "F4") return e.preventDefault(), e.shiftKey ? editor.fitPage() : editor.fitAll();
      if (k === "F2" && e.shiftKey) return e.preventDefault(), editor.fitSelection();
      // In the Shape tool Delete never removes the whole object (node delete arrives with step 2C).
      if (k === "Delete" || k === "Backspace") return e.preventDefault(), shapeTool ? undefined : editor.deleteSelection();
      // Shape tool: first Esc clears the node selection, the next returns to the object (Pick tool).
      if (k === "Escape") return shapeTool && editor.clearNodeSelection() ? undefined : st.tool !== "pick" ? editor.setTool("pick") : editor.clearSelection();
      if (k.startsWith("Arrow") && (shapeTool ? !!st.nodeEdit?.selected : st.selectionCount)) {
        e.preventDefault();
        const step = st.settings.nudge * (e.shiftKey ? 10 : 1);
        const dx = k === "ArrowLeft" ? -step : k === "ArrowRight" ? step : 0;
        const dy = k === "ArrowUp" ? step : k === "ArrowDown" ? -step : 0;
        if (shapeTool) editor.nudgeNodes(dx, dy);
        else editor.nudge(dx, dy);
        return;
      }
      const tool = TOOL_KEYS[k] ?? TOOL_KEYS[k.toLowerCase()];
      if (tool && !e.altKey) {
        e.preventDefault();
        editor.setTool(tool);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key !== " ") return;
      editor.setSpaceDown(false);
      const held = performance.now() - spaceDownAt.current;
      spaceDownAt.current = 0;
      if (!isTypingTarget(e.target) && held < SPACE_TAP_MS && !editor.takeSpacePanned()) editor.toggleShapePick();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [editor, save, exportPageSvg]);

  const unit = state?.settings.units ?? "in";
  const textClient = textAt && editor ? editor.projectToClient(textAt) : null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background text-foreground">
      {/* Top bar */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
        <Link href="/design-studio" className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> AI Garment Studio
        </Link>
        <div className="mx-1 h-5 w-px bg-border" />
        <span className="text-sm font-semibold">Pattern Print Studio</span>
        {state && (
          <input
            key={state.docName}
            defaultValue={state.docName}
            aria-label="Document name"
            onBlur={(e) => editor?.setDocName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="h-7 w-48 rounded-md border border-transparent bg-transparent px-2 text-sm text-muted-foreground outline-none hover:border-border focus:border-primary focus:text-foreground"
          />
        )}
        {state?.unsaved && <span className="text-[11px] text-amber-600">● unsaved</span>}

        <div className="ml-2 flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="gap-1">File <ChevronDown className="h-3 w-3" /></Button>} />
            <DropdownMenuContent align="start" className="min-w-56">
              <DropdownMenuItem onClick={() => setNewOpen(true)}>New document…</DropdownMenuItem>
              <DropdownMenuItem onClick={() => openInputRef.current?.click()}>
                Open… <DropdownMenuShortcut>Ctrl+O</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={save}>
                Save <DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => importInputRef.current?.click()}>
                Import SVG / PDF / image… <DropdownMenuShortcut>Ctrl+I</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportPageSvg}>
                Export page as SVG <DropdownMenuShortcut>Ctrl+E</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon-sm" aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)" disabled={!state?.canUndo} onClick={() => editor?.undo()}>
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Redo (Ctrl+Shift+Z)" title="Redo (Ctrl+Shift+Z)" disabled={!state?.canRedo} onClick={() => editor?.redo()}>
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant={state?.settings.grid.visible ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5"
            title="Toggle grid (Ctrl+')"
            onClick={() => editor?.toggleGrid()}
          >
            <Grid3x3 className="h-4 w-4" /> Grid
          </Button>
          {state && editor && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="gap-1.5"><Magnet className="h-4 w-4" /> Snap To <ChevronDown className="h-3 w-3" /></Button>} />
                <DropdownMenuContent align="end" className="min-w-48">
                  {(["grid", "guides", "objects", "page"] as (keyof SnapSettings)[]).map((k) => (
                    <DropdownMenuCheckboxItem
                      key={k}
                      checked={state.settings.snap[k]}
                      onCheckedChange={(v) => editor.updateSettings({ snap: { ...state.settings.snap, [k]: !!v } })}
                    >
                      {k === "grid" ? "Grid" : k === "guides" ? "Guidelines" : k === "objects" ? "Objects (nodes & edges)" : "Page"}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                    Grid spacing
                    <input
                      key={`${state.settings.grid.spacing}-${unit}`}
                      defaultValue={formatUnits(state.settings.grid.spacing, unit)}
                      onKeyDown={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value);
                        if (v > 0) editor.updateSettings({ grid: { ...state.settings.grid, spacing: v / (unit === "in" ? 1 : unit === "cm" ? 2.54 : 25.4) } });
                      }}
                      className="h-6 w-16 rounded border border-border bg-background px-1 text-right font-mono text-[11px] text-foreground"
                    />
                    {UNIT_LABEL[unit]}
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                    Subdivisions
                    <input
                      key={state.settings.grid.subdivisions}
                      defaultValue={state.settings.grid.subdivisions}
                      onKeyDown={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        const v = Math.round(Number(e.target.value));
                        if (v >= 1 && v <= 20) editor.updateSettings({ grid: { ...state.settings.grid, subdivisions: v } });
                      }}
                      className="h-6 w-12 rounded border border-border bg-background px-1 text-right font-mono text-[11px] text-foreground"
                    />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="gap-1.5"><ScanLine className="h-4 w-4" /> Guides <ChevronDown className="h-3 w-3" /></Button>} />
                <DropdownMenuContent align="end" className="min-w-52">
                  <DropdownMenuCheckboxItem checked={state.settings.guidesVisible} onCheckedChange={(v) => editor.updateSettings({ guidesVisible: !!v })}>
                    Show guidelines
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuItem disabled={!state.selectedGuideId} onClick={() => state.selectedGuideId && editor.deleteGuide(state.selectedGuideId)}>
                    Delete selected guideline
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!state.guides.length} onClick={() => editor.clearGuides()}>
                    Delete all guidelines ({state.guides.length})
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => editor.resetOrigin()}>Reset ruler origin to page bottom-left</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setCalibrateOpen(true)} title="Calibrate screen so 100% = real size">
            <RulerIcon className="h-4 w-4" /> Calibrate
          </Button>
        </div>
      </div>

      {editor && state && <PropertyBar editor={editor} state={state} />}

      {draft && (
        <div className="flex shrink-0 items-center gap-3 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Unsaved draft “{draft.doc.name}” from {new Date(draft.savedAt).toLocaleString()} was found.
          <Button
            size="xs"
            onClick={async () => {
              await editor?.loadDocument(draft.doc);
              setDraft(null);
              toast.success("Draft restored");
            }}
          >
            Restore
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              clearDraft();
              setDraft(null);
            }}
          >
            Discard
          </Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {editor && state && <Toolbox editor={editor} tool={state.tool} />}

        {/* Rulers + canvas */}
        <div
          className="grid min-w-0 flex-1"
          style={{ gridTemplateColumns: `${RULER_SIZE}px 1fr`, gridTemplateRows: `${RULER_SIZE}px 1fr`, ["--pps-ruler-bg" as string]: "var(--color-card, #f4f5f7)", ["--pps-ruler-fg" as string]: "var(--color-muted-foreground, #4b5563)" }}
        >
          <button
            type="button"
            title="Drag to move the ruler origin · double-click to reset to page bottom-left"
            aria-label="Ruler origin"
            className="flex items-center justify-center border-b border-r border-border bg-card text-muted-foreground hover:text-primary"
            onPointerDown={(e) => {
              if (e.button !== 0 || !editor) return;
              e.preventDefault();
              editor.beginOriginDrag(e.nativeEvent);
            }}
            onDoubleClick={() => editor?.resetOrigin()}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path d="M6 0v12M0 6h12" stroke="currentColor" strokeDasharray="2 1.5" />
            </svg>
          </button>
          <div className="overflow-hidden">{editor && <Ruler editor={editor} orientation="h" unit={unit} />}</div>
          <div className="overflow-hidden">{editor && <Ruler editor={editor} orientation="v" unit={unit} />}</div>
          <div className="relative min-h-0 overflow-hidden bg-[#e3e5ea] dark:bg-[#2a2d33]">
            <canvas ref={canvasRef} className="absolute inset-0 block touch-none select-none" />
          </div>
        </div>

        {/* Right panel */}
        <div className="flex w-60 shrink-0 flex-col border-l border-border bg-card">
          <div className="flex shrink-0 border-b border-border text-xs">
            {(["objects", "align"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPanel(p)}
                className={cn("flex-1 py-2 font-medium", panel === p ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {p === "objects" ? `Objects${state ? ` (${state.objects.length})` : ""}` : "Align & Distribute"}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{editor && state && (panel === "objects" ? <ObjectsPanel editor={editor} state={state} /> : <AlignPanel editor={editor} state={state} />)}</div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex h-7 shrink-0 items-center gap-4 border-t border-border bg-card px-3 font-mono text-[11px] text-muted-foreground">
        <span>
          {state?.cursor
            ? `X ${formatUnits(state.cursor.x - state.origin.x, unit)}  Y ${formatUnits(state.origin.y - state.cursor.y, unit)} ${UNIT_LABEL[unit]}`
            : `Page ${formatUnits(state?.page.width ?? 0, unit)} × ${formatUnits(state?.page.height ?? 0, unit)} ${UNIT_LABEL[unit]}`}
        </span>
        {state?.snapLabel && <span className="text-fuchsia-600">↳ {state.snapLabel}</span>}
        {state?.nodeEdit ? (
          <span>
            {state.nodeEdit.hint
              ? state.nodeEdit.hint
              : state.nodeEdit.hasTarget
                ? `${state.nodeEdit.subpaths > 1 ? "Compound curve" : "Curve"} on Layer 1 · ${state.nodeEdit.total} nodes · ${state.nodeEdit.selected} selected${state.nodeEdit.open ? " · open path" : ""}`
                : "Shape tool · click a curve to edit its nodes"}
          </span>
        ) : (
          state && state.selectionCount > 0 && <span>{state.selectionCount} selected{state.rotateMode ? " · rotate mode (click again to switch)" : ""}</span>
        )}
        <span className="ml-auto">{draftSavedAt ? `Draft autosaved ${new Date(draftSavedAt).toLocaleTimeString()}` : "Autosaves a draft every 30s"}</span>
      </div>

      {/* Text tool input */}
      {textAt && textClient && (
        <input
          autoFocus
          placeholder="Type, then Enter"
          className="fixed z-50 h-7 w-48 rounded border border-primary bg-background px-2 text-sm shadow-md outline-none"
          style={{ left: textClient.x, top: textClient.y - 28 }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && editor) {
              editor.addText(e.currentTarget.value, new editor.ps.Point(textAt.x, textAt.y));
              setTextAt(null);
            }
            if (e.key === "Escape") setTextAt(null);
          }}
          onBlur={() => setTextAt(null)}
        />
      )}

      <input ref={openInputRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => (e.target.files?.[0] && openFile(e.target.files[0]), (e.target.value = ""))} />
      <input ref={importInputRef} type="file" accept={IMPORT_ACCEPT} className="hidden" onChange={(e) => (e.target.files?.[0] && importFile(e.target.files[0]), (e.target.value = ""))} />

      <NewDocumentDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreate={(page, units, name) => {
          editor?.newDocument(page, units, name);
          setNewOpen(false);
        }}
      />
      {state && (
        <CalibrateDialog
          open={calibrateOpen}
          onOpenChange={setCalibrateOpen}
          calibration={state.calibration}
          onApply={(f) => {
            editor?.setCalibration(f);
            setCalibrateOpen(false);
            toast.success("Screen calibrated — 100% is now real size on this screen");
          }}
        />
      )}
      <ImportDialog
        pending={pending}
        unit={unit}
        onCancel={() => setPending(null)}
        onChangePdfPage={async (page) => {
          const src = pdfBytesRef.current;
          if (!src || !editor) return;
          try {
            setPending(await parsePdf(editor.ps, src.bytes.slice(0), src.name, page));
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't read that page.");
          }
        }}
        onPlaceVector={async (opts) => {
          if (!editor || !pending || pending.kind === "raster") return;
          const p = pending;
          setPending(null);
          await editor.placeVector(p, opts);
          toast.success(`Imported ${p.fileName}`);
        }}
        onPlaceRaster={async (dpi) => {
          if (!editor || !pending || pending.kind !== "raster") return;
          const p = pending;
          setPending(null);
          await editor.placeRaster({ ...p.asset, dpi }, p.img);
          toast.success(`Imported ${p.fileName} at ${dpi} DPI`);
        }}
      />
    </div>
  );
}
