import type { NutrientId } from "./nutrients";

// Calculation inputs. Plain serializable data — no UI types, no functions.

export type CalorieMethod = "A" | "B" | "C" | "D" | "E" | "F";
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
  /**
   * Optional per-100 g "kCal (US Rules)" supplier/specific factor — the Excel's
   * Ingredients!E column. When present on every recipe ingredient, the engine can
   * declare calories by Method D (101.9(c)(1)(i)(D)), exactly reproducing the workbook.
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
