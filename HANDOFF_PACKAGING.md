# Virtual Solid Filler — Developer Handoff

This is the guide for the **packaging module** (`src/packaging/`) — the DEM /
fill-prediction side of the app. It's written for someone brand new to the
codebase: read sections 1–5 once, then use the rest as a lookup table.

The nutrition module has its own guide at [`HANDOFF_NUTRITION.md`](HANDOFF_NUTRITION.md).
Setup and run instructions (below) cover the whole app, so start here either way.

> **The model is real.** Packing fractions (φ) are predicted by a Gaussian Process
> surrogate trained on Aspherix DEM simulations and validated against full-bottle
> DEM runs. The browser runs the exact same posterior math (Rasmussen & Williams
> eqs. 2.23–2.24) from fitted coefficients stored in `phi_gp.json` / `wall_gp.json`.
>
> **Still a prototype interface.** Predictions are only trusted inside the validated
> design space (see § 7). The disclaimer banner must stay visible — confirm any
> production fill against a full DEM run before use.

---

## 1. What this module is

Pick a gummy family (Emerald City or Dory), pick a bottle, set a count — and the
app predicts the **fill height** and **slack fill / headspace** using a
**DEM-validated Gaussian Process surrogate**. It draws a live bottle cross-section
with a fill line, a 3D gummy pile, and compares scenarios side by side.

**Two gummy families are modelled:**
- **EC (Emerald City)** — smaller gummy, ~9.5 mm height, ~1 753 mm³ reference volume
- **DoryNew (Dory)** — larger gummy, ~13 mm height, ~2 710 mm³ reference volume

**The fill target is 15% headspace (85% fill).** The status band (Good / Watchout /
Overfilled) is centered on that goal; the "Ideal count" output solves for the count
that lands you there.

The app is built with **React**, **TypeScript**, **Vite**, and **Tailwind CSS**.
You don't need to be an expert in any of them — the "I want to change X" table
(§ 6) points you at the exact file, and the code is commented.

---

## 2. First-time setup

You need two free programs installed on the machine.

**Node.js** (runs the app): download the **LTS** installer from <https://nodejs.org>,
install with defaults, then open a **new** PowerShell window and check:

```powershell
node --version   # e.g. v20.x
npm --version    # e.g. 10.x
```

**Git** (version control): download **Git for Windows** from
<https://git-scm.com/download/win>, install with defaults, reopen PowerShell, and
check `git --version`.

> ⚠️ `npm install git` does **not** install Git — that's an unrelated npm package.
> Git is a separate Windows program.

---

## 3. Run the app

From the project root (the folder with `package.json`):

```powershell
npm install      # one time — downloads the libraries into node_modules/
npm run dev      # starts the dev server; hot-reloads every time you save
```

