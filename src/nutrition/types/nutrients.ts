// Canonical nutrient identity + catalog shape.
// Pure data — no region values, no UI concerns. Region-specific numbers live in config/regions/*.

export type NutrientId =
  // macronutrients & components declared in grams
  | "totalFat"
  | "saturatedFat"
  | "transFat"
  | "totalCarbohydrate"
  | "dietaryFiber"
  | "solubleFiber"
  | "insolubleFiber"
  | "totalSugars"
  | "addedSugars"
  | "sugarAlcohol"
  | "protein"
  // declared in milligrams
  | "cholesterol"
  | "sodium"
  // vitamins & minerals
  | "vitaminD"
  | "calcium"
  | "iron"
  | "potassium"
  | "vitaminA"
  | "vitaminC"
  | "vitaminE"
  | "vitaminK"
  | "thiamin"
  | "riboflavin"
  | "niacin"
  | "vitaminB6"
  | "folate"
  | "vitaminB12"
  | "biotin"
  | "pantothenicAcid"
  | "phosphorus"
  | "iodine"
  | "magnesium"
  | "zinc"
  | "selenium"
  | "copper"
  | "manganese"
  | "chromium"
  | "molybdenum"
  | "chloride"
  | "choline";

export type NutrientUnit = "g" | "mg" | "mcg" | "mcg RAE" | "mcg DFE" | "mg NE";

/** Rounding bucket for a nutrient's declared AMOUNT (its %DV uses the region's pctDV group). */
export type AmountRoundingGroup =
  | "fat"
  | "cholesterol"
  | "sodium"
  | "gram1"
  | "vitaminMineralAmount"
  // Per-nutrient micronutrient increments from the template's "Nutrition" tab.
  | "microNearestTenth"
  | "microNearestOne"
  | "microNearestTen";

export type NutrientKind = "macro" | "vitaminMineral";

export interface NutrientCatalogEntry {
  id: NutrientId;
  displayName: string;
  unit: NutrientUnit;
  kind: NutrientKind;
  /** True for the mandatory declarations of 21 CFR 101.9(c) (calories handled separately). */
  mandatory: boolean;
  amountRoundingGroup: AmountRoundingGroup;
  /** 101.9(g)(5) over-declaration ("eat less") limit nutrient. */
  isThirdGroup: boolean;
  /** FDA label indentation level. */
  indentLevel: 0 | 1 | 2;
}
