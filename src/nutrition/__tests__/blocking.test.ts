import { describe, it, expect } from "vitest";
import { calcNutritionPanel } from "../index";
import { exampleProduct } from "../data/exampleProduct";
import type { CalcRequest } from "../types/inputs";

// The three blocking codes. Each produces status:"blocked", panel:null, and names offenders.

describe("blocking — INGREDIENT_INCOMPLETE", () => {
  it("fires when any ingredient nutrient is completeness:'unknown'", () => {
    const req: CalcRequest = structuredClone(exampleProduct);
    const carb = req.ingredients[0].nutrients.find((n) => n.nutrientId === "totalCarbohydrate");
    if (carb) carb.completeness = "unknown";

    const res = calcNutritionPanel(req);
    expect(res.status).toBe("blocked");
    expect(res.panel).toBeNull();
    const issue = res.blockingIssues.find((b) => b.code === "INGREDIENT_INCOMPLETE");
    expect(issue).toBeDefined();
    expect(issue?.offenders.some((o) => o.endsWith(":totalCarbohydrate"))).toBe(true);
  });
});

describe("blocking — METHOD_C_FIBER_SPLIT_MISSING", () => {
  it("fires under Method C when a fiber source has no soluble split, naming the ingredient", () => {
    const req: CalcRequest = structuredClone(exampleProduct);
    req.calorieMethod = "C";
    // Remove psyllium's soluble fiber entry; it still declares 84 g dietary fiber.
    const psyllium = req.ingredients.find((i) => i.id === "psyllium");
    if (psyllium) {
      psyllium.nutrients = psyllium.nutrients.filter((n) => n.nutrientId !== "solubleFiber");
    }

    const res = calcNutritionPanel(req);
    expect(res.status).toBe("blocked");
    expect(res.panel).toBeNull();
    const issue = res.blockingIssues.find((b) => b.code === "METHOD_C_FIBER_SPLIT_MISSING");
    expect(issue).toBeDefined();
    expect(issue?.offenders).toContain("Psyllium Husk Powder");
  });
});

describe("blocking — OVERAGE_MISSING", () => {
  it("fires when a floor nutrient lacks an overage fraction", () => {
    const req: CalcRequest = structuredClone(exampleProduct);
    const calcium = req.nutrientPolicies.find((p) => p.nutrientId === "calcium");
    if (calcium) delete calcium.overageFrac;

    const res = calcNutritionPanel(req);
    expect(res.status).toBe("blocked");
    expect(res.panel).toBeNull();
    const issue = res.blockingIssues.find((b) => b.code === "OVERAGE_MISSING");
    expect(issue).toBeDefined();
    expect(issue?.offenders).toContain("calcium");
  });
});
