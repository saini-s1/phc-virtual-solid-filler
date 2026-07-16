# Gummy Packing DEM — Handoff Bundle

Snapshot date: 2026-07-15. Source: `/home/health/fd2997/cylinder_doe/` on the
DEM compute cluster. **This bundle is a read-only snapshot** — nothing was
re-run, no raw output was modified, and no φ values were re-derived from VTK
where a post-processed number already existed (see §6).

## 1. Fixed physics config (identical across every run in this bundle)

| parameter | value |
|---|---|
| Solver | Aspherix 6.5.0 |
| Young's modulus E | 5.0e6 Pa |
| Poisson ratio ν | 0.25 |
| Coefficient of restitution e | 0.25 |
| Sliding friction μ | 0.01 |
| Rolling friction μ_r | 0.10 |
| Particle density ρ | 1425 kg/m³ (nominal; DOE also sweeps 1650/1425-2560 kg/m³ per family — see `csvs/surrogate_table.csv`) |
| Timestep | 5e-6 s |
| Contact model | Hertz normal + history tangential + `rolling_friction epsd2` |
| Particle shape | convex mold gummy, family ∈ {EC, DoryNew} |

## 2. Deep-bed φ measurement definition

For cylinder runs (main DOE + λ-sweep), `postprocess_cyl.py` measures the
**settled bulk solid fraction** from the final `particles*.vtk` dump:

```
phi = N_in * V_gummy / (pi * R^2 * h_bed)
```
- `N_in`: particles whose centroid radius ≤ cylinder radius (excludes any that
  leaked over the open rim).
- `h_bed`: p98 of settled-particle heights + half a gummy height (free-surface
  estimate, robust to a few outlier/bouncing particles).
- This is a **whole-bed** measurement (not a windowed slice away from the
  floor) — "deep bed" refers to the bulk cylinder geometry (λ≈8 for the main
  DOE) being deep/wide enough that wall and floor effects are proportionally
  small, as opposed to a real bottle.

For full-bottle validation runs, `analyze_bottle.py` measures the same φ
definition but **inside the actual bottle STL geometry** up to the settled
fill height, plus a retention/leak check against the bottle wall.

## 3. Retention / gate definitions

- **Bottle validation ≥90% retention gate**: `N_settled_inside_bottle / N_target
  >= 0.90`. Below this, a run is not trusted (large leak). All 6 completed
  bottle runs in this bundle retained 100%.
- **`passed_90pct_gate` in `run_manifest.csv`** applies this same threshold to
  every run (DOE and λ-sweep runs also show retention against the cylinder
  wall; all are 100% by construction — see `CONTINUE_FRIDAY.md`/memory for the
  leak-fix history).
- One bottle run, **`VB_DN_900_H150`** (DoryNew, H=15mm, 900cc bottle),
  **crashed** during the solve (Aspherix comm-buffer overflow: "Contact/property
  /atom has too much data to transfer in forward comm", large-particle mesh
  neighborhood issue) and never reached a settled state. It has **no φ, no
  retention, no fill measurement** — `analyze_bottle.py` wrote a blank
  placeholder row in `validation_table.csv`, preserved as-is. In
  `run_manifest.csv` this row appears with blank `N_retained` /
  `retention_pct` / `phi_deepbed` and `passed_90pct_gate=False`. This is a
  **known solver failure, not a physics result** — do not interpret it as
  "H=15 doesn't pack." See `INTEGRATION_HANDOFF.md` §7 caveat 3 for the full
  writeup and suggested fix (coarser mesh / gentler insertion / comm settings).

## 4. Bundle contents

```
csvs/                     the 3 canonical post-processed CSVs, copied verbatim
input_decks/              1 representative Aspherix input deck per category
scripts/                  driver + post-processing scripts (byte-identical copies)
deep_bed_measurements/    per-run single-row CSVs, split from the canonical CSVs
run_manifest.csv          1 row per DEM run (55 rows) -- cross-reference table
sample_vtk/               3 example final-settled-state VTKs (one per category)
README.md                 this file
```

### `csvs/`
- `surrogate_table.csv` (36 rows) — main DOE, trains `phi(H, density | family)`.
- `lambda_table.csv` (12 rows) — cylinder λ-sweep, trains the wall-correction
  law `phi_eff(lambda)`.
