import sharp from "sharp";
import { removeBackground } from "@/lib/background-remove";

/**
 * Removes the plain background of a PNG data URL. Returns the new image and
 * whether the cut was made (a busy, non-plain border is left untouched).
 */
export async function makeBackgroundTransparent(dataUrl: string): Promise<{ image: string; removed: boolean }> {
  const input = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  const result = removeBackground(pixels, info.width, info.height);
  if (!result.removed) return { image: dataUrl, removed: false };
  const png = await sharp(Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength), { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
  return { image: `data:image/png;base64,${png.toString("base64")}`, removed: true };
}
