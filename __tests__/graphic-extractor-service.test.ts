import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const ai = vi.hoisted(() => ({ runVisionChatCompletion: vi.fn(), editImage: vi.fn() }));
const session = vi.hoisted(() => ({ getUser: vi.fn() }));
const store = vi.hoisted(() => ({
  rows: new Map<string, { id: string; ownerId: string; sourceImage: string; kind: string | null; description: string | null; hasCraft: boolean; name: string }>(),
  versions: [] as { id: string; extractionId: string; images: string[]; order: number }[],
}));

vi.mock("@/lib/ai/openai-client", () => ({ runVisionChatCompletion: ai.runVisionChatCompletion, editImage: ai.editImage, AIConfigError: class extends Error {} }));
vi.mock("@/lib/session", () => ({ getUser: session.getUser }));
vi.mock("@/lib/db", () => ({
  db: {
    graphicExtraction: {
      create: async ({ data }: { data: { ownerId: string; sourceImage: string; kind: string | null; description: string; hasCraft: boolean; name: string; versions: { create: { images: string[]; order: number }[] } } }) => {
        const id = `g${store.rows.size + 1}`;
        store.rows.set(id, { id, ownerId: data.ownerId, sourceImage: data.sourceImage, kind: data.kind, description: data.description, hasCraft: data.hasCraft, name: data.name });
        const v = { id: `v${store.versions.length + 1}`, extractionId: id, ...data.versions.create[0] };
        store.versions.push(v);
        return { id, versions: [{ id: v.id, createdAt: new Date("2026-10-10T00:00:00Z") }] };
      },
      findUnique: async ({ where }: { where: { id: string } }) => store.rows.get(where.id) ?? null,
      update: async () => ({}),
      delete: async ({ where }: { where: { id: string } }) => void store.rows.delete(where.id),
    },
    graphicExtractionVersion: {
      count: async ({ where }: { where: { extractionId: string } }) => store.versions.filter((v) => v.extractionId === where.extractionId).length,
      create: async ({ data }: { data: { extractionId: string; images: string[]; order: number } }) => {
        const v = { id: `v${store.versions.length + 1}`, ...data };
        store.versions.push(v);
        return { id: v.id, createdAt: new Date("2026-10-10T00:00:00Z") };
      },
    },
  },
}));

import { detectGraphicAction, extractGraphicAction, reextractGraphicAction, deleteGraphicExtractionAction } from "@/services/graphic-extractor";

const ADMIN = { id: "admin-1", role: "ADMIN" };
const PHOTO = "data:image/jpeg;base64,/9j/4AAQ";
const FOUND = JSON.stringify({ found: true, kind: "all-over print", description: "Pink peonies on cream.", hasCraft: false, reason: "" });

