// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OutfitDesignStudio, type OutfitDesignActions } from "@/components/outfit-design/OutfitDesignStudio";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock("@/services/outfit-design", () => ({
  analyzeOutfitAction: vi.fn(),
  generateOutfitAction: vi.fn(),
  regenerateOutfitAction: vi.fn(),
  getOutfitAction: vi.fn(),
  listOutfitsAction: vi.fn(),
  deleteOutfitAction: vi.fn(),
}));

afterEach(() => cleanup());
beforeEach(() => vi.clearAllMocks());

function fakeActions(): OutfitDesignActions {
  return {
    analyze: vi.fn(),
    generate: vi.fn(),
    regenerate: vi.fn(),
    get: vi.fn(),
    list: vi.fn().mockResolvedValue({ success: true, data: [] }),
    remove: vi.fn(),
  } as unknown as OutfitDesignActions;
}

describe("OutfitDesignStudio", () => {
  it("shows Style3D's three steps and keeps Generate off until a photo and a category exist", () => {
    render(<OutfitDesignStudio actions={fakeActions()} />);
    expect(screen.getAllByText("Upload Style Image").length).toBeGreaterThan(0);
    expect(screen.getByText("Matching Categories")).toBeTruthy();
    expect(screen.getByText("Other Parameters")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Generate/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Upload a style image to begin.")).toBeTruthy();
    expect(screen.getByText("Generate coordinated garments from a single top or bottom.")).toBeTruthy();
  });

  it("offers the Upper types, then the Lower types, and shows the choice like Style3D", () => {
    render(<OutfitDesignStudio actions={fakeActions()} />);
    fireEvent.click(screen.getByRole("button", { name: /Select a matching category/ }));
    for (const c of ["Outerwear", "Short Sleeve", "Long Sleeve", "Sleeveless"]) expect(screen.getByRole("button", { name: c })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Lower" }));
    for (const c of ["Shorts", "Short Skirt", "Long Skirt", "Trousers"]) expect(screen.getByRole("button", { name: c })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Outerwear" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Short Skirt" }));
    expect(screen.getByText("Lower / Short Skirt")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("has Standard and Professional generation modes, Standard first", () => {
    render(<OutfitDesignStudio actions={fakeActions()} />);
    const select = screen.getByLabelText("Generation Mode") as HTMLSelectElement;
    expect(select.value).toBe("standard");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Standard", "Professional"]);
    fireEvent.change(select, { target: { value: "professional" } });
    expect(screen.getByText(/Highest detail and fabric accuracy/)).toBeTruthy();
  });

  it("shows the empty History message", async () => {
    render(<OutfitDesignStudio actions={fakeActions()} />);
    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    await waitFor(() => expect(screen.getByText(/No saved outfits yet/)).toBeTruthy());
  });
});
