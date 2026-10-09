import { beforeEach, describe, expect, it, vi } from "vitest";

const ai = vi.hoisted(() => ({ runVisionChatCompletion: vi.fn(), editImage: vi.fn() }));
const session = vi.hoisted(() => ({ getUser: vi.fn() }));
const store = vi.hoisted(() => ({
  designs: new Map<string, { id: string; kind?: string; ownerId: string; sourceImage: string; styleCategory: string; referenceStyle: string | null; analysis: string | null; name: string }>(),
  versions: [] as { id: string; designId: string; designCount: number; order: number }[],
}));

vi.mock("@/lib/ai/openai-client", () => ({ runVisionChatCompletion: ai.runVisionChatCompletion, editImage: ai.editImage, AIConfigError: class extends Error {} }));
vi.mock("@/lib/session", () => ({ getUser: session.getUser }));
vi.mock("@/lib/db", () => ({
  db: {
    detailDesign: {
      create: async ({ data }: { data: { kind?: string; ownerId: string; sourceImage: string; styleCategory: string; referenceStyle: string | null; analysis: string; name: string; versions: { create: { designCount: number; order: number }[] } } }) => {
        const id = `d${store.designs.size + 1}`;
        store.designs.set(id, { id, kind: data.kind, ownerId: data.ownerId, sourceImage: data.sourceImage, styleCategory: data.styleCategory, referenceStyle: data.referenceStyle, analysis: data.analysis, name: data.name });
        const v = { id: `v${store.versions.length + 1}`, designId: id, designCount: data.versions.create[0].designCount, order: 0 };
        store.versions.push(v);
        return { id, versions: [{ id: v.id, createdAt: new Date("2026-10-09T00:00:00Z") }] };
      },
      findUnique: async ({ where }: { where: { id: string } }) => store.designs.get(where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: { referenceStyle: string | null } }) => {
        Object.assign(store.designs.get(where.id)!, { referenceStyle: data.referenceStyle });
        return {};
      },
      delete: async ({ where }: { where: { id: string } }) => void store.designs.delete(where.id),
    },
    detailDesignVersion: {
      count: async ({ where }: { where: { designId: string } }) => store.versions.filter((v) => v.designId === where.designId).length,
      create: async ({ data }: { data: { designId: string; designCount: number; order: number } }) => {
        const v = { id: `v${store.versions.length + 1}`, ...data };
        store.versions.push(v);
        return { id: v.id, createdAt: new Date("2026-10-09T00:00:00Z") };
      },
    },
  },
}));

import { analyzeDetailAction, generateDetailDesignAction, regenerateDetailDesignAction, deleteDetailDesignAction } from "@/services/detail-to-design";

const ADMIN = { id: "admin-1", role: "ADMIN" };
const PHOTO = "data:image/jpeg;base64,/9j/4AAQ";

function form(extra: Record<string, string> = {}, images = 1) {
  const f = new FormData();
  for (let i = 0; i < images; i++) f.append("images", new File([new Uint8Array([1, 2, 3])], "detail.jpg", { type: "image/jpeg" }));
  f.set("styleCategory", "Dresses");
  f.set("outputFormat", "on-model");
  f.set("designCount", "4");
  f.set("analysis", "A scalloped V-neck. Detail: scalloped V-neck.");
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  store.designs.clear();
  store.versions.length = 0;
  session.getUser.mockResolvedValue(ADMIN);
  ai.runVisionChatCompletion.mockResolvedValue("  A scalloped V-neck. Detail: scalloped V-neck.  ");
  ai.editImage.mockResolvedValue("data:image/png;base64,RESULT");
});

describe("access", () => {
  it("refuses everyone but an admin", async () => {
    session.getUser.mockResolvedValue({ id: "u", role: "BUYER" });
    for (const r of [await analyzeDetailAction(form()), await generateDetailDesignAction(form()), await regenerateDetailDesignAction("d1", "on-model", 4), await deleteDetailDesignAction("d1")]) {
      expect(r).toEqual({ success: false, error: "Admins only." });
    }
    expect(ai.editImage).not.toHaveBeenCalled();
  });
});

describe("analyzeDetailAction", () => {
  it("reads the detail with the vision model and trims the answer", async () => {
    const r = await analyzeDetailAction(form());
    expect(r).toEqual({ success: true, data: "A scalloped V-neck. Detail: scalloped V-neck." });
    expect(ai.runVisionChatCompletion).toHaveBeenCalledWith(expect.objectContaining({ images: [expect.stringMatching(/^data:image\/jpeg;base64,/)] }));
  });
  it("needs exactly one image", async () => {
    expect(await analyzeDetailAction(form({}, 0))).toEqual({ success: false, error: "Upload a detail image." });
    expect(await analyzeDetailAction(form({}, 2))).toEqual({ success: false, error: "Upload one detail image at a time." });
  });
});

