// ---------------------------------------------------------------------------
// realSurrogate.ts — TypeScript port of the DEM-trained packing surrogate.
//
// THIS IS THE REAL MODEL. Unlike the old placeholder math, the packing
// fraction φ predicted here comes straight from the Gaussian-Process
// surrogates that were fit to Aspherix DEM simulations and validated against
// full-bottle DEM runs (see model/INTEGRATION_HANDOFF.md, §5–§7).
//
// The Python reference implementation is `gummy_bottle_model.py` +
// `gp_surrogate.py` + `wall_gp.py`. This file re-implements the *evaluation*
// path (not the training) in the browser by loading the exact fitted
// coefficients that Python exported to JSON:
//
//   • phi_gp.json  — GP(H, ρ) gummy-parameter trend   (per family)
//   • wall_gp.json — φ_eff(λ) wall / finite-size law   (per family)
//
// The math below is the same exact GP posterior (Rasmussen & Williams
// eqs 2.23–2.24) the Python code runs — a couple of dot products against the
// stored Cholesky factor. It is deterministic and dependency-free.
//
// >>> To retrain the model, rerun the Python pipeline and drop in fresh
//     phi_gp.json / wall_gp.json. Nothing in this file changes. <<<
// ---------------------------------------------------------------------------

import phiGpRaw from "./phi_gp.json";
import wallGpRaw from "./wall_gp.json";

export type GummyFamily = "EC" | "DoryNew";

// ---- fitted-coefficient JSON shapes ---------------------------------------
interface PhiGpFamily {
  ls: number[];
  sf2: number;
  noise: number;
  X: number[][];
  alpha: number[];
  L: number[][];
  ymean_gp: number;
  xmean: number[];
  xstd: number[];
  ymean: number;
  ystd: number;
  box: Record<string, [number, number]>;
  noise_std_logit: number;
  n: number;
}
interface WallGpResidual {
  ls: number[];
  sf2: number;
  noise: number;
  X: number[][];
  alpha: number[];
  L: number[][];
  xmean: number;
  xstd: number;
  ystd: number;
  n: number;
}
interface WallGpFamily {
  phi_inf: number;
  c: number;
  gp?: WallGpResidual;
}

const PHI_GP = (phiGpRaw as unknown as {
  families: Record<string, PhiGpFamily>;
}).families;
const WALL_GP = (wallGpRaw as unknown as {
  families: Record<string, WallGpFamily>;
}).families;

// ---------------------------------------------------------------------------
// The validated design space (mirrors README_BUNDLE.md "Where the model is
// VALID" + gummy_bottle_model.py VALID_LAMBDA). Outside any of these the
// prediction is an EXTRAPOLATION and must be flagged, never trusted.
// ---------------------------------------------------------------------------
export const VALID_LAMBDA: [number, number] = [2.5, 6.0];
// Full-bottle DEM validation only exists in this tighter λ band.
export const VALIDATED_BOTTLE_LAMBDA: [number, number] = [3.9, 4.7];
export const FAMILY_H_RANGE: Record<GummyFamily, [number, number]> = {
  EC: [6.5, 11.5],
  DoryNew: [10.0, 15.0],
};

// Nominal anchor points of the wall-law backbone (gummy_bottle_model.py).
const NOMINAL_H: Record<GummyFamily, number> = { EC: 9.5, DoryNew: 13.0 };
const NOMINAL_RHO = 1425.0;

// Reference gummy geometry (gen_gummy.py mold curve + reference volumes).
const MOLD_A = 0.391;
const MOLD_B = 14.3533; // mm
const REF_VG_MM3: Record<GummyFamily, number> = { EC: 1753.1, DoryNew: 2710.4 };

/** Mold-constrained gummy base diameter for a total height (mm). */
export function baseDiameterMm(H_mm: number): number {
  return MOLD_A * H_mm + MOLD_B;
}

/**
 * Single-gummy solid volume (mm³) for a family at height H.
 * The reference shape is non-uniformly scaled on the mold curve, so volume
 * scales as sxy²·sz (gen_gummy.py). This replaces the old frustum estimate.
 */
export function gummyVolumeMm3(family: GummyFamily, H_mm: number): number {
  const Href = NOMINAL_H[family];
  const dRef = baseDiameterMm(Href);
  const sxy = baseDiameterMm(H_mm) / dRef;
  const sz = H_mm / Href;
  return REF_VG_MM3[family] * sxy * sxy * sz;
}

