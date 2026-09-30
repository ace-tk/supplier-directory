# SupplyBase Performance Report: Phase 1 (Investigation)

Branch: `perf/speed-fixes`. **No application code has been changed.** This file is the only addition.
Measured on 2026-09-30.

## Stack

| Layer | Finding |
|---|---|
| Framework | Next.js 16.2.10, App Router, Turbopack build, `proxy.ts` (the new name for middleware) |
| Data | Prisma 7.8.0 (`prisma-client` generator, `@prisma/adapter-pg` driver adapter) with `pg.Pool` `max: 3` |
| Database | Supabase Postgres, **ap-southeast-2 (Sydney)**, reached through the Supavisor transaction pooler on port 6543 |
| Auth | Custom JWT (`jose`) in the `sb_session` cookie. Session reads never hit the DB. |
| Hosting | Vercel. No `vercel.json`, so the default function region is used. |
| Function region | **iad1 (Washington DC, US East).** Response header `x-vercel-id: bom1::iad1::…`: users enter at the Mumbai edge, the function runs in the US. |
| Users | India |

## Measurements (before)

| What | Result |
|---|---|
| `GET /api/suppliers` (2 small queries), from India to production | **TTFB 1.37–1.42s warm, 4.25s cold** (3 runs) |
| One `SELECT 1`, local (India) to DB, warm | 387ms (roughly one round trip) |
| Cold DB connection (TCP + TLS + pooler auth) plus `SELECT 1`, local to DB | **2,494ms** |
| Catalog query (`getOrCreateCatalogForOwner`), largest catalog (21 rows) | **6 sequential SQL queries, 16.7 MB result, 46s** (local to Sydney) |
| `/login`, live (prerendered at the edge) | TTFB 253ms, DOMContentLoaded 1.79s, load 4.42s, 383 KB JS transferred, CLS 0 |
| Build | 225 routes: **217 dynamic (ƒ)**, 8 static (○) |
| Initial JS per route (gzip, from build manifests) | 149–281 KB. **Over 200 KB:** shop 281, directory/buyer-suppliers 266, supply-chain 265, login 235, catalog 208 |

Lighthouse isn't installed, and adding it would be a new dependency, so live timings come from the browser's Navigation Timing API. Authenticated pages couldn't be measured live because I can't sign in. The Phase 3 before/after table needs either your signed-in browser session or your approval to add Lighthouse as a dev-only tool.

---

## Root causes, ranked by impact

### 1. Base64 images and files stored in the database and loaded with every list (critical)

**Evidence (read-only counts):**

| Table.column | Rows still base64 | Size |
|---|---|---|
| `CatalogRowImage.dataUrl` | 31 of 34 (3 already in Storage) | **16.4 MB** (~530 KB per image) |
| `ContentAttachment.dataUrl` | 16 of 16 | **23.2 MB** |
| `MoodBoardAsset.dataUrl` | 2 of 2 | 2.7 MB |
| `PortfolioPin.image` | 5 | < 0.1 MB |
| AI tables (`GarmentDesignVersion`, `RepeatPrintDesign`) | 21 | 47 MB (out of scope: AI) |

- `lib/catalog-queries.ts:8-23` (`catalogInclude`) loads **every row, and every image's full base64 bytes**, for Catalog, Product, and all four portals' product/catalog edit pages. The largest catalog returns **16.7 MB** per page view. That is pulled Sydney → Washington, then serialized into the page payload and sent to India.
- The 3 rows that already hold Storage URLs show that **production uploads already go to Supabase Storage**. Only the old rows were never migrated.
- The migration tool already exists: `scripts/migrate-base64-images.ts`. It dry-runs by default, is resumable, replaces a value only after its upload succeeds, never deletes anything, and already excludes AI models.

**Fix:** run the existing script, dry run first, then `--execute`, with production's Supabase Storage variables (they aren't in the local `.env`).
- Images stay pixel-identical, and the UI is unchanged: the app already renders both `data:` and `https:` values (`lib/media-url.ts`).
- **Expected gain:** the Catalog/Product payload drops from ~16.7 MB to a few KB of URLs, so seconds to tens of seconds per view down to well under 1s. Images load separately from the Storage CDN, in parallel and cached.
- **Risk: medium.** This is a data migration: stored values change from base64 to URLs.
- **Needs your decision.**

