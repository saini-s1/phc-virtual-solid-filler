import type {
  CalcRequest,
  Ingredient,
  IngredientNutrient,
  NutrientPolicy,
} from "../types/inputs";
import type { NutrientId } from "../types/nutrients";

// VERIFIED Excel ground truth — "Irovy Orange" psyllium fiber powder.
// Per-100g values and %w/w transcribed from the source workbook (Formulation sheet,
// reference row 8) and confirmed to reproduce the Excel per-serving totals to < 1e-9
// (see recipe.parity.test.ts). Serving / dose weight = 10.68 g.
//
// Excel column → engine NutrientId mapping. The "kCal (US Rules)" column IS stored per
// ingredient (caloriesPer100g) for reference/display; calories are declared via B / C / C+:
//   Sugar → totalSugars.  Blank cells (—) are omitted (they contribute 0 to the SUM).
// Fat / saturated fat / trans fat / cholesterol are absent from the Excel. Per 21 CFR
// 101.36(b)(2)(i) they are not declared on a Supplement Facts panel when absent; they are
// carried here as confirmed zeros so the data contract stays stable and INGREDIENT_INCOMPLETE
// does not fire.

function known(values: Partial<Record<NutrientId, number>>): IngredientNutrient[] {
  const out: IngredientNutrient[] = [];
  for (const [id, per100g] of Object.entries(values) as [NutrientId, number][]) {
    out.push({ nutrientId: id, per100g, completeness: "known" });
  }
  // Mandatory nutrients absent from the Excel → confirmed zeros (FLAG 2).
  for (const id of ["totalFat", "saturatedFat", "transFat", "cholesterol"] as NutrientId[]) {
    out.push({ nutrientId: id, per100g: 0, completeness: "zeroConfirmed" });
  }
  return out;
}

const ingredients: Ingredient[] = [
  {
    id: "psyllium",
    name: "Psyllium Husk Powder",
    tradeName: "Plantaga Ovata",
    cas: "8063-16-9",
    gcas: "10047885",
    caloriesPer100g: 360.7, // Excel Ingredients!E3 "kCal (US Rules)"
    nutrients: known({
      totalCarbohydrate: 86.8,
      dietaryFiber: 84,
      solubleFiber: 71.4,
      totalSugars: 0.1,
      addedSugars: 0,
      iron: 8.6,
      potassium: 839,
      sodium: 64.9,
      calcium: 170.7,
      vitaminA: 0,
      vitaminC: 0,
      protein: 2,
    }),
  },
  {
    id: "maltodextrin",
    name: "Maltodextrin",
    tradeName: "Tate& Lyle Star-Dri 100N-S",
    cas: "9050-36-6",
    gcas: "10046056 or 10046057",
    caloriesPer100g: 378, // Excel Ingredients!E4
    nutrients: known({
      totalCarbohydrate: 94.2,
      dietaryFiber: 0,
      solubleFiber: 0,
      totalSugars: 3.5,
      iron: 0.5,
      sodium: 150,
      calcium: 10,
      vitaminA: 0,
      vitaminC: 0,
      protein: 0.3,
    }),
  },
  {
    id: "citric_acid",
    name: "Citric Acid Anhydrous",
    cas: "77-92-9",
    gcas: "10045074",
    caloriesPer100g: 247, // Excel Ingredients!E5
    nutrients: known({
      totalCarbohydrate: 99.45,
      dietaryFiber: 0,
      solubleFiber: 0,
      iron: 0,
      potassium: 0.3,
      sodium: 0.3,
      calcium: 0.3,
      vitaminA: 0,
      vitaminC: 0,
      vitaminD: 0,
      protein: 0,
    }),
  },
  {
    id: "stevia",
    name: "Stevia Extract",
    tradeName: "ADM Stevia RA97",
    cas: "58543-16-1",
    gcas: "91400073",
    caloriesPer100g: 0, // Excel Ingredients!E6
    nutrients: known({
      totalCarbohydrate: 0,
      dietaryFiber: 0,
      solubleFiber: 0,
      totalSugars: 0,
      addedSugars: 0,
      iron: 1.6,
      potassium: 4,
      sodium: 15,
      protein: 0,
    }),
  },
  {
    id: "flavor",
    name: "Natural Orange Flavor",
    tradeName: "E20121886 SENSE CAPTURE ORANGE NATURAL ORANGE FLAVOR WONF",
    cas: "Mixture",
    gcas: "91819530",
    caloriesPer100g: 494.76, // Excel Ingredients!E7
    nutrients: known({
      totalCarbohydrate: 75.31,
      dietaryFiber: 0,
      solubleFiber: 0,
      totalSugars: 32.05,
      addedSugars: 32.05,
      iron: 0,
      potassium: 2.75,
      sodium: 0.18,
      calcium: 0,
      vitaminA: 1859.04,
      vitaminC: 0.62,
      vitaminD: 0,
      protein: 0,
    }),
  },
  {
    id: "paprika",
    name: "Paprika Extract (Color)",
    tradeName: "MicroCap P-21-WSS-P-125-500",
    cas: "68917-78-2",
    gcas: "91564541",
    caloriesPer100g: 320.68, // Excel Ingredients!E8
    nutrients: known({
      totalCarbohydrate: 79.97,
      dietaryFiber: 0,
      solubleFiber: 0,
      totalSugars: 17.05,
      addedSugars: 17.05,
      iron: 0.09,
      potassium: 29.15,
      sodium: 79.93,
      calcium: 8.04,
      vitaminA: 0,
      vitaminC: 0,
      vitaminD: 0,
      protein: 0,
    }),
  },
  {
    id: "tumeric",
    name: "Turmeric (Color)",
    tradeName: "i-Colors Yellow 901 WSS-P",
    cas: "84775-52-0",
    gcas: "91564539",
    caloriesPer100g: 380, // Excel Ingredients!E9
    nutrients: known({
      totalCarbohydrate: 96,
      dietaryFiber: 0,
      solubleFiber: 0,
      totalSugars: 29,
      addedSugars: 27,
      iron: 0,
      potassium: 0,
      sodium: 50,
      calcium: 10,
      vitaminA: 0,
      vitaminC: 0,
      vitaminD: 0,
      protein: 0,
    }),
  },
];

