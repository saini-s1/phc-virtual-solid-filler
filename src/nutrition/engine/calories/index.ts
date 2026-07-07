import type { CalorieMethod } from "../../types/inputs";
import type { RegionConfig } from "../../types/config";
import type { CalorieResult, CalorieComparison } from "../../types/results";
import type { NutrientTotals } from "../recipe";
import type { MacroGrams } from "./macros";
import { caloriesMethodB } from "./methodB";
import { caloriesMethodC } from "./methodC";
import { roundByGroup } from "../../rounding/rounding";

export const CALORIE_CITATION: Record<CalorieMethod, string> = {
  A: "101.9(c)(1)(i)(A)",
  B: "101.9(c)(1)(i)(B)",
  C: "101.9(c)(1)(i)(C)",
  D: "101.9(c)(1)(i)(D)",
  E: "101.9(c)(1)(i)(E)",
  F: "101.9(c)(1)(i)(F)",
};

// D first: "US Rules" supplier factors are the Excel's own calorie path and the default.
export const IMPLEMENTED_METHODS: CalorieMethod[] = ["D", "B", "C"];

export function macrosFromTotals(totals: NutrientTotals): MacroGrams {
  return {
    protein: totals.get("protein") ?? 0,
    totalCarbohydrate: totals.get("totalCarbohydrate") ?? 0,
    totalFat: totals.get("totalFat") ?? 0,
    dietaryFiber: totals.get("dietaryFiber") ?? 0,
    solubleFiber: totals.get("solubleFiber") ?? 0,
    sugarAlcohol: totals.get("sugarAlcohol") ?? 0,
  };
}

interface UnroundedCalories {
  kcal: number;
  flags: string[];
  implemented: boolean;
}

function unroundedFor(
  method: CalorieMethod,
  m: MacroGrams,
  usRulesCalories: number,
): UnroundedCalories {
  // Method D = the Excel's path: sum of per-ingredient "kCal (US Rules)" supplier factors.
  if (method === "D") return { kcal: usRulesCalories, flags: [], implemented: true };
  if (method === "B") return { kcal: caloriesMethodB(m), flags: [], implemented: true };
  if (method === "C") {
    const c = caloriesMethodC(m);
    return { kcal: c.kcal, flags: c.flags, implemented: true };
  }
  return { kcal: 0, flags: [`Calorie method ${method} is not implemented in v1.`], implemented: false };
}

function roundedKcal(kcal: number, region: RegionConfig): number {
  const r = roundByGroup(kcal, "calories", region).rounded;
  return typeof r === "number" ? r : 0;
}

export interface ComputeCaloriesResult {
  result: CalorieResult;
  flags: string[];
}

/**
 * Compute calories for the active method, round per region calorie tiers, and attach
 * the alternate declaration (FLAG 1): when C is active show B, and vice-versa.
 */
export function computeCalories(
  method: CalorieMethod,
  totals: NutrientTotals,
  region: RegionConfig,
  usRulesCalories: number,
): ComputeCaloriesResult {
  const m = macrosFromTotals(totals);
  const active = unroundedFor(method, m, usRulesCalories);

  // Alternate = the single most informative contrast. C↔B is the legacy pairing; the
  // Excel default D contrasts against C (the 40-vs-25 fiber story).
  let alternate: CalorieResult["alternate"] = null;
  const altMethod: CalorieMethod | null =
    method === "C" ? "B" : method === "B" ? "C" : method === "D" ? "C" : null;
  if (altMethod) {
    const alt = unroundedFor(altMethod, m, usRulesCalories);
    alternate = { method: altMethod, value: roundedKcal(alt.kcal, region), unrounded: alt.kcal };
  }

  // All implemented methods, side by side (D/B/C) — pure data the UI can render as-is.
  const comparisons: CalorieComparison[] = IMPLEMENTED_METHODS.map((mth) => {
    const u = unroundedFor(mth, m, usRulesCalories);
    return {
      method: mth,
      value: roundedKcal(u.kcal, region),
      unrounded: u.kcal,
      citation: CALORIE_CITATION[mth],
      implemented: u.implemented,
    };
  });

  const result: CalorieResult = {
    method,
    methodImplemented: active.implemented,
    value: roundedKcal(active.kcal, region),
    unrounded: active.kcal,
    alternate,
    comparisons,
    citation: CALORIE_CITATION[method],
  };
  return { result, flags: active.flags };
}
