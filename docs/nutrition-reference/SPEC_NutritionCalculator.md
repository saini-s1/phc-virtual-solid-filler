# Specification — Nutrition Calculator Module (v2, eCFR-traced)

**Project:** P&G PHC unified modeling pipeline
**Module:** Nutrition Facts surrogate/deterministic calculator
**Status:** Step 2 deliverable — re-issued with every constant traced to **eCFR 21 CFR 101.9 (current as of 6/18/2026)** and the FDA **Daily Value reference guide (Aug 2023)**.
**Authoritative source:** eCFR 21 CFR 101.9. Where any prior PDF, the Excel workbook, or this document conflict, **21 CFR 101.9 wins.**

> **Prototype disclaimer.** Like the packaging module, this is an internal prototype. The *regulatory math* below is real (traced to 101.9), but ingredient nutrient data, process-loss factors, overage targets, and shelf-life decay are **placeholder/illustrative** until sourced from Enovia/CDL and stability studies. Every output must be labeled a prototype calculation, not a validated label.

---

## 1. Purpose & scope

Convert a **formulation recipe** (ingredients + %w/w + serving size) into a **rounded, FDA-compliant Nutrition Facts panel**, plus an auditable trail showing how each nutrient moves from raw input to the end-of-shelf-life value.

**In scope (v1):**
- Recipe → per-serving nutrient totals (replicates the Excel engine exactly).
- US Nutrition Facts panel: mandatory + the voluntary nutrients the Excel already carries.
- Deterministic FDA rounding (code, not human judgment).
- %DV against current DVs.
- Four-stage nutrient pipeline: **raw → as-formulated → as-declared → end-of-shelf-life** (process loss, OH-234 overage, shelf-life decay).
- Class I/II compliance check at end of shelf life.
- Calorie method selector (default C, support B, stub A/D/E/F).

**Out of scope (v1):**
- Connection to the packaging module (future).
- Non-US regions (schema is extensible; only US config ships).
- The `DRAFT from Cleanse work` analytical t-prediction-interval method (lab QC tool, not part of the label engine — kept as a separate documented utility).
- Inventing regulatory logic or per-nutrient overage constants not given by OH-234/101.9.

---

## 2. Source-of-truth hierarchy

1. **eCFR 21 CFR 101.9** — all rounding, thresholds, calorie methods, DV values, class/compliance rules.
2. **OH-234 (VV-QUAL-2019440)** — overage *math* (Class I/II/Third limits, overage formula structure).
3. **OH-222 (VV-QUAL-569949)** — *process/output* governance (who signs off, audit trail expectations). No formulas.
4. **Excel workbook** — the *engine reference* (recipe path, ingredient DB, example product). Replicated, not extended, except where a mandatory panel field is missing.

"If it ain't broke, don't fix it": the recipe engine and ingredient-table approach are preserved verbatim. New behavior (deterministic rounding, process loss, overage, decay) is added as *separate layers*, and every divergence from the Excel is flagged in §10 for your confirmation.

---

## 3. Inputs (data model)

