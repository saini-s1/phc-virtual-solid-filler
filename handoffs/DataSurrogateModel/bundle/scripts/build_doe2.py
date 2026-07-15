#!/usr/bin/env python3
"""
build_doe2.py -- Family-specific H1..H6 DOE for the phi(H | family) surrogate.

Aligned with the realistic 110-count reference model (CoF=0.01, capped tube,
overlap-free insertion).  Each family sweeps SIX height levels on its own mold
curve, centred on its REAL nominal height (H4):

    EC       H4 = 9.5 mm   ->  H1..H6 = 6.5 .. 11.5 mm
    DoryNew  H4 = 13.0 mm  ->  H1..H6 = 10.0 .. 15.0 mm

Design per family (15 runs):
    * 6 H-levels x 2 densities = 12   -> the phi(H, rho) surface
    * 3 centre replicates (H4, rho_nom, different seeds) -> noise / GP nugget
QC (6 runs):
    * count sensitivity N in {40,90,150} at (H4, rho_nom) x 2 families
      -> confirms phi is bulk/count-invariant (N=150 is near plateau)

Total = 36 runs.  A manifest (doe_design.csv) records every run's role.

Usage:
    python3 build_doe2.py --list          # print design + manifest, no build
    python3 build_doe2.py                 # dry build all folders
    python3 build_doe2.py --submit        # build + bsub all
"""
import argparse
import csv
from pathlib import Path

import build_run

HERE = Path(__file__).parent.resolve()

# family-specific height levels (mm); H4 (index 3) is the real nominal height
H_LEVELS = {
    "EC":      [6.5, 7.5, 8.5, 9.5, 10.5, 11.5],
    "DoryNew": [10.0, 11.0, 12.0, 13.0, 14.0, 15.0],
}
H4 = {"EC": 9.5, "DoryNew": 13.0}
RHO_LEVELS = [1425.0, 1650.0]               # reference density + realistic contrast
RHO_NOM = 1425.0                            # validated 110-count value
N_REP = 3                                   # centre replicates (seeds)
C_COUNT = 150
QC_COUNTS = [40, 90, 150]
DMULT = 8.0                                 # wider tube -> better bulk phi, short stack
NCORES = 16
WALLTIME = "4:00"


def family_runs(family, prefix):
    hs = H_LEVELS[family]
    runs = []
    k = 1
    # 6 H-levels x 2 densities  (the phi(H, rho) surface)
    for h in hs:
        for rho in RHO_LEVELS:
            runs.append(dict(id=f"{prefix}{k:02d}", family=family,
                             H=round(h, 3), rho=round(rho, 1),
                             count=C_COUNT, seed=42, role="grid"))
            k += 1
    # 3 centre replicates at (H4, rho_nom), different seeds -> noise floor
    for s in range(N_REP):
        runs.append(dict(id=f"{prefix}{k:02d}", family=family,
                         H=round(H4[family], 3), rho=RHO_NOM,
                         count=C_COUNT, seed=100 + s, role="replicate"))
        k += 1
    return runs


def qc_runs():
    runs = []
    k = 1
    for fam in ("EC", "DoryNew"):
        for n in QC_COUNTS:
            runs.append(dict(id=f"QC{k}", family=fam, H=H4[fam],
                             rho=RHO_NOM, count=n, seed=42, role="count-val"))
            k += 1
    return runs


def doe_table():
    runs = family_runs("EC", "EC")
    runs += family_runs("DoryNew", "DN")
    runs += qc_runs()
    return runs


def write_manifest(runs, path):
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["id", "family", "H", "rho", "count", "seed", "role"])
        w.writeheader()
        for r in runs:
            w.writerow(r)


def print_table(runs):
    print(f"{'ID':<6}{'family':<9}{'H_mm':>7}{'rho':>8}{'N':>6}{'seed':>6}  role")
    print("-" * 52)
    for r in runs:
        print(f"{r['id']:<6}{r['family']:<9}{r['H']:>7.2f}{r['rho']:>8.0f}"
              f"{r['count']:>6}{r['seed']:>6}  {r['role']}")
    print("-" * 52)
    print(f"total runs: {len(runs)}  "
          f"(EC 15 + DoryNew 15 + QC {len(runs)-30})")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--submit", action="store_true")
    ap.add_argument("--only", nargs="*", default=None)
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--ncores", type=int, default=NCORES)
    ap.add_argument("--walltime", default=WALLTIME)
    a = ap.parse_args()

    runs = doe_table()
    write_manifest(runs, HERE / "doe_design.csv")
    if a.only:
        runs = [r for r in runs if r["id"] in set(a.only)]

    print_table(runs)
    if a.list:
        print(f"\nmanifest -> {HERE/'doe_design.csv'}")
        return
    print()
    for r in runs:
        build_run.build(run_id=r["id"], family=r["family"], H_mm=r["H"],
                        density=r["rho"], count=r["count"], dmult=DMULT,
                        ncores=a.ncores, walltime=a.walltime,
                        seed=r["seed"], submit=a.submit)
    if not a.submit:
        print("\n(DRY build only -- rerun with --submit to queue the jobs)")


if __name__ == "__main__":
    main()
