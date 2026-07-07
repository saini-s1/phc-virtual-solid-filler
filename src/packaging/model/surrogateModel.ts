// ---------------------------------------------------------------------------
// surrogate model for the virtual solid filler (prototype).
//
// heads up: this is NOT a validated model. everything in here is placeholder
// math that just makes the ui behave the way a real fill model roughly would.
// anything tagged `// todo: dem coefficient` is a knob that should come from
// actual dem training data before anyone trusts an output number.
//
// >>> THIS IS THE FILE TO EDIT WHEN YOU WANT TO CHANGE THE MODEL. <<<
// the input/output shapes are kept stable on purpose, so you can rip out the
// guts of predictFill() and drop in a trained model without touching any ui.
// keep the signatures, change the math.
// ---------------------------------------------------------------------------

import { frustumVolumeMl } from "../data/productPresets";

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
  bodyWidthMm: number;
  // Gummy (frustum) geometry + material
  radiusTopMm: number;
  radiusBottomMm: number;
  heightMm: number;
  densityGPerMl: number;
  weightG: number; // single-gummy product weight
  count: number;
}

export interface PredictionResult {
  // Derived gummy properties
  gummyVolumeMl: number;
  // Headline outputs
  productFillHeightMm: number; // height the product column reaches
  slackFillPct: number; // empty headspace as % of usable height
  fillRatePct: number; // % of bottle volume occupied by product
  dosageG: number; // total product weight per bottle
  // Supporting values
  slackFromTopMm: number;
  slackFromShoulderMm: number;
  totalInternalHeightMm: number;
  estimatedPackedVolumeMl: number;
  fillFraction: number;
  status: PredictionStatus;
  modelWarning: string | null;
}

// the "we roughly trust the model in here" box. step outside any of these and
// the ui flags the run as extrapolated (see checkBounds below). swap these for
// the real dem design-space limits once we know them.
// todo: real dem limits.
export const MODEL_BOUNDS = {
  countMin: 5,
  countMax: 250,
  gummyVolumeMinMl: 1.0,
  gummyVolumeMaxMl: 8.0,
  densityMin: 0.8,
  densityMax: 2.0,
  bottleVolumeMinMl: 150,
  bottleVolumeMaxMl: 1200,
};

// how tightly tumbled gummies pack in bulk (0..1). 0.62 is a hand-wavy guess.
// the real number depends on gummy shape, how tacky the surface is, and how
// much the line vibrates. this one constant swings the fill height a lot, so
// it's the first thing worth replacing with a dem value.
// todo: dem coefficient.
const PACKING_EFFICIENCY = 0.62;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

// walk the inputs against MODEL_BOUNDS. returns a human-readable warning string
// when something is out of range, or null when everything sits inside the box.
function checkBounds(
  inputs: PredictionInputs,
  gummyVolumeMl: number
): string | null {
  const issues: string[] = [];
  if (inputs.count < MODEL_BOUNDS.countMin || inputs.count > MODEL_BOUNDS.countMax) {
    issues.push(
      `Count ${inputs.count} is outside the trained range (${MODEL_BOUNDS.countMin}–${MODEL_BOUNDS.countMax}).`
    );
  }
  if (
    gummyVolumeMl < MODEL_BOUNDS.gummyVolumeMinMl ||
    gummyVolumeMl > MODEL_BOUNDS.gummyVolumeMaxMl
  ) {
    issues.push(
      `Gummy volume ${gummyVolumeMl.toFixed(2)} mL is outside the trained range (${MODEL_BOUNDS.gummyVolumeMinMl}–${MODEL_BOUNDS.gummyVolumeMaxMl} mL).`
    );
  }
  if (
    inputs.densityGPerMl < MODEL_BOUNDS.densityMin ||
    inputs.densityGPerMl > MODEL_BOUNDS.densityMax
  ) {
    issues.push(
      `Density ${inputs.densityGPerMl.toFixed(2)} g/mL is outside the trained range (${MODEL_BOUNDS.densityMin}–${MODEL_BOUNDS.densityMax} g/mL).`
    );
  }
  if (
    inputs.bottleVolumeMl < MODEL_BOUNDS.bottleVolumeMinMl ||
    inputs.bottleVolumeMl > MODEL_BOUNDS.bottleVolumeMaxMl
  ) {
    issues.push(
      `Bottle volume ${inputs.bottleVolumeMl} mL is outside the trained range (${MODEL_BOUNDS.bottleVolumeMinMl}–${MODEL_BOUNDS.bottleVolumeMaxMl} mL).`
    );
  }
  return issues.length ? issues.join(" ") : null;
}