- `validation_table.csv` (7 rows, 1 blank/crashed) — full-bottle validation,
  predicted vs simulated.

### `input_decks/` (one example per category — not all 55)
- `DOE_example_EC07/` — EC family, H=9.5mm (nominal), ρ=1425 kg/m³, N=150,
  grid role. `generator_command.txt` gives the exact reproduction command.
- `lambda_sweep_example_LAM_EC_d4/` — EC family, nominal H, dmult=4 (λ≈4,
  mid-range, inside the DEM-validated λ 3.9–4.7 band).
- `bottle_validation_example_VB_EC_500/` — EC family, H=9.5mm, 500cc bottle
  mesh, N=153, PASS.

Each folder has `creation.asx`, `packing.asx`, `run_config.json`, and (for the
bottle example) `prediction.json` + `submit.sh`. **All 55 full run folders**
(every input deck + raw log + full VTK dump history) remain on the cluster at
the paths listed in `run_manifest.csv` (`aspherix_input_deck_path` /
`raw_output_path`) — pull any of them on request, e.g.:
```
scp -r fd2997@<cluster-host>:/home/health/fd2997/cylinder_doe/runs/EC07 .
```

### `scripts/`
Byte-identical copies (verified by md5sum, see §7) of:
`gen_gummy.py`, `gen_cylinder.py`, `build_run.py`, `build_doe.py`,
`build_doe2.py`, `build_lambda.py`, `build_lowlambda.py`, `rebuild_narrow.py`,
`build_bottle.py`, `postprocess_cyl.py`, `analyze_bottle.py`,
`bottle_translate.py`, plus `doe_design.csv` (the 36-run DOE manifest that
`build_doe2.py` reads). Not rewritten or reformatted.

### `deep_bed_measurements/`
One CSV per run (`<run_id>.csv`), split directly from the matching canonical
CSV row (`doe/` ← `surrogate_table.csv`, `lambda_sweep/` ← `lambda_table.csv`,
`bottle_validation/` ← `validation_table.csv`). **These numbers are NOT
re-derived from VTK** — they are the existing post-processed values, just
split to per-run granularity for easy cross-checking against `run_manifest.csv`.

### `sample_vtk/`
The final settled-state `particles*.vtk` frame for the 3 representative runs
above. All final frames across all 55 runs are small (N≤252 particles, a few
KB–6 KB each) — these 3 are included as a format example, not because size
was a constraint. **Full VTK dump histories (hundreds of intermediate frames
per run, tens–hundreds of MB per run) were deliberately excluded** — they live
on the cluster under each run's `post/` folder (see `raw_output_path` in
`run_manifest.csv`); request specific ones by run_id if needed.

## 5. Run counts

| category | folder on cluster | canonical CSV | runs |
|---|---|---|---|
| DOE (main, N=150, H×ρ) | `cylinder_doe/runs/` | `surrogate_table.csv` | 36 (EC01-15, DN01-15, QC1-6) |
| λ-sweep (wall correction) | `cylinder_doe/runs_lambda/` | `lambda_table.csv` | 12 (EC/DoryNew × λ{2.5,2.75,3,4,5,6}) |
| Bottle validation | `cylinder_doe/runs_bottle/` | `validation_table.csv` | 7 (1 crashed, see §3) |
| **Total** | | | **55** |

## 6. What was NOT done (by design)

- No Aspherix jobs were re-run.
- No raw output was modified.
- No φ value was re-derived from a VTK where `postprocess_cyl.py` /
  `analyze_bottle.py` already produced one — every number in
  `run_manifest.csv` and `deep_bed_measurements/` traces back to the existing
  canonical CSV row (see cross-check results reported separately).
- Full VTK dump histories were not copied (see §4).

## 7. Reference docs (context, not reproduced here)

For the full surrogate methodology, the wall-law fit, and validation
discussion, see `scripts/` companions (not copied into this bundle, still on
cluster): `cylinder_doe/INTEGRATION_HANDOFF.md`,
`cylinder_doe/METHODOLOGY_AND_VALIDATION.md`,
`cylinder_doe/CONTINUE_FRIDAY.md`. Ask if you want these included too.
