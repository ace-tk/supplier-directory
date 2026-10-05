"use client";

import { useState } from "react";
import { ChevronDown, FlipHorizontal2, FlipVertical2, Link2, Link2Off, RotateCcw, TriangleAlert } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DPI_BAD, DPI_WARN } from "../engine/clip-fit";
import { REPEAT_TYPES, type RepeatType } from "../engine/repeat";
import type { ClipFit, Editor, EditorState, RefPoint } from "../engine/Editor";
import type { OpenPathInfo } from "../engine/shape-tool";
import { NODE_TYPE_LABEL, type NodeType } from "../engine/node-geometry";
import { formatUnits, MAX_ZOOM_PCT, MIN_ZOOM_PCT, UNIT_LABEL, type DisplayUnit } from "../engine/units";
import { LengthField } from "./LengthField";

const ZOOM_PRESETS = [10, 14, 25, 50, 75, 100, 200, 400, 800, 1600, 3200];

function Sep() {
  return <div className="mx-1.5 h-6 w-px shrink-0 bg-border" />;
}

function IconBtn({ title, onClick, active, disabled, children }: { title: string; onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-35",
        active && "bg-primary/10 text-primary"
      )}
    >
      {children}
    </button>
  );
}

function TextBtn({ title, onClick, active, disabled, children }: { title: string; onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-6 shrink-0 rounded border border-border px-1.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-35",
        active && "border-primary bg-primary/10 text-primary"
      )}
    >
      {children}
    </button>
  );
}

