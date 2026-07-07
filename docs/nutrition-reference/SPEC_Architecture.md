# Step 4 — Architecture Specification (Nutrition Calculator)

**Module:** `MODULE_02 · PHC Nutrition Calculator`
**Scope:** v1 — US (21 CFR 101.9) only, single per-serving column, recipe-engine input, full mandatory panel.
**Status:** Architecture only. No engine/UI code is written yet. Pause for confirmation before Step 5 (build).

This document locks the module breakdown, data model, file/folder structure, and test plan. It encodes every architecture rule you specified.

---

## 1. Locked architecture rules → where each is enforced

| # | Rule | Enforced by |
|---|---|---|
| 1 | Pure-function calc core, no UI coupling; renderer consumes a structured panel object only | `src/nutrition/**` has **zero** React/DOM imports; UI imports types + `calcNutritionPanel()` only (§9, §11) |
| 2 | Rounding is its own module; tier tables loaded from config | `rounding/` applies tables from `config/regions/*`; no literal increments in code (§6) |
| 3 | Region rules pluggable; US-only v1; schema extensible | `RegionConfig` contract + `config/regions/index.ts` registry (§7) |
| 4 | Calorie methods: C default, B switchable, A/D/E/F stubbed | `engine/calories/` dispatcher + `stubs.ts` → `notImplemented` (§8) |
| 5 | Class I (≥100%), Class II (≥80%), Third group (≤120%) first-class | `compliance/` + `ComplianceClass` type (§7.3) |
| 6 | Overage: declare-down, no defaults, missing input blocks emission | `overage/` + pre-flight `OVERAGE_MISSING` block (§8.4) |
| 7 | Process-loss + shelf-life decay distinct pipeline stages, both audited | `engine/pipeline.ts` 4 stages, each emits an audit entry (§8.3) |
| 8 | Audit trail append-only, structured, with required fields | `audit/` builder; `AuditTrail` shape (§10) |
| 9 | Unit tests reproduce Excel under **B** (legacy parity) **and** **C** (new default); both pass before Step 5 done | `__tests__/` parity suites (§12) |

---

## 2. Layered architecture & one-way data flow

```
        CONFIG (data)                 CORE (pure fns)                 BOUNDARY            UI (React)
  ┌────────────────────┐      ┌──────────────────────────┐      ┌──────────────┐    ┌──────────────┐
  │ regions/us.ts      │─────▶│ orchestrator             │      │              │    │ NutritionApp │
  │  · daily values    │      │   ├─ preflight/validate  │      │              │    │  RecipeInput │
  │  · rounding tiers  │      │   ├─ recipe.sum          │      │ CalcResponse │───▶│  FactsLabel  │
  │  · compliance      │      │   ├─ corrections(VitD)   │─────▶│ (plain JSON  │    │  OutputPanel │
  │  · mandatory list  │      │   ├─ calories(C + alt B) │      │  object)     │    │  AuditTrail  │
  │ nutrients.ts       │      │   ├─ pipeline(loss→over→ │      │              │    │              │
  │  (catalog)         │      │   │     decay)           │      │ read-only    │    │ renders only │
  └────────────────────┘      │   ├─ percentDV           │      └──────────────┘    └──────────────┘
                              │   ├─ compliance          │
                              │   ├─ rounding (LAST)     │            ▲ UI never calls back into core ▲
                              │   └─ assemble + audit    │
                              └──────────────────────────┘
```

**Data flows one way:** config → core → `CalcResponse` → UI. The UI never imports engine internals and never mutates the response. Rounding happens **once, last**; everything upstream is full-precision.

---

## 3. File / folder structure

Calc core (no React) under `src/nutrition/`; UI (React) under `src/components/nutrition/` per the Step 3 design.

