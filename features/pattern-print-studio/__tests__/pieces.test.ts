import { describe, expect, it } from "vitest";
import { namePieces, parseSizeLabel, pieceAnchor, pieceLabel, repeatForCopy, sizeOrder, sizeScale, sizeTransform } from "../engine/pieces";
import { applyAffine, defaultRepeat } from "../engine/repeat";

describe("piece tags", () => {
  it("reads size labels", () => {
    expect(parseSizeLabel("S")).toBe("S");
    expect(parseSizeLabel(" xl ")).toBe("XL");
    expect(parseSizeLabel("XXXL")).toBe("XXXL");
    expect(parseSizeLabel("2XL")).toBe("XXL");
    expect(parseSizeLabel("3xl")).toBe("XXXL");
    expect(parseSizeLabel("LEG - CUT 2")).toBeNull();
    expect(parseSizeLabel("WAISTBAND S - CUT 1 ON FOLD")).toBeNull();
  });
  it("orders sizes smallest first, custom sizes last", () => {
    const sizes = ["XXXL", "M", "Kids 8", "S", "XL", "L", "XXL"].sort((a, b) => sizeOrder(a) - sizeOrder(b));
    expect(sizes).toEqual(["S", "M", "L", "XL", "XXL", "XXXL", "Kids 8"]);
  });
  it("suggests piece names from shape and left-to-right position", () => {
    // one size block of the leggings sheet: two legs, a waistband, a gusset (given out of order)
    const waistband = { x: 1.2, y: 30.8, w: 9.8, h: 3.4 };
    const back = { x: 11.65, y: 0.9, w: 10.4, h: 29.4 };
    const gusset = { x: 14.2, y: 30.9, w: 5.2, h: 3.2 };
    const front = { x: 0.9, y: 0.9, w: 10.4, h: 29.4 };
    expect(namePieces([waistband, back, gusset, front])).toEqual(["Waistband", "Back", "Gusset", "Front"]);
    expect(namePieces([front])).toEqual(["Leg"]);
    expect(namePieces([front, back, { ...back, x: 30 }])).toEqual(["Leg 1", "Leg 2", "Leg 3"]);
    expect(namePieces([waistband, { ...waistband, x: 20 }])).toEqual(["Waistband 1", "Waistband 2"]);
    // In the big sizes the gusset is wide enough to look like a band — it is still the gusset.
    const wideGusset = { x: 150, y: 30.9, w: 6.6, h: 3.2 };
    expect(namePieces([{ ...waistband, w: 19 }, wideGusset])).toEqual(["Waistband", "Gusset"]);
    expect(pieceLabel({ size: "M", piece: "Front" })).toBe("M-Front");
  });
});

describe("apply to all sizes", () => {
  const sFront = { x: 0.9, y: 0.9, w: 10.4, h: 29.4 };
  const xxxlFront = { x: 125.9, y: 0.9, w: 13.9, h: 29.4 };

  it("anchors: piece centre, top-centre (waist), or the piece's own reference point", () => {
    const close = (p: { x: number; y: number }, x: number, y: number) => {
      expect(p.x).toBeCloseTo(x, 12);
      expect(p.y).toBeCloseTo(y, 12);
    };
    close(pieceAnchor(sFront, "center"), 6.1, 15.6);
    close(pieceAnchor(sFront, "top"), 6.1, 0.9);
    close(pieceAnchor(sFront, "ref", { size: "S", piece: "Front", ref: { dx: 2, dy: 5 } }), 2.9, 5.9);
    // No reference point on this piece: falls back to its centre.
    close(pieceAnchor(sFront, "ref", { size: "S", piece: "Front" }), 6.1, 15.6);
  });

  it("keep print size: the print only moves — same size on every size", () => {
    const m = sizeTransform(pieceAnchor(sFront, "center"), pieceAnchor(xxxlFront, "center"), 1, false);
    // a 2 in motif, 1 in right of and 3 in above the centre of S-Front
    const a = applyAffine(m, 7.1, 12.6);
    const b = applyAffine(m, 9.1, 12.6);
    const c = pieceAnchor(xxxlFront, "center");
    expect(a.x - c.x).toBeCloseTo(1, 12);
    expect(a.y - c.y).toBeCloseTo(-3, 12);
    expect(b.x - a.x).toBeCloseTo(2, 12); // still 2 in wide
    expect(m[0]).toBe(1);
    expect(m[3]).toBe(1);
  });

  it("scale with piece: one factor from the pieces' areas, so the print grows but is never distorted", () => {
    const s = sizeScale(sFront, xxxlFront);
    expect(s).toBeCloseTo(Math.sqrt(13.9 / 10.4), 12);
    expect(sizeScale(sFront, sFront)).toBe(1);
    const top = pieceAnchor(xxxlFront, "top");
    const m = sizeTransform(pieceAnchor(sFront, "top"), top, s, false);
    expect(m[0]).toBe(m[3]); // uniform
    // A point 4 in below the waist of S lands 4 × s below the waist of XXXL, still on the centre line.
    const p = applyAffine(m, 6.1, 4.9);
    expect(p.x).toBeCloseTo(top.x, 12);
    expect(p.y - top.y).toBeCloseTo(4 * s, 12);
    // The anchor itself always lands on the anchor.
    const anchor = pieceAnchor(sFront, "top");
    const landed = applyAffine(m, anchor.x, anchor.y);
    expect(landed.x).toBeCloseTo(top.x, 12);
    expect(landed.y).toBeCloseTo(top.y, 12);
  });

  it("mirror: flips left-right about the anchor, for a Left / Right pair", () => {
    const from = pieceAnchor(sFront, "center");
    const to = { x: 16.85, y: 15.6 };
    const m = sizeTransform(from, to, 1, true);
    const right = applyAffine(m, from.x + 3, from.y + 2); // 3 in right of the centre…
    expect(right.x).toBeCloseTo(to.x - 3, 12); // …lands 3 in LEFT of the other piece's centre
    expect(right.y).toBeCloseTo(to.y + 2, 12);
    // Mirroring twice gives the print back the right way round.
    const back = sizeTransform(to, from, 1, true);
    const p = applyAffine(back, right.x, right.y);
    expect(p.x).toBeCloseTo(from.x + 3, 12);
    expect(p.y).toBeCloseTo(from.y + 2, 12);
  });

  it("a repeat is copied as settings: scaled with the piece, turned the other way when mirrored", () => {
    const r = { ...defaultRepeat(2, 2), rotation: 20, offsetX: 0.5, offsetY: 0.25, gapX: 0.1 };
    expect(repeatForCopy(r, 1, false)).toEqual(r);
    const grown = repeatForCopy(r, 1.2, false);
    expect(grown.scale).toBeCloseTo(120, 12);
    expect(grown.tileW).toBe(2); // the tile size setting itself is untouched
    expect(grown.offsetX).toBeCloseTo(0.6, 12);
    const mirrored = repeatForCopy(r, 1, true);
    expect(mirrored.rotation).toBe(-20);
    expect(mirrored.offsetX).toBe(-0.5);
    expect(mirrored.offsetY).toBe(0.25);
  });
});
