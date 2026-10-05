import paper from "paper/dist/paper-core";
import { beforeEach, describe, expect, it } from "vitest";
import type { DocFile } from "../engine/Editor";
import { exportSvg } from "../engine/export-svg";
import { clipGroupOf, contentsOf, DEFAULT_CLIP, tileHolderOf, wrapInPowerClip, syncRepeatHolder } from "../engine/powerclip";
import { applyAffine, cellMatrix, cellPosition, coverInRepeatSpace, defaultRepeat, deltaInRepeatSpace, repeatCells, repeatSteps, type RepeatSettings } from "../engine/repeat";
import { fromNode, toNode, type PowerClipNode } from "../engine/serialize";
import { DEFAULT_PAGE, DEFAULT_SETTINGS } from "../engine/types";

let ps: paper.PaperScope;
beforeEach(() => {
  ps = new paper.PaperScope();
  ps.setup(new ps.Size(100, 100));
});

const tile = { x: 10, y: 20, w: 2, h: 2 };
const origin = { x: tile.x, y: tile.y };
const base = (patch: Partial<RepeatSettings> = {}): RepeatSettings => ({ ...defaultRepeat(2, 2), ...patch });
const cover = { x: 0, y: 0, w: 30, h: 40 };
const at = (cells: ReturnType<typeof repeatCells>, i: number, j: number) => cells.find((c) => c.i === i && c.j === j)!;

describe("repeat tile positions", () => {
  it("straight: a plain grid; tile (0,0) sits exactly on the original tile", () => {
    const cells = repeatCells(base(), origin, cover);
    expect(at(cells, 0, 0)).toMatchObject({ x: 10, y: 20, flipX: false, flipY: false });
    expect(at(cells, 1, 0)).toMatchObject({ x: 12, y: 20 });
    expect(at(cells, 0, 1)).toMatchObject({ x: 10, y: 22 });
    expect(at(cells, -3, -2)).toMatchObject({ x: 4, y: 16 });
    expect(cells.every((c) => !c.flipX && !c.flipY)).toBe(true);
  });

  it("half-drop: every other COLUMN drops by half a tile", () => {
    const cells = repeatCells(base({ type: "half-drop" }), origin, cover);
    expect(at(cells, 0, 0).y).toBe(20);
    expect(at(cells, 1, 0).y).toBe(21);
    expect(at(cells, 2, 0).y).toBe(20);
    expect(at(cells, -1, 0).y).toBe(21);
    expect(at(cells, 1, 0).x).toBe(12);
  });

  it("half-brick: every other ROW shifts sideways by half a tile", () => {
    const cells = repeatCells(base({ type: "half-brick" }), origin, cover);
    expect(at(cells, 0, 0).x).toBe(10);
    expect(at(cells, 0, 1).x).toBe(11);
    expect(at(cells, 0, 2).x).toBe(10);
    expect(at(cells, 0, -1).x).toBe(11);
    expect(at(cells, 0, 1).y).toBe(22);
  });

  it("mirror: alternate tiles are flipped, so neighbours always meet edge to edge", () => {
    const r = base({ type: "mirror" });
    const cells = repeatCells(r, origin, cover);
    expect(at(cells, 0, 0)).toMatchObject({ flipX: false, flipY: false });
    expect(at(cells, 1, 0)).toMatchObject({ flipX: true, flipY: false });
    expect(at(cells, 0, 1)).toMatchObject({ flipX: false, flipY: true });
    expect(at(cells, 1, 1)).toMatchObject({ flipX: true, flipY: true });
    // The tile's RIGHT edge lands on the shared edge from both sides.
    const right = applyAffine(cellMatrix(r, tile, at(cells, 0, 0)), tile.x + tile.w, tile.y);
    const mirrored = applyAffine(cellMatrix(r, tile, at(cells, 1, 0)), tile.x + tile.w, tile.y);
    expect(right.x).toBeCloseTo(12, 12);
    expect(mirrored.x).toBeCloseTo(12, 12);
  });

  it("positions come straight from i and j (no accumulated error) and cover the whole area", () => {
    const r = base({ tileW: 0.3, tileH: 0.7, gapX: 0.1, gapY: 0 });
    expect(cellPosition(r, origin, 1000, 1000)).toEqual({ x: 10 + 1000 * 0.4, y: 20 + 1000 * 0.7 });
    const cells = repeatCells(r, origin, cover);
    const xs = cells.map((c) => c.x);
    const ys = cells.map((c) => c.y);
    expect(Math.min(...xs)).toBeLessThanOrEqual(cover.x);
    expect(Math.max(...xs) + 0.3).toBeGreaterThanOrEqual(cover.x + cover.w);
    expect(Math.min(...ys)).toBeLessThanOrEqual(cover.y);
    expect(Math.max(...ys) + 0.7).toBeGreaterThanOrEqual(cover.y + cover.h);
    // No tile is listed twice.
    expect(new Set(cells.map((c) => `${c.i},${c.j}`)).size).toBe(cells.length);
  });

  it("spacing, offset and scale", () => {
    const r = base({ gapX: 0.5, gapY: -0.25, offsetX: 0.3, offsetY: -0.1, scale: 150 });
    expect(repeatSteps(r)).toEqual({ tw: 3, th: 3, stepX: 3.75, stepY: 2.625 });
    expect(cellPosition(r, origin, 0, 0)).toEqual({ x: 10.3, y: 19.9 });
    expect(cellPosition(r, origin, 2, 1)).toEqual({ x: 10.3 + 7.5, y: 19.9 + 2.625 });
    // A huge negative gap cannot make the step zero or negative.
    expect(repeatSteps(base({ gapX: -50 })).stepX).toBeCloseTo(0.1, 12);
  });

  it("the tile is drawn at the tile size, seamlessly: each tile ends exactly where the next begins", () => {
    const r = base({ tileW: 1.5, tileH: 0.75 });
    const cells = repeatCells(r, origin, cover);
    const a = cellMatrix(r, tile, at(cells, 3, 2));
    const b = cellMatrix(r, tile, at(cells, 4, 2));
    const aRight = applyAffine(a, tile.x + tile.w, tile.y + tile.h);
    const bLeft = applyAffine(b, tile.x, tile.y);
    expect(aRight.x).toBeCloseTo(bLeft.x, 12);
    expect(aRight.x - applyAffine(a, tile.x, tile.y).x).toBeCloseTo(1.5, 12);
    expect(aRight.y - applyAffine(a, tile.x, tile.y).y).toBeCloseTo(0.75, 12);
  });

  it("rotation turns the whole repeat about the tile's centre, counter-clockwise", () => {
    const r = base({ rotation: 90 });
    const cells = repeatCells(r, origin, coverInRepeatSpace(r, tile, cover));
    const m = cellMatrix(r, tile, at(cells, 1, 0));
    // The tile to the RIGHT in the repeat's own axes ends up ABOVE on the page (y is down).
    const c = applyAffine(m, tile.x + 1, tile.y + 1);
    expect(c.x).toBeCloseTo(11, 9);
    expect(c.y).toBeCloseTo(19, 9);
    // Tile (0,0) does not move.
    const c0 = applyAffine(cellMatrix(r, tile, at(cells, 0, 0)), tile.x + 1, tile.y + 1);
    expect(c0.x).toBeCloseTo(11, 9);
    expect(c0.y).toBeCloseTo(21, 9);
    // Dragging right on the page moves "up the columns" of a repeat turned 90°.
    const d = deltaInRepeatSpace(r, 1, 0);
    expect(d.x).toBeCloseTo(0, 12);
    expect(d.y).toBeCloseTo(1, 12);
  });
});