```
src/
  nutrition/                         # ── PURE CORE (no React, no DOM) ──
    index.ts                         # public API: calcNutritionPanel(request) → CalcResponse
    types/
      nutrients.ts                   # NutrientId union, NutrientCatalogEntry, units
      inputs.ts                      # CalcRequest, Ingredient, RecipeLine, NutrientPolicy
      results.ts                     # NutrientResult, NutritionPanel, CalcResponse, BlockingIssue
      audit.ts                       # AuditEntry, AuditTrail
      config.ts                      # RegionConfig, RoundingRule, RoundingTier, DailyValue, ComplianceRule
    engine/
      orchestrator.ts                # coordinates the pipeline (pure); single source of order
      preflight.ts                   # blocking validation (fiber split, completeness, overage)
      recipe.ts                      # Excel-parity recipe sum (VLOOKUP × %w/w × dose / 100)
      pipeline.ts                    # 4 stages: process-loss → overage → decay
      percentDV.ts                   # %DV on UNROUNDED as-declared
      calories/
        index.ts                     # method dispatcher; returns active + alternate
        methodB.ts                   # 4·protein + 4·carb + 9·fat
        methodC.ts                   # fiber-adjusted (default)
        stubs.ts                     # A,D,E,F → { notImplemented: true }
        fiberValidation.ts           # FLAG 1 hard-block: soluble/insoluble split required
    overage/
      overage.ts                     # declare-down (÷(1+overage)); no defaults; missing → block
    rounding/
      rounding.ts                    # generic tier applier (reads tables from config)
      formatValue.ts                 # "<1 g" / "less than 5 mg" text rendering
    compliance/
      compliance.ts                  # Class I / II / Third-group checks
    corrections/
      staleConstants.ts              # Vitamin D 0.2→20 mcg (+ future), each logged
    config/
      regionSchema.ts                # RegionConfig contract (the pluggable interface)
      nutrients.ts                   # canonical nutrient catalog (id, unit, mandatory, class default)
      regions/
        index.ts                     # registry: getRegion("US") → RegionConfig
        us.ts                        # 21 CFR 101.9 constants (DVs, rounding tiers, compliance)
    data/
      exampleProduct.ts              # "Irovy Orange" fixture for parity tests
    util/
      hash.ts                        # stable inputs fingerprint (non-crypto)
    __tests__/                       # Vitest suites (§12)
      recipe.parity.test.ts
      calories.methodB.test.ts
      calories.methodC.test.ts
      rounding.test.ts
      compliance.test.ts
      overage.test.ts
      pipeline.test.ts
      blocking.test.ts
      fiber.computed.test.ts
      audit.test.ts
      panel.shape.test.ts

  components/nutrition/              # ── UI (React) — Step 3 design, built in Step 5 ──
    RecipeInputPanel.tsx  IngredientRow.tsx  CompletenessBadge.tsx
    CalorieMethodToggle.tsx  NutritionFactsLabel.tsx  NutritionOutputPanel.tsx
    AuditTrailPanel.tsx
    # deferred v1.1 (hooks held): PipelineDiagram.tsx  CalorieMethodCompare.tsx
  components/NutritionApp.tsx        # rewritten: layout + state + wires calcNutritionPanel()
```

---

## 4. Data model

### 4.1 Inputs (`types/inputs.ts`)

```ts
export type CalorieMethod = "A" | "B" | "C" | "D" | "E" | "F";
export type NutrientSource = "added" | "naturally_occurring";
export type Completeness = "known" | "zeroConfirmed" | "unknown";

export interface IngredientNutrient {
  nutrientId: NutrientId;
  per100g: number;                 // in the nutrient's unit, per 100 g of ingredient
  completeness: Completeness;      // "unknown" blocks emission (FLAG 2)
}

export interface Ingredient {
  id: string;
  name: string;                    // VLOOKUP key (Excel Ingredients!A)
  nutrients: IngredientNutrient[]; // includes fat/sat/trans/cholesterol as first-class (FLAG 2)
  // dietaryFiber MUST be accompanied by solubleFiber + insolubleFiber when method C (FLAG 1)
}

export interface RecipeLine {
  ingredientId: string;
  percentWW: number;               // 0..1 (Excel Formulation!C). Editable in v1 (FLAG E)
}

export interface NutrientPolicy {
  nutrientId: NutrientId;
  source: NutrientSource;          // → compliance class
  sourceOverridden?: boolean;      // true when user changed the default → audited
  processLossFrac?: number;        // 0..1, default 0 (flagged "assumed")
  overageFrac?: number;            // 0..1, NO DEFAULT — required; missing → block (FLAG 3)
  shelfLifeDecayFrac?: number;     // 0..1, default 0 (flagged "assumed")
}

export interface CalcRequest {
  servingWeightG: number;          // dose (Excel Formulation!D9)
  servingsPerContainer?: number;   // label only
  regionId: "US";                  // v1
  calorieMethod: CalorieMethod;    // caller defaults to "C"
  recipe: RecipeLine[];
  ingredients: Ingredient[];
  nutrientPolicies: NutrientPolicy[];
}
```

