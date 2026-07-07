# Developer guide — PHC Virtual Solid Filler

Hi Prashant 👋

This is the full walkthrough of the app: what it is, how to run it, how the code
is organised, and — most importantly — **exactly which file to open when you want
to change something.** No prior knowledge of this codebase is assumed. Read
sections 1–4 once, then use sections 5–8 as a lookup table whenever you need it.

> **One thing to remember the whole way through:** the DEM model math in here is
> **placeholder / made-up numbers.** The app is a fully working *shell* that's
> ready for a real trained model to drop in. Every fake number is tagged in the
> code with `// todo: dem coefficient` so you can find them all instantly.

---

## Table of contents

1. [What this app is](#1-what-this-app-is)
2. [Install the tools you need (one time)](#2-install-the-tools-you-need-one-time)
3. [Run the app](#3-run-the-app)
4. [How the code is organised](#4-how-the-code-is-organised)
5. [The most important idea: how data flows](#5-the-most-important-idea-how-data-flows)
6. ["I want to change…" → open this file](#6-i-want-to-change--open-this-file)
7. [Deep dive: the surrogate model](#7-deep-dive-the-surrogate-model)
8. [Plugging in the real DEM results (the end goal)](#8-plugging-in-the-real-dem-results-the-end-goal)
9. [Version control with git](#9-version-control-with-git)
10. [Testing & the pre-share checklist](#10-testing--the-pre-share-checklist)
11. [Troubleshooting](#11-troubleshooting)
12. [Glossary](#12-glossary)

---

## 1. What this app is

A web dashboard prototype with **two independent tools** behind one landing page:

| Tool | Folder | What it does |
| --- | --- | --- |
| **Virtual Solid Filler** (the DEM one — *your area*) | `src/packaging/` | Pick a gummy + a bottle + a count, and it predicts the **fill height** and **slack fill / headspace**. |
| **Nutrition Calculator** (the other module) | `src/nutrition/` | Builds a compliant Nutrition Facts label from a recipe. You can ignore this entirely. |

It's built with **React** (the UI library), **TypeScript** (JavaScript with types,
so mistakes get caught before you run it), **Vite** (the dev server + build tool),
and **Tailwind CSS** (styling via utility class names). You don't need to be an
expert in any of these to make changes — the "change X" table tells you the exact
file, and the code around it is commented.

---

## 2. Install the tools you need (one time)

You need **two** programs installed on the machine. Both are free.

### 2a. Node.js (required — runs the app)
Download the **LTS** version from <https://nodejs.org> and install it with all
the defaults. To confirm it worked, open a **new** PowerShell window and run:

```powershell
node --version   # should print something like v20.x
npm --version    # should print something like 10.x
```

### 2b. Git (required for version control)
> ⚠️ **Heads up:** running `npm install git` does **NOT** install Git. That
> command installs an unrelated, useless npm package (we already removed it from
> this project). The real Git is a separate program you install on Windows itself.

Download **Git for Windows** from <https://git-scm.com/download/win>, install it
with the defaults, then **close and reopen PowerShell** and check:

```powershell
git --version    # should print something like git version 2.x
```

If that prints a version, you're good. (See [section 9](#9-version-control-with-git)
for how to actually use it.)

---

## 3. Run the app

From the project root (the folder with `package.json` in it):

```powershell
npm install      # one time — downloads all the libraries into node_modules/
npm run dev      # starts the dev server; it hot-reloads every time you save
```

It will print a URL (usually **http://localhost:5173**). Open that in a browser
and click **Virtual Solid Filler** on the landing page. Leave `npm run dev`
running in its terminal while you work — every save updates the browser instantly.

The other commands you'll use:

```powershell
npm run typecheck   # checks the whole project for type mistakes. run after edits.
npm run build       # makes the optimised production build into /dist
npm run test        # runs the test suite (nutrition engine, 98 tests)
```

To stop the dev server, click its terminal and press `Ctrl + C`.

---

## 4. How the code is organised

The root is deliberately tidy: **folders, the build-tool config files, and this
guide.** Everything you'd actually read or edit lives inside `src/` (the app) or
`docs/` (reference material).

```
Mock Design UI/
├─ HANDOFF.md              ← this guide (the one doc you start from)
│
├─ src/                    ← ★ all the app code lives here ★
├─ docs/                   ← readme, changelog, and the nutrition spec/reference PDFs
│
├─ index.html              ┐
├─ package.json            │  build-tool config — these MUST sit at the root,
├─ package-lock.json       │  the tools (vite / node / typescript / tailwind)
├─ vite.config.ts          │  look for them here by name. leave them where they
├─ tsconfig.json           │  are; you rarely need to touch any of them.
├─ tailwind.config.js      │
├─ postcss.config.js       ┘
├─ .gitignore              ← what git should skip (node_modules, dist, …)
├─ .gitattributes          ← line-ending rules for git
└─ Mock Design UI.code-workspace   ← the VS Code workspace file
```

> **Why can't the config files go in a folder too?** They're not clutter — node,
> vite, typescript, tailwind and postcss each auto-discover their config *by name,
> at the project root.* Hiding them in a subfolder would break the build unless
> you rewire every tool. So the clean-looking root above is as tidy as it safely
> gets: folders + configs + this guide.

Inside `src/`:

```
src/
├─ main.tsx             ← the entry point; boots React. don't touch.
├─ App.tsx              ← the top-level router (home ↔ packaging ↔ nutrition)
├─ index.css            ← global styles + shared utility classes
│
├─ shared/             ← pieces used by BOTH tools
│   ├─ Header.tsx           top bar + version badge
│   ├─ HomePage.tsx         the landing page with the two tool cards
│   ├─ MetricCard.tsx       the little stat cards
│   ├─ DisclaimerBanner.tsx the "prototype, not validated" banner
│   └─ icons.tsx            shared svg icons
│
├─ packaging/          ← ★ YOUR AREA — the DEM filler ★
│   ├─ PackagingApp.tsx     the page: wiring + layout
│   ├─ components/          the visual panels (see below)
│   ├─ data/                the presets — gummies & bottles
│   └─ model/               the surrogate model — ALL the math
│
└─ nutrition/          ← the other module (safe to ignore)
    ├─ NutritionApp.tsx     its page
    ├─ components/          its panels
    └─ (engine/, config/, types/, __tests__/, …)  its calculation engine
```

And `docs/` (nothing here affects the running app — it's just reference):

```
docs/
├─ README.md               ← project overview
├─ CHANGELOG.md            ← a running log of notable changes — add to it
├─ gummy-render.png        ← a stray product render, parked here
└─ nutrition-reference/    ← the nutrition module's spec docs, FDA PDFs,
                             the example Excel, and the python verifiers
```

Inside your area, `packaging/`:

| Path | What's in it |
| --- | --- |
| `packaging/PackagingApp.tsx` | the page itself — reads presets, calls the model, arranges the panels |
| `packaging/components/InputPanel.tsx` | the form: gummy dropdown, bottle dropdown, count slider |
| `packaging/components/BottleVisualizer.tsx` | the 2D bottle outline with the fill line |
| `packaging/components/GummyFill3D.tsx` | the live 3D gummy pile (the fanciest bit on screen) |
| `packaging/components/OutputPanel.tsx` | the result cards + plain-English readout |
| `packaging/components/ComparisonChart.tsx` | the bar chart comparing scenarios |
| `packaging/data/productPresets.ts` | the gummies (geometry, density, weight) |
| `packaging/data/bottlePresets.ts` | the bottles (dimensions, volume) |
| `packaging/model/surrogateModel.ts` | **the prediction math — the file that matters most** |

There are two extra components, `RealDataPanel.tsx` and `WorkflowDiagram.tsx`,
that aren't currently shown anywhere. They're kept in case you want to drop them
back into the page — their comment headers explain how.

---

## 5. The most important idea: how data flows

There's one rule that makes this whole codebase easy to reason about:

> **Numbers flow one way. The page reads the presets → calls the model → hands the
> result down to the panels. The panels only *draw* the result; they never do math.**

```
  presets (data/)  ─┐
                    ├─►  predictFill()  ─►  PredictionResult  ─►  panels draw it
  user inputs      ─┘   (model/)                                  (components/)
```

Why you care: because of that rule, **you can swap the entire model without
touching a single panel**, and you can **restyle any panel without risking the
math.** They're decoupled on purpose. As long as `predictFill()` keeps taking the
same inputs and returning the same `PredictionResult` shape, everything downstream
keeps working.

---

## 6. "I want to change…" → open this file

### …the surrogate model / the prediction math
**[src/packaging/model/surrogateModel.ts](src/packaging/model/surrogateModel.ts)** — see the [deep dive below](#7-deep-dive-the-surrogate-model). This is the #1 file.

### …add a new gummy (product data)
**[src/packaging/data/productPresets.ts](src/packaging/data/productPresets.ts)**
Scroll to `GUMMY_PRESETS` and copy-paste this block, then fill in your numbers:

```ts
  {
    id: "my-gummy",          // a unique short key (no spaces)
    name: "My New Gummy",    // shown in the dropdown
    shortName: "MyGummy",    // shown on the comparison chart
    description: "One line about what this gummy is.",
    radiusTopMm: 6.0,        // radius of the smaller top face, mm
    radiusBottomMm: 7.5,     // radius of the wider bottom face, mm
    heightMm: 12.0,          // gummy height, mm
    densityGPerMl: 1.3,      // material density, g/mL
    weightG: 3.0,            // weight of one gummy, g
    accentColor: "#06b6d4",  // hex color used in the chart bar
  },
```

That's the only edit — the dropdown, model, and chart all pick it up automatically.

### …add a new bottle (package data)
**[src/packaging/data/bottlePresets.ts](src/packaging/data/bottlePresets.ts)**
Scroll to `BOTTLE_PRESETS` and add one line. For a **round** bottle:

```ts
round(
  "r-400cc",               // unique id (no spaces)
  "400 cc — Round",        // shown in the dropdown
  400,                     // bottle volume, mL
  102,                     // shoulder height (fill-line), mm from bottom
  110,                     // neck height (mouth), mm from bottom
  68                       // outer body diameter, mm
),
```

For a **rectangular** bottle, add a 7th argument: the front-to-back depth in mm:

```ts
rect("x-400cc", "400 cc — Rectangle", 400, 104, 112, 70, 46),
//                                               width↑  depth↑
```

That's all — the dropdown groups them automatically (round first, then rectangle).

### …the page layout (which panels go where)
**[src/packaging/PackagingApp.tsx](src/packaging/PackagingApp.tsx)** — this is the
grid that positions input · bottle · output, with the chart underneath.

### …the input form (the controls the user sees)
**[src/packaging/components/InputPanel.tsx](src/packaging/components/InputPanel.tsx)**

### …the bottle drawing or the 3D gummies
- 2D bottle outline + fill line: **[src/packaging/components/BottleVisualizer.tsx](src/packaging/components/BottleVisualizer.tsx)**
- the live 3D gummy pile: **[src/packaging/components/GummyFill3D.tsx](src/packaging/components/GummyFill3D.tsx)**

### …the result cards or their wording
**[src/packaging/components/OutputPanel.tsx](src/packaging/components/OutputPanel.tsx)**
(the plain-English sentence comes from the `interpret()` function inside the model file).

### …the comparison bar chart
**[src/packaging/components/ComparisonChart.tsx](src/packaging/components/ComparisonChart.tsx)**

### …colors, fonts, the overall theme
- theme tokens (the P&G blues, cyans, ink grays): **[tailwind.config.js](tailwind.config.js)**
- shared utility classes (`.surface`, `.field-label`, `.eyebrow`, animations): **[src/index.css](src/index.css)**
- the top bar + version badge: **[src/shared/Header.tsx](src/shared/Header.tsx)**

### …which tools appear on the landing page
**[src/shared/HomePage.tsx](src/shared/HomePage.tsx)**

---

## 7. Deep dive: the surrogate model

Everything the app "predicts" lives in one file:
**[src/packaging/model/surrogateModel.ts](src/packaging/model/surrogateModel.ts)**.
It's fully commented; here are the parts you'll touch.

**The knobs (constants at the top):**
- `PACKING_EFFICIENCY` — how tightly gummies pack together (currently a guess,
  `0.62`). This single number moves the predicted fill height more than anything
  else, so it's the first thing to calibrate against real data.
- `MODEL_BOUNDS` — the "we trust the model inside this range" limits. If the user
  picks inputs outside it, the UI automatically flags the run as *extrapolated*.

**The functions:**
- `predictFill(inputs)` — **the whole prediction.** Takes a `PredictionInputs`
  object (gummy, bottle, count), returns a `PredictionResult` (fill height, slack
  fill %, a status flag, and the plain-English text). **To plug in a trained
  model, you rewrite the body of this one function and nothing else** — as long
  as the inputs and outputs keep the same shape.
- `recommendCountForTarget(...)` — powers the "Run prediction" button; it picks a
  gummy count that lands on the target fill line. It currently assumes a roughly
  linear relationship; there's a `// todo` note about switching to a proper
  numerical inversion if your real model is non-linear.
- `interpret(result)` — turns the numbers into the human-readable sentence shown
  in the output panel. Change the wording/thresholds here.

**Finding all the fake numbers:** search the project for `todo: dem coefficient`
(in VS Code, press `Ctrl+Shift+F` and type it). Every placeholder is tagged, so
you get a complete checklist of what a real model needs to replace.

---

## 8. Plugging in the real DEM results (the end goal)

When the trained surrogate is ready, the swap is small and self-contained:

1. Replace every `// todo: dem coefficient` constant in `surrogateModel.ts` with
   the real fitted values.
2. Replace the body of `predictFill()` with a call to the trained model — whether
   that's an ONNX runtime in the browser, a REST endpoint, or a WASM kernel,
   whatever M&S ships. **Keep the same input and output shapes.**
3. Update `MODEL_BOUNDS` to the real training design-space limits.
4. Tighten the status thresholds against the real slack-fill / headspace criteria.

Because the panels only ever read the result shape (see [section 5](#5-the-most-important-idea-how-data-flows)),
none of the UI needs to change when the model becomes real.

---

## 9. Version control with git

First make sure git is actually installed — see [section 2b](#2b-git-required-for-version-control).
If `git --version` prints a version number, you're ready.

**One-time setup** (from the project root):

```powershell
git init
git add .
git commit -m "chore: initial import of PHC Virtual Solid Filler v0.2.0"
```

**Push it to the team's server** (Azure DevOps / GitHub Enterprise — get the URL
from whoever owns the repo):

```powershell
git remote add origin <your-repo-url>
git branch -M main
git push -u origin main
```

**Day-to-day workflow** (the habit worth keeping):

```powershell
git checkout -b feat/new-gummy-preset   # start a branch for your change
# ... make edits ...
npm run typecheck                        # make sure it still compiles
git add .
git commit -m "feat: add strawberry gummy preset"
git push -u origin feat/new-gummy-preset
```

Then open a pull request for review before it goes onto `main`.

**Keep the version in sync in two places** whenever you cut a notable release:
- [package.json](package.json) → the `"version"` field
- [docs/CHANGELOG.md](docs/CHANGELOG.md) → add a dated section describing what changed

The repo already has a `.gitignore` (so `node_modules/`, `/dist`, etc. aren't
committed) and a `.gitattributes` — you don't need to set those up.

---

## 10. Testing & the pre-share checklist

The automated tests currently cover the **nutrition** engine only (98 tests).
Run them with `npm run test`. The packaging side is validated by hand for now;
if you add model logic worth locking down, tests would live alongside the
nutrition ones as a pattern to copy.

Before you hand a build to anyone, run through this:

- [ ] `npm run typecheck` passes (no type errors)
- [ ] `npm run test` passes
- [ ] `npm run build` succeeds
- [ ] the app still runs (`npm run dev`) and the Virtual Solid Filler opens
- [ ] the prototype disclaimer is still visible — it **must always** be shown,
      because this is not a validated tool

---

## 11. Troubleshooting

**`npm run dev` says "command not found" / npm isn't recognised**
Node.js isn't installed or PowerShell wasn't reopened after installing it. See
[section 2a](#2a-nodejs-required--runs-the-app), then open a fresh terminal.

**`git` isn't recognised**
Git for Windows isn't installed (remember, `npm install git` does *not* do this).
See [section 2b](#2b-git-required-for-version-control) and reopen PowerShell.

**Weird errors after pulling new code / switching branches**
The installed libraries are out of date. Run `npm install` again.

**A totally broken `node_modules`**
Delete it and reinstall from scratch:
```powershell
Remove-Item -Recurse -Force node_modules
npm install
```

**The page is blank / red errors in the browser console**
Check the terminal running `npm run dev` — it prints the actual error and the
file + line number. Fix that file and it hot-reloads.

**`npm run build` warns about a chunk being over 500 kB**
That's just a size hint from Vite (the 3D library is large). It's a warning, not
an error — the build still succeeds.

---

## 12. Glossary

- **DEM** — Discrete Element Method; the physics simulation that (eventually) the
  real model is trained on. In this prototype it's faked.
- **Surrogate model** — a fast approximation that stands in for the slow, heavy
  DEM simulation. `predictFill()` is that stand-in.
- **Slack fill / headspace** — the empty space left at the top of the bottle
  above the product.
- **Preset** — a saved set of numbers for a specific gummy or bottle, in the
  `data/` folder.
- **Component** — one reusable piece of UI (a panel, a card, a chart), each in its
  own `.tsx` file under `components/`.
- **Hot reload** — the dev server updating the browser automatically when you save.
- **Type error** — TypeScript catching a mismatch (e.g. passing text where a
  number is expected) before the app even runs. `npm run typecheck` finds them.

---

*Questions about the code? Start at the file named in [section 6](#6-i-want-to-change--open-this-file);
the comments there will usually answer it.*
