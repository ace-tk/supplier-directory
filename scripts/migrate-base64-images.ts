/**
 * scripts/migrate-base64-images.ts
 *
 * Migrates existing base64 `data:` URLs — currently stored directly as
 * Postgres TEXT — to Supabase Storage objects, replacing the stored value
 * with the resulting public URL. Companion to lib/object-storage.ts (which
 * every NEW upload already routes through) and lib/media-url.ts.
 *
 * SCOPE: every non-AI image/document/media field identified in the Phase 2
 * storage audit. Deliberately excludes AI Design Studio / Garment Studio /
 * Back Design / Print-to-Embroidery / Embroidery / Repeat Print / SAM2
 * models (GarmentDesign, GarmentDesignVersion, GarmentBackDesign,
 * GarmentBackDesignVersion, EmbroideryDesign, RepeatPrintDesign,
 * RepeatPrintReferenceImage) — those are out of scope for this phase.
 *
 * SAFE BY DESIGN
 *  - Defaults to a DRY RUN: scans every target and reports what WOULD
 *    change. Nothing is uploaded or written. Pass --execute to actually do it.
 *  - A row's original base64 value is only ever replaced AFTER its upload
 *    to Supabase Storage has succeeded. A failed upload throws before the
 *    database write, so the row is left completely untouched.
 *  - Idempotent/resumable: every query only ever matches rows whose value
 *    still starts with "data:" — already-migrated rows (dataUrl is now a
 *    URL) are naturally excluded, so re-running (after an interruption, or
 *    to pick up newly-created legacy rows) only touches what's left.
 *    Re-running never re-uploads or duplicates a file for an already
 *    migrated row.
 *  - Processes rows in small batches (25 at a time per model) rather than
 *    loading a whole table into memory.
 *  - Never deletes a row, a model, or any non-image field.
 *
 * USAGE
 *   Dry run — safe, read-only, default:
 *     npx tsx scripts/migrate-base64-images.ts
 *
 *   Dry run for one model only (see MODEL_NAMES below for valid values):
 *     npx tsx scripts/migrate-base64-images.ts --only=CatalogRowImage
 *
 *   Actually migrate — requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   (and optionally SUPABASE_STORAGE_BUCKET) to already be set in the
 *   environment (see .env.example):
 *     npx tsx scripts/migrate-base64-images.ts --execute
 *
 *   Safe to re-run at any time, including after a partial/interrupted run.
 */

import { db } from "../lib/db";
import { isObjectStorageConfigured, parseDataUrl, uploadObjectBytes, extensionForMime } from "../lib/object-storage";
import type { Prisma } from "../lib/generated/prisma/client";

const BATCH_SIZE = 25;

const argv = new Set(process.argv.slice(2));
const EXECUTE = argv.has("--execute");
const ONLY = [...argv].find((a) => a.startsWith("--only="))?.split("=")[1];

const stats = { scanned: 0, migrated: 0, failed: 0, skippedInvalid: 0 };

function fmtKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

/** Uploads one data: URL (if EXECUTE) and reports/logs either way. Only
 * calls `apply` (the DB write) after a successful upload. */
async function migrateValue(label: string, id: string, dataUrl: string, folder: string, apply: (url: string) => Promise<void>): Promise<void> {
  stats.scanned++;
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    console.warn(`  [skip] ${label} ${id}: starts with "data:" but isn't a valid base64 data URL — left unchanged.`);
    stats.skippedInvalid++;
    return;
  }

  if (!EXECUTE) {
    console.log(`  [dry-run] ${label} ${id}: would upload ${fmtKB(parsed.bytes.length)} (${parsed.mimeType || "unknown mime"}) to "${folder}/" and update the row.`);
    return;
  }

  try {
    const key = `${folder}/${globalThis.crypto.randomUUID()}${extensionForMime(parsed.mimeType)}`;
    const url = await uploadObjectBytes(key, parsed.bytes, parsed.mimeType || "application/octet-stream");
    await apply(url); // only reached after a successful upload
    stats.migrated++;
    console.log(`  [ok] ${label} ${id}: migrated (${fmtKB(parsed.bytes.length)})`);
  } catch (err) {
    stats.failed++;
    console.error(`  [FAIL] ${label} ${id}: ${err instanceof Error ? err.message : String(err)} — original value left untouched.`);
  }
}

