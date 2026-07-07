import type { MacroGrams } from "./macros";

// Method B — legacy general factors (Atwater 4/4/9). 21 CFR 101.9(c)(1)(i)(B).
//   kcal = 4·protein + 4·totalCarbohydrate + 9·totalFat
// This is the PARITY method: it must reproduce the current Excel's declared calories.
//
// Excel-quirk note (parity gate, FLAG): the workbook does NOT apply pure 4/4/9. It
// carries a pre-tabulated "kCal (US Rules)" column with per-ingredient factors that
// sums to 38.369653636799995 for the reference product, whereas pure 4/4/9 gives
// 38.499. BOTH round to 40 cal, so Method-B parity holds at the declared value — but
// the unrounded numbers differ. The parity test documents this divergence explicitly
// rather than "fixing" the engine to match the Excel's intermediate column.

export function caloriesMethodB(m: MacroGrams): number {
  return 4 * m.protein + 4 * m.totalCarbohydrate + 9 * m.totalFat;
}
