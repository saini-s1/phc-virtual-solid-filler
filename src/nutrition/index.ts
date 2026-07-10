// Public API for the nutrition engine. The UI (NutritionApp.tsx) imports ONLY from
// this file — it never reaches into engine internals directly. All types the UI needs
// are re-exported below so callers have a single stable import point.
import type { CalcRequest } from "./types/inputs";
import type { CalcResponse } from "./types/results";
import { getRegion } from "./config/regions";
import { runPipeline } from "./engine/orchestrator";

// Public entry point for the nutrition calc core. The UI imports ONLY this function and
// the exported types — it never reaches into engine internals, and it performs no math.
export function calcNutritionPanel(req: CalcRequest): CalcResponse {
  const region = getRegion(req.regionId);
  return runPipeline(req, region);
}

// Public type surface (isolatedModules → must use `export type`).
export type {
  CalcRequest,
  Ingredient,
  IngredientNutrient,
  RecipeLine,
  NutrientPolicy,
  CalorieMethod,
  NutrientSource,
  Completeness,
} from "./types/inputs";
export type { NutrientId, NutrientUnit, NutrientCatalogEntry } from "./types/nutrients";
export type {
  CalcResponse,
  NutritionPanel,
  NutrientResult,
  NutrientStages,
  CalorieResult,
  BlockingIssue,
  BlockingCode,
} from "./types/results";
export type { AuditTrail, AuditEntry, AuditKind } from "./types/audit";
export type { ComplianceClass } from "./types/config";