### 4.2 Intermediate (internal to the engine, surfaced in results)

```ts
export interface NutrientStages {        // four-stage pipeline, full precision
  raw: number;                           // recipe sum
  asFormulated: number;                  // raw × (1 − processLoss)
  asDeclared: number;                    // asFormulated ÷ (1 + overage)   (declare-down)
  endOfShelfLife: number;                // asFormulated × (1 − decay)
}
```

### 4.3 Outputs (`types/results.ts`)

```ts
export type ComplianceClass = "I" | "II" | "thirdGroup" | "none";

export interface NutrientResult {
  nutrientId: NutrientId;
  unit: string;
  stages: NutrientStages;
  declaredAmountRounded: number | string;  // e.g. 25 | "less than 1 g"
  pctDV: number | null;                    // unrounded
  pctDVRounded: number | null;             // per 101.9(c)(8)(iii)
  source: NutrientSource;
  complianceClass: ComplianceClass;
  complianceFloorPct: number | null;       // 100 (I) | 80 (II) | null
  complianceCeilingPct: number | null;     // 120 (third) | null
  meetsCompliance: boolean | null;
  mandatory: boolean;
  citations: string[];
  flags: string[];
}

export interface CalorieResult {
  method: CalorieMethod;
  methodImplemented: boolean;
  value: number;                           // rounded label calories (active method)
  unrounded: number;
  alternate: { method: CalorieMethod; value: number; unrounded: number } | null; // FLAG 1
  citation: string;                        // "101.9(c)(1)(i)(C)"
}

export interface NutritionPanel {
  servingWeightG: number;
  servingsPerContainer: number | null;
  columnCount: 1;                          // FLAG C: single column v1 (renderer extensible)
  calories: CalorieResult;
  nutrients: NutrientResult[];
  footnotes: string[];                     // "Not a significant source of…", "Contains <2%…"
}

export type BlockingCode =
  | "METHOD_C_FIBER_SPLIT_MISSING"         // FLAG 1
  | "INGREDIENT_INCOMPLETE"                // FLAG 2
  | "OVERAGE_MISSING";                     // FLAG 3

export interface BlockingIssue {
  code: BlockingCode;
  message: string;
  offenders: string[];                     // ingredient ids / nutrient ids
}

export interface CalcResponse {
  status: "ok" | "blocked";
  panel: NutritionPanel | null;            // null when blocked
  blockingIssues: BlockingIssue[];
  validationFlags: string[];               // non-blocking warnings (assumed loss, %w/w≠1, …)
  auditTrail: AuditTrail;
  prototypeDisclaimer: string;             // always present
}
```

### 4.4 Config contract (`types/config.ts` / `config/regionSchema.ts`)

```ts
export interface RoundingTier {
  maxExclusive: number | null;             // upper bound (null = +∞)
  mode: "zero" | "nearest" | "text";
  increment?: number;                      // for "nearest" (e.g. 5, 10, 0.5, 1)
  text?: string;                           // for "text" (e.g. "less than 5 mg")
}
export interface RoundingRule {
  group: string;                           // "calories" | "fat" | "cholesterol" | "sodium" | "gram1" | "pctDV"
  tiers: RoundingTier[];                   // evaluated low→high
  citation: string;
}
export interface DailyValue {
  nutrientId: NutrientId; value: number; unit: string;
  basis: "RDI" | "DRV"; citation: string;
}
export interface ComplianceRule {
  klass: ComplianceClass;
  floorPct?: number;                       // I=100, II=80
  ceilingPct?: number;                     // thirdGroup=120
  appliesTo?: NutrientId[];                // third group: calories, totalSugars, addedSugars, sodium
  citation: string;
}
export interface RegionConfig {
  id: string; label: string; citationVersion: string;   // "21 CFR 101.9 (6/18/2026)"
  dailyValues: DailyValue[];
  roundingRules: RoundingRule[];
  nutrientRoundingGroup: Record<NutrientId, string>;     // nutrient → rounding group
  complianceRules: ComplianceRule[];
  mandatoryNutrients: NutrientId[];                      // the 15
}
```