// ---------------------------------------------------------------------------
// Pure linear algebra (SPD systems) — matches gp_surrogate.py exactly.
// ---------------------------------------------------------------------------
function rbf(a: number[], b: number[], ls: number[], sf2: number): number {
  let s = 0;
  for (let d = 0; d < a.length; d++) {
    const t = (a[d] - b[d]) / ls[d];
    s += t * t;
  }
  return sf2 * Math.exp(-0.5 * s);
}

/** Forward substitution: solve L y = b for lower-triangular L. */
function solveLower(L: number[][], b: number[]): number[] {
  const n = L.length;
  const y = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < i; k++) s += L[i][k] * y[k];
    y[i] = (b[i] - s) / L[i][i];
  }
  return y;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

function logisticSigmoid(x: number): number {
  if (x >= 0) return 1 / (1 + Math.exp(-x));
  const z = Math.exp(x);
  return z / (1 + z);
}

// ---------------------------------------------------------------------------
// GP(H, ρ) gummy-parameter trend  (gp_surrogate.py PhiSurrogate.predict)
// Returns φ plus a 90% credible interval and an in-domain flag.
// ---------------------------------------------------------------------------
export interface GpPhiResult {
  phi: number | null;
  phiLo: number;
  phiHi: number;
  inDomain: boolean;
  reason: string;
}

function gpPhiHRho(
  family: GummyFamily,
  H: number,
  density: number,
  z = 1.645
): GpPhiResult {
  const m = PHI_GP[family];
  if (!m) {
    return { phi: null, phiLo: 0, phiHi: 0, inDomain: false, reason: "no GP for family" };
  }
  const xs = [
    (H - m.xmean[0]) / m.xstd[0],
    (density - m.xmean[1]) / m.xstd[1],
  ];
  const ks = m.X.map((xi) => rbf(xi, xs, m.ls, m.sf2));
  let meanS = m.ymean_gp;
  for (let i = 0; i < ks.length; i++) meanS += ks[i] * m.alpha[i];
  const v = solveLower(m.L, ks);
  let varS = m.sf2 + m.noise;
  for (const vi of v) varS -= vi * vi;
  if (varS < 0) varS = 0;

  const mean = meanS * m.ystd + m.ymean; // logit space
  const std = Math.sqrt(varS) * m.ystd;
  const phi = logisticSigmoid(mean);
  const phiLo = logisticSigmoid(mean - z * std);
  const phiHi = logisticSigmoid(mean + z * std);

  const reasons: string[] = [];
  const checks: Array<[string, number]> = [
    ["H_mm", H],
    ["density_kgm3", density],
  ];
  for (const [name, val] of checks) {
    const box = m.box[name];
    if (!box) continue;
    const [lo, hi] = box;
    const span = hi > lo ? hi - lo : 1;
    if (val < lo - 0.05 * span || val > hi + 0.05 * span) {
      reasons.push(
        `${name}=${val.toFixed(2)} outside trained [${lo}, ${hi}]`
      );
    }
  }
  if (std > 2.5 * m.noise_std_logit) {
    reasons.push("predictive uncertainty far above the noise floor");
  }
  return {
    phi,
    phiLo,
    phiHi,
    inDomain: reasons.length === 0,
    reason: reasons.length ? reasons.join("; ") : "in domain",
  };
}

// ---------------------------------------------------------------------------
// φ_eff(λ) wall / finite-size law  (wall_gp.py predict)
//   φ_eff(λ) = φ_inf·(1 − c/λ)  +  zero-mean residual GP(1/λ)
// ---------------------------------------------------------------------------
export interface WallPhiResult {
  phi: number;
  phiLo: number;
  phiHi: number;
  note: string;
}

function wallPhiEff(family: GummyFamily, lam: number, z = 1.645): WallPhiResult {
  const f = WALL_GP[family];
  const meanLaw = f.phi_inf * (1 - f.c / lam);
  const gp = f.gp;
  if (!gp) {
    return {
      phi: meanLaw,
      phiLo: meanLaw,
      phiHi: meanLaw,
      note: `wall-law only: φ_inf=${f.phi_inf} c=${f.c}`,
    };
  }
  const xs = [(1 / lam - gp.xmean) / gp.xstd];
  const ks = gp.X.map((xi) => rbf(xi, xs, gp.ls, gp.sf2));
  let rS = 0;
  for (let i = 0; i < ks.length; i++) rS += ks[i] * gp.alpha[i];
  const v = solveLower(gp.L, ks);
  let varS = gp.sf2 + gp.noise;
  for (const vi of v) varS -= vi * vi;
  if (varS < 0) varS = 0;
  const r = rS * gp.ystd;
  const std = Math.sqrt(varS) * gp.ystd;
  const phi = meanLaw + r;
  return {
    phi,
    phiLo: phi - z * std,
    phiHi: phi + z * std,
    note: `wall-GP mean(φ_inf=${f.phi_inf.toFixed(3)}, c=${f.c.toFixed(
      3
    )}) + residual`,
  };
}

