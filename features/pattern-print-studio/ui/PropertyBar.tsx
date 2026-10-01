"use client";

import { useState } from "react";
import { ChevronDown, FlipHorizontal2, FlipVertical2, Link2, Link2Off, RotateCcw } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Editor, EditorState, RefPoint } from "../engine/Editor";
import { MAX_ZOOM_PCT, MIN_ZOOM_PCT, type DisplayUnit } from "../engine/units";
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
      {state.selectedText && (
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
