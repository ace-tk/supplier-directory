// Backward-compatible read-side resolver for every dataUrl/coverImage/avatar
// etc. field that used to hold ONLY a base64 `data:` URL and may now hold
// either that (legacy, unmigrated rows) or a Supabase Storage public URL
// (new uploads, or rows the migration script has processed).
//
// Both shapes are already valid values for an <img src>/<a href>/fetch()
// target as-is — a browser renders `data:image/png;base64,...` and
// `https://.../object.png` identically — so this is intentionally a thin,
// documented pass-through rather than new branching logic. Its purpose is
// to be the ONE named seam that future non-browser consumers (PDF export,
// canvas rendering, anything that needs actual bytes rather than a src
// string) should call through, instead of each independently assuming one
// format. See lib/object-storage.ts's parseDataUrl()/isOwnObjectStorageUrl()
// for code that needs to tell the two formats apart.
export function resolveMediaUrl(value: string | null | undefined): string | null {
  return value ?? null;
}

/** True if `value` is a legacy inline base64 data URL rather than an
 * object-storage (or other) URL — e.g. for a consumer that needs to warn,
 * measure, or route differently for still-unmigrated records. */
export function isLegacyDataUrl(value: string | null | undefined): boolean {
  return Boolean(value) && value!.startsWith("data:");
}
