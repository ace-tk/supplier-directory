"use client";

import { CanvasItem } from "./CanvasItem";
import type { MoodBoardItemRecord, MoodBoardItemContent } from "@/types/mood-board";

export const CANVAS_WIDTH = 1400;
export const CANVAS_HEIGHT = 900;

export function MoodBoardCanvas({
  items,
  palette,
  selectedItemId,
  zoom,
  onSelect,
  onDeselect,
  onDragEnd,
  onResizeEnd,
  onDelete,
  onEditContent,
}: {
  items: MoodBoardItemRecord[];
  palette: string[];
  selectedItemId: string | null;
  zoom: number;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onResizeEnd: (id: string, width: number, height: number, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onEditContent: (id: string, content: MoodBoardItemContent) => void;
}) {
  return (
    <div className="flex-1 overflow-auto bg-[#f0eeea]" onClick={onDeselect}>
      <div
        className="relative mx-auto my-8 bg-white shadow-sm origin-top"
        style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, transform: `scale(${zoom})` }}
      >
        {items.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm pointer-events-none">
            Add images, text, or notes from the left panel to start your board
          </div>
        )}
        {items.map((item) => (
          <CanvasItem
            key={item.id}
            item={item}
            selected={item.id === selectedItemId}
            scale={zoom}
            onSelect={() => onSelect(item.id)}
            onDragEnd={(x, y) => onDragEnd(item.id, x, y)}
            onResizeEnd={(w, h, x, y) => onResizeEnd(item.id, w, h, x, y)}
            onDelete={() => onDelete(item.id)}
            onEditContent={(content) => onEditContent(item.id, content)}
          />
        ))}

        {palette.length > 0 && (
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg border border-border px-3 py-2 flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Color story</span>
            <div className="flex items-center gap-1">
              {palette.map((hex) => (
                <span key={hex} className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: hex }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
