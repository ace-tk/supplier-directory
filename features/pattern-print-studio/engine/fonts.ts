import type { Font } from "opentype.js";

/**
 * The studio's text font. Arimo (SIL Open Font License) is metric-compatible
 * with Arial and can be shipped with the app, so the same file both draws
 * live text and supplies the outlines for "Convert to curves" — which is
 * what keeps converted text looking the same.
 */
export const STUDIO_FONT = "Arimo";

const FONT_FILES = {
  400: "/pattern-print-studio/fonts/arimo-latin-400-normal.woff",
  700: "/pattern-print-studio/fonts/arimo-latin-700-normal.woff",
} as const;
type Weight = keyof typeof FONT_FILES;

export function outlineWeight(fontWeight: string | number): Weight {
  const n = typeof fontWeight === "number" ? fontWeight : fontWeight === "bold" || fontWeight === "bolder" ? 700 : parseInt(fontWeight, 10) || 400;
  return n >= 600 ? 700 : 400;
}

let facesPromise: Promise<void> | null = null;

/** Registers Arimo with the page so canvas text is drawn with it. Safe to call repeatedly. */
export function loadStudioFontFaces(): Promise<void> {
  if (!facesPromise) {
    facesPromise = Promise.all(
      (Object.keys(FONT_FILES) as unknown as Weight[]).map(async (w) => {
        const face = new FontFace(STUDIO_FONT, `url(${FONT_FILES[w]})`, { weight: String(w) });
        document.fonts.add(await face.load());
      })
    ).then(
      () => undefined,
      () => {
        facesPromise = null; // offline or blocked: text falls back to the system font; retry next time
      }
    );
  }
  return facesPromise;
}

const outlineFonts = new Map<Weight, Promise<Font>>();

/** Glyph outlines for Convert to curves. opentype.js and the font file load only when first needed. */
export function getOutlineFont(fontWeight: string | number): Promise<Font> {
  const w = outlineWeight(fontWeight);
  let p = outlineFonts.get(w);
  if (!p) {
    p = (async () => {
      const [{ parse }, res] = await Promise.all([import("opentype.js"), fetch(FONT_FILES[w])]);
      if (!res.ok) throw new Error("The text font couldn't be loaded.");
      return parse(await res.arrayBuffer());
    })();
    p.catch(() => outlineFonts.delete(w));
    outlineFonts.set(w, p);
  }
  return p;
}
