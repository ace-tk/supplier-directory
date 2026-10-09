import { beforeEach, describe, expect, it, vi } from "vitest";

const ai = vi.hoisted(() => ({ runVisionChatCompletion: vi.fn(), editImage: vi.fn() }));
const session = vi.hoisted(() => ({ getUser: vi.fn() }));
const store = vi.hoisted(() => ({
  designs: new Map<string, { id: string; ownerId: string; sourceImage: string; styleCategory: string | null; analysis: string | null; name: string }>(),
  versions: [] as { id: string; designId: string; images: string[]; direction: string; order: number }[],
}));

vi.mock("@/lib/ai/openai-client", () => ({ runVisionChatCompletion: ai.runVisionChatCompletion, editImage: ai.editImage, AIConfigError: class extends Error {} }));
vi.mock("@/lib/session", () => ({ getUser: session.getUser }));
vi.mock("@/lib/db", () => ({
  db: {
    imageDesign: {
      create: async ({ data }: { data: { ownerId: string; sourceImage: string; styleCategory: string | null; analysis: string; name: string; versions: { create: { images: string[]; direction: string; order: number }[] } } }) => {
        const id = `d${store.designs.size + 1}`;
        store.designs.set(id, { id, ownerId: data.ownerId, sourceImage: data.sourceImage, styleCategory: data.styleCategory, analysis: data.analysis, name: data.name });
        const v = { id: `v${store.versions.length + 1}`, designId: id, ...data.versions.create[0] };
        store.versions.push(v);
        return { id, versions: [{ id: v.id, createdAt: new Date("2026-10-09T00:00:00Z") }] };
      },
      findUnique: async ({ where }: { where: { id: string } }) => store.designs.get(where.id) ?? null,
      update: async () => ({}),
      delete: async ({ where }: { where: { id: string } }) => void store.designs.delete(where.id),
    },
    imageDesignVersion: {
      count: async ({ where }: { where: { designId: string } }) => store.versions.filter((v) => v.designId === where.designId).length,
      create: async ({ data }: { data: { designId: string; images: string[]; direction: string; order: number } }) => {
        const v = { id: `v${store.versions.length + 1}`, ...data };
        store.versions.push(v);
        return { id: v.id, createdAt: new Date("2026-10-09T00:00:00Z") };
      },
    },
  },
}));

import { readImageAction, generateImageDesignAction, regenerateImageDesignAction, deleteImageDesignAction } from "@/services/image-to-design";

const ADMIN = { id: "admin-1", role: "ADMIN" };
const PHOTO = "data:image/jpeg;base64,/9j/4AAQ";
const READ = JSON.stringify({ analysis: "A sage linen shirt dress.", styles: ["Boho resort"], blocks: ["V-neck"] });

function form(extra: Record<string, string> = {}, images = 1) {
  const f = new FormData();
  for (let i = 0; i < images; i++) f.append("images", new File([new Uint8Array([1, 2, 3])], "style.jpg", { type: "image/jpeg" }));
  f.set("direction", "category");
  f.set("target", "Wide-leg Pants");
  f.set("blocks", "[]");
  f.set("description", "");
  f.set("mode", "standard");
  f.set("size", "1024x1536");
  f.set("count", "1");
  f.set("analysis", "A sage linen shirt dress.");
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  store.designs.clear();
  store.versions.length = 0;
  session.getUser.mockResolvedValue(ADMIN);
  ai.runVisionChatCompletion.mockResolvedValue(READ);
  let n = 0;
  ai.editImage.mockImplementation(async () => `data:image/png;base64,IMG${++n}`);
});

describe("access", () => {
  it("refuses everyone but an admin", async () => {
    session.getUser.mockResolvedValue({ id: "u", role: "BUYER" });
    const settings = { direction: "custom" as const, target: "", blocks: [], description: "x", mode: "standard" as const, size: "1024x1024" as const, count: 1 };
    for (const r of [await readImageAction(form()), await generateImageDesignAction(form()), await regenerateImageDesignAction("d1", settings), await deleteImageDesignAction("d1")]) {
      expect(r).toEqual({ success: false, error: "Admins only." });
    }
    expect(ai.editImage).not.toHaveBeenCalled();
  });
});

