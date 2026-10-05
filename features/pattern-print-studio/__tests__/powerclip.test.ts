import paper from "paper/dist/paper-core";
import { beforeEach, describe, expect, it } from "vitest";
import type { DocFile } from "../engine/Editor";
import { exportSvg } from "../engine/export-svg";
import { assemblePowerClip, clipGroupOf, clipOwner, contentsOf, DEFAULT_CLIP, frameOf, insideClipContents, isClosedOutline, isPowerClip, syncMask, unwrapPowerClip, wrapInPowerClip } from "../engine/powerclip";
import { collectAssetIds, fromNode, toNode, type PowerClipNode, type SceneNode } from "../engine/serialize";
import { DEFAULT_PAGE, DEFAULT_SETTINGS } from "../engine/types";

let ps: paper.PaperScope;
beforeEach(() => {
  ps = new paper.PaperScope();
  ps.setup(new ps.Size(100, 100));
});

function outline(): paper.Path {
  const p = new ps.Path({ insert: true });
  p.moveTo(new ps.Point(2, 1.65));
  p.cubicCurveTo(new ps.Point(4.7, 1.45), new ps.Point(7.5, 1.1), new ps.Point(10.3, 0.9));
  p.lineTo(new ps.Point(8, 29.9));
  p.lineTo(new ps.Point(4.2, 29.9));
  p.closePath();
  p.strokeColor = new ps.Color("#2b2a29");
  p.strokeWidth = 0.00762;
  p.data.id = "front";
  p.name = "S-Front";
  return p;
}
function print(): paper.Path {
  const c = new ps.Path.Circle({ center: [6, 12], radius: 9 });
  c.fillColor = new ps.Color("#e63946");
  c.data.id = "print";
  return c;
}
const geometry = (p: paper.Path) => p.segments.map((s) => [s.point.x, s.point.y, s.handleIn.x, s.handleIn.y, s.handleOut.x, s.handleOut.y]);

