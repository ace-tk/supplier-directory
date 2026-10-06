// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { CollectionBoard } from "@/components/collection-proposal/CollectionBoard";
import { CollectionBoardStudio, type CollectionActions } from "@/components/collection-proposal/CollectionBoardStudio";

// The studio module imports the real server actions; the tests pass fakes in,
// so the database and the AI client are never loaded.
vi.mock("@/services/collection-proposal", () => ({
  analyzeCollectionAction: vi.fn(),
  createCollectionAction: vi.fn(),
  createCollectionVersionAction: vi.fn(),
  deleteCollectionAction: vi.fn(),
  finishCollectionVersionAction: vi.fn(),
  generateLookAction: vi.fn(),
  getCollectionAction: vi.fn(),
  listCollectionsAction: vi.fn(),
}));

const PHOTO = "data:image/jpeg;base64,UEhPVE8=";
const IMG = (n: number) => `data:image/png;base64,LOOK${n}`;
const DNA = ["Minimal", "Ribbed cotton", "Ivory and navy", "Relaxed A-line", "Tonal stitching", "Premium basics"];
const plan = {
  model: "A woman in her late twenties, dark hair.",
  coreDNA: DNA,
  looks: [1, 2, 3].map((n) => ({ title: `Title ${n}`, details: [`Bullet ${n}a`, `Bullet ${n}b`, `Bullet ${n}c`], description: `Outfit ${n}` })),
};
const savedVersion = {
  id: "v1",
  collectionCount: 3,
  model: plan.model,
  coreDNA: DNA,
  looks: plan.looks,
  lookImages: [IMG(1), IMG(2), IMG(3)],
  createdAt: "2026-10-06T00:00:00.000Z",
};

function fakeActions(overrides: Partial<CollectionActions> = {}): CollectionActions {
  return {
    analyze: vi.fn(async () => ({ success: true as const, data: plan })),
    create: vi.fn(async () => ({ success: true as const, data: { proposalId: "p1", versionId: "v1", plan } })),
    createVersion: vi.fn(async () => ({ success: true as const, data: { versionId: "v2", plan } })),
    generateLook: vi.fn(async (_p: string, _v: string, i: number) => ({ success: true as const, data: IMG(i + 1) })),
    finish: vi.fn(async () => ({ success: true as const, data: { ...savedVersion, id: "v2" } })),
    get: vi.fn(async () => ({ success: true as const, data: { id: "p1", name: "Collection proposal", sourceImages: [PHOTO], versions: [savedVersion] } })),
    list: vi.fn(async () => ({ success: true as const, data: [] })),
    remove: vi.fn(async () => ({ success: true as const, data: undefined })),
    ...overrides,
  } as unknown as CollectionActions;
}

afterEach(() => {
  cleanup();
});

describe("CollectionBoard", () => {
  it("draws every look with its LOOK number, title and three bullets, and the Core DNA strip", () => {
    const { container } = render(<CollectionBoard looks={plan.looks} coreDNA={DNA} lookImages={[IMG(1), IMG(2), IMG(3)]} />);
    expect(container.querySelectorAll("[data-look]")).toHaveLength(3);
    for (const n of [1, 2, 3]) {
      expect(screen.getByText(`LOOK ${n}`)).toBeTruthy();
      expect(screen.getByText(`Title ${n}`)).toBeTruthy();
      expect(screen.getByText(`Bullet ${n}b`)).toBeTruthy();
    }
    expect(screen.getByText("CORE DNA")).toBeTruthy();
    for (const k of DNA) expect(screen.getByText(k)).toBeTruthy();
  });

  it("keeps all board text as HTML, not in the image: each image has only its alt text", () => {
    const { container } = render(<CollectionBoard looks={plan.looks} coreDNA={DNA} lookImages={[IMG(1), IMG(2), IMG(3)]} />);
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs).toHaveLength(3);
    expect(imgs[0].getAttribute("alt")).toBe("Look 1: Title 1");
  });
});

describe("CollectionBoardStudio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens a saved collection from the URL and shows its board", async () => {
    const actions = fakeActions();
    render(<CollectionBoardStudio openId="p1" actions={actions} />);
    expect(await screen.findByText("LOOK 3")).toBeTruthy();
    expect(actions.get).toHaveBeenCalledWith("p1");
    expect(screen.getByText("CORE DNA")).toBeTruthy();
    expect(screen.getByText("Regenerate")).toBeTruthy();
  });

  it("keeps the uploads counter and Generate disabled until a photo is added", () => {
    render(<CollectionBoardStudio actions={fakeActions()} />);
    expect(screen.getByText("(0/9)")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Generate" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Upload a bestseller image to begin.")).toBeTruthy();
  });

  it("shows Collection Count defaulting to 4 and ranging 1–9, with no category or format control", () => {
    render(<CollectionBoardStudio actions={fakeActions()} />);
    expect(screen.getByText("4", { selector: "[data-collection-count]" })).toBeTruthy();
    const slider = screen.getByRole("slider") as HTMLInputElement;
    expect(slider.min).toBe("1");
    expect(slider.max).toBe("9");
    expect(screen.queryByText("Output Format")).toBeNull();
    expect(screen.queryByText("Select style category")).toBeNull();
  });

  it("draws each look and saves the board when a collection is generated", async () => {
    const actions = fakeActions();
    render(<CollectionBoardStudio openId="p1" actions={actions} />);
    await screen.findByText("LOOK 3");
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));

    await waitFor(() => expect(screen.getByText("Boards (2)")).toBeTruthy());
    // The same plan is reused for Regenerate, so the new board's text matches the old one.
    expect(actions.createVersion).toHaveBeenCalledWith("p1", 3, JSON.stringify({ model: plan.model, coreDNA: DNA, looks: plan.looks }));
    expect(actions.generateLook).toHaveBeenCalledTimes(3);
    for (const i of [0, 1, 2]) expect(actions.generateLook).toHaveBeenCalledWith("p1", "v2", i);
    expect(actions.finish).toHaveBeenCalledWith("p1", "v2", [IMG(1), IMG(2), IMG(3)]);
  });

  it("does not show a half-drawn board when a look fails, and says why", async () => {
    const { toast } = await import("sonner");
    const errorSpy = vi.spyOn(toast, "error");
    const actions = fakeActions({
      generateLook: vi.fn(async (_p: string, _v: string, i: number) => (i === 1 ? { success: false as const, error: "The AI didn't return an image. Please try again." } : { success: true as const, data: IMG(i + 1) })),
    } as Partial<CollectionActions>);
    render(<CollectionBoardStudio openId="p1" actions={actions} />);
    await screen.findByText("LOOK 3");
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith("The AI didn't return an image. Please try again."));
    expect(actions.finish).not.toHaveBeenCalled();
    expect(screen.queryByText("Boards (2)")).toBeNull();
  });

  it("lists saved collections in History and deletes one after confirmation", async () => {
    const actions = fakeActions({
      list: vi.fn(async () => ({ success: true as const, data: [{ id: "p1", name: "Collection proposal", thumbnail: null, latest: IMG(1), versions: 1, updatedAt: "2026-10-06T00:00:00.000Z" }] })),
    } as Partial<CollectionActions>);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<CollectionBoardStudio actions={actions} />);
    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    const item = await screen.findByText("Collection proposal");
    const card = item.closest("[data-history-item]") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "Delete Collection proposal" }));
    await waitFor(() => expect(actions.remove).toHaveBeenCalledWith("p1"));
  });
});
