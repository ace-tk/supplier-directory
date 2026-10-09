/** A photo ready to send: reduced and re-encoded in the browser, plus a data URL for previewing. */
export interface PreparedUpload {
  /** What is shown as the preview: the photo reduced to at most `maxPx`, as JPEG. */
  dataUrl: string;
  blob: Blob;
  name: string;
}

/** Reduces a photo to at most `maxPx` on its long side, on white, as JPEG, so it stays well inside the request limit. */
export async function prepareUpload(file: File, maxPx: number): Promise<PreparedUpload> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`"${file.name}" couldn't be read as an image.`));
      img.src = url;
    });
    const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser can't prepare images.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The image couldn't be prepared."))), "image/jpeg", 0.92));
    return { dataUrl: canvas.toDataURL("image/jpeg", 0.92), blob, name: file.name };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Turns a stored data URL back into an upload (used when a saved design is reopened). */
export async function uploadFromDataUrl(dataUrl: string, name: string): Promise<PreparedUpload> {
  const blob = await (await fetch(dataUrl)).blob();
  return { dataUrl, blob, name };
}