It prints a URL (usually **http://localhost:5173**). Open it and click
**Virtual Solid Filler** on the landing page. Leave `npm run dev` running while
you work. Stop it with `Ctrl + C`.

The other commands:

```powershell
npm run typecheck   # checks the whole project for type mistakes — run after edits
npm run build       # optimised production build into /dist
npm run test        # runs the test suite (nutrition engine)
```

---

## 4. How the packaging code is organised

```
src/packaging/
├─ PackagingApp.tsx     ← the page: holds the scenario, calls the model, lays out the panels
├─ components/          ← the visual panels (they only DRAW — no math)
│   ├─ InputPanel.tsx        the form: gummy dropdown, bottle dropdown, count slider
│   ├─ BottleVisualizer.tsx  the 2D bottle cross-section with fill line + target band
│   ├─ GummyFill3D.tsx       the live 3D gummy pile
│   ├─ OutputPanel.tsx       result cards + plain-English readout
│   ├─ ComparisonChart.tsx   line chart comparing fill height vs count for EC vs Dory
│   ├─ RealDataPanel.tsx     (not currently mounted — kept for reuse)
│   └─ WorkflowDiagram.tsx   (not currently mounted — kept for reuse)
├─ data/                ← the presets
│   ├─ productPresets.ts     the gummies (geometry, density, weight)
│   └─ bottlePresets.ts      the bottles (dimensions, volume)
└─ model/               ← the model layer (browser evaluation + Python training pipeline)
    │
    │  ── TypeScript (browser, auto-loaded) ──
    ├─ surrogateModel.ts     ★ prediction entry point — fill height, slack, status, outputs ★
    ├─ realSurrogate.ts      GP posterior evaluation; loads phi_gp.json + wall_gp.json
    ├─ phi_gp.json           fitted GP(H, ρ) coefficients, per family (auto-loaded by browser)
    ├─ wall_gp.json          fitted φ_eff(λ) wall-law coefficients, per family
    │
    │  ── Python (training pipeline, runs on your machine) ──
    ├─ gp_surrogate.py       GP class + PhiSurrogate — trains + exports phi_gp.json
    ├─ wall_gp.py            wall-law + residual GP — trains + exports wall_gp.json
    ├─ gummy_bottle_model.py ★ end-to-end CLI model (imports this to use or retrain) ★
    ├─ gen_gummy.py          mold-constrained gummy STL generator
    ├─ bottle_translate.py   STL reader + fill/slack/shoulder geometry
    ├─ wall_correction.py    legacy wall-law fallback
    ├─ surrogate_table.csv   32 production DEM runs (training data, N=150 per run)
    ├─ validation_table.csv  held-out DEM runs used to validate the fitted model
    ├─ lambda_table.csv      wall-law training data (φ vs λ scans)
    ├─ README_BUNDLE.md      quick-start for the Python pipeline
    └─ INTEGRATION_HANDOFF.md  full physics, DEM protocol, and validation table
    │
    │  ── SURROGATE_CREATION_PROCESS.md — how all of the above was built, step by step,
    │     with rationale, written for a DEM expert handoff (not a software audience) ──
```

A few shared pieces live one level up in `src/shared/` (used by both modules):
`Header.tsx` (top bar), `HomePage.tsx` (the landing page), `MetricCard.tsx`,
`DisclaimerBanner.tsx`, `CursorGlow.tsx`, and `icons.tsx`.

---

## 5. The one idea that makes this easy: data flows one way

> **The page reads the presets → calls the model → hands the result to the panels.
> The panels only draw the result; they never do math.**

```
  presets (data/)  ─┐
                    ├─►  predictFill()  ─►  PredictionResult  ─►  panels draw it
  user inputs      ─┘   surrogateModel.ts                        (components/)
                              │
                         evaluatePhi()          ← realSurrogate.ts
                              │
                         phi_gp.json            ← fitted GP(H, ρ) — per family
                         wall_gp.json           ← fitted φ_eff(λ) — per family
```

Why you care: you can **restyle any panel without touching the model**, and
**retrain the model without touching the panels.** As long as `predictFill()` keeps
the same input and output shapes, everything downstream keeps working.

---

## 6. "I want to change…" → open this file

| I want to change… | Open |
|---|---|
| fill geometry, status bands, the 15% target | `model/surrogateModel.ts` — see § 7 |
| φ prediction or domain checks | `model/realSurrogate.ts` — see § 7 |
| retrain the GP on new DEM data | Python pipeline in `model/` — see § 8 |
| understand *how* the surrogate was built, with rationale, for a DEM handoff | [`model/SURROGATE_CREATION_PROCESS.md`](src/packaging/model/SURROGATE_CREATION_PROCESS.md) |
| add a new gummy | `data/productPresets.ts` → `GUMMY_PRESETS` |
| add a new bottle | `data/bottlePresets.ts` → `BOTTLE_PRESETS` |
| the page layout (which panel goes where) | `PackagingApp.tsx` |
| the input form (dropdowns, slider) | `components/InputPanel.tsx` |
| the 2D bottle drawing + fill line | `components/BottleVisualizer.tsx` |
| the live 3D gummy pile | `components/GummyFill3D.tsx` |
| the result cards / their wording | `components/OutputPanel.tsx` (wording from `interpret()` in the model) |
| the comparison chart | `components/ComparisonChart.tsx` |
| colors, fonts, the theme | `tailwind.config.js` + `src/index.css` |
| the top bar + version badge | `src/shared/Header.tsx` |
| which tools show on the landing page | `src/shared/HomePage.tsx` |

### Adding a gummy

In `data/productPresets.ts`, copy a block in `GUMMY_PRESETS` and fill in your numbers:

```ts
{
  id: "my-gummy",          // unique short key (no spaces)
  name: "My New Gummy",    // shown in the dropdown
  shortName: "MyGummy",    // shown on the comparison chart
  description: "One line about this gummy.",
  radiusTopMm: 6.0,        // radius of the smaller top face, mm
  radiusBottomMm: 7.5,     // radius of the wider bottom face, mm
  heightMm: 12.0,          // gummy height, mm
  densityGPerMl: 1.3,      // material density, g/mL
  weightG: 3.0,            // weight of one gummy, g
  accentColor: "#06b6d4",  // hex color for its chart bar
},
```

The dropdown, model, and chart all pick it up automatically. (Each gummy is
modelled as a *frustum* — a truncated cone: a wide bottom, a narrower top, a height.)

### Adding a bottle

In `data/bottlePresets.ts`, add one line in `BOTTLE_PRESETS`. Round bottle:

```ts
round("r-400cc", "400 cc — Round", 400, 102, 110, 68),
//      id         label            vol  shoulder neck diameter (mm)
```

Rectangular bottle — same, plus a front-to-back depth as the 7th argument:

```ts
rect("x-400cc", "400 cc — Rectangle", 400, 104, 112, 70, 46),
//                                                 width↑ depth↑
```

---

## 7. Deep dive: the surrogate model

The model has two TypeScript files that work together.

### `realSurrogate.ts` — GP evaluation

This is a pure TypeScript port of the Python training code. It loads the fitted
coefficients from `phi_gp.json` and `wall_gp.json` and evaluates the exact GP
posterior — a couple of dot products against the stored Cholesky factor. No
dependencies, runs in the browser.

The combined prediction is:
```
φ_used  =  φ_eff(λ)  ×  [ GP(H, ρ) / GP(H_nom, ρ_nom) ]
```
- **`φ_eff(λ)`** — the wall / finite-size law: `φ_inf·(1 − c/λ)` plus a small
  residual GP. λ = body diameter / gummy base diameter ("gummies across").
- **`GP(H, ρ)`** — an ARD-RBF GP trained on the DEM φ measurements as a function
  of gummy height H (mm) and material density ρ (kg/m³). The ratio vs the nominal
  anchor point carries the relative H/ρ trend.
- **`evaluatePhi(family, H_mm, densityKgM3, bodyDiameterMm)`** — the public entry
  point. Returns `phiUsed`, `phiLo/Hi` (90% CI), `lambda`, `baseDiameterMm`,
  `gummyVolumeMm3`, `inValidatedDomain`, and `validityWarnings`.

**Validated design space** (enforced by `inValidatedDomain`):
- λ (gummies across): **2.5 – 6.0** (`VALID_LAMBDA`)
- Full-bottle DEM validation: λ **3.9 – 4.7** (`VALIDATED_BOTTLE_LAMBDA`)
- EC gummy height: **6.5 – 11.5 mm** (`FAMILY_H_RANGE`)
- DoryNew gummy height: **10.0 – 15.0 mm**

Outside those limits the model still returns a number but sets `inValidatedDomain: false`
and the status becomes `"Outside model range"`.

### `surrogateModel.ts` — fill geometry and outputs

This takes the φ from `realSurrogate.ts` and converts it into all the packaging
metrics the UI shows.

**Key constants:**
- `HEADSPACE_FRACTION = 0.18` — the fraction of total bottle volume occupied by the
  dome + neck above the shoulder. Fixed bottle geometry; used to derive
  `totalInternalVolumeMm3` from the body volume. *Not* the fill target.
- `IDEAL_SLACK_PCT = 15` — the fill target: 15% headspace → 85% fill. Drives
  `nAtTarget`, the status band, and the visualizer's target line.
- `GOOD_SLACK_LO = 6`, `GOOD_SLACK_HI = 22` — the acceptable headspace band.

**Status logic (slack-based):**
| Status | When |
|--------|------|
| `Outside model range` | `inValidatedDomain` is false |
| `Overfilled` | slack < 6% (too little headspace) |
| `Good` | slack 6–22% (15% is the bullseye) |
| `Watchout` | slack > 22% (too much empty space) |

**Key outputs in `PredictionResult`:**
- `nAtTarget` — gummy count that reaches 85% fill (the 15% headspace goal)
- `nAtShoulder` — gummy count that reaches the shoulder line
- `phiUsed`, `phiLo`, `phiHi` — packing fraction + 90% CI
- `lambda` — gummies-across; the most important geometric input to the wall law
- `inValidatedDomain`, `isFullyValidated`, `validityWarnings`

**Key functions:**
- `predictFill(inputs)` — the whole prediction; called once per render.
- `recommendCountForTarget(...)` — solves for the count that hits 85% fill.
- `interpret(result)` — produces the plain-English sentence in the output panel.
- `targetBandMm(totalInternalHeightMm)` — the three horizontal lines on the bottle
  visualizer: `lowerMm` (78%), `idealMm` (85%), `upperMm` (94%) of total height.

---

## 8. Retraining the model on new DEM data

The browser needs no changes when you retrain — it picks up the new coefficients
automatically when you drop in fresh JSON files.

**Step-by-step:**

1. Run the Aspherix DEM campaign and export the results table.
   The format the training script expects is in `model/INTEGRATION_HANDOFF.md § 2`.

2. From the `model/` directory, run the Python pipeline:
   ```powershell
   # train φ(H, ρ) GP and export phi_gp.json
   python gp_surrogate.py --train surrogate_table.csv --out phi_gp.json

   # train φ_eff(λ) wall law and export wall_gp.json
   python wall_gp.py --train lambda_table.csv --out wall_gp.json
   ```

3. The self-test confirms the round-trip is correct:
   ```powershell
   python gp_surrogate.py --selftest
   ```

4. Drop the new `phi_gp.json` / `wall_gp.json` into `model/`. The browser
   loads them via Vite's JSON import — nothing else changes.

5. Update `FAMILY_H_RANGE` and `VALID_LAMBDA` in `realSurrogate.ts` if the new
   DEM campaign covers a wider (or narrower) design space.

6. Rerun the browser tests: `npx vitest run src/packaging`.

See `model/README_BUNDLE.md` for the full CLI reference, and
`model/INTEGRATION_HANDOFF.md` for the DEM protocol and validation table.

---

## 9. Git basics

Make sure Git is installed (section 2). Day-to-day:

```powershell
git checkout -b feat/new-gummy-preset   # branch for your change
# ... make edits ...
npm run typecheck                        # make sure it still compiles
git add .
git commit -m "feat: add strawberry gummy preset"
git push -u origin feat/new-gummy-preset
```

Then open a pull request for review before it lands on `main`. The repo already
has a `.gitignore` and `.gitattributes`, so `node_modules/` and `/dist` stay out
of commits. When you cut a notable release, bump `"version"` in
[`package.json`](package.json) and add a dated entry to
[`docs/CHANGELOG.md`](docs/CHANGELOG.md).

---

## 10. Before you hand off a build

- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes
- [ ] `npm run build` succeeds
- [ ] the app runs (`npm run dev`) and the Virtual Solid Filler opens
- [ ] the prototype disclaimer is still visible — it **must always** show, because
      this is not a validated tool

---

## 11. Troubleshooting

- **`npm` / `node` not recognised** — Node isn't installed, or PowerShell wasn't
  reopened after installing it. See section 2, then open a fresh terminal.
- **`git` not recognised** — Git for Windows isn't installed (`npm install git`
  does *not* do it). See section 2 and reopen PowerShell.
