import { describe, it, expect } from "vitest";
import { calcNutritionPanel } from "../index";
import { exampleProduct } from "../data/exampleProduct";

// PARITY GATE 2 — Methods C and C+ (21 CFR 101.9(c)(1)(i)(C)). Both exclude non-digestible
// carbohydrate and add fiber back at 2 kcal/g. They differ only by the fiber data used:
//   C  → total dietary fiber @ 2 kcal/g  (Excel "Nutrition STONF" C6)
//   C+ → soluble fiber @ 2 kcal/g        (Excel "Nutrition STONF" C7, the declared value)
// Reference product: 0.14007471 g protein, 9.48468877 g total carb, 5.482428 g total fiber
// (4.6600638 g soluble), 0 g fat.

describe("calories.methodC+ — soluble split (workbook declared) → 25 cal", () => {
  const res = calcNutritionPanel({ ...exampleProduct, calorieMethod: "C+" });

  it("declares 25 calories", () => {
    expect(res.status).toBe("ok");
    expect(res.panel?.calories.value).toBe(25);
  });

  it("unrounded value is ~25.8894695 (soluble fiber @ 2 kcal/g)", () => {
    // 4·protein + 9·fat + 4·(totalCarb − totalFiber) + 2·solubleFiber
    expect(res.panel?.calories.unrounded).toBeCloseTo(25.8894695208, 6);
  });

  it("contrasts against Method C (total fiber → 30 cal)", () => {
    expect(res.panel?.calories.alternate?.method).toBe("C");
    expect(res.panel?.calories.alternate?.value).toBe(30);
  });

  it("cites 101.9(c)(1)(i)(C)", () => {
    expect(res.panel?.calories.citation).toBe("101.9(c)(1)(i)(C)");
  });
});

describe("calories.methodC — total fiber (no split) → 30 cal", () => {
  const res = calcNutritionPanel({ ...exampleProduct, calorieMethod: "C" });

  it("declares 30 calories", () => {
    expect(res.status).toBe("ok");
    expect(res.panel?.calories.value).toBe(30);
  });

  it("unrounded value is ~27.5341979 (total dietary fiber @ 2 kcal/g)", () => {
    // 4·protein + 9·fat + 4·(totalCarb − totalFiber) + 2·totalFiber
    expect(res.panel?.calories.unrounded).toBeCloseTo(27.5341979208, 6);
  });

  it("cites 101.9(c)(1)(i)(C) (same part as C+)", () => {
    expect(res.panel?.calories.citation).toBe("101.9(c)(1)(i)(C)");
  });

  it("exposes side-by-side comparisons for C+, C, and B", () => {
    const comps = res.panel?.calories.comparisons ?? [];
    const byMethod = Object.fromEntries(comps.map((c) => [c.method, c]));
    expect(byMethod["C+"]?.value).toBe(25);
    expect(byMethod.C?.value).toBe(30);
    expect(byMethod.B?.value).toBe(40);
  });
});
