// ---------------------------------------------------------------------------
// gummy (product) presets — prototype data.
//
// each gummy is faked as a truncated cone (a "frustum"): a wide bottom, a
// narrower top, and a height. it's a rough stand-in for a real domed/tapered
// gummy but it's enough to drive the model and the 3d view.
//   radiusTopMm    -> radius of the smaller top face
//   radiusBottomMm -> radius of the larger bottom face
//   heightMm       -> overall gummy height
// density + weight are stored straight so the model can use measured mass.
//
// >>> WANT TO ADD A NEW GUMMY? just copy one of the objects in GUMMY_PRESETS
// below, give it a new id + name, and punch in the numbers. the dropdown, the
// model and the comparison chart all pick it up automatically. <<<
//
// note: these are starter numbers, not spec sheets. replace with the real p&g
// phc dimensions before anyone leans on an output.
// ---------------------------------------------------------------------------

export type GummyPreset = {
  id: "current" | "dory" | "emerald";
  name: string;
  shortName: string;
  description: string;
  // Frustum geometry, all in millimeters
  radiusTopMm: number;
  radiusBottomMm: number;
  heightMm: number;
  // Bulk material properties
  densityGPerMl: number; // material density, g/mL
  weightG: number; // single-gummy product weight, g
  // Display
  accentColor: string;
  isPlaceholder?: boolean;
};

// volume of a truncated cone (frustum) in mL.
//   V = (pi*h / 3) * (r1^2 + r1*r2 + r2^2)   -- result is in mm^3, /1000 -> mL
// used all over the place (model, input panel, comparison chart) so it lives
// here next to the geometry it measures.
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
    name: "Dory",
    shortName: "Dory",
    description: "Reference Dory gummy geometry from DEM characterization.",
    radiusTopMm: 6.4,
    radiusBottomMm: 9.65,
    heightMm: 11.5,
    densityGPerMl: 1.4,
    weightG: 3.87,
    accentColor: "#2649ea", // pg-blue-600
  },
  {
    id: "emerald",
    name: "Emerald City",
    shortName: "Emerald",
    description:
      "Proposed Emerald City gummy — taller body and slightly wider base than Dory.",
    radiusTopMm: 6.6,
    radiusBottomMm: 9.83,
    heightMm: 12.8,
    densityGPerMl: 1.42,
    weightG: 4.3,
    accentColor: "#06b6d4", // pg-cyan-500
  },
];

export const getGummyById = (id: string): GummyPreset =>
  GUMMY_PRESETS.find((g) => g.id === id) ?? GUMMY_PRESETS[1];
