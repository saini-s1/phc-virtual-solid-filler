# Step 1 — Reverse-Engineering Report: `Nutrition Example Calculator.xlsx`

> Source of truth workbook. FDA citations refer to **`GuidanceDocuments_FDA Labeling 1 (1).pdf`**
> = *FDA "Guidance for Industry: Nutrition Labeling Manual — A Guide for Developing and
> Using Data Bases"* (59 pages). Page numbers below are that PDF's printed page numbers.

## 0. Macro verdict (verified, not assumed)
- File is a plain **`.xlsx`** (Office Open XML). Archive contents inspected directly:
  there is **NO `vbaProject.bin`** and no `xl/macrosheets/` part.
- **Conclusion: the workbook contains ZERO VBA macros. It is 100% formula-driven.**
  Despite being described as "macro-enabled," it is not — and even if renamed `.xlsm`,
  no macro storage exists inside it.

## 1. Tabs (5 sheets, all visible)
| # | Sheet | Purpose |
|---|-------|---------|
| 1 | `DRAFT from Cleanse work` | **Statistical / analytical method.** Raw lab (ICP) potassium results for psyllium powder (rows 2–22), then the FDA *data-base* label-value method: mean, stdev, t-based one-sided 95% prediction interval, and Class I / Class II / Third Group predicted values. Bottom rows (A26–A38) transcribe the FDA manual's formulas as documentation. |
| 2 | `Ingredient_Product_Calculator` | **Stub / unfinished.** Only a header row (`C20:P20`) listing nutrient columns. No data, no formulas. Appears to be an intended cleaner front-end that was never built. |
| 3 | `Ingredients` | **Nutrient reference database.** Per-ingredient nutrient content per 100 g. 7 real ingredients (rows 3–9: Psyllium, Maltodextrin, Citric Acid, Stevia, Flavor, Paprika, Tumeric) + a sentinel `xxxx` at row 614. Columns E–R = the 14 tracked nutrients. |
| 4 | `Formulation` | **Recipe engine.** Takes %w/w per ingredient + a dose weight, looks up each nutrient from `Ingredients`, scales to the dose, and sums per-serving totals (row 8). This is the FDA Chapter III "ingredient/recipe data base" approach (p.51). |
| 5 | `Nutrition` | **Label worksheet.** Pulls the per-serving totals from `Formulation`, divides by RDI/DRV to get %DV, displays the FDA rounding rules as text, and records a **manually chosen** declared value per nutrient in "Reco." cells. |

**Inputs are NOT only gummies** — verified. The worked example is a **powdered drink/sachet**
("Psyllium Sugar Free Powder", product "Irovy Orange", dose 10.68 g). This is a psyllium fiber
powder, not a gummy. The engine is ingredient-generic; gummies would just be another formulation.

## 2. Named ranges, input cells, output cells
- **Named ranges: NONE.** The workbook defines zero defined names. All references are raw
  A1-style (e.g. `Ingredients!$A:$R`). This matters for our port: no symbolic names to preserve.
- **Input cells** (color-coded yellow/orange "edit" + blue "pick list", per the legend in
  `Formulation!B2:B4`):
  - `Formulation!B7` product name, `C7` GCAS code.
  - `Formulation!D9` = **dose weight (g)** = 10.68.
  - `Formulation!B14:B20` = ingredient names (blue pick-list, must match `Ingredients!A`).
  - `Formulation!C14:C20` = **%w/w per ingredient** (some typed, some entered as small formulas
    e.g. `=6.5267/10.68`).
  - `Nutrition!C7,D7,C14,D14,E14,E21,E29,F29` = **RDI/DV reference values** (typed by user).
  - `Nutrition` "Reco." cells (`C10,D10,E10,C17,D17,E17,C24,...`) = **hand-entered declared label
    values** (e.g. "10 g", "55 mg", "<2%", "4 IU").
  - `Ingredients!E3:R9` = per-100g nutrient data per ingredient (reference inputs).