// %w/w by weight (Formulation!C14:C20), exact high-precision values.
const recipe = [
  { ingredientId: "psyllium", percentWW: 0.6111142322097378 },
  { ingredientId: "maltodextrin", percentWW: 0.297775 },
  { ingredientId: "citric_acid", percentWW: 0.05661048689138577 },
  { ingredientId: "stevia", percentWW: 0.0076 },
  { ingredientId: "flavor", percentWW: 0.0205 },
  { ingredientId: "paprika", percentWW: 0.0047 },
  { ingredientId: "tumeric", percentWW: 0.0017 },
];

// Policies for every declared nutrient. All loss/overage/decay = 0 so as-declared = raw
// (preserves Excel parity) and no OVERAGE_MISSING block fires.
//
// SOURCE / COMPLIANCE CLASS — matched to the Excel "Nutrition" tab (the moment of truth):
// every nutrient in Irovy Orange is intrinsic to its food ingredients (psyllium, paprika,
// turmeric, flavor) — NONE is a fortificant — so the workbook classes the micronutrients as
// "Class II — NLT 80%", not Class I. We mirror that exactly: macros AND vitamins/minerals
// here are "naturally_occurring" (Class II). A genuinely fortified actives blend would set
// source: "added" per nutrient to land in Class I (NLT 100%); the engine supports both.
// (Sodium, Sugars, Added Sugars, Fat, Cholesterol are "third group — NMT 120%" by catalog,
// independent of source.)
function naturalPolicy(nutrientId: NutrientId): NutrientPolicy {
  return { nutrientId, source: "naturally_occurring", processLossFrac: 0, overageFrac: 0, shelfLifeDecayFrac: 0 };
}

const nutrientPolicies: NutrientPolicy[] = [
  naturalPolicy("totalFat"),
  naturalPolicy("saturatedFat"),
  naturalPolicy("transFat"),
  naturalPolicy("cholesterol"),
  naturalPolicy("sodium"),
  naturalPolicy("totalCarbohydrate"),
  naturalPolicy("dietaryFiber"),
  naturalPolicy("solubleFiber"),
  naturalPolicy("totalSugars"),
  naturalPolicy("addedSugars"),
  naturalPolicy("protein"),
  naturalPolicy("vitaminD"),
  naturalPolicy("calcium"),
  naturalPolicy("iron"),
  naturalPolicy("potassium"),
  naturalPolicy("vitaminA"),
  naturalPolicy("vitaminC"),
];

export const exampleProduct: CalcRequest = {
  servingWeightG: 10.68,
  // Servings/container intentionally unset (placeholder): the label shows "X" until entered.
  regionId: "US",
  calorieMethod: "C+", // Workbook-declared value: Method C+ (soluble fiber @ 2 kcal/g) → 25 cal
  recipe,
  ingredients,
  nutrientPolicies,
};

// Custom-input support — lets a user build their own formulation, not just the example.

/**
 * Nutrients the custom editor exposes. Exactly the set that carries a declaration policy
 * above, so editing these covers everything the engine declares. Order follows the FDA label.
 */
export const TRACKED_NUTRIENT_IDS: NutrientId[] = nutrientPolicies.map((p) => p.nutrientId);

/** A blank ingredient: every tracked nutrient at 0 (known), no supplier calories yet. */
export function makeBlankIngredient(id: string, name: string): Ingredient {
  return {
    id,
    name,
    caloriesPer100g: 0,
    nutrients: TRACKED_NUTRIENT_IDS.map((nutrientId) => ({
      nutrientId,
      per100g: 0,
      completeness: "known" as const,
    })),
  };
}

/** "Start blank" preset: one empty ingredient at 100% w/w, sharing the example's policy set. */
export const blankProduct: CalcRequest = {
  servingWeightG: 10,
  // Servings/container intentionally unset (placeholder): the label shows "X" until entered.
  regionId: "US",
  calorieMethod: "C+",
  recipe: [{ ingredientId: "custom-1", percentWW: 1 }],
  ingredients: [makeBlankIngredient("custom-1", "New ingredient")],
  nutrientPolicies,
};
