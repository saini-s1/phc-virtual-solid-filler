import { describe, it, expect } from "vitest";
import { calcNutritionPanel } from "../index";
import { exampleProduct } from "../data/exampleProduct";

// PARITY GATE 2 — Method C (fiber-adjusted; explicit, no longer the default) must declare
// 25 cal. Carbohydrate calories exclude non-digestible fiber; soluble fiber contributes
// 2 kcal/g. The fixture now defaults to Method D, so this test selects C explicitly.

describe("calories.methodC — explicit fiber-adjusted → 25 cal", () => {
  const res = calcNutritionPanel({ ...exampleProduct, calorieMethod: "C" });

  it("declares 25 calories", () => {
    expect(res.status).toBe("ok");
    expect(res.panel?.calories.value).toBe(25);
  });

  it("unrounded value is ~25.889", () => {
    // 4·protein + 9·fat + 4·(totalCarb − fiber − sugarAlcohol) + 2·solubleFiber
    expect(res.panel?.calories.unrounded).toBeCloseTo(25.8894695, 5);
  });

  it("shows the alternate Method B declaration (40 cal)", () => {
    expect(res.panel?.calories.alternate?.method).toBe("B");
    expect(res.panel?.calories.alternate?.value).toBe(40);
  });

  it("cites 101.9(c)(1)(i)(C)", () => {
    expect(res.panel?.calories.citation).toBe("101.9(c)(1)(i)(C)");
  });
});
