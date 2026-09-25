// Minimal Supabase Storage client — plain REST calls against Supabase's
// Storage HTTP API (https://supabase.com/docs/guides/storage), not the
// @supabase/supabase-js SDK. We only need "upload bytes" + "build a public
// URL", so a dependency-free client avoids pulling in an SDK for two HTTP
// calls (per "do not add an unnecessary abstraction layer").
//
// Uses the SAME Supabase project that already hosts DATABASE_URL — Storage
// just isn't wired up yet. Requires three new env vars (see .env.example):
//   SUPABASE_URL               e.g. https://xxxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  server-only secret — never expose client-side
//   SUPABASE_STORAGE_BUCKET    defaults to "supplybase-media" if unset
//
// IMPORTANT — safe-by-default: every function here treats "not configured"
// as a normal, expected state (the env vars don't exist yet in this repo)
// rather than an error. Callers get a clear signal (`isObjectStorageConfigured()`
// or a thrown `ObjectStorageConfigError` only where explicitly requested)
// and the app's existing base64-in-Postgres behavior keeps working
// unchanged until real credentials are added — see persistDataUrl below.

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "supplybase-media";

export class ObjectStorageConfigError extends Error {
  constructor() {
    super(
      "Supabase Storage isn't configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
        "(see .env.example) before calling an object-storage function directly."
    );
    this.name = "ObjectStorageConfigError";
  }
}

export function isObjectStorageConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);
}

function requireConfig(): { url: string; key: string } {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new ObjectStorageConfigError();
  return { url: SUPABASE_URL, key: SERVICE_ROLE_KEY };
}

/** Same allow-lists as lib/file-validation.ts, mapped to a file extension
 * for the object key. Falls back to no extension (still a valid, working
 * object key/URL) for anything outside the allow-lists rather than guessing. */
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
};

export function extensionForMime(mimeType: string): string {
  const ext = MIME_EXTENSIONS[mimeType.trim().toLowerCase()];
  return ext ? `.${ext}` : "";
}

/** Splits a `data:<mime>;base64,<payload>` string into its MIME type and
 * decoded bytes. Returns null for anything that isn't a base64 data URL
 * (including plain URLs — the expected shape for an already-migrated
 * record) so callers can tell "not a data URL" apart from "malformed". */
export function parseDataUrl(value: string): { mimeType: string; bytes: Buffer } | null {
  const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(value);
  if (!match) return null;
  const [, mimeType, base64] = match;
  try {
    return { mimeType, bytes: Buffer.from(base64, "base64") };
  } catch {
    return null;
  }
}

function randomKey(): string {
  // crypto.randomUUID is available in the Node 24 runtime this project
  // targets (package.json engines) without an extra import.
  return globalThis.crypto.randomUUID();
}

/** Uploads raw bytes to the configured bucket under `key` and returns the
 * object's public URL. Throws ObjectStorageConfigError if unconfigured —
 * callers that need graceful fallback should check isObjectStorageConfigured()
 * or use persistDataUrl() below instead of calling this directly. */
export async function uploadObjectBytes(key: string, bytes: Buffer | Uint8Array, contentType: string): Promise<string> {
  const { url, key: serviceKey } = requireConfig();

  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": contentType || "application/octet-stream",
      "x-upsert": "true", // overwrite-safe: re-running an upload with the same key never fails with a conflict
    },
    body: bytes as BodyInit,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supabase Storage upload failed (${res.status} ${res.statusText}): ${body.slice(0, 500)}`);
  }

  return getPublicUrl(key);
}

/** Deletes an object by key. Not called by any production write path today —
 * added for dev/test tooling (scripts/test-storage-upload.ts) so it can
 * clean up after itself instead of leaving objects behind on every run. */
export async function deleteObject(key: string): Promise<void> {
  const { url, key: serviceKey } = requireConfig();
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${key}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supabase Storage delete failed (${res.status} ${res.statusText}): ${body.slice(0, 500)}`);
  }
}

/** Builds the public URL for an object key. Assumes the bucket is public
 * (the simple, common case for product/catalog/portfolio imagery) — for a
 * private bucket, replace with a call to the `/object/sign/...` endpoint
 * and a signed-URL refresh strategy; out of scope for this phase. */
export function getPublicUrl(key: string): string {
  const { url } = requireConfig();
  return `${url}/storage/v1/object/public/${BUCKET}/${key}`;
}

/** True only for our own bucket's public URLs — used by the migration
 * script to recognize "already migrated" records so re-runs skip them. */
export function isOwnObjectStorageUrl(value: string): boolean {
  if (!SUPABASE_URL) return false;
  return value.startsWith(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`);
}

/**
 * The single seam every write path should call before persisting a
 * user-supplied `dataUrl` string. Behavior:
 *  - Not a `data:` URL already (e.g. re-saving an already-migrated record,
 *    or an external URL) → returned unchanged.
 *  - A `data:` URL, but object storage isn't configured yet → returned
 *    unchanged, so the app keeps storing base64-in-Postgres exactly as it
 *    does today until real Supabase Storage credentials are added. This is
 *    what makes wiring every call site today safe before credentials exist.
 *  - A `data:` URL and object storage IS configured → uploaded, and the
 *    resulting public URL is returned for the caller to persist instead.
 *
 * Overloaded so `null`/`undefined` pass straight through, matching the
 * optional-field shape most callers already have (`coverImage?: string`).
 */
export async function persistDataUrl(value: string, folder: string): Promise<string>;
export async function persistDataUrl(value: string | null | undefined, folder: string): Promise<string | null | undefined>;
export async function persistDataUrl(value: string | null | undefined, folder: string): Promise<string | null | undefined> {
  if (!value) return value;
  const parsed = parseDataUrl(value);
  if (!parsed) return value; // not a data: URL — nothing to do
  if (!isObjectStorageConfigured()) return value; // safe fallback — see doc comment above

  const key = `${folder}/${randomKey()}${extensionForMime(parsed.mimeType)}`;
  return uploadObjectBytes(key, parsed.bytes, parsed.mimeType);
}
