# Gummy-Bottle Packing Surrogate — portable bundle

Self-contained, **pure Python 3 standard library** (no numpy/scipy needed for the
core model). Runs anywhere Python 3.8+ is installed. `matplotlib` is only needed
if you add plotting in your UI.

## What's inside
```
gummy_bottle_model.py   <- the end-to-end model (import THIS)
wall_gp.py              <- phi_eff(lambda) wall/size law (GP)
gp_surrogate.py         <- GP(H, density) gummy-parameter surrogate
bottle_translate.py     <- STL reader + fill/slack/shoulder geometry
gen_gummy.py            <- mold-constrained gummy generator
wall_correction.py      <- legacy wall-law fallback
*.json / *.csv          <- trained coefficients + validation data (auto-loaded)
refs/                   <- REQUIRED reference gummy STLs (EC25mm, DoryNew)
bottles/                <- example validated bottle STLs (500/750/900 cc)
INTEGRATION_HANDOFF.md  <- full physics/validation write-up (read this)
```
Keep this folder structure intact — the code auto-loads the JSON/CSV coefficients
and the `refs/` STLs relative to the scripts.

## Quick start (CLI)
```bash
# predict how a gummy fills a bottle
python3 gummy_bottle_model.py --family EC --H 9.5 --density 1425 \
        --stl bottles/500cc_bottle.stl --count 153

# a brand-new bottle from dimensions (mm), machine-readable output
python3 gummy_bottle_model.py --family DoryNew --H 13 --density 1425 \
        --new-bottle "body_D=70,body_H=110,shoulder_H=25,neck_D=28" --json
```

## UI integration (import API)
```python
from gummy_bottle_model import evaluate, recommend_bottle

rep = evaluate(
    family="EC",              # "EC" or "DoryNew"
    H_mm=9.5,                 # gummy total height (mm)
    density=1425,             # kg/m^3
    bottle_spec={"stl": "bottles/500cc_bottle.stl"},   # or {"new_dims": {...}} / {"preset": "625cc"}
    target_count=153,         # optional label-claim count
)

# key outputs in rep:
rep["phi_used"]                 # packing fraction
rep["lambda_gummies_across"]    # lambda
rep["N_gummies_at_shoulder"]    # ideal fill-to-shoulder count
rep["ideal_fill_pct_of_H"]      # % of bottle height at ideal fill
rep["slack_fill_pct_ideal"]     # headspace/slack %
rep["gummy_mass_g"], rep["bulk_density_kgm3"]
rep["in_validated_domain"]      # True if inside the validated envelope
rep["validity_warnings"]        # list of reasons if outside (EXTRAPOLATION)
```
`recommend_bottle(family, H_mm, density, target_count, bottles=[...])` ranks
candidate bottles best-first for a target count.

## Where the model is VALID (enforced by `in_validated_domain`)
- lambda (gummies across) = body diameter / gummy base diameter: **2.5 – 6.0**
- EC gummy height: **6.5 – 11.5 mm**
- DoryNew gummy height: **10 – 15 mm** (H=11 DEM-confirmed; 13->15 trusted, not DEM-confirmed)
- density: inside the trained GP box
Outside these the tool still returns a number but sets `in_validated_domain=False`
and lists the reason in `validity_warnings` — treat those as extrapolation.

## Not validated / excluded
- Squat jars / bottles with no straight cylindrical body (e.g. 300 cc, 8 oz).
- Parametric mode assumes a **flat base** — for punt/rounded bases use a real STL.

See `INTEGRATION_HANDOFF.md` for the full physics, DEM validation table, and caveats.
