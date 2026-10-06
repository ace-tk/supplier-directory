import { beforeEach, describe, expect, it, vi } from "vitest";

// Fake AI answers and fake storage: no network, no database.
const ai = vi.hoisted(() => ({
  runVisionChatCompletion: vi.fn(),
  editImage: vi.fn(),
}));
const session = vi.hoisted(() => ({ getUser: vi.fn() }));
const store = vi.hoisted(() => ({
  proposals: new Map<string, { id: string; ownerId: string; sourceImages: string[] }>(),
  versions: new Map<string, { id: string; proposalId: string; collectionCount: number; model: string; coreDNA: string[]; looks: unknown; lookImages: string[] }>(),
}));

vi.mock("@/lib/ai/openai-client", () => ({
  runVisionChatCompletion: ai.runVisionChatCompletion,
  editImage: ai.editImage,
  AIConfigError: class extends Error {},
}));
vi.mock("@/lib/session", () => ({ getUser: session.getUser }));
vi.mock("@/lib/db", () => ({
  db: {
    collectionProposal: {
      findUnique: async ({ where }: { where: { id: string } }) => store.proposals.get(where.id) ?? null,
      update: async () => ({}),
    },
    collectionProposalVersion: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const v = store.versions.get(where.id);
        if (!v) return null;
        const p = store.proposals.get(v.proposalId)!;
        return { ...v, proposal: { ownerId: p.ownerId, sourceImages: p.sourceImages } };
      },
      update: async ({ where, data }: { where: { id: string }; data: { lookImages: string[] } }) => {
        const v = store.versions.get(where.id)!;
        Object.assign(v, data);
        return { ...v, createdAt: new Date("2026-10-06T00:00:00Z") };
      },
    },
  },
}));

import { analyzeCollectionAction, generateLookAction, finishCollectionVersionAction } from "@/services/collection-proposal";

const ADMIN = { id: "admin-1", role: "ADMIN" };
const PHOTO = "data:image/jpeg;base64,/9j/4AAQ";
const MODEL = "A woman in her late twenties, dark hair, medium build.";
const DNA = ["Minimal", "Ribbed cotton", "Ivory and navy", "Relaxed A-line", "Tonal stitching", "Premium basics"];

function planJson(count: number) {
  return JSON.stringify({
    model: MODEL,
    coreDNA: DNA,
    looks: Array.from({ length: count }, (_, i) => ({ title: `Look ${i + 1}`, details: ["a", "b", "c"], description: `Outfit ${i + 1}` })),
  });
}

function photoForm(count: number) {
  const form = new FormData();
  form.append("images", new File([new Uint8Array([1, 2, 3])], "bestseller.jpg", { type: "image/jpeg" }));
  form.set("count", String(count));
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  store.proposals.clear();
  store.versions.clear();
  session.getUser.mockResolvedValue(ADMIN);
  store.proposals.set("p1", { id: "p1", ownerId: ADMIN.id, sourceImages: [PHOTO] });
  store.versions.set("v1", { id: "v1", proposalId: "p1", collectionCount: 2, model: MODEL, coreDNA: DNA, looks: [{ title: "Look 1", details: ["a", "b", "c"], description: "Outfit 1" }, { title: "Look 2", details: ["a", "b", "c"], description: "Outfit 2" }], lookImages: [] });
});

describe("analyzeCollectionAction", () => {
  it("returns the plan from a JSON vision reply, asking the AI for JSON", async () => {
    ai.runVisionChatCompletion.mockResolvedValue(planJson(3));
    const result = await analyzeCollectionAction(photoForm(3));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.looks).toHaveLength(3);
    expect(ai.runVisionChatCompletion).toHaveBeenCalledWith(expect.objectContaining({ json: true, images: [expect.stringMatching(/^data:image\/jpeg;base64,/)] }));
  });

  it("turns an incomplete AI plan into a message for the user", async () => {
    ai.runVisionChatCompletion.mockResolvedValue(planJson(2));
    const result = await analyzeCollectionAction(photoForm(3));
    expect(result).toEqual({ success: false, error: "The AI's collection plan was incomplete. Please generate again." });
  });

  it("refuses non-admins before calling the AI", async () => {
    session.getUser.mockResolvedValue({ id: "u", role: "USER" });
    const result = await analyzeCollectionAction(photoForm(2));
    expect(result).toEqual({ success: false, error: "Admins only." });
    expect(ai.runVisionChatCompletion).not.toHaveBeenCalled();
  });
});

describe("generateLookAction", () => {
  it("draws one look from the stored photos and that look's plan, at portrait size", async () => {
    ai.editImage.mockResolvedValue("data:image/png;base64,AAAA");
    const result = await generateLookAction("p1", "v1", 1);
    expect(result).toEqual({ success: true, data: "data:image/png;base64,AAAA" });
    const call = ai.editImage.mock.calls[0][0];
    expect(call.size).toBe("1024x1536");
    expect(call.image).toHaveLength(1);
    expect(call.prompt).toContain("Outfit 2");
    expect(call.prompt).toContain("A woman in her late twenties");
  });

  it("refuses a look index that the version does not have", async () => {
    const result = await generateLookAction("p1", "v1", 5);
    expect(result.success).toBe(false);
    expect(ai.editImage).not.toHaveBeenCalled();
  });

  it("refuses a collection that belongs to another admin", async () => {
    store.proposals.set("p1", { id: "p1", ownerId: "someone-else", sourceImages: [PHOTO] });
    const result = await generateLookAction("p1", "v1", 0);
    expect(result).toEqual({ success: false, error: "Collection not found." });
    expect(ai.editImage).not.toHaveBeenCalled();
  });
});

describe("finishCollectionVersionAction", () => {
  const img = "data:image/png;base64,AAAA";

  it("saves the images in board order once every look is there", async () => {
    const result = await finishCollectionVersionAction("p1", "v1", [img, img]);
    expect(result.success).toBe(true);
    expect(store.versions.get("v1")!.lookImages).toEqual([img, img]);
  });

  it("does not save an incomplete board", async () => {
    const result = await finishCollectionVersionAction("p1", "v1", [img]);
    expect(result).toEqual({ success: false, error: "Not every look has an image yet." });
    expect(store.versions.get("v1")!.lookImages).toEqual([]);
  });

  it("rejects something that is not an image data URL", async () => {
    const result = await finishCollectionVersionAction("p1", "v1", [img, "https://example.com/x.png"]);
    expect(result.success).toBe(false);
  });
});
