import type { Ingredient, IngredientNutrient } from "../types/inputs";
import type { NutrientId } from "../types/nutrients";

// ─────────────────────────────────────────────────────────────────────────────
// Ingredient library — transcribed verbatim from the "Ingredients" tab of
// "Nutrition Calculator.template .xlsx" (the source-of-truth template).
//
// Every entry carries the supplier Trade Name, CAS registry number and P&G GCAS
// material code exactly as listed, plus the per-100 g nutrient profile the Excel
// uses in its VLOOKUP (Formulation!… = VLOOKUP(name, Ingredients!$A:$W, col) × dose/100).
// The "kCal (US Rules)" column is stored as caloriesPer100g (reference/display only).
//
// These are the ready-to-use building blocks a user can click to add to their own
// formulation. Only rows that carry a full nutrient profile are included; rows in
// the workbook that list a CAS/GCAS but no nutrient data (Malic Acid, Ace-K, Berry
// Flavor, Pink Lemonade, Vitamin Blend, Red 40, Blue 1) are intentionally omitted
// until their per-100 g values are supplied.
// ─────────────────────────────────────────────────────────────────────────────

/** A catalog ingredient with full identity metadata and a per-100 g nutrient map. */
export interface LibraryIngredient {
  id: string;
  name: string;
  tradeName?: string;
  cas?: string;
  gcas?: string;
  caloriesPer100g: number;
  /** Per-100 g amounts in each nutrient's native unit (g or mg or mcg). */
  per100g: Partial<Record<NutrientId, number>>;
}

