# Handoff Note — Gummy Packing-Fraction Raw Data

**From:** PHC Modeling Suite team
**Snapshot date:** 2026-07-15
**Cluster source:** `/home/health/fd2997/cylinder_doe/` (DEM compute cluster)

This folder is the reviewer-friendly landing of the raw DEM packing-fraction
data behind the PHC Modeling Suite's Virtual Solid Filler surrogate model. Everything here is a
read-only snapshot: no Aspherix job was re-run, no raw output was modified, and
no packing fraction was re-derived where a post-processed value already existed.

---

## 1. What is in this folder

```
packing_fraction_raw_data.xlsx   The deliverable workbook (7 sheets, see below)
HANDOFF_NOTE.md                  This file
regenerate_xlsx.py               Rebuilds the workbook from the CSVs + JSONs here
bundle/                          The landed raw-data bundle (extracted snapshot)
gp/                              Copies of the two fitted GP coefficient files
```

### `bundle/` — the raw-data snapshot
| Folder / file | Contents |
|---|---|
| `csvs/` | The 3 canonical post-processed CSVs (`surrogate_table.csv`, `lambda_table.csv`, `validation_table.csv`), copied verbatim. |
| `run_manifest.csv` | 55 rows, one per DEM run: 36 main-DOE + 12 lambda-sweep + 7 bottle-validation. Cross-reference table with geometry, counts, phi, wall time, retention gate, and cluster paths. |
| `input_decks/` | One representative Aspherix input deck per category (DOE, lambda-sweep, bottle-validation). |
| `scripts/` | Driver + post-processing scripts (`gen_gummy.py`, `gen_cylinder.py`, `build_*.py`, `postprocess_cyl.py`, `analyze_bottle.py`, `bottle_translate.py`, plus `doe_design.csv`), md5-verified byte-identical to the cluster originals. |
| `deep_bed_measurements/` | Per-run single-row CSVs split from the canonical CSVs (`doe/`, `lambda_sweep/`, `bottle_validation/`), for easy cross-checking against the manifest. |
| `sample_vtk/` | Three example final settled-state VTK frames (one per category). |
| `README.md` | The bundle author's own notes (physics config, phi definition, gate definitions, contents). |

### `gp/` — fitted model coefficients
- `phi_gp.json` — the `phi(H, rho)` Gaussian Process (per family).
- `wall_gp.json` — the wall-correction law `phi_eff(lambda)` (per family).

These are copies of the canonical files in `src/packaging/model/`; they were not
modified.

---

## 2. Fixed DEM physics config (identical across every run)

| Parameter | Value |
|---|---|
| Solver | Aspherix 6.5.0 |
| Young's modulus E | 5.0e6 Pa |
| Poisson ratio nu | 0.25 |
| Coefficient of restitution e | 0.25 |
| Sliding friction mu | 0.01 |
| Rolling friction mu_r | 0.10 |
| Particle density rho | 1425 kg/m^3 (nominal; DOE also sweeps 1650 kg/m^3) |
| Timestep dt | 5e-6 s |
| Contact model | Hertz normal + history tangential + rolling-friction (`epsd2`) |
| Particle shape | convex mold gummy, family in {EC, DoryNew} |

Fixing physics once and varying only geometry / count is what makes the
data-driven fits meaningful.

---

## 3. Measurement and gate definitions

- **N = 150 gummies per cylinder** for the main DOE production runs.
- **Deep-bed phi:** settled bulk solid fraction measured on the whole settled
  bed of the wide DOE cylinder (lambda ~ 8), where wall and floor effects are
  proportionally small. For bottle runs, the same phi definition is applied
  inside the actual bottle STL geometry up to the settled fill height.
- **>= 90% particle-retention gate:** a run is trusted only if at least 90% of
  inserted particles end up inside the container. All 6 completed bottle runs
  retained 100%.

---

## 4. Known issue