// ---------------------------------------------------------------------------
// "One scalar data-URL column per row" targets — the common case.
// ---------------------------------------------------------------------------

interface ScalarTarget {
  model: string;
  folder: string;
  count: () => Promise<number>;
  /** Always queries `WHERE <field> startsWith "data:"` — in EXECUTE mode
   * every successful migration removes that row from this set, so calling
   * this repeatedly with skip=0 naturally advances without an offset bug;
   * dry-run mode (which writes nothing) passes an increasing `skip`. */
  fetchBatch: (skip: number) => Promise<{ id: string; value: string }[]>;
  update: (id: string, url: string) => Promise<void>;
}

const scalarTargets: ScalarTarget[] = [
  {
    model: "CatalogRowImage",
    folder: "catalog",
    count: () => db.catalogRowImage.count({ where: { dataUrl: { startsWith: "data:" } } }),
    fetchBatch: (skip) =>
      db.catalogRowImage
        .findMany({ where: { dataUrl: { startsWith: "data:" } }, select: { id: true, dataUrl: true }, take: BATCH_SIZE, skip, orderBy: { id: "asc" } })
        .then((rows) => rows.map((r) => ({ id: r.id, value: r.dataUrl }))),
    update: async (id, url) => void (await db.catalogRowImage.update({ where: { id }, data: { dataUrl: url } })),
  },
  {
    model: "CatalogRowAttachment",
    folder: "catalog-attachments",
    count: () => db.catalogRowAttachment.count({ where: { dataUrl: { startsWith: "data:" } } }),
    fetchBatch: (skip) =>
      db.catalogRowAttachment
        .findMany({ where: { dataUrl: { startsWith: "data:" } }, select: { id: true, dataUrl: true }, take: BATCH_SIZE, skip, orderBy: { id: "asc" } })
        .then((rows) => rows.map((r) => ({ id: r.id, value: r.dataUrl }))),
    update: async (id, url) => void (await db.catalogRowAttachment.update({ where: { id }, data: { dataUrl: url } })),
  },
  {
    model: "ContentAttachment",
    folder: "content-attachments",
    count: () => db.contentAttachment.count({ where: { dataUrl: { startsWith: "data:" } } }),
    fetchBatch: (skip) =>
      db.contentAttachment
        .findMany({ where: { dataUrl: { startsWith: "data:" } }, select: { id: true, dataUrl: true }, take: BATCH_SIZE, skip, orderBy: { id: "asc" } })
        .then((rows) => rows.map((r) => ({ id: r.id, value: r.dataUrl }))),
    update: async (id, url) => void (await db.contentAttachment.update({ where: { id }, data: { dataUrl: url } })),
  },
  {
    model: "ContentItem.featuredImageUrl",
    folder: "content",
    count: () => db.contentItem.count({ where: { featuredImageUrl: { startsWith: "data:" } } }),
    fetchBatch: (skip) =>
      db.contentItem
        .findMany({ where: { featuredImageUrl: { startsWith: "data:" } }, select: { id: true, featuredImageUrl: true }, take: BATCH_SIZE, skip, orderBy: { id: "asc" } })
        .then((rows) => rows.map((r) => ({ id: r.id, value: r.featuredImageUrl! }))),
    update: async (id, url) => void (await db.contentItem.update({ where: { id }, data: { featuredImageUrl: url } })),
  },
  {
    model: "ProductDesignAttachment",
    folder: "product-design-attachments",
    count: () => db.productDesignAttachment.count({ where: { dataUrl: { startsWith: "data:" } } }),
    fetchBatch: (skip) =>
      db.productDesignAttachment
        .findMany({ where: { dataUrl: { startsWith: "data:" } }, select: { id: true, dataUrl: true }, take: BATCH_SIZE, skip, orderBy: { id: "asc" } })
        .then((rows) => rows.map((r) => ({ id: r.id, value: r.dataUrl }))),
    update: async (id, url) => void (await db.productDesignAttachment.update({ where: { id }, data: { dataUrl: url } })),
  },
  {
    model: "ManufacturingRequestAttachment",
    folder: "manufacturing-request-attachments",
    count: () => db.manufacturingRequestAttachment.count({ where: { dataUrl: { startsWith: "data:" } } }),
    fetchBatch: (skip) =>
      db.manufacturingRequestAttachment
        .findMany({ where: { dataUrl: { startsWith: "data:" } }, select: { id: true, dataUrl: true }, take: BATCH_SIZE, skip, orderBy: { id: "asc" } })
        .then((rows) => rows.map((r) => ({ id: r.id, value: r.dataUrl }))),
    update: async (id, url) => void (await db.manufacturingRequestAttachment.update({ where: { id }, data: { dataUrl: url } })),
  },
  {
    model: "WishImage",
    folder: "wishes",
    count: () => db.wishImage.count({ where: { dataUrl: { startsWith: "data:" } } }),
    fetchBatch: (skip) =>
      db.wishImage
        .findMany({ where: { dataUrl: { startsWith: "data:" } }, select: { id: true, dataUrl: true }, take: BATCH_SIZE, skip, orderBy: { id: "asc" } })
        .then((rows) => rows.map((r) => ({ id: r.id, value: r.dataUrl }))),
    update: async (id, url) => void (await db.wishImage.update({ where: { id }, data: { dataUrl: url } })),
  },
  {
    model: "MoodBoardAsset",
    folder: "mood-board",
    count: () => db.moodBoardAsset.count({ where: { dataUrl: { startsWith: "data:" } } }),
    fetchBatch: (skip) =>
      db.moodBoardAsset
        .findMany({ where: { dataUrl: { startsWith: "data:" } }, select: { id: true, dataUrl: true }, take: BATCH_SIZE, skip, orderBy: { id: "asc" } })
        .then((rows) => rows.map((r) => ({ id: r.id, value: r.dataUrl }))),
    update: async (id, url) => void (await db.moodBoardAsset.update({ where: { id }, data: { dataUrl: url } })),
  },
  {
    model: "MilestoneMedia",
    folder: "supply-chain-media",
    count: () => db.milestoneMedia.count({ where: { dataUrl: { startsWith: "data:" } } }),
    fetchBatch: (skip) =>
      db.milestoneMedia
        .findMany({ where: { dataUrl: { startsWith: "data:" } }, select: { id: true, dataUrl: true }, take: BATCH_SIZE, skip, orderBy: { id: "asc" } })
        .then((rows) => rows.map((r) => ({ id: r.id, value: r.dataUrl }))),
    update: async (id, url) => void (await db.milestoneMedia.update({ where: { id }, data: { dataUrl: url } })),
  },
  {
    model: "MilestoneAttachment",
    folder: "supply-chain-attachments",
    count: () => db.milestoneAttachment.count({ where: { dataUrl: { startsWith: "data:" } } }),
    fetchBatch: (skip) =>
      db.milestoneAttachment
        .findMany({ where: { dataUrl: { startsWith: "data:" } }, select: { id: true, dataUrl: true }, take: BATCH_SIZE, skip, orderBy: { id: "asc" } })
        .then((rows) => rows.map((r) => ({ id: r.id, value: r.dataUrl }))),
    update: async (id, url) => void (await db.milestoneAttachment.update({ where: { id }, data: { dataUrl: url } })),
  },
  {
    model: "Freelancer.resumeDataUrl",
    folder: "freelancer-resumes",
    count: () => db.freelancer.count({ where: { resumeDataUrl: { startsWith: "data:" } } }),
    fetchBatch: (skip) =>
      db.freelancer
        .findMany({ where: { resumeDataUrl: { startsWith: "data:" } }, select: { id: true, resumeDataUrl: true }, take: BATCH_SIZE, skip, orderBy: { id: "asc" } })
        .then((rows) => rows.map((r) => ({ id: r.id, value: r.resumeDataUrl! }))),
    update: async (id, url) => void (await db.freelancer.update({ where: { id }, data: { resumeDataUrl: url } })),
  },
  {
    model: "FreelancerPortfolioItem",
    folder: "freelancer-portfolio",
    count: () => db.freelancerPortfolioItem.count({ where: { dataUrl: { startsWith: "data:" } } }),
    fetchBatch: (skip) =>
      db.freelancerPortfolioItem
        .findMany({ where: { dataUrl: { startsWith: "data:" } }, select: { id: true, dataUrl: true }, take: BATCH_SIZE, skip, orderBy: { id: "asc" } })
        .then((rows) => rows.map((r) => ({ id: r.id, value: r.dataUrl }))),
    update: async (id, url) => void (await db.freelancerPortfolioItem.update({ where: { id }, data: { dataUrl: url } })),
  },
  {
    model: "User.avatar",
    folder: "avatars",
    count: () => db.user.count({ where: { avatar: { startsWith: "data:" } } }),
    fetchBatch: (skip) =>
      db.user
        .findMany({ where: { avatar: { startsWith: "data:" } }, select: { id: true, avatar: true }, take: BATCH_SIZE, skip, orderBy: { id: "asc" } })
        .then((rows) => rows.map((r) => ({ id: r.id, value: r.avatar! }))),
    update: async (id, url) => void (await db.user.update({ where: { id }, data: { avatar: url } })),
  },
  {
    model: "PortfolioProject.coverImage",
    folder: "portfolio-projects",
    count: () => db.portfolioProject.count({ where: { coverImage: { startsWith: "data:" } } }),
    fetchBatch: (skip) =>
      db.portfolioProject
        .findMany({ where: { coverImage: { startsWith: "data:" } }, select: { id: true, coverImage: true }, take: BATCH_SIZE, skip, orderBy: { id: "asc" } })
        .then((rows) => rows.map((r) => ({ id: r.id, value: r.coverImage! }))),
    update: async (id, url) => void (await db.portfolioProject.update({ where: { id }, data: { coverImage: url } })),
  },
  {
    model: "PortfolioBoard.coverImage",
    folder: "portfolio-boards",
    count: () => db.portfolioBoard.count({ where: { coverImage: { startsWith: "data:" } } }),
    fetchBatch: (skip) =>
      db.portfolioBoard
        .findMany({ where: { coverImage: { startsWith: "data:" } }, select: { id: true, coverImage: true }, take: BATCH_SIZE, skip, orderBy: { id: "asc" } })
        .then((rows) => rows.map((r) => ({ id: r.id, value: r.coverImage! }))),
    update: async (id, url) => void (await db.portfolioBoard.update({ where: { id }, data: { coverImage: url } })),
  },
  {
    model: "PortfolioPin.image",
    folder: "portfolio-pins",
    count: () => db.portfolioPin.count({ where: { image: { startsWith: "data:" } } }),
    fetchBatch: (skip) =>
      db.portfolioPin
        .findMany({ where: { image: { startsWith: "data:" } }, select: { id: true, image: true }, take: BATCH_SIZE, skip, orderBy: { id: "asc" } })
        .then((rows) => rows.map((r) => ({ id: r.id, value: r.image }))),
    update: async (id, url) => void (await db.portfolioPin.update({ where: { id }, data: { image: url } })),
  },
  {
    model: "ProjectReferenceImage",
    folder: "project-reference-images",
    count: () => db.projectReferenceImage.count({ where: { dataUrl: { startsWith: "data:" } } }),
    fetchBatch: (skip) =>
      db.projectReferenceImage
        .findMany({ where: { dataUrl: { startsWith: "data:" } }, select: { id: true, dataUrl: true }, take: BATCH_SIZE, skip, orderBy: { id: "asc" } })
        .then((rows) => rows.map((r) => ({ id: r.id, value: r.dataUrl }))),
    update: async (id, url) => void (await db.projectReferenceImage.update({ where: { id }, data: { dataUrl: url } })),
  },
  {
    model: "ProjectDocument",
    folder: "project-documents",
    count: () => db.projectDocument.count({ where: { dataUrl: { startsWith: "data:" } } }),
    fetchBatch: (skip) =>
      db.projectDocument
        .findMany({ where: { dataUrl: { startsWith: "data:" } }, select: { id: true, dataUrl: true }, take: BATCH_SIZE, skip, orderBy: { id: "asc" } })
        .then((rows) => rows.map((r) => ({ id: r.id, value: r.dataUrl }))),
    update: async (id, url) => void (await db.projectDocument.update({ where: { id }, data: { dataUrl: url } })),
  },
  {
    model: "ProjectResource.dataUrl",
    folder: "project-resources",
    count: () => db.projectResource.count({ where: { dataUrl: { startsWith: "data:" } } }),
    fetchBatch: (skip) =>
      db.projectResource
        .findMany({ where: { dataUrl: { startsWith: "data:" } }, select: { id: true, dataUrl: true }, take: BATCH_SIZE, skip, orderBy: { id: "asc" } })
        .then((rows) => rows.map((r) => ({ id: r.id, value: r.dataUrl! }))),
    update: async (id, url) => void (await db.projectResource.update({ where: { id }, data: { dataUrl: url } })),
  },
];

