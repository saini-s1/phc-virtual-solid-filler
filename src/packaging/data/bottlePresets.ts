// Bottle presets — virtual solid filler (prototype).
//
// Two bottle shapes are supported so the picture and the model can be poked at
// with both round "packer" bottles and the rectangular ("oblong") bottles that
// show up a lot in PHC packaging.
//
// Units:
//   volumeMl          -- nominal bottle volume in mL (same as cc)
//   shoulderHeightMm  -- the fill-line shoulder, mm from the bottle bottom
//   neckHeightMm      -- full internal height up to the mouth, mm
//   bodyWidthMm       -- outer body width on the front face, mm
//                        (= diameter for round, = front width for a rectangle)
//   bodyDepthMm       -- front-to-back depth, rectangles only (round leaves it out)
//   cornerRadiusMm    -- rounded-corner radius, rectangles only. Used by the
//                        hydraulic-diameter math (4*A/P) so an oblong bottle
//                        gets a physically-correct wall length scale.
//
// To add a bottle, add a round(...) or rect(...) line to BOTTLE_PRESETS below.
//
// Dimensions here are realistic-ish catalog values, not measured CAD. Swap in
// the real packaging-engineering numbers before trusting anything.

export type BottleShape = "round" | "rectangle";

export type BottlePreset = {
  id: string;
  name: string;
  shape: BottleShape;
  volumeMl: number;
  shoulderHeightMm: number;
  neckHeightMm: number;
  bodyWidthMm: number;
  bodyDepthMm?: number;
  cornerRadiusMm?: number;
};

const round = (
  id: string,
  name: string,
  volumeMl: number,
  shoulder: number,
  neck: number,
  bodyWidthMm: number
): BottlePreset => ({
  id,
  name,
  shape: "round",
  volumeMl,
  shoulderHeightMm: shoulder,
  neckHeightMm: neck,
  bodyWidthMm,
});

const rect = (
  id: string,
  name: string,
  volumeMl: number,
  shoulder: number,
  neck: number,
  bodyWidthMm: number,
  bodyDepthMm: number,
  cornerRadiusMm?: number
): BottlePreset => ({
  id,
  name,
  shape: "rectangle",
  volumeMl,
  shoulderHeightMm: shoulder,
  neckHeightMm: neck,
  bodyWidthMm,
  bodyDepthMm,
  cornerRadiusMm,
});

// Listed in the order they should appear in the dropdown — round first, then
// rectangle. The InputPanel groups them with <optgroup> based on `shape`.
export const BOTTLE_PRESETS: BottlePreset[] = [
  // Round (packer-style)
  round("r-175cc", "6 oz (175 cc) — Round", 175, 78, 86, 52),
  round("r-225cc", "8 oz (225 cc) — Round", 225, 88, 96, 56),
  round("r-300cc", "300 cc — Round", 300, 96, 104, 62),
  // Real catalog bottle — 300 cc PACKER (drawing AX-2513-0). Dimensions read
  // straight off the mould print: body Ø 2.656" = 67.5 mm, total H 4.683" =
  // 118.9 mm, straight-body fill height ≈ 84 mm.
  round("r-300cc-packer", "300 cc Packer — Round (real)", 300, 84, 118.9, 67.5),
  round("r-500cc", "500 cc — Round", 500, 110, 118, 76),
  round("r-625cc", "625 cc — Round", 625, 122, 130, 82),

  // Rectangle (oblong)
  rect("x-215cc", "215 cc — Rectangle", 215, 84, 92, 58, 38),
  rect("x-230cc", "230 cc — Rectangle", 230, 86, 94, 60, 40),
  // Real catalog bottle — 300 cc oblong "Cub" (drawing PNG-3142-2). W 2.741" =
  // 69.6 mm, D 2.362" = 60.0 mm, corner R .250" = 6.35 mm, total H 4.875" =
  // 123.8 mm, straight-body fill height ≈ 72 mm. Pairs with the round packer
  // above for a real round-vs-oblong comparison at the same 300 cc.
  rect("x-300cc-cub", "300 cc Cub — Oblong (real)", 300, 72, 123.8, 69.6, 60.0, 6.35),
  rect("x-300cc", "300 cc — Rectangle", 300, 98, 106, 66, 44),
  rect("x-635cc", "635 cc — Rectangle", 635, 128, 136, 88, 56),
];

