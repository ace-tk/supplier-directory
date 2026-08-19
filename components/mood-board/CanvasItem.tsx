"use client";

import { useState } from "react";
import { Rnd } from "react-rnd";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MoodBoardItemRecord, MoodBoardItemContent } from "@/types/mood-board";

function TextContent({ content, editing, onCommit }: { content: Extract<MoodBoardItemContent, { kind: "text" }>; editing: boolean; onCommit: (c: MoodBoardItemContent) => void }) {
  const [value, setValue] = useState(content.text);
  if (editing) {
    return (
      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onCommit({ ...content, text: value })}
        onClick={(e) => e.stopPropagation()}
        className="w-full h-full p-3 resize-none outline-none bg-transparent"
        style={{ fontSize: content.fontSize ?? 18, color: content.color ?? "#111" }}
      />
    );
  }
  return (
    <div className="w-full h-full p-3 whitespace-pre-wrap overflow-hidden" style={{ fontSize: content.fontSize ?? 18, color: content.color ?? "#111" }}>
      {content.text || "Double-click to edit text"}
    </div>
  );
}

function NoteContent({ content, editing, onCommit }: { content: Extract<MoodBoardItemContent, { kind: "note" }>; editing: boolean; onCommit: (c: MoodBoardItemContent) => void }) {
  const [title, setTitle] = useState(content.title ?? "");
  const [bulletsText, setBulletsText] = useState(content.bullets.join("\n"));
  if (editing) {
    return (
      <div className="w-full h-full p-3 flex flex-col gap-1.5 bg-amber-50" onClick={(e) => e.stopPropagation()}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => onCommit({ ...content, title, bullets: bulletsText.split("\n").filter(Boolean) })}
          placeholder="Note title"
          className="font-semibold text-sm outline-none bg-transparent"
        />
        <textarea
          value={bulletsText}
          onChange={(e) => setBulletsText(e.target.value)}
          onBlur={() => onCommit({ ...content, title, bullets: bulletsText.split("\n").filter(Boolean) })}
          placeholder="One point per line"
          className="flex-1 text-xs outline-none resize-none bg-transparent"
        />
      </div>
    );
  }
  return (
    <div className="w-full h-full p-3 bg-amber-50 overflow-hidden">
      {content.title && <p className="font-semibold text-sm mb-1.5">{content.title}</p>}
      <ul className="space-y-1">
        {content.bullets.map((b, i) => (
          <li key={i} className="text-xs text-neutral-700 flex gap-1.5">
            <span>•</span> {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnnotationContent({ content, editing, onCommit }: { content: Extract<MoodBoardItemContent, { kind: "annotation" }>; editing: boolean; onCommit: (c: MoodBoardItemContent) => void }) {
  const [title, setTitle] = useState(content.title);
  const [description, setDescription] = useState(content.description);
  if (editing) {
    return (
      <div className="w-full h-full p-3 flex flex-col gap-1.5 bg-rose-50" onClick={(e) => e.stopPropagation()}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => onCommit({ ...content, title, description })}
          placeholder="Annotation title"
          className="font-semibold text-[11px] uppercase tracking-wide outline-none bg-transparent text-rose-700"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => onCommit({ ...content, title, description })}
          className="flex-1 text-xs outline-none resize-none bg-transparent"
        />
      </div>
    );
  }
  return (
    <div className="w-full h-full p-3 bg-rose-50 overflow-hidden">
      <p className="font-semibold text-[11px] uppercase tracking-wide text-rose-700 mb-1">{content.title}</p>
      <p className="text-xs text-neutral-700">{content.description}</p>
    </div>
  );
}

function renderContent(item: MoodBoardItemRecord, editing: boolean, onCommit: (c: MoodBoardItemContent) => void) {
  const content = item.content;
  if (!content) return <div className="w-full h-full bg-muted" />;

  switch (content.kind) {
    case "image":
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={content.src} alt="" className="w-full h-full object-cover select-none" draggable={false} />;
    case "text":
      return <TextContent content={content} editing={editing} onCommit={onCommit} />;
    case "note":
      return <NoteContent content={content} editing={editing} onCommit={onCommit} />;
    case "annotation":
      return <AnnotationContent content={content} editing={editing} onCommit={onCommit} />;
    case "material":
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-neutral-100">
          <div className="w-10 h-10 rounded-full bg-neutral-300" />
          <p className="text-xs font-medium text-neutral-700">{content.name}</p>
        </div>
      );
    case "swatch":
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1" style={{ backgroundColor: content.hex }}>
          {content.name && <p className="text-[10px] font-medium text-white/90 drop-shadow">{content.name}</p>}
        </div>
      );
    default:
      return null;
  }
}

export function CanvasItem({
  item,
  selected,
  scale,
  onSelect,
  onDragEnd,
  onResizeEnd,
  onDelete,
  onEditContent,
}: {
  item: MoodBoardItemRecord;
  selected: boolean;
  scale: number;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onResizeEnd: (width: number, height: number, x: number, y: number) => void;
  onDelete: () => void;
  onEditContent: (content: MoodBoardItemContent) => void;
}) {
  const [editing, setEditing] = useState(false);
  const editable = item.type === "TEXT" || item.type === "NOTE" || item.type === "ANNOTATION";

  return (
    <Rnd
      size={{ width: item.width, height: item.height }}
      position={{ x: item.positionX, y: item.positionY }}
      scale={scale}
      style={{ zIndex: selected ? 999 : item.zIndex }}
      onDragStart={() => onSelect()}
      onDragStop={(_e, d) => onDragEnd(d.x, d.y)}
      onResizeStop={(_e, _dir, ref, _delta, position) => onResizeEnd(ref.offsetWidth, ref.offsetHeight, position.x, position.y)}
      bounds="parent"
      enableResizing={selected}
      disableDragging={editing}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (editable) setEditing(true);
        }}
        className={cn(
          "relative w-full h-full rounded-lg overflow-hidden bg-white border shadow-sm",
          selected ? "border-primary ring-2 ring-primary/30" : "border-border"
        )}
      >
        {renderContent(
          item,
          editing,
          (content) => {
            setEditing(false);
            onEditContent(content);
          }
        )}
        {selected && !editing && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center z-10 hover:bg-red-600"
            aria-label="Delete item"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </Rnd>
  );
}
