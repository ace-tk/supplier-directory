import { describe, expect, it } from "vitest";
import { buildOutfitPrompt, describeSourceWorn, isOutfitCategory, outfitCategoryLabel, outfitQuality, validateOutfitRequest, OUTFIT_CATEGORIES } from "@/lib/outfit-design";

describe("categories", () => {
  it("offers Style3D's four upper and four lower types", () => {
    expect(OUTFIT_CATEGORIES.Upper).toEqual(["Outerwear", "Short Sleeve", "Long Sleeve", "Sleeveless"]);
    expect(OUTFIT_CATEGORIES.Lower).toEqual(["Shorts", "Short Skirt", "Long Skirt", "Trousers"]);
  });
  it("only accepts a type that belongs to its group", () => {
    expect(isOutfitCategory("Lower", "Short Skirt")).toBe(true);
    expect(isOutfitCategory("Upper", "Short Skirt")).toBe(false);
    expect(isOutfitCategory("Middle", "Shorts")).toBe(false);
    expect(isOutfitCategory("Upper", 3)).toBe(false);
  });
  it("labels like Style3D does", () => expect(outfitCategoryLabel({ group: "Lower", name: "Short Skirt" })).toBe("Lower / Short Skirt"));
});

describe("modes", () => {
  it("maps Standard to medium quality and Professional to high", () => {
    expect(outfitQuality("standard")).toBe("medium");
    expect(outfitQuality("professional")).toBe("high");
  });
});

describe("describeSourceWorn", () => {
  it("tells a top from a bottom, and falls back when unsure", () => {
    expect(describeSourceWorn("A pinstripe blazer with gold buttons. Garment: blazer.")).toBe("top");
    expect(describeSourceWorn("High-waist denim jeans. Garment: jeans.")).toBe("bottom");
    expect(describeSourceWorn("A jacket and skirt co-ord.")).toBe("garment");
    expect(describeSourceWorn("Something odd.")).toBe("garment");
  });
});

describe("buildOutfitPrompt", () => {
  const base = { match: { group: "Lower" as const, name: "Short Skirt" }, mode: "standard" as const, analysis: "A charcoal pinstripe blazer. Garment: pinstripe blazer." };

  it("keeps the original garment exactly and designs one matching piece of the chosen type", () => {
    const p = buildOutfitPrompt(base);
    expect(p).toContain("pinstripe blazer");
    expect(p).toContain("matching short skirt");
    expect(p).toContain('"Lower / Short Skirt"');
    expect(p).toContain("EXACTLY as in the photo");
    expect(p).toContain("genuinely different garment");
  });
  it("asks for a clean product image with no person", () => {
    const p = buildOutfitPrompt(base);
    expect(p).toContain("No person");
    expect(p).toContain("top above bottom");
  });
  it("adds the extra-detail instruction only in Professional mode", () => {
    expect(buildOutfitPrompt(base)).not.toContain("Professional quality");
    expect(buildOutfitPrompt({ ...base, mode: "professional" })).toContain("Professional quality");
  });
  it("calls an upper match a top", () => {
    expect(buildOutfitPrompt({ ...base, match: { group: "Upper", name: "Sleeveless" } })).toContain("a top, category");
  });
});

describe("validateOutfitRequest", () => {
  const ok = { imageCount: 1, group: "Upper", category: "Outerwear", mode: "standard" };
  it("accepts a good request", () => expect(validateOutfitRequest(ok)).toBeNull());
  it("needs exactly one image", () => {
    expect(validateOutfitRequest({ ...ok, imageCount: 0 })).toBe("Upload a style image.");
    expect(validateOutfitRequest({ ...ok, imageCount: 2 })).toBe("Upload one style image at a time.");
  });
  it("rejects a mismatched category or unknown mode", () => {
    expect(validateOutfitRequest({ ...ok, category: "Trousers" })).toBe("Choose a matching category.");
    expect(validateOutfitRequest({ ...ok, mode: "ultra" })).toBe("Choose a generation mode.");
  });
});
