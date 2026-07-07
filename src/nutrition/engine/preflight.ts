import type { CalcRequest } from "../types/inputs";
import type { RegionConfig } from "../types/config";
import type { BlockingIssue } from "../types/results";
import type { NutrientId } from "../types/nutrients";
import { NUTRIENTS } from "../config/nutrients";
import { validateFiberSplit } from "./calories/fiberValidation";

// Preflight = the three blocking gates. If any fire, the orchestrator returns
// status:"blocked" with panel:null. No partial labels, no invented defaults.

export function preflight(req: CalcRequest, region: RegionConfig): BlockingIssue[] {
  const issues: BlockingIssue[] = [];

  // (a) INGREDIENT_INCOMPLETE — any nutrient value left "unknown" (FLAG 2).
  const incomplete: string[] = [];
  for (const ing of req.ingredients) {
    for (const n of ing.nutrients) {
      if (n.completeness === "unknown") incomplete.push(`${ing.name}:${n.nutrientId}`);
    }
  }
  if (incomplete.length > 0) {
    issues.push({
      code: "INGREDIENT_INCOMPLETE",
      message:
        "One or more ingredient nutrient values are unconfirmed (completeness = unknown). " +
        "Confirm a value or mark it as a confirmed zero before a label can be produced.",
      offenders: incomplete,
    });
  }

  // (b) METHOD_C_FIBER_SPLIT_MISSING — Method C needs a soluble-fiber split per fiber source.
  if (req.calorieMethod === "C") {
    const fiber = validateFiberSplit(req);
    if (!fiber.ok) {
      issues.push({
        code: "METHOD_C_FIBER_SPLIT_MISSING",
        message:
          "Calorie Method C requires a soluble/insoluble fiber split for every ingredient " +
          "that declares dietary fiber. No heuristic fallback is applied.",
        offenders: fiber.offenders,
      });
    }
  }

  // (c) OVERAGE_MISSING — floor nutrients (Class I/II) must carry an explicit OH-234 overage.
  //     Third-group limit nutrients are exempt (declare-down does not apply to a ceiling).
  const declared = new Set<NutrientId>(region.mandatoryNutrients);
  for (const ing of req.ingredients) {
    for (const n of ing.nutrients) declared.add(n.nutrientId);
  }
  const policyById = new Map(req.nutrientPolicies.map((p) => [p.nutrientId, p]));
  const overageOffenders: string[] = [];
  for (const id of declared) {
    const entry = NUTRIENTS[id];
    if (entry.isThirdGroup) continue; // limit nutrient → no overage required
    // Both floor classes (added Class I, naturally-occurring Class II) require an explicit overage.
    const policy = policyById.get(id);
    if (!policy || policy.overageFrac === undefined) {
      overageOffenders.push(id);
    }
  }
  if (overageOffenders.length > 0) {
    issues.push({
      code: "OVERAGE_MISSING",
      message:
        "OH-234 default not specified; user input required. Provide an overage fraction for " +
        "each floor (Class I/II) nutrient before a label can be produced.",
      offenders: overageOffenders,
    });
  }

  return issues;
}
