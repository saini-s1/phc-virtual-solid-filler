import { describe, it, expect } from "vitest";
import { roundByGroup } from "../rounding/rounding";
import { US_REGION } from "../config/regions";

// Deterministic rounding tier boundaries, per 21 CFR 101.9(c). Each row is
// [input, group, expected]. Text outcomes are the regulation's mandated declarations.

type Row = [number, string, number | string];

const ROWS: Row[] = [
  // calories 101.9(c)(1): <5 → 0; ≤50 nearest 5; else nearest 10
  [4.9, "calories", 0],
  [5, "calories", 5],
  [50, "calories", 50],
  [51, "calories", 50],
  [55, "calories", 60],

  // fat 101.9(c)(2): <0.5 → 0; <5 nearest 0.5; else nearest 1
  [0.49, "fat", 0],
  [0.5, "fat", 0.5],
  [4.9, "fat", 5],
  [5, "fat", 5],
  [5.4, "fat", 5],

  // cholesterol 101.9(c)(3): <2 → 0; ≤5 "Less than 5 mg"; else nearest 5
  [1.9, "cholesterol", 0],
  [2, "cholesterol", "Less than 5 mg"],
  [5, "cholesterol", "Less than 5 mg"],
  [5.1, "cholesterol", 5],
  [13, "cholesterol", 15],

  // sodium 101.9(c)(4): <5 → 0; ≤140 nearest 5; else nearest 10
  [4.9, "sodium", 0],
  [5, "sodium", 5],
  [140, "sodium", 140],
  [141, "sodium", 140],
  [145, "sodium", 150],

  // gram1 101.9(c)(6): <0.5 → 0; <1 "Less than 1 g"; else nearest 1
  [0.49, "gram1", 0],
  [0.5, "gram1", "Less than 1 g"],
  [0.9, "gram1", "Less than 1 g"],
  [1, "gram1", 1],
  [1.4, "gram1", 1],

  // %DV 101.9(c)(8)(iii): <2 → 0; ≤10 nearest 2; ≤50 nearest 5; else nearest 10
  [1.9, "pctDv", 0],
  [2, "pctDv", 2],
  [10, "pctDv", 10],
  [11, "pctDv", 10],
  [13, "pctDv", 15],
  // per-nutrient micronutrient amount increments (template "Nutrition" tab, 101.9(c)(8)(iii))
  // Iron / Vit D → nearest 0.1
  [0.26450765695392, "microNearestTenth", 0.3],
  [0.0619, "microNearestTenth", 0.1],
  [0.04, "microNearestTenth", 0],
  // Vit C → nearest 1
  [5.6, "microNearestOne", 6],
  [0.00012702829824, "microNearestOne", 0],
  // Potassium / Calcium / Vit A → nearest 10
  [27.641746811217605, "microNearestTen", 30],
  [5.916770200041602, "microNearestTen", 10],
  [4.070182176, "microNearestTen", 0],
];

describe("rounding — tier boundaries (101.9(c))", () => {
  for (const [input, group, expected] of ROWS) {
    it(`${group}: ${input} → ${expected}`, () => {
      expect(roundByGroup(input, group, US_REGION).rounded).toBe(expected);
    });
  }

  it("vitamin/mineral amount uses 2 significant figures", () => {
    expect(roundByGroup(11.4667657584, "vitaminMineralAmount", US_REGION).rounded).toBe(11);
    expect(roundByGroup(0.5785412494, "vitaminMineralAmount", US_REGION).rounded).toBe(0.58);
    expect(roundByGroup(4.070182176, "vitaminMineralAmount", US_REGION).rounded).toBe(4.1);
  });
});
