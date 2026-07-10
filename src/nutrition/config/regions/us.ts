import type { RegionConfig } from "../../types/config";

// US region config — Supplement Facts panel per 21 CFR 101.36.
// What 101.36 EXPLICITLY incorporates from 101.9 (exact cross-references, eCFR 7/01/2026):
//   • Rounding increments: 101.36(b)(2)(ii)(A) → "the increments specified in §101.9(c)(1)–(7)"
//   • Zero threshold:      101.36(b)(2)(i)     → "declared as zero in ... §101.9(c)"
//   • RDI/DRV values:      101.36(b)(2)(iii)(B)→ §101.9(c)(8)(iv) [RDI] and §101.9(c)(9) [DRV]
//   • Class I/II floors:   101.36(f)(1)        → §101.9(g)(3) and (g)(4)
// Calorie calculation methods (A–F): 101.36 does NOT explicitly name them. The engine uses
// Methods D/B/C from 101.9(c)(1)(i) by regulatory implication — 101.36 specifies only how to
// ROUND the calorie value (via the (c)(1) cross-reference), not how to COMPUTE it. Since 101.36
// provides no alternative formula, 101.9(c)(1)(i) methods are the only FDA-recognised approaches.
// P&G PHC solid forms (psyllium fiber / vitamin-mineral gummies) are dietary supplements.
// OTC drugs (DayQuil/NyQuil) use Drug Facts (21 CFR 201.66), out of scope.
// Engine reads these numbers; it never hard-codes them. Current as of 7/01/2026.

