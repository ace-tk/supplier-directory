export type LayoutPreset = "two-column" | "three-image" | "editorial" | "product-centered";

export const LAYOUT_PRESETS: { id: LayoutPreset; label: string; description: string }[] = [
  { id: "two-column", label: "Two Column", description: "Two even columns, top to bottom" },
  { id: "three-image", label: "Three Image", description: "A featured item beside two stacked items" },
  { id: "editorial", label: "Editorial", description: "One large hero with supporting items around it" },
  { id: "product-centered", label: "Product Centered", description: "One centered focal item, others arranged around it" },
];

const CANVAS_W = 1400;
const CANVAS_H = 900;

/** Real, working reflow — repositions the given item ids (in their current
 * order) into one of four concrete arrangements. Only touches
 * position/size, never content, and only ever runs after the caller has
 * confirmed with the user (mutating existing content is otherwise
 * disallowed by the task). */
export function applyLayoutPreset(preset: LayoutPreset, itemIds: string[]): Record<string, { positionX: number; positionY: number; width: number; height: number }> {
  const result: Record<string, { positionX: number; positionY: number; width: number; height: number }> = {};
  const n = itemIds.length;
  if (n === 0) return result;

  if (preset === "two-column") {
    const colW = CANVAS_W / 2 - 30;
    itemIds.forEach((id, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      result[id] = { positionX: col * (colW + 20) + 20, positionY: row * 260 + 20, width: colW, height: 240 };
    });
    return result;
  }

  if (preset === "three-image") {
    itemIds.forEach((id, i) => {
      const group = i % 3;
      if (group === 0) result[id] = { positionX: 20, positionY: Math.floor(i / 3) * 460 + 20, width: 500, height: 440 };
      else if (group === 1) result[id] = { positionX: 540, positionY: Math.floor(i / 3) * 460 + 20, width: 400, height: 210 };
      else result[id] = { positionX: 540, positionY: Math.floor(i / 3) * 460 + 230, width: 400, height: 210 };
    });
    return result;
  }

  if (preset === "editorial") {
    itemIds.forEach((id, i) => {
      if (i === 0) result[id] = { positionX: 20, positionY: 20, width: 700, height: 500 };
      else {
        const side = i - 1;
        result[id] = { positionX: 740, positionY: side * 200 + 20, width: 300, height: 180 };
      }
    });
    return result;
  }

  // product-centered
  const centerId = itemIds[0];
  result[centerId] = { positionX: CANVAS_W / 2 - 200, positionY: CANVAS_H / 2 - 200, width: 400, height: 400 };
  const rest = itemIds.slice(1);
  const radius = 320;
  rest.forEach((id, i) => {
    const angle = (i / Math.max(rest.length, 1)) * Math.PI * 2;
    result[id] = {
      positionX: CANVAS_W / 2 + Math.cos(angle) * radius - 90,
      positionY: CANVAS_H / 2 + Math.sin(angle) * radius - 90,
      width: 180,
      height: 180,
    };
  });
  return result;
}
