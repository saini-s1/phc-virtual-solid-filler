import { describe, it, expect } from "vitest";
import { sumRecipe } from "../engine/recipe";
import { exampleProduct } from "../data/exampleProduct";
import type { NutrientId } from "../types/nutrients";

// PARITY GATE 3 — recipe nutrient sums must reproduce the Excel per-serving totals
// (reference row 8) to < 1e-9. These expected values were extracted from the source
// workbook and independently re-derived in Python before being frozen here.

const EXPECTED: Record<string, number> = {
  protein: 0.14007471100000002,
  totalCarbohydrate: 9.4846887692,
  dietaryFiber: 5.482428,
  solubleFiber: 4.6600638000000005,
  totalSugars: 0.201828923,
  addedSugars: 0.08363080799999999,
  sodium: 9.0697665548,
  potassium: 54.784726504,
  iron: 0.5785412494,
  calcium: 11.4667657584,
  vitaminA: 4.070182175999999,
  vitaminC: 0.001357428,
  vitaminD: 0,
};

describe("recipe.parity — Excel formulation sums (< 1e-9)", () => {
  const { totals } = sumRecipe(exampleProduct);

  for (const [id, expected] of Object.entries(EXPECTED)) {
    it(`${id} matches Excel to < 1e-9`, () => {
      const actual = totals.get(id as NutrientId) ?? 0;
      expect(Math.abs(actual - expected)).toBeLessThan(1e-9);
    });
  }

  it("does not silently normalize %w/w (no scaling flag for this balanced formula)", () => {
    const { flags } = sumRecipe(exampleProduct);
    expect(flags).toEqual([]);
  });

  it("usRulesCalories reproduces the Excel calorie column (Formulation!E8) to < 1e-9", () => {
    const { usRulesCalories, usRulesComplete } = sumRecipe(exampleProduct);
    expect(Math.abs(usRulesCalories - 38.369653636799995)).toBeLessThan(1e-9);
    expect(usRulesComplete).toBe(true);
  });
});
