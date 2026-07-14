// Parity + sanity tests for the DEM-trained packing surrogate.
// These lock the TypeScript port (realSurrogate.ts) to the numbers produced by
// the Python reference (gp_surrogate.py + wall_gp.py). If phi_gp.json /
// wall_gp.json are retrained, regenerate the expected values below.
import { describe, it, expect } from "vitest";
import {
  evaluatePhi,
  gummyVolumeMm3,
  baseDiameterMm,
  VALID_LAMBDA,
  FAMILY_H_RANGE,
} from "../model/realSurrogate";
import {
  predictFill,
  recommendCountForTarget,
  targetBandMm,
  type PredictionInputs,
} from "../model/surrogateModel";

// Ground-truth GP(H,ρ) values captured straight from the Python reference
// modules (see model/gp_surrogate.py). Tolerance is tight on purpose.
const GP_REF: Array<[Parameters<typeof evaluatePhi>[0], number, number, number]> = [
  ["EC", 9.5, 1425, 0.514467],
  ["EC", 11.5, 1500, 0.518263],
  ["DoryNew", 13.0, 1425, 0.511628],
];

describe("realSurrogate GP parity", () => {
  it("matches the Python GP(H,ρ) posterior mean", () => {
    for (const [fam, H, rho, expected] of GP_REF) {
      // Body diameter chosen so λ = 4.21 (a validated bottle point).
      const dBase = baseDiameterMm(H);
      const evalOut = evaluatePhi(fam, H, rho, dBase * 4.21);
      // evaluatePhi folds the wall law + GP ratio; here we only assert the
      // *shallow* GP branch, which is the raw GP(H,ρ) mean.
      expect(evalOut.phiShallow).toBeCloseTo(expected, 4);
    }
  });
});

describe("evaluatePhi validity envelope", () => {
  it("flags an in-domain nominal EC bottle as valid", () => {
    const dBase = baseDiameterMm(9.5);
    const out = evaluatePhi("EC", 9.5, 1425, dBase * 4.21);
    expect(out.inValidatedDomain).toBe(true);
    expect(out.validityWarnings).toHaveLength(0);
    expect(out.lambda).toBeCloseTo(4.21, 2);
    expect(out.phiUsed).toBeGreaterThan(0.45);
    expect(out.phiUsed).toBeLessThan(0.65);
  });

  it("flags λ below the validated range as an extrapolation", () => {
    const dBase = baseDiameterMm(9.5);
    // λ = 1.5 → far below VALID_LAMBDA[0]
    const out = evaluatePhi("EC", 9.5, 1425, dBase * 1.5);
    expect(out.inValidatedDomain).toBe(false);
    expect(out.validityWarnings.join(" ")).toMatch(/wall-law range/);
  });

  it("flags a gummy height outside the trained GP box", () => {
    const H = FAMILY_H_RANGE.EC[1] + 6; // well above the EC box
    const dBase = baseDiameterMm(H);
    const out = evaluatePhi("EC", H, 1425, dBase * 4.2);
    expect(out.inValidatedDomain).toBe(false);
  });

  it("keeps VALID_LAMBDA ordered and positive", () => {
    expect(VALID_LAMBDA[0]).toBeLessThan(VALID_LAMBDA[1]);
    expect(VALID_LAMBDA[0]).toBeGreaterThan(0);
  });
});

describe("gummyVolumeMm3 mold scaling", () => {
  it("returns the reference volume at nominal height", () => {
    expect(gummyVolumeMm3("EC", 9.5)).toBeCloseTo(1753.1, 1);
    expect(gummyVolumeMm3("DoryNew", 13.0)).toBeCloseTo(2710.4, 1);
  });

  it("scales monotonically with height", () => {
    expect(gummyVolumeMm3("EC", 11)).toBeGreaterThan(gummyVolumeMm3("EC", 8));
  });
});

describe("predictFill end-to-end sanity", () => {
  const base: PredictionInputs = {
    bottleVolumeMl: 500,
    shoulderHeightMm: 110,
    neckHeightMm: 118,
    bodyWidthMm: 76,
    bottleShape: "round",
    family: "EC",
    heightMm: 9.5,
    densityGPerMl: 1.425,
    weightG: 2.5,
    count: 90,
  };

  it("produces physically plausible outputs for a validated scenario", () => {
    const r = predictFill(base);
    expect(r.inValidatedDomain).toBe(true);
    expect(r.phiUsed).toBeGreaterThan(0);
    expect(r.phiUsed).toBeLessThan(1);
    expect(r.phiLo).toBeLessThanOrEqual(r.phiUsed);
    expect(r.phiHi).toBeGreaterThanOrEqual(r.phiUsed);
    expect(r.productFillHeightMm).toBeGreaterThan(0);
    expect(r.slackFillPct).toBeGreaterThanOrEqual(0);
    expect(r.slackFillPct).toBeLessThanOrEqual(100);
    expect(r.fillFraction).toBeGreaterThan(0);
  });

  it("increases fill height monotonically with count", () => {
    const low = predictFill({ ...base, count: 40 });
    const high = predictFill({ ...base, count: 160 });
    expect(high.productFillHeightMm).toBeGreaterThan(low.productFillHeightMm);
  });

  it("is invariant in φ to count (φ depends only on gummy+bottle)", () => {
    const a = predictFill({ ...base, count: 40 });
    const b = predictFill({ ...base, count: 160 });
    expect(a.phiUsed).toBeCloseTo(b.phiUsed, 10);
  });

  it("flags an oversized gummy as outside model range", () => {
    const r = predictFill({ ...base, heightMm: 20 });
    expect(r.status).toBe("Outside model range");
    expect(r.inValidatedDomain).toBe(false);
  });

  it("keeps the recommended-count fill inside the rendered target band", () => {
    const { result } = recommendCountForTarget({
      bottleVolumeMl: base.bottleVolumeMl,
      shoulderHeightMm: base.shoulderHeightMm,
      neckHeightMm: base.neckHeightMm,
      bodyWidthMm: base.bodyWidthMm,
      bottleShape: base.bottleShape,
      family: base.family,
      heightMm: base.heightMm,
      densityGPerMl: base.densityGPerMl,
      weightG: base.weightG,
    });
    const band = targetBandMm(result);
    expect(result.productFillHeightMm).toBeGreaterThanOrEqual(band.lowerMm);
    expect(result.productFillHeightMm).toBeLessThanOrEqual(band.upperMm);
  });
});
