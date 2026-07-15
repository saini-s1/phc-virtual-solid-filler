# How This Surrogate Model Was Built — A Step-by-Step Process Guide

**Who this is for:** someone with DEM (discrete-element method) expertise who is
being handed this project and needs to understand *what was done, in what order,
and why* — without having to reverse-engineer it from code. It assumes you know
DEM already; it does **not** assume you know this codebase, Python packaging, or
web development.

**What this is not:** this doc doesn't repeat the physics tables, the validation
table, or the exact function signatures — those already exist and are kept
up to date in [`INTEGRATION_HANDOFF.md`](INTEGRATION_HANDOFF.md). Think of this
document as the *narrative* ("we did X, then Y, because Z") and that one as the
*reference* ("here are the exact numbers, here's how to call it").

---

## Contents

1. [The problem this solves](#1-the-problem-this-solves)
2. [The process, step by step](#2-the-process-step-by-step)
   - [Step 1 — Lock the DEM physics](#step-1--lock-the-dem-physics)
   - [Step 2 — Parametrize the gummy from a real mold](#step-2--parametrize-the-gummy-from-a-real-mold)
   - [Step 3 — Cylinder λ-sweep: isolate the wall effect cheaply](#step-3--cylinder-λ-sweep-isolate-the-wall-effect-cheaply)
   - [Step 4 — Main DOE: how gummy height changes packing](#step-4--main-doe-how-gummy-height-changes-packing)
   - [Step 5 — Why a Gaussian Process instead of a line fit](#step-5--why-a-gaussian-process-instead-of-a-line-fit)
   - [Step 6 — Fit the wall law: physics mean + data-driven residual](#step-6--fit-the-wall-law-physics-mean--data-driven-residual)
   - [Step 7 — Validate in a real bottle, not just a cylinder](#step-7--validate-in-a-real-bottle-not-just-a-cylinder)
   - [Step 8 — Fold the real-bottle points back into the wall law](#step-8--fold-the-real-bottle-points-back-into-the-wall-law)
   - [Step 9 — Combine both pieces into one φ formula](#step-9--combine-both-pieces-into-one-φ-formula)
   - [Step 10 — Turn φ into fill height, slack, and counts](#step-10--turn-φ-into-fill-height-slack-and-counts)
   - [Step 11 — Score the model honestly](#step-11--score-the-model-honestly)
   - [Step 12 — Port the trained model to run in a browser](#step-12--port-the-trained-model-to-run-in-a-browser)
   - [Step 13 — Wire it into the product](#step-13--wire-it-into-the-product)
   - [Step 14 — Make the boundaries visible to non-experts](#step-14--make-the-boundaries-visible-to-non-experts)
3. [What's intentionally not in this workspace](#3-whats-intentionally-not-in-this-workspace)
4. [Where to go next](#4-where-to-go-next)

---

## 1. The problem this solves

A single full-bottle DEM fill simulation (Aspherix) takes roughly **1.7 hours of
wall time**. That's fine for validating a handful of designs, but useless for a
product team that wants to try 50 gummy/bottle combinations in an afternoon, or
for a live tool where someone drags a slider and expects an answer instantly.

So the goal was: **train something fast (sub-second) on a modest number of
expensive DEM runs, that reproduces DEM's answer closely enough to be useful,
and that is honest about when it stops being trustworthy.** That "something" is
the surrogate model described below — it is not a simplification of the physics,
it's a statistical model *fit to* the physics.

---

## 2. The process, step by step

### Step 1 — Lock the DEM physics

Before generating any training data, one physics configuration was fixed and
used identically for every simulation (cylinder sweeps, main DOE, and full-bottle
validation runs alike):

| Parameter | Value |
|---|---|
| Solver | Aspherix 6.5.0 |
| Young's modulus E | 5.0 × 10⁶ Pa |
| Poisson's ratio ν | 0.25 |
| Coefficient of restitution e | 0.25 |
| Sliding friction μ | 0.01 |
| Rolling friction μ_r | 0.10 |
| Particle density ρ | 1425 kg/m³ |
| Timestep | 5 × 10⁻⁶ s |
| Contact model | Hertz + history tangential + rolling-friction (`epsd2`) |

**Why this matters:** a surrogate can only be as good as the data it's trained
on. If different runs used different contact parameters, any trend the
surrogate found could be an artifact of the physics settings changing, not of
the geometry changing. Fixing physics once and varying only geometry/count is
what makes the later data-driven fits ("Step 5" onward) meaningful.

### Step 2 — Parametrize the gummy from a real mold

Only two real reference gummy shapes existed as STL files (an EC "Emerald City"
gummy and a "DoryNew" gummy). To study *how gummy height changes packing*, more
sizes than those two references were needed — but an arbitrary height can't just
be typed in, because real gummies come out of a mold with a fixed draft angle:
the base diameter is **not independent of height**.

The two references were used to fit a linear mold curve:

```
D_base(H) = 0.3910 · H + 14.3533   [mm]      (≈ 11° draft angle)
```

A height sweep (`gen_gummy.py`) then **non-uniformly scales** each reference
shape — the height axis by `H_target / H_ref`, the transverse (X/Y) axes by
`D_base(H_target) / D_base(H_ref)` — producing new, still-convex STL shapes at
each target height, ready to feed to Aspherix. Volume scales as `sxy² · sz`.

**Why this matters:** any gummy in this model has a height and everything else
(diameter, volume, mass) follows the same mold-draft rule the two real
references imply. This keeps every simulated gummy physically plausible instead
of an idealized/arbitrary shape, and it's the reason "radius" isn't a free input
anywhere in the model — it's derived from height.

### Step 3 — Cylinder λ-sweep: isolate the wall effect cheaply

The first physical effect to characterize was: **how much does packing density
drop when the container is narrow relative to the gummy?** This is a classic
finite-size / wall effect in granular packing — near a wall, particles can't
arrange as efficiently as they do deep in a large bed.

Rather than spending 1.7 hours per full-bottle DEM run to explore this,
**straight cylinders** were filled at a range of diameters, expressed as
`λ = container_diameter / gummy_base_diameter` ("how many gummies fit across"):
`λ ∈ {2.5, 2.75, 3, 4, 5, 6}` for each gummy family. The packing fraction `φ` was
measured **deep inside the bed**, away from the top/bottom free surfaces, so
only the *radial* wall effect is captured.

**Why a cylinder and not the real bottle shape:** a cylinder is cheap to mesh
and simulate, is a clean single-variable sweep (only diameter changes), and
isolates the wall effect from the bottle's taper/shoulder geometry, which is a
separate, later concern (see Step 10). This sweep produced the raw data behind
`lambda_table.csv`.

### Step 4 — Main DOE: how gummy height changes packing

Separately, a Design of Experiments (DOE) was run varying gummy height (and
implicitly density, via the `--sens` sweep) to characterize **how the packing
fraction trends as the gummy itself changes**, independent of container size.
This produced `surrogate_table.csv` (32 production DEM runs, N=150 gummies per
run) — the training data behind the `GP(H, ρ)` trend used later.

**Why keep this separate from the wall/λ sweep:** mixing "the gummy changed"
and "the container changed" into one dataset would make it impossible to tell
which effect caused an observed φ change. Two independent, single-variable
sweeps (Step 3 and Step 4) can be fit separately and then combined
mathematically (Step 9) — this is the same logic as a designed experiment that
varies one factor at a time before studying interactions.

### Step 5 — Why a Gaussian Process instead of a line fit

Once there was data to fit (φ vs. λ, and φ vs. H/ρ), the next decision was
*what kind of curve to fit through it*. A simple straight-line (or low-order
polynomial) fit was considered and rejected in favor of a **Gaussian Process
(GP)** regression. The reasoning (visualized in
[`gp_vs_slope_showcase.py`](../../../scripts/graphics/gp_vs_slope_showcase.py) in `scripts/graphics/`):

- A straight-line fit will confidently extrapolate a trend through what is
  largely run-to-run DEM noise, and has **no concept of where it stops being
  valid** — it will report a specific number for any input, even wildly outside
  the training data, with the same apparent confidence as an interpolation.
- A GP fits the same data just as well *inside* the training range, but its
  **predictive uncertainty band stays tight where there's data and fans out
  the moment you leave it.** That self-reported, growing uncertainty outside
  the trained box is exactly "the model telling you when to stop trusting it"
  — which is essential for a tool that other people (not just the person who
  trained it) will plug arbitrary inputs into.
- Practically, the GP used here (`gp_surrogate.py`) is:
  - **Pure Python, no numpy/scipy** — the DEM cluster's Python 3.6.8 has neither
    installed, and the final model needed to run anywhere (including a browser,
    see Step 12), so all linear algebra (Cholesky factorization, triangular
    solves) is hand-written.
  - **An exact GP posterior** (Rasmussen & Williams, *Gaussian Processes for
    Machine Learning*, eqs. 2.23–2.24) — the same math libraries like
    scikit-learn or GPy compute, just without the dependency. A `--selftest`
    mode checks it reproduces training points exactly and that predictive
    variance shrinks to zero as noise → 0.
  - **Modeling `logit(φ)` instead of `φ` directly** — since `φ` is physically
    bounded in `(0, 1)`, fitting the logit and inverting with a sigmoid means
    the model can *never* predict an unphysical `φ < 0` or `φ > 1`, at any input.
  - **An ARD (automatic relevance determination) kernel** — separate length
    scales per input dimension (height, density). Density is known physically
    to barely matter to packing geometry for near-rigid grains (see Step 1's
    note on contact overlap), so rather than manually excluding it, the
    optimizer is left free to learn a very large length scale for density on
    its own — effectively "discovering" that density doesn't matter, with no
    hand-tuning required.

### Step 6 — Fit the wall law: physics mean + data-driven residual

For the λ (wall/size) relationship specifically, a **hybrid model** was used
rather than a pure GP, implemented in `wall_gp.py`:

```
φ_eff(λ) = m(λ) + g(x),        x = 1/λ
  m(λ)  = φ_inf · (1 − c/λ)     ← a physical parametric mean function
  g(x) ~ GP(0, k(x,x'))         ← a zero-mean residual Gaussian Process
```

`m(λ)` is the classic finite-size packing law: as `λ → ∞` (an infinitely wide
container), `φ_eff` approaches the bulk packing limit `φ_inf`; small `λ` packs
looser. Its two coefficients (`φ_inf`, `c`) are fit by ordinary least squares
across *all* correct deep-bed data points. `g(x)` is a **zero-mean** residual
GP layered on top, so anywhere far from the training data (e.g. the bulk limit,
`λ → ∞`), the prediction reverts *exactly* to the trusted physical law, and only
bends where real data pulls it.

**Why not a plain GP here too:** a physics-grounded mean function means the
model degrades gracefully to a known-sensible answer outside the trained
range, rather than to an arbitrary flat line (a zero-mean GP's default
behavior far from data). This is the standard Gaussian-process technique of
using a parametric prior mean (Rasmussen & Williams §2.7) precisely because we
already know the shape of the underlying physical law and don't want to throw
that knowledge away.

Fitted coefficients (`wall_gp.json`), reported via leave-one-out cross-validation:

| family | φ_inf | c | LOO-CV R² | LOO RMSE |
|---|---|---|---|---|
| EC | 0.6080 | 0.3454 | 0.896 | 0.0054 |
| DoryNew | 0.6194 | 0.4533 | 0.818 | 0.0105 |

### Step 7 — Validate in a real bottle, not just a cylinder

A cylinder sweep isolates the wall effect cleanly, but it is still not the real
geometry — real bottles taper and have a shoulder. So a small number of
**full-bottle DEM runs** were performed as the real validation step, filling
actual bottle STLs.

Getting a clean, complete fill in a real bottle shape turned out to require the
right *fill method*:

- **Rejected: a funnel-based, multi-strand fill.** This was tried first and
  **bridged at the bottle neck** — gummies arched across the narrow opening
  instead of falling through, producing an incomplete, physically-wrong fill.
- **Adopted: a single-file, near-axis "rain column"** — gummies inserted one
  at a time along a narrow column near the bottle's central axis. This drains
  cleanly and was the method used for every full-bottle validation run.

Each settled bed was measured **inside the bottle itself** (not the wider DEM
domain, which can include gummies that haven't entered the bottle yet), and
every run had to clear a hard **≥90% particle-retention gate** before its data
was trusted (i.e., at least 90% of inserted particles had to actually end up
inside the bottle, ruling out losses/escapes as a silent source of error).

**Why this step exists at all, given Steps 3–6 already produced a model:** a
model fit only on idealized cylinders is a *hypothesis* about how it will
behave in a real bottle. Full-bottle DEM runs are the only way to actually test
that hypothesis against ground truth, in the geometry the model will really be
used for.

### Step 8 — Fold the real-bottle points back into the wall law

Once full-bottle runs passed validation, their `(λ, φ_eff)` points were **added
into the same wall-law fit from Step 6** (see `wall_gp.py`'s `collect_points()`)
— but only the ones at each family's *nominal* gummy height (EC: H=9.5mm,
DoryNew: H=13mm, ±0.25mm tolerance). Off-nominal-height bottle runs are kept
out of this fit and used purely for held-out validation instead (Step 11).

**Why only nominal-height points, and why fold them in at all:** any height
effect is modeled *separately* by `GP(H, ρ)` (Step 4/9) — a bottle run at a
non-nominal height would mix the wall effect and the height effect into one
number and "double-count" the height correction at prediction time. Folding in
only the nominal-height, validated real-bottle points means the wall law's
*absolute level* is anchored by true bottle geometry, while the wide-ranging
cylinder sweep still pins its *shape* — the real bottles are too few and too
narrow in λ-range to reliably fit a whole curve on their own, but they are
exactly what's needed to correct the general shape onto the true geometry.

### Step 9 — Combine both pieces into one φ formula

The gummy-height trend (Step 4/5) and the wall/size law (Step 6/8) are
independently fit, then combined multiplicatively at prediction time:

```
φ_used(family, H, ρ, λ) = φ_eff(family, λ)  ×  [ GP(family, H, ρ) / GP(family, H_nom, ρ_nom) ]
```

`GP(H,ρ)` is used **only as a ratio to its value at the nominal height** — so
at exactly the nominal height, the ratio is 1.0 and the prediction is *exactly*
the validated wall law from Step 8. Away from nominal height, the ratio nudges
the wall law's output up or down by the height trend learned in Step 4.

**Why this decomposition instead of one big GP over (H, ρ, λ) at once:** it
keeps each piece honest about what it actually measures — the wall law is
anchored by real validated bottles and stays trustworthy at nominal height no
matter what the (data-sparser) height-trend GP says, while the height trend
only ever contributes a *relative* adjustment, never overriding the validated
absolute level. It also avoids needing a 3-input GP trained on comparatively
few full-bottle points, which would be far more prone to overfitting than two
independently-fit, lower-dimensional models.

### Step 10 — Turn φ into fill height, slack, and counts

φ alone isn't an answer a reviewer can act on — the actual asks are fill
height, slack fill %, count-to-shoulder, etc. `bottle_translate.py` reads a
bottle's STL (or parametric dimensions), slices it into a cumulative
volume-vs-height curve, detects the **shoulder** (the natural "ideal fill"
line before the neck), and applies `φ_used` to convert `count × gummy volume`
into a fill height / % / slack fill / mass. `gummy_bottle_model.py` is the
single entry point that stitches gummy geometry (Step 2) + wall law (Step 6/8)
+ height trend (Step 4/9) + bottle geometry (this step) together into one
`evaluate()` call.

**Why bottle geometry is handled completely separately from the packing
physics:** the packing fraction is a property of the gummy/container-diameter
relationship; the fill height is a property of the *specific* bottle's
shape (how volume accumulates with height, where the shoulder is). Keeping
these as separate modules means a brand-new bottle shape can be evaluated by
just feeding its STL through `bottle_translate.py` — no re-fitting of the
packing physics is ever required for a new bottle.

### Step 11 — Score the model honestly

Six full-bottle DEM runs (5 at nominal gummy height, 1 at an off-nominal
height for each family, used to test the height correction from Step 4/9) were
held out and scored against the model's predictions. All six pass the
engineering gates (fill within ±5%, φ within ±0.02, 0 particle leaks, drift
< 2 mm, retention ≥ 90%); **net accuracy across the 5 nominal-height runs is φ
within ±0.007 and fill height within ±1.6%.** The full table, per-run numbers,
and known coverage caveats (validated λ range, unsupported squat/small
bottles, DoryNew's partially-validated height sensitivity) are kept in
[`INTEGRATION_HANDOFF.md` §7](INTEGRATION_HANDOFF.md#7-validation-status) —
that table is the canonical source and is not duplicated here to avoid the two
documents drifting out of sync.

**Why leave-one-out CV *and* held-out full-bottle validation, rather than
just one:** LOO-CV (reported per fit in Steps 5/6) measures how well the GP
generalizes *within* the same kind of data it was trained on (cylinder points,
say). The held-out full-bottle runs are a completely independent check, in
the real target geometry, against ground truth the model never saw during
fitting — this is the step that actually earns trust in the final answer a
user sees (fill height / slack), not just in an intermediate quantity (φ).

### Step 12 — Port the trained model to run in a browser

Once the GP fits were finalized (`phi_gp.json`, `wall_gp.json` — each just the
fitted Cholesky factors, kernel hyperparameters, and training points as plain
JSON), the *evaluation* path (not the training path) was re-implemented in
TypeScript, in [`realSurrogate.ts`](realSurrogate.ts). It performs the exact
same GP posterior math (same R&W equations referenced in Step 5) as the Python
`gp_surrogate.py`/`wall_gp.py` — a couple of dot products against a stored
Cholesky factor — and is locked to match the Python output via parity tests
(`src/packaging/__tests__/surrogate.parity.test.ts`, comparing many inputs
against Python-computed reference values).

**Why port the math instead of calling Python from the app:** the whole point
of building a surrogate (Step 1's motivation) was speed and easy
distribution — an exact GP evaluation is a handful of dot products against a
training set of ~10–20 points, microseconds of work, so there is no
performance reason to keep a Python process alive. Removing that dependency
also means the tool runs entirely client-side (no server, no Python runtime to
deploy/maintain) and can be shipped as a static web app. **Retraining still
always happens in Python** — nothing about the TypeScript file changes when
new DEM data arrives; only the two JSON coefficient files get replaced (see
[`INTEGRATION_HANDOFF.md` §9](INTEGRATION_HANDOFF.md#9-how-to-extend--retrain)).

### Step 13 — Wire it into the product

[`surrogateModel.ts`](surrogateModel.ts) is the single entry point the rest of
the app calls (`predictFill()`); it calls `evaluatePhi()` from
`realSurrogate.ts` for the real, DEM-trained packing fraction, then applies the
same bottle-geometry conversion logic as `bottle_translate.py` (Step 10) to
produce fill height, slack fill %, and status (`Good` / `Watchout` /
`Overfilled` / `Outside model range`). Every React component in
`src/packaging/components/` only *reads* the resulting `PredictionResult` and
draws it — none of them contain prediction math. See
[`HANDOFF_PACKAGING.md`](../../../HANDOFF_PACKAGING.md) for the full
component-by-component map if you need to trace how a number gets from this
model onto the screen.

**Why keep the input/output shapes of `surrogateModel.ts` stable across this
change:** the UI panels (bottle visualization, comparison chart, output cards)
were built against a placeholder version of this model early in the project.
Keeping `PredictionResult`'s shape unchanged while swapping the actual math
underneath it meant the whole UI layer required zero changes when the real,
DEM-trained model went live — a deliberate separation of "what the model
looks like from the outside" from "what math is actually running."

### Step 14 — Make the boundaries visible to non-experts

A model is only safe to hand to non-experts if its limits are visible, not
just documented in a markdown file. Two places do this:

- **In the live app:** `surrogateModel.ts` flags any input outside the trained
  `(H, ρ)` box or the validated λ range (Step 11's caveats) as `"Outside model
  range"` rather than silently returning a number.
- **In presentation materials:** a set of standalone Python/matplotlib scripts
  in `scripts/graphics/` (`dem_surrogate_showcase.py`, `gp_vs_slope_showcase.py`,
  `prediction_accuracy_graphics.py`, `surrogate_graphics_pack.py`,
  `validity_graphics.py`, `bottle_size_trends.py`) generate exec-facing
  graphics — the GP fit with its training points, the wall-law fit, the
  parity/residual plots against the real DEM validation runs, and a go/no-go
  map over the (height, λ) design space. **These scripts do not retrain
  anything** — they load the exact same fitted `phi_gp.json` / `wall_gp.json`
  coefficients the live app uses and re-run the same evaluation path purely to
  visualize it. They exist to communicate "here is the data, here is the fit,
  here is where it stops being valid" to an audience that won't read Python.

---

## 3. What's intentionally not in this workspace

`INTEGRATION_HANDOFF.md` references a few things that live only on the
original DEM compute cluster, not in this repository, because they only matter
for *retraining*, not for *using*, the model:

- **`METHODOLOGY_AND_VALIDATION.md`** — a deeper DEM-methodology writeup
  referenced from that doc's file inventory. It does not exist in this
  workspace.
- **The DEM build/analyze tooling** — `build_bottle.py`, `analyze_bottle.py`,
  `gen_cylinder.py`, `build_doe.py`, `postprocess_cyl.py` — the scripts that
  actually submit new Aspherix jobs and parse their raw VTK output into the
  CSVs this model trains on. These live on the DEM cluster
  (originally `/home/health/fd2997/cylinder_doe`), not here.

If you're extending this model (adding a new bottle or gummy height to the
training set), you'll need access to that cluster environment and those
scripts — this repository only contains the *outputs* of that pipeline
(`surrogate_table.csv`, `lambda_table.csv`, `validation_table.csv`, the fitted
JSON files) and the code that consumes them.

## 4. Where to go next

| If you want to... | Read |
|---|---|
| Call or embed the model, see the exact I/O contract, or check the validation table | [`INTEGRATION_HANDOFF.md`](INTEGRATION_HANDOFF.md) |
| Get the Python pipeline running standalone, outside this repo | [`README_BUNDLE.md`](README_BUNDLE.md) |
| Understand how the React app calls this model and where each UI panel lives | [`HANDOFF_PACKAGING.md`](../../../HANDOFF_PACKAGING.md) |
| Retrain on new DEM data | [`INTEGRATION_HANDOFF.md` §9](INTEGRATION_HANDOFF.md#9-how-to-extend--retrain) |
| See the actual training/evaluation code | `gp_surrogate.py`, `wall_gp.py`, `gen_gummy.py`, `bottle_translate.py`, `gummy_bottle_model.py` (Python) and `realSurrogate.ts`, `surrogateModel.ts` (TypeScript, browser) |

---

> **Reminder:** like every prediction in this app, this surrogate is a
> prototype tool. It is validated against real DEM within the ranges described
> in Step 11 and `INTEGRATION_HANDOFF.md` §7 — outside those ranges, treat its
> output as a hypothesis to confirm with a real DEM run, not a final answer.