/** A real 40x40 PNG: a red square on a plain white background. */
async function whiteBackgroundPng(): Promise<string> {
  const png = await sharp({ create: { width: 40, height: 40, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite([{ input: await sharp({ create: { width: 16, height: 16, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } } }).png().toBuffer(), left: 12, top: 12 }])
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}
/** A busy 40x40 image whose border is not a plain colour. */
async function busyPng(): Promise<string> {
  const raw = Buffer.alloc(40 * 40 * 4);
  for (let i = 0; i < 40 * 40; i++) {
    raw[i * 4] = (i * 37) % 256;
    raw[i * 4 + 1] = (i * 91) % 256;
    raw[i * 4 + 2] = (i * 13) % 256;
    raw[i * 4 + 3] = 255;
  }
  const png = await sharp(raw, { raw: { width: 40, height: 40, channels: 4 } }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}
async function alphaOf(dataUrl: string, x: number, y: number) {
  const { data, info } = await sharp(Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return data[(y * info.width + x) * 4 + 3];
}

function form(extra: Record<string, string> = {}, images = 1) {
  const f = new FormData();
  for (let i = 0; i < images; i++) f.append("images", new File([new Uint8Array([1, 2, 3])], "style.jpg", { type: "image/jpeg" }));
  f.set("removeCraft", "false");
  f.set("transparent", "false");
  f.set("mode", "standard");
  f.set("size", "1024x1024");
  f.set("count", "1");
  f.set("description", "Pink peonies on cream.");
  f.set("kind", "all-over print");
  f.set("hasCraft", "false");
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return f;
}

beforeEach(async () => {
  vi.clearAllMocks();
  store.rows.clear();
  store.versions.length = 0;
  session.getUser.mockResolvedValue(ADMIN);
  ai.runVisionChatCompletion.mockResolvedValue(FOUND);
  const png = await whiteBackgroundPng();
  ai.editImage.mockResolvedValue(png);
});

describe("access", () => {
  it("refuses everyone but an admin", async () => {
    session.getUser.mockResolvedValue({ id: "u", role: "BUYER" });
    const s = { removeCraft: false, transparent: false, mode: "standard" as const, size: "1024x1024" as const, count: 1 };
    for (const r of [await detectGraphicAction(form()), await extractGraphicAction(form()), await reextractGraphicAction("g1", s), await deleteGraphicExtractionAction("g1")]) {
      expect(r).toEqual({ success: false, error: "Admins only." });
    }
    expect(ai.editImage).not.toHaveBeenCalled();
  });
});

describe("detectGraphicAction", () => {
  it("returns what was found, from one JSON vision call", async () => {
    const r = await detectGraphicAction(form());
    expect(r).toEqual({ success: true, data: { found: true, kind: "all-over print", description: "Pink peonies on cream.", hasCraft: false, reason: "" } });
    expect(ai.runVisionChatCompletion).toHaveBeenCalledWith(expect.objectContaining({ json: true }));
  });
  it("says so, without going further, when there is no graphic on the photo", async () => {
    ai.runVisionChatCompletion.mockResolvedValue(JSON.stringify({ found: false, kind: "other", description: "", hasCraft: false, reason: "A plain navy shirt." }));
    const r = await detectGraphicAction(form());
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toContain("No graphic or pattern was found");
    if (!r.success) expect(r.error).toContain("A plain navy shirt.");
  });
  it("needs exactly one image", async () => {
    expect(await detectGraphicAction(form({}, 0))).toEqual({ success: false, error: "Upload a style image." });
    expect(await detectGraphicAction(form({}, 2))).toEqual({ success: false, error: "Upload one style image at a time." });
  });
});

describe("extractGraphicAction", () => {
  it("extracts, saves and keeps the white background when transparency is off", async () => {
    const r = await extractGraphicAction(form());
    expect(r.success).toBe(true);
    expect(ai.editImage).toHaveBeenCalledTimes(1);
    expect(ai.editImage.mock.calls[0][0]).toMatchObject({ size: "1024x1024", quality: "medium" });
    expect(ai.editImage.mock.calls[0][0].prompt).toContain("Preserve ALL original");
    if (r.success) {
      expect(await alphaOf(r.data.version.images[0], 0, 0)).toBe(255);
      expect(r.data.version.warning).toBeUndefined();
    }
    expect(store.rows.size).toBe(1);
  });

  it("Background Transparent: really cuts the plain background out and keeps the graphic", async () => {
    const r = await extractGraphicAction(form({ transparent: "true" }));
    expect(r.success).toBe(true);
    if (r.success) {
      const img = r.data.version.images[0];
      expect(img.startsWith("data:image/png;base64,")).toBe(true);
      expect(await alphaOf(img, 0, 0)).toBe(0);
      expect(await alphaOf(img, 39, 39)).toBe(0);
      expect(await alphaOf(img, 20, 20)).toBe(255);
      expect(r.data.version.warning).toBeUndefined();
    }
  });

  it("warns, and keeps the image, when the background can't be cut cleanly", async () => {
    ai.editImage.mockResolvedValue(await busyPng());
    const r = await extractGraphicAction(form({ transparent: "true" }));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.version.warning).toMatch(/couldn't be removed cleanly/);
  });

  it("Remove Craft changes the prompt and Professional asks for high quality", async () => {
    await extractGraphicAction(form({ removeCraft: "true", mode: "professional" }));
    const call = ai.editImage.mock.calls[0][0];
    expect(call.prompt).toContain("flat pattern without changing the pattern details");
    expect(call.quality).toBe("high");
  });

  it("makes one extraction per requested image, and keeps the ones that worked", async () => {
    const png = await whiteBackgroundPng();
    ai.editImage.mockReset();
    ai.editImage.mockResolvedValueOnce(png).mockRejectedValueOnce(new Error("busy")).mockResolvedValueOnce(png);
    const r = await extractGraphicAction(form({ count: "3" }));
    expect(ai.editImage).toHaveBeenCalledTimes(3);
    expect(r.success && r.data.version.images).toHaveLength(2);
  });

  it("fails, saving nothing, when every extraction fails", async () => {
    ai.editImage.mockReset();
    ai.editImage.mockRejectedValue(new Error("rate limited"));
    expect(await extractGraphicAction(form())).toEqual({ success: false, error: "rate limited" });
    expect(store.rows.size).toBe(0);
  });

  it("rejects bad input without calling the AI", async () => {
    expect((await extractGraphicAction(form({ count: "9" }))).success).toBe(false);
    expect((await extractGraphicAction(form({ mode: "ultra" }))).success).toBe(false);
    expect(await extractGraphicAction(form({ description: "" }))).toEqual({ success: false, error: "The graphic has not been detected yet." });
    expect(ai.editImage).not.toHaveBeenCalled();
  });
});

describe("reextractGraphicAction", () => {
  beforeEach(() => {
    store.rows.set("g1", { id: "g1", ownerId: ADMIN.id, sourceImage: PHOTO, kind: "embroidery", description: "A gold crest.", hasCraft: true, name: "x" });
    store.versions.push({ id: "v1", extractionId: "g1", images: ["a"], order: 0 });
  });
  const settings = { removeCraft: true, transparent: true, mode: "standard" as const, size: "1024x1536" as const, count: 1 };

  it("reuses the stored photo and detection, takes the new options and appends a run", async () => {
    const r = await reextractGraphicAction("g1", settings);
    expect(r.success).toBe(true);
    const call = ai.editImage.mock.calls[0][0];
    expect(call.prompt).toContain("A gold crest.");
    expect(call.prompt).toContain("(embroidery)");
    expect(call.prompt).toContain("flat pattern without changing");
    expect(call.size).toBe("1024x1536");
    expect(store.versions.filter((v) => v.extractionId === "g1")).toHaveLength(2);
    if (r.success) expect(await alphaOf(r.data.images[0], 0, 0)).toBe(0);
  });
  it("does not touch another admin's extraction", async () => {
    store.rows.get("g1")!.ownerId = "someone-else";
    expect(await reextractGraphicAction("g1", settings)).toEqual({ success: false, error: "Extraction not found." });
    expect(await deleteGraphicExtractionAction("g1")).toEqual({ success: false, error: "Extraction not found." });
  });
});