- **Output / result cells** (green):
  - `Formulation!C8:R8` = per-serving nutrient totals (and %w/w sum check `C8`≈1.0).
  - `Formulation!D14:R20` = per-ingredient scaled nutrient contributions.
  - `Nutrition` totals rows (`C6:E6`, `C13:E13`, `C20:F20`, `C28:F28`) and %RDI rows
    (`C8,D8`, `C15:E15`, `E22`, `E30,F30`).
  - `DRAFT` block `J33:T35` = Class I/II/Third predicted & declared values.

## 3. Formulas grouped by pattern
**P1 — per-100g → per-dose scaling (lab sheet), `DRAFT N/P/Q cols`**
`=M*J/100` (mg per dose from mg/100g × g/dose), `=M*O` (total g = g/dose × doses),
`=P*J/100`. Pure unit scaling.

**P2 — descriptive statistics (`DRAFT` J23:Q28)**
`=COUNT(...)`, `=AVERAGE(...)`, `=STDEV(...)`, `df = n−1` (`=J23-1`),
`t = T.INV(0.95, df)` (`=_xlfn.T.INV(0.95,J28)`), `k=12`, `composite size=12`.

**P3 — FDA predicted-value (one-sided 95% prediction interval), `DRAFT J33:Q35`**
- Class I: `mean − t·√(compositeSize/k + 1/n)·s` → `=J24-J26*SQRT(J29/J27+1/J23)*J25`
- Class II: same **× 5/4** → `…*5/4`
- Third Group: `mean + t·√(…)·s` **× 5/6** → `…*5/6`
- Declared selection: Class I/II take the **lower** of predicted vs mean
  (`=IF(N33<N$24,N33,N$24)`); Third takes the **higher** (`=IF(N35>N$24,…)`).

**P4 — recipe lookup & scaling (`Formulation D14:R20`)**
`Dose wt`: `=C14*$D$9` (%w/w × dose weight).
Nutrient: `=VLOOKUP($B14, Ingredients!$A:$R, <col>, FALSE) * $D14/100`
(per-100g value × grams-in-dose / 100). One row per ingredient, columns 5–18.

**P5 — per-serving totals (`Formulation row 8`)** `=SUM(<col>14:20)`; `C8=SUM(C14:C34)` (%w/w check).

**P6 — cross-sheet pulls (`Nutrition`)** `=Formulation!<cell>` for labels and totals.

**P7 — %DV (`Nutrition`)** `=<total>/<RDI>` (e.g. `=C6/C7`, `=D13/D14`, `=E28/E29`).
**No rounding is applied in any formula** — %DV is raw.

## 4. VBA decompile
**None to decompile — no VBA project exists** (see §0). No modules, functions, subroutines,
event handlers, or `Workbook_Open` logic. Nothing is hidden behind macros.

## 5. Data-flow trace (inputs → label)
**Recipe path (the live calculator):**
```
Ingredients!E:R (per-100g nutrient data)  ┐
Formulation!C14:C20 (%w/w)                ├─VLOOKUP×Dose/100→ Formulation!D14:R20
Formulation!D9 (dose wt g) → D14:D20      ┘        │ SUM (P5)
                                                   ▼
                                   Formulation!C8:R8  (per-serving totals)
                                                   │ =Formulation!… (P6)
                                                   ▼
                              Nutrition totals rows ──/RDI(P7)──▶ %DV rows
                                                   │
                              FDA rounding rules (TEXT only) + human judgment
                                                   ▼
                              Nutrition "Reco." cells  = FINAL DECLARED VALUES
```
**Analytical path (parallel, for nutrients backed by lab data, e.g. potassium):**
```
DRAFT lab results J2:J22 → mean/stdev/t (P2) → predicted Class I/II/III (P3)
   → declared = min/max(predicted, mean) → feeds a label claim manually
```
**Critical finding:** the workbook stops at **unrounded** totals and %DV. The final
**rounded, declared label value is entered by a human** into the "Reco." cells — the rounding
rules live as on-screen *text guidance*, not as executable formulas. Some cells literally say
`"need rules"` (`Nutrition!C23,D23`, yellow) and `"make a choice"` (`Nutrition!C17`).

