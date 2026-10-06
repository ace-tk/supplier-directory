import { describe, expect, it } from "vitest";
import { buildCollectionPlanUserPrompt, buildLookPrompt, clampCollectionCount, parseCollectionPlan, validateCollectionRequest } from "@/lib/collection-proposal";

const look = (n: number) => ({
  title: `Look ${n}`,
  details: [`Detail ${n}a`, `Detail ${n}b`, `Detail ${n}c`],
  description: `Outfit ${n} description`,
});

const fakePlan = (count: number) => ({
  model: "A woman in her late twenties, shoulder-length dark hair, medium build, warm skin tone.",
  coreDNA: ["Minimal", "Ribbed cotton", "Ivory and navy", "Relaxed A-line", "Tonal stitching", "Premium basics"],
  looks: Array.from({ length: count }, (_, i) => look(i + 1)),
});

describe("clampCollectionCount", () => {
  it("keeps the count between 1 and 9 and defaults invalid input to 4", () => {
    expect(clampCollectionCount(0)).toBe(1);
    expect(clampCollectionCount(12)).toBe(9);
    expect(clampCollectionCount(Number.NaN)).toBe(4);
    expect(clampCollectionCount(5.4)).toBe(5);
  });
});

describe("parseCollectionPlan", () => {
  it("accepts a well-formed plan given as JSON text", () => {
    const plan = parseCollectionPlan(JSON.stringify(fakePlan(4)), 4);
    expect(plan.looks).toHaveLength(4);
    expect(plan.coreDNA).toHaveLength(6);
    expect(plan.looks[0].details).toHaveLength(3);
  });

  it("trims extra core DNA keywords and extra bullets down to the board's counts", () => {
    const raw = fakePlan(2);
    raw.coreDNA.push("Extra");
    raw.looks[0].details.push("Extra bullet");
    const plan = parseCollectionPlan(raw, 2);
    expect(plan.coreDNA).toHaveLength(6);
    expect(plan.looks[0].details).toHaveLength(3);
  });

  it("rejects a plan with the wrong number of looks", () => {
    expect(() => parseCollectionPlan(fakePlan(3), 4)).toThrow(/incomplete/);
  });

  it("rejects a plan with too few core DNA keywords or bullets", () => {
    const shortDna = fakePlan(2);
    shortDna.coreDNA = shortDna.coreDNA.slice(0, 5);
    expect(() => parseCollectionPlan(shortDna, 2)).toThrow(/incomplete/);

    const shortBullets = fakePlan(2);
    shortBullets.looks[1].details = ["only one"];
    expect(() => parseCollectionPlan(shortBullets, 2)).toThrow(/incomplete/);
  });

  it("rejects text that is not JSON, and a missing model line", () => {
    expect(() => parseCollectionPlan("Here is your collection: ...", 1)).toThrow(/incomplete/);
    expect(() => parseCollectionPlan({ ...fakePlan(1), model: "" }, 1)).toThrow(/incomplete/);
  });
});

describe("buildLookPrompt", () => {
  it("names the outfit, the shared model and the Core DNA, and forbids text in the image", () => {
    const plan = fakePlan(2);
    const prompt = buildLookPrompt({ look: plan.looks[1], plan, imageCount: 2 });
    expect(prompt).toContain("Outfit 2 description");
    expect(prompt).toContain(plan.model);
    expect(prompt).toContain("Minimal, Ribbed cotton");
    expect(prompt).toContain("No text, no numbers");
    expect(prompt).toContain("2 photos show");
  });
});

describe("buildCollectionPlanUserPrompt", () => {
  it("asks for exactly the chosen number of looks", () => {
    expect(buildCollectionPlanUserPrompt(4, 1)).toContain("exactly 4 looks");
    expect(buildCollectionPlanUserPrompt(1, 1)).toContain("exactly 1 look,");
  });
});

describe("validateCollectionRequest", () => {
  it("accepts 1–9 photos and a count of 1–9", () => {
    expect(validateCollectionRequest({ imageCount: 1, count: 4 })).toBeNull();
    expect(validateCollectionRequest({ imageCount: 9, count: 9 })).toBeNull();
  });

  it("explains what is wrong with the photos or the count", () => {
    expect(validateCollectionRequest({ imageCount: 0, count: 4 })).toMatch(/at least one/);
    expect(validateCollectionRequest({ imageCount: 10, count: 4 })).toMatch(/at most 9/);
    expect(validateCollectionRequest({ imageCount: 2, count: 10 })).toMatch(/between 1 and 9/);
  });
});
