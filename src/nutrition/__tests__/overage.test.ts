import { describe, it, expect } from "vitest";
import { applyOverage } from "../overage/overage";
import { calcNutritionPanel } from "../index";
import { exampleProduct } from "../data/exampleProduct";
import type { CalcRequest } from "../types/inputs";

// OH-234 overage: declare-down math, plus the hard block when a floor nutrient has no
// overage specified (no invented default).

describe("overage.applyOverage — declare-down", () => {
  it("divides formulated amount by (1 + overage)", () => {
    expect(applyOverage(110, 0.1)).toBeCloseTo(100, 12);
    expect(applyOverage(125, 0.25)).toBeCloseTo(100, 12);
  });
  it("is a no-op at 0% overage", () => {
    expect(applyOverage(100, 0)).toBe(100);
  });
});

describe("overage — missing floor-nutrient overage blocks the label", () => {
  it("emits OVERAGE_MISSING and no panel when a floor nutrient lacks overageFrac", () => {
    const req: CalcRequest = structuredClone(exampleProduct);
    // Iron is a floor (Class I) nutrient — drop its overage entirely.
    const iron = req.nutrientPolicies.find((p) => p.nutrientId === "iron");
    if (iron) delete iron.overageFrac;

    const res = calcNutritionPanel(req);
    expect(res.status).toBe("blocked");
    expect(res.panel).toBeNull();
    const codes = res.blockingIssues.map((b) => b.code);
    expect(codes).toContain("OVERAGE_MISSING");
    const issue = res.blockingIssues.find((b) => b.code === "OVERAGE_MISSING");
    expect(issue?.offenders).toContain("iron");
    expect(issue?.message).toMatch(/OH-234 default not specified/i);
  });
});