```ts
// All inputs are plain data — no UI types in the calc core.

interface NutrientAmount {
  nutrientId: NutrientId;     // canonical id, see §4.1
  per100g: number;            // amount per 100 g of THIS ingredient, in the nutrient's unit
  // FLAG 2 completeness: every mandatory nutrient must be resolved before the
  // panel can be emitted. "zeroConfirmed" = user confirmed a genuine 0 (e.g.
  // fat in a mineral premix); "unknown" flags the row incomplete and BLOCKS emission.
  completeness: "known" | "zeroConfirmed" | "unknown";
}

interface Ingredient {
  id: string;
  name: string;               // VLOOKUP key (matches Excel Ingredients!A)
  nutrients: NutrientAmount[]; // per-100g density table (Excel Ingredients!E:R)
  // FLAG 2: fat, saturated fat, trans fat, cholesterol are now FIRST-CLASS columns
  //         (added to the Excel's reduced set); 0 only when the user confirms it.
  // FLAG 1: dietary fiber MUST carry a soluble/insoluble split when calorie
  //         method C is selected (C needs soluble non-digestible carb @ 2 cal/g).
}

interface RecipeLine {
  ingredientId: string;
  percentWW: number;          // %w/w of the formula (Excel Formulation!C14:C20), 0..1
  // Optional per-line source/loss overrides; default from nutrient/region config.
}

interface NutrientPolicy {
  nutrientId: NutrientId;
  source: "added" | "naturally_occurring"; // → Class I / Class II (§4.4)
  processLossFrac?: number;   // 0..1, manufacturing loss (default 0, flagged)
  overageFrac?: number;       // 0..1, OH-234 cushion — NO DEFAULT (FLAG 3).
                              // Required user input; missing → blocking flag, no label.
  shelfLifeDecayFrac?: number;// 0..1, loss over claimed shelf life (default 0, flagged)
}

interface CalcRequest {
  servingWeightG: number;       // dose weight (Excel Formulation!D9, e.g. 10.68 g)
  servingsPerContainer?: number;// label only; does not affect per-serving math
  recipe: RecipeLine[];
  ingredients: Ingredient[];
  regionId: "US";               // v1 only; schema extensible
  calorieMethod: "A"|"B"|"C"|"D"|"E"|"F"; // default "C"
  nutrientPolicies: NutrientPolicy[]; // source/loss/overage/decay per nutrient
}
```

**Product-family default:** the gummy family is *fortified* — so **every vitamin/mineral defaults to `source: "added"` → Class I (≥100% compliance)**. This default is applied automatically and surfaced in the audit trail; any nutrient can be overridden to `naturally_occurring` per item.

---

## 4. Reference data (constants) — region config, all eCFR-traced

All constants live in a **region config file** (`config/regions/us.ts`), never hard-coded in the engine. Schema is region-agnostic so a future `eu.ts` can drop in.

### 4.1 Daily Values

| Nutrient | DV | Unit | Type | Citation |
|---|---|---|---|---|
| Total fat | 78 | g | DRV | 101.9(c)(9) |
| Saturated fat | 20 | g | DRV | 101.9(c)(9) |
| Cholesterol | 300 | mg | DRV | 101.9(c)(9) |
| Sodium | 2300 | mg | DRV | 101.9(c)(9) |
| Total carbohydrate | 275 | g | DRV | 101.9(c)(9) |
| Dietary fiber | 28 | g | DRV | 101.9(c)(9) |
| Added sugars | 50 | g | DRV | 101.9(c)(9) |
| Protein | 50 | g | DRV | 101.9(c)(9) |
| Vitamin D | 20 | mcg | RDI | 101.9(c)(8)(iv) |
| Calcium | 1300 | mg | RDI | 101.9(c)(8)(iv) |
| Iron | 18 | mg | RDI | 101.9(c)(8)(iv) |
| Potassium | 4700 | mg | RDI | 101.9(c)(8)(iv) |
| Vitamin A | 900 | mcg RAE | RDI | 101.9(c)(8)(iv) |
| Vitamin C | 90 | mg | RDI | 101.9(c)(8)(iv) |
| Vitamin E | 15 | mg | RDI | 101.9(c)(8)(iv) |
| Vitamin K | 120 | mcg | RDI | 101.9(c)(8)(iv) |
| Thiamin | 1.2 | mg | RDI | 101.9(c)(8)(iv) |
| Riboflavin | 1.3 | mg | RDI | 101.9(c)(8)(iv) |
| Niacin | 16 | mg NE | RDI | 101.9(c)(8)(iv) |
| Vitamin B6 | 1.7 | mg | RDI | 101.9(c)(8)(iv) |
| Folate | 400 | mcg DFE | RDI | 101.9(c)(8)(iv) |
| Vitamin B12 | 2.4 | mcg | RDI | 101.9(c)(8)(iv) |
| Biotin | 30 | mcg | RDI | 101.9(c)(8)(iv) |
| Pantothenic acid | 5 | mg | RDI | 101.9(c)(8)(iv) |
| Phosphorus | 1250 | mg | RDI | 101.9(c)(8)(iv) |
| Iodine | 150 | mcg | RDI | 101.9(c)(8)(iv) |
| Magnesium | 420 | mg | RDI | 101.9(c)(8)(iv) |
| Zinc | 11 | mg | RDI | 101.9(c)(8)(iv) |
| Selenium | 55 | mcg | RDI | 101.9(c)(8)(iv) |
| Copper | 0.9 | mg | RDI | 101.9(c)(8)(iv) |
| Manganese | 2.3 | mg | RDI | 101.9(c)(8)(iv) |
| Chromium | 35 | mcg | RDI | 101.9(c)(8)(iv) |
| Molybdenum | 45 | mcg | RDI | 101.9(c)(8)(iv) |
| Chloride | 2300 | mg | RDI | 101.9(c)(8)(iv) |
| Choline | 550 | mg | RDI | 101.9(c)(8)(iv) |

