# PHC Modeling Suite

> **Prototype only.** This is an internal P&G-style suite of two modules that share one app shell: a **DEM Virtual Solid Filler** for predicting bottle fill height and slack-fill / headspace for PHC solid product forms (starting with gummies), and a **Nutrition Calculator** for building compliant nutrition facts panels. The packing-fraction math in the filler module is a **real Gaussian Process surrogate trained on and validated against Aspherix DEM simulations** (see [Where real DEM coefficients connect](#where-real-dem-coefficients-connect) below) — but the suite as a whole is still a prototype **interface**: predictions are only trusted inside the validated design space, and any production decision should be confirmed against a full DEM run.

## Purpose

Two modules, one shell (pick either from the home page):

- **DEM Virtual Solid Filler** — show the future workflow:

  ```
  Product + Bottle inputs  →  DEM design-of-experiments  →  Surrogate model  →  Instant UI prediction  →  Packaging decision
  ```

  Inputs on the left, an animated technical bottle in the center, predicted outputs on the right, and scenario comparison + methodology below.

- **Nutrition Calculator** — build a recipe from ingredients (built-in library + your own saved ones), and get a live-computed, regulation-aware Nutrition Facts panel with rounding/compliance checks.

## Tech stack

- **Vite** + **React 18** + **TypeScript**
- **Tailwind CSS** for the enterprise design system
- **Framer Motion** for the bottle fill animation
- **Recharts** for the comparison chart
- **Lucide React** for icons
- **Express** (`server/`) — small backend serving the built SPA plus a REST API
  for the Nutrition Calculator's shared ingredient library, backed by Azure
  Table Storage in production (see [DEPLOYMENT.md](DEPLOYMENT.md))

## How to run

```bash
# 1. Install Node.js 18+ (https://nodejs.org)
# 2. From the project root:
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

Other scripts:

```bash
npm run build       # production bundle in /dist
npm run server      # Express API only (port 8080), for the ingredient library
npm run dev:full    # Vite + Express together (proxied), for local ingredient-library testing
npm run preview     # serve the production bundle locally
npm run typecheck   # tsc --noEmit
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for deploying to Azure App Service and the
full list of environment variables.

## What is mocked

| Area | What is real | What is mocked |
| --- | --- | --- |
| Product presets | Dory & Emerald City geometry from packaging slides | "Current" is a placeholder using Dory specs |
| Bottle presets | Volume + shoulder/neck from slides where available | Diameter is derived; some neck heights estimated (`estimated: true`) |
| Surrogate math | **Real** — packing fraction φ comes from a Gaussian Process fit to Aspherix DEM data, validated against full-bottle DEM runs (see below) | Outside the validated design space, predictions are extrapolation and are flagged `"Outside model range"` |
| Status thresholds | Sensible defaults for UI behavior | Not tuned against real slack-fill acceptance criteria |
| Comparison chart | Driven by the same surrogate function | Same real math, just swept across presets |

A persistent disclaimer banner is shown at all times and every output card carries a "Prototype surrogate prediction · not validated" line.

## Where real DEM coefficients connect

All prediction logic lives in **[src/packaging/model/surrogateModel.ts](../src/packaging/model/surrogateModel.ts)**, which calls **[src/packaging/model/realSurrogate.ts](../src/packaging/model/realSurrogate.ts)** for the packing fraction — a TypeScript port of the exact Gaussian Process posterior fit to Aspherix DEM simulations (fitted coefficients in `phi_gp.json` / `wall_gp.json`). This is not placeholder math; it's the live, DEM-validated model.

**For the full story of how that model was built — DEM setup, the DOE, why a Gaussian Process, the validation runs, and how it was ported into this app — see [`src/packaging/model/SURROGATE_CREATION_PROCESS.md`](../src/packaging/model/SURROGATE_CREATION_PROCESS.md).** For the reference-level I/O contract, validation table, and retraining instructions, see [`src/packaging/model/INTEGRATION_HANDOFF.md`](../src/packaging/model/INTEGRATION_HANDOFF.md).

```ts
predictFill({
  bottleVolumeMl, shoulderHeightMm, neckHeightMm, bodyDiameterMm,
  gummyVolumeMl, gummyMassG, count, packingEfficiency
}): PredictionResult
```

Remaining gaps between this prototype and a production-ready tool:

1. **Bottle presets are still mocked** — neck heights are estimated for some bottles (`estimated: true` in `bottlePresets.ts`); replace with measured CAD internal heights.
2. **Status thresholds** are sensible UI defaults, not tuned against real slack-fill regulatory thresholds (FDA / EU 21 CFR §100.100, etc.) — tighten before any compliance-facing use.
3. **Coverage is limited to the validated design space** — see the caveats in `INTEGRATION_HANDOFF.md` §7 (λ range, squat/small bottles, DoryNew height sensitivity) before trusting an edge case.

The component layer (`src/packaging/components/*`) reads only from the result shape, so extending the model is non-breaking.

> New to the codebase? Each module has its own developer handoff guide at the
> repo root: **[HANDOFF_PACKAGING.md](../HANDOFF_PACKAGING.md)** (the DEM filler
> — includes app setup + run instructions) and
> **[HANDOFF_NUTRITION.md](../HANDOFF_NUTRITION.md)**. Both map every "I want to
> change X" to the exact file to open.

## Project structure

The app is split into two self-contained modules plus a small shared layer.

```
src/
  App.tsx                     ← top-level router (home / packaging / nutrition)
  main.tsx                    ← react entry point
  index.css                   ← tailwind layers + shared utility classes

  shared/                     ← used by BOTH modules
    Header.tsx                ← top bar + status pills
    HomePage.tsx              ← module-picker landing page
    MetricCard.tsx            ← reusable metric tile
    DisclaimerBanner.tsx      ← amber prototype warning
    icons.tsx                 ← icon shim (custom Bottle icon)

  packaging/                  ← MODULE 01 · DEM Virtual Solid Filler
    PackagingApp.tsx          ← dashboard shell + wiring
    components/
      InputPanel.tsx          ← left: configure scenario
      BottleVisualizer.tsx    ← center: bottle + 3D fill (hero)
      GummyFill3D.tsx         ← three.js live gummy-packing sim
      OutputPanel.tsx         ← right: predicted metrics
      ComparisonChart.tsx     ← compare gummies vs bottles
      WorkflowDiagram.tsx     ← methodology strip (optional)
      RealDataPanel.tsx       ← roadmap cards (optional)
    data/
      productPresets.ts       ← gummy presets (add gummies here)
      bottlePresets.ts        ← bottle presets (add bottles here)
    model/
      surrogateModel.ts       ← ALL prediction math (placeholder)

  nutrition/                  ← MODULE 02 · Nutrition Calculator
    NutritionApp.tsx          ← dashboard shell
    components/               ← recipe input, facts label, worksheet, …
    engine/ + config/ + …     ← pure nutrient calculation engine
    data/ingredientApi.ts     ← fetch client for the server-backed shared ingredient library
    __tests__/                ← vitest suite (98 tests)
    index.ts                  ← engine public API barrel

server/                       ← Express API (serves dist/ + /api/ingredients); see DEPLOYMENT.md

.github/
  copilot-instructions.md
  workflows/
    azure-webapp-deploy.yml
  skills/
    pg-professional-ui/SKILL.md
    surrogate-model-dashboard/SKILL.md
```

## Design principles

- Professional enterprise dashboard — deep blue, slate gray, white, subtle cyan accents.
- Large, presentation-friendly typography (looks good as a PowerPoint screenshot).
- Persistent prototype disclaimers; status uses both color and iconography (never color alone).
- Bottle visual is the hero — silhouette and reference lines update with bottle preset.

## License

P&G internal prototype. Not for external distribution.