async function runScalarTarget(t: ScalarTarget): Promise<void> {
  const total = await t.count();
  console.log(`\n=== ${t.model} — ${total} row(s) with base64 data ===`);
  if (total === 0) return;

  let skip = 0;
  for (;;) {
    const batch = await t.fetchBatch(EXECUTE ? 0 : skip);
    if (batch.length === 0) break;
    for (const row of batch) {
      await migrateValue(t.model, row.id, row.value, t.folder, (url) => t.update(row.id, url));
    }
    if (!EXECUTE) {
      skip += BATCH_SIZE;
      if (skip >= total) break;
    }
  }
}

// ---------------------------------------------------------------------------
// Array / JSON targets — need element-wise handling.
// ---------------------------------------------------------------------------

/** PortfolioProject.galleryImages is a String[] where each element may
 * independently be a base64 data URL. */
async function runGalleryImages(): Promise<void> {
  const total = await db.portfolioProject.count({ where: { galleryImages: { isEmpty: false } } });
  console.log(`\n=== PortfolioProject.galleryImages — scanning ${total} project(s) with gallery images ===`);
  // Always plain offset pagination here, in both modes: unlike the scalar
  // targets above, migrating elements doesn't remove a row from this
  // "has a non-empty gallery" filter (the array stays non-empty, just its
  // elements change), so there's no shrinking-result-set to rely on.
  let skip = 0;
  for (;;) {
    const rows = await db.portfolioProject.findMany({
      where: { galleryImages: { isEmpty: false } },
      select: { id: true, galleryImages: true },
      take: BATCH_SIZE,
      skip,
      orderBy: { id: "asc" },
    });
    if (rows.length === 0) break;
    skip += BATCH_SIZE;
    for (const row of rows) {
      if (!row.galleryImages.some((v) => v.startsWith("data:"))) continue;
      const nextImages: string[] = [];
      let changed = false;
      for (const [i, value] of row.galleryImages.entries()) {
        if (!value.startsWith("data:")) {
          nextImages.push(value);
          continue;
        }
        stats.scanned++;
        const parsed = parseDataUrl(value);
        if (!parsed) {
          console.warn(`  [skip] PortfolioProject.galleryImages ${row.id}[${i}]: invalid data URL — left unchanged.`);
          nextImages.push(value);
          stats.skippedInvalid++;
          continue;
        }
        if (!EXECUTE) {
          console.log(`  [dry-run] PortfolioProject.galleryImages ${row.id}[${i}]: would upload ${fmtKB(parsed.bytes.length)} to "portfolio-projects/".`);
          nextImages.push(value);
          continue;
        }
        try {
          const key = `portfolio-projects/${globalThis.crypto.randomUUID()}${extensionForMime(parsed.mimeType)}`;
          const url = await uploadObjectBytes(key, parsed.bytes, parsed.mimeType || "application/octet-stream");
          nextImages.push(url);
          changed = true;
          stats.migrated++;
          console.log(`  [ok] PortfolioProject.galleryImages ${row.id}[${i}]: migrated (${fmtKB(parsed.bytes.length)})`);
        } catch (err) {
          nextImages.push(value); // keep the original element on failure
          stats.failed++;
          console.error(`  [FAIL] PortfolioProject.galleryImages ${row.id}[${i}]: ${err instanceof Error ? err.message : String(err)} — left unchanged.`);
        }
      }
      if (EXECUTE && changed) {
        await db.portfolioProject.update({ where: { id: row.id }, data: { galleryImages: nextImages } });
      }
    }
    if (rows.length < BATCH_SIZE) break;
  }
}

