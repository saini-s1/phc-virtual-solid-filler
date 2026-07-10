# Virtual Solid Filler — Developer Handoff

This is the guide for the **packaging module** (`src/packaging/`) — the DEM /
fill-prediction side of the app. It's written for someone brand new to the
codebase: read sections 1–5 once, then use the rest as a lookup table.

The nutrition module has its own guide at [`HANDOFF_NUTRITION.md`](HANDOFF_NUTRITION.md).
Setup and run instructions (below) cover the whole app, so start here either way.

> **The one thing to remember:** the model math in here is **placeholder — made-up
> numbers.** The app is a fully working *shell* that's ready for a real trained
> model to drop in. Every fake number is tagged in the code with
> `// todo: dem coefficient`, so you can find them all in one search.

---

## 1. What this module is

Pick a gummy, pick a bottle, set a count — and it predicts the **fill height** and
the **slack fill / headspace** (how much empty room is left at the top). It also
compares scenarios side by side and draws a live bottle + 3D gummy pile.

It's a prototype. The numbers are illustrative, not validated. There's a
disclaimer banner in the UI that must always stay visible.

The whole app is built with **React** (UI), **TypeScript** (JavaScript with types,
so mistakes get caught before you run it), **Vite** (the dev server + build tool),
and **Tailwind CSS** (styling via class names). You don't need to be an expert in
any of them — the "I want to change X" table points you at the exact file, and the
code around it is commented.

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
│   ├─ BottleVisualizer.tsx  the 2D bottle outline with the fill line
│   ├─ GummyFill3D.tsx       the live 3D gummy pile (the fanciest bit on screen)
│   ├─ OutputPanel.tsx       the result cards + plain-English readout
│   ├─ ComparisonChart.tsx   the bar chart comparing scenarios
│   ├─ RealDataPanel.tsx     (not currently mounted — kept for reuse)
│   └─ WorkflowDiagram.tsx   (not currently mounted — kept for reuse)
├─ data/                ← the presets
│   ├─ productPresets.ts     the gummies (geometry, density, weight) + frustumVolumeMl()
│   └─ bottlePresets.ts      the bottles (dimensions, volume)
└─ model/
    └─ surrogateModel.ts     ★ ALL the prediction math — the file that matters most ★
```

A few shared pieces live one level up in `src/shared/` (used by both modules):
`Header.tsx` (top bar), `HomePage.tsx` (the landing page with the two cards),
`MetricCard.tsx`, `DisclaimerBanner.tsx`, `CursorGlow.tsx` (the pointer glow), and
`icons.tsx`.

---

## 5. The one idea that makes this easy: data flows one way

> **The page reads the presets → calls the model → hands the result to the panels.
> The panels only draw the result; they never do math.**

```
  presets (data/)  ─┐
                    ├─►  predictFill()  ─►  PredictionResult  ─►  panels draw it
  user inputs      ─┘   (model/)                                  (components/)
```

Why you care: you can **swap the entire model without touching a panel**, and
**restyle any panel without risking the math.** As long as `predictFill()` keeps
the same input and output shapes, everything downstream keeps working.

---

## 6. "I want to change…" → open this file

| I want to change… | Open |
|---|---|
| the prediction math (the model) | `model/surrogateModel.ts` — see section 7 |
| add a new gummy | `data/productPresets.ts` → `GUMMY_PRESETS` |
| add a new bottle | `data/bottlePresets.ts` → `BOTTLE_PRESETS` |
| the page layout (which panel goes where) | `PackagingApp.tsx` |
| the input form (dropdowns, slider) | `components/InputPanel.tsx` |
| the 2D bottle drawing + fill line | `components/BottleVisualizer.tsx` |
| the live 3D gummy pile | `components/GummyFill3D.tsx` |
| the result cards / their wording | `components/OutputPanel.tsx` (wording comes from `interpret()` in the model) |
| the comparison bar chart | `components/ComparisonChart.tsx` |
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

Everything the app "predicts" lives in `model/surrogateModel.ts`. It's fully
commented; here's what you'll touch.

**The knobs (constants at the top):**
- `PACKING_EFFICIENCY` — how tightly gummies pack together (currently a guess,
  `0.62`). This single number moves the predicted fill height more than anything
  else, so calibrate it against real data first.
- `MODEL_BOUNDS` — the "we trust the model inside this range" limits. Pick inputs
  outside it and the UI flags the run as *extrapolated* ("Outside model range").

**The functions:**
- `predictFill(inputs)` — **the whole prediction.** Takes gummy + bottle + count,
  returns fill height, slack-fill %, a status flag, and the plain-English text.
  **To plug in a trained model you rewrite the body of this one function** — keep
  the same input/output shapes and nothing downstream needs to change.
- `recommendCountForTarget(...)` — powers the "Run prediction" button; picks a
  count that lands the fill on the target line. It assumes a roughly linear
  relationship; there's a `// TODO` about switching to a numerical inversion if
  your real model is non-linear.
- `interpret(result)` — turns the numbers into the sentence shown in the output
  panel. Change wording/thresholds here.

**Find every fake number:** search the project for `todo: dem coefficient`
(`Ctrl+Shift+F` in VS Code). Each placeholder is tagged, so you get a complete
checklist of what a real model has to replace.

---

## 8. Plugging in the real DEM results (the end goal)

When the trained surrogate is ready, the swap is small and self-contained:

1. Replace every `// todo: dem coefficient` constant with the real fitted values.
2. Replace the body of `predictFill()` with a call to the trained model (ONNX in
   the browser, a REST endpoint, a WASM kernel — whatever M&S ships). **Keep the
   same input and output shapes.**
3. Update `MODEL_BOUNDS` to the real training design-space limits.
4. Tighten the status thresholds against the real slack-fill / headspace criteria.

Because the panels only read the result shape (section 5), none of the UI changes
when the model becomes real.

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

- **DEM** — Discrete Element Method; the physics simulation the real model would be
  trained on. Faked here.
- **Surrogate model** — a fast approximation that stands in for the slow DEM sim.
  `predictFill()` is that stand-in.
- **Slack fill / headspace** — the empty space at the top of the bottle above the
  product.
- **Frustum** — a truncated cone; how each gummy's geometry is approximated.
- **Preset** — a saved set of numbers for one gummy or bottle, in `data/`.
- **Hot reload** — the dev server updating the browser automatically when you save.
- **Type error** — TypeScript catching a mismatch before the app runs;
  `npm run typecheck` finds them.

---

*Stuck? Start at the file named in section 6 — the comments there usually answer it.*
