#!/usr/bin/env node
// Checks that an exported TIFF is what the printer needs. It reads the TIFF's
// own tags straight from the file (not through an image library), so it is
// an independent check of what a RIP or Photoshop will see.
//
//   node features/pattern-print-studio/export/verify-tiff.mjs out.tif --width 163.75 --height 37.694 --dpi 150
//        [--mirror --reference plain.tif]   the file must be `plain.tif` flipped left-right
//        [--transparent]                    expect an alpha channel
//
// Checks: pixel size = round(inches × DPI) · XResolution / YResolution = DPI,
// unit = inch · 8-bit RGB · LZW · an sRGB ICC profile is embedded · mirror.
// Exit code 0 = all passed. Also usable as a module: verifyTiff(), readTiffTags().

import { open } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 16: 8 };

/** The first image's tags, read from the file: classic TIFF and BigTIFF, either byte order. */
export async function readTiffTags(file) {
  const fh = await open(file, "r");
  try {
    const read = async (pos, len) => {
      const b = Buffer.alloc(len);
      await fh.read(b, 0, len, pos);
      return b;
    };
    const head = await read(0, 16);
    const order = head.toString("latin1", 0, 2);
    if (order !== "II" && order !== "MM") throw new Error("Not a TIFF file.");
    const le = order === "II";
    const u16 = (b, o) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
    const u32 = (b, o) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
    const u64 = (b, o) => Number(le ? b.readBigUInt64LE(o) : b.readBigUInt64BE(o));
    const magic = u16(head, 2);
    if (magic !== 42 && magic !== 43) throw new Error("Not a TIFF file.");
    const big = magic === 43;
    const ifd = big ? u64(head, 8) : u32(head, 4);
    const count = big ? u64(await read(ifd, 8), 0) : u16(await read(ifd, 2), 0);
    const entrySize = big ? 20 : 12;
    const table = await read(ifd + (big ? 8 : 2), count * entrySize);
    const raw = new Map();
    for (let i = 0; i < count; i++) {
      const o = i * entrySize;
      const type = u16(table, o + 2);
      const n = big ? u64(table, o + 4) : u32(table, o + 4);
      const valuePos = o + (big ? 12 : 8);
      const inline = (TYPE_SIZE[type] ?? 1) * n <= (big ? 8 : 4);
      raw.set(u16(table, o), { type, n, at: inline ? ifd + (big ? 8 : 2) + valuePos : big ? u64(table, valuePos) : u32(table, valuePos) });
    }
    const value = async (tag) => {
      const e = raw.get(tag);
      if (!e) return undefined;
      const b = await read(e.at, Math.min((TYPE_SIZE[e.type] ?? 1) * e.n, 1 << 22));
      if (e.type === 2) return b.toString("utf8").replace(/\0+$/, "");
      if (e.type === 5) return { numerator: u32(b, 0), denominator: u32(b, 4), value: u32(b, 0) / u32(b, 4), at: e.at };
      if (e.type === 7 || e.type === 1) return e.n === 1 ? b[0] : b;
      const one = (k) => (e.type === 3 ? u16(b, k * 2) : e.type === 4 ? u32(b, k * 4) : u64(b, k * 8));
      return e.n === 1 ? one(0) : Array.from({ length: e.n }, (_, k) => one(k));
    };
    const icc = await value(34675);
    return {
      bigTiff: big,
      littleEndian: le,
      width: await value(256),
      height: await value(257),
      bitsPerSample: [await value(258)].flat(),
      compression: await value(259),
      photometric: await value(262),
      samplesPerPixel: await value(277),
      xResolution: await value(282),
      yResolution: await value(283),
      resolutionUnit: await value(296),
      description: await value(270),
      icc: Buffer.isBuffer(icc) ? icc : null,
    };
  } finally {
    await fh.close();
  }
}

/** True if an ICC profile is an RGB profile that calls itself sRGB. */
export function isSrgbProfile(icc) {
  if (!icc || icc.length < 132 || icc.toString("latin1", 16, 20) !== "RGB ") return false;
  return icc.includes("sRGB", 0, "latin1") || icc.includes(Buffer.from("sRGB", "utf16le").swap16());
}

/**
 * Writes the resolution tags as the exact fraction DPI/1 (or ×1000 for a
 * fractional DPI), so every program shows precisely the intended size.
 */
export async function setTiffResolution(file, dpi) {
  const tags = await readTiffTags(file);
  const exact = Number.isInteger(dpi) ? [dpi, 1] : [Math.round(dpi * 1000), 1000];
  const fh = await open(file, "r+");
  try {
    for (const r of [tags.xResolution, tags.yResolution]) {
      if (!r) throw new Error("The TIFF has no resolution tags.");
      const b = Buffer.alloc(8);
      if (tags.littleEndian) {
        b.writeUInt32LE(exact[0], 0);
        b.writeUInt32LE(exact[1], 4);
      } else {
        b.writeUInt32BE(exact[0], 0);
        b.writeUInt32BE(exact[1], 4);
      }
      await fh.write(b, 0, 8, r.at);
    }
  } finally {
    await fh.close();
  }
}