## 6. Hard-coded constants, lookup tables, rounding rules — with FDA citations
### 6a. Rounding rules (text in `Nutrition`; all traceable)
| Rule (as written in workbook) | Nutrients | FDA PDF page |
|---|---|---|
| `<5 cal→0; ≤50→nearest 5; >50→nearest 10` | Calories | **p.45** |
| `<0.5g→0; <1g→"less than 1g"; ≥1g→nearest 1g` | Total carb, dietary fiber, soluble fiber, sugars, added sugars, protein | **p.46** (carb/fiber/protein); soluble fiber/sugars row **p.46** |
| `<5mg→0; 5–140mg→nearest 5mg; >140mg→nearest 10mg` | Sodium, Potassium | **p.45** |
| `≤10% RDI→nearest 2% DV; >10–50%→nearest 5%; >50%→nearest 10%` | Iron, vitamins & minerals | **p.47** |
| `<2% RDI → 0 / "2% if ≥1%" / asterisk / "not a significant source"` | Vitamins & minerals (Vit A, C, D, Ca, Fe) | **p.47** |
| Half-up rounding (2.5–2.99→3; 2.01–2.49→2) | all "nearest 1g" / %DV | **p.47–48** |

### 6b. Statistical constants (analytical method)
| Constant / formula | Value | FDA PDF page |
|---|---|---|
| Class II factor `5/4` (= 1/0.80) | 1.25 | **p.8, p.39, p.57** (Class II ≥80%; worked ×1.25) |
| Third Group factor `5/6` (= 1/1.20) | 0.8333 | **p.8, p.56** (Third ≤120%; worked ×0.8333) |
| One-sided 95% prediction interval (mean ∓ t·√(comp/k+1/n)·s) | — | **p.31, p.39, p.56–57** |
| `k = 12` future samples; `composite size = 12` (ratio→1) | 12/12 | **p.30 text / DRAFT A30–A32** ("12 recommended") |
| `t = T.INV(0.95, df)`, `df = n−1` | — | **p.31** |
| Select lower (Class I/II) / higher (Third) of mean vs predicted | — | **p.39** |

### 6c. RDI / DV reference values (`Nutrition`) — ⚠ CANNOT be cited to this PDF
| Nutrient | Value in Excel | DV in provided FDA PDF | Status |
|---|---|---|---|
| Total carbohydrate | 275 g | 300 g (old) | **MISMATCH — Excel = post-2016 value** |
| Dietary fiber | 28 g | 25 g (old) | **MISMATCH — updated value** |
| Iron | 18 mg | 18 mg | matches (p.43) |
| Potassium | 4700 mg | 3500 mg (p.57) | **MISMATCH — updated value** |
| Calcium | 1300 mg | 1000 mg | **MISMATCH — updated value** |
| Added sugars | 50 g | *not in PDF* | **Post-2016 nutrient, absent from PDF** |
| Sodium | 2300 mg | 2400 mg (p.56) | **MISMATCH — updated value** |
| Vitamin D | 0.2 (units unclear) | *not in this form* | **AMBIGUOUS — see §7** |

> The provided FDA PDF predates the 2016 Nutrition Facts overhaul (its examples use sodium
> DV 2400, potassium 3500, vit C 60). The Excel uses the **current** (2016 rule) DVs. Therefore
> the **DV reference numbers cannot be justified from the PDF you gave me** — they trace to the
> current **21 CFR 101.9(c)(8)(iv)/(9)**, which is not in this document. **Flagged per hard rules.**

