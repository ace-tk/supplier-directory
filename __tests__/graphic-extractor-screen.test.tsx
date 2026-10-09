// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GraphicExtractorStudio, type GraphicExtractorActions } from "@/components/graphic-extractor/GraphicExtractorStudio";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock("@/services/graphic-extractor", () => ({
  detectGraphicAction: vi.fn(),
  extractGraphicAction: vi.fn(),
  reextractGraphicAction: vi.fn(),
  getGraphicExtractionAction: vi.fn(),
  listGraphicExtractionsAction: vi.fn(),
  deleteGraphicExtractionAction: vi.fn(),
}));

afterEach(() => cleanup());
beforeEach(() => vi.clearAllMocks());

function fakeActions(): GraphicExtractorActions {
  return {
    detect: vi.fn(),
    extract: vi.fn(),
    reextract: vi.fn(),
    get: vi.fn(),
    list: vi.fn().mockResolvedValue({ success: true, data: [] }),
    remove: vi.fn(),
  } as unknown as GraphicExtractorActions;
}

describe("GraphicExtractorStudio", () => {
  it("shows Style3D's two steps and keeps Generate off until a photo is uploaded", () => {
    render(<GraphicExtractorStudio actions={fakeActions()} />);
    expect(screen.getAllByText("Upload Style Image").length).toBeGreaterThan(0);
    expect(screen.getByText("Other Parameters")).toBeTruthy();
    expect(screen.getByText("Detect and extract complete patterns from product or reference images.")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Generate/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Upload a style image to begin.")).toBeTruthy();
  });

  it("has the Remove Craft and Background Transparent switches, both off, and explains each", () => {
    render(<GraphicExtractorStudio actions={fakeActions()} />);
    const craft = screen.getByRole("switch", { name: "Remove Craft" });
    const bg = screen.getByRole("switch", { name: "Background Transparent" });
    expect(craft.getAttribute("aria-checked")).toBe("false");
    expect(bg.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText(/Off: extract the pattern while preserving all original pattern elements/)).toBeTruthy();
    expect(screen.getByText(/automatic background removal/)).toBeTruthy();
    fireEvent.click(craft);
    expect(craft.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(bg);
    expect(bg.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(bg);
    expect(bg.getAttribute("aria-checked")).toBe("false");
  });

  it("has Standard/Professional modes, an image size and a 1-4 image counter", () => {
    render(<GraphicExtractorStudio actions={fakeActions()} />);
    expect((screen.getByLabelText("Generation Mode") as HTMLSelectElement).value).toBe("standard");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Standard", "Professional", "Original", "Square", "Portrait", "Landscape"]);
    const more = screen.getByRole("button", { name: "More images" }) as HTMLButtonElement;
    expect((screen.getByRole("button", { name: "Fewer images" }) as HTMLButtonElement).disabled).toBe(true);
    for (let i = 0; i < 5; i++) fireEvent.click(more);
    expect(document.querySelector("[data-extract-count]")!.textContent).toBe("4");
    expect(more.disabled).toBe(true);
  });

  it("shows the empty History message", async () => {
    render(<GraphicExtractorStudio actions={fakeActions()} />);
    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    await waitFor(() => expect(screen.getByText(/No saved extractions yet/)).toBeTruthy());
  });
});