/** Mean difference (0–255) between a file and a reference, with the reference flipped left-right or not. Samples a small copy of each. */
async function mirrorDistances(file, reference) {
  const { default: sharp } = await import("sharp");
  const small = (f, flop) => {
    let s = sharp(f, { limitInputPixels: false }).flatten({ background: "#ffffff" }).resize({ width: 600, height: 600, fit: "fill" });
    if (flop) s = s.flop();
    return s.raw().toBuffer();
  };
  const [a, same, flipped] = await Promise.all([small(file, false), small(reference, false), small(reference, true)]);
  const mean = (x, y) => {
    let d = 0;
    for (let i = 0; i < x.length; i++) d += Math.abs(x[i] - y[i]);
    return d / x.length;
  };
  return { toReference: mean(a, same), toFlippedReference: mean(a, flipped) };
}

/**
 * expect: { widthIn, heightIn, dpi, transparent?, mirror?, reference? }
 * Returns { ok, checks: [{ name, ok, detail }], tags }.
 */
export async function verifyTiff(file, expect) {
  const tags = await readTiffTags(file);
  const checks = [];
  const check = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });
  const w = Math.max(1, Math.round(expect.widthIn * expect.dpi));
  const h = Math.max(1, Math.round(expect.heightIn * expect.dpi));
  check("pixel size = round(inches × DPI)", tags.width === w && tags.height === h, `${tags.width} × ${tags.height} px, expected ${w} × ${h}`);
  const xr = tags.xResolution?.value;
  const yr = tags.yResolution?.value;
  check("XResolution / YResolution = DPI, unit = inch", tags.resolutionUnit === 2 && Math.abs(xr - expect.dpi) < 1e-6 && Math.abs(yr - expect.dpi) < 1e-6, `${tags.xResolution?.numerator}/${tags.xResolution?.denominator} × ${tags.yResolution?.numerator}/${tags.yResolution?.denominator}, unit ${tags.resolutionUnit === 2 ? "inch" : tags.resolutionUnit === 3 ? "cm" : tags.resolutionUnit}`);
  check("opens at the intended size", Math.abs(tags.width / xr - expect.widthIn) <= 0.5 / expect.dpi + 1e-9 && Math.abs(tags.height / yr - expect.heightIn) <= 0.5 / expect.dpi + 1e-9, `${(tags.width / xr).toFixed(3)} × ${(tags.height / yr).toFixed(3)} in, expected ${expect.widthIn} × ${expect.heightIn} in`);
  const channels = expect.transparent ? 4 : 3;
  check(`8-bit ${expect.transparent ? "RGB + alpha" : "RGB"}`, tags.photometric === 2 && tags.samplesPerPixel === channels && tags.bitsPerSample.length === channels && tags.bitsPerSample.every((b) => b === 8), `photometric ${tags.photometric}, ${tags.samplesPerPixel} × ${tags.bitsPerSample.join("/")} bit`);
  check("LZW compression", tags.compression === 5, `compression ${tags.compression}`);
  check("sRGB ICC profile embedded", isSrgbProfile(tags.icc), tags.icc ? `${tags.icc.length} byte profile` : "no profile");
  const needBig = w * h * channels > 3.9e9;
  check(needBig ? "BigTIFF (over 4 GB of pixels)" : "classic TIFF", tags.bigTiff === needBig, tags.bigTiff ? "BigTIFF" : "classic");
  if (expect.reference) {
    const d = await mirrorDistances(file, expect.reference);
    // A mirrored render is not bit-identical to a flipped one (antialiasing lands differently), but it is far closer to it.
    const symmetrical = d.toReference < 0.5 && d.toFlippedReference < 0.5;
    const flipped = d.toFlippedReference * 2 < d.toReference;
    const same = d.toReference * 2 < d.toFlippedReference;
    check(
      expect.mirror ? "mirror applied (the reference, flipped left-right)" : "not mirrored (matches the reference)",
      symmetrical || (expect.mirror ? flipped : same),
      `difference to reference ${d.toReference.toFixed(2)}, to flipped reference ${d.toFlippedReference.toFixed(2)} (0–255)${symmetrical ? " — the picture is left-right symmetrical, so this cannot be told apart" : ""}`
    );
  }
  return { ok: checks.every((c) => c.ok), checks, tags };
}

async function main(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mirror" || a === "--transparent") args[a.slice(2)] = true;
    else if (a.startsWith("--")) args[a.slice(2)] = argv[++i];
    else args._.push(a);
  }
  const file = args._[0];
  if (!file || !args.width || !args.height || !args.dpi) {
    console.error("Usage: verify-tiff.mjs <file.tif> --width <inches> --height <inches> --dpi <dpi> [--transparent] [--mirror --reference <plain.tif>]");
    return 2;
  }
  const result = await verifyTiff(file, { widthIn: +args.width, heightIn: +args.height, dpi: +args.dpi, transparent: !!args.transparent, mirror: !!args.mirror, reference: args.reference });
  for (const c of result.checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name} — ${c.detail}`);
  console.log(result.ok ? "\nAll checks passed." : "\nSome checks FAILED.");
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(err.message);
      process.exit(2);
    }
  );
}
