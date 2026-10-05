#!/bin/bash
# Developer-only helper for the browser test suites (see ../README.md, "Testing").
#
#   bash features/pattern-print-studio/__tests__/dev-test-routes.sh up     # create the test page + routes
#   bash features/pattern-print-studio/__tests__/dev-test-routes.sh down   # remove them again
#
# "up" creates, OUTSIDE version control:
#   app/pps-test/                 the studio on a page that needs no sign-in
#   app/api/pps-test-export/      the export API without the sign-in check, plus helpers that run
#                                 the TIFF verification script and read PDFs back on the server
#   public/browser-*.mjs + the three fixture files
# These routes skip authentication. They answer 404 when NODE_ENV is "production", but they must
# NEVER be committed or deployed: always run "down" before committing.
set -e
cd "$(dirname "$0")/../../.."
R=app/api/pps-test-export
if [ "$1" = "down" ]; then
  rm -rf app/pps-test $R public/browser-*.mjs public/floral-print.png public/leggings-test.svg public/repeat-tile.png .next/dev/types .next/types
  echo "Test page and routes removed."
  exit 0
fi
if [ "$1" != "up" ]; then echo "Usage: $0 up|down"; exit 2; fi
T="${TMPDIR:-/tmp}"; S="${T%/}/pps-test-output"; mkdir -p "$S"
mkdir -p app/pps-test $R/preview "$R/assets/[hash]" $R/tiff-check $R/verify-url $R/pdf-check $R/jobs "$R/jobs/[id]/[action]"
cat > app/pps-test/page.tsx <<'EOF'
// TEMPORARY local test page for Pattern Print Studio — delete before commit.
import { PatternPrintStudioLoader } from "@/features/pattern-print-studio/PatternPrintStudioLoader";

