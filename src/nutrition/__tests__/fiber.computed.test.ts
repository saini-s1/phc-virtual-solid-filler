import { describe, it, expect } from "vitest";
import { calcNutritionPanel } from "../index";
import { sumRecipe } from "../engine/recipe";
import { exampleProduct } from "../data/exampleProduct";
import type { CalcRequest } from "../types/inputs";

// Soluble fiber is a COMPUTED quantity (summed from ingredient splits), never inferred
// from total dietary fiber. Method C depends on it and blocks if it is missing.

describe("fiber.computed", () => {
  it("soluble fiber is summed from ingredient data (~4.6600638 g/serving)", () => {
    const { totals } = sumRecipe(exampleProduct);
    expect(totals.get("solubleFiber") ?? 0).toBeCloseTo(4.6600638, 9);
  });

  it("appears in the panel as a computed raw stage value", () => {
    const res = calcNutritionPanel(exampleProduct);
    const soluble = res.panel?.nutrients.find((n) => n.nutrientId === "solubleFiber");
    expect(soluble?.stages.raw).toBeCloseTo(4.6600638, 9);
  });

  it("removing the only soluble split blocks Method C (no heuristic fallback)", () => {
    const req: CalcRequest = structuredClone(exampleProduct);
    req.calorieMethod = "C";
    const psyllium = req.ingredients.find((i) => i.id === "psyllium");
    if (psyllium) {
      psyllium.nutrients = psyllium.nutrients.filter((n) => n.nutrientId !== "solubleFiber");
    }
    const res = calcNutritionPanel(req);
    expect(res.status).toBe("blocked");
    expect(res.blockingIssues.map((b) => b.code)).toContain("METHOD_C_FIBER_SPLIT_MISSING");
  });
});
