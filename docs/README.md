# PHC Virtual Solid Filler

> **Prototype only.** This is an internal P&G-style UI mockup that demonstrates how DEM simulation outputs could be converted into a fast surrogate model for predicting bottle fill height and slack-fill / headspace for PHC solid product forms (starting with gummies). **All predictions are placeholder math** — replace with trained DEM coefficients before any technical use.

## Purpose

Show the future workflow:

```
Product + Bottle inputs  →  DEM design-of-experiments  →  Surrogate model  →  Instant UI prediction  →  Packaging decision
```

The mockup makes the vision tangible in under 10 seconds: inputs on the left, an animated technical bottle in the center, predicted outputs on the right, and scenario comparison + methodology below.

## Tech stack

- **Vite** + **React 18** + **TypeScript**
- **Tailwind CSS** for the enterprise design system
- **Framer Motion** for the bottle fill animation
- **Recharts** for the comparison chart
- **Lucide React** for icons

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
npm run preview     # serve the production bundle locally
npm run typecheck   # tsc --noEmit
```

## What is mocked

| Area | What is real | What is mocked |
| --- | --- | --- |
| Product presets | Dory & Emerald City geometry from packaging slides | "Current" is a placeholder using Dory specs |
| Bottle presets | Volume + shoulder/neck from slides where available | Diameter is derived; some neck heights estimated (`estimated: true`) |
| Surrogate math | Structure only | Every coefficient is placeholder — see `// TODO` markers |
| Status thresholds | Sensible defaults for UI behavior | Not tuned against real slack-fill acceptance criteria |
| Comparison chart | Driven by the same surrogate function | Same placeholder math, just swept across presets |

A persistent disclaimer banner is shown at all times and every output card carries a "Prototype surrogate prediction · not validated" line.

## Where real DEM coefficients connect

All prediction logic lives in **[src/packaging/model/surrogateModel.ts](../src/packaging/model/surrogateModel.ts)**. The function signature is intentionally generic so a trained model can drop in without touching the UI:

```ts
predictFill({
  bottleVolumeMl, shoulderHeightMm, neckHeightMm, bodyDiameterMm,
  gummyVolumeMl, gummyMassG, count, packingEfficiency
}): PredictionResult
```

To connect real data:

1. **Replace placeholder coefficients** — every line marked `// TODO: replace with DEM-trained coefficient`.
2. **Replace bounds in `MODEL_BOUNDS`** with the actual DEM training design-space limits.
3. **Replace the `totalInternalHeightMm` approximation** (currently `shoulder + neck`) with measured CAD internal heights per bottle.
4. **Optionally swap the implementation** of `predictFill()` to call a trained model artifact (ONNX runtime, REST endpoint, WASM kernel — whichever the M&S team ships).
5. **Tighten the status rules** against real slack-fill regulatory thresholds (FDA / EU 21 CFR §100.100, etc.).

The component layer (`src/packaging/components/*`) reads only from the result shape, so swapping the engine is non-breaking.

> New to the codebase? Start with **[HANDOFF.md](../HANDOFF.md)** — it maps every
> "I want to change X" to the exact file to open.

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
    __tests__/                ← vitest suite (98 tests)
    index.ts                  ← engine public API barrel

.github/
  copilot-instructions.md
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