export default function PpsTestPage() {
  return <PatternPrintStudioLoader exportApi="/api/pps-test-export" />;
}
EOF
cat > $R/preview/route.ts <<'EOF'
// TEMPORARY — delete before commit.
import { preview } from "@/features/pattern-print-studio/export/server/handlers";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  return preview(request);
}
EOF
cat > "$R/assets/[hash]/route.ts" <<'EOF'
// TEMPORARY — delete before commit.
import { assetHead, assetPut } from "@/features/pattern-print-studio/export/server/handlers";
export const runtime = "nodejs";
type Ctx = { params: Promise<{ hash: string }> };
const off = () => process.env.NODE_ENV === "production";
export async function HEAD(_r: Request, ctx: Ctx) {
  return off() ? new Response(null, { status: 404 }) : assetHead((await ctx.params).hash);
}
export async function PUT(request: Request, ctx: Ctx) {
  return off() ? new Response(null, { status: 404 }) : assetPut((await ctx.params).hash, request);
}
EOF
cat > $R/jobs/route.ts <<'EOF'
// TEMPORARY — delete before commit.
import { jobsCreate, jobsList } from "@/features/pattern-print-studio/export/server/handlers";
export const runtime = "nodejs";
const API = "/api/pps-test-export";
const off = () => process.env.NODE_ENV === "production";
export async function GET(request: Request) {
  return off() ? new Response(null, { status: 404 }) : jobsList(API, "test-user", request);
}
export async function POST(request: Request) {
  return off() ? new Response(null, { status: 404 }) : jobsCreate(API, "test-user", request);
}
EOF
cat > "$R/jobs/[id]/[action]/route.ts" <<'EOF'
// TEMPORARY — delete before commit.
import { jobAction, jobDownload } from "@/features/pattern-print-studio/export/server/handlers";
export const runtime = "nodejs";
const API = "/api/pps-test-export";
type Ctx = { params: Promise<{ id: string; action: string }> };
const off = () => process.env.NODE_ENV === "production";
export async function GET(request: Request, ctx: Ctx) {
  if (off()) return new Response(null, { status: 404 });
  const { id, action } = await ctx.params;
  return action === "download" ? jobDownload(id, request) : jobAction(API, "test-user", id, action, request);
}
export async function POST(request: Request, ctx: Ctx) {
  if (off()) return new Response(null, { status: 404 });
  const { id, action } = await ctx.params;
  return jobAction(API, "test-user", id, action, request);
}
EOF
cat > $R/verify-url/route.ts <<EOF
// TEMPORARY — delete before commit. Downloads an export through its signed link, saves it and runs the verification script.
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { verifyTiff } from "@/features/pattern-print-studio/export/verify-tiff.mjs";
export const runtime = "nodejs";
const OUT = "$S";
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  const body = (await request.json()) as { url?: string; name: string; expect: { widthIn: number; heightIn: number; dpi: number } };
  if (!body.url) return Response.json({ ok: true });
  const res = await fetch(new URL(body.url, request.url));
  if (!res.ok) return Response.json({ ok: false, status: res.status });
  const file = path.join(OUT, body.name.replace(/[^A-Za-z0-9._-]/g, "_"));
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  const v = await verifyTiff(file, body.expect);
  return Response.json({ ok: v.ok, checks: v.checks, file });
}
EOF
cat > $R/pdf-check/route.ts <<EOF
// TEMPORARY — delete before commit. Downloads a PDF export, saves it and reads back its page size, layers, images and tile objects.
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString, PDFHexString } from "pdf-lib";
export const runtime = "nodejs";
const OUT = "$S";
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  const body = (await request.json()) as { url: string; name: string };
  const res = await fetch(new URL(body.url, request.url));
  if (!res.ok) return Response.json({ ok: false, status: res.status });
  const bytes = Buffer.from(await res.arrayBuffer());
  const file = path.join(OUT, body.name.replace(/[^A-Za-z0-9._-]/g, "_"));
  await writeFile(file, bytes);
  const pdf = await PDFDocument.load(bytes);
  let images = 0;
  let forms = 0;
  const widths: number[] = [];
  for (const [, obj] of pdf.context.enumerateIndirectObjects()) {
    const dict = (obj as { dict?: PDFDict }).dict;
    if (!dict) continue;
    const subtype = dict.get(PDFName.of("Subtype"));
    if (subtype === PDFName.of("Image") && dict.get(PDFName.of("ColorSpace")) !== PDFName.of("DeviceGray")) { images++; widths.push(Number(String(dict.get(PDFName.of("Width"))))); }
    if (subtype === PDFName.of("Form")) forms++;
  }
  const oc = pdf.catalog.lookup(PDFName.of("OCProperties"), PDFDict);
  const layers = oc.lookup(PDFName.of("OCGs"), PDFArray).asArray().map((r) => { const n = pdf.context.lookup(r, PDFDict).get(PDFName.of("Name")); return n instanceof PDFString || n instanceof PDFHexString ? n.decodeText() : String(n); });
  return Response.json({ ok: true, file, bytes: bytes.length, page: pdf.getPage(0).getSize(), pages: pdf.getPageCount(), layers, images, forms, widths });
}
EOF
cat > $R/tiff-check/route.ts <<EOF
// TEMPORARY — delete before commit. Renders an export to TIFF (plain + mirrored), verifies both and compares with the editor's raster.
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { compareToEditor } from "@/features/pattern-print-studio/export/server/compare";
import { renderInputOf, type ExportRequest } from "@/features/pattern-print-studio/export/server/handlers";
import { prepareScene, renderTiff } from "@/features/pattern-print-studio/export/server/render";
import { verifyTiff } from "@/features/pattern-print-studio/export/verify-tiff.mjs";
export const runtime = "nodejs";
const OUT = "$S";
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  const body = (await request.json()) as { request: ExportRequest; editor?: { png: string; x: number; y: number }; tag: string };
  if (!body.request) return Response.json({ ok: true });
  const req = body.request;
  await writeFile(path.join(OUT, "last-request.json"), JSON.stringify(req));
  const dpi = req.options.dpi;
  const size = { widthIn: req.area.w, heightIn: req.area.h, dpi };
  const run = async (mirror: boolean, name: string) => {
    const scene = await prepareScene(renderInputOf({ ...req, options: { ...req.options, mirror } }, dpi));
    const out = await renderTiff(scene, path.join(OUT, name), { dpi, transparent: false });
    return { ...out, tiles: scene.tiles, warnings: scene.warnings };
  };
  const plain = await run(false, \`\${body.tag}-plain.tif\`);
  const mirror = await run(true, \`\${body.tag}-mirror.tif\`);
  const vPlain = await verifyTiff(plain.file, size);
  const vMirror = await verifyTiff(mirror.file, { ...size, mirror: true, reference: plain.file });
  const vNotMirror = await verifyTiff(plain.file, { ...size, mirror: true, reference: plain.file });
  let compare = null;
  if (body.editor) {
    const png = Buffer.from(body.editor.png.split(",")[1], "base64");
    compare = await compareToEditor(png, { x: (body.editor.x - req.area.x) * dpi, y: (body.editor.y - req.area.y) * dpi }, plain.file, path.join(OUT, \`\${body.tag}-compare.png\`));
  }
  return Response.json({ plain, mirror, vPlain: { ok: vPlain.ok, checks: vPlain.checks }, vMirror: { ok: vMirror.ok, checks: vMirror.checks }, plainFailsMirrorCheck: !vNotMirror.ok, compare });
}
EOF
F=features/pattern-print-studio/__tests__
cp $F/fixtures/leggings-test.svg $F/fixtures/floral-print.png $F/fixtures/repeat-tile.png $F/browser-*.mjs public/
echo "Test page: http://localhost:3000/pps-test  ·  helper output: $S"
