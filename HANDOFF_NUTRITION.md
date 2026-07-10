# Nutrition Calculator — Developer Handoff

This doc covers the nutrition module specifically (`src/nutrition/`). For the
packaging/DEM side, plus app setup and run instructions, see
[`HANDOFF_PACKAGING.md`](HANDOFF_PACKAGING.md).

---

## What this module is

A self-contained engine that takes a product formulation (ingredients, recipe percentages,
serving weight) and produces a regulation-compliant Supplement Facts panel. The math follows
**21 CFR 101.36**, which cross-references 21 CFR 101.9 for rounding, Daily Values, and
compliance tolerances.

**What it is not:** a validated regulatory tool. The outputs are for design and review
purposes. Confirm any label against the controlled labeling system before external use.

The current reference product is an "Irovy Orange" psyllium fiber powder gummy. All
per-ingredient values and expected declared amounts are verified against the source Excel
workbook. The `recipe.parity.test.ts` test acts as the primary parity gate.

---

## Folder map

```
src/nutrition/
├── index.ts              ← Public API. The UI imports ONLY this file.
├── NutritionApp.tsx      ← Top-level React shell. Holds CalcRequest state, passes CalcResponse down.
│
├── types/                ← TypeScript interfaces and enums — no logic here.
│   ├── inputs.ts         ← CalcRequest, Ingredient, RecipeLine, NutrientPolicy, CalorieMethod
│   ├── results.ts        ← CalcResponse, NutritionPanel, NutrientResult, CalorieResult
│   ├── nutrients.ts      ← NutrientId union type + NutrientCatalogEntry shape
│   ├── config.ts         ← RegionConfig, rounding tiers, compliance rules, DV table shape
│   └── audit.ts          ← AuditTrail, AuditEntry, AuditKind — the append-only log shape
│
├── config/
│   ├── nutrients.ts      ← Catalog of every declared nutrient: label name, unit, rounding bucket, kind
│   └── regions/
│       ├── index.ts      ← Registry — maps regionId string → RegionConfig. Add new regions here.
│       └── us.ts         ← US region: Daily Values, rounding tier tables, compliance rules
│
├── engine/               ← All calculation logic. No React here.
│   ├── orchestrator.ts   ← Entry point for the engine. Calls preflight, recipe, calories, compliance,
│   │                       rounding, audit. Returns a complete CalcResponse.
│   ├── preflight.ts      ← Three blocking gates (see "Blocking gates" below). Fires before any math.
│   ├── recipe.ts         ← Sums per-ingredient per-100g values across the dose to get per-serving totals.
│   ├── pipeline.ts       ← Four-stage per-nutrient value chain: raw → asFormulated → asDeclared → EOSL
│   ├── percentDV.ts      ← Divides asDeclared by the region Daily Value to get unrounded %DV
│   └── calories/
│       ├── index.ts      ← Runs C+/C/B, picks the active method, builds CalorieResult
│       ├── macros.ts     ← Shared MacroGrams shape (protein, carb, fat, dietary + soluble fiber)
│       ├── methodB.ts    ← Legacy 4/4/9 general factors
│       ├── methodC.ts    ← Fiber-adjusted C (total fiber @ 2 kcal/g) and C+ (soluble fiber @ 2 kcal/g)
│       └── fiberValidation.ts ← Checks that every fiber source has a soluble/insoluble split
│
├── rounding/
│   └── rounding.ts       ← Applies tier tables from region config. The only place rounding happens.
│
├── compliance/
│   └── compliance.ts     ← Class I / II floor and third-group ceiling checks per 101.9(g)
│
├── overage/
│   └── overage.ts        ← OH-234 declare-down: asDeclared = asFormulated ÷ (1 + overageFrac)
│
├── audit/
│   └── audit.ts          ← AuditBuilder: append-only log used by the orchestrator to record every step
│
├── corrections/
│   └── staleConstants.ts ← Known Excel constant corrections (e.g. Vitamin D DV). Append here, never silent.
│
├── data/
│   └── exampleProduct.ts ← Reference CalcRequest for "Irovy Orange." Frozen against Excel values.
│
├── util/
│   └── hash.ts           ← FNV-1a fingerprint of the CalcRequest for audit-trail reproducibility
│
├── components/           ← React render-only components. None of these do math.
│   ├── NutritionFactsLabel.tsx   ← Center panel: renders the actual Supplement Facts label
│   ├── RecipeInputPanel.tsx      ← Left panel: editable formulation inputs
│   ├── NutritionOutputPanel.tsx  ← Below the label: compliance verdict + per-nutrient flags
│   ├── NutritionWorksheet.tsx    ← "Nutrition tab" — spreadsheet-style full nutrient breakdown
│   ├── NutritionTutorial.tsx     ← "Learn" accordion: background on every calculation step
│   ├── IngredientRow.tsx         ← One collapsible ingredient row in the recipe editor
│   ├── CompletenessBadge.tsx     ← Status pill for ingredient nutrient completeness
│   └── CalorieMethodToggle.tsx   ← C+ / C / B segmented control (shared between two panels)
│
└── __tests__/            ← Vitest unit tests. Run with: npm test
    ├── recipe.parity.test.ts     ← PARITY GATE: recipe sums must match Excel to < 1e-9
    ├── calories.excelParity.test.ts ← PARITY GATE: B/C/C+ formulas match the workbook to < 1e-9
    ├── calories.methodB.test.ts  ← Method B → 40 cal (example product)
    ├── calories.methodC.test.ts  ← Methods C (30 cal) and C+ (25 cal, default)
    ├── blocking.test.ts          ← All three blocking codes produce status:"blocked", panel:null
    ├── overage.test.ts           ← Declare-down math + missing overage block
    ├── compliance.test.ts        ← Class I / II floor and ceiling verdicts
    ├── rounding.test.ts          ← Tier boundary values per 101.9(c)
    ├── pipeline.test.ts          ← Four-stage value chain arithmetic
    ├── fiber.computed.test.ts    ← Soluble fiber is summed, never inferred
    ├── audit.test.ts             ← Audit trail structure (OH-222)
    └── panel.shape.test.ts       ← CalcResponse must be pure data (no UI tokens)
```

