"use client";

import { useState } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  AlignVerticalSpaceAround,
  Circle,
  Eye,
  EyeOff,
  Hand,
  Lock,
  MousePointer2,
  Spline,
  Square,
  Type,
  Unlock,
  ZoomIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Editor, EditorState } from "../engine/Editor";
import type { ToolId } from "../engine/types";

const TOOLS: { id: ToolId; label: string; key: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "pick", label: "Pick tool", key: "V / Space", icon: MousePointer2 },
  { id: "shape", label: "Shape tool — edit nodes", key: "F10 / N / Space", icon: Spline },
  { id: "rectangle", label: "Rectangle tool", key: "F6", icon: Square },
  { id: "ellipse", label: "Ellipse tool", key: "F7", icon: Circle },
  { id: "text", label: "Text tool", key: "F8", icon: Type },
  { id: "zoom", label: "Zoom tool (Alt/right-click = out)", key: "Z", icon: ZoomIn },
  { id: "pan", label: "Pan tool (or hold Space)", key: "H", icon: Hand },
];

export function Toolbox({ editor, tool }: { editor: Editor; tool: ToolId }) {
  return (
    <div className="flex w-10 shrink-0 flex-col items-center gap-1 border-r border-border bg-card py-2">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          title={`${t.label} (${t.key})`}
          aria-label={t.label}
          onClick={() => editor.setTool(t.id)}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
            tool === t.id && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
          )}
        >
          <t.icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

export function ObjectsPanel({ editor, state }: { editor: Editor; state: EditorState }) {
  const [renaming, setRenaming] = useState<string | null>(null);
  if (!state.objects.length) return <p className="px-3 py-6 text-center text-xs text-muted-foreground">No objects yet. Import a file or draw a shape.</p>;
  return (
    <ul className="py-1">
      {state.objects.map((o) => (
        <li
          key={o.id}
          className={cn("group flex items-center gap-1 px-2 py-1 text-xs", o.selected ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent/60")}
          onClick={(e) => editor.selectById(o.id, e.shiftKey)}
          onDoubleClick={() => setRenaming(o.id)}
        >
          {renaming === o.id ? (
            <input
              autoFocus
              defaultValue={o.name}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => {
                editor.setItemProps(o.id, { name: e.target.value });
                setRenaming(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setRenaming(null);
              }}
              className="h-5 min-w-0 flex-1 rounded border border-primary bg-background px-1 text-xs outline-none"
            />
          ) : (
            <span className={cn("min-w-0 flex-1 truncate", !o.visible && "opacity-50")} title={`${o.name} — double-click to rename`}>
              {o.name}
            </span>
          )}
          <button
            type="button"
            aria-label={o.visible ? "Hide" : "Show"}
            title={o.visible ? "Hide" : "Show"}
            onClick={(e) => {
              e.stopPropagation();
              editor.setItemProps(o.id, { visible: !o.visible });
            }}
            className="rounded p-0.5 hover:text-foreground"
          >
            {o.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            aria-label={o.locked ? "Unlock" : "Lock"}
            title={o.locked ? "Unlock" : "Lock"}
            onClick={(e) => {
              e.stopPropagation();
              editor.setItemProps(o.id, { locked: !o.locked });
            }}
            className={cn("rounded p-0.5 hover:text-foreground", o.locked && "text-amber-600")}
          >
            {o.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          </button>
        </li>
      ))}
    </ul>
  );
}

type AlignTarget = "selection" | "last" | "page";

export function AlignPanel({ editor, state }: { editor: Editor; state: EditorState }) {
  const [target, setTarget] = useState<AlignTarget>("selection");
  const canAlign = target === "page" ? state.selectionCount >= 1 : state.selectionCount >= 2;
  const canDistribute = state.selectionCount >= 3;
  const btn = (title: string, Icon: React.ComponentType<{ className?: string }>, onClick: () => void, enabled: boolean) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={!enabled}
      onClick={onClick}
      className="flex h-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-35"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
  return (
    <div className="space-y-3 p-3 text-xs">
      <div>
        <p className="mb-1.5 font-semibold text-foreground">Align to</p>
        <select value={target} onChange={(e) => setTarget(e.target.value as AlignTarget)} className="h-7 w-full rounded border border-border bg-background px-1.5 text-xs">
          <option value="selection">Selection bounds</option>
          <option value="last">Last selected object</option>
          <option value="page">Page</option>
        </select>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {btn("Align left", AlignStartVertical, () => editor.align("left", target), canAlign)}
        {btn("Align horizontal centers", AlignCenterVertical, () => editor.align("hcenter", target), canAlign)}
        {btn("Align right", AlignEndVertical, () => editor.align("right", target), canAlign)}
        {btn("Align top", AlignStartHorizontal, () => editor.align("top", target), canAlign)}
        {btn("Align vertical centers", AlignCenterHorizontal, () => editor.align("vcenter", target), canAlign)}
        {btn("Align bottom", AlignEndHorizontal, () => editor.align("bottom", target), canAlign)}
      </div>
      <div>
        <p className="mb-1.5 font-semibold text-foreground">Distribute (3+ objects)</p>
        <div className="grid grid-cols-2 gap-1.5">
          {btn("Equal horizontal spacing", AlignHorizontalSpaceAround, () => editor.distribute("h", "spacing"), canDistribute)}
          {btn("Equal vertical spacing", AlignVerticalSpaceAround, () => editor.distribute("v", "spacing"), canDistribute)}
          {btn("Distribute horizontal centers", AlignHorizontalDistributeCenter, () => editor.distribute("h", "centers"), canDistribute)}
          {btn("Distribute vertical centers", AlignVerticalDistributeCenter, () => editor.distribute("v", "centers"), canDistribute)}
        </div>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">Tip: select the S–XXXL pieces, align bottoms, then use equal horizontal spacing to lay them out in a row.</p>
    </div>
  );
}