export const INGREDIENT_LIBRARY: LibraryIngredient[] = [
  {
    id: "psyllium",
    name: "Psyllium",
    tradeName: "Plantaga Ovata",
    cas: "8063-16-9",
    gcas: "10047885",
    caloriesPer100g: 360.8,
    per100g: { totalFat: 1.01, saturatedFat: 0.166, transFat: 0, cholesterol: 0, sodium: 70.35, totalCarbohydrate: 87, dietaryFiber: 83.8, solubleFiber: 70.5, totalSugars: 0.1, addedSugars: 0, protein: 2.101, vitaminD: 0, calcium: 175.17, iron: 7.8, potassium: 847, vitaminA: 0, vitaminC: 0 },
  },
  {
    id: "maltodextrin",
    name: "Maltodextrin",
    tradeName: "Tate& Lyle Star-Dri 100N-S",
    cas: "9050-36-6",
    gcas: "10046056 or 10046057",
    caloriesPer100g: 378,
    per100g: { totalFat: 0, saturatedFat: 0, transFat: 0, cholesterol: 0, sodium: 150, totalCarbohydrate: 94.2, dietaryFiber: 0, solubleFiber: 0, totalSugars: 3.5, addedSugars: 0, protein: 0.3, vitaminD: 0, calcium: 10, iron: 0.5, potassium: 0, vitaminA: 0, vitaminC: 0 },
  },
  {
    id: "citric-acid-anhydrous",
    name: "Citric Acid Anhydrous",
    cas: "77-92-9",
    gcas: "10045074",
    caloriesPer100g: 247,
    per100g: { totalFat: 0, saturatedFat: 0, transFat: 0, cholesterol: 0, sodium: 0.3, totalCarbohydrate: 99.45, dietaryFiber: 0, solubleFiber: 0, totalSugars: 0, addedSugars: 0, protein: 0, vitaminD: 0, calcium: 0.2, iron: 0, potassium: 0.3, vitaminA: 0, vitaminC: 0 },
  },
  {
    id: "stevia",
    name: "Stevia",
    tradeName: "ADM Stevia RA97",
    cas: "58543-16-1",
    gcas: "91400073",
    caloriesPer100g: 0,
    per100g: { totalFat: 0, saturatedFat: 0, transFat: 0, cholesterol: 0, sodium: 15, totalCarbohydrate: 0, dietaryFiber: 0, solubleFiber: 0, totalSugars: 0, addedSugars: 0, protein: 0, vitaminD: 0, calcium: 0, iron: 1.6, potassium: 4, vitaminA: 0, vitaminC: 0 },
  },
  {
    id: "natural-orange-flavor",
    name: "Natural Orange Flavor",
    tradeName: "E20121886 SENSE CAPTURE ORANGE NATURAL ORANGE FLAVOR WONF",
    cas: "Mixture",
    gcas: "91819530",
    caloriesPer100g: 380,
    per100g: { totalFat: 0, saturatedFat: 0, transFat: 0, cholesterol: 0, sodium: 50, totalCarbohydrate: 95, dietaryFiber: 0, solubleFiber: 0, totalSugars: 29, addedSugars: 27, protein: 0, vitaminD: 0, calcium: 10, iron: 0, potassium: 0, vitaminA: 0, vitaminC: 0 },
  },
  {
    id: "paprika",
    name: "Paprika",
    tradeName: "MicroCap P-21-WSS-P-125-500",
    cas: "68917-78-2",
    gcas: "91564541",
    caloriesPer100g: 494.76,
    per100g: { totalFat: 21.4, saturatedFat: 3.79, transFat: 0, cholesterol: 0, sodium: 0.18, totalCarbohydrate: 75.31, dietaryFiber: 0, solubleFiber: 0, totalSugars: 32.05, addedSugars: 32.05, protein: 0, vitaminD: 0, calcium: 0, iron: 0, potassium: 2.75, vitaminA: 1859.04, vitaminC: 0.62 },
  },
  {
    id: "turmeric",
    name: "Turmeric",
    tradeName: "i-Colors Yellow 901 WSS-P",
    cas: "84775-52-0",
    gcas: "91564539",
    caloriesPer100g: 320.68,
    per100g: { totalFat: 0.04, saturatedFat: 0.02, transFat: 0, cholesterol: 0, sodium: 79.93, totalCarbohydrate: 79.97, dietaryFiber: 0, solubleFiber: 0, totalSugars: 17.05, addedSugars: 17.05, protein: 0, vitaminD: 0, calcium: 8.04, iron: 0.09, potassium: 29.15, vitaminA: 0, vitaminC: 0 },
  },
  {
    id: "collagen-agglomerated",
    name: "Collagen (Agglomerated)",
    tradeName: "BCP-500A",
    gcas: "90574833",
    caloriesPer100g: 390,
    per100g: { totalFat: 0, saturatedFat: 0, transFat: 0, cholesterol: 0, sodium: 240, totalCarbohydrate: 0, dietaryFiber: 0, solubleFiber: 0, totalSugars: 0, addedSugars: 0, protein: 94, vitaminD: 0, calcium: 50, iron: 3, potassium: 410, vitaminA: 0, vitaminC: 0 },
  },
  {
    id: "aspartame",
    name: "Aspartame",
    tradeName: "AminoSweet Aspartame",
    cas: "22839-47-0",
    gcas: "10045031",
    caloriesPer100g: 381,
    per100g: { totalFat: 0, saturatedFat: 0, transFat: 0, cholesterol: 0, sodium: 30, totalCarbohydrate: 0, dietaryFiber: 0, solubleFiber: 0, totalSugars: 0, addedSugars: 0, protein: 95.3, vitaminD: 0, calcium: 2, iron: 0, potassium: 10, vitaminA: 0, vitaminC: 0 },
  },
  {
    id: "sugar",
    name: "Sugar",
    tradeName: "Granulated sugar",
    gcas: "10048502 or10048503",
    caloriesPer100g: 387,
    per100g: { totalFat: 0, saturatedFat: 0, transFat: 0, cholesterol: 0, sodium: 1, totalCarbohydrate: 99.8, dietaryFiber: 0, solubleFiber: 0, totalSugars: 99.8, addedSugars: 99.8, protein: 0, vitaminD: 0, calcium: 1, iron: 0.05, potassium: 2, vitaminA: 0, vitaminC: 0 },
  },
  {
    id: "citrus-flavor",
    name: "Citrus Flavor",
    tradeName: "Natural and Artificial Orange Flavor 059432 TBHAP0551",
    cas: "Mixture",
    gcas: "10055913",
    caloriesPer100g: 303,
    per100g: { totalFat: 0, saturatedFat: 0, transFat: 0, cholesterol: 0, sodium: 160, totalCarbohydrate: 75, dietaryFiber: 0, solubleFiber: 0, totalSugars: 0, addedSugars: 0, protein: 0, vitaminD: 0, calcium: 0, iron: 0, potassium: 0, vitaminA: 0, vitaminC: 0 },
  },
  {
    id: "orange-flavor-artificial",
    name: "Orange Flavor (Artificial)",
    tradeName: "Natural and Artificial Orange Flavor 059432 TBHAP0551",
    cas: "Mixture",
    gcas: "10055911 / 90629560",
    caloriesPer100g: 334,
    per100g: { totalFat: 0, saturatedFat: 0, transFat: 0, cholesterol: 0, sodium: 96, totalCarbohydrate: 83.8, dietaryFiber: 0.2, solubleFiber: 0, totalSugars: 2.9, addedSugars: 0, protein: 0.3, vitaminD: 0, calcium: 2, iron: 0, potassium: 8, vitaminA: 0, vitaminC: 0 },
  },
  {
    id: "yellow-6-fd-ic",
    name: "Yellow 6 (FD&IC)",
    tradeName: "FD&IC Yellow No. 6",
    cas: "2783-94-0",
    gcas: "10045737",
    caloriesPer100g: 0,
    per100g: { totalFat: 0, saturatedFat: 0, transFat: 0, cholesterol: 0, sodium: 3300, totalCarbohydrate: 0, dietaryFiber: 0, solubleFiber: 0, totalSugars: 0, addedSugars: 0, protein: 0, vitaminD: 0, calcium: 0, iron: 0, potassium: 0, vitaminA: 0, vitaminC: 0 },
  },
  {
    id: "new-natural-orange-flavor",
    name: "NEW Natural Orange Flavor",
    tradeName: "E25012409 Powerdry PR Orange Natural Orange Flavor WONF",
    gcas: "21346854",
    caloriesPer100g: 380,
    per100g: { totalFat: 0, saturatedFat: 0, transFat: 0, cholesterol: 0, sodium: 55, totalCarbohydrate: 96, dietaryFiber: 0, solubleFiber: 0, totalSugars: 28, addedSugars: 28, protein: 0, vitaminD: 0, calcium: 10, iron: 0, potassium: 0, vitaminA: 0, vitaminC: 0 },
  },
  {
    id: "hpmc-capsules",
    name: "HPMC Capsules",
    tradeName: "Capsugel empty hypromellose-based capsule products",
    gcas: "21625430",
    caloriesPer100g: 309,
    per100g: { totalFat: 0.39, saturatedFat: 0.12, transFat: 0.02, cholesterol: 0, sodium: 190, totalCarbohydrate: 0.35, dietaryFiber: 94, solubleFiber: 0, totalSugars: 0.35, addedSugars: 0, protein: 0.29, vitaminD: 0, calcium: 3, iron: 1, potassium: 122, vitaminA: 0, vitaminC: 0 },
  },
  {
    id: "sodium-bicarbonate",
    name: "Sodium Bicarbonate",
    tradeName: "Arm & Hammer Sodium Bicarbonate USP FCC",
    gcas: "91537550",
    caloriesPer100g: 0,
    per100g: { totalFat: 0, saturatedFat: 0, transFat: 0, cholesterol: 0, sodium: 27375, totalCarbohydrate: 0, dietaryFiber: 0, solubleFiber: 0, totalSugars: 0, addedSugars: 0, protein: 0, vitaminD: 0, calcium: 10, iron: 0.15, potassium: 0.7, vitaminA: 0, vitaminC: 0 },
  },
];

/**
 * Convert a library entry into an engine Ingredient. Every listed per-100 g value is
 * flagged "known"; nutrients the row omits are carried as confirmed zeros so the row
 * is complete (matches the Excel, where a blank cell contributes 0 to the SUM).
 */
export function libraryToIngredient(lib: LibraryIngredient, instanceId?: string): Ingredient {
  const tracked: NutrientId[] = [
    "totalFat", "saturatedFat", "transFat", "cholesterol", "sodium", "totalCarbohydrate",
    "dietaryFiber", "solubleFiber", "totalSugars", "addedSugars", "protein", "vitaminD",
    "calcium", "iron", "potassium", "vitaminA", "vitaminC",
  ];
  const nutrients: IngredientNutrient[] = tracked.map((nutrientId) => ({
    nutrientId,
    per100g: lib.per100g[nutrientId] ?? 0,
    completeness: lib.per100g[nutrientId] === undefined ? "zeroConfirmed" : "known",
  }));
  return {
    id: instanceId ?? lib.id,
    name: lib.name,
    tradeName: lib.tradeName,
    cas: lib.cas,
    gcas: lib.gcas,
    caloriesPer100g: lib.caloriesPer100g,
    nutrients,
  };
}
