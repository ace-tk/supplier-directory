import { describe, expect, it } from "vitest";
import paper from "paper/dist/paper-core";
import { applyRigid, distToPolygon, edgeBetweenCorners, offsetOutline, offsetPolygon, pointInPolygon, polygonArea, seamTransform, selfIntersects, unrotate, type Pt } from "../engine/bleed";
import { assemblePowerClip, bleedOutline, clipGroupOf, setViewBleed } from "../engine/powerclip";

const bounds = (p: Pt[]) => ({ minX: Math.min(...p.map((q) => q.x)), maxX: Math.max(...p.map((q) => q.x)), minY: Math.min(...p.map((q) => q.y)), maxY: Math.max(...p.map((q) => q.y)) });

/** Every point of the offset is `d` from the shape (never closer), and the shape is inside it. */
function expectTrueOffset(shape: Pt[], out: Pt[], d: number, slack = 0.003) {
  for (const q of out) {
    const dist = distToPolygon(q, shape);
    expect(dist).toBeGreaterThan(d - 1e-6);
    expect(dist).toBeLessThan(d + slack);
  }
  for (const q of shape) expect(pointInPolygon(q, out)).toBe(true);
  expect(selfIntersects(out)).toBe(false);
}

describe("bleed offset", () => {
  const rect: Pt[] = [
    { x: 2, y: 1 },
    { x: 12, y: 1 },
    { x: 12, y: 31 },
    { x: 2, y: 31 },
  ];

  it("a rectangle grows by exactly the bleed on every side, with round corners", () => {
    const out = offsetPolygon(rect, 0.25);
    const b = bounds(out);
    expect(b.minX).toBeCloseTo(1.75, 9);
    expect(b.maxX).toBeCloseTo(12.25, 9);
    expect(b.minY).toBeCloseTo(0.75, 9);
    expect(b.maxY).toBeCloseTo(31.25, 9);
    expectTrueOffset(rect, out, 0.25);
    // area = rectangle + four side strips + a full circle's worth of corners (within the arc tolerance)
    expect(Math.abs(polygonArea(out))).toBeCloseTo(300 + 2 * (10 + 30) * 0.25 + Math.PI * 0.25 * 0.25, 2);
  });

  it("works whichever way round the outline is drawn", () => {
    const a = bounds(offsetPolygon(rect, 0.25));
    const b = bounds(offsetPolygon([...rect].reverse(), 0.25));
    expect(b.minX).toBeCloseTo(a.minX, 9);
    expect(b.maxY).toBeCloseTo(a.maxY, 9);
  });

  it("an inside corner meets at its exact mitre point — no loop, no notch", () => {
    // An L shape; the inside corner is at (6, 6).
    const L: Pt[] = [
      { x: 0, y: 0 },
      { x: 12, y: 0 },
      { x: 12, y: 6 },
      { x: 6, y: 6 },
      { x: 6, y: 12 },
      { x: 0, y: 12 },
    ];
    const { points, bridged } = offsetOutline(L, 0.25);
    expect(bridged).toBe(0);
    expect(points.some((p) => Math.abs(p.x - 6.25) < 1e-9 && Math.abs(p.y - 6.25) < 1e-9)).toBe(true);
    for (const q of points) expect(distToPolygon(q, L)).toBeGreaterThan(0.25 - 1e-6);
    for (const q of L) expect(pointInPolygon(q, points)).toBe(true);
    expect(selfIntersects(points)).toBe(false);
  });

  it("a curved, legging-like outline (inside and outside curves) offsets cleanly", () => {
    // A leg: waist at the top, curved hip and inseam, narrow ankle — as a fine polyline.
    const leg: Pt[] = [];
    const N = 120;
    for (let i = 0; i <= N; i++) {
      const t = i / N; // down the outer side
      leg.push({ x: 5.2 + 1.1 * Math.sin(t * Math.PI) * (1 - t) - 2.4 * t * t, y: 30 * t });
    }
    for (let i = 0; i <= N; i++) {
      const t = 1 - i / N; // back up the inseam, with a crotch curve near the top
      leg.push({ x: -5.2 - 1.6 * Math.exp(-((t - 0.28) ** 2) / 0.004) + 2.3 * t * t, y: 30 * t });
    }
    expect(selfIntersects(leg)).toBe(false);
    for (const d of [0.125, 0.25, 0.5]) {
      const out = offsetPolygon(leg, d);
      expectTrueOffset(leg, out, d, 0.004);
      const a = bounds(leg);
      const b = bounds(out);
      expect(b.minY).toBeCloseTo(a.minY - d, 3);
      expect(b.maxY).toBeCloseTo(a.maxY + d, 3);
      expect(b.minX).toBeGreaterThan(a.minX - d - 1e-9);
      expect(b.minX).toBeLessThan(a.minX - d + 0.01);
    }
  });

  it("a slot narrower than twice the bleed is simply filled, without the boundary crossing itself", () => {
    // A block with a 0.3-wide slot cut 4 deep into its top edge.
    const slot: Pt[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 6 },
      { x: 5.15, y: 6 },
      { x: 5.15, y: 2 },
      { x: 4.85, y: 2 },
      { x: 4.85, y: 6 },
      { x: 0, y: 6 },
    ];
    const { points, bridged } = offsetOutline(slot, 0.25);
    expect(bridged).toBeGreaterThan(0);
    expect(selfIntersects(points)).toBe(false);
    for (const q of points) expect(distToPolygon(q, slot)).toBeGreaterThan(0.25 - 1e-5);
    for (const q of slot) expect(pointInPolygon(q, points) || distToPolygon(q, points) < 1e-6).toBe(true);
    // nothing of the offset boundary is left down inside the slot
    expect(points.every((p) => !(p.x > 4.86 && p.x < 5.14 && p.y < 5.9))).toBe(true);
  });

  it("an inward offset shrinks a hole, and a hole smaller than the bleed disappears", () => {
    const hole: Pt[] = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 0, y: 2 },
    ];
    const b = bounds(offsetPolygon(hole, 0.25, { inward: true }));
    expect([b.minX, b.maxX, b.minY, b.maxY].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0.25, 3.75, 0.25, 1.75]);
    expect(offsetPolygon(hole, 1.2, { inward: true })).toEqual([]);
  });

  it("zero bleed leaves the outline alone", () => {
    expect(offsetPolygon(rect, 0)).toEqual(rect);
  });
});