// the main prediction. feed it one scenario, get back fill height, slack-fill,
// dosage, status, the works. the math here is all placeholder:
//   gummyVolume  = frustum(r1, r2, h)
//   packedVolume = count * gummyVolume / packingEfficiency
//   fillFraction = packedVolume / bottleVolume
//   fillHeight   = fillFraction * usableInternalHeight
//   dosage       = count * weight
// when the trained model lands, this function body is the only thing that
// really needs to change.
export function predictFill(inputs: PredictionInputs): PredictionResult {
  const gummyVolumeMl = frustumVolumeMl(
    inputs.radiusTopMm,
    inputs.radiusBottomMm,
    inputs.heightMm
  );

  const modelWarning = checkBounds(inputs, gummyVolumeMl);

  // usable height = straight up to the bottle mouth. the shoulder (the fill
  // line we actually care about) sits a touch below it.
  // todo: dem should give us the real effective fill height for solids.
  const totalInternalHeightMm = Math.max(
    inputs.neckHeightMm,
    inputs.shoulderHeightMm + 4
  );

  // single fudge factor, currently a no-op at 1.0. this is where a trained
  // model would scale the packed volume up or down. todo: dem coefficient.
  const surrogateCoefficient = 1.0;

  const estimatedPackedVolumeMl =
    (inputs.count * gummyVolumeMl * surrogateCoefficient) / PACKING_EFFICIENCY;

  const fillFraction = clamp(
    estimatedPackedVolumeMl / inputs.bottleVolumeMl,
    0,
    1.25
  );

  const productFillHeightMm = clamp(
    fillFraction * totalInternalHeightMm,
    0,
    totalInternalHeightMm * 1.05
  );

  const slackFromTopMm = totalInternalHeightMm - productFillHeightMm;
  const slackFromShoulderMm = inputs.shoulderHeightMm - productFillHeightMm;
  const slackFillPct = (slackFromTopMm / totalInternalHeightMm) * 100;
  const fillRatePct = Math.min(fillFraction, 1) * 100;
  const dosageG = inputs.count * inputs.weightG;

  // status buckets. the thresholds below are made up for now.
  // todo: line these up with the real packaging accept/reject criteria.
  let status: PredictionStatus;
  if (modelWarning) {
    status = "Outside model range";
  } else if (productFillHeightMm > inputs.shoulderHeightMm + 4) {
    status = "Overfilled";
  } else if (
    productFillHeightMm >= inputs.shoulderHeightMm - 14 &&
    productFillHeightMm <= inputs.shoulderHeightMm + 4
  ) {
    status = "Good";
  } else if (slackFromShoulderMm > 32) {
    status = "Watchout";
  } else {
    status = "Good";
  }

  return {
    gummyVolumeMl,
    productFillHeightMm,
    slackFillPct,
    fillRatePct,
    dosageG,
    slackFromTopMm,
    slackFromShoulderMm,
    totalInternalHeightMm,
    estimatedPackedVolumeMl,
    fillFraction,
    status,
    modelWarning,
  };
}

