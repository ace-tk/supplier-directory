import { describe, expect, it } from "vitest";
import { buildFabricToDesignPrompt, FABRIC_ANALYSIS_SYSTEM_PROMPT, REFERENCE_PROMPTS, buildDetailToDesignPrompt, validateDetailRequest, DETAIL_REFERENCE_MAX_CHARS, DETAIL_ANALYSIS_SYSTEM_PROMPT } from "@/lib/detail-to-design";

describe("buildDetailToDesignPrompt", () => {
  const base = { styleCategory: "Dresses" as const, outputFormat: "on-model" as const, count: 4, analysis: "A scalloped V-neckline with piping. Detail: scalloped V-neck." };

  it("builds the detail in as the hero feature and asks for exactly N panels", () => {
    const p = buildDetailToDesignPrompt(base);
    expect(p).toContain("scalloped V-neckline");
    expect(p).toContain("exactly 4 panels");
    expect(p).toContain('"Dresses"');
    expect(p).toContain("hero feature");
  });

  it("adds the style direction only when one is given, and never asks to copy branding", () => {
    expect(buildDetailToDesignPrompt(base)).not.toContain("Style direction");
    const p = buildDetailToDesignPrompt({ ...base, referenceStyle: "  romantic and soft  " });
    expect(p).toContain("Style direction to lean towards: romantic and soft.");
    expect(p).toContain("do not copy any logo, name or branding");
  });

  it("asks for a single image for one concept and a flat-lay without a person", () => {
    const one = buildDetailToDesignPrompt({ ...base, count: 1, outputFormat: "flat-lay" });
    expect(one).toContain("single image");
    expect(one).toContain("No person");
    expect(one).not.toContain("contact sheet");
  });

  it("keeps the count inside 1-9", () => {
    expect(buildDetailToDesignPrompt({ ...base, count: 99 })).toContain("exactly 9 panels");
    expect(buildDetailToDesignPrompt({ ...base, count: 0 })).toContain("single image");
  });
});

describe("validateDetailRequest", () => {
  const ok = { imageCount: 1, styleCategory: "Tops", outputFormat: "flat-lay", count: 4 };
  it("accepts a good request", () => expect(validateDetailRequest(ok)).toBeNull());
  it("needs exactly one image", () => {
    expect(validateDetailRequest({ ...ok, imageCount: 0 })).toBe("Upload a detail image.");
    expect(validateDetailRequest({ ...ok, imageCount: 2 })).toBe("Upload one detail image at a time.");
  });
  it("rejects an unknown category, output type or count", () => {
    expect(validateDetailRequest({ ...ok, styleCategory: "Capes" })).toBe("Choose a style category.");
    expect(validateDetailRequest({ ...ok, outputFormat: "poster" })).toBe("Choose an output type.");
    expect(validateDetailRequest({ ...ok, count: 10 })).toMatch(/between 1 and 9/);
    expect(validateDetailRequest({ ...ok, count: 2.5 })).toMatch(/between 1 and 9/);
  });
  it("caps the reference style length", () => {
    expect(validateDetailRequest({ ...ok, referenceStyle: "x".repeat(DETAIL_REFERENCE_MAX_CHARS) })).toBeNull();
    expect(validateDetailRequest({ ...ok, referenceStyle: "x".repeat(DETAIL_REFERENCE_MAX_CHARS + 1) })).toMatch(/at most/);
  });
});

it("the analysis prompt asks for the detail, not the whole outfit", () => {
  expect(DETAIL_ANALYSIS_SYSTEM_PROMPT).toContain("ONE garment detail");
  expect(DETAIL_ANALYSIS_SYSTEM_PROMPT).toContain("'Detail:'");
});

describe("buildFabricToDesignPrompt", () => {
  const base = { styleCategory: "Tops" as const, outputFormat: "flat-lay" as const, count: 3, analysis: "Navy cotton twill with a small white polka dot. Fabric: dotted twill." };

  it("makes every concept out of the fabric, keeping its colour, print scale and drape", () => {
    const p = buildFabricToDesignPrompt(base);
    expect(p).toContain("made entirely from this fabric");
    expect(p).toContain("polka dot");
    expect(p).toContain("drape");
    expect(p).toContain("real-world scale");
    expect(p).toContain("exactly 3 panels");
    expect(p).toContain("Do not add colours or prints that are not in the fabric");
  });

  it("is a different prompt from the detail one", () => {
    expect(buildFabricToDesignPrompt(base)).not.toBe(buildDetailToDesignPrompt(base));
    expect(buildDetailToDesignPrompt(base)).toContain("hero feature");
    expect(buildFabricToDesignPrompt(base)).not.toContain("hero feature");
  });

  it("picks the right analysis prompt and builder per kind", () => {
    expect(REFERENCE_PROMPTS.fabric.analysis).toBe(FABRIC_ANALYSIS_SYSTEM_PROMPT);
    expect(REFERENCE_PROMPTS.fabric.analysis).toContain("FABRIC");
    expect(REFERENCE_PROMPTS.detail.analysis).toContain("ONE garment detail");
    expect(REFERENCE_PROMPTS.fabric.build(base)).toBe(buildFabricToDesignPrompt(base));
  });
});