describe("generateDetailDesignAction", () => {
  it("generates one sheet at the right size, saves the design and returns version 1", async () => {
    const r = await generateDetailDesignAction(form({ referenceStyle: "romantic" }));
    expect(r.success).toBe(true);
    const call = ai.editImage.mock.calls[0][0];
    expect(call.prompt).toContain("exactly 4 panels");
    expect(call.prompt).toContain("romantic");
    expect(call.size).toBe("1024x1536"); // 2x2 on-model grid
    expect(store.designs.size).toBe(1);
    if (r.success) expect(r.data.version).toMatchObject({ outputFormat: "on-model", designCount: 4, image: "data:image/png;base64,RESULT" });
  });
  it("will not generate before the detail has been analysed", async () => {
    expect(await generateDetailDesignAction(form({ analysis: "" }))).toEqual({ success: false, error: "The garment detail has not been analysed yet." });
    expect(ai.editImage).not.toHaveBeenCalled();
  });
  it("rejects a bad category or count without calling the AI", async () => {
    expect((await generateDetailDesignAction(form({ styleCategory: "Capes" }))).success).toBe(false);
    expect((await generateDetailDesignAction(form({ designCount: "12" }))).success).toBe(false);
    expect(ai.editImage).not.toHaveBeenCalled();
  });
  it("turns an AI failure into an error message, saving nothing", async () => {
    ai.editImage.mockRejectedValue(new Error("rate limited"));
    expect(await generateDetailDesignAction(form())).toEqual({ success: false, error: "rate limited" });
    expect(store.designs.size).toBe(0);
  });
});

describe("regenerateDetailDesignAction", () => {
  beforeEach(() => {
    store.designs.set("d1", { id: "d1", ownerId: ADMIN.id, sourceImage: PHOTO, styleCategory: "Tops", referenceStyle: "minimal", analysis: "A pocket. Detail: patch pocket.", name: "x" });
    store.versions.push({ id: "v1", designId: "d1", designCount: 4, order: 0 });
  });
  it("reuses the stored photo and analysis and appends a version (never overwrites)", async () => {
    const r = await regenerateDetailDesignAction("d1", "flat-lay", 3);
    expect(r.success).toBe(true);
    expect(ai.editImage.mock.calls[0][0].prompt).toContain("patch pocket");
    expect(ai.editImage.mock.calls[0][0].prompt).toContain("minimal"); // stored style reused
    expect(store.versions.filter((v) => v.designId === "d1")).toHaveLength(2);
  });
  it("lets a new style replace the stored one", async () => {
    await regenerateDetailDesignAction("d1", "flat-lay", 3, "streetwear");
    expect(ai.editImage.mock.calls[0][0].prompt).toContain("streetwear");
    expect(store.designs.get("d1")!.referenceStyle).toBe("streetwear");
  });
  it("does not touch another admin's design", async () => {
    store.designs.get("d1")!.ownerId = "someone-else";
    expect(await regenerateDetailDesignAction("d1", "flat-lay", 3)).toEqual({ success: false, error: "Detail design not found." });
    expect(await deleteDetailDesignAction("d1")).toEqual({ success: false, error: "Detail design not found." });
  });
});

describe("Fabric to Design (same engine, kind = fabric)", () => {
  it("reads a fabric with the fabric prompt", async () => {
    await analyzeDetailAction(form({ kind: "fabric" }));
    expect(ai.runVisionChatCompletion).toHaveBeenCalledWith(expect.objectContaining({ system: expect.stringContaining("FABRIC"), user: expect.stringContaining("fabric") }));
  });
  it("defaults to the detail prompt when no kind is sent", async () => {
    await analyzeDetailAction(form());
    expect(ai.runVisionChatCompletion).toHaveBeenCalledWith(expect.objectContaining({ system: expect.stringContaining("ONE garment detail") }));
  });
  it("generates with the fabric prompt and saves the design as a fabric design", async () => {
    const r = await generateDetailDesignAction(form({ kind: "fabric" }));
    expect(r.success).toBe(true);
    expect(ai.editImage.mock.calls[0][0].prompt).toContain("made entirely from this fabric");
    expect([...store.designs.values()][0].kind).toBe("fabric");
    expect([...store.designs.values()][0].name).toBe("Dresses fabric design");
  });
  it("regenerates a saved fabric design with the fabric prompt", async () => {
    store.designs.set("f1", { id: "f1", kind: "fabric", ownerId: ADMIN.id, sourceImage: PHOTO, styleCategory: "Tops", referenceStyle: null, analysis: "Silk satin. Fabric: satin.", name: "x" });
    await regenerateDetailDesignAction("f1", "on-model", 2);
    expect(ai.editImage.mock.calls[0][0].prompt).toContain("made entirely from this fabric");
  });
  it("says fabric, not detail, when it has not been analysed", async () => {
    expect(await generateDetailDesignAction(form({ kind: "fabric", analysis: "" }))).toEqual({ success: false, error: "The fabric has not been analysed yet." });
  });
});
