import { describe, it, expect } from "vitest";
import { validateIngredientPayload } from "../validate.js";

describe("validateIngredientPayload", () => {
  it("accepts a minimal valid ingredient", () => {
    const result = validateIngredientPayload({ name: "New Ingredient" });
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ name: "New Ingredient", caloriesPer100g: 0, per100g: {} });
  });

  it("trims name and keeps allow-listed identity fields", () => {
    const result = validateIngredientPayload({
      name: "  Citric Acid  ",
      tradeName: "Acme Citric",
      cas: "77-92-9",
      gcas: "10045074",
      caloriesPer100g: 247,
      per100g: { totalCarbohydrate: 99.45, sodium: 0.3 },
    });
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({
      name: "Citric Acid",
      tradeName: "Acme Citric",
      cas: "77-92-9",
      gcas: "10045074",
      caloriesPer100g: 247,
      per100g: { totalCarbohydrate: 99.45, sodium: 0.3 },
    });
  });

  it("rejects a missing or empty name", () => {
    expect(validateIngredientPayload({}).ok).toBe(false);
    expect(validateIngredientPayload({ name: "   " }).ok).toBe(false);
  });

  it("rejects out-of-range numbers", () => {
    expect(validateIngredientPayload({ name: "x", caloriesPer100g: -1 }).ok).toBe(false);
    expect(validateIngredientPayload({ name: "x", caloriesPer100g: 999999 }).ok).toBe(false);
    expect(
      validateIngredientPayload({ name: "x", per100g: { sodium: "not-a-number" } }).ok,
    ).toBe(false);
  });

  it("silently drops unknown nutrient ids instead of storing them", () => {
    const result = validateIngredientPayload({
      name: "x",
      per100g: { sodium: 1, __proto__: 2, madeUpNutrient: 3 },
    });
    expect(result.ok).toBe(true);
    expect(result.value.per100g).toEqual({ sodium: 1 });
  });

  it("rejects a non-object body", () => {
    expect(validateIngredientPayload(null).ok).toBe(false);
    expect(validateIngredientPayload("name").ok).toBe(false);
    expect(validateIngredientPayload([1, 2]).ok).toBe(false);
  });
});
