// Client-side, deterministic seam preparation for the Repeat Print Maker.
// No pixels are invented here — this only crops (center/"cover", never
// stretches) and rearranges the user's own real pixels. The classic
// "offset by 50%,50% with wraparound" texture technique: shifting a square
// image by half its size in both axes moves the image's own real
// discontinuity (its outer edges, which don't match each other) from the
// tile's border into a cross through the center. The tile's new OUTER
// edges become genuinely continuous — real, untouched source pixels that
// were simply adjacent in the middle of the original photo — so only that
// center cross ever needs AI repair; everything else in the final tile is
// exactly the source artwork.

const TILE_SIZE = 1024;
const SEAM_BAND_FRACTION = 0.12;

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't read the reference image."));
    img.src = dataUrl;
  });
}

/** Center-crop, cover-fit onto a TILE_SIZE square — preserves real pixels
 * and composition, never distorts a portrait/landscape reference to fit. */
async function cropToSquare(dataUrl: string): Promise<HTMLCanvasElement> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't supported in this browser.");
  const scale = Math.max(TILE_SIZE / img.width, TILE_SIZE / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (TILE_SIZE - w) / 2, (TILE_SIZE - h) / 2, w, h);
  return canvas;
}

function offsetWrap(source: HTMLCanvasElement): HTMLCanvasElement {
  const size = source.width;
  const half = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't supported in this browser.");
  for (const dx of [half, half - size]) {
    for (const dy of [half, half - size]) {
      ctx.drawImage(source, dx, dy);
    }
  }
  return canvas;
}

/** OpenAI's edit-mask convention: fully transparent pixels mark the region
 * to repair, opaque pixels are preserved untouched. Only a narrow cross
 * through the center — exactly where offsetWrap put the real seam — is
 * ever transparent; every motif elsewhere is opaque, i.e. never touched. */
function buildSeamMask(size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't supported in this browser.");
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, size, size);
  const band = size * SEAM_BAND_FRACTION;
  const half = size / 2;
  ctx.clearRect(0, half - band / 2, size, band);
  ctx.clearRect(half - band / 2, 0, band, size);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Couldn't encode the prepared image."));
    }, "image/png");
  });
}

export interface PreparedTile {
  /** Real File objects, not base64 strings — a multi-megabyte data URL
   * passed as a plain Server Action argument hits a real Next.js/React
   * Flight serialization limit ("Maximum array nesting exceeded"),
   * confirmed by testing; Files/Blobs take a different, binary-safe
   * transport path that Server Actions support natively. */
  wrappedImage: File;
  mask: File;
}

export async function prepareSeamlessTileInputs(referenceDataUrl: string): Promise<PreparedTile> {
  const squared = await cropToSquare(referenceDataUrl);
  const wrapped = offsetWrap(squared);
  const mask = buildSeamMask(wrapped.width);
  const [wrappedBlob, maskBlob] = await Promise.all([canvasToBlob(wrapped), canvasToBlob(mask)]);
  return {
    wrappedImage: new File([wrappedBlob], "tile.png", { type: "image/png" }),
    mask: new File([maskBlob], "mask.png", { type: "image/png" }),
  };
}
