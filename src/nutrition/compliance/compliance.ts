import type { ComplianceClass, RegionConfig } from "../types/config";
import type { NutrientSource } from "../types/inputs";
import type { NutrientStages } from "../types/results";

// FDA compliance classes, 21 CFR 101.9(g):
//   Class I  (added vitamins/minerals/protein/fiber): EOSL ≥ 100% of declared.
//   Class II (naturally occurring of the same):       EOSL ≥  80% of declared.
//   Third group (calories, sugars, fat, sat fat, trans, cholesterol, sodium):
//                                                     asFormulated ≤ 120% of declared.
// Boolean/enum only — no UI semantics. Tolerances absorb float noise.

const EPS = 1e-9;

export interface ComplianceAssessment {
  complianceClass: ComplianceClass;
  floorPct: number | null;
  ceilingPct: number | null;
  meets: boolean | null;
  citation: string;
  detail: string;
}

export function classify(isThirdGroup: boolean, source: NutrientSource): ComplianceClass {
  if (isThirdGroup) return "thirdGroup";
  return source === "added" ? "I" : "II";
}

export function assessCompliance(
  klass: ComplianceClass,
  stages: NutrientStages,
  region: RegionConfig,
): ComplianceAssessment {
  const rule = region.complianceRules.find((r) => r.klass === klass);
  if (!rule) {
    return {
      complianceClass: klass,
      floorPct: null,
      ceilingPct: null,
      meets: null,
      citation: "",
      detail: `no compliance rule for class ${klass}`,
    };
  }

  if (klass === "thirdGroup") {
    const ceiling = rule.ceilingPct ?? 120;
    const limit = (ceiling / 100) * stages.asDeclared;
    const meets = stages.asFormulated <= limit + EPS;
    return {
      complianceClass: klass,
      floorPct: null,
      ceilingPct: ceiling,
      meets,
      citation: rule.citation,
      detail: `asFormulated ${stages.asFormulated} ≤ ${ceiling}% × declared ${stages.asDeclared} (${limit}) → ${meets}`,
    };
  }

  // Class I / II floor on end-of-shelf-life value.
  const floor = rule.floorPct ?? (klass === "I" ? 100 : 80);
  const minimum = (floor / 100) * stages.asDeclared;
  const meets = stages.endOfShelfLife >= minimum - EPS;
  return {
    complianceClass: klass,
    floorPct: floor,
    ceilingPct: null,
    meets,
    citation: rule.citation,
    detail: `EOSL ${stages.endOfShelfLife} ≥ ${floor}% × declared ${stages.asDeclared} (${minimum}) → ${meets}`,
  };
}
