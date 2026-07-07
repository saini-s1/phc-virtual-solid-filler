import { describe, it, expect } from "vitest";
import { calcNutritionPanel } from "../index";
import { exampleProduct } from "../data/exampleProduct";

// PARITY GATE 0 — Method D (US-Rules supplier factors) is the Excel-faithful DEFAULT.
// It sums each ingredient's "kCal (US Rules)" column (Ingredients!E) across the dose,
// reproducing Formulation!E8 = 38.3696536… → 40 cal exactly. It does NOT recompute 4/4/9;
// it trusts the supplier's pre-tabulated per-ingredient factors, which is the workbook's
// own calorie path and therefore our moment of truth.

describe("calories.methodD — Excel default (US Rules) → 40 cal", () => {
  const res = calcNutritionPanel(exampleProduct); // fixture defaults to Method D

  it("declares 40 calories via Method D", () => {
    expect(res.status).toBe("ok");
    expect(res.panel?.calories.method).toBe("D");
    expect(res.panel?.calories.value).toBe(40);
  });

  it("unrounded value is the Excel calorie column sum (~38.3696536)", () => {
    expect(res.panel?.calories.unrounded).toBeCloseTo(38.369653636799995, 6);
  });

  it("cites 101.9(c)(1)(i)(D)", () => {
    expect(res.panel?.calories.citation).toBe("101.9(c)(1)(i)(D)");
  });

  it("contrasts against the fiber-adjusted Method C (25 cal)", () => {
    expect(res.panel?.calories.alternate?.method).toBe("C");
    expect(res.panel?.calories.alternate?.value).toBe(25);
  });

  it("exposes side-by-side comparisons for D, B, and C", () => {
    const comps = res.panel?.calories.comparisons ?? [];
    const byMethod = Object.fromEntries(comps.map((c) => [c.method, c]));
    expect(byMethod.D?.value).toBe(40);
    expect(byMethod.B?.value).toBe(40); // legacy 4/4/9 lands on the same declared value
    expect(byMethod.C?.value).toBe(25); // fiber-adjusted is lower
    expect(byMethod.D?.implemented).toBe(true);
  });
});
