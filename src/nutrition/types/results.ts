import type { NutrientId } from "./nutrients";
import type { CalorieMethod, NutrientSource } from "./inputs";
import type { ComplianceClass } from "./config";
import type { AuditTrail } from "./audit";

// Calculation outputs. STRICTLY pure data: a renderer (React, Streamlit, Power BI,
// Veeva export, …) consumes this unchanged. No formatting hints, no color tokens,
// no display strings beyond the regulatory declarations the law itself mandates.

export interface NutrientStages {
  raw: number;
  asFormulated: number;
  asDeclared: number;
  endOfShelfLife: number;
}

export interface NutrientResult {
  nutrientId: NutrientId;
  unit: string;
  stages: NutrientStages;
  /**
   * Rounded declared amount. A number, OR a regulatory declaration string mandated
   * by 21 CFR 101.9(c) itself (e.g. "Less than 1 g", "Less than 5 mg") — that text
   * is the legal value, not UI formatting.
   */
  declaredAmountRounded: number | string;
  pctDV: number | null;
  pctDVRounded: number | null;
  source: NutrientSource;
  complianceClass: ComplianceClass;
  complianceFloorPct: number | null;
  complianceCeilingPct: number | null;
  meetsCompliance: boolean | null;
  mandatory: boolean;
  citations: string[];
  flags: string[];
}

export interface CalorieComparison {
  method: CalorieMethod;
  value: number;
  unrounded: number;
  citation: string;
}

export interface CalorieResult {
  method: CalorieMethod;
  value: number;
  unrounded: number;
  /** The alternate method's declaration (FLAG 1): C shows B alongside and vice-versa. */
  alternate: { method: CalorieMethod; value: number; unrounded: number } | null;
  /** All workbook methods (C+/C/B) for side-by-side display — pure data, no labels. */
  comparisons: CalorieComparison[];
  citation: string;
}

export interface NutritionPanel {
  servingWeightG: number;
  servingsPerContainer: number | null;
  /** Single per-serving column for v1; widening later needs no engine change. */
  columnCount: 1;
  /** Panel heading from region config: "Supplement Facts" (101.36) or "Nutrition Facts" (101.9). */
  title: string;
  /** Governing regulation label, e.g. "21 CFR 101.36". */
  regulation: string;
  calories: CalorieResult;
  nutrients: NutrientResult[];
  footnotes: string[];
}

export type BlockingCode =
  | "METHOD_C_FIBER_SPLIT_MISSING"
  | "INGREDIENT_INCOMPLETE"
  | "OVERAGE_MISSING";

export interface BlockingIssue {
  code: BlockingCode;
  message: string;
  offenders: string[];
}

export interface CalcResponse {
  status: "ok" | "blocked";
  panel: NutritionPanel | null;
  blockingIssues: BlockingIssue[];
  validationFlags: string[];
  auditTrail: AuditTrail;
  prototypeDisclaimer: string;
}