describe("PowerClip", () => {
  it("placing a print inside an outline moves neither of them", () => {
    const frame = outline();
    const art = print();
    const frameBefore = geometry(frame);
    const artBefore = geometry(art);
    const pc = wrapInPowerClip(ps, frame, [art], DEFAULT_CLIP);
    expect(isPowerClip(pc)).toBe(true);
    expect(frameOf(pc)).toBe(frame);
    expect(contentsOf(pc)).toEqual([art]);
    expect(geometry(frame)).toEqual(frameBefore);
    expect(geometry(art)).toEqual(artBefore);
    // It takes the outline's place on the page.
    expect(pc.parent).toBe(ps.project.activeLayer);
    expect(clipOwner(art)).toBe(pc);
    expect(clipOwner(frame)).toBe(pc);
    expect(insideClipContents(art)).toBe(true);
    expect(insideClipContents(frame)).toBe(false);
  });

  it("the clip is a generated copy of the outline and hides what is outside", () => {
    const frame = outline();
    const pc = wrapInPowerClip(ps, frame, [print()], DEFAULT_CLIP);
    const clip = clipGroupOf(pc);
    const mask = clip.children[0] as paper.Path;
    expect(clip.clipped).toBe(true);
    expect(mask.clipMask).toBe(true);
    expect(mask.data.derived).toBe(true);
    expect(geometry(mask)).toEqual(geometry(frame));
    // The whole PowerClip is only as big as its outline, though the print is larger.
    expect(pc.bounds.width).toBeCloseTo(frame.bounds.width, 9);
    expect(contentsOf(pc)[0].bounds.width).toBeGreaterThan(frame.bounds.width);
  });

  it("the clip follows the outline after a node edit", () => {
    const frame = outline();
    const pc = wrapInPowerClip(ps, frame, [print()], DEFAULT_CLIP);
    frame.segments[2].point = frame.segments[2].point.add(new ps.Point(1.25, -0.5));
    syncMask(ps, pc);
    expect(geometry(clipGroupOf(pc).children[0] as paper.Path)).toEqual(geometry(frame));
    expect(clipGroupOf(pc).children.filter((c) => c.data.pcMask).length).toBe(1);
  });

  it("serialize → deserialize gives the same PowerClip, and saves no generated parts", () => {
    const frame = outline();
    frame.data.nt = "cccc";
    const text = new ps.PointText({ point: [3, 4], content: "XL", fontFamily: "Arimo", fontSize: 1.5 });
    text.fillColor = new ps.Color("#000000");
    text.data.id = "label";
    const pc = wrapInPowerClip(ps, frame, [print(), text], { lock: false });
    pc.data.id = "pc1";
    pc.name = "S-Front";
    const group = new ps.Group({ children: [pc] });
    group.data.id = "size_s";

    const first = toNode(ps, group) as SceneNode;
    const json = JSON.stringify(first);
    expect(json).not.toMatch(/derived|pcMask|pcClip/);
    const node = (first as { children: SceneNode[] }).children[0] as PowerClipNode;
    expect(node.t).toBe("powerclip");
    expect(node.pc).toEqual({ lock: false });
    expect(node.frame.t).toBe("path");
    expect(node.contents.map((c) => c.t)).toEqual(["path", "text"]);

    const copy = fromNode(ps, JSON.parse(json), () => null)!;
    expect(toNode(ps, copy)).toEqual(first);
    const pc2 = copy.children[0];
    expect(isPowerClip(pc2)).toBe(true);
    expect(clipGroupOf(pc2).clipped).toBe(true);
    expect(geometry(frameOf(pc2) as paper.Path)).toEqual(geometry(frame));
    expect(geometry(clipGroupOf(pc2).children[0] as paper.Path)).toEqual(geometry(frame));
    expect(frameOf(pc2).data.nt).toBe("cccc");
  });

  it("extract puts the outline and the print back as normal objects, in place", () => {
    const frame = outline();
    const art = print();
    const before = [geometry(frame), geometry(art)];
    const pc = wrapInPowerClip(ps, frame, [art], DEFAULT_CLIP);
    const out = unwrapPowerClip(pc);
    expect(out.frame).toBe(frame);
    expect(out.contents).toEqual([art]);
    expect(pc.isInserted()).toBe(false);
    expect(frame.parent).toBe(ps.project.activeLayer);
    expect(art.parent).toBe(ps.project.activeLayer);
    expect(art.index).toBeGreaterThan(frame.index);
    expect([geometry(frame), geometry(art)]).toEqual(before);
  });

  it("locked contents move with the PowerClip", () => {
    const pc = assemblePowerClip(ps, outline(), [print()], DEFAULT_CLIP);
    ps.project.activeLayer.addChild(pc);
    const x = contentsOf(pc)[0].position.x;
    const fx = frameOf(pc).bounds.x;
    pc.translate(new ps.Point(3, 0));
    expect(contentsOf(pc)[0].position.x).toBeCloseTo(x + 3, 12);
    expect(frameOf(pc).bounds.x).toBeCloseTo(fx + 3, 12);
    expect(clipGroupOf(pc).children[0].bounds.x).toBeCloseTo(fx + 3, 12);
  });

  it("only closed outlines can be frames", () => {
    expect(isClosedOutline(ps, outline())).toBe(true);
    expect(isClosedOutline(ps, new ps.Path({ segments: [[0, 0], [1, 0], [1, 1]] }))).toBe(false);
    const holed = new ps.CompoundPath({ children: [new ps.Path.Circle(new ps.Point(0, 0), 2), new ps.Path.Circle(new ps.Point(0, 0), 1)] });
    expect(isClosedOutline(ps, holed)).toBe(true);
    expect(isClosedOutline(ps, new ps.PointText({ point: [0, 0], content: "S" }))).toBe(false);
  });

  it("asset ids inside a PowerClip are found, so its images are saved with the document", () => {
    const nodes: SceneNode[] = [{ t: "powerclip", pc: { lock: true }, frame: { t: "path", closed: true, segs: [] }, contents: [{ t: "raster", assetId: "a1", matrix: [1, 0, 0, 1, 0, 0], width: 10, height: 10 }] }];
    expect([...collectAssetIds(nodes)]).toEqual(["a1"]);
  });

  it("SVG export writes the print clipped by the outline, with the outline on top", () => {
    const pc = wrapInPowerClip(ps, outline(), [print()], DEFAULT_CLIP);
    pc.data.id = "pc1";
    const doc: DocFile = { format: "supplybase.pattern-print-studio", version: 2, name: "t", page: DEFAULT_PAGE, settings: DEFAULT_SETTINGS, origin: { x: 0, y: 0 }, originAtPageCorner: true, guides: [], objects: [toNode(ps, pc)!], assets: [] };
    const svg = exportSvg(doc);
    expect(svg).toMatch(/<clipPath id="clip1"><path d="M2,1\.65C/);
    expect(svg).toMatch(/<g clip-path="url\(#clip1\)">\s*<path id="print"/);
    // …then the outline itself, after the clipped print.
    expect(svg.indexOf('<path id="front"')).toBeGreaterThan(svg.indexOf("clip-path="));
  });
});
