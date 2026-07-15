// Gummy (product) presets — prototype data.
//
// Each gummy is modeled as a truncated cone (a "frustum"): a wide bottom, a
// narrower top, and a height. It's a rough stand-in for a real domed/tapered
// gummy but it's enough to drive the model and the 3D view.
//   radiusTopMm    -> radius of the smaller top face
//   radiusBottomMm -> radius of the larger bottom face
//   heightMm       -> overall gummy height
//
// To add a new gummy, copy one of the objects in GUMMY_PRESETS below, give it
// a new id + name, and fill in the numbers — the dropdown, model, and
// comparison chart all pick it up automatically.
//
// Note: these are starter numbers, not spec sheets. Replace with the real
// P&G PHC dimensions before anyone leans on an output.

// The two real DEM reference mold shapes the surrogate was trained on.
// Every UI gummy maps onto one of these families (see model/realSurrogate.ts).
export type GummyFamily = "EC" | "DoryNew";

export type GummyPreset = {
  id: "dory" | "emerald";
  name: string;
  shortName: string;
  description: string;
  // Which trained DEM mold family this gummy is evaluated against.
  family: GummyFamily;
  // Frustum geometry, all in millimeters (used for the 3D visualization; the
  // real model derives gummy volume from `family` + `heightMm` via the mold
  // curve, not from these radii).
  radiusTopMm: number;
  radiusBottomMm: number;
  heightMm: number;
  // Bulk material properties
  densityGPerMl: number; // material density, g/mL
  weightG: number; // single-gummy product weight, g
  // Display
  accentColor: string;
};

// Volume of a truncated cone (frustum) in mL.
//   V = (pi*h / 3) * (r1^2 + r1*r2 + r2^2)   -- result is in mm^3, /1000 -> mL
export function frustumVolumeMl(
  radiusTopMm: number,
  radiusBottomMm: number,
  heightMm: number
): number {
  const vMm3 =
    ((Math.PI * heightMm) / 3) *
    (radiusTopMm * radiusTopMm +
      radiusTopMm * radiusBottomMm +
      radiusBottomMm * radiusBottomMm);
  return vMm3 / 1000;
}

export const GUMMY_PRESETS: GummyPreset[] = [
  {
    id: "dory",
    name: "Dory (DoryNew mold)",
    shortName: "Dory",
    description:
      "Dory reference gummy — the DoryNew DEM mold. Nominal H 13 mm, base ⌀ 19.44 mm, Vg 2710 mm³ (verified against refs/DoryNew.stl).",
    family: "DoryNew",
    radiusTopMm: 6.6,
    radiusBottomMm: 9.72,
    heightMm: 13.0,
    densityGPerMl: 1.425,
    weightG: 3.862,
    accentColor: "#2649ea", // pg-blue-600
  },
  {
    id: "emerald",
    name: "Emerald City (EC mold)",
    shortName: "Emerald",
    description:
      "Emerald City reference gummy — the EC DEM mold. Nominal H 9.5 mm, base ⌀ 18.07 mm, Vg 1753 mm³ (verified against refs/EC25mm.stl).",
    family: "EC",
    radiusTopMm: 6.4,
    radiusBottomMm: 9.03,
    heightMm: 9.5,
    densityGPerMl: 1.425,
    weightG: 2.498,
    accentColor: "#06b6d4", // pg-cyan-500
  },
];

export const getGummyById = (id: string): GummyPreset =>
  GUMMY_PRESETS.find((g) => g.id === id) ?? GUMMY_PRESETS[1];
