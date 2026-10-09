import { beforeEach, describe, expect, it, vi } from "vitest";

const ai = vi.hoisted(() => ({ runVisionChatCompletion: vi.fn(), editImage: vi.fn() }));
const session = vi.hoisted(() => ({ getUser: vi.fn() }));
const store = vi.hoisted(() => ({
  outfits: new Map<string, { id: string; ownerId: string; sourceImage: string; analysis: string | null; name: string }>(),
  versions: [] as { id: string; outfitId: string; matchGroup: string; matchCategory: string; mode: string; order: number }[],
}));

vi.mock("@/lib/ai/openai-client", () => ({ runVisionChatCompletion: ai.runVisionChatCompletion, editImage: ai.editImage, AIConfigError: class extends Error {} }));
vi.mock("@/lib/session", () => ({ getUser: session.getUser }));
vi.mock("@/lib/db", () => ({
  db: {
    outfitDesign: {
      create: async ({ data }: { data: { ownerId: string; sourceImage: string; analysis: string; name: string; versions: { create: { matchGroup: string; matchCategory: string; mode: string; order: number }[] } } }) => {
        const id = `o${store.outfits.size + 1}`;
        store.outfits.set(id, { id, ownerId: data.ownerId, sourceImage: data.sourceImage, analysis: data.analysis, name: data.name });
        const v = { id: `v${store.versions.length + 1}`, outfitId: id, ...data.versions.create[0] };
        store.versions.push(v);
        return { id, versions: [{ id: v.id, createdAt: new Date("2026-10-09T00:00:00Z") }] };
      },
      findUnique: async ({ where }: { where: { id: string } }) => store.outfits.get(where.id) ?? null,
      update: async () => ({}),
      delete: async ({ where }: { where: { id: string } }) => void store.outfits.delete(where.id),
    },
    outfitDesignVersion: {
      count: async ({ where }: { where: { outfitId: string } }) => store.versions.filter((v) => v.outfitId === where.outfitId).length,
      create: async ({ data }: { data: { outfitId: string; matchGroup: string; matchCategory: string; mode: string; order: number } }) => {
        const v = { id: `v${store.versions.length + 1}`, ...data };
        store.versions.push(v);
        return { id: v.id, createdAt: new Date("2026-10-09T00:00:00Z") };
      },
    },
  },
}));

import { analyzeOutfitAction, generateOutfitAction, regenerateOutfitAction, deleteOutfitAction } from "@/services/outfit-design";

const ADMIN = { id: "admin-1", role: "ADMIN" };
const PHOTO = "data:image/jpeg;base64,/9j/4AAQ";

function form(extra: Record<string, string> = {}, images = 1) {
  const f = new FormData();
  for (let i = 0; i < images; i++) f.append("images", new File([new Uint8Array([1, 2, 3])], "style.jpg", { type: "image/jpeg" }));
  f.set("group", "Lower");
  f.set("category", "Short Skirt");
  f.set("mode", "standard");
  f.set("analysis", "A pinstripe blazer. Garment: blazer.");
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  store.outfits.clear();
  store.versions.length = 0;
  session.getUser.mockResolvedValue(ADMIN);
  ai.runVisionChatCompletion.mockResolvedValue("  A pinstripe blazer. Garment: blazer.  ");
  ai.editImage.mockResolvedValue("data:image/png;base64,RESULT");
});

describe("access", () => {
  it("refuses everyone but an admin", async () => {
    session.getUser.mockResolvedValue({ id: "u", role: "BUYER" });
    for (const r of [await analyzeOutfitAction(form()), await generateOutfitAction(form()), await regenerateOutfitAction("o1", "Lower", "Shorts", "standard"), await deleteOutfitAction("o1")]) {
      expect(r).toEqual({ success: false, error: "Admins only." });
    }
    expect(ai.editImage).not.toHaveBeenCalled();
  });
});

