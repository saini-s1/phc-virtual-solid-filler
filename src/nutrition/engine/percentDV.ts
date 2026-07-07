import type { RegionConfig } from "../types/config";
import type { NutrientId } from "../types/nutrients";

// %DV computed on the UNROUNDED as-declared amount (101.9(c)(8)(i)/(d)).
// The result is rounded later, by the rounding module, never here.

export function dailyValueFor(nutrientId: NutrientId, region: RegionConfig): number | null {
  const dv = region.dailyValues.find((d) => d.nutrientId === nutrientId);
  return dv ? dv.value : null;
}

export function percentDV(asDeclared: number, dv: number | null): number | null {
  if (dv === null || dv === 0) return null;
  return (asDeclared / dv) * 100;
}