/** FreelancerPortfolio.clients / testimonials are Json? arrays of
 * {logo?: string} / {avatar?: string} objects respectively. */
async function runPortfolioJsonField(field: "clients" | "testimonials", imageKey: "logo" | "avatar"): Promise<void> {
  const label = `FreelancerPortfolio.${field}[].${imageKey}`;
  console.log(`\n=== ${label} — scanning ===`);

  // No DB-level filter on the JSON column itself (Prisma's JSON null
  // filtering is easy to get subtly wrong across DB-null vs JSON-null) —
  // paginate through every portfolio instead and filter candidates in
  // memory below. FreelancerPortfolio has at most one row per freelancer,
  // so this table is naturally small; batching still avoids loading it
  // all into memory at once.
  let skip = 0;
  for (;;) {
    const rows = await db.freelancerPortfolio.findMany({
      select: { id: true, [field]: true } as Prisma.FreelancerPortfolioSelect,
      take: BATCH_SIZE,
      skip,
      orderBy: { id: "asc" },
    });
    if (rows.length === 0) break;
    skip += BATCH_SIZE;

    const candidates = rows.filter((r) => {
      const arr = (r as unknown as Record<string, unknown>)[field];
      return Array.isArray(arr) && arr.some((entry) => typeof entry === "object" && entry !== null && typeof (entry as Record<string, unknown>)[imageKey] === "string" && (entry as Record<string, string>)[imageKey].startsWith("data:"));
    });

    for (const row of candidates) {
      const arr = ((row as unknown as Record<string, unknown>)[field] as Record<string, unknown>[]) ?? [];
      let changed = false;
      const next = await Promise.all(
        arr.map(async (entry, i) => {
          const value = entry[imageKey];
          if (typeof value !== "string" || !value.startsWith("data:")) return entry;
          stats.scanned++;
          const parsed = parseDataUrl(value);
          if (!parsed) {
            console.warn(`  [skip] ${label} ${row.id}[${i}]: invalid data URL — left unchanged.`);
            stats.skippedInvalid++;
            return entry;
          }
          if (!EXECUTE) {
            console.log(`  [dry-run] ${label} ${row.id}[${i}]: would upload ${fmtKB(parsed.bytes.length)} to "portfolio-${field}/".`);
            return entry;
          }
          try {
            const key = `portfolio-${field}/${globalThis.crypto.randomUUID()}${extensionForMime(parsed.mimeType)}`;
            const url = await uploadObjectBytes(key, parsed.bytes, parsed.mimeType || "application/octet-stream");
            changed = true;
            stats.migrated++;
            console.log(`  [ok] ${label} ${row.id}[${i}]: migrated (${fmtKB(parsed.bytes.length)})`);
            return { ...entry, [imageKey]: url };
          } catch (err) {
            stats.failed++;
            console.error(`  [FAIL] ${label} ${row.id}[${i}]: ${err instanceof Error ? err.message : String(err)} — left unchanged.`);
            return entry;
          }
        })
      );
      if (EXECUTE && changed) {
        await db.freelancerPortfolio.update({ where: { id: row.id }, data: { [field]: next as unknown as Prisma.InputJsonValue } });
      }
    }

    if (rows.length < BATCH_SIZE) break;
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const MODEL_NAMES = [...scalarTargets.map((t) => t.model), "PortfolioProject.galleryImages", "FreelancerPortfolio.clients", "FreelancerPortfolio.testimonials"];

async function main() {
  console.log(EXECUTE ? "RUNNING IN --execute MODE — this will upload files and write to the database." : "Dry run (default) — nothing will be uploaded or written. Pass --execute to actually migrate.");

  if (ONLY) {
    if (!MODEL_NAMES.includes(ONLY)) {
      console.error(`\nUnknown --only value "${ONLY}". Valid values:\n  ${MODEL_NAMES.join("\n  ")}`);
      process.exitCode = 1;
      return;
    }
    console.log(`Filtering to: ${ONLY}`);
  }

  if (EXECUTE && !isObjectStorageConfigured()) {
    console.error("\n--execute was passed but Supabase Storage isn't configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).");
    console.error("Set them first (see .env.example), or omit --execute to keep running a dry run.");
    process.exitCode = 1;
    return;
  }

  for (const t of scalarTargets) {
    if (ONLY && t.model !== ONLY) continue;
    await runScalarTarget(t);
  }
  if (!ONLY || ONLY === "PortfolioProject.galleryImages") await runGalleryImages();
  if (!ONLY || ONLY === "FreelancerPortfolio.clients") await runPortfolioJsonField("clients", "logo");
  if (!ONLY || ONLY === "FreelancerPortfolio.testimonials") await runPortfolioJsonField("testimonials", "avatar");

  console.log("\n=== Summary ===");
  console.log(`Scanned:  ${stats.scanned}`);
  console.log(`Migrated: ${stats.migrated}`);
  console.log(`Failed:   ${stats.failed}`);
  console.log(`Skipped (invalid data URL): ${stats.skippedInvalid}`);
  if (!EXECUTE) console.log("\nThis was a dry run — nothing was uploaded or changed. Re-run with --execute to actually migrate.");
  if (stats.failed > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("Migration script crashed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