### 2. Function region (Washington) is far from the database (Sydney) (critical, and affects every page)

**Evidence:** `x-vercel-id: bom1::iad1`, the DB host is `aws-0-ap-southeast-2`, and there's no `vercel.json`.
- Every query pays a Washington ↔ Sydney round trip (~200ms).
- One page view costs 1–2 round trips for access checks plus 1–6 for page data, or 6+ for Catalog. That's 0.4–1.5s of pure network wait per page, before any rendering.

**Fix:** move functions next to the database.
- **Option A (recommended):** Vercel → Project → Settings → Functions → Region = **`syd1` (Sydney)**. Alternatively, commit `vercel.json` with `{ "regions": ["syd1"] }`.
  - Function ↔ DB drops from ~200ms to ~1–3ms per query.
  - India ↔ Sydney (~130–150ms) is also *shorter* than India ↔ Washington (~200–230ms), so the one browser round trip gets faster too.
- **Option B (best long term, much bigger job):** move the Supabase project to **ap-south-1 (Mumbai)** and set the function region to `bom1`. This is a database migration.
- **Expected gain (A):** roughly 0.5–1.5s less on every dynamic page and Server Action, and more for multi-query pages.
- **Risk: low.** No code change; can be reverted instantly.
- **Needs your decision:** it's a dashboard setting, or a `vercel.json` I would commit.

### 3. No `loading.tsx` anywhere, so navigation feels frozen (high, perceived)

**Evidence:** 0 `loading.tsx` files, and 217 dynamic routes.
- Next.js prefetches dynamic routes only down to the nearest loading boundary. With none, clicking a sidebar item shows nothing until the whole server render finishes, which is ~1–3s here because of #1 and #2.
- The Suspense boundaries added earlier (Catalog, Product, Content, Templates, Directory) help only once the page segment starts streaming. The layout and access-check round trips still happen first.