export const getBottleById = (id: string): BottlePreset =>
  BOTTLE_PRESETS.find((b) => b.id === id) ?? BOTTLE_PRESETS[3];

// Custom (user-defined) bottle.
//
// The user drives a single knob — the nominal fill volume — and we synthesize a
// physically-consistent straight-body bottle from it. This mirrors the
// reference model's `parametric_profile()` (bottle_translate.py): a straight
// cylindrical/oblong body up to the shoulder, a short taper, then a neck stub.
//
// The scaling below is fit to the round presets so that the *body cylinder*
// volume ≈ the nominal volume, which is exactly the assumption the surrogate's
// slack / fill-height geometry relies on. That keeps λ (gummies-across) and the
// fill math self-consistent across the whole slider range, instead of feeding
// the model a volume that disagrees with the geometry.
//
//   D_body    ≈ 9.5 · V^(1/3)   (mm, round)   → area·shoulder ≈ V (mL)
//   shoulder  ≈ 14  · V^(1/3)   (mm)
//   neck      = shoulder + 8    (mm, coarse stub — fill never reaches it)
//
// Rectangles keep a 0.66 depth:width ratio (the preset average) with the same
// body-volume target, so a round and a rectangle of equal volume see the same
// equivalent diameter and therefore the same λ.
export const CUSTOM_BOTTLE_ID = "__custom__";

/** Volume range for the custom-bottle quick-pick slider (mL === cc). Users can
 * also type any value directly; only the hard safety clamp below applies. */
export const CUSTOM_VOLUME_RANGE = { minMl: 175, maxMl: 1000, stepMl: 25 };

// Hard safety bounds for a typed volume (keeps the geometry math finite);
// deliberately generous since the surrogate flags out-of-domain inputs itself.
const CUSTOM_VOLUME_HARD = { minMl: 5, maxMl: 20000 };

const clampVolume = (v: number) =>
  Math.max(
    CUSTOM_VOLUME_HARD.minMl,
    Math.min(CUSTOM_VOLUME_HARD.maxMl, Number.isFinite(v) ? v : 0)
  );

/** Build a physically-consistent custom bottle from a nominal volume + shape. */
export function makeCustomBottle(
  volumeMl: number,
  shape: BottleShape = "round"
): BottlePreset {
  const V = clampVolume(volumeMl);
  const cbrt = Math.cbrt(V);
  const shoulder = 14 * cbrt;
  const neck = shoulder + 8;

  if (shape === "rectangle") {
    // width·depth·shoulder ≈ V·1000 mm³ with depth = 0.66·width.
    const width = 10.4 * cbrt;
    const depth = 0.66 * width;
    return {
      id: CUSTOM_BOTTLE_ID,
      name: `Custom — ${Math.round(V)} cc · Rectangle`,
      shape: "rectangle",
      volumeMl: V,
      shoulderHeightMm: Math.round(shoulder * 10) / 10,
      neckHeightMm: Math.round(neck * 10) / 10,
      bodyWidthMm: Math.round(width * 10) / 10,
      bodyDepthMm: Math.round(depth * 10) / 10,
      // Typical oblong corner radius ≈ 10% of the shorter side (matches the
      // real 300 cc "cub": 6.35 mm on a 60 mm depth). Feeds the 4·A/P math.
      cornerRadiusMm: Math.round(depth * 0.1 * 10) / 10,
    };
  }

  const diameter = 9.5 * cbrt;
  return {
    id: CUSTOM_BOTTLE_ID,
    name: `Custom — ${Math.round(V)} cc · Round`,
    shape: "round",
    volumeMl: V,
    shoulderHeightMm: Math.round(shoulder * 10) / 10,
    neckHeightMm: Math.round(neck * 10) / 10,
    bodyWidthMm: Math.round(diameter * 10) / 10,
  };
}

/** oz ↔ cc helper for slider labels (US fluid ounce ≈ 29.5735 mL). */
export const mlToOz = (ml: number) => ml / 29.5735;