describe("repeat fill in a PowerClip", () => {
  const setup = (repeat: RepeatSettings) => {
    const frame = new ps.Path.Rectangle({ rectangle: new ps.Rectangle(0, 0, 10, 30) });
    frame.data.id = "front";
    const art = new ps.Path.Rectangle({ rectangle: new ps.Rectangle(4, 4, 2, 2) });
    art.fillColor = new ps.Color("#1d3557");
    art.data.id = "tile";
    const pc = wrapInPowerClip(ps, frame, [art], { ...DEFAULT_CLIP, repeat });
    pc.data.id = "pc";
    return { pc, art };
  };

  it("keeps ONE tile (hidden) and saves only the settings — never the generated tiles", () => {
    const { pc, art } = setup({ ...defaultRepeat(2, 2), type: "half-drop", gapX: 0.25 });
    const holder = tileHolderOf(pc)!;
    expect(holder.visible).toBe(false);
    expect(contentsOf(pc)).toEqual([art]);
    // Pretend the editor generated tiles for the view.
    const rep = new ps.Group({ insert: false });
    rep.data = { derived: true, pcRepeat: true };
    for (let i = 0; i < 500; i++) rep.addChild(new ps.Path.Rectangle({ rectangle: new ps.Rectangle(i, 0, 1, 1) }));
    clipGroupOf(pc).insertChild(1, rep);

    const node = toNode(ps, pc) as PowerClipNode;
    const json = JSON.stringify(node);
    expect(node.contents.length).toBe(1);
    expect(node.pc.repeat).toMatchObject({ type: "half-drop", tileW: 2, tileH: 2, gapX: 0.25 });
    expect(node.tile).toEqual([4, 4, 2, 2]);
    expect(json).not.toMatch(/pcRepeat|derived|pcTile/);
    expect(json.length).toBeLessThan(900); // tiny, however many tiles are on screen

    const copy = fromNode(ps, JSON.parse(json), () => null)!;
    expect(toNode(ps, copy)).toEqual(node);
    expect(tileHolderOf(copy)!.visible).toBe(false);
  });

  it("turning repeat off puts the single print back inside the frame", () => {
    const { pc, art } = setup(defaultRepeat(2, 2));
    const { repeat: _r, ...rest } = pc.data.pc;
    void _r;
    pc.data.pc = rest;
    syncRepeatHolder(ps, pc);
    expect(tileHolderOf(pc)).toBeNull();
    expect(art.parent).toBe(clipGroupOf(pc));
    expect(clipGroupOf(pc).clipped).toBe(true);
    expect(art.bounds.x).toBe(4);
  });

  it("SVG export writes the tile once and places it with <use> across the frame", () => {
    const { pc } = setup({ ...defaultRepeat(2, 2), type: "half-brick" });
    const doc: DocFile = { format: "supplybase.pattern-print-studio", version: 2, name: "t", page: DEFAULT_PAGE, settings: DEFAULT_SETTINGS, origin: { x: 0, y: 0 }, originAtPageCorner: true, guides: [], objects: [toNode(ps, pc)!], assets: [] };
    const svg = exportSvg(doc);
    expect(svg.match(/<g id="tile1">/g)?.length).toBe(1);
    const uses = svg.match(/<use href="#tile1"/g)?.length ?? 0;
    // A 10 × 30 frame needs at least 5 × 15 two-inch tiles.
    expect(uses).toBeGreaterThanOrEqual(75);
    expect(uses).toBeLessThan(200);
    expect(svg).toMatch(/<clipPath id="clip1">/);
  });
});