**Fix:** add `loading.tsx` skeletons.
- Put them **inside each module folder** (below the module's permission `layout.tsx`), so unauthorized-access redirects stay real server-side 307s.
- Reuse the skeletons already built (`CatalogTableSkeleton`, `DirectoryViewSkeleton`, etc.). Elsewhere, use a neutral page skeleton in the existing style.
- **Expected gain:** clicks give instant visual feedback, because the skeleton is prefetched.
- **Risk: low.** Adds files only; the final UI is identical.

### 4. Database connections close after 10s idle, so light traffic keeps paying the cold TLS handshake (high)

**Evidence:** `lib/db.ts:20` has `new Pool({ max: 3 })`, which means `pg`'s default `idleTimeoutMillis` of **10s**.
- A cold connection to Sydney took **2.5s** here, versus 0.39s for a warm query.
- On a lightly used app, most requests arrive more than 10s after the previous one, so they reconnect. This matches the `/api/suppliers` numbers: 1.4s warm and 4.2s cold, for 2 tiny queries.

**Fix:** set `idleTimeoutMillis` (for example 5 minutes), keeping `max: 3` and the transaction-mode pooler.
- Supavisor handles idle client connections, so this keeps a warm instance's connection open instead of re-handshaking.
- **Expected gain:** skips the multi-round-trip TLS handshake on most requests.
- **Risk: low.** Pool size, behavior and queries are unchanged.

### 5. Every login runs a sequential demo-user sync: 4 × (DB round trip + bcrypt) (high, on login)

**Evidence:** `services/auth.ts:28` calls `ensureDemoUsersSeeded()` (`lib/seed.ts:76-77`), a sequential `for…of` over the demo users. For each it runs `findUnique`, then a **bcryptjs cost-12 compare** (`lib/seed.ts:111`) to keep demo passwords in sync.
- One cost-12 compare measured **~230ms** locally, and serverless CPUs are typically slower.
- That adds about **2–3s to every login** before the real user is even looked up.

**Fixes:**
- **5a (safe, same behavior):** one `findMany` for all demo emails, instead of 4 sequential `findUnique` calls. This saves 3 round trips. **Risk: low.**
- **5b (needs your decision):** run the demo sync at most once per warm server instance, instead of on every login. This removes ~1s+ of bcrypt per login, but a demo password changed in the database would only be re-synced on the next cold start, not the next login. **Risk: medium** (behavior timing).

### 6. `zod` (~75 KB gzip) loads up front for forms that are usually never opened (medium)

**Evidence** (build-manifest diff against a lean route):

| Route | Initial JS (gzip) | Of which `zod` + react-hook-form |
|---|---|---|
| directory / buyer-suppliers | 266 KB | ~90 KB |
| shop | 281 KB | ~90 KB |
| supply-chain | 265 KB | ~90 KB |
| login | 235 KB | ~90 KB |

- Directory imports `SupplierForm` statically (`components/suppliers/DirectoryView.tsx:14`, `supplier-drawer.tsx:32`). It's only shown after clicking "Add Supplier" or Edit.

**Fix:** load the add/edit form dialogs with `next/dynamic`, following the lazy-import pattern already in the repo. Login is left alone, since its form is used immediately.
- **Expected gain:** ~80–90 KB gzip less on Directory, Shop and Supply Chain, which is faster to become interactive on mobile.
- **Risk: low–medium.** The first open of a dialog fetches its code, which takes a few ms on a warm connection.

### 7. Nested `include` means N sequential SQL round trips (medium; mostly solved by #2)

**Evidence:** the catalog query ran **6 sequential SQL queries** (catalog → rows → images, attachments, warehouse, store). Prisma's default relation strategy is separate queries, and `relationJoins` isn't enabled.

**Fix:** after #2, each extra query costs ~2ms instead of ~200ms, so leave it. Enabling `relationJoins` means editing the `schema.prisma` generator block (no database change). That's only worth doing if Option A isn't taken. **Needs your decision** if you want it.

### 8. Minor

- `app/(dashboard)/settings/page.tsx:31,36`: two independent queries run one after the other. They can run together with `Promise.all`, saving one round trip. **Risk: low.**
- `app/(dashboard)/shop/page.tsx` fetches all of its data in the browser (`useEffect` → `/api/products`, with infinite scroll). Moving that to the server means restructuring its paging and filters. **Not proposed; risk: high.**

## Already fine (no action)

- **`proxy.ts`:** local JWT verify only, no network calls, and the matcher already excludes `_next/static`, `_next/image`, `api` and images.
- **Sessions:** JWT only; `getSession`, `getUser` and workspace access are `cache()`-deduped per request.
- **Heavy libraries** (xlsx, jspdf, pdfjs, mammoth, jszip, html2canvas-pro) are already loaded only when used, in their own chunks.
- **Navigation** uses `next/link` everywhere, prefetch is not disabled, and there are no raw internal `<a>` tags.
- **No `force-dynamic`, `revalidate = 0` or `no-store`** in shared layouts. Dynamic rendering comes only from the session cookie, which is required for per-user pages.
- **No N+1 loops** in hot read paths. The only loop is the login seed (#5).
- **Fonts:** `next/font` is not used, but no custom web fonts are loaded.

## Decisions needed from you

1. **Region (#2):** set Vercel Functions to `syd1`? You change the dashboard, or approve me committing `vercel.json`. Or do you prefer the larger Mumbai database move?
2. **Base64 migration (#1):** run `scripts/migrate-base64-images.ts`, dry run first and then `--execute`, with production's Supabase Storage keys? I'd need you to run it, or provide the keys locally.
3. **Login demo sync (#5b):** once per warm instance, or keep it on every login and apply only 5a?
4. **Measurement:** allow Lighthouse as a temporary dev tool (not an app dependency), or will you sign in so I can measure authenticated pages in the browser pane?

## Proposed commit plan (low risk first; nothing done yet)

1. `perf: keep DB pool connections warm (idleTimeoutMillis)` (#4)
2. `perf: add loading.tsx skeletons for instant navigation feedback` (#3)
3. `perf: batch demo-user lookup on login` (#5a)
4. `perf: parallelize settings page queries` (#8)
5. `perf: lazy-load supplier/shop/supply-chain form dialogs` (#6)
6. Only with your approval: `vercel.json` region (#2), demo sync once per instance (#5b), base64 migration run (#1)

No database schema changes or new indexes are proposed. Nothing in this plan touches the query patterns that would need one.
