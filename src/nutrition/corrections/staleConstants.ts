import type { NutrientId } from "../types/nutrients";

// Known corrections of stale/ambiguous constants carried in the source Excel.
// Each is applied via region config AND logged to the audit trail as a
// "corrected stale constant". Append future corrections here; never silently.

export interface StaleConstantCorrection {
  nutrientId: NutrientId;
  field: string;
  staleValue: number;
  correctedValue: number;
  unit: string;
  citation: string;
  note: string;
}

export const STALE_CONSTANT_CORRECTIONS: StaleConstantCorrection[] = [
  {
    nutrientId: "vitaminD",
    field: "dailyValue",
    staleValue: 0.2,
    correctedValue: 20,
    unit: "mcg",
    citation: "101.9(c)(8)(iv)",
    note: "Excel carried Vitamin D RDI 0.2 (stale/ambiguous units); corrected to current 20 mcg (= 800 IU).",
  },
];
