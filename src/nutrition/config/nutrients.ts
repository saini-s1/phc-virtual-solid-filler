import type {
  AmountRoundingGroup,
  NutrientCatalogEntry,
  NutrientId,
} from "../types/nutrients";
import type { NutrientSource } from "../types/inputs";

// Canonical nutrient catalog (units, label order, indentation, rounding bucket).
// Region-independent identity only — Daily Values & rounding tiers live in config/regions/*.

// Shorthand builder for vitamins/minerals — they all share the same defaults
// (kind: vitaminMineral, amountRoundingGroup, isThirdGroup: false, indentLevel: 0).
function vm(
  id: NutrientId,
  displayName: string,
  unit: NutrientCatalogEntry["unit"],
  mandatory: boolean,
  // Per-nutrient amount rounding increment from the template's "Nutrition" tab
  // (21 CFR 101.9(c)(8)(iii)). Defaults to the generic 2-sig-fig bucket for the
  // many vitamins/minerals the template does not call out individually.
  amountRoundingGroup: AmountRoundingGroup = "vitaminMineralAmount",
): NutrientCatalogEntry {
  return {
    id,
    displayName,
    unit,
    kind: "vitaminMineral",
    mandatory,
    amountRoundingGroup,
    isThirdGroup: false,
    indentLevel: 0,
  };
}

