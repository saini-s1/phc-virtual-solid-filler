import type { NutrientId } from "./nutrients";

// Region configuration contract. A new region = a new RegionConfig object;
// the engine never hard-codes any of these numbers (your rule).

export type RoundingMode = "zero" | "nearest" | "text";

export interface RoundingTier {
  /** Upper bound of |value| this tier covers; null = +infinity. */
  upTo: number | null;
  /** Whether `upTo` is inclusive (≤) or exclusive (<). */
  inclusive: boolean;
  mode: RoundingMode;
  /** For mode "nearest": the increment (e.g. 5, 10, 0.5, 1, 2). */
  increment?: number;
  /** For mode "text": the regulatory declaration string (e.g. "Less than 1 g"). */
  text?: string;
}

export interface RoundingRule {
  group: string;
  strategy?: "tiers" | "significantFigures";
  tiers?: RoundingTier[];
  sigFigs?: number;
  citation: string;
}

export interface DailyValue {
  nutrientId: NutrientId;
  value: number;
  unit: string;
  basis: "RDI" | "DRV";
  citation: string;
}

export type ComplianceClass = "I" | "II" | "thirdGroup" | "none";

/**
 * Which FDA panel format governs the output:
 *  - "nutritionFacts": conventional food, 21 CFR 101.9.
 *  - "supplementFacts": dietary supplement, 21 CFR 101.36 (incorporates 101.9(c)).
 * P&G PHC solid forms (psyllium fiber / vitamin-mineral gummies) are dietary
 * supplements, so "supplementFacts" is the correct standard. OTC drug forms use a
 * Drug Facts panel (21 CFR 201.66) and are out of scope for this engine.
 */
export type PanelStandard = "nutritionFacts" | "supplementFacts";

export interface ComplianceRule {
  klass: ComplianceClass;
  /** Floor for Class I (100) / Class II (80): EOSL ≥ floor% × declared. */
  floorPct?: number;
  /** Ceiling for the third group (120): asFormulated ≤ ceiling% × declared. */
  ceilingPct?: number;
  citation: string;
}

export interface RegionConfig {
  id: string;
  label: string;
  citationVersion: string;
  /** Food (101.9) vs dietary-supplement (101.36) panel format. */
  panelStandard: PanelStandard;
  /** Rendered panel heading, e.g. "Supplement Facts". */
  panelTitle: string;
  /** Governing regulation label, e.g. "21 CFR 101.36". */
  regulation: string;
  dailyValues: DailyValue[];
  roundingRules: RoundingRule[];
  /** Rounding group name used for vitamin/mineral %DV. */
  pctDvRoundingGroup: string;
  complianceRules: ComplianceRule[];
  /** Mandatory substance declarations (calories is always present, handled separately). */
  mandatoryNutrients: NutrientId[];
}
