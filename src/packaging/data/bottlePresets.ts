// ---------------------------------------------------------------------------
// bottle presets — virtual solid filler (prototype).
//
// two bottle shapes are supported so the picture and the model can be poked at
// with both round "packer" bottles and the rectangular ("oblong") bottles that
// show up a lot in phc packaging.
//
// units:
//   volumeMl          -- nominal bottle volume in mL (same as cc)
//   shoulderHeightMm  -- the fill-line shoulder, mm from the bottle bottom
//   neckHeightMm      -- full internal height up to the mouth, mm
//   bodyWidthMm       -- outer body width on the front face, mm
//                        (= diameter for round, = front width for a rectangle)
//   bodyDepthMm       -- front-to-back depth, rectangles only (round leaves it out)
//
// >>> ADDING A BOTTLE? scroll down to BOTTLE_PRESETS and add a round(...) or
// rect(...) line with your numbers. that's it. <<<
//
// dimensions here are realistic-ish catalog values, not measured cad. swap in
// the real packaging-engineering numbers before trusting anything.
// ---------------------------------------------------------------------------

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
  bodyDepthMm: number
): BottlePreset => ({
  id,
  name,
  shape: "rectangle",
  volumeMl,
  shoulderHeightMm: shoulder,
  neckHeightMm: neck,
  bodyWidthMm,
  bodyDepthMm,
});

// Listed in the order they should appear in the dropdown — round first, then
// rectangle. The InputPanel groups them with <optgroup> based on `shape`.
export const BOTTLE_PRESETS: BottlePreset[] = [
  // ── Round (packer-style) ───────────────────────────────────────────────
  round("r-175cc", "6 oz (175 cc) — Round", 175, 78, 86, 52),
  round("r-225cc", "8 oz (225 cc) — Round", 225, 88, 96, 56),
  round("r-300cc", "300 cc — Round", 300, 96, 104, 62),
  round("r-500cc", "500 cc — Round", 500, 110, 118, 76),
  round("r-625cc", "625 cc — Round", 625, 122, 130, 82),

  // ── Rectangle (oblong) ─────────────────────────────────────────────────
  rect("x-215cc", "215 cc — Rectangle", 215, 84, 92, 58, 38),
  rect("x-230cc", "230 cc — Rectangle", 230, 86, 94, 60, 40),
  rect("x-300cc", "300 cc — Rectangle", 300, 98, 106, 66, 44),
  rect("x-635cc", "635 cc — Rectangle", 635, 128, 136, 88, 56),
];

export const getBottleById = (id: string): BottlePreset =>
  BOTTLE_PRESETS.find((b) => b.id === id) ?? BOTTLE_PRESETS[3];