// ---------------------------------------------------------------------------
// The combined φ used for a bottle, exactly as gummy_bottle_model.evaluate():
//   φ_used = φ_eff(λ) · [ GP(H, ρ) / GP(H_nom, ρ_nom) ]
// The wall law sets the absolute level + λ dependence; the GP ratio carries
// the relative gummy-height / density trend.
// ---------------------------------------------------------------------------
export interface PhiEvaluation {
  phiUsed: number;
  phiLo: number;
  phiHi: number;
  phiShallow: number;
  lambda: number;
  baseDiameterMm: number;
  gummyVolumeMm3: number;
  inValidatedDomain: boolean;
  validityWarnings: string[];
  phiSource: string;
}

export function evaluatePhi(
  family: GummyFamily,
  H_mm: number,
  densityKgM3: number,
  bodyDiameterMm: number,
  /**
   * Cross-section shape correction on φ (default 1 = round, no change).
   * For non-circular (rectangular / oblong) bodies the flat walls pack a touch
   * looser than a round wall at the same λ; `wall.ts` supplies a small
   * literature-motivated factor < 1. Round bottles always pass 1 here, so their
   * prediction is bit-identical to before this parameter existed.
   */
  wallShapeFactor = 1
): PhiEvaluation {
  const dBase = baseDiameterMm(H_mm);
  const vg = gummyVolumeMm3(family, H_mm);
  // NOTE: for a rectangle `bodyDiameterMm` is the *hydraulic* diameter
  // (4·Area/Perimeter), which reduces exactly to the physical diameter for a
  // circle — so λ stays the same well-defined "gummies across" length scale.
  const lambda = bodyDiameterMm / dBase;

  const gp = gpPhiHRho(family, H_mm, densityKgM3);
  const wall = wallPhiEff(family, lambda);

  // fold in the relative GP(H,ρ) trend vs nominal.
  const phiShallow = gp.phi ?? wall.phi;
  const gpNom = gpPhiHRho(family, NOMINAL_H[family], NOMINAL_RHO);
  let ratio = 1;
  if (gp.phi != null && gpNom.phi != null && gpNom.phi > 0) {
    ratio = gp.phi / gpNom.phi;
  }
  const phiUsed = wall.phi * ratio * wallShapeFactor;
  // scale the wall CI by the same ratio + shape factor to keep the band consistent.
  const phiLo = wall.phiLo * ratio * wallShapeFactor;
  const phiHi = wall.phiHi * ratio * wallShapeFactor;

  // ---- validity guard (where the model stops being trusted) --------------
  // The cross-section shape (round vs. oblong) is NOT a validity gate: an
  // oblong bottle is mapped onto the same wall law through its hydraulic
  // diameter, so it is judged by the SAME criteria as a round bottle — the λ
  // range and the trained gummy (H, ρ) domain. Only those two flip a result to
  // "outside model range".
  const warnings: string[] = [];
  const [loLam, hiLam] = VALID_LAMBDA;
  if (lambda < loLam || lambda > hiLam) {
    warnings.push(
      `λ = ${lambda.toFixed(2)} gummies-across is outside the validated ` +
        `wall-law range [${loLam}, ${hiLam}] — extrapolation.`
    );
  }
  if (!gp.inDomain) {
    warnings.push(
      `Gummy (H = ${H_mm.toFixed(1)} mm, ρ = ${densityKgM3.toFixed(
        0
      )} kg/m³) is outside the trained GP domain: ${gp.reason}.`
    );
  }

  let phiSource = wall.note + ` × GP(H,ρ)/nom = ${ratio.toFixed(3)}`;
  if (wallShapeFactor !== 1) {
    phiSource += ` × shape = ${wallShapeFactor.toFixed(3)}`;
  }
  if (warnings.length) phiSource += "  [EXTRAPOLATION]";

  return {
    phiUsed,
    phiLo,
    phiHi,
    phiShallow,
    lambda,
    baseDiameterMm: dBase,
    gummyVolumeMm3: vg,
    inValidatedDomain: warnings.length === 0,
    validityWarnings: warnings,
    phiSource,
  };
}

export { clamp as _clamp };
