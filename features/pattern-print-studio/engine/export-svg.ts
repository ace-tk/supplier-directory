import type { DocFile } from "./Editor";
import { pathData, type SceneNode, type StyleJSON } from "./serialize";
import type { RasterAsset } from "./types";

const num = (v: number) => {
  const s = v.toFixed(6);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
};
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function styleAttrs(s: StyleJSON | undefined): string {
  if (!s) return ' fill="none"';
  const a: string[] = [];
  a.push(`fill="${s.fill ?? "none"}"`);
  if (s.fillRule === "evenodd") a.push('fill-rule="evenodd"');
  if (s.stroke) {
    a.push(`stroke="${s.stroke}"`, `stroke-width="${num(s.strokeWidth ?? 0)}"`);
    if (s.dash?.length) a.push(`stroke-dasharray="${s.dash.map(num).join(" ")}"`);
    if (s.cap) a.push(`stroke-linecap="${s.cap}"`);
    if (s.join) a.push(`stroke-linejoin="${s.join}"`);
    if (s.miter !== undefined) a.push(`stroke-miterlimit="${num(s.miter)}"`);
  }
  if (s.opacity !== undefined) a.push(`opacity="${num(s.opacity)}"`);
  return " " + a.join(" ");
}

function common(n: SceneNode): string {
  let a = "";
  if (n.id) a += ` id="${esc(n.id)}"`;
  if (n.name) a += ` data-name="${esc(n.name)}"`;
  if (n.hidden) a += ' display="none"';
  return a;
}

const matrixAttr = (m: number[]) => ` transform="matrix(${m.map(num).join(" ")})"`;

function writeNode(n: SceneNode, assets: Map<string, RasterAsset>, clipIds: { n: number }, out: string[]) {
  switch (n.t) {
    case "path":
      out.push(`<path${common(n)} d="${pathData(n)}"${styleAttrs(n.style)}/>`);
      break;
    case "compound":
      out.push(`<path${common(n)} d="${n.children.map((c) => pathData(c)).join("")}"${styleAttrs(n.style)}/>`);
      break;
    case "group": {
      if (n.clipped && n.children.length) {
        const [mask, ...rest] = n.children;
        const id = `clip${++clipIds.n}`;
        const d = mask.t === "path" ? pathData(mask) : mask.t === "compound" ? mask.children.map((c) => pathData(c)).join("") : "";
        out.push(`<g${common(n)}><clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">`);
        for (const c of rest) writeNode(c, assets, clipIds, out);
        out.push("</g></g>");
      } else {
        out.push(`<g${common(n)}>`);
        for (const c of n.children) writeNode(c, assets, clipIds, out);
        out.push("</g>");
      }
      break;
    }
    case "powerclip": {
      // The print is clipped by the outline; the outline itself is written on top.
      const id = `clip${++clipIds.n}`;
      const d = n.frame.t === "path" ? pathData(n.frame) : n.frame.children.map((c) => pathData(c)).join("");
      out.push(`<g${common(n)} data-powerclip="true"><clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">`);
      for (const c of n.contents) writeNode(c, assets, clipIds, out);
      out.push("</g>");
      writeNode(n.frame, assets, clipIds, out);
      out.push("</g>");
      break;
    }
    case "text": {
      const anchor = n.justification === "center" ? "middle" : n.justification === "right" ? "end" : "start";
      out.push(
        `<text${common(n)}${matrixAttr(n.matrix)} font-family="${esc(n.fontFamily)}" font-size="${num(n.fontSize)}" font-weight="${esc(String(n.fontWeight))}" text-anchor="${anchor}"${styleAttrs(n.style)}>${esc(n.content)}</text>`
      );
      break;
    }
    case "raster": {
      const a = assets.get(n.assetId);
      if (!a) break;
      // Paper rasters are centred on their local origin; the ORIGINAL file is embedded.
      out.push(
        `<image${common(n)}${matrixAttr(n.matrix)} x="${num(-n.width / 2)}" y="${num(-n.height / 2)}" width="${num(n.width)}" height="${num(n.height)}" preserveAspectRatio="none" href="${a.dataUrl}"/>`
      );
      break;
    }
  }
}

/** Page-sized SVG at exact real size: width/height in inches, viewBox in inches. */
export function exportSvg(doc: DocFile): string {
  const assets = new Map(doc.assets.map((a) => [a.id, a]));
  const out: string[] = [];
  const clipIds = { n: 0 };
  for (const n of doc.objects) writeNode(n, assets, clipIds, out);
  const { width, height } = doc.page;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${num(width)}in" height="${num(height)}in" viewBox="0 0 ${num(width)} ${num(height)}">`,
    `<title>${esc(doc.name)}</title>`,
    ...out,
    "</svg>",
  ].join("\n");
}
