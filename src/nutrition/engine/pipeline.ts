import type { NutrientStages } from "../types/results";
import { applyOverage } from "../overage/overage";

// Four-stage value pipeline, per nutrient:
//   raw            → recipe total (as-is from formulation)
//   asFormulated   → raw × (1 − processLoss)        [manufacturing loss]
//   asDeclared     → asFormulated ÷ (1 + overage)   [OH-234 declare-down]
//   endOfShelfLife → asFormulated × (1 − decay)     [stability at end of shelf life]
//
// %DV and compliance read these stages; rounding happens AFTER, never inside.

export interface PipelineInputs {
  raw: number;
  processLossFrac: number;
  overageFrac: number;
  shelfLifeDecayFrac: number;
}

export function runStages(p: PipelineInputs): NutrientStages {
  const asFormulated = p.raw * (1 - p.processLossFrac);
  const asDeclared = applyOverage(asFormulated, p.overageFrac);
  const endOfShelfLife = asFormulated * (1 - p.shelfLifeDecayFrac);
  return { raw: p.raw, asFormulated, asDeclared, endOfShelfLife };
}
