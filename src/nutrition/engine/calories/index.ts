import type { CalorieMethod } from "../../types/inputs";
import type { RegionConfig } from "../../types/config";
import type { CalorieResult, CalorieComparison } from "../../types/results";
import type { NutrientTotals } from "../recipe";
import type { MacroGrams } from "./macros";
import { caloriesMethodB } from "./methodB";
import { caloriesMethodC, caloriesMethodCPlus } from "./methodC";
import { roundByGroup } from "../../rounding/rounding";

// Citation strings for the three methods the workbook implements. C and C+ share the same
// regulatory part (C); they differ only by the fiber data available.
export const CALORIE_CITATION: Record<CalorieMethod, string> = {
  B: "101.9(c)(1)(i)(B)",
  C: "101.9(c)(1)(i)(C)",
  "C+": "101.9(c)(1)(i)(C)",
};

// Order matters for display: C+ is the workbook's declared value, then C and B cross-checks.
export const IMPLEMENTED_METHODS: CalorieMethod[] = ["C+", "C", "B"];

export function macrosFromTotals(totals: NutrientTotals): MacroGrams {
  return {
    protein: totals.get("protein") ?? 0,
    totalCarbohydrate: totals.get("totalCarbohydrate") ?? 0,
    totalFat: totals.get("totalFat") ?? 0,
    dietaryFiber: totals.get("dietaryFiber") ?? 0,
    solubleFiber: totals.get("solubleFiber") ?? 0,
  };
}

function unroundedFor(method: CalorieMethod, m: MacroGrams): number {
  if (method === "B") return caloriesMethodB(m);
  if (method === "C") return caloriesMethodC(m);
  return caloriesMethodCPlus(m); // "C+"
}

function roundedKcal(kcal: number, region: RegionConfig): number {
  const r = roundByGroup(kcal, "calories", region).rounded;
  return typeof r === "number" ? r : 0;
}

/**
 * Compute calories for the active method, round per region calorie tiers, and attach an
 * alternate declaration for contrast: C+ ↔ C (the fiber-data pairing), B ↔ C+.
 */
export function computeCalories(
  method: CalorieMethod,
  totals: NutrientTotals,
  region: RegionConfig,
): CalorieResult {
  const m = macrosFromTotals(totals);

  // Alternate = the single most informative contrast. C+ (soluble split) vs C (total fiber)
  // is the workbook's own fiber pairing; B (legacy 4/4/9) contrasts against C+.
  let alternate: CalorieResult["alternate"] = null;
  const altMethod: CalorieMethod | null =
    method === "C+" ? "C" : method === "C" ? "B" : method === "B" ? "C+" : null;
  if (altMethod) {
    const altKcal = unroundedFor(altMethod, m);
    alternate = { method: altMethod, value: roundedKcal(altKcal, region), unrounded: altKcal };
  }

  // All three workbook methods, side by side (C+/C/B) — pure data the UI can render as-is.
  const comparisons: CalorieComparison[] = IMPLEMENTED_METHODS.map((mth) => {
    const kcal = unroundedFor(mth, m);
    return {
      method: mth,
      value: roundedKcal(kcal, region),
      unrounded: kcal,
      citation: CALORIE_CITATION[mth],
    };
  });

  const activeKcal = unroundedFor(method, m);
  return {
    method,
    value: roundedKcal(activeKcal, region),
    unrounded: activeKcal,
    alternate,
    comparisons,
    citation: CALORIE_CITATION[method],
  };
}