describe("bleed on a PowerClip", () => {
  const ps = new paper.PaperScope();
  ps.setup(new ps.Size(100, 100));

  it("the clip is the outline grown by the bleed; the outline itself (the cut line) does not move", () => {
    const frame = new ps.Path.Ellipse({ center: [10, 20], size: [8, 30], insert: false });
    const before = frame.pathData;
    const print = new ps.Path.Rectangle({ point: [0, 0], size: [40, 40], insert: false });
    setViewBleed(ps, { amount: 0.25, visible: true });
    const pc = assemblePowerClip(ps, frame, [print], { lock: true });
    const mask = clipGroupOf(pc).children[0];
    expect(mask.data.pcMask).toBe(true);
    expect(mask.bounds.width).toBeCloseTo(8.5, 2);
    expect(mask.bounds.height).toBeCloseTo(30.5, 2);
    expect(mask.bounds.center.x).toBeCloseTo(10, 6);
    expect(frame.pathData).toBe(before);
    expect(frame.bounds.width).toBeCloseTo(8, 9);

    // per-piece override
    const pc2 = assemblePowerClip(ps, frame.clone({ insert: false }), [print.clone({ insert: false })], { lock: true, bleed: 0.5 });
    expect(clipGroupOf(pc2).children[0].bounds.width).toBeCloseTo(9, 2);

    // bleed hidden on screen: the clip is the outline itself again
    setViewBleed(ps, { amount: 0.25, visible: false });
    const pc3 = assemblePowerClip(ps, frame.clone({ insert: false }), [print.clone({ insert: false })], { lock: true });
    expect(clipGroupOf(pc3).children[0].bounds.width).toBeCloseTo(8, 9);
    setViewBleed(ps, { amount: 0, visible: true });
  });

  it("an outline with a hole: the outside grows and the hole shrinks", () => {
    const outer = new ps.Path.Rectangle({ point: [0, 0], size: [10, 10], insert: false });
    const inner = new ps.Path.Rectangle({ point: [3, 3], size: [4, 4], insert: false });
    const frame = new ps.CompoundPath({ children: [outer, inner], insert: false });
    const out = bleedOutline(ps, frame, 0.25);
    expect(out.bounds.width).toBeCloseTo(10.5, 6);
    expect(out.contains(new ps.Point(3.1, 5))).toBe(true); // was in the hole, now printed
    expect(out.contains(new ps.Point(5, 5))).toBe(false); // still a hole
    expect(out.contains(new ps.Point(-0.2, 5))).toBe(true);
  });
});