function RefPointPicker({ value, onChange }: { value: RefPoint; onChange: (p: RefPoint) => void }) {
  return (
    <div className="grid shrink-0 grid-cols-3 gap-[2px] rounded border border-border p-[2px]" title="Reference point for X/Y and resizing">
      {Array.from({ length: 9 }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Reference point ${i + 1}`}
          onClick={() => onChange(i as RefPoint)}
          className={cn("h-[5px] w-[5px] rounded-[1px]", value === i ? "bg-primary" : "bg-muted-foreground/30 hover:bg-muted-foreground/60")}
        />
      ))}
    </div>
  );
}

function ZoomControl({ editor, zoomPct, hasSelection }: { editor: Editor; zoomPct: number; hasSelection: boolean }) {
  const shown = `${zoomPct >= 10 ? Math.round(zoomPct) : zoomPct.toFixed(1)}%`;
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? shown;
  return (
    <div className="flex shrink-0 items-center">
      <input
        value={text}
        aria-label="Zoom"
        onFocus={(e) => {
          setDraft(shown);
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const v = draft === null ? NaN : parseFloat(draft);
          setDraft(null);
          if (Number.isFinite(v)) editor.setZoomPct(Math.min(MAX_ZOOM_PCT, Math.max(MIN_ZOOM_PCT, v)));
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="h-6 w-16 rounded-l border border-border bg-background px-1.5 text-right font-mono text-[11px] tabular-nums outline-none focus:border-primary"
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button type="button" aria-label="Zoom presets" className="flex h-6 w-6 items-center justify-center rounded-r border border-l-0 border-border hover:bg-accent">
              <ChevronDown className="h-3 w-3" />
            </button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem onClick={() => editor.fitPage()}>Fit page (Shift+F4)</DropdownMenuItem>
          <DropdownMenuItem disabled={!hasSelection} onClick={() => editor.fitSelection()}>
            Fit selection (Shift+F2)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.fitAll()}>Fit all objects (F4)</DropdownMenuItem>
          <DropdownMenuSeparator />
          {ZOOM_PRESETS.map((z) => (
            <DropdownMenuItem key={z} onClick={() => editor.setZoomPct(z)}>
              {z}%{z === 100 ? " (real size)" : ""}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Simplify tolerance slider: 0–100 maps to 0.001"–0.5" on a log scale (fine control at the small end).
const TOL_MIN = 0.001;
const TOL_RANGE = 500;
const sliderToTolerance = (v: number) => TOL_MIN * Math.pow(TOL_RANGE, v / 100);
const toleranceToSlider = (t: number) => Math.min(100, Math.max(0, (100 * Math.log(t / TOL_MIN)) / Math.log(TOL_RANGE)));

/** Check outlines: lists every open path so it can be closed before prints are placed inside (Phase 3). */
function CheckOutlines({ editor, unit }: { editor: Editor; unit: DisplayUnit }) {
  const [list, setList] = useState<OpenPathInfo[]>([]);
  const [showLines, setShowLines] = useState(false);
  const lines = list.filter((p) => p.nodes === 2).length;
  const shown = showLines ? list : list.filter((p) => p.nodes > 2);
  return (
    <DropdownMenu onOpenChange={(open) => open && setList(editor.listOpenPaths())}>
      <DropdownMenuTrigger
        render={
          <button type="button" title="List every open path in the document" className="h-6 shrink-0 rounded border border-border px-1.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground">
            Check outlines
          </button>
        }
      />
      <DropdownMenuContent align="start" className="max-h-80 min-w-72 overflow-y-auto">
        <div className="px-2 py-1.5 text-xs font-medium text-foreground">
          {list.length === 0 ? "All outlines are closed" : `${list.length - lines} open outline${list.length - lines === 1 ? "" : "s"}${lines ? ` · ${lines} simple line${lines === 1 ? "" : "s"}` : ""}`}
        </div>
        {list.length > 0 && <div className="px-2 pb-1.5 text-[11px] text-muted-foreground">Prints can only be placed inside closed outlines. Click one to fix it: select its two end nodes, then Join or Close with line.</div>}
        {shown.map((info, i) => (
          <DropdownMenuItem key={i} onClick={() => editor.editOpenPath(info)}>
            <span className="truncate">{info.label}</span>
            <span className="ml-auto pl-3 font-mono text-[11px] text-muted-foreground">
              {info.nodes} nodes · gap {formatUnits(info.gap, unit)} {UNIT_LABEL[unit]}
            </span>
          </DropdownMenuItem>
        ))}
        {lines > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem closeOnClick={false} onClick={() => setShowLines((v) => !v)}>
              {showLines ? "Hide" : "Show"} simple lines (grainlines, notches)
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Shape tool: node position, node types, segment and structure commands. Positions are ruler coordinates (y up). */
function NodeFields({ editor, state }: { editor: Editor; state: EditorState }) {
  const n = state.nodeEdit!;
  const unit = state.settings.units;
  const o = state.origin;
  if (n.hint || !n.hasTarget) {
    return (
      <>
        {n.hint ? <span className="shrink-0 text-[11px] font-medium text-amber-600">{n.hint}</span> : <span className="shrink-0 text-[11px] text-muted-foreground">Shape tool — click a curve to show its nodes</span>}
        <Sep />
        <CheckOutlines editor={editor} unit={unit} />
      </>
    );
  }
  if (n.simplify) {
    const sv = n.simplify;
    return (
      <>
        <span className="shrink-0 text-[11px] font-semibold text-foreground">Simplify</span>
        <span className="shrink-0 text-[11px] text-muted-foreground">Tolerance</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={toleranceToSlider(sv.tolerance)}
          aria-label="Simplify tolerance"
          onChange={(e) => editor.previewSimplify(sliderToTolerance(Number(e.target.value)))}
          className="h-1 w-40 shrink-0 accent-primary"
        />
        <LengthField label="±" inches={sv.tolerance} unit={unit} onCommit={(t) => t > 0 && editor.previewSimplify(t)} title="How far the simplified outline may move from the original" />
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-foreground" title="Node count before → after">
          {sv.before} → {sv.after} nodes
        </span>
        <span className="shrink-0 text-[11px] text-fuchsia-600">pink = preview</span>
        <TextBtn title="Replace the outline with the preview" active onClick={() => editor.applySimplify()}>
          Apply
        </TextBtn>
        <TextBtn title="Keep the outline as it is (Esc)" onClick={() => editor.cancelSimplify()}>
          Cancel
        </TextBtn>
      </>
    );
  }
  const b = n.bounds;
  return (
    <>
      <span className="shrink-0 text-[11px] font-semibold text-foreground">{b ? "Nodes" : "Node"}</span>
      {b ? (
        <>
          <LengthField label="X" inches={b.x - o.x} unit={unit} disabled onCommit={() => {}} title="Left edge of the selected nodes (from ruler origin)" />
          <LengthField label="Y" inches={o.y - (b.y + b.h)} unit={unit} disabled onCommit={() => {}} title="Bottom edge of the selected nodes (up from ruler origin)" />
          <LengthField label="W" inches={b.w} unit={unit} disabled onCommit={() => {}} title="Width of the selected nodes" />
          <LengthField label="H" inches={b.h} unit={unit} disabled onCommit={() => {}} title="Height of the selected nodes" />
        </>
      ) : (
        <>
          <LengthField label="X" inches={n.point ? n.point.x - o.x : null} unit={unit} onCommit={(x) => editor.setNodePosition({ x })} title="Node X (from ruler origin)" />
          <LengthField label="Y" inches={n.point ? o.y - n.point.y : null} unit={unit} onCommit={(y) => editor.setNodePosition({ y })} title="Node Y (up from ruler origin)" />
        </>
      )}
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground" title="Selected nodes / total nodes">
        {n.selected} / {n.total} nodes
      </span>
      <Sep />
      {(["c", "s", "y"] as NodeType[]).map((t) => (
        <TextBtn key={t} title={`Make node ${NODE_TYPE_LABEL[t].toLowerCase()} (${t.toUpperCase()})`} active={n.nodeType === t} disabled={!n.selected} onClick={() => editor.setNodeType(t)}>
          {NODE_TYPE_LABEL[t]}
        </TextBtn>
      ))}
      <Sep />
      <TextBtn title="Convert the selected segment to a straight line" disabled={!n.hasCurve} onClick={() => editor.convertSegments("line")}>
        To line
      </TextBtn>
      <TextBtn title="Convert the selected segment to a curve (so it can be bent)" disabled={!n.hasLine} onClick={() => editor.convertSegments("curve")}>
        To curve
      </TextBtn>
      {n.segmentLength !== null && (
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-foreground" title={n.segments > 1 ? `Total length of ${n.segments} segments` : "Length of the selected segment"}>
          Length {formatUnits(n.segmentLength, unit)} {UNIT_LABEL[unit]}
        </span>
      )}
      <Sep />
      <TextBtn title="Add a node at the middle of the selected segment (+). Double-click the outline to add one exactly there." disabled={!n.segments} onClick={() => editor.addNodes()}>
        + Node
      </TextBtn>
      <TextBtn title="Delete the selected nodes (Delete or −). Double-click a node to delete it." disabled={!n.selected} onClick={() => editor.deleteNodes()}>
        − Node
      </TextBtn>
      <TextBtn title="Break the outline apart at the selected node" disabled={!n.canBreak} onClick={() => editor.breakAtNodes()}>
        Break
      </TextBtn>
      <TextBtn title="Join the two selected end nodes into one" disabled={!n.canJoin} onClick={() => editor.joinNodes()}>
        Join
      </TextBtn>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button type="button" className="flex h-6 shrink-0 items-center gap-0.5 rounded border border-border px-1.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground">
              More <ChevronDown className="h-3 w-3" />
            </button>
          }
        />
        <DropdownMenuContent align="start" className="min-w-64">
          <DropdownMenuItem disabled={!n.open} onClick={() => editor.closeWithLine()}>
            Extend curve to close (straight line)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.toggleClosed()}>{n.open ? "Close path" : "Open path"}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.reverseDirection()}>Reverse direction</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={n.selected < 2} onClick={() => editor.alignNodes("h")}>
            Align nodes horizontally (same Y as last selected)
          </DropdownMenuItem>
          <DropdownMenuItem disabled={n.selected < 2} onClick={() => editor.alignNodes("v")}>
            Align nodes vertically (same X as last selected)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => editor.previewSimplify()}>Simplify (reduce nodes)…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Sep />
      {n.open && (
        <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-amber-600" title="Prints can only be placed inside closed outlines (Phase 3). Select the two end nodes and use Join, or More → Extend curve to close.">
          <TriangleAlert className="h-3.5 w-3.5" /> Open outline
        </span>
      )}
      <CheckOutlines editor={editor} unit={unit} />
    </>
  );
}

/** Rotation in degrees, counter-clockwise. Shows the live value; commits on Enter or blur. */
function AngleField({ value, onCommit, title }: { value: number; onCommit: (deg: number) => void; title: string }) {
  const shown = (Math.abs(value) < 0.0005 ? 0 : value).toFixed(3);
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground" title={title}>
      <RotateCcw className="h-3 w-3" />
      <input
        value={draft ?? shown}
        aria-label={title}
        onFocus={(e) => {
          setDraft(shown);
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const v = draft === null ? NaN : parseFloat(draft);
          setDraft(null);
          if (Number.isFinite(v) && Math.abs(v - value) > 1e-9) onCommit(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(null);
            e.stopPropagation();
            e.currentTarget.blur();
          }
        }}
        className="h-6 w-16 rounded border border-border bg-background px-1 text-right font-mono text-[11px] text-foreground tabular-nums outline-none focus:border-primary"
      />
      °
    </label>
  );
}

const FITS: { id: ClipFit; label: string; title: string }[] = [
  { id: "center", label: "Center", title: "Center the print in the frame" },
  { id: "fit", label: "Fit", title: "Fit: the whole print visible inside the frame" },
  { id: "fill", label: "Fill", title: "Fill: the print covers the whole frame, no gaps" },
  { id: "stretch", label: "Stretch", title: "Stretch the print to the frame's exact proportions (asks first if that distorts it)" },
  { id: "top", label: "Top", title: "Align top-centre of the print to top-centre of the frame (waistband placement)" },
];

/** Editing a PowerClip's contents: the print's position, size and rotation relative to the frame, quick fits and DPI. */
function ClipFields({ editor, state }: { editor: Editor; state: EditorState }) {
  const c = state.clipContent!;
  const unit = state.settings.units;
  const fit = (mode: ClipFit) => {
    if (mode === "stretch" && c.stretchDistorts) {
      // Ask before distorting.
      toast.warning("Stretch changes the print's proportions to match the frame, so the artwork will be distorted.", { action: { label: "Stretch anyway", onClick: () => editor.fitClipContent("stretch") } });
      return;
    }
    editor.fitClipContent(mode);
  };
  return (
    <>
      <span className="shrink-0 text-[11px] font-semibold text-foreground" title="Measured from the frame's anchor point to the print's same point">
        Print in frame
      </span>
      <RefPointPicker value={state.refPoint} onChange={(p) => editor.setRefPoint(p)} />
      <LengthField label="X" inches={c.x} unit={unit} onCommit={(x) => editor.setClipContent({ x })} title="Print's anchor point, right of the frame's anchor point" />
      <LengthField label="Y" inches={c.y} unit={unit} onCommit={(y) => editor.setClipContent({ y })} title="Print's anchor point, above the frame's anchor point" />
      <LengthField label="W" inches={c.w} unit={unit} onCommit={(w) => editor.setClipContent({ w })} title="Print width (its own width, not the rotated box)" />
      <LengthField label="H" inches={c.h} unit={unit} onCommit={(h) => editor.setClipContent({ h })} title="Print height" />
      <IconBtn title={state.lockAspect ? "Proportional (lock aspect) — on" : "Proportional (lock aspect) — off"} onClick={() => editor.setLockAspect(!state.lockAspect)} active={state.lockAspect}>
        {state.lockAspect ? <Link2 className="h-3.5 w-3.5" /> : <Link2Off className="h-3.5 w-3.5" />}
      </IconBtn>
      <AngleField value={c.rotation} onCommit={(rotation) => editor.setClipContent({ rotation })} title="Print rotation in degrees (counter-clockwise)" />
      <Sep />
      {FITS.map((f) => (
        <TextBtn key={f.id} title={f.title} onClick={() => fit(f.id)}>
          {f.label}
        </TextBtn>
      ))}
      <Sep />
      <TextBtn title="Repeat fill: use this print as one tile and repeat it to cover the whole frame" onClick={() => editor.setClipRepeat(true)}>
        Repeat fill
      </TextBtn>
      {c.dpi !== null && (
        <>
          <Sep />
          <span
            role={c.dpiLevel === "ok" ? undefined : "alert"}
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] tabular-nums",
              c.dpiLevel === "bad" ? "bg-red-100 font-semibold text-red-700 dark:bg-red-950 dark:text-red-300" : c.dpiLevel === "low" ? "bg-yellow-100 font-semibold text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300" : "text-muted-foreground"
            )}
            title={`Effective resolution at this size, from the original image file. Below ${DPI_WARN} DPI may look soft; below ${DPI_BAD} DPI will look blurry.`}
          >
            {Math.round(c.dpi)} DPI{c.dpiLevel === "bad" ? " — print may look blurry" : c.dpiLevel === "low" ? " — low" : ""}
          </span>
        </>
      )}
    </>
  );
}

/** Plain number input (percent, counts): shows the live value, commits on Enter or blur. */
function NumberField({ label, value, decimals, suffix, onCommit, title }: { label: string; value: number; decimals: number; suffix?: string; onCommit: (v: number) => void; title: string }) {
  const shown = value.toFixed(decimals);
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground" title={title}>
      <span className="font-medium">{label}</span>
      <input
        value={draft ?? shown}
        aria-label={title}
        onFocus={(e) => {
          setDraft(shown);
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const v = draft === null ? NaN : parseFloat(draft);
          setDraft(null);
          if (Number.isFinite(v) && Math.abs(v - value) > 1e-9) onCommit(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(null);
            e.stopPropagation();
            e.currentTarget.blur();
          }
        }}
        className="h-6 w-14 rounded border border-border bg-background px-1 text-right font-mono text-[11px] text-foreground tabular-nums outline-none focus:border-primary"
      />
      {suffix}
    </label>
  );
}

/** Editing a PowerClip with Repeat fill: the repeat's type, tile size, spacing, starting point, rotation and scale. */
function RepeatFields({ editor, state }: { editor: Editor; state: EditorState }) {
  const clip = state.clip!;
  const r = clip.repeat!;
  const unit = state.settings.units;
  const linked = state.lockAspect;
  return (
    <>
      <TextBtn title="Repeat fill is on — click to go back to a single print" active onClick={() => editor.setClipRepeat(null)}>
        Repeat fill
      </TextBtn>
      <select
        aria-label="Repeat type"
        title={REPEAT_TYPES.find((t) => t.id === r.type)?.help}
        value={r.type}
        onChange={(e) => editor.setClipRepeat({ type: e.target.value as RepeatType })}
        className="h-6 shrink-0 rounded border border-border bg-background px-1 text-[11px] outline-none"
      >
        {REPEAT_TYPES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      <span className="shrink-0 text-[11px] text-muted-foreground">Tile</span>
      <LengthField label="W" inches={r.tileW} unit={unit} onCommit={(w) => w > 0 && editor.setClipRepeat(linked ? { tileW: w, tileH: (r.tileH * w) / r.tileW } : { tileW: w })} title="Tile width" />
      <LengthField label="H" inches={r.tileH} unit={unit} onCommit={(h) => h > 0 && editor.setClipRepeat(linked ? { tileH: h, tileW: (r.tileW * h) / r.tileH } : { tileH: h })} title="Tile height" />
      <IconBtn title={linked ? "Tile width and height linked — on" : "Tile width and height linked — off"} onClick={() => editor.setLockAspect(!linked)} active={linked}>
        {linked ? <Link2 className="h-3.5 w-3.5" /> : <Link2Off className="h-3.5 w-3.5" />}
      </IconBtn>
      <span className="shrink-0 text-[11px] text-muted-foreground" title="Space between tiles. 0 = seamless; negative = overlap">
        Gap
      </span>
      <LengthField label="X" inches={r.gapX} unit={unit} onCommit={(gapX) => editor.setClipRepeat({ gapX })} title="Horizontal spacing between tiles (0 = seamless, negative = overlap)" />
      <LengthField label="Y" inches={r.gapY} unit={unit} onCommit={(gapY) => editor.setClipRepeat({ gapY })} title="Vertical spacing between tiles (0 = seamless, negative = overlap)" />
      <span className="shrink-0 text-[11px] text-muted-foreground" title="Where the repeat starts. You can also drag inside the frame.">
        Offset
      </span>
      <LengthField label="X" inches={r.offsetX} unit={unit} onCommit={(offsetX) => editor.setClipRepeat({ offsetX })} title="Repeat offset X (or drag inside the frame)" />
      <LengthField label="Y" inches={-r.offsetY} unit={unit} onCommit={(y) => editor.setClipRepeat({ offsetY: -y })} title="Repeat offset Y, up (or drag inside the frame)" />
      <AngleField value={r.rotation} onCommit={(rotation) => editor.setClipRepeat({ rotation })} title="Rotation of the whole repeat in degrees (counter-clockwise)" />
      <NumberField label="Scale" value={r.scale} decimals={1} suffix="%" onCommit={(scale) => scale > 0 && editor.setClipRepeat({ scale })} title="Scale of the whole repeat (tile and spacing), percent" />
      {clip.tiles && (
        <span className={cn("shrink-0 font-mono text-[11px] tabular-nums", clip.tiles.skipped ? "font-semibold text-amber-600" : "text-muted-foreground")} title="Tiles drawn for the part of this piece that is on screen">
          {clip.tiles.skipped ? "Tile too small to draw at this zoom — zoom in" : `${clip.tiles.drawn} tiles`}
        </span>
      )}
    </>
  );
}

export function PropertyBar({ editor, state }: { editor: Editor; state: EditorState }) {
  const unit = state.settings.units;
  const b = state.selectionBounds;
  const o = state.origin;
  const col = state.refPoint % 3;
  const row = Math.floor(state.refPoint / 3);
  // Reference point in ruler coordinates (y up).
  const refX = b ? b.x + (b.w * col) / 2 - o.x : null;
  const refY = b ? o.y - (b.y + (b.h * row) / 2) : null;
  const [angle, setAngle] = useState("0");

  return (
    <div className="flex h-10 shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border bg-card px-2 [scrollbar-width:thin]">
      {/* Page */}
      <span className="shrink-0 text-[11px] font-semibold text-foreground">Page</span>
      <LengthField label="W" inches={state.page.width} unit={unit} onCommit={(w) => editor.setPage({ ...state.page, width: w })} title="Page width" />
      <LengthField label="H" inches={state.page.height} unit={unit} onCommit={(h) => editor.setPage({ ...state.page, height: h })} title="Page height" />
      <select
        aria-label="Units"
        value={unit}
        onChange={(e) => editor.updateSettings({ units: e.target.value as DisplayUnit })}
        className="h-6 shrink-0 rounded border border-border bg-background px-1 text-[11px] outline-none"
      >
        <option value="in">inches</option>
        <option value="cm">centimeters</option>
        <option value="mm">millimeters</option>
      </select>
      <Sep />
      <LengthField label="⇥" inches={state.settings.nudge} unit={unit} onCommit={(v) => v > 0 && editor.updateSettings({ nudge: v })} title="Nudge distance (arrow keys; Shift = ×10)" />
      <span className="shrink-0 text-[11px] text-muted-foreground" title="Duplicate offset (Ctrl+D)">
        Dup
      </span>
      <LengthField label="X" inches={state.settings.duplicateOffset.x} unit={unit} onCommit={(x) => editor.updateSettings({ duplicateOffset: { ...state.settings.duplicateOffset, x } })} title="Duplicate offset X" />
      <LengthField label="Y" inches={state.settings.duplicateOffset.y} unit={unit} onCommit={(y) => editor.updateSettings({ duplicateOffset: { ...state.settings.duplicateOffset, y } })} title="Duplicate offset Y (up)" />
      <Sep />

      {state.nodeEdit ? (
        <NodeFields editor={editor} state={state} />
      ) : state.clip?.editing && state.clip.repeat ? (
        <RepeatFields editor={editor} state={state} />
      ) : state.clipContent ? (
        <ClipFields editor={editor} state={state} />
      ) : (
        <>
          {/* Selection */}
          <RefPointPicker value={state.refPoint} onChange={(p) => editor.setRefPoint(p)} />
          <LengthField label="X" inches={refX} unit={unit} onCommit={(x) => editor.setSelectionGeometry({ x })} title="Selection X (reference point, from ruler origin)" />
          <LengthField label="Y" inches={refY} unit={unit} onCommit={(y) => editor.setSelectionGeometry({ y })} title="Selection Y (reference point, up from ruler origin)" />
          <LengthField label="W" inches={b ? b.w : null} unit={unit} onCommit={(w) => editor.setSelectionGeometry({ w })} title="Selection width" />
          <LengthField label="H" inches={b ? b.h : null} unit={unit} onCommit={(h) => editor.setSelectionGeometry({ h })} title="Selection height" />
          <IconBtn title={state.lockAspect ? "Proportional (lock aspect) — on" : "Proportional (lock aspect) — off"} onClick={() => editor.setLockAspect(!state.lockAspect)} active={state.lockAspect}>
            {state.lockAspect ? <Link2 className="h-3.5 w-3.5" /> : <Link2Off className="h-3.5 w-3.5" />}
          </IconBtn>
          <label className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground" title="Rotate selection by this angle (counter-clockwise)">
            <RotateCcw className="h-3 w-3" />
            <input
              value={angle}
              disabled={!b}
              onChange={(e) => setAngle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const a = parseFloat(angle);
                  if (Number.isFinite(a)) editor.rotateSelection(a);
                  setAngle("0");
                }
              }}
              className="h-6 w-12 rounded border border-border bg-background px-1 text-right font-mono text-[11px] outline-none focus:border-primary disabled:opacity-40"
            />
            °
          </label>
          <IconBtn title="Mirror horizontally" onClick={() => editor.flip("h")} disabled={!b}>
            <FlipHorizontal2 className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn title="Mirror vertically" onClick={() => editor.flip("v")} disabled={!b}>
            <FlipVertical2 className="h-3.5 w-3.5" />
          </IconBtn>
        </>
      )}
      {state.selectedText && !state.nodeEdit && (
        <>
          <Sep />
          <label className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground" title="Font size (points)">
            Size
            <input
              key={state.selectedText.fontSize}
              defaultValue={(state.selectedText.fontSize * 72).toFixed(1)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const pt = parseFloat(e.currentTarget.value);
                  if (pt > 0) editor.setTextFontSize(pt / 72);
                }
              }}
              className="h-6 w-14 rounded border border-border bg-background px-1 text-right font-mono text-[11px] outline-none focus:border-primary"
            />
            pt
          </label>
        </>
      )}
      <div className="ml-auto" />
      <ZoomControl editor={editor} zoomPct={state.zoomPct} hasSelection={!!b} />
    </div>
  );
}
