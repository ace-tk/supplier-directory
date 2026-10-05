// Text → outline path data for export, laid out exactly like the editor's
// "Convert to curves" (engine/shaping.ts): each line starts at the text's
// point, lines are 1.2 × the font size apart, justification shifts a line by
// its advance width. The node's matrix is applied by the scene.

import type { Font } from "opentype.js";
import type { TextNode } from "../engine/serialize";

export function textOutlineData(text: TextNode, font: Font): string {
  const size = text.fontSize;
  const leading = size * 1.2;
  return text.content
    .split(/\r\n|\n|\r/)
    .map((line, i) => {
      const width = font.getAdvanceWidth(line, size);
      const x0 = text.justification === "center" ? -width / 2 : text.justification === "right" ? -width : 0;
      return font.getPath(line, x0, i * leading, size).toPathData(6);
    })
    .join("");
}
