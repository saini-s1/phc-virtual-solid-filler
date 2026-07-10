import { describe, it, expect } from "vitest";
import { caloriesMethodB } from "../engine/calories/methodB";
import { caloriesMethodC, caloriesMethodCPlus } from "../engine/calories/methodC";
import type { MacroGrams } from "../engine/calories/macros";

// EXCEL PARITY — validate the calorie formulas reproduce the source workbook EXACTLY.
// Inputs are the per-dose macro totals from the "Nutrition STONF" sheet (single dose,
// 5.8272 g): F24 protein, C10 total carb, D10 total fiber, E10 soluble fiber, C31 total fat.
// Expected outputs are the workbook's own computed cells B/C/C+ (C5, C6, C7).

const macros: MacroGrams = {
  protein: 0.074137881883584, // Nutrition STONF!F24
  totalCarbohydrate: 5.2370083490092805, // C10
  dietaryFiber: 2.7342075268992, // D10 (total fiber)
  solubleFiber: 2.300258122272, // E10
  totalFat: 0.03734165209536001, // C31
};

describe("calories.excelParity — formulas match the workbook to < 1e-9", () => {
  it("Method B = (4·P)+(4·Carb)+(9·Fat) → Nutrition!C5 (21.5806597924297)", () => {
    expect(Math.abs(caloriesMethodB(macros) - 21.5806597924297)).toBeLessThan(1e-9);
  });

  it("Method C = (4·P)+(9·Fat)+[4·(Carb−Fiber)]+[2·Fiber] → Nutrition!C6 (16.112244738631297)", () => {
    expect(Math.abs(caloriesMethodC(macros) - 16.112244738631297)).toBeLessThan(1e-9);
  });

  it("Method C+ = (4·P)+(9·Fat)+[4·(Carb−Fiber)]+[2·Soluble] → Nutrition!C7 (15.244345929376898)", () => {
    expect(Math.abs(caloriesMethodCPlus(macros) - 15.244345929376898)).toBeLessThan(1e-9);
  });

  it("the declared 'Calories (US Rules)' cell (C38 = C7) is the C+ value → rounds to 15 cal", () => {
    // Nutrition STONF C42 "Reco." = 15kCal; ≤ 50 cal rounds to nearest 5.
    const cPlus = caloriesMethodCPlus(macros);
    const rounded = Math.round(cPlus / 5) * 5;
    expect(rounded).toBe(15);
  });
});