> **Vitamin D correction:** the Excel carried `0.2` (stale/ambiguous). The config uses **20 mcg (= 800 IU)** per 101.9(c)(8)(iv). This override is **logged in the audit trail as a corrected stale constant**, per your instruction.

> **Mandatory vs. voluntary (FLAG 2 — full panel locked).** The **15 mandatory** declarations per 101.9(c) are: calories, total fat, saturated fat, trans fat, cholesterol, sodium, total carbohydrate, dietary fiber, total sugars, added sugars, protein, vitamin D, calcium, iron, potassium. All other vitamins/minerals above are **voluntary** (101.9(c)(8)(ii)) — declared only when added or claimed (for the fortified gummy family, the fortified actives qualify). The engine emits the full mandatory set for **every** product; the Excel's reduced set is **not** preserved.

### 4.2 Rounding rules (deterministic — replaces human judgment)

| Nutrient(s) | Rule | Citation |
|---|---|---|
| **Calories** | `<5` → 0; `≤50` → nearest **5**; `>50` → nearest **10** | 101.9(c)(1) |
| **Total fat, Sat fat, Trans fat** | `<0.5 g` → 0; `<5 g` → nearest **0.5 g**; `≥5 g` → nearest **1 g** | 101.9(c)(2), (c)(2)(i), (c)(2)(ii) |
| **Cholesterol** | `<2 mg` → 0 (or omit); `2–5 mg` → "less than 5 mg"; `>5 mg` → nearest **5 mg** | 101.9(c)(3) |
| **Sodium** | `<5 mg` → 0; `5–140 mg` → nearest **5 mg**; `>140 mg` → nearest **10 mg** | 101.9(c)(4) |
| **Total carb, Dietary fiber, Soluble/Insoluble fiber, Total sugars, Added sugars, Sugar alcohol, Protein** | `<0.5 g` → 0; `<1 g` → "less than 1 g"; `≥1 g` → nearest **1 g** | 101.9(c)(6), (c)(6)(i)(A/B), (c)(6)(ii), (c)(6)(iii), (c)(6)(iv), (c)(7) |
| **Vitamins & minerals — %DV** | `<2%` → 0/asterisk; `≤10%` → nearest **2%**; `>10–50%` → nearest **5%**; `>50%` → nearest **10%** | 101.9(c)(8)(iii) |
| **Vitamins & minerals — quantitative amount** | amount in the unit & significance of the RDI table; trailing zeros after decimals may drop | 101.9(c)(8)(iii)+(iv) |

**Rounding discipline:** round **only at the final output stage**. All intermediate stages (recipe sum, process loss, overage, decay, %DV ratio) carry **full floating-point precision**. Rounding lives in its own dedicated, unit-tested module (`rounding.ts`), separate from the engine and from the region config.

### 4.3 Calorie methods (selectable; factors applied to actual grams **before** rounding)

