#!/usr/bin/env python3
"""
build_lambda.py -- WALL-CORRECTION study for the gummy packing surrogate.

WHY
---
The cylinder DOE measured the BULK solid fraction phi_bulk(H, density | family),
which turned out to be ~constant per family (EC ~0.515, DoryNew ~0.511).  Real
bottles, however, are only a few gummies wide, so wall exclusion lowers the
EFFECTIVE phi.  The controlling dimensionless number is

        lambda = container_diameter / gummy_base_diameter  ("gummies across")

Classic finite-size packing theory: phi_eff(lambda) = phi_bulk * (1 - c/lambda),
i.e. a wall-void correction that vanishes as lambda -> infinity.  This script
sweeps lambda by varying the cylinder width multiplier `dmult` at NOMINAL H and
density, keeping the bed ~6 layers deep (N scaled with cross-section) so the
bottom-wall effect is held constant and only the SIDE-wall (lambda) effect moves.

The resulting phi_eff(lambda) curve is the wall correction that lets the bulk
surrogate predict fill heights for ANY bottle size (the project goal).  A handful
of real-bottle runs + the free 110-count reference then CONFIRM the cylinder
proxy matches true bottle geometry.

This is far cheaper than the legacy 60-run full-bottle DOE and yields a
*continuous* correction instead of 3 discrete bottle points.

Runs are written to  runs_lambda/  (NOT runs/) so they never contaminate the
phi_bulk surrogate table.

Usage:
    python3 build_lambda.py --list
    python3 build_lambda.py            # dry build into runs_lambda/
    python3 build_lambda.py --submit
"""
import argparse
import math
from pathlib import Path

import build_run
import gen_gummy

HERE = Path(__file__).parent.resolve()

# nominal shape per family (H4) + nominal density; isolate the lambda effect
NOMINAL_H = {"EC": 9.5, "DoryNew": 13.0}
RHO_NOM = 1425.0
DMULTS = [3.0, 4.0, 5.0, 6.0]     # lambda values; main DOE supplies lambda~8
TARGET_LAYERS = 6                 # target settled bed depth (in gummy heights)
PHI_GUESS = 0.50                  # only used to size N; actual phi is measured
NCORES = 16
WALLTIME = "4:00"


def probe(family, H_mm, dmult):
    """Return (per_layer, D_base_mm, Vg_mm3) for a given width."""
    info = gen_gummy.generate(family, H_mm, "/tmp/_lam_probe.stl")
    dbase_m = info["D_base_mm"] / 1000.0
    R_m = dmult * dbase_m / 2.0
    _, per_layer = build_run.grid_stack(1000, R_m, dbase_m, H_mm / 1000.0)
    return per_layer, info["D_base_mm"], info["vol_mm3"]


def plan():
    runs = []
    for family, H in NOMINAL_H.items():
        for dmult in DMULTS:
            per_layer, dbase, vg = probe(family, H, dmult)
            # size N to fill the tube to ~TARGET_LAYERS gummy-heights deep, so
            # the bottom-wall effect is held ~constant and only lambda varies.
            D_cyl = dmult * dbase                      # mm
            area = math.pi / 4.0 * D_cyl ** 2          # mm^2
            H_bed = TARGET_LAYERS * H                  # mm
            count = int(round(PHI_GUESS * area * H_bed / vg))
            count = max(count, 20)                     # floor for a meaningful sample
            runs.append({
                "run_id": "LAM_%s_d%d" % ("EC" if family == "EC" else "DN", int(dmult)),
                "family": family, "H_mm": H, "density": RHO_NOM,
                "count": count, "dmult": dmult, "lambda": dmult,
                "per_layer": per_layer, "d_base_mm": dbase,
            })
    return runs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--submit", action="store_true")
    ap.add_argument("--ncores", type=int, default=NCORES)
    ap.add_argument("--walltime", default=WALLTIME)
    a = ap.parse_args()

    runs = plan()

    if a.list:
        print("LAMBDA (wall-correction) sweep -- %d runs, written to runs_lambda/" % len(runs))
        print("%-10s %-8s %5s %7s %6s %6s %8s" %
              ("id", "family", "H", "lambda", "N", "/layer", "D_base"))
        for r in runs:
            print("%-10s %-8s %5.1f %7.1f %6d %6d %8.2f" %
                  (r["run_id"], r["family"], r["H_mm"], r["lambda"],
                   r["count"], r["per_layer"], r["d_base_mm"]))
        print("\nmain DOE already provides the lambda~8 bulk anchor "
              "(EC07/13/14/15 @H9.5, DN07/13/14/15 @H13).")
        return 0

    # redirect build output to runs_lambda/ so phi_bulk table stays clean
    build_run.RUNS = HERE / "runs_lambda"
    # narrow tubes get tall single-column initial stacks (bounding-sphere pitch);
    # give extra settling time so the column fully compacts/rearranges to static.
    build_run.SIM_TIME = 5.0
    for r in runs:
        build_run.build(
            r["run_id"], r["family"], r["H_mm"], r["density"],
            count=r["count"], dmult=r["dmult"],
            ncores=a.ncores, walltime=a.walltime, submit=a.submit)
    print("\n%d lambda-sweep runs %s -> runs_lambda/"
          % (len(runs), "SUBMITTED" if a.submit else "built (dry)"))
    if not a.submit:
        print("re-run with --submit to queue them (job group /fd2997/cyl_doe, -L 6).")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
