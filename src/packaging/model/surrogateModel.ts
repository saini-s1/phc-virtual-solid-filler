// surrogateModel.ts — the prediction entry point for the Virtual Solid Filler.
//
// This is now backed by the REAL DEM-trained surrogate (see
// `realSurrogate.ts`, which ports the fitted GP coefficients from the Python
// pipeline). The packing fraction φ is a genuine model output; the fill-height
// and slack geometry are then computed from the resolved bottle profile.
//
// The input/output shapes are kept stable on purpose so the UI panels don't
// need to know the model changed — they still read `PredictionResult`.

import {
  evaluatePhi,
  VALID_LAMBDA,
  VALIDATED_BOTTLE_LAMBDA,
  FAMILY_H_RANGE,
  type GummyFamily,
} from "./realSurrogate";

export type PredictionStatus =
  | "Good"
  | "Watchout"
  | "Overfilled"
  | "Outside model range";

export interface PredictionInputs {
  // Bottle geometry
  bottleVolumeMl: number;
  shoulderHeightMm: number;
  neckHeightMm: number;
  bodyWidthMm: number; // diameter (round) or front width (rectangle)
  bodyDepthMm?: number; // front-to-back depth, rectangles only
  cornerRadiusMm?: number; // rounded-corner radius, rectangles only (optional)
  bottleShape: "round" | "rectangle";
  // Gummy (real model driver): DEM mold family + height + material
  family: GummyFamily;
  heightMm: number;
  densityGPerMl: number;
  weightG: number; // single-gummy product weight
  // Frustum radii — visualization only, ignored by the model
  radiusTopMm?: number;
  radiusBottomMm?: number;
  count: number;
}

export interface PredictionResult {
  // Derived gummy properties
  gummyVolumeMl: number;
  gummyMassG: number;
  // Headline outputs
  productFillHeightMm: number;
  slackFillPct: number;
  fillRatePct: number;
  dosageG: number;
  // Supporting values
  slackFromTopMm: number;
  slackFromShoulderMm: number;
  totalInternalHeightMm: number;
  estimatedPackedVolumeMl: number;
  fillFraction: number;
  status: PredictionStatus;
  modelWarning: string | null;
  // Real-model fields (surfaced in the UI / disclaimers)
  family: GummyFamily;
  phiUsed: number; // predicted packing fraction
  phiLo: number; // 90% credible interval, low
  phiHi: number; // 90% credible interval, high
  lambda: number; // gummies-across = body diameter / gummy base diameter
  effectiveDiameterMm: number; // λ length scale (hydraulic dia for rectangles)
  crossSectionAspectRatio: number; // 1 = round/square; >1 = elongated oblong
  wallShapeFactor: number; // flat-wall φ correction applied (1 = round)
  targetBandLowerMm: number; // fill height at ~22% slack
  targetBandIdealMm: number; // fill height at 15% slack target
  targetBandUpperMm: number; // fill height at ~6% slack
  nAtShoulder: number; // gummies that reach the shoulder (fill-to-shoulder line)
  nAtTarget: number; // ideal count at the 15% slack target (85% fill)
  bulkDensityKgM3: number;
  inValidatedDomain: boolean;
  isFullyValidated: boolean; // inside the tighter full-bottle DEM band
  validityWarnings: string[];
  phiSource: string;
}

// Count-slider limits (mirrors the UI range). Not a model bound anymore — the
// real validated envelope lives in realSurrogate.ts (VALID_LAMBDA,
// FAMILY_H_RANGE, and the GP applicability domain).
export const MODEL_BOUNDS = {
  countMin: 5,
  countMax: 250,
};

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

// Real bottles carry headspace ABOVE the fill-to-shoulder line (dome + neck).
// The full-bottle DEM validation set measures slack against the TRUE total
// internal volume, which averages ~18% larger than the fill-to-shoulder
// (body) volume. Sizing the slack denominator with this factor removes the
// ~9 pp systematic under-prediction seen when the nominal (fill-line) volume
// was used instead.
// TODO: replace HEADSPACE_FRACTION with measured CAD headspace per bottle.
const HEADSPACE_FRACTION = 0.18;

// Ideal SLACK-FILL target (product headspace): fill the bottle to 85% of its
// true internal volume, leaving 15% headspace. This is the fill goal — distinct
// from HEADSPACE_FRACTION above, which is fixed bottle geometry (dome + neck).
// Drives the status band, the recommend button, and the visualizer target line.
const IDEAL_SLACK_PCT = 15; // 15% headspace  ->  85% fill = ideal
const GOOD_SLACK_LO = 6; // below this = too little headspace (Overfilled)
const GOOD_SLACK_HI = 22; // above this = too much slack (Watchout)

