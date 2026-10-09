import { describe, expect, it } from "vitest";
import {
  buildImageDesignPrompt,
  clampImageCount,
  IMAGE_DIRECTIONS,
  parseImageRead,
  sizeForAspect,
  TARGET_CATEGORIES,
  TARGET_CATEGORY_GROUPS,
  validateImageDesignRequest,
} from "@/lib/image-to-design";

describe("directions and categories", () => {
  it("has Style3D's four directions with their own labels and pickers", () => {
    expect(IMAGE_DIRECTIONS.map((d) => d.label)).toEqual(["Type", "Style", "Shape", "Custom"]);
    expect(IMAGE_DIRECTIONS.map((d) => d.pickerLabel)).toEqual(["Target Category", "Target Style", "Common Block Elements", null]);
    expect(IMAGE_DIRECTIONS.map((d) => d.descriptionLabel)).toEqual(["Category Description", "Style Description", "Silhouette Description", "Style Description"]);
  });
  it("offers Style3D's target categories in four groups", () => {
    expect(TARGET_CATEGORY_GROUPS.map((g) => g.group)).toEqual(["Tops", "Bottoms", "One-piece", "Sets"]);
    expect(TARGET_CATEGORIES).toHaveLength(22);
    expect(TARGET_CATEGORIES).toContain("Trench Coats");
    expect(TARGET_CATEGORIES).toContain("Slip Dresses");
  });
});

describe("sizeForAspect", () => {
  it("keeps the upload's shape: wide, tall or about square", () => {
    expect(sizeForAspect(1600, 1000)).toBe("1536x1024");
    expect(sizeForAspect(800, 1200)).toBe("1024x1536");
    expect(sizeForAspect(1000, 1000)).toBe("1024x1024");
    expect(sizeForAspect(0, 0)).toBe("1024x1024");
  });
});

describe("clampImageCount", () => {
  it("stays between 1 and 4", () => {
    expect([0, 1, 3, 4, 9, NaN].map(clampImageCount)).toEqual([1, 1, 3, 4, 4, 1]);
  });
});

