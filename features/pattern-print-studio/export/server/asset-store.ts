// Original image files for export, kept on the server's disk under their
// SHA-256, so each original is uploaded once and reused by every preview
// and export. Server only.

import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/** Where export working files live. On the server's own disk; nothing here is part of the repository. */
export const EXPORT_ROOT = path.join(os.tmpdir(), "supplybase-pps-export");
const ASSET_DIR = path.join(EXPORT_ROOT, "assets");

/** Largest original accepted, bytes. */
export const MAX_ASSET_BYTES = 300 * 1024 * 1024;

export const isHash = (value: string) => /^[a-f0-9]{64}$/.test(value);

export function assetPath(hash: string): string {
  if (!isHash(hash)) throw new Error("Bad asset id.");
  return path.join(ASSET_DIR, hash);
}

export async function hasAsset(hash: string): Promise<boolean> {
  if (!isHash(hash)) return false;
  try {
    return (await stat(assetPath(hash))).isFile();
  } catch {
    return false;
  }
}

export class AssetUploadError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

/** Stores an upload, checking that its bytes really have the SHA-256 it was sent under. Never holds the file in memory. */
export async function saveAsset(hash: string, body: ReadableStream<Uint8Array> | null): Promise<number> {
  if (!isHash(hash)) throw new AssetUploadError("Bad asset id.", 400);
  if (!body) throw new AssetUploadError("Empty upload.", 400);
  await mkdir(ASSET_DIR, { recursive: true });
  const tmp = path.join(ASSET_DIR, `${hash}.${process.pid}.${Date.now()}.part`);
  const digest = createHash("sha256");
  const file = createWriteStream(tmp);
  let size = 0;
  try {
    const reader = body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_ASSET_BYTES) throw new AssetUploadError("This image is larger than the 300 MB limit.", 413);
      digest.update(value);
      if (!file.write(value)) await new Promise<void>((resolve) => file.once("drain", () => resolve()));
    }
    await new Promise<void>((resolve, reject) => file.end((err?: Error | null) => (err ? reject(err) : resolve())));
    if (!size) throw new AssetUploadError("Empty upload.", 400);
    if (digest.digest("hex") !== hash) throw new AssetUploadError("The upload did not arrive intact. Please try again.", 422);
    await rename(tmp, assetPath(hash));
    return size;
  } catch (err) {
    file.destroy();
    await rm(tmp, { force: true });
    throw err;
  }
}