export const NUTRIENTS: Record<NutrientId, NutrientCatalogEntry> = {
  totalFat: { id: "totalFat", displayName: "Total Fat", unit: "g", kind: "macro", mandatory: true, amountRoundingGroup: "fat", isThirdGroup: true, indentLevel: 0 },
  saturatedFat: { id: "saturatedFat", displayName: "Saturated Fat", unit: "g", kind: "macro", mandatory: true, amountRoundingGroup: "fat", isThirdGroup: true, indentLevel: 1 },
  transFat: { id: "transFat", displayName: "Trans Fat", unit: "g", kind: "macro", mandatory: true, amountRoundingGroup: "fat", isThirdGroup: true, indentLevel: 1 },
  cholesterol: { id: "cholesterol", displayName: "Cholesterol", unit: "mg", kind: "macro", mandatory: true, amountRoundingGroup: "cholesterol", isThirdGroup: true, indentLevel: 0 },
  sodium: { id: "sodium", displayName: "Sodium", unit: "mg", kind: "macro", mandatory: true, amountRoundingGroup: "sodium", isThirdGroup: true, indentLevel: 0 },
  totalCarbohydrate: { id: "totalCarbohydrate", displayName: "Total Carbohydrate", unit: "g", kind: "macro", mandatory: true, amountRoundingGroup: "gram1", isThirdGroup: false, indentLevel: 0 },
  dietaryFiber: { id: "dietaryFiber", displayName: "Dietary Fiber", unit: "g", kind: "macro", mandatory: true, amountRoundingGroup: "gram1", isThirdGroup: false, indentLevel: 1 },
  solubleFiber: { id: "solubleFiber", displayName: "Soluble Fiber", unit: "g", kind: "macro", mandatory: false, amountRoundingGroup: "gram1", isThirdGroup: false, indentLevel: 2 },
  insolubleFiber: { id: "insolubleFiber", displayName: "Insoluble Fiber", unit: "g", kind: "macro", mandatory: false, amountRoundingGroup: "gram1", isThirdGroup: false, indentLevel: 2 },
  totalSugars: { id: "totalSugars", displayName: "Total Sugars", unit: "g", kind: "macro", mandatory: true, amountRoundingGroup: "gram1", isThirdGroup: true, indentLevel: 1 },
  addedSugars: { id: "addedSugars", displayName: "Added Sugars", unit: "g", kind: "macro", mandatory: true, amountRoundingGroup: "gram1", isThirdGroup: true, indentLevel: 2 },
  sugarAlcohol: { id: "sugarAlcohol", displayName: "Sugar Alcohol", unit: "g", kind: "macro", mandatory: false, amountRoundingGroup: "gram1", isThirdGroup: false, indentLevel: 1 },
  protein: { id: "protein", displayName: "Protein", unit: "g", kind: "macro", mandatory: true, amountRoundingGroup: "gram1", isThirdGroup: false, indentLevel: 0 },

  // Mandatory micronutrients — per-nutrient rounding increments from the template's
  // "Nutrition" tab (Iron 0.1 mg, Potassium/Calcium 10 mg, Vit D 0.1 mcg).
  vitaminD: vm("vitaminD", "Vitamin D", "mcg", true, "microNearestTenth"),
  calcium: vm("calcium", "Calcium", "mg", true, "microNearestTen"),
  iron: vm("iron", "Iron", "mg", true, "microNearestTenth"),
  potassium: vm("potassium", "Potassium", "mg", true, "microNearestTen"),
  // Voluntary micronutrients called out in the template (Vit A 10 mcg RAE, Vit C 1 mg).
  vitaminA: vm("vitaminA", "Vitamin A", "mcg RAE", false, "microNearestTen"),
  vitaminC: vm("vitaminC", "Vitamin C", "mg", false, "microNearestOne"),
  vitaminE: vm("vitaminE", "Vitamin E", "mg", false),
  vitaminK: vm("vitaminK", "Vitamin K", "mcg", false),
  thiamin: vm("thiamin", "Thiamin", "mg", false),
  riboflavin: vm("riboflavin", "Riboflavin", "mg", false),
  niacin: vm("niacin", "Niacin", "mg NE", false),
  vitaminB6: vm("vitaminB6", "Vitamin B6", "mg", false),
  folate: vm("folate", "Folate", "mcg DFE", false),
  vitaminB12: vm("vitaminB12", "Vitamin B12", "mcg", false),
  biotin: vm("biotin", "Biotin", "mcg", false),
  pantothenicAcid: vm("pantothenicAcid", "Pantothenic Acid", "mg", false),
  phosphorus: vm("phosphorus", "Phosphorus", "mg", false),
  iodine: vm("iodine", "Iodine", "mcg", false),
  magnesium: vm("magnesium", "Magnesium", "mg", false),
  zinc: vm("zinc", "Zinc", "mg", false),
  selenium: vm("selenium", "Selenium", "mcg", false),
  copper: vm("copper", "Copper", "mg", false),
  manganese: vm("manganese", "Manganese", "mg", false),
  chromium: vm("chromium", "Chromium", "mcg", false),
  molybdenum: vm("molybdenum", "Molybdenum", "mcg", false),
  chloride: vm("chloride", "Chloride", "mg", false),
  choline: vm("choline", "Choline", "mg", false),
};

/** FDA label order (declared subset is filtered against this at render time). */
export const NUTRIENT_ORDER: NutrientId[] = [
  "totalFat",
  "saturatedFat",
  "transFat",
  "cholesterol",
  "sodium",
  "totalCarbohydrate",
  "dietaryFiber",
  "solubleFiber",
  "insolubleFiber",
  "totalSugars",
  "addedSugars",
  "sugarAlcohol",
  "protein",
  "vitaminD",
  "calcium",
  "iron",
  "potassium",
  "vitaminA",
  "vitaminC",
  "vitaminE",
  "vitaminK",
  "thiamin",
  "riboflavin",
  "niacin",
  "vitaminB6",
  "folate",
  "vitaminB12",
  "biotin",
  "pantothenicAcid",
  "phosphorus",
  "iodine",
  "magnesium",
  "zinc",
  "selenium",
  "copper",
  "manganese",
  "chromium",
  "molybdenum",
  "chloride",
  "choline",
];

/** Catalog default source: fortified actives default to "added" (Class I). */
export function defaultSourceFor(id: NutrientId): NutrientSource {
  return NUTRIENTS[id].kind === "vitaminMineral" ? "added" : "naturally_occurring";
}