describe("parseImageRead", () => {
  it("reads the analysis and cleans the suggestion lists", () => {
    const r = parseImageRead(JSON.stringify({ analysis: "  A linen shirt dress.  ", styles: ["Boho resort", "boho resort", "  Minimal  ", 3, ""], blocks: ["V-neck", "Puff sleeves"] }));
    expect(r).toEqual({ analysis: "A linen shirt dress.", styles: ["Boho resort", "Minimal"], blocks: ["V-neck", "Puff sleeves"] });
  });
  it("tolerates missing lists but needs an analysis", () => {
    expect(parseImageRead('{"analysis":"A coat."}')).toEqual({ analysis: "A coat.", styles: [], blocks: [] });
    expect(() => parseImageRead('{"styles":["x"]}')).toThrow(/didn't describe/);
    expect(() => parseImageRead("not json")).toThrow(/couldn't be read/);
  });
});

describe("buildImageDesignPrompt", () => {
  const base = { analysis: "A linen shirt dress in sage green.", index: 1, total: 1 };

  it("category: redesigns as the target category in the same fabric and colours", () => {
    const p = buildImageDesignPrompt({ ...base, direction: "category", target: "Wide-leg Pants", description: "relaxed" });
    expect(p).toContain("Redesign it as a Wide-leg Pants");
    expect(p).toContain("same fabric, colour palette");
    expect(p).toContain("Design notes: relaxed.");
  });
  it("style: restyles with the chosen style and description", () => {
    const p = buildImageDesignPrompt({ ...base, direction: "style", target: "Bohemian resort", description: "with tassels" });
    expect(p).toContain("Bohemian resort — with tassels");
    expect(p).toContain("recognisably the same type of garment");
  });
  it("shape: fixes the chosen block elements and redesigns the rest", () => {
    const p = buildImageDesignPrompt({ ...base, direction: "shape", blocks: ["V-neckline", "Puff sleeves"], description: "white linen" });
    expect(p).toContain("fixed block of the design: V-neckline, Puff sleeves");
    expect(p).toContain("white linen");
  });
  it("shape without elements keeps the overall silhouette", () => {
    expect(buildImageDesignPrompt({ ...base, direction: "shape", description: "red" })).toContain("Keep the overall silhouette");
  });
  it("custom: changes only what is asked", () => {
    const p = buildImageDesignPrompt({ ...base, direction: "custom", description: "change the chest print to a puppy" });
    expect(p).toContain("Make exactly this change to the garment: change the chest print to a puppy.");
    expect(p).toContain("Change only what that asks for");
  });
  it("asks several images to be different interpretations, and one image not to", () => {
    expect(buildImageDesignPrompt({ ...base, direction: "style", target: "Retro", index: 2, total: 3 })).toContain("design 2 of 3");
    expect(buildImageDesignPrompt({ ...base, direction: "style", target: "Retro" })).not.toContain("design 1 of");
  });
  it("keeps an optional category and bans text and logos", () => {
    const p = buildImageDesignPrompt({ ...base, direction: "style", target: "Retro", styleCategory: "Dresses" });
    expect(p).toContain("category: Dresses");
    expect(p).toContain("remain a dresses garment");
    expect(p).toContain("No text");
  });
});

describe("validateImageDesignRequest", () => {
  const ok = { imageCount: 1, direction: "category", target: "Jeans", description: "", mode: "standard", size: "1024x1024", count: 1 };
  it("accepts a good request", () => expect(validateImageDesignRequest(ok)).toBeNull());
  it("needs exactly one image", () => {
    expect(validateImageDesignRequest({ ...ok, imageCount: 0 })).toBe("Upload a style image.");
    expect(validateImageDesignRequest({ ...ok, imageCount: 2 })).toBe("Upload one style image at a time.");
  });
  it("each direction asks for what it needs", () => {
    expect(validateImageDesignRequest({ ...ok, target: "" })).toBe("Choose a target category.");
    expect(validateImageDesignRequest({ ...ok, target: "Capes" })).toBe("Choose a target category.");
    expect(validateImageDesignRequest({ ...ok, direction: "style", target: "" })).toBe("Choose a target style or describe the style.");
    expect(validateImageDesignRequest({ ...ok, direction: "style", target: "", description: "boho" })).toBeNull();
    expect(validateImageDesignRequest({ ...ok, direction: "shape", target: "", blocks: [] })).toMatch(/block elements/);
    expect(validateImageDesignRequest({ ...ok, direction: "shape", target: "", blocks: ["V-neck"] })).toBeNull();
    expect(validateImageDesignRequest({ ...ok, direction: "custom", target: "" })).toBe("Describe the change you want.");
    expect(validateImageDesignRequest({ ...ok, direction: "custom", target: "", description: "red" })).toBeNull();
    expect(validateImageDesignRequest({ ...ok, direction: "paint" })).toBe("Choose a redesign direction.");
  });
  it("checks limits", () => {
    expect(validateImageDesignRequest({ ...ok, description: "x".repeat(501) })).toMatch(/at most 500/);
    expect(validateImageDesignRequest({ ...ok, direction: "shape", target: "", blocks: Array.from({ length: 9 }, (_, i) => `b${i}`) })).toMatch(/at most 8/);
    expect(validateImageDesignRequest({ ...ok, count: 5 })).toMatch(/1 to 4/);
    expect(validateImageDesignRequest({ ...ok, mode: "ultra" })).toBe("Choose a generation mode.");
    expect(validateImageDesignRequest({ ...ok, size: "512x512" })).toBe("Choose an image size.");
    expect(validateImageDesignRequest({ ...ok, styleCategory: "Capes" })).toBe("Choose a valid style category.");
  });
});