| Method | Definition | Citation | v1 status |
|---|---|---|---|
| **A** | Specific Atwater factors (USDA Handbook 74, table 13) | 101.9(c)(1)(i)(A) | **Stub** — "not implemented" flag |
| **B** | General **4 / 4 / 9** for protein / total carb / total fat | 101.9(c)(1)(i)(B) | **Supported** (switchable) |
| **C** | 4 × protein + 4 × (total carb **− non-digestible carb − sugar alcohol**) + 9 × fat + **2 × soluble non-digestible carb** + sugar-alcohol factors per (F) | 101.9(c)(1)(i)(C) | **Default** |
| **D** | FDA-approved specific food factors (parts 172/184) | 101.9(c)(1)(i)(D) | **Stub** |
| **E** | Bomb calorimetry − 1.25 cal/g protein | 101.9(c)(1)(i)(E) | **Stub** |
| **F** | Sugar-alcohol factors (isomalt 2.0, lactitol 2.0, xylitol 2.4, maltitol 2.1, sorbitol 2.6, HSH 3.0, mannitol 1.6, erythritol 0) | 101.9(c)(1)(i)(F) | Used **within** C/B when sugar alcohols present |

Stubbed methods return a result flagged `notImplemented: true` so the UI can disable them without crashing.

> **Calorie note — psyllium husk is FDA-recognized dietary fiber** under 101.9(c)(6)(i), so under method C its non-digestible carbohydrate is removed from the 4 cal/g term and its **soluble** portion is counted at 2 cal/g. This is exactly why method C diverges sharply from the Excel — see §10.1.

> **Method C hard validation (FLAG 1 — locked).** Method C *requires* a soluble-vs-insoluble fiber split for every fiber-bearing ingredient. If C is selected and any such ingredient lacks that split, the engine **blocks the calculation** (no silent default of fiber into one bucket) and returns a blocking flag naming the exact ingredient(s) and the input needed. C remains the **default** because, for a sugar- and fiber-heavy fortified gummy, method B's general 4-4-9 systematically *overstates* calories; C is the more accurate, more defensible declaration. The UI shows **B vs C** side-by-side with a toggle, and the audit trail logs the method used **and the alternate's value** (e.g. "25 cal via C; B would declare 40 cal").

### 4.4 Class / compliance rules

| Class | Definition | Compliance floor | Citation |
|---|---|---|---|
| **Class I** | Added nutrients in fortified/fabricated foods | label value must be ≥ **100%** at end of shelf life | 101.9(g)(3)(i), (g)(4)(i) |
| **Class II** | Naturally occurring (indigenous) nutrients | ≥ **80%** | 101.9(g)(3)(ii), (g)(4)(ii) |
| **Third group** | Calories, total/added sugars, total/sat/trans fat, cholesterol, sodium | misbranded if **> 120%** of label | 101.9(g)(5) |
| — | Reasonable excess acceptable within cGMP | — | 101.9(g)(6) |

A nutrient's `source` (§3) selects its class → its compliance floor. The overage **percentage itself is a required user input with no default** (FLAG 3, §6.2) — the class only sets the floor the end-of-shelf-life value is checked against.

---

## 5. Recipe engine (Excel parity — the part that "ain't broke")

For each nutrient, per serving:

```
amountPerServing(nutrient)
  = Σ over recipe lines [ ingredient.per100g(nutrient) × line.percentWW × servingWeightG / 100 ]
```

This is the Excel `Formulation` sheet: `VLOOKUP(name, Ingredients!A:R, col) × (percentWW × D9) / 100`, summed at row 8. **Verified to reproduce the workbook's cached totals to 0.00e+00** (independent recomputation, Step 1 audit).