---

## How data flows

```
CalcRequest (user edits)
    │
    ▼
preflight()          ← fails fast if inputs are incomplete
    │
    ▼
sumRecipe()          ← per-serving totals for every declared nutrient
    │
    ▼
computeCalories()    ← computes C+, C, B; picks the active method
    │
    ▼
  per nutrient:
    runStages()      ← raw → asFormulated → asDeclared → endOfShelfLife
    percentDV()      ← asDeclared ÷ DV (unrounded)
    classify()       ← Class I / II / thirdGroup
    assessCompliance()
    roundByGroup()   ← rounds amount and %DV using region tier tables
    │
    ▼
CalcResponse         ← pure data; all downstream rendering reads this
```

---

## Blocking gates

The engine never emits a partial label. If any of these fire, `status` is `"blocked"`,
`panel` is `null`, and `blockingIssues` names the offenders.

| Code | When it fires |
|------|---------------|
| `INGREDIENT_INCOMPLETE` | Any ingredient nutrient has `completeness: "unknown"` |
| `METHOD_C_FIBER_SPLIT_MISSING` | Method C+ is selected but a fiber source has no soluble/insoluble split |
| `OVERAGE_MISSING` | A floor nutrient (Class I or II) has no `overageFrac` in `nutrientPolicies` |

---

## "I want to change…" → open this file

| Task | File |
|------|------|
| Change Daily Values or add a new one | `config/regions/us.ts` → `dailyValues` array |
| Change a rounding tier (e.g. fat threshold) | `config/regions/us.ts` → `roundingRules` array |
| Add a new nutrient to the catalog | `config/nutrients.ts` → `NUTRIENTS` map, then `types/nutrients.ts` → `NutrientId` |
| Change calorie method logic | `engine/calories/methodB.ts` (B) or `methodC.ts` (C / C+) |
| Change the reference product (Irovy Orange) | `data/exampleProduct.ts` — update AND re-verify parity tests |
| Change compliance class logic | `compliance/compliance.ts` |
| Add a correction for a stale Excel constant | `corrections/staleConstants.ts` — append, never edit existing |
| Add a second region | `config/regions/` — add a new file, register it in `regions/index.ts` |
| Change label layout | `components/NutritionFactsLabel.tsx` |
| Change the left input panel | `components/RecipeInputPanel.tsx` |
| Change compliance display below the label | `components/NutritionOutputPanel.tsx` |

---

## Running the tests

```powershell
npm test
```

Tests use Vitest. The parity tests (`recipe.parity.test.ts`, `calories.excelParity.test.ts`) are
the most important — they assert exact numeric agreement with the source Excel. If any of
those fail after a change, something in the recipe or calorie path changed and needs to be
reconciled against the workbook before proceeding.

---

## Key conventions

- **The engine never hard-codes numbers.** Every DV, rounding tier, and compliance floor
  comes out of `RegionConfig`. The tests use `US_REGION` directly to confirm this.

- **No rounding inside the pipeline.** `runStages()`, `percentDV()`, and `assessCompliance()`
  all operate on unrounded values. `roundByGroup()` is called once per nutrient, at the very
  end of the orchestrator loop.

- **`CalcResponse` is pure data.** No Tailwind class names, no color tokens, no display
  strings beyond the regulatory declarations the law itself mandates (e.g. "Less than 1 g").
  The `panel.shape.test.ts` test enforces this.

- **Overage has no default.** A missing `overageFrac` is a blocking issue (`OVERAGE_MISSING`),
  not a silent zero. This matches the OH-234 requirement.

- **Corrections are append-only.** Add new entries to `staleConstants.ts`; never silently
  update a constant without a logged correction entry.

---

## Calorie methods at a glance

| Method | Basis | Status |
|--------|-------|--------|
| C+ | 4·protein + 9·fat + 4·(carb − total fiber) + 2·soluble fiber — the value the Excel declares | ✅ Implemented; default |
| C | 4·protein + 9·fat + 4·(carb − total fiber) + 2·total fiber — used when no soluble split exists | ✅ Implemented |
| B | Legacy Atwater general factors: 4·protein + 4·carb + 9·fat | ✅ Implemented |

These are the only three methods the source workbook uses (all cited 101.9(c)(1)(i)); A/D/E/F
are not implemented. All three (C+/C/B) are shown alongside each other in the UI as cross-checks,
regardless of which is the active declared method.
