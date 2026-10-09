import { describe, expect, it } from "vitest";
import { buildExtractPrompt, parseGraphicDetection, validateExtractRequest, EXTRACT_DETECT_SYSTEM_PROMPT, NO_GRAPHIC_MESSAGE } from "@/lib/graphic-extractor";

describe("parseGraphicDetection", () => {
  it("reads a found graphic", () => {
    const r = parseGraphicDetection(JSON.stringify({ found: true, kind: "all-over print", description: "  Pink peonies on cream.  ", hasCraft: true, reason: "" }));
    expect(r).toEqual({ found: true, kind: "all-over print", description: "Pink peonies on cream.", hasCraft: true, reason: "" });
  });
  it("reads a photo with nothing to extract", () => {
    const r = parseGraphicDetection(JSON.stringify({ found: false, kind: "other", description: "", hasCraft: false, reason: "A plain navy shirt." }));
    expect(r.found).toBe(false);
    expect(r.reason).toBe("A plain navy shirt.");
  });
  it("treats anything but a true 'found' as not found, and needs a description when found", () => {
    expect(parseGraphicDetection('{"found":"yes","description":"x"}').found).toBe(false);
    expect(() => parseGraphicDetection('{"found":true,"description":""}')).toThrow(/didn't describe/);
    expect(() => parseGraphicDetection("nope")).toThrow(/couldn't be read/);
  });
  it("asks the AI for JSON and for the craft flag", () => {
    expect(EXTRACT_DETECT_SYSTEM_PROMPT).toContain("JSON only");
    expect(EXTRACT_DETECT_SYSTEM_PROMPT).toContain("hasCraft");
    expect(NO_GRAPHIC_MESSAGE).toMatch(/No graphic/);
  });
});

describe("buildExtractPrompt", () => {
  const base = { removeCraft: false, transparent: false, description: "Pink peonies on cream.", kind: "all-over print" };

  it("Remove Craft off: preserves every original element", () => {
    const p = buildExtractPrompt(base);
    expect(p).toContain("Pink peonies");
    expect(p).toContain("(all-over print)");
    expect(p).toContain("Preserve ALL original pattern elements exactly");
    expect(p).not.toContain("craft effects (embroidery");
  });
  it("Remove Craft on: flat pattern, no craft effects or fabric texture", () => {
    const p = buildExtractPrompt({ ...base, removeCraft: true });
    expect(p).toContain("flat pattern without changing the pattern details");
    expect(p).toContain("fabric texture");
    expect(p).not.toContain("Preserve ALL original");
  });
  it("always removes the garment and shows the complete pattern straight on", () => {
    const p = buildExtractPrompt(base);
    expect(p).toContain("COMPLETE pattern");
    expect(p).toContain("Remove the garment, the model, hangers, folds");
  });
  it("transparent: asks for pure white so the background can be cut cleanly", () => {
    expect(buildExtractPrompt({ ...base, transparent: true })).toContain("pure white background");
    expect(buildExtractPrompt(base)).toContain("plain white background");
  });
});

describe("validateExtractRequest", () => {
  const ok = { imageCount: 1, removeCraft: false, transparent: true, mode: "standard", size: "1024x1024", count: 1 };
  it("accepts a good request", () => expect(validateExtractRequest(ok)).toBeNull());
  it("checks every field", () => {
    expect(validateExtractRequest({ ...ok, imageCount: 0 })).toBe("Upload a style image.");
    expect(validateExtractRequest({ ...ok, imageCount: 2 })).toBe("Upload one style image at a time.");
    expect(validateExtractRequest({ ...ok, removeCraft: "yes" })).toBe("Choose the extraction options.");
    expect(validateExtractRequest({ ...ok, mode: "ultra" })).toBe("Choose a generation mode.");
    expect(validateExtractRequest({ ...ok, size: "1x1" })).toBe("Choose an image size.");
    expect(validateExtractRequest({ ...ok, count: 5 })).toMatch(/1 to 4/);
  });
});