A new region = a new `RegionConfig` object in `config/regions/`. **No engine edits.**

---

## 5. Module breakdown (responsibility · exports · must-not)

| Module | Responsibility | Key export(s) | MUST NOT |
|---|---|---|---|
| `index.ts` | Public entry; resolve region; run orchestrator | `calcNutritionPanel(req): CalcResponse` | contain math |
| `engine/orchestrator.ts` | Own the calculation order; assemble response | `runPipeline(req, cfg)` | import React; round early |
| `engine/preflight.ts` | All blocking checks before any math | `validate(req, cfg): BlockingIssue[]` | mutate inputs |
| `engine/recipe.ts` | Excel-parity per-nutrient sum | `sumRecipe(req): Map<NutrientId,number>` | apply loss/overage |
| `engine/pipeline.ts` | 4 stages (loss→overage→decay), per nutrient | `runStages(raw, policy): NutrientStages` | round; read config DVs |
| `engine/percentDV.ts` | %DV from **unrounded** as-declared | `percentDV(value, dv): number` | round |
| `engine/calories/*` | Dispatch method; active + alternate; C-validation | `computeCalories(...)` | silently bucket fiber |
| `overage/overage.ts` | Declare-down; enforce "no default" | `applyOverage(asFormulated, frac)` | invent a default |
| `rounding/rounding.ts` | Apply tier tables from config | `roundByGroup(value, group, cfg)` | hard-code increments |
| `compliance/compliance.ts` | Class I/II floors, Third-group ceiling | `assessCompliance(...)` | decide class names ad hoc |
| `corrections/staleConstants.ts` | Apply + log known corrections | `applyCorrections(...)` | change a value silently |
| `config/regions/us.ts` | All US numbers + citations | `US_REGION: RegionConfig` | contain logic |
| `config/nutrients.ts` | Canonical catalog | `NUTRIENTS`, `NutrientId` | contain region values |
| `audit/audit.ts` | Append-only structured log + hash | `AuditBuilder` | drop/reorder entries |

---

## 6. Rounding module (config-driven, no literals)

`roundByGroup(value, group, cfg)` looks up `cfg.roundingRules[group]`, walks tiers low→high, and applies the first tier whose `maxExclusive` bounds the value:

- **calories** → `[{<5: zero}, {≤50: nearest 5}, {∞: nearest 10}]` — 101.9(c)(1)
- **fat** (total/sat/trans) → `[{<0.5: zero}, {<5: nearest 0.5}, {∞: nearest 1}]` — 101.9(c)(2)
- **cholesterol** → `[{<2: zero}, {≤5: text "less than 5 mg"}, {∞: nearest 5}]` — 101.9(c)(3)
- **sodium** → `[{<5: zero}, {≤140: nearest 5}, {∞: nearest 10}]` — 101.9(c)(4)
- **gram1** (carb/fiber/soluble/insoluble/sugars/added/sugar-alcohol/protein) → `[{<0.5: zero}, {<1: text "less than 1 g"}, {∞: nearest 1}]` — 101.9(c)(6)(7)
- **pctDV** (vit/min) → `[{<2: zero/asterisk}, {≤10: nearest 2}, {≤50: nearest 5}, {∞: nearest 10}]` — 101.9(c)(8)(iii)

Every applied tier is logged to the audit trail as a `RoundingDecision` (value, tier, increment, citation). **This module is the only place rounding occurs.**

---

## 7. Region / compliance / catalog

### 7.1 `config/regions/us.ts`
All Daily Values (DRV 101.9(c)(9) + RDI 101.9(c)(8)(iv)), all rounding tiers, all compliance rules, the 15 mandatory nutrients, and `citationVersion = "21 CFR 101.9 (6/18/2026)"`. Values exactly as enumerated in the Step 2 spec §4.

### 7.2 `config/nutrients.ts`
Canonical catalog: each `NutrientId` → `{ unit, mandatory, defaultSource, isThirdGroup, displayName, indentLevel }`. `indentLevel` drives the label's FDA indentation; `isThirdGroup` flags calories/total sugars/added sugars/sodium.