Calories are computed by the selected **calorie method** (§4.3) from these macro totals — *not* by summing a pre-tabulated per-ingredient calorie column. (The Excel's pre-tabulated "kCal (US Rules)" is preserved as method **B/specific-factor reference data** and used to validate the engine; see §10.1.)

---

## 6. Four-stage nutrient pipeline (new layers)

These three transforms do **not** exist in the Excel. They are added as separate, individually testable steps. All four named values are surfaced in the audit trail.

```
 (raw recipe sum)
        │  × (1 − processLossFrac)          ← manufacturing loss   [OH-234 §1.2 ΔY]
        ▼
  AS-FORMULATED  ───────────────────────────────────────────────┐
        │  ÷ (1 + overageFrac)              ← OH-234 cushion       │ audit
        ▼                                                          │ trail
  AS-DECLARED (label claim, pre-rounding)                         │ shows
        │  × (1 − shelfLifeDecayFrac)       ← stability decay      │ all 4
        ▼                                                          │
  END-OF-SHELF-LIFE  ────────────────────────────────────────────┘
        │
        └─ compliance check: END-OF-SHELF-LIFE ≥ floor × AS-DECLARED
                              (Class I floor 1.00 / Class II floor 0.80)
```

### 6.1 Stage 1 — Process loss → **as-formulated**
`asFormulated = rawRecipeSum × (1 − processLossFrac)`. Default `processLossFrac = 0` with a `processLossAssumed: false` flag until a real manufacturing-loss value is supplied. Maps to OH-234's processing-loss term.

### 6.2 Stage 2 — Overage → **as-declared** (declare-down — LOCKED, FLAG 3)
The declared label claim is the as-formulated amount with the OH-234 cushion removed:

```
asDeclared = asFormulated ÷ (1 + overageFrac)
```

**Declare-down is confirmed:** we formulate high and declare low; the end-of-shelf-life value must still meet the *declared* value at the class tolerance (100% Class I, 80% Class II).

> **No invented overage default (FLAG 3 — locked).** `overageFrac` has **no default value**. It is a **required user input**. If a calculation is attempted without it, the engine returns a blocking flag — **"OH-234 default not specified — user input required"** — and emits no label. Real overage percentages are supplied later from a stability-data source; the engine never fabricates them.

### 6.3 Stage 3 — Shelf-life decay → **end-of-shelf-life**
`endOfShelfLife = asFormulated × (1 − shelfLifeDecayFrac)`. Default `0`, flagged until a stability value is supplied. Like overage, no decay rate is fabricated; it is supplied later from stability data.

### 6.4 %DV
`pctDV = asDeclared / DV × 100`, computed on the **unrounded** as-declared value, then the %DV is rounded per 101.9(c)(8)(iii) (vit/min) or shown as `round(amount)/DV` for macros per the panel format in 101.9(d).

---

## 7. Outputs (data model)

```ts
interface NutrientResult {
  nutrientId: NutrientId;
  unit: string;
  // four pipeline stages — full precision
  raw: number;
  asFormulated: number;
  asDeclared: number;
  endOfShelfLife: number;
  // label-ready
  declaredAmountRounded: number | string; // e.g. 25, "less than 1 g"
  pctDV: number | null;                   // unrounded
  pctDVRounded: number | null;            // per 101.9(c)(8)(iii)
  // governance
  source: "added" | "naturally_occurring";
  complianceClass: "I" | "II" | "thirdGroup";
  complianceFloorPct: number;             // 100 | 80 | n/a
  meetsCompliance: boolean;               // endOfShelfLife ≥ floor × asDeclared
  citations: string[];                    // e.g. ["101.9(c)(6)","101.9(c)(9)"]
  flags: string[];
}

interface NutritionPanel {
  servingWeightG: number;
  servingsPerContainer?: number;
  calories: { value: number; method: string; methodImplemented: boolean; citation: string };
  nutrients: NutrientResult[];
  footnotes: string[];        // "Not a significant source of…", "Contains <2%…"
}

interface AuditEntry { step: string; detail: string; citation?: string; }

interface CalcResponse {
  panel: NutritionPanel;
  auditTrail: AuditEntry[];   // OH-222: every transform + corrected-constant log
  validationFlags: string[];  // model-boundary / assumption warnings
  prototypeDisclaimer: string;// always present
}
```

The audit trail (OH-222 expectation) logs: each pipeline transform with its factor; the Vitamin D `0.2 → 20 mcg` correction tagged "corrected stale constant"; the calorie **method used and the alternate method's value** (FLAG 1); the **structural finding** that the source Excel omitted fat / saturated fat / trans fat / cholesterol columns, surfaced back to the workbook owners (FLAG 2); every per-ingredient **completeness resolution** (known / zero-confirmed / unknown) and any **blocking** state; the **"OH-234 default not specified"** state when overage is missing (FLAG 3); and any compliance failure.

---

## 8. Module architecture (preview — locked in Step 4)

Pure functions, no UI coupling. Separation enforced:

```
src/nutrition/
  engine/
    recipe.ts          // §5 recipe sum (Excel parity)
    calories.ts        // §4.3 methods A–F
    pipeline.ts        // §6 process loss → overage → decay
    percentDV.ts       // §6.4
  rounding/
    rounding.ts        // §4.2 ONLY — deterministic, dedicated, unit-tested
  config/
    regions/us.ts      // §4.1, §4.2, §4.4 constants (region-swappable)
    nutrients.ts       // canonical NutrientId, units, mandatory/voluntary, class defaults
  overage/
    overage.ts         // §6.2/6.3 OH-234 math — isolated from rounding & region
  audit/
    audit.ts           // §7 OH-222 audit trail builder
  types.ts
  index.ts             // calc(request): CalcResponse  ← single entry point
```

- **Rounding** is its own module (your hard rule).
- **Overage** is its own module, separate from rounding and region config (your hard rule).
- **Region rules** come from config, not code (your hard rule).
- Unit tests reproduce the Excel example to 0.00e+00 (§12).

---

## 9. UI-readiness (Step 3 mapping)

The model is UI-ready and mirrors the packaging module's three-panel layout:

| Packaging module | Nutrition module |
|---|---|
| Left `InputPanel` (bottle/gummy params) | **Left:** recipe builder — ingredients, %w/w, serving weight, calorie method, per-nutrient source/loss/overage/decay |
| Center bottle visualization | **Center:** live **FDA-style Nutrition Facts label** (the visual anchor), re-rendering as inputs change |
| Right `OutputPanel` + `MetricCard`s | **Right:** metric cards (calories, key %DVs, compliance status) + audit-trail/flags accordion |

`CalcResponse` is a plain serializable object → drives React state directly; `NutritionPanel.nutrients[]` maps 1:1 to label rows; `pctDVRounded` and `meetsCompliance` drive status colors (never color alone — pair with icon/text). A `NutritionApp.tsx` stub already exists and will be replaced by this engine + a `NutritionFactsLabel.tsx` component.

---

## 10. Key divergences & decisions to confirm

### 10.1 ✅ RESOLVED — Calorie method C is the default (B shown alongside)
For the example psyllium product (per serving), measured from the audited recipe totals:

| Method | Unrounded kcal | **Label calories** |
|---|---|---|
| Excel pre-tabulated "kCal (US Rules)" | 38.37 | **40** |
| **B** (4/4/9) | 38.50 | **40** |
| **C** (fiber-adjusted, default) | **25.89** | **25** |

**Decision (locked):** keep **method C** as default. The −32.5% delta is the *legitimate regulatory benefit* of correctly accounting for non-digestible carbs — method B systematically overstates calories for a sugar-/fiber-heavy gummy, so C is the more accurate, more defensible declaration. Because the historical Excel is effectively method B, the UI **surfaces the delta prominently** (B vs C side-by-side in the center label with a toggle), and the audit trail records the method used and what the alternate would declare. A hard validation **blocks** method C when an ingredient lacks a soluble/insoluble fiber split (§4.3).

### 10.2 ✅ RESOLVED — Full mandatory panel (Excel's reduced set dropped)
**Decision (locked):** extend to the **full mandatory panel** for every product. Fat, saturated fat, trans fat, and cholesterol become **first-class ingredient columns**. They default to **0 only when the user confirms** a genuine zero (e.g. a vitamin/mineral premix); an **unknown** value flags the row **incomplete** and **blocks panel emission** until resolved. Mandatory set per 101.9(c): calories, total fat, saturated fat, trans fat, cholesterol, sodium, total carbohydrate, dietary fiber, total sugars, added sugars, protein, vitamin D, calcium, iron, potassium. Items voluntary under 101.9(c)(8)(ii) stay voluntary. The Excel's missing-column gap is **logged in the audit trail as a structural finding** for the workbook owners.

### 10.3 ✅ RESOLVED — Pipeline order & declare-down locked
**Decision (locked):** raw %w/w → process loss → as-formulated → **declare-down** overage (`asDeclared = asFormulated ÷ (1 + overage%)`) → as-declared → shelf-life decay → end-of-shelf-life, which must meet the class floor (100% I / 80% II). Overage and decay percentages are **required user inputs with no fabricated defaults**; a missing overage raises **"OH-234 default not specified — user input required"** and blocks the label (§6.2).

### 10.4 Soluble-fiber heuristic
The Excel `Formulation` computes soluble fiber = 4.66 g from ingredient data, but a `Nutrition`-sheet *note* used a stale 70%-of-fiber heuristic (≈2.4 g) referencing an out-of-date 3.4 g psyllium dose. The engine uses the **computed 4.66 g** (ingredient-data path), and flags the heuristic as a non-FDA product assumption. Confirm.

---

## 11. Edge cases

**Handled:** nutrient `<` declaration threshold → 0 / "less than" text / footnote; `<2%` DV vit/min → asterisk path; calorie `<5` → 0; stubbed calorie methods → `notImplemented` flag (no crash); %w/w not summing to 1.0 → normalization warning flag (not silent fix); missing ingredient nutrient → treated as 0 + flag; compliance failure → `meetsCompliance:false` + audit entry; corrected Vit D constant → audit log.

**Not handled in v1 (flagged):** non-US regions; dual-column (per-serving + per-container) beyond a simple multiplier; protein %DV PDCAAS correction (101.9(c)(7)(ii)); added-sugars fermentation/browning recordkeeping (101.9(c)(6)(iii)); the `DRAFT` analytical QC method; automatic Atwater (method A/D) tables.

---

## 12. Worked example (acceptance test — reproduces the Excel)

Example product "Irovy Orange" psyllium powder, serving from `Formulation!D9`. Engine must reproduce these audited recipe totals to **0.00e+00**:

| Nutrient | Per serving (full precision) |
|---|---|
| Protein | 0.14007 g |
| Total carbohydrate | 9.48469 g |
| Dietary fiber | 5.48243 g |
| Soluble fiber | 4.66006 g |
| Total sugars | 0.20183 g |
| Added sugars | 0.08363 g |
| Calories (method B / Excel) | 38.37–38.50 kcal → **40** |
| Calories (method C, default) | 25.89 kcal → **25** |

Vitamins/minerals follow the same VLOOKUP×dose path and are validated the same way. The unit-test suite asserts (a) recipe parity to the workbook, (b) each rounding rule against 101.9 worked cases, and (c) compliance-floor logic per class.

---

## 13. Open questions

**Resolved (locked this round):**
1. ✅ Calorie default = **C**, with B shown alongside + method-C fiber-split validation (§10.1).
2. ✅ Nutrient set = **full mandatory panel**; fat/sat/trans/cholesterol first-class; unknown blocks emission (§10.2).
3. ✅ Pipeline order + **declare-down** overage; overage/decay are required inputs, no fabricated defaults (§10.3).

**Resolved (locked Step 3):**
4. ✅ **Soluble fiber** — engine uses the **computed** value from each ingredient's soluble/insoluble split; the 70% heuristic is **dropped entirely**. Audit logs the value as computed-from-breakdown. Missing split → method-C hard block (never falls back to the heuristic).
5. ✅ **Serving display** — **single per-serving column** for v1; renderer architected so a per-container column can be added later without refactor (not exposed in v1).

---

*Step 2 spec re-issued with FLAGS 1–3 locked; all open questions resolved. Step 3 UI design in `SPEC_UI_Design.md`; Step 4 architecture in `SPEC_Architecture.md`.*
