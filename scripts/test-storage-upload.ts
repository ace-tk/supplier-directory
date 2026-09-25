/**
 * scripts/test-storage-upload.ts
 *
 * SAFE smoke test for the Supabase Storage integration (lib/object-storage.ts).
 * Exercises persistDataUrl() — the exact function every one of the app's 18
 * upload/write paths already calls — using a synthetic 1x1 PNG. Never
 * touches the database, never touches real user data, and deletes the one
 * test object it creates when it's done.
 *
 * Covers (see the chat report for what this does NOT cover):
 *   A. uploads a test image through the real persistDataUrl() code path
 *   B. confirms the returned value is an https:// Supabase Storage URL
 *   C. confirms the object is actually fetchable from that URL, byte-for-byte
 *
 * Does NOT cover (needs a logged-in browser session against a running app,
 * which a standalone script can't safely simulate — "use server" actions
 * call cookies()/getUser(), which throw outside a real Next.js request):
 *   D. a real Server Action storing the URL in a database row
 *   E. the existing UI rendering a migrated (URL) record
 *   F. the existing UI rendering an old (base64) record
 *   G. a failed upload not corrupting/deleting original data
 * D–G are a short manual checklist in the chat report instead.
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to already be set (see
 * .env.example). If they aren't, this exits cleanly with guidance rather
 * than failing — "not configured yet" is an expected, normal state.
 *
 * USAGE
 *   npx tsx scripts/test-storage-upload.ts
 */

import { isObjectStorageConfigured, persistDataUrl, deleteObject } from "../lib/object-storage";

// Smallest possible valid PNG (1x1 transparent pixel) — a synthetic fixture
// generated inline, not a real image from anywhere. Uploaded under
// "dev-smoke-test/" (not one of the app's real content folders) and
// deleted again before this script exits.
const TEST_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const TEST_DATA_URL = `data:image/png;base64,${TEST_PNG_BASE64}`;
const TEST_FOLDER = "dev-smoke-test";

function fail(message: string): never {
  console.error(`\n❌ ${message}`);
  throw new Error(message);
}

async function main() {
  console.log("Supabase Storage smoke test\n");

  if (!isObjectStorageConfigured()) {
    console.log("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY aren't set yet — nothing to test.");
    console.log("This is expected before Storage is configured. See .env.example for what to set, and the chat report for where to get each value.");
    return; // not a failure — an expected, unconfigured state
  }

  console.log(`1. Uploading a synthetic 1x1 PNG via persistDataUrl(dataUrl, "${TEST_FOLDER}") — the same function every real upload path calls...`);
  const url = await persistDataUrl(TEST_DATA_URL, TEST_FOLDER);
  if (url === TEST_DATA_URL) fail("persistDataUrl returned the original data: URL unchanged — the upload did not happen.");
  console.log(`   -> got back: ${url}`);

  console.log("\n2. Checking the returned value is an https:// URL...");
  if (!url.startsWith("https://")) fail(`Expected an https:// URL, got: ${url}`);
  console.log("   -> OK");

  let key: string | undefined;
  try {
    console.log("\n3. Fetching the URL back to confirm the object is actually retrievable...");
    const res = await fetch(url);
    if (!res.ok) {
      fail(`GET ${url} returned ${res.status} ${res.statusText} — object isn't publicly readable. Is the bucket set to Public in the Supabase dashboard?`);
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    const expectedBytes = Buffer.from(TEST_PNG_BASE64, "base64");
    if (!bytes.equals(expectedBytes)) {
      fail(`Downloaded bytes (${bytes.length}) don't match the uploaded bytes (${expectedBytes.length}) — content was altered in transit/storage.`);
    }
    console.log(`   -> OK (${bytes.length} bytes, byte-for-byte match)`);
  } finally {
    console.log("\n4. Cleaning up the test object...");
    key = url.split(`/${TEST_FOLDER}/`)[1];
    if (key) {
      await deleteObject(`${TEST_FOLDER}/${key}`).then(
        () => console.log("   -> deleted"),
        (err) => console.warn(`   -> cleanup failed (${err instanceof Error ? err.message : err}); delete "${TEST_FOLDER}/${key}" manually from the Supabase dashboard if needed.`)
      );
    } else {
      console.warn(`   -> couldn't parse the object key back out of ${url}; check the "${TEST_FOLDER}/" folder in the Supabase dashboard for leftover test files.`);
    }
  }

  console.log("\n✅ All checks passed — Supabase Storage upload + public read + persistDataUrl() are working end to end.");
  console.log("\nThis only exercises the storage layer directly. See the chat report's manual checklist for confirming");
  console.log("a real upload UI stores the URL in the database, and that both old (base64) and new (URL) records render.");
}

main().catch((err) => {
  console.error("\nSmoke test failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