// Flat-wall packing penalty for non-round bottles. Flat container walls pack a
// little looser than a curved wall at the same hydraulic diameter; this scales
// the strength of that effect via f(AR) = 1 − α·(1 − 1/AR). α is a small,
// literature-motivated placeholder (~2%). The two real 300 cc bottles in the
// presets (round packer vs. oblong "cub") show the hydraulic diameters land
// within ~1% of each other, so this correction is intentionally gentle.
// TODO: replace FLAT_WALL_ALPHA with a value fit to rectangular-container DEM
//       runs (same λ-sweep, boxes instead of cylinders) — see INTEGRATION_HANDOFF.md §8.
const FLAT_WALL_ALPHA = 0.02;

/**
 * Resolve the effective body cross-section for the packing model.
 *
 * Two numbers matter and they are NOT the same for non-round bottles:
 *
 *  • `areaMm2` — the true cross-sectional area, used for the fill-height
 *    geometry (fill height = occupied volume / area). This is exact for any
 *    shape, so nothing about the height math changes.
 *
 *  • `diameterMm` — the length scale that feeds λ ("gummies across") and the
 *    wall law. For a rectangle we use the HYDRAULIC DIAMETER
 *        D_h = 4·Area / Perimeter
 *    which is the standard equivalent diameter for non-circular ducts
 *    (see en.wikipedia.org/wiki/Hydraulic_diameter). It reduces EXACTLY to the
 *    physical diameter for a circle, so round bottles are unchanged, while an
 *    oblong bottle now gets the physically-correct (smaller) wall length scale
 *    instead of the old area-equivalent diameter, which ran too large.
 *
 * We also return the cross-section aspect ratio and a small flat-wall φ
 * correction (`shapeFactor`): flat container walls pack a touch looser than a
 * curved wall at the same D_h. This is a literature-motivated placeholder,
 * NOT yet DEM-calibrated — see FLAT_WALL_ALPHA.
 */
function bottleBody(inputs: PredictionInputs): {
  areaMm2: number;
  diameterMm: number;
  aspectRatio: number;
  shapeFactor: number;
} {
  if (inputs.bottleShape === "rectangle") {
    const width = inputs.bodyWidthMm;
    const depth = inputs.bodyDepthMm ?? inputs.bodyWidthMm;
    // Rounded-corner rectangle (default sharp corners if radius not given).
    // Clamp r so it can't exceed half the shorter side.
    const r = clamp(inputs.cornerRadiusMm ?? 0, 0, Math.min(width, depth) / 2);
    const area = width * depth - (4 - Math.PI) * r * r;
    const perimeter = 2 * (width + depth) - 8 * r + 2 * Math.PI * r;
    const hydraulicDiameter = (4 * area) / perimeter;
    const aspectRatio = Math.max(width, depth) / Math.min(width, depth);
    // f(AR) = 1 − α·(1 − 1/AR): 1 for a square (AR=1), dropping slightly as the
    // cross-section elongates. α is small and clearly flagged as a placeholder.
    const shapeFactor = 1 - FLAT_WALL_ALPHA * (1 - 1 / aspectRatio);
    return {
      areaMm2: area,
      diameterMm: hydraulicDiameter,
      aspectRatio,
      shapeFactor,
    };
  }
  const r = inputs.bodyWidthMm / 2;
  return {
    areaMm2: Math.PI * r * r,
    diameterMm: inputs.bodyWidthMm,
    aspectRatio: 1,
    shapeFactor: 1,
  };
}

function totalInternalVolumeMm3(areaMm2: number, shoulderHeightMm: number) {
  return (areaMm2 * shoulderHeightMm) / (1 - HEADSPACE_FRACTION);
}

function fillHeightFromOccupiedVolume(
  occupiedVolumeMm3: number,
  areaMm2: number,
  shoulderHeightMm: number,
  totalInternalHeightMm: number
) {
  const bodyVolumeMm3 = areaMm2 * shoulderHeightMm;
  if (occupiedVolumeMm3 <= bodyVolumeMm3) {
    return occupiedVolumeMm3 / areaMm2;
  }

  // Above the shoulder the cross-section tapers toward the neck; approximate
  // the shoulder→mouth region with a reduced effective area.
  const extra = occupiedVolumeMm3 - bodyVolumeMm3;
  const regionH = totalInternalHeightMm - shoulderHeightMm;
  const regionArea = areaMm2 * 0.5;
  return shoulderHeightMm + Math.min(extra / regionArea, regionH * 1.05);
}

