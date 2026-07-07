import type { RegionConfig, RoundingTier } from "../types/config";

// The ONLY place rounding happens. Tier tables come from region config — no literal
// increments here. Returns the rounded value plus an audit-ready description.

export interface RoundingOutcome {
  rounded: number | string;
  group: string;
  citation: string;
  detail: string;
}

/** Round half away from zero to the nearest `inc`, robust to binary-float half values. */
export function roundToIncrement(value: number, inc: number): number {
  const q = value / inc;
  const r = Math.sign(q) * Math.round(Math.abs(q) + 1e-9);
  const out = r * inc;
  return Object.is(out, -0) ? 0 : out;
}

/** Round to `sig` significant figures. */
export function roundSignificant(value: number, sig: number): number {
  if (value === 0) return 0;
  const digits = Math.ceil(Math.log10(Math.abs(value)));
  const power = sig - digits;
  const mag = Math.pow(10, power);
  const out = Math.round(value * mag) / mag;
  return Object.is(out, -0) ? 0 : out;
}

function applyTiers(
  value: number,
  tiers: RoundingTier[],
): { rounded: number | string; detail: string } {
  const v = Math.abs(value);
  for (const t of tiers) {
    const within = t.upTo === null || (t.inclusive ? v <= t.upTo : v < t.upTo);
    if (!within) continue;
    if (t.mode === "zero") return { rounded: 0, detail: `|${value}| < threshold → 0` };
    if (t.mode === "text") return { rounded: t.text ?? "", detail: `|${value}| → "${t.text}"` };
    const r = roundToIncrement(value, t.increment ?? 1);
    return { rounded: r, detail: `${value} → nearest ${t.increment} = ${r}` };
  }
  return { rounded: value, detail: `${value} (no tier matched)` };
}

export function roundByGroup(
  value: number,
  group: string,
  region: RegionConfig,
): RoundingOutcome {
  const rule = region.roundingRules.find((r) => r.group === group);
  if (!rule) {
    return { rounded: value, group, citation: "", detail: `no rounding rule for "${group}"` };
  }
  if ((rule.strategy ?? "tiers") === "significantFigures") {
    const sig = rule.sigFigs ?? 2;
    const r = roundSignificant(value, sig);
    return { rounded: r, group, citation: rule.citation, detail: `${value} → ${sig} sig figs = ${r}` };
  }
  const { rounded, detail } = applyTiers(value, rule.tiers ?? []);
  return { rounded, group, citation: rule.citation, detail };
}
