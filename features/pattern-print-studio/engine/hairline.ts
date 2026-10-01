import paper from "paper/dist/paper-core";

let installed = false;

/**
 * Display-only minimum outline width, like CorelDRAW: real outlines (e.g.
 * a 0.0076" pattern cut line) would be ~0.05 px at whole-page zoom and
 * effectively invisible. While DRAWING, any zoom-scaled stroke thinner than
 * 1 screen pixel is drawn at 1 px. The document's strokeWidth is never
 * changed, so saved files and exports stay exact.
 *
 * Paper.js has no public hook for this; it wraps Item#_setStyles (the
 * method that sets ctx.lineWidth right before a path is stroked). Paper is
 * only ever loaded on the Pattern Print Studio route.
 */
export function installHairlineMinimum() {
  if (installed) return;
  installed = true;
  const proto = (paper.Item as unknown as { prototype: Record<string, unknown> }).prototype;
  const original = proto._setStyles as (this: paper.Item, ctx: CanvasRenderingContext2D, param: unknown, viewMatrix: paper.Matrix) => void;
  proto._setStyles = function (this: paper.Item, ctx: CanvasRenderingContext2D, param: unknown, viewMatrix: paper.Matrix) {
    original.call(this, ctx, param, viewMatrix);
    if (!viewMatrix || !this.strokeColor || !this.strokeScaling) return;
    const scale = Math.sqrt(Math.abs(viewMatrix.a * viewMatrix.d - viewMatrix.b * viewMatrix.c));
    if (scale > 0 && ctx.lineWidth * scale < 1) ctx.lineWidth = 1 / scale;
  };
}
