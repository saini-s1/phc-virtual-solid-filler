import { describe, it, expect } from "vitest";
import { calcNutritionPanel } from "../index";
import { exampleProduct } from "../data/exampleProduct";

// Append-only audit trail (OH-222): monotonic sequence, required header fields, and at
// least one rounding / class / pipeline entry per nutrient, plus correction + finding.

describe("audit trail", () => {
  const res = calcNutritionPanel(exampleProduct);
  const trail = res.auditTrail;

  it("carries inputsHash, calorieMethod, and region", () => {
    expect(trail.inputsHash).toMatch(/^[0-9a-f]{8}$/);
    expect(trail.calorieMethod).toBe("D");
    expect(trail.region).toBe("US");
  });

  it("sequence numbers are strictly monotonic from 0", () => {
    trail.entries.forEach((e, i) => expect(e.seq).toBe(i));
  });

  it("records the Vitamin D stale-constant correction", () => {
    const corr = trail.entries.find((e) => e.kind === "correction" && e.nutrientId === "vitaminD");
    expect(corr).toBeDefined();
    expect(corr?.detail).toMatch(/20 mcg/);
  });

  it("records the supplement-panel note (fat/cholesterol non-declarable per 101.36)", () => {
    const finding = trail.entries.find((e) => e.kind === "finding");
    expect(finding).toBeDefined();
    expect(finding?.detail).toMatch(/Total Fat/);
  });

  it("has at least one rounding, class, and pipeline entry per declared nutrient", () => {
    const ids = res.panel?.nutrients.map((n) => n.nutrientId) ?? [];
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const forId = trail.entries.filter((e) => e.nutrientId === id);
      expect(forId.some((e) => e.kind === "rounding")).toBe(true);
      expect(forId.some((e) => e.kind === "class")).toBe(true);
      expect(forId.some((e) => e.step === "pipeline")).toBe(true);
    }
  });

  it("every entry carries the fields required by the audit schema", () => {
    for (const e of trail.entries) {
      expect(typeof e.seq).toBe("number");
      expect(typeof e.kind).toBe("string");
      expect(typeof e.step).toBe("string");
      expect(typeof e.detail).toBe("string");
    }
  });
});
