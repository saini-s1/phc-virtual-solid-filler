import { describe, it, expect } from "vitest";
import { classify, assessCompliance } from "../compliance/compliance";
import { US_REGION } from "../config/regions";
import type { NutrientStages } from "../types/results";

// Compliance classes per 21 CFR 101.9(g). Boolean/enum outcomes only — no UI semantics.

function stages(over: Partial<NutrientStages>): NutrientStages {
  return { raw: 0, asFormulated: 0, asDeclared: 0, endOfShelfLife: 0, ...over };
}

describe("compliance.classify", () => {
  it("third-group nutrients → thirdGroup regardless of source", () => {
    expect(classify(true, "added")).toBe("thirdGroup");
    expect(classify(true, "naturally_occurring")).toBe("thirdGroup");
  });
  it("added floor nutrient → Class I", () => {
    expect(classify(false, "added")).toBe("I");
  });
  it("naturally-occurring floor nutrient → Class II", () => {
    expect(classify(false, "naturally_occurring")).toBe("II");
  });
});

describe("compliance.assess — Class I floor 100% (EOSL ≥ declared)", () => {
  it("meets at exactly 100%", () => {
    const a = assessCompliance("I", stages({ asDeclared: 100, endOfShelfLife: 100 }), US_REGION);
    expect(a.floorPct).toBe(100);
    expect(a.meets).toBe(true);
  });
  it("fails below 100%", () => {
    const a = assessCompliance("I", stages({ asDeclared: 100, endOfShelfLife: 99.9 }), US_REGION);
    expect(a.meets).toBe(false);
  });
});

describe("compliance.assess — Class II floor 80%", () => {
  it("meets at exactly 80%", () => {
    const a = assessCompliance("II", stages({ asDeclared: 100, endOfShelfLife: 80 }), US_REGION);
    expect(a.floorPct).toBe(80);
    expect(a.meets).toBe(true);
  });
  it("fails below 80%", () => {
    const a = assessCompliance("II", stages({ asDeclared: 100, endOfShelfLife: 79.9 }), US_REGION);
    expect(a.meets).toBe(false);
  });
});

describe("compliance.assess — third group ceiling 120% (asFormulated ≤ declared·1.2)", () => {
  it("meets at exactly 120%", () => {
    const a = assessCompliance("thirdGroup", stages({ asDeclared: 100, asFormulated: 120 }), US_REGION);
    expect(a.ceilingPct).toBe(120);
    expect(a.meets).toBe(true);
  });
  it("fails above 120%", () => {
    const a = assessCompliance("thirdGroup", stages({ asDeclared: 100, asFormulated: 120.1 }), US_REGION);
    expect(a.meets).toBe(false);
  });
});