### 7.3 `compliance/compliance.ts`
- **Class I** (`source:"added"`): pass if `endOfShelfLife ≥ 1.00 × asDeclared` — 101.9(g)(4)(i).
- **Class II** (`source:"naturally_occurring"`): pass if `endOfShelfLife ≥ 0.80 × asDeclared` — 101.9(g)(4)(ii).
- **Third group** (calories, total sugars, added sugars, sodium): pass if `asFormulated ≤ 1.20 × asDeclared` — 101.9(g)(5). *(Read-only in v1 UI, but computed in the engine.)*
- Default source for all vitamins/minerals = `"added"` (Class I) for the fortified gummy family; overrides audited.

---

## 8. Calculation flow (orchestrator order)

```
1. resolve region  ← getRegion(req.regionId)
2. PRE-FLIGHT (preflight.ts) → if any BlockingIssue: return {status:"blocked", panel:null, issues, audit}
     a. INGREDIENT_INCOMPLETE  — any active ingredient nutrient.completeness === "unknown"
     b. METHOD_C_FIBER_SPLIT_MISSING — method C & any fiber-bearing ingredient lacks soluble/insoluble split
     c. OVERAGE_MISSING — any nutrient policy without overageFrac
3. recipe.sum            → raw[nutrient]                          (audit: input + recipe)
4. corrections           → apply Vitamin D 0.2→20 (audit: correction, "corrected stale constant")
5. calories              → active = method C; alternate = method B  (audit: method + both values)
6. pipeline (per nutrient): raw → ×(1−loss)=asFormulated → ÷(1+overage)=asDeclared → ×(1−decay)=EOSL
                                                                  (audit: 3 transforms each)
7. percentDV (per nutrient): asDeclared / DV × 100  (UNROUNDED)
8. compliance (per nutrient): class floor (I/II) + third-group ceiling   (audit: class + result)
9. rounding (LAST): declaredAmountRounded, calories, pctDVRounded  (audit: rounding decision each)
10. assemble NutritionPanel + footnotes + non-blocking validationFlags
11. return {status:"ok", panel, validationFlags, auditTrail}
```

### 8.3 Pipeline stages (distinct, both loss & decay audited)
`raw → asFormulated → asDeclared → endOfShelfLife`. Process-loss and shelf-life decay are **separate functions** with their own audit entries; neither is folded into overage.

### 8.4 Overage (declare-down, no default)
`asDeclared = asFormulated ÷ (1 + overageFrac)`. If `overageFrac` is absent, pre-flight already blocked (step 2c) — the engine never substitutes a value.

---

## 9. UI integration boundary

- UI imports **only** `calcNutritionPanel` and the `types/*`.
- `NutritionApp.tsx` holds `CalcRequest` in React state, calls `calcNutritionPanel` in a `useMemo`, and passes the returned `CalcResponse` down. Mirrors how `PackagingApp` calls `predictFill`.
- When `status === "blocked"`, the center renders the blocked-label state from `blockingIssues` (Step 3 §4.3); the panel is `null`, so the renderer must guard on it.
- The renderer is **pure presentation** — it never recomputes a nutrient value.

---

## 10. Audit trail (append-only, structured)

```ts
export type AuditKind =
  | "input" | "transform" | "rounding" | "class"
  | "override" | "correction" | "finding" | "block";

export interface AuditEntry {
  seq: number;                 // monotonic, append-only
  kind: AuditKind;
  step: string;                // "recipe.sum" | "pipeline.overage" | "rounding.calories" …
  nutrientId?: NutrientId;
  detail: string;              // human-readable
  citation?: string;
}

export interface AuditTrail {
  inputsHash: string;          // stable fingerprint of CalcRequest (util/hash.ts, non-crypto)
  calorieMethod: CalorieMethod;
  region: string;
  entries: AuditEntry[];       // append-only; never reordered or removed
}
```

**Required content (every run):** `inputsHash`; `calorieMethod` (+ alternate value); **all overage inputs**; **all process-loss inputs**; decay inputs; **rounding decision per nutrient** (value→rounded, tier, citation); **class assignment per nutrient**; **every user override** of a default (`sourceOverridden`, edited %w/w, confirmed-zero); the **corrected stale constant** log (Vitamin D 0.2→20 mcg, extensible); the **structural finding** that the source Excel omitted fat/sat/trans/cholesterol columns (FLAG 2). Builder appends; nothing is mutated after the fact.

---

## 11. Tooling