/**
 * The whole prediction. φ comes from the trained surrogate; the fill geometry
 * is computed from the resolved bottle body profile.
 */
export function predictFill(inputs: PredictionInputs): PredictionResult {
  const densityKgM3 = inputs.densityGPerMl * 1000;
  const { areaMm2, diameterMm, aspectRatio, shapeFactor } =
    bottleBody(inputs);

  const phiEval = evaluatePhi(
    inputs.family,
    inputs.heightMm,
    densityKgM3,
    diameterMm,
    shapeFactor
  );

  const vgMm3 = phiEval.gummyVolumeMm3;
  const gummyVolumeMl = vgMm3 / 1000;
  const gummyMassG = gummyVolumeMl * inputs.densityGPerMl;
  const phi = phiEval.phiUsed;

  const totalInternalHeightMm = Math.max(
    inputs.neckHeightMm,
    inputs.shoulderHeightMm + 4
  );

  // Bulk volume the settled gummies occupy: solid volume / packing fraction.
  const occupiedVolumeMm3 = (inputs.count * vgMm3) / Math.max(phi, 1e-6);

  // True total internal volume = fill-to-shoulder body volume + real headspace
  // above the shoulder. Derived from the bottle geometry (not the nominal
  // label volume) so slack-fill matches the DEM full-bottle measurement.
  const totalVolumeMm3 = totalInternalVolumeMm3(
    areaMm2,
    inputs.shoulderHeightMm
  );

  // Convert occupied volume → fill height along the bottle profile.
  let productFillHeightMm = fillHeightFromOccupiedVolume(
    occupiedVolumeMm3,
    areaMm2,
    inputs.shoulderHeightMm,
    totalInternalHeightMm
  );
  productFillHeightMm = clamp(
    productFillHeightMm,
    0,
    totalInternalHeightMm * 1.05
  );

  const slackFromTopMm = totalInternalHeightMm - productFillHeightMm;
  const slackFromShoulderMm = Math.max(
    0,
    inputs.shoulderHeightMm - productFillHeightMm
  );
  const slackFillPct =
    (Math.max(0, totalVolumeMm3 - occupiedVolumeMm3) / totalVolumeMm3) *
    100;
  const fillFraction = clamp(occupiedVolumeMm3 / totalVolumeMm3, 0, 1.25);
  const fillRatePct = Math.min(fillFraction, 1) * 100;
  const dosageG = inputs.count * inputs.weightG;
  const nAtShoulder = (phi * areaMm2 * inputs.shoulderHeightMm) / vgMm3;
  // Ideal count that lands the fill at the 15% slack target (85% of total vol).
  const nAtTarget =
    ((1 - IDEAL_SLACK_PCT / 100) * totalVolumeMm3 * phi) / vgMm3;
  const targetBandLowerMm = fillHeightFromOccupiedVolume(
    (1 - GOOD_SLACK_HI / 100) * totalVolumeMm3,
    areaMm2,
    inputs.shoulderHeightMm,
    totalInternalHeightMm
  );
  const targetBandIdealMm = fillHeightFromOccupiedVolume(
    (1 - IDEAL_SLACK_PCT / 100) * totalVolumeMm3,
    areaMm2,
    inputs.shoulderHeightMm,
    totalInternalHeightMm
  );
  const targetBandUpperMm = fillHeightFromOccupiedVolume(
    (1 - GOOD_SLACK_LO / 100) * totalVolumeMm3,
    areaMm2,
    inputs.shoulderHeightMm,
    totalInternalHeightMm
  );

  const modelWarning = phiEval.validityWarnings.length
    ? phiEval.validityWarnings.join(" ")
    : null;

  let status: PredictionStatus;
  if (!phiEval.inValidatedDomain) {
    status = "Outside model range";
  } else if (slackFillPct < GOOD_SLACK_LO) {
    // too little headspace (fill sits above the 85% target)
    status = "Overfilled";
  } else if (slackFillPct > GOOD_SLACK_HI) {
    // too much slack (fill well below the 85% target)
    status = "Watchout";
  } else {
    // headspace lands in the acceptable band around the 15% ideal
    status = "Good";
  }

  const [loBand, hiBand] = VALIDATED_BOTTLE_LAMBDA;
  // The tightest "fully validated" badge is reserved for round bodies, which is
  // where the full-bottle reference set lives. Oblong bottles are modeled from
  // the same physics via the hydraulic diameter and sit in the reliable — but
  // not full-bottle-anchored — tier.
  const isFullyValidated =
    inputs.bottleShape === "round" &&
    phiEval.inValidatedDomain &&
    phiEval.lambda >= loBand &&
    phiEval.lambda <= hiBand;

  return {
    gummyVolumeMl,
    gummyMassG,
    productFillHeightMm,
    slackFillPct,
    fillRatePct,
    dosageG,
    slackFromTopMm,
    slackFromShoulderMm,
    totalInternalHeightMm,
    estimatedPackedVolumeMl: occupiedVolumeMm3 / 1000,
    fillFraction,
    status,
    modelWarning,
    family: inputs.family,
    phiUsed: phi,
    phiLo: phiEval.phiLo,
    phiHi: phiEval.phiHi,
    lambda: phiEval.lambda,
    effectiveDiameterMm: diameterMm,
    crossSectionAspectRatio: aspectRatio,
    wallShapeFactor: shapeFactor,
    targetBandLowerMm,
    targetBandIdealMm,
    targetBandUpperMm,
    nAtShoulder,
    nAtTarget,
    bulkDensityKgM3: phi * densityKgM3,
    inValidatedDomain: phiEval.inValidatedDomain,
    isFullyValidated,
    validityWarnings: phiEval.validityWarnings,
    phiSource: phiEval.phiSource,
  };
}