- **Weird errors after pulling / switching branches** — libraries are out of date;
  run `npm install` again.
- **Broken `node_modules`** — `Remove-Item -Recurse -Force node_modules` then
  `npm install`.
- **Blank page / red console errors** — check the `npm run dev` terminal; it
  prints the file + line, fix it and it hot-reloads.
- **`npm run build` warns about a >500 kB chunk** — just a size hint from Vite
  (the 3D library is large). It's a warning, not an error; the build still works.

---

## 12. Glossary

- **DEM** — Discrete Element Method; the Aspherix physics simulation used to
  generate the training and validation data for the GP surrogate.
- **GP / Gaussian Process** — the machine-learning model. It returns a prediction
  (mean) and an uncertainty band (credible interval). Trained once in Python;
  evaluated on every keystroke in the browser.
- **φ (packing fraction)** — the fraction of bottle volume actually occupied by
  solid gummy material. φ ≈ 0.50–0.57 for these gummies. The whole fill-height
  prediction flows from this one number.
- **λ (lambda)** — gummies across: body diameter ÷ gummy base diameter. The main
  input to the wall / finite-size correction. Validated range: 2.5 – 6.0.
- **Wall law** — `φ_eff(λ) = φ_inf·(1 − c/λ) + residual GP`. Captures how φ
  drops near the bottle wall when gummies are large relative to the bottle.
- **Validated domain** — the λ, H, and ρ ranges where the DEM data exist. Inputs
  outside it get `inValidatedDomain: false` and a warning in the UI.
- **Slack fill / headspace** — the empty volume above the product, expressed as a
  % of total internal bottle volume. 15% headspace (85% fill) is the target.
- **nAtTarget** — the gummy count that exactly hits the 15% headspace target.
- **nAtShoulder** — the gummy count that fills the bottle to the shoulder line
  (the widest point before the neck).
- **HEADSPACE_FRACTION** — fixed bottle geometry constant (0.18). The fraction of
  total internal volume in the dome + neck above the shoulder. Not the fill target.
- **Preset** — a saved set of numbers for one gummy or bottle, in `data/`.
- **Hot reload** — the dev server updating the browser automatically when you save.
- **Type error** — TypeScript catching a mismatch before the app runs;
  `npm run typecheck` finds them.

---

*Stuck? Start at the file named in section 6 — the comments there usually answer it.*
