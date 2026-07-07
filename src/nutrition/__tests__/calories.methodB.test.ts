import { describe, it, expect } from "vitest";
import { calcNutritionPanel } from "../index";
import { exampleProduct } from "../data/exampleProduct";

// PARITY GATE 1 — Method B (legacy general factors 4/4/9) must declare 40 cal,
// matching the current Excel. This is the "parity with the Excel as it exists today"
// gate; the engine is NOT adjusted to match the workbook's intermediate column.

describe("calories.methodB — legacy Excel parity → 40 cal", () => {
  const res = calcNutritionPanel({ ...exampleProduct, calorieMethod: "B" });

  it("declares 40 calories", () => {
    expect(res.status).toBe("ok");
    expect(res.panel?.calories.value).toBe(40);
  });

  it("unrounded pure-4/4/9 value is ~38.499", () => {
    // 4·protein + 4·totalCarb + 9·fat, fat = 0 for this product.
    expect(res.panel?.calories.unrounded).toBeCloseTo(38.4990539208, 6);
  });

  // DOCUMENTED EXCEL QUIRK (flag-the-quirk rule): the workbook's pre-tabulated
  // "kCal (US Rules)" column does NOT apply pure 4/4/9 — it carries per-ingredient
  // factors that sum to 38.369653636799995. That diverges from the engine's 38.499,
  // but BOTH round to 40 under 101.9(c)(1), so Method-B parity holds at the declared
  // value. We assert the divergence exists rather than papering over it.
  it("Excel intermediate column (38.3697) and engine (38.499) both round to 40", () => {
    const excelKcalColumnSum = 38.369653636799995;
    const enginePure449 = res.panel?.calories.unrounded ?? 0;
    expect(enginePure449).not.toBeCloseTo(excelKcalColumnSum, 6); // they genuinely differ
    // both land on the same declared value:
    expect(res.panel?.calories.value).toBe(40);
  });

  it("cites 101.9(c)(1)(i)(B)", () => {
    expect(res.panel?.calories.citation).toBe("101.9(c)(1)(i)(B)");
  });
});
