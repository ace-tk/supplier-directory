"use client";

import { useState } from "react";
import { ChevronDown, FlipHorizontal2, FlipVertical2, Link2, Link2Off, RotateCcw, TriangleAlert } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Editor, EditorState, RefPoint } from "../engine/Editor";
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