`VB_DN_900_H150` (DoryNew, H = 15 mm, 900 cc bottle) crashed mid-solve with an
isolated Aspherix comm-buffer overflow and never reached a settled state; its
row in `validation_table.csv` is blank and is flagged `passed_90pct_gate =
False` in the manifest. This is a one-off solver/infrastructure failure on a
single off-nominal-height run, not a physics or model result -- do not read it
as "H=15 doesn't pack." The other 6 of 7 bottle-validation runs completed
cleanly at 100% retention and passed every engineering gate. The row is
preserved exactly as produced (not re-run, not backfilled) and is called out
in the workbook's `notes` column so it reads as a known, flagged item rather
than a missing or overlooked value.

Similarly, the main-DOE sheet includes 4 deliberate low-particle-count
convergence checks (`QC1`, `QC2`, `QC4`, `QC5`, at N=40/N=90) alongside the 32
full N=150 production runs. Their lower packing fraction is the expected,
physically-correct result of a shallower bed with more edge effects at low
particle count -- it is not a bad run. These rows are excluded from the GP
training set and are explicitly labeled `run_role = QC convergence check` in
the workbook, distinct from `run_role = Production` for the 32 rows that
actually trained the model. Nothing in this bundle is hidden or silently
dropped; every non-production row is unambiguously marked as such.

---

## 5. The 36-vs-32 DOE-run count (resolved)

The cluster manifest reports **36** DOE runs; the surrogate was trained on
**32**. These are consistent, not contradictory:

- `surrogate_table.csv` holds all 36 DOE rows: `EC01-15`, `DN01-15`, and
  `QC1-6`.
- **32** of those are the N = 150 production runs (DoryNew 16 + EC 16). These
  are exactly the training points in `phi_gp.json` (16 per family).
- The **4** excluded runs are `QC1`, `QC2`, `QC4`, `QC5` — deliberate
  sub-count bed-depth convergence checks at N = 40 and N = 90. They are not
  full deep beds, so they were intentionally left out of the GP fit. They are
  present, identically, in both the cluster copy and the in-repo copy.

So the 4 extra runs were **excluded by design**, not added after the GP was
fit. There is no data drift: the parity check found the cluster CSVs and the
in-repo canonical CSVs byte-identical (0 differing cells).

---

## 6. What is NOT in this bundle

Full Aspherix VTK dump histories (hundreds of intermediate frames per run,
tens to hundreds of MB per run) were deliberately excluded. They remain on the
cluster under each run's `post/` folder:

- Main DOE: `/home/health/fd2997/cylinder_doe/runs/<run_id>/`
- Lambda-sweep: `/home/health/fd2997/cylinder_doe/runs_lambda/<run_id>/`
- Bottle validation: `/home/health/fd2997/cylinder_doe/runs_bottle/<run_id>/`

Exact per-run paths are in `bundle/run_manifest.csv`
(`aspherix_input_deck_path`, `raw_output_path`). Pull specific runs on request,
e.g. `scp -r fd2997@<cluster-host>:/home/health/fd2997/cylinder_doe/runs/EC07 .`

Also not copied: the methodology companion docs on the cluster
(`INTEGRATION_HANDOFF.md`, `METHODOLOGY_AND_VALIDATION.md`,
`CONTINUE_FRIDAY.md`). The full methodology writeup lives in this repo at
[src/packaging/model/SURROGATE_CREATION_PROCESS.md](../../src/packaging/model/SURROGATE_CREATION_PROCESS.md).

---

## 7. Regenerating the workbook

`packing_fraction_raw_data.xlsx` is a build artifact. If any CSV or JSON in this
folder is updated, rebuild the workbook with:

```
python regenerate_xlsx.py
```

It reads `bundle/csvs/*.csv`, `bundle/run_manifest.csv`, and `gp/*.json`, and
writes `packing_fraction_raw_data.xlsx`. Requires only `pandas` + `openpyxl`.