export const US_REGION: RegionConfig = {
  id: "US",
  label: "United States — 21 CFR 101.36 (Supplement Facts)",
  citationVersion: "21 CFR 101.36, rounding/DVs/compliance via 101.9(c) cross-refs (current as of 7/01/2026)",
  panelStandard: "supplementFacts",
  panelTitle: "Supplement Facts",
  regulation: "21 CFR 101.36",

  // ── Daily Values: DRV macros 101.9(c)(9); RDI vitamins/minerals 101.9(c)(8)(iv) ──
  dailyValues: [
    { nutrientId: "totalFat", value: 78, unit: "g", basis: "DRV", citation: "101.9(c)(9)" },
    { nutrientId: "saturatedFat", value: 20, unit: "g", basis: "DRV", citation: "101.9(c)(9)" },
    { nutrientId: "cholesterol", value: 300, unit: "mg", basis: "DRV", citation: "101.9(c)(9)" },
    { nutrientId: "sodium", value: 2300, unit: "mg", basis: "DRV", citation: "101.9(c)(9)" },
    { nutrientId: "totalCarbohydrate", value: 275, unit: "g", basis: "DRV", citation: "101.9(c)(9)" },
    { nutrientId: "dietaryFiber", value: 28, unit: "g", basis: "DRV", citation: "101.9(c)(9)" },
    { nutrientId: "addedSugars", value: 50, unit: "g", basis: "DRV", citation: "101.9(c)(9)" },
    { nutrientId: "protein", value: 50, unit: "g", basis: "DRV", citation: "101.9(c)(9)" },
    // Vitamin D corrected from the Excel's stale 0.2 to the current 20 mcg (see corrections/staleConstants).
    { nutrientId: "vitaminD", value: 20, unit: "mcg", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "calcium", value: 1300, unit: "mg", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "iron", value: 18, unit: "mg", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "potassium", value: 4700, unit: "mg", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "vitaminA", value: 900, unit: "mcg RAE", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "vitaminC", value: 90, unit: "mg", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "vitaminE", value: 15, unit: "mg", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "vitaminK", value: 120, unit: "mcg", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "thiamin", value: 1.2, unit: "mg", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "riboflavin", value: 1.3, unit: "mg", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "niacin", value: 16, unit: "mg NE", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "vitaminB6", value: 1.7, unit: "mg", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "folate", value: 400, unit: "mcg DFE", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "vitaminB12", value: 2.4, unit: "mcg", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "biotin", value: 30, unit: "mcg", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "pantothenicAcid", value: 5, unit: "mg", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "phosphorus", value: 1250, unit: "mg", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "iodine", value: 150, unit: "mcg", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "magnesium", value: 420, unit: "mg", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "zinc", value: 11, unit: "mg", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "selenium", value: 55, unit: "mcg", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "copper", value: 0.9, unit: "mg", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "manganese", value: 2.3, unit: "mg", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "chromium", value: 35, unit: "mcg", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "molybdenum", value: 45, unit: "mcg", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "chloride", value: 2300, unit: "mg", basis: "RDI", citation: "101.9(c)(8)(iv)" },
    { nutrientId: "choline", value: 550, unit: "mg", basis: "RDI", citation: "101.9(c)(8)(iv)" },
  ],

  // ── Deterministic rounding tiers (replace the Excel's human "Reco." judgment) ──
  roundingRules: [
    {
      group: "calories",
      citation: "101.9(c)(1)",
      tiers: [
        { upTo: 5, inclusive: false, mode: "zero" },
        { upTo: 50, inclusive: true, mode: "nearest", increment: 5 },
        { upTo: null, inclusive: false, mode: "nearest", increment: 10 },
      ],
    },
    {
      group: "fat",
      citation: "101.9(c)(2)",
      tiers: [
        { upTo: 0.5, inclusive: false, mode: "zero" },
        { upTo: 5, inclusive: false, mode: "nearest", increment: 0.5 },
        { upTo: null, inclusive: false, mode: "nearest", increment: 1 },
      ],
    },
    {
      group: "cholesterol",
      citation: "101.9(c)(3)",
      tiers: [
        { upTo: 2, inclusive: false, mode: "zero" },
        { upTo: 5, inclusive: true, mode: "text", text: "Less than 5 mg" },
        { upTo: null, inclusive: false, mode: "nearest", increment: 5 },
      ],
    },
    {
      group: "sodium",
      citation: "101.9(c)(4)",
      tiers: [
        { upTo: 5, inclusive: false, mode: "zero" },
        { upTo: 140, inclusive: true, mode: "nearest", increment: 5 },
        { upTo: null, inclusive: false, mode: "nearest", increment: 10 },
      ],
    },
    {
      group: "gram1",
      citation: "101.9(c)(6),(c)(7)",
      tiers: [
        { upTo: 0.5, inclusive: false, mode: "zero" },
        { upTo: 1, inclusive: false, mode: "text", text: "Less than 1 g" },
        { upTo: null, inclusive: false, mode: "nearest", increment: 1 },
      ],
    },
    {
      group: "pctDv",
      citation: "101.9(c)(8)(iii)",
      tiers: [
        { upTo: 2, inclusive: false, mode: "zero" },
        { upTo: 10, inclusive: true, mode: "nearest", increment: 2 },
        { upTo: 50, inclusive: true, mode: "nearest", increment: 5 },
        { upTo: null, inclusive: false, mode: "nearest", increment: 10 },
      ],
    },
    {
      // Quantitative vitamin/mineral amount (D, Ca, Fe, K). 101.9(c)(8)(iii) "insignificant
      // digits" simplified to 2 significant figures for v1; flagged where it bites.
      group: "vitaminMineralAmount",
      citation: "101.9(c)(8)(iii)",
      strategy: "significantFigures",
      sigFigs: 2,
    },
    // Per-nutrient micronutrient amount increments, transcribed from the template's
    // "Nutrition" tab (each cell states "round to nearest N …"). 101.9(c)(8)(iii).
    {
      // Iron → nearest 0.1 mg; Vitamin D → nearest 0.1 mcg.
      group: "microNearestTenth",
      citation: "101.9(c)(8)(iii)",
      tiers: [{ upTo: null, inclusive: false, mode: "nearest", increment: 0.1 }],
    },
    {
      // Vitamin C → nearest 1 mg.
      group: "microNearestOne",
      citation: "101.9(c)(8)(iii)",
      tiers: [{ upTo: null, inclusive: false, mode: "nearest", increment: 1 }],
    },
    {
      // Potassium, Calcium → nearest 10 mg; Vitamin A → nearest 10 mcg RAE.
      group: "microNearestTen",
      citation: "101.9(c)(8)(iii)",
      tiers: [{ upTo: null, inclusive: false, mode: "nearest", increment: 10 }],
    },
  ],

  pctDvRoundingGroup: "pctDv",

  // ── Compliance classes 101.9(g) ──
  complianceRules: [
    { klass: "I", floorPct: 100, citation: "101.9(g)(4)(i)" },
    { klass: "II", floorPct: 80, citation: "101.9(g)(4)(ii)" },
    { klass: "thirdGroup", ceilingPct: 120, citation: "101.9(g)(5)" },
  ],

  // (b)(2)-dietary ingredients to be declared per 101.36(b)(2)(i) (same list as 101.9(c);
  // calories handled in the calorie result). On a Supplement Facts panel these are declared
  // only when present above the zero-rounding threshold; the engine still emits them so the
  // data contract is stable (a 101.9 food panel could reuse the same request).
  mandatoryNutrients: [
    "totalFat",
    "saturatedFat",
    "transFat",
    "cholesterol",
    "sodium",
    "totalCarbohydrate",
    "dietaryFiber",
    "totalSugars",
    "addedSugars",
    "protein",
    "vitaminD",
    "calcium",
    "iron",
    "potassium",
  ],
};