- **Test runner:** **Vitest** (`vitest`, Vite-native; pairs with the existing Vite 5 setup). Add `devDependencies: vitest`, scripts `"test": "vitest run"`, `"test:watch": "vitest"`.
- **No new runtime deps** for the core. `framer-motion` (toggle/number motion) and `recharts` (deferred v1.1 compare view) are already installed.
- Core is plain TS; `tsc --noEmit` (existing `typecheck`) covers it.

---

## 12. Test plan

All suites under `src/nutrition/__tests__/`, run by Vitest against the `exampleProduct.ts` fixture ("Irovy Orange", the Excel example with fat/sat/trans/cholesterol added as `zeroConfirmed` and the psyllium soluble/insoluble split present).

### 12.1 Parity gates (must pass before Step 5 is "done")

| Suite | Assertion | Expected |
|---|---|---|
| `recipe.parity` | engine raw nutrient totals == Excel `Formulation` cached totals | equal to **1e-9** (protein 0.14007, carb 9.48469, fiber 5.48243, soluble 4.66006, sugars 0.20183, added 0.08363, …) |
| `calories.methodB` | **legacy parity** — method-B rounded label calories | **40 cal** (unrounded 38.50; documented vs Excel pre-tabulated 38.37 — both round to 40) |
| `calories.methodC` | **new default** — method-C rounded label calories | **25 cal** (unrounded 25.89) |

> Parity is asserted at the **rounded label** for calories (method B and the Excel's specific-factor column both declare 40) and at **exact precision** for recipe nutrient sums. The 38.50-vs-38.37 unrounded gap is expected (4-4-9 vs specific factors) and documented in the test.

### 12.2 Behavior suites

- **`rounding`** — table-driven cases for every tier in §6 (calories, fat, cholesterol incl. the "less than 5 mg" band, sodium, gram1 incl. "less than 1 g", pctDV four-tier). Boundary values (4.9/5/50/50.1, 0.49/0.5, 139/140/141, 1.9/2/10/10.1/50/50.1%).
- **`compliance`** — Class I pass/fail at the 100% boundary; Class II at 80%; Third-group at 120% (calories/sugars/added sugars/sodium). Verifies overage >20% on a limit nutrient trips the ceiling.
- **`overage`** — declare-down math (`asDeclared = asFormulated/(1+overage)`); **missing overage → `OVERAGE_MISSING`, `panel===null`, status `"blocked"`**.
- **`pipeline`** — exact 4-stage transforms; loss & decay applied at the correct stages; intermediates retain full precision (no early rounding).
- **`blocking`** — (a) method C + ingredient missing fiber split → `METHOD_C_FIBER_SPLIT_MISSING` naming the ingredient; (b) `unknown` completeness → `INGREDIENT_INCOMPLETE`; (c) missing overage → `OVERAGE_MISSING`. Each: `panel===null`, correct offenders.
- **`fiber.computed`** — soluble fiber = computed from the ingredient split (**4.66 g**, never the 70% heuristic); removing the split flips the run to the method-C block (no silent fallback).
- **`audit`** — trail is append-only (monotonic `seq`); contains inputsHash, calorie method + alternate, all overage/process-loss inputs, a rounding decision per nutrient, a class assignment per nutrient, override entries, and the Vitamin D correction entry; structural Excel-gap finding present.
- **`panel.shape`** — full `NutritionPanel` shape; `columnCount === 1`; mandatory 15 present; footnotes correct; `prototypeDisclaimer` non-empty.

### 12.3 Coverage intent
Core engine + rounding + compliance + overage at high line/branch coverage (target ≥90% on those modules); UI excluded from the parity gate.

---

## 13. What is explicitly deferred (hooks held)

- **Per-container second column** — `columnCount` typed as `1` now; widening to `1 | 2` + a second computed column later needs no engine change.
- **Ingredient authoring** — `Ingredient` is read-only input in v1; a future Enovia/CDL-backed authoring module produces `Ingredient[]`.
- **PipelineDiagram / CalorieMethodCompare** — UI-only, v1.1; data they need (`NutrientStages`, `calories.alternate`) is already in `CalcResponse`.
- **Regions beyond US** — add a `RegionConfig`; no core edits.
- **Calorie methods A/D/E/F** — stubbed with `notImplemented`; signature stable.

---

*Step 4 architecture complete. Per your build rule, I pause here. On your confirmation I proceed to Step 5: implement the core + config + tests (the B and C parity gates first), then build the Step 3 UI on top.*
