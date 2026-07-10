import type { MacroGrams } from "./macros";

// Methods C and C+ — 21 CFR 101.9(c)(1)(i)(C). Both exclude non-digestible carbohydrate
// from the 4 kcal/g carb term and add fiber back at 2 kcal/g. They differ ONLY by the fiber
// data available (they share the same regulatory citation):
//
//   C  (no soluble/insoluble split): credit TOTAL dietary fiber at 2 kcal/g
//        kcal = 4·protein + 9·totalFat + 4·(totalCarb − totalFiber) + 2·totalFiber
//        → Excel "Nutrition STONF" cell C6.
//
//   C+ (soluble/insoluble split known): credit SOLUBLE fiber at 2 kcal/g
//        kcal = 4·protein + 9·totalFat + 4·(totalCarb − totalFiber) + 2·solubleFiber
//        → Excel "Nutrition STONF" cell C7 (the value the workbook declares).
//
// The formulas mirror the workbook exactly — no sugar-alcohol term (the workbook has none).

export function caloriesMethodC(m: MacroGrams): number {
  return 4 * m.protein + 9 * m.totalFat + 4 * (m.totalCarbohydrate - m.dietaryFiber) + 2 * m.dietaryFiber;
}

export function caloriesMethodCPlus(m: MacroGrams): number {
  return 4 * m.protein + 9 * m.totalFat + 4 * (m.totalCarbohydrate - m.dietaryFiber) + 2 * m.solubleFiber;
}