/** Plain-English interpretation of a result, for the Outputs panel. */
export function interpret(result: PredictionResult): string {
  if (result.status === "Outside model range") {
    return "Inputs fall outside the prototype's trained design space. The prediction shown is extrapolated and should not be used for technical decisions.";
  }
  if (result.status === "Overfilled") {
    return "Predicted to fill above the shoulder. Reduce count or move to a larger bottle to bring the fill line back into the target band.";
  }
  if (result.status === "Watchout") {
    return `Fill lands ~${result.slackFromShoulderMm.toFixed(
      0
    )} mm below the shoulder — slack-fill is on the high side. Verify against slack-fill limits before committing.`;
  }
  return `Fill lands in the target band near the shoulder (~${Math.abs(
    result.slackFromShoulderMm
  ).toFixed(0)} mm ${result.slackFromShoulderMm >= 0 ? "below" : "above"} shoulder). Slack-fill is within the prototype's acceptable range.`;
}

/**
 * Bounds of the predicted-fill "Good" band, expressed in millimeters of
 * fill height. Mirrors the thresholds used by `predictFill` so the two
 * functions can't drift out of sync.
 *
 *   lower = shoulder − 14 mm  (don't waste headspace)
 *   ideal = shoulder −  5 mm  (small comfortable buffer below the shoulder)
 *   upper = shoulder +  4 mm  (allowable slight overfill)
 */
export function targetBandMm(shoulderHeightMm: number) {
  return {
    lowerMm: shoulderHeightMm - 14,
    idealMm: shoulderHeightMm - 5,
    upperMm: shoulderHeightMm + 4,
  };
}

/**
 * Invert the (placeholder) fill model to recommend the gummy count that
 * lands the predicted fill height right at the target band's ideal point.
 *
 *   fillHeight = (count · gummyVol) / (PHI · bottleVol) · totalInternalHeight
 *     ⇒ count = fillHeight · PHI · bottleVol / (gummyVol · totalInternalHeight)
 *
 * The result is rounded to a whole gummy and clamped to the slider's range
 * (and the trained-bounds range) so the UI can drop it straight back into
 * `state.count`. Returns the recommended count alongside the same
 * `PredictionResult` that count would produce, so the caller can show both.
 *
 * TODO: when a real DEM-trained model replaces `predictFill`, switch this to
 * a numerical (bisection) inversion so non-linear coefficients still work.
 */
export interface CountRecommendation {
  count: number;
  result: PredictionResult;
  hitTarget: boolean;
}

export function recommendCountForTarget(
  inputs: Omit<PredictionInputs, "count">
): CountRecommendation {
  const gummyVolumeMl = frustumVolumeMl(
    inputs.radiusTopMm,
    inputs.radiusBottomMm,
    inputs.heightMm
  );
  const totalInternalHeightMm = Math.max(
    inputs.neckHeightMm,
    inputs.shoulderHeightMm + 4
  );
  const { lowerMm, idealMm, upperMm } = targetBandMm(inputs.shoulderHeightMm);

  // Inverse of `predictFill` at fill height = idealMm.
  // surrogateCoefficient is 1.0 in `predictFill`; if that changes, mirror here.
  const rawCount =
    (idealMm * PACKING_EFFICIENCY * inputs.bottleVolumeMl) /
    Math.max(gummyVolumeMl * totalInternalHeightMm, 1e-6);

  // Round and clamp to the slider + trained-bounds window.
  const sliderMin = MODEL_BOUNDS.countMin;
  const sliderMax = MODEL_BOUNDS.countMax;
  const count = Math.max(
    sliderMin,
    Math.min(sliderMax, Math.round(rawCount))
  );

  const result = predictFill({ ...inputs, count });
  const hitTarget =
    result.productFillHeightMm >= lowerMm &&
    result.productFillHeightMm <= upperMm;

  return { count, result, hitTarget };
}

// Re-export so callers can quote PHI in tooltips / disclaimers without
// having to import another constant.
export const PROTOTYPE_PACKING_EFFICIENCY = PACKING_EFFICIENCY;

