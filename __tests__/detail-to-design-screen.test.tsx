// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DetailToDesignStudio, type DetailToDesignActions } from "@/components/detail-to-design/DetailToDesignStudio";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock("@/services/detail-to-design", () => ({
  analyzeDetailAction: vi.fn(),
  generateDetailDesignAction: vi.fn(),
  regenerateDetailDesignAction: vi.fn(),
  getDetailDesignAction: vi.fn(),
  listDetailDesignsAction: vi.fn(),
  deleteDetailDesignAction: vi.fn(),
}));

afterEach(() => cleanup());

function fakeActions(): DetailToDesignActions {
  return {
    analyze: vi.fn().mockResolvedValue({ success: true, data: "A patch pocket. Detail: patch pocket." }),
    generate: vi.fn().mockResolvedValue({ success: true, data: { id: "d1", version: { id: "v1", image: "data:image/png;base64,AAA", outputFormat: "on-model", designCount: 4, createdAt: "2026-10-09T00:00:00Z" } } }),
    regenerate: vi.fn(),
    get: vi.fn(),
    list: vi.fn().mockResolvedValue({ success: true, data: [] }),
    remove: vi.fn(),
  } as unknown as DetailToDesignActions;
}

beforeEach(() => vi.clearAllMocks());

describe("DetailToDesignStudio", () => {
  it("shows the four steps and keeps Generate off until a detail and category exist", () => {
    render(<DetailToDesignStudio actions={fakeActions()} />);
    expect(screen.getAllByText("Upload Detail Image").length).toBeGreaterThan(0);
    expect(screen.getByText("Reference Brand or Style")).toBeTruthy();
    expect(screen.getAllByText("Style Category").length).toBeGreaterThan(0);
    expect(screen.getByText("Select Output Content")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Generate/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Upload a detail image to begin.")).toBeTruthy();
  });

  it("offers the nine categories and the three output types", () => {
    render(<DetailToDesignStudio actions={fakeActions()} />);
    fireEvent.click(screen.getByRole("button", { name: /Select/ }));
    for (const c of ["Tops", "Bottoms", "Dresses", "Sets", "Outerwear", "Innerwear", "Hats", "Shoes", "Bags"]) expect(screen.getByRole("button", { name: c })).toBeTruthy();
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["On-Model Image", "Flat-Lay Image", "Keep Original Image Effect"]);
  });

  it("filters categories as you type", () => {
    render(<DetailToDesignStudio actions={fakeActions()} />);
    fireEvent.click(screen.getByRole("button", { name: /Select/ }));
    fireEvent.change(screen.getByLabelText("Search style categories"), { target: { value: "sh" } });
    expect(screen.getByRole("button", { name: "Shoes" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tops" })).toBeNull();
  });

  it("adds a style idea to the reference box and counts characters", () => {
    render(<DetailToDesignStudio actions={fakeActions()} />);
    fireEvent.click(screen.getByRole("button", { name: "Streetwear" }));
    expect((screen.getByRole("textbox", { name: "Reference brand or style" }) as HTMLTextAreaElement).value).toBe("Streetwear");
    expect(screen.getByText("10/300")).toBeTruthy();
  });

  it("starts with the design count at 4 and lets it move between 1 and 9", () => {
    render(<DetailToDesignStudio actions={fakeActions()} />);
    const slider = screen.getByLabelText("Design Count") as HTMLInputElement;
    expect(slider.value).toBe("4");
    expect(slider.min).toBe("1");
    expect(slider.max).toBe("9");
    fireEvent.change(slider, { target: { value: "7" } });
    expect(document.querySelector("[data-design-count]")!.textContent).toBe("7");
  });

  it("shows the empty History message", async () => {
    render(<DetailToDesignStudio actions={fakeActions()} />);
    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    await waitFor(() => expect(screen.getByText(/No saved designs yet/)).toBeTruthy());
  });
});