describe("analyzeOutfitAction", () => {
  it("reads the garment with the vision model and trims the answer", async () => {
    expect(await analyzeOutfitAction(form())).toEqual({ success: true, data: "A pinstripe blazer. Garment: blazer." });
  });
  it("needs exactly one image", async () => {
    expect(await analyzeOutfitAction(form({}, 0))).toEqual({ success: false, error: "Upload a style image." });
    expect(await analyzeOutfitAction(form({}, 2))).toEqual({ success: false, error: "Upload one style image at a time." });
  });
});

describe("generateOutfitAction", () => {
  it("generates one tall outfit image at medium quality in Standard mode and saves it", async () => {
    const r = await generateOutfitAction(form());
    expect(r.success).toBe(true);
    const call = ai.editImage.mock.calls[0][0];
    expect(call.size).toBe("1024x1536");
    expect(call.quality).toBe("medium");
    expect(call.prompt).toContain("matching short skirt");
    expect(store.outfits.size).toBe(1);
    if (r.success) expect(r.data.version).toMatchObject({ matchGroup: "Lower", matchCategory: "Short Skirt", mode: "standard", image: "data:image/png;base64,RESULT" });
  });
  it("uses high quality in Professional mode", async () => {
    await generateOutfitAction(form({ mode: "professional" }));
    expect(ai.editImage.mock.calls[0][0].quality).toBe("high");
    expect(ai.editImage.mock.calls[0][0].prompt).toContain("Professional quality");
  });
  it("will not generate before the garment has been analysed", async () => {
    expect(await generateOutfitAction(form({ analysis: "" }))).toEqual({ success: false, error: "The garment has not been analysed yet." });
    expect(ai.editImage).not.toHaveBeenCalled();
  });
  it("rejects a category from the wrong group or an unknown mode without calling the AI", async () => {
    expect((await generateOutfitAction(form({ group: "Upper", category: "Trousers" }))).success).toBe(false);
    expect((await generateOutfitAction(form({ mode: "ultra" }))).success).toBe(false);
    expect(ai.editImage).not.toHaveBeenCalled();
  });
  it("turns an AI failure into an error message, saving nothing", async () => {
    ai.editImage.mockRejectedValue(new Error("rate limited"));
    expect(await generateOutfitAction(form())).toEqual({ success: false, error: "rate limited" });
    expect(store.outfits.size).toBe(0);
  });
});

describe("regenerateOutfitAction", () => {
  beforeEach(() => {
    store.outfits.set("o1", { id: "o1", ownerId: ADMIN.id, sourceImage: PHOTO, analysis: "Denim jeans. Garment: jeans.", name: "x" });
    store.versions.push({ id: "v1", outfitId: "o1", matchGroup: "Upper", matchCategory: "Sleeveless", mode: "standard", order: 0 });
  });
  it("reuses the stored photo and analysis, takes the new category and mode, and appends a version", async () => {
    const r = await regenerateOutfitAction("o1", "Upper", "Outerwear", "professional");
    expect(r.success).toBe(true);
    const call = ai.editImage.mock.calls[0][0];
    expect(call.prompt).toContain("Denim jeans");
    expect(call.prompt).toContain("matching outerwear");
    expect(call.quality).toBe("high");
    expect(store.versions.filter((v) => v.outfitId === "o1")).toHaveLength(2);
  });
  it("rejects a category that does not belong to the group", async () => {
    expect((await regenerateOutfitAction("o1", "Upper", "Shorts", "standard")).success).toBe(false);
    expect(ai.editImage).not.toHaveBeenCalled();
  });
  it("does not touch another admin's outfit", async () => {
    store.outfits.get("o1")!.ownerId = "someone-else";
    expect(await regenerateOutfitAction("o1", "Lower", "Shorts", "standard")).toEqual({ success: false, error: "Outfit not found." });
    expect(await deleteOutfitAction("o1")).toEqual({ success: false, error: "Outfit not found." });
  });
});
