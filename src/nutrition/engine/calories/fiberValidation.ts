import type { CalcRequest } from "../../types/inputs";

// Method C needs the soluble/insoluble split of dietary fiber. Any ingredient that
// declares dietary fiber must also declare soluble fiber (a known value), or Method C
// cannot run. There is NO heuristic fallback — missing splits block (FLAG: no guessing).

export interface FiberSplitResult {
  ok: boolean;
  offenders: string[];
}

export function validateFiberSplit(req: CalcRequest): FiberSplitResult {
  const offenders: string[] = [];
  for (const ing of req.ingredients) {
    const fiber = ing.nutrients.find((n) => n.nutrientId === "dietaryFiber");
    const hasFiber = fiber && fiber.completeness !== "unknown" && fiber.per100g > 0;
    if (!hasFiber) continue;
    const soluble = ing.nutrients.find((n) => n.nutrientId === "solubleFiber");
    const hasSoluble = soluble && soluble.completeness !== "unknown";
    if (!hasSoluble) offenders.push(ing.name);
  }
  return { ok: offenders.length === 0, offenders };
}
