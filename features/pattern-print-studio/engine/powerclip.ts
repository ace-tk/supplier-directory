import type paper from "paper/dist/paper-core";
import type { RepeatSettings } from "./repeat";

type PaperScope = typeof paper;
type Item = paper.Item;

/**
 * PowerClip (CorelDRAW's "place inside frame"): a print shown only inside a
 * pattern outline. Nothing is cut — the clip only hides what is outside.
 *
 * On the canvas a PowerClip is a Group (data.pc = settings) with:
 *   [clip group]  data.pcClip — a clipped Group: [mask, ...contents]
 *   [tile holder] data.pcTile — only with Repeat fill: the one tile's artwork, kept hidden;
 *                 the clip group then holds generated copies of it (data.pcRepeat)
 *   [frame]       the real outline, the same path the Shape tool edits
 * The mask is a generated copy of the frame (data.derived) and is never
 * saved; only the frame, the contents and the settings are.
 */
export interface PowerClipSettings {
  /** Contents move, rotate and scale with the frame. Off: the frame moves and the print stays. */
  lock: boolean;
  /** Repeat fill: the contents are ONE tile, repeated to cover the frame. Only these numbers are saved, never the tiles. */
  repeat?: RepeatSettings;
}

export const DEFAULT_CLIP: PowerClipSettings = { lock: true };

export const isPowerClip = (item: Item | null | undefined): item is paper.Group => !!item && !!item.data?.pc;

export const clipGroupOf = (pc: Item) => pc.children.find((c) => c.data?.pcClip) as paper.Group;

/** The outline. Looked up by role, not position: the Shape tool may replace it (path ⇄ compound path). */
export const frameOf = (pc: Item) => pc.children.find((c) => !c.data?.pcClip && !c.data?.pcTile && !c.data?.derived) as paper.Path | paper.CompoundPath;

/** With Repeat fill: the hidden group holding the tile's artwork. */
export const tileHolderOf = (pc: Item) => (pc.children.find((c) => c.data?.pcTile) as paper.Group | undefined) ?? null;

/** The prints inside, bottom to top (with Repeat fill: the artwork of the one tile). */
export const contentsOf = (pc: Item): Item[] => {
  const holder = tileHolderOf(pc);
  return holder ? [...holder.children] : clipGroupOf(pc).children.filter((c) => !c.data?.derived);
};

/** True for generated helpers (clip mask, edit-mode veil) that are not part of the document. */
export const isDerived = (item: Item | null | undefined) => !!item?.data?.derived;

/** The PowerClip an item belongs to (as its frame or inside its contents), or the item itself if it is one. */
export function clipOwner(item: Item | null | undefined): paper.Group | null {
  for (let it = item; it; it = it.parent) if (isPowerClip(it)) return it;
  return null;
}

/** True if the item is (inside) the contents of a PowerClip rather than a frame or a free object. */
export function insideClipContents(item: Item | null | undefined): boolean {
  for (let it = item; it; it = it.parent) if (it.data?.pcClip || it.data?.pcTile) return true;
  return false;
}

/**
 * Moves the contents between the clip group (a normal print) and the hidden
 * tile holder (Repeat fill), to match the PowerClip's settings. The
 * generated tiles themselves are built by the editor, which knows the view.
 */
export function syncRepeatHolder(ps: PaperScope, pc: Item) {
  const clip = clipGroupOf(pc);
  const holder = tileHolderOf(pc);
  const wanted = !!pc.data.pc.repeat;
  if (wanted && !holder) {
    const h = new ps.Group({ insert: false });
    h.data = { pcTile: true };
    h.addChildren(clip.children.filter((c) => !c.data?.derived));
    h.visible = false;
    h.insertAbove(clip);
  } else if (!wanted && holder) {
    for (const c of [...clip.children]) if (c.data?.pcRepeat) c.remove();
    clip.addChildren([...holder.children]);
    holder.remove();
    syncMask(ps, pc, clip.clipped);
  }
}

/** Only closed paths can be frames. */
export function isClosedOutline(ps: PaperScope, item: Item): boolean {
  if (item instanceof ps.CompoundPath) return item.children.length > 0 && (item.children as paper.Path[]).every((c) => c.closed);
  return item instanceof ps.Path && item.closed && item.segments.length > 1;
}

/**
 * Rebuilds the clip mask from the frame's current geometry. Call after the
 * frame is edited or moved on its own. `clipped` is false while the contents
 * are being edited (the whole print is shown).
 */
export function syncMask(ps: PaperScope, pc: Item, clipped = true) {
  const clip = clipGroupOf(pc);
  const frame = frameOf(pc);
  if (!clip || !frame) return;
  clip.clipped = false;
  for (const c of [...clip.children]) if (c.data?.pcMask) c.remove();
  const mask = frame.clone({ insert: false, deep: true });
  mask.data = { derived: true, pcMask: true };
  for (const c of mask.children ?? []) c.data = {};
  mask.name = "";
  mask.visible = true;
  mask.locked = false;
  mask.fillColor = null;
  mask.strokeColor = null;
  clip.insertChild(0, mask);
  clip.clipped = clipped;
}

/** Builds a PowerClip from an outline and prints (none of them inserted). */
export function assemblePowerClip(ps: PaperScope, frame: Item, contents: Item[], settings: PowerClipSettings): paper.Group {
  const pc = new ps.Group({ insert: false });
  pc.data = { pc: { ...settings } };
  const clip = new ps.Group({ insert: false });
  clip.data = { pcClip: true };
  clip.addChildren(contents);
  pc.addChild(clip);
  pc.addChild(frame);
  syncMask(ps, pc);
  syncRepeatHolder(ps, pc);
  return pc;
}

/**
 * Turns an outline that is already on the page into a PowerClip holding
 * `contents`, in the outline's own place (also inside a group). The prints
 * keep their exact position and size.
 */
export function wrapInPowerClip(ps: PaperScope, frame: Item, contents: Item[], settings: PowerClipSettings): paper.Group {
  const pc = new ps.Group({ insert: false });
  pc.data = { pc: { ...settings } };
  frame.parent.insertChild(frame.index, pc);
  const clip = new ps.Group({ insert: false });
  clip.data = { pcClip: true };
  pc.addChild(clip);
  clip.addChildren(contents);
  pc.addChild(frame);
  syncMask(ps, pc);
  syncRepeatHolder(ps, pc);
  return pc;
}

/** Extract contents: the prints come back out as normal objects, in place, above the outline. The PowerClip is removed. */
export function unwrapPowerClip(pc: Item): { frame: Item; contents: Item[] } {
  const frame = frameOf(pc);
  const contents = contentsOf(pc);
  frame.insertAbove(pc);
  let above: Item = frame;
  for (const c of contents) {
    c.insertAbove(above);
    above = c;
  }
  pc.remove();
  return { frame, contents };
}
