import type { MacroGrams } from "./macros";

// Method C — new default. Carbohydrate calories exclude non-digestible fiber, and
// soluble fiber contributes 2 kcal/g. 21 CFR 101.9(c)(1)(i)(C).
//   digestibleCarb = totalCarbohydrate − dietaryFiber − sugarAlcohol
//   kcal = 4·protein + 9·totalFat + 4·digestibleCarb + 2·solubleFiber  (+ sugar-alcohol term)
//
// Net effect vs Method B: insoluble fiber 0 kcal/g, soluble fiber 2 kcal/g.
// Verified against spec target: reference product → 25.8894695168 → 25 cal.

export interface MethodCResult {
  kcal: number;
  flags: string[];
}

export function caloriesMethodC(m: MacroGrams): MethodCResult {
  const flags: string[] = [];
  const digestibleCarb = m.totalCarbohydrate - m.dietaryFiber - m.sugarAlcohol;
  let kcal = 4 * m.protein + 9 * m.totalFat + 4 * digestibleCarb + 2 * m.solubleFiber;

  if (m.sugarAlcohol > 0) {
    // Sugar alcohols are not a single value under 101.9(c)(1)(i)(C); 2.4 kcal/g is a
    // placeholder pending the specific polyol. Flagged, never silent.
    kcal += 2.4 * m.sugarAlcohol;
    flags.push("Sugar alcohol present: applied placeholder 2.4 kcal/g; confirm polyol-specific factor.");
  }
  return { kcal, flags };
}