describe("seam match", () => {
  it("lays piece B against piece A along the seam, on the far side, without flipping it", () => {
    // A: a 10 × 30 panel whose RIGHT edge is the seam. B: the same panel 20 to the right, whose LEFT edge is the seam.
    const a0 = { x: 10, y: 0 };
    const a1 = { x: 10, y: 30 };
    const b0 = { x: 20, y: 0 };
    const b1 = { x: 20, y: 30 };
    const m = seamTransform(a0, a1, b0, b1, { x: 5, y: 15 }, { x: 25, y: 15 });
    // B only needs to slide left by 10
    expect(m.map((v) => Math.round(v * 1e9) / 1e9 + 0)).toEqual([1, 0, 0, 1, -10, 0]);

    // If B's seam is its RIGHT edge instead, B has to turn half round to sit on the far side.
    const m2 = seamTransform(a0, a1, { x: 30, y: 0 }, { x: 30, y: 30 }, { x: 5, y: 15 }, { x: 25, y: 15 });
    const centre = applyRigid(m2, { x: 25, y: 15 });
    expect(centre.x).toBeCloseTo(15, 9);
    expect(centre.y).toBeCloseTo(15, 9);
    expect(m2[0] * m2[3] - m2[1] * m2[2]).toBeCloseTo(1, 12); // a turn, not a mirror
    expect(m2[0]).toBeCloseTo(-1, 12);
  });

  it("seams of different lengths meet at their midpoints", () => {
    const m = seamTransform({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 50, y: 2 }, { x: 50, y: 14 }, { x: -5, y: 5 }, { x: 55, y: 8 });
    const mid = applyRigid(m, { x: 50, y: 8 });
    expect(mid.x).toBeCloseTo(0, 9);
    expect(mid.y).toBeCloseTo(5, 9);
  });

  it("a nudge made in the preview is turned back into the real piece's directions", () => {
    const m = seamTransform({ x: 10, y: 0 }, { x: 10, y: 30 }, { x: 30, y: 0 }, { x: 30, y: 30 }, { x: 5, y: 15 }, { x: 25, y: 15 });
    // B is shown turned half round, so "right" in the preview is "left" on the real piece.
    const v = unrotate(m, { x: 0.5, y: -0.2 });
    expect(v.x).toBeCloseTo(-0.5, 12);
    expect(v.y).toBeCloseTo(0.2, 12);
    // moving the real print by v, then viewing it through the preview, gives the nudge that was asked for
    const p = { x: 22, y: 9 };
    const a = applyRigid(m, p);
    const b = applyRigid(m, { x: p.x + v.x, y: p.y + v.y });
    expect(b.x - a.x).toBeCloseTo(0.5, 12);
    expect(b.y - a.y).toBeCloseTo(-0.2, 12);
  });

  it("a click picks the whole edge between two corners", () => {
    // 12 nodes, corners at 0, 3, 7, 9
    expect(edgeBetweenCorners([0, 3, 7, 9], 12, 4)).toEqual([3, 7]);
    expect(edgeBetweenCorners([0, 3, 7, 9], 12, 0)).toEqual([0, 3]);
    expect(edgeBetweenCorners([0, 3, 7, 9], 12, 10)).toEqual([9, 0]); // wraps past the start
    expect(edgeBetweenCorners([2, 8], 12, 0)).toEqual([8, 2]);
    expect(edgeBetweenCorners([], 12, 5)).toEqual([5, 6]);
  });
});