/** Plain-English interpretation of a result, for the Outputs panel. */
export function interpret(result: PredictionResult): string {
  if (result.status === "Outside model range") {
    return (
      "Inputs fall outside the surrogate's validated design space. The number " +
      "shown is an extrapolation from the DEM-trained model and must not be " +
      "used for technical decisions — see the validity warning below."
    );
  }
  if (result.status === "Overfilled") {
    return `Predicted headspace is only ~${result.slackFillPct.toFixed(
      0
    )}% — below the 15% target (85% fill). Reduce count or move to a larger bottle.`;
  }
  if (result.status === "Watchout") {
    return `Predicted headspace ~${result.slackFillPct.toFixed(
      0
    )}% — above the 15% target slack. Verify against slack-fill limits before committing.`;
  }
  return `Headspace lands ~${result.slackFillPct.toFixed(
    0
  )}% — right around the 15% target (85% fill) at a predicted packing fraction φ = ${result.phiUsed.toFixed(
    3
  )}.`;
}

/**
 * Bounds of the "Good" fill band, expressed as fill height along the bottle.
 * These are derived from the same volume-based slack targets the model uses,
 * then mapped back onto bottle height with the current shoulder/neck geometry.
 */
export function targetBandMm(
  result: Pick<
    PredictionResult,
    "targetBandLowerMm" | "targetBandIdealMm" | "targetBandUpperMm"
  >
) {
  return {
    lowerMm: result.targetBandLowerMm,
    idealMm: result.targetBandIdealMm,
    upperMm: result.targetBandUpperMm,
  };
}

export interface CountRecommendation {
  count: number;
  result: PredictionResult;
  hitTarget: boolean;
}

/**
 * Recommend the gummy count that lands the fill at the 15% slack target
 * (85% of the true internal volume). φ is independent of count, so the
 * inversion is exact and linear:
 *   count = 0.85 · totalInternalVolume · φ / gummyVolume
 */
export function recommendCountForTarget(
  inputs: Omit<PredictionInputs, "count">
): CountRecommendation {
  const densityKgM3 = inputs.densityGPerMl * 1000;
  const { areaMm2, diameterMm, shapeFactor } = bottleBody(
    inputs as PredictionInputs
  );
  const phiEval = evaluatePhi(
    inputs.family,
    inputs.heightMm,
    densityKgM3,
    diameterMm,
    shapeFactor
  );

  const totalVolumeMm3 = totalInternalVolumeMm3(
    areaMm2,
    inputs.shoulderHeightMm
  );
  const targetVolumeMm3 =
    (1 - IDEAL_SLACK_PCT / 100) * totalVolumeMm3; // 85% fill

  const rawCount =
    (targetVolumeMm3 * phiEval.phiUsed) /
    Math.max(phiEval.gummyVolumeMm3, 1e-6);

  const count = clamp(
    Math.round(rawCount),
    MODEL_BOUNDS.countMin,
    MODEL_BOUNDS.countMax
  );

  const result = predictFill({ ...inputs, count });
  const hitTarget =
    result.slackFillPct >= GOOD_SLACK_LO &&
    result.slackFillPct <= GOOD_SLACK_HI;

  return { count, result, hitTarget };
}

export { VALID_LAMBDA, VALIDATED_BOTTLE_LAMBDA, FAMILY_H_RANGE };