describe("readImageAction", () => {
  it("returns the analysis and the picker suggestions from one JSON vision call", async () => {
    const r = await readImageAction(form());
    expect(r).toEqual({ success: true, data: { analysis: "A sage linen shirt dress.", styles: ["Boho resort"], blocks: ["V-neck"] } });
    expect(ai.runVisionChatCompletion).toHaveBeenCalledWith(expect.objectContaining({ json: true, images: [expect.stringMatching(/^data:image\/jpeg;base64,/)] }));
  });
  it("turns an unreadable answer into an error", async () => {
    ai.runVisionChatCompletion.mockResolvedValue("sorry, no");
    expect((await readImageAction(form())).success).toBe(false);
  });
  it("needs exactly one image", async () => {
    expect(await readImageAction(form({}, 0))).toEqual({ success: false, error: "Upload a style image." });
    expect(await readImageAction(form({}, 2))).toEqual({ success: false, error: "Upload one style image at a time." });
  });
});

describe("generateImageDesignAction", () => {
  it("makes one image per requested count, side by side, each told which one it is", async () => {
    const r = await generateImageDesignAction(form({ count: "3", mode: "professional" }));
    expect(r.success).toBe(true);
    expect(ai.editImage).toHaveBeenCalledTimes(3);
    const prompts = ai.editImage.mock.calls.map((c) => c[0].prompt as string);
    expect(prompts[0]).toContain("design 1 of 3");
    expect(prompts[2]).toContain("design 3 of 3");
    expect(ai.editImage.mock.calls[0][0]).toMatchObject({ size: "1024x1536", quality: "high" });
    if (r.success) expect(r.data.version.images).toHaveLength(3);
    expect(store.designs.size).toBe(1);
  });
  it("keeps the images that worked if some fail", async () => {
    ai.editImage.mockReset();
    ai.editImage.mockResolvedValueOnce("data:image/png;base64,A").mockRejectedValueOnce(new Error("busy")).mockResolvedValueOnce("data:image/png;base64,C");
    const r = await generateImageDesignAction(form({ count: "3" }));
    expect(r.success && r.data.version.images).toEqual(["data:image/png;base64,A", "data:image/png;base64,C"]);
  });
  it("fails, saving nothing, when every image fails", async () => {
    ai.editImage.mockReset();
    ai.editImage.mockRejectedValue(new Error("rate limited"));
    expect(await generateImageDesignAction(form({ count: "2" }))).toEqual({ success: false, error: "rate limited" });
    expect(store.designs.size).toBe(0);
  });
  it("uses the direction's own prompt", async () => {
    await generateImageDesignAction(form({ direction: "custom", target: "", description: "change the chest print to a puppy" }));
    expect(ai.editImage.mock.calls[0][0].prompt).toContain("change the chest print to a puppy");
  });
  it("rejects a request missing what its direction needs, without calling the AI", async () => {
    expect((await generateImageDesignAction(form({ target: "" }))).success).toBe(false);
    expect((await generateImageDesignAction(form({ direction: "custom", target: "" }))).success).toBe(false);
    expect((await generateImageDesignAction(form({ count: "9" }))).success).toBe(false);
    expect(ai.editImage).not.toHaveBeenCalled();
  });
  it("will not generate before the garment has been read", async () => {
    expect(await generateImageDesignAction(form({ analysis: "" }))).toEqual({ success: false, error: "The garment has not been read yet." });
  });
});

describe("regenerateImageDesignAction", () => {
  beforeEach(() => {
    store.designs.set("d1", { id: "d1", ownerId: ADMIN.id, sourceImage: PHOTO, styleCategory: "Dresses", analysis: "Denim jacket.", name: "x" });
    store.versions.push({ id: "v1", designId: "d1", images: ["a"], direction: "style", order: 0 });
  });
  const settings = { direction: "style" as const, target: "Retro sportswear", blocks: [], description: "", mode: "standard" as const, size: "1024x1024" as const, count: 2 };

  it("reuses the stored photo, read and category, and appends a run", async () => {
    const r = await regenerateImageDesignAction("d1", settings);
    expect(r.success).toBe(true);
    expect(ai.editImage).toHaveBeenCalledTimes(2);
    expect(ai.editImage.mock.calls[0][0].prompt).toContain("Denim jacket");
    expect(ai.editImage.mock.calls[0][0].prompt).toContain("Retro sportswear");
    expect(ai.editImage.mock.calls[0][0].prompt).toContain("category: Dresses");
    expect(store.versions.filter((v) => v.designId === "d1")).toHaveLength(2);
  });
  it("does not touch another admin's design", async () => {
    store.designs.get("d1")!.ownerId = "someone-else";
    expect(await regenerateImageDesignAction("d1", settings)).toEqual({ success: false, error: "Image design not found." });
    expect(await deleteImageDesignAction("d1")).toEqual({ success: false, error: "Image design not found." });
  });
});