### 6d. Calorie values — method not in the workbook OR the PDF
- `Ingredients` column E `"kCal (US Rules)"` holds **pre-computed per-ingredient calorie values**
  (e.g. Psyllium 360.7, Maltodextrin 378). The workbook **does not** derive calories from
  macronutrients (no 4/4/9 Atwater math anywhere).
- The FDA's **multiple calorie methods** (general factors 4/4/9, Atwater specific factors, etc.)
  live in **21 CFR 101.9(c)(1)(i)** — **NOT present in the provided PDF** and **not implemented
  in the Excel**. **Flagged.** We'll need a calorie-method decision in Step 2.

### 6e. Other hard-coded numbers
- `Formulation!D9 = 10.68` (dose weight g) — input, product-specific, not a regulatory constant.
- `Formulation!C14 = 6.5267/10.68`, `C16 = (0.2176+0.387)/10.68` — these encode raw gram amounts
  divided by dose weight to back into %w/w. Product data, not regulatory.

## 7. Ambiguities / things the Excel does that the FDA guidance does not clearly require
1. **Rounding is not executed** — it's human judgment in "Reco." cells, with notes like
   `"make a choice"` and `"need rules"`. Our build must turn this into deterministic code, which
   means we must *choose* defaults the Excel left to a person. **Will surface each as a decision.**
2. **Two parallel methodologies coexist** (analytical prediction-interval on `DRAFT` vs. recipe
   lookup on `Formulation`). The FDA allows both, but the Excel doesn't define *when* to use which.
   For the live calculator the **recipe path** is clearly the engine; the `DRAFT` sheet only has
   potassium lab data. **Confirm we model the recipe path as primary.**
3. **Soluble-fiber assumption** (`Nutrition!E9`): "psyllium is 70% soluble fiber (3.4g×0.70=2.4g)."
   This 70% factor is a **product-specific assumption, not an FDA rule** — cannot be cited to the
   PDF. **Flagged.**
4. **Class label mismatch on the `Nutrition` sheet**: it labels carbohydrate/fiber, iron,
   potassium, calcium, vit A/C/D as **"Class II – NLT 80%"**, but FDA p.8 classifies *added*
   vitamins/minerals as **Class I (≥100%)** and only *naturally occurring* ones as Class II.
   The Excel assumes everything here is naturally occurring/indigenous. **This is a real
   classification assumption to confirm — it changes the compliance floor (and links to OH-234).**
5. **Vitamin D RDI = 0.2** (`Nutrition!E21`) with unclear units. Current Vit D DV is **20 µg**.
   0.2 doesn't match mg (0.02) or µg (20). **Ambiguous — needs the intended unit before coding.**
6. **No process-loss factor** is applied anywhere in the recipe math. This matches your note that
   process loss is captured separately — but it means the Excel's totals are **as-formulated raw**,
   with no loss adjustment. **Confirms process loss must be an added input layer (Step 2).**
7. **No overage applied** in the recipe sheets. The `5/4` and `5/6` factors on `DRAFT` are FDA
   *compliance* factors (tied to 80%/120%), **not** OH-234 formulated overages. So the Excel does
   **not** currently implement OH-234 overage math. (Full detail belongs to Step D.)
8. **`Ingredient_Product_Calculator` is empty** — a stub. Easy to misread as the engine; it is not.
9. **Header typos** carried in data (`"Vitanmin C"`, `"Tumeric"`). Cosmetic; note so we don't
   propagate them into the UI.

## 8. Summary verdict
- **Formula-driven, no macros.** Engine = `Ingredients` (reference) → `Formulation` (recipe
  lookup × dose) → `Nutrition` (%DV + manual rounding). `DRAFT` = optional analytical method.
- **Everything computational is traceable**, but the **final rounding step is manual** and several
  **DV constants and the calorie method cannot be cited to the provided FDA PDF** (they belong to
  the current 21 CFR 101.9, not this older data-base guidance). These are the items I need
  decisions on before Step 2.
