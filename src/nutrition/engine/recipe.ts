import type { CalcRequest } from "../types/inputs";
import type { NutrientId } from "../types/nutrients";

// Excel-parity recipe engine (Formulation sheet). For each nutrient, per serving:
//   Σ over recipe lines [ per100g × (percentWW × servingWeightG) / 100 ]
// i.e. VLOOKUP(nutrient) × doseWt / 100, summed at row 8. Reproduces the workbook to <1e-9.
// This is the part that "ain't broke" — preserved verbatim, no loss/overage applied here.

export type NutrientTotals = Map<NutrientId, number>;

export interface RecipeSumResult {
  totals: NutrientTotals;
  /** Σ ingredient "kCal (US Rules)" × doseWt/100 — reproduces the Excel calorie column (E8). */
  usRulesCalories: number;
  /** False when any used ingredient is missing its caloriesPer100g (US-Rules) factor. */
  usRulesComplete: boolean;
  flags: string[];
}

export function sumRecipe(req: CalcRequest): RecipeSumResult {
  const totals: NutrientTotals = new Map();
  const flags: string[] = [];
  const byId = new Map(req.ingredients.map((i) => [i.id, i]));

  let pctSum = 0;
  let usRulesCalories = 0; // Excel Ingredients!E × doseWt/100, summed (Formulation!E8)
  let usRulesComplete = true;
  for (const line of req.recipe) {
    pctSum += line.percentWW;
    const ing = byId.get(line.ingredientId);
    if (!ing) {
      flags.push(`Recipe references unknown ingredient "${line.ingredientId}", contribution skipped.`);
      continue;
    }
    const doseG = line.percentWW * req.servingWeightG; // Excel: Dose wt = %w/w × D9
    for (const n of ing.nutrients) {
      const contribution = (n.per100g * doseG) / 100; // VLOOKUP × dose / 100
      totals.set(n.nutrientId, (totals.get(n.nutrientId) ?? 0) + contribution);
    }
    // US-Rules supplier calories (Excel Ingredients!E → Formulation!E8).
    if (typeof ing.caloriesPer100g === "number") {
      usRulesCalories += (ing.caloriesPer100g * doseG) / 100;
    } else {
      usRulesComplete = false;
    }
  }

  if (Math.abs(pctSum - 1) > 0.01) {
    flags.push(`Formula %w/w sums to ${pctSum.toFixed(6)}, not 1.0; totals may be mis-scaled (not auto-normalized).`);
  }
  return { totals, usRulesCalories, usRulesComplete, flags };
}
