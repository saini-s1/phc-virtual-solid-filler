import type { NutrientId } from "./nutrients";

// Calculation inputs. Plain serializable data — no UI types, no functions.

// The source workbook ("Nutrition STONF" sheet) implements exactly three calorie methods,
// all under 21 CFR 101.9(c)(1)(i). "C" and "C+" share regulatory part (C); they differ only
// by the fiber data available: plain C credits TOTAL dietary fiber at 2 kcal/g (used when no
// soluble/insoluble split exists); C+ credits SOLUBLE fiber at 2 kcal/g (the workbook's
// declared value). B is legacy general factors (4/4/9).
export type CalorieMethod = "B" | "C" | "C+";
export type NutrientSource = "added" | "naturally_occurring";

/**
 * Completeness of an ingredient's nutrient value (FLAG 2).
 * - "known": a real measured/sourced value.
 * - "zeroConfirmed": user confirmed a genuine 0 (e.g. fat in a mineral premix).
 * - "unknown": value not resolved → blocks panel emission.
 */
export type Completeness = "known" | "zeroConfirmed" | "unknown";

export interface IngredientNutrient {
  nutrientId: NutrientId;
  /** Amount per 100 g of THIS ingredient, in the nutrient's unit. */
  per100g: number;
  completeness: Completeness;
}

export interface Ingredient {
  id: string;
  name: string;
  /** Supplier trade name (Excel Ingredients!B). Display only. */
  tradeName?: string;
  /** CAS registry number (Excel Ingredients!C). Display only; "Mixture" for blends. */
  cas?: string;
  /** P&G GCAS material code (Excel Ingredients!D). Display only. */
  gcas?: string;
  /**
   * Optional per-100 g "kCal (US Rules)" supplier/specific factor — the Excel's
   * Ingredients!E column. Display/reference only; the calorie declaration uses the
   * workbook's B / C / C+ formulas (101.9(c)(1)(i)).
   */
  caloriesPer100g?: number;
  nutrients: IngredientNutrient[];
}

export interface RecipeLine {
  ingredientId: string;
  /** Fraction of the formula by weight, 0..1 (Excel Formulation!C14:C20). */
  percentWW: number;
}

export interface NutrientPolicy {
  nutrientId: NutrientId;
  source: NutrientSource;
  /** True when the user changed the catalog default source → logged in the audit trail. */
  sourceOverridden?: boolean;
  /** Manufacturing loss fraction 0..1 (default treated as 0, flagged). */
  processLossFrac?: number;
  /** OH-234 overage fraction 0..1 — NO DEFAULT (FLAG 3); missing → blocking issue. */
  overageFrac?: number;
  /** Shelf-life decay fraction 0..1 (default treated as 0, flagged). */
  shelfLifeDecayFrac?: number;
}

export interface CalcRequest {
  /** Serving / dose weight in grams (Excel Formulation!D9). */
  servingWeightG: number;
  servingsPerContainer?: number;
  regionId: "US";
  calorieMethod: CalorieMethod;
  recipe: RecipeLine[];
  ingredients: Ingredient[];
  nutrientPolicies: NutrientPolicy[];
}
