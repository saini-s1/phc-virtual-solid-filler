---
name: surrogate-model-dashboard
description: Use this skill when implementing or modifying the DEM surrogate model mockup, prediction logic, product/bottle presets, charts, or model explanation for the PHC Modeling Suite. Covers surrogate math structure, mock coefficients, boundary checks, preset management, output calculations, and model-accuracy disclaimers. USE FOR: adding/updating prediction functions, defining product/bottle/gummy presets, implementing comparison logic (Current vs Dory vs Emerald City), boundary validation, output formatting, status rules, or model boundary warnings. DO NOT USE FOR: UI/component rendering, Framer Motion animation, or styling (use pg-professional-ui instead).
---

# Surrogate Model Dashboard Skill — PHC Modeling Suite

This skill covers the prediction engine and data modeling for the PHC Modeling Suite's Virtual Solid Filler module. It demonstrates how a fast surrogate model derived from DEM simulation could predict bottle fill height, slack fill, and headspace for solid product forms.

## Product scope

The mockup predicts fill outcomes for PHC solid products (gummies) filled into standard bottles. It supports multiple product/bottle combinations and shows how predictions differ across suppliers or formulation changes.

## Input parameters

All prediction inputs fall into these categories:

### Product form
- Product type (e.g., "Gummy")
- Gummy preset (e.g., standard, large, small) or custom dimensions

### Gummy dimensions & properties
- `R1` — top cap radius (mm)
- `H1` — top cap height (mm)
- `R2` — body radius (mm)
- `H2` — body height (mm)
- Calculated gummy volume (mm³)
- Gummy mass (g)

### Bottle geometry
- Bottle preset (e.g., round bottle, narrow bottle)
- Bottle ID (internal diameter, mm)
- Bottle volume (mL)
- Shoulder height (mm) — where bottle neck begins
- Neck/top height (mm) — height from shoulder to bottle mouth

### Fill parameters
- Desired fill count (number of gummies)
- Packing efficiency (%) — placeholder for real bulk density assumptions

## Output metrics

All outputs are calculated by `src/utils/surrogateModel.ts`:

- **Fill height** (mm) — distance from bottle bottom to top of packed gummies
- **Slack from top** (mm) — headspace between gummy stack and bottle top
- **Slack from shoulder** (mm) — headspace between gummy stack and shoulder
- **% slack fill from top** — percentage of bottle volume above fill
- **% slack fill from shoulder** — percentage of shoulder volume above fill
- **Status** — one of:
  - `"Good"` — fill is within acceptable range (e.g., 5–15% slack from top)
  - `"Watchout"` — fill approaches limits (e.g., 15–20% slack)
  - `"Overfilled"` — too little headspace (< 5% slack)
  - `"Outside model range"` — inputs exceed preset boundaries; prediction unreliable

## Prediction logic structure

### Location
- All prediction math lives in `src/utils/surrogateModel.ts`.
- Mock product/bottle presets live in `src/data/` (separate files for gummies, bottles, suppliers).
- Comparison logic (Current vs Dory vs Emerald City) is coordinated in components or a dedicated hook.

### Placeholder coefficients
- Mark all placeholder calculations with a comment explaining where a real DEM coefficient would go.
- Example:
  ```typescript
  // TODO: replace with DEM-trained packing coefficient (currently 0.65)
  const packingFactor = 0.65;
  ```

### Model boundaries
- Define min/max ranges for each input (e.g., gummy R1: 2–8 mm, bottle volume: 100–500 mL).
- Return `"Outside model range"` status if any input exceeds boundaries.
- Include boundary data in the presets; fetch at runtime.

## Comparison support

Support side-by-side prediction comparison across scenarios:

- **Current** — baseline product & bottle
- **Dory** — alternative supplier or formulation
- **Emerald City** — another variant

Each scenario has its own gummy, bottle, and packing preset. The UI displays predictions for all three, highlighting differences.

## Output formatting & status rules

- Fill height: integer mm, or float to 1 decimal place.
- Slack values: integer mm.
- Percentages: 1 decimal place (e.g., "12.3%").
- Status determination:
  - Measure slack-from-top percentage.
  - If < 5% → `"Overfilled"`
  - If 5–15% → `"Good"`
  - If 15–20% → `"Watchout"`
  - If > 20% → `"Good"` (excess headspace is not a failure)
  - Or, if inputs out of bounds → `"Outside model range"`

## Disclaimers & model accuracy

- **Always** label predictions as **"prototype surrogate prediction"** in UI.
- Include a disclaimer that the math is a placeholder and not validated.
- When status is `"Outside model range"`, explain why (e.g., "Gummy radius exceeds training boundary").
- Suggest to users that real DEM-validated coefficients should replace all placeholder values.

## When invoked

1. Confirm the change is modeling/prediction scoped (logic, presets, boundary checks, output calculations, comparison rules).
2. Implement in `src/utils/surrogateModel.ts` or `src/data/` — keep concerns separated.
3. Use clear, testable function signatures; document parameter units.
4. Add boundary checks and return status alongside predictions.
5. Comment all placeholder math with `TODO: replace with DEM coefficient`.
6. If UI integration is needed, delegate rendering/styling to `pg-professional-ui` skill.
