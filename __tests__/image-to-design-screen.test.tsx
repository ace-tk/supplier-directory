// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ImageToDesignStudio, type ImageToDesignActions } from "@/components/image-to-design/ImageToDesignStudio";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock("@/services/image-to-design", () => ({
  readImageAction: vi.fn(),
  generateImageDesignAction: vi.fn(),
  regenerateImageDesignAction: vi.fn(),
  getImageDesignAction: vi.fn(),
  listImageDesignsAction: vi.fn(),
  deleteImageDesignAction: vi.fn(),
}));

afterEach(() => cleanup());
beforeEach(() => vi.clearAllMocks());

function fakeActions(): ImageToDesignActions {
  return {
    read: vi.fn(),
    generate: vi.fn(),
    regenerate: vi.fn(),
    get: vi.fn(),
    list: vi.fn().mockResolvedValue({ success: true, data: [] }),
    remove: vi.fn(),
  } as unknown as ImageToDesignActions;
}

describe("ImageToDesignStudio", () => {
  it("shows the steps and keeps Generate off until a photo and the direction's target exist", () => {
    render(<ImageToDesignStudio actions={fakeActions()} />);
    expect(screen.getAllByText("Upload Style Image").length).toBeGreaterThan(0);
    expect(screen.getByText("Select Redesign Direction and Target")).toBeTruthy();
    expect(screen.getByText("Create new style options from an existing garment image.")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Generate/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Upload a style image to begin.")).toBeTruthy();
  });

  it("offers the four directions, Type first, and changes the labels when you switch", () => {
    render(<ImageToDesignStudio actions={fakeActions()} />);
    const radios = screen.getAllByRole("radio", { name: /^(Type|Style|Shape|Custom)$/ });
    expect(radios.map((r) => r.textContent)).toEqual(["Type", "Style", "Shape", "Custom"]);
    expect(radios[0].getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Category Description")).toBeTruthy();
    expect(screen.getByText("Target Category")).toBeTruthy();
    expect(screen.getByPlaceholderText("e.g. niche designer shirt dress...")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "Style" }));
    expect(screen.getByText("Style Description")).toBeTruthy();
    expect(screen.getByText("Target Style")).toBeTruthy();
    expect(screen.getByPlaceholderText("e.g. bohemian resort style...")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "Shape" }));
    expect(screen.getByText("Silhouette Description")).toBeTruthy();
    expect(screen.getByText("Common Block Elements")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    expect(screen.queryByText("Target Style")).toBeNull();
    expect(screen.queryByText("Common Block Elements")).toBeNull();
    expect(screen.getByPlaceholderText(/change the chest print to a puppy/)).toBeTruthy();
  });

  it("lists the grouped target categories and shows the chosen one", () => {
    render(<ImageToDesignStudio actions={fakeActions()} />);
    // buttons named "Select": [0] Style Category (optional), [1] Target Category
    fireEvent.click(screen.getAllByRole("button", { name: "Select" })[1]);
    const dialog = screen.getByRole("dialog", { name: "Target Category" });
    for (const g of ["Tops", "Bottoms", "One-piece", "Sets"]) expect(dialog.textContent).toContain(g);
    fireEvent.click(screen.getByRole("button", { name: "Trench Coats" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Trench Coats")).toBeTruthy();
  });

  it("asks for a photo before suggesting styles", () => {
    render(<ImageToDesignStudio actions={fakeActions()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Style" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Select" })[1]);
    expect(screen.queryByRole("dialog", { name: "Target Style" })).toBeNull();
  });

  it("has Standard/Professional modes, an image size and a 1-4 image counter", () => {
    render(<ImageToDesignStudio actions={fakeActions()} />);
    expect((screen.getByLabelText("Generation Mode") as HTMLSelectElement).value).toBe("standard");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Standard", "Professional", "Original", "Square", "Portrait", "Landscape"]);
    const more = screen.getByRole("button", { name: "More images" });
    const fewer = screen.getByRole("button", { name: "Fewer images" }) as HTMLButtonElement;
    expect(fewer.disabled).toBe(true);
    for (let i = 0; i < 5; i++) fireEvent.click(more);
    expect(document.querySelector("[data-image-count]")!.textContent).toBe("4");
    expect((more as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the empty History message", async () => {
    render(<ImageToDesignStudio actions={fakeActions()} />);
    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    await waitFor(() => expect(screen.getByText(/No saved designs yet/)).toBeTruthy());
  });
});
