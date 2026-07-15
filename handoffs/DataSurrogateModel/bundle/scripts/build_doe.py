#!/usr/bin/env python3
"""
build_doe.py -- Build (and optionally submit) the FULL cylinder-DOE:
  * C1-C12   EC        H1..H6 x density (ascending, then reversed)
  * C13-C24  DoryNew   H1..H6 x density (ascending, then reversed)
  * CC1-CC8  count-sensitivity  (H4 mid geometry, mid density, N=30/60/100/150)

All runs are built with the leak-fixed builder (tube encloses the insertion
stack) and the data-isolated submit script (each job cd's into its own folder,
so concurrent runs never collide on the fixed-name outputs).

Physics notes baked in:
  * phi (rigid-particle solid fraction) is set by SHAPE (H aspect ratio), and is
    ~independent of material density -> the density sweep chiefly maps BULK
    DENSITY (= phi*rho) and confirms density-invariance of phi.
  * count sweep (CC) verifies phi is bulk-invariant (count-independent) once the
    bed is a few gummies deep.

Usage:
    python3 build_doe.py                 # build all, no submit (dry)
    python3 build_doe.py --submit        # build + bsub all
    python3 build_doe.py --only C1 C4    # subset
    python3 build_doe.py --list          # print the table only
"""
import argparse

import build_run

# Shared height levels (mm) -- H1..H6
H = [8.0, 9.5, 11.0, 12.5, 14.0, 15.5]

# Density sweeps (kg/m3)
EC_RHO   = [800, 1120, 1440, 1760, 2080, 2400]      # centred on real ~1760
DORY_RHO = [960, 1280, 1600, 1920, 2240, 2560]      # centred on real ~1760-1920

EC_MID_RHO   = 1760.0
DORY_MID_RHO = 1920.0
H4 = H[3]  # 12.5 mm mid geometry

C_COUNT = 150          # bulk sample size for the main design
CC_COUNTS = [30, 60, 100, 150]

NCORES = 16            # measured 13.5 min @16 cores for N=150
WALLTIME = "0:30"      # >2x the measured worst case; safe head-room


def doe_table():
    """Return an ordered list of run dicts."""
    runs = []
    # --- EC main + reversed ---
    for i in range(6):                                  # C1..C6 ascending
        runs.append(dict(id=f"C{i+1}", family="EC", H=H[i],
                         rho=EC_RHO[i], count=C_COUNT))
    for i in range(6):                                  # C7..C12 reversed rho
        runs.append(dict(id=f"C{i+7}", family="EC", H=H[i],
                         rho=EC_RHO[5 - i], count=C_COUNT))
    # --- DoryNew main + reversed ---
    for i in range(6):                                  # C13..C18 ascending
        runs.append(dict(id=f"C{i+13}", family="DoryNew", H=H[i],
                         rho=DORY_RHO[i], count=C_COUNT))
    for i in range(6):                                  # C19..C24 reversed rho
        runs.append(dict(id=f"C{i+19}", family="DoryNew", H=H[i],
                         rho=DORY_RHO[5 - i], count=C_COUNT))
    # --- count sensitivity ---
    for j, n in enumerate(CC_COUNTS):                   # CC1..CC4 EC
        runs.append(dict(id=f"CC{j+1}", family="EC", H=H4,
                         rho=EC_MID_RHO, count=n))
    for j, n in enumerate(CC_COUNTS):                   # CC5..CC8 DoryNew
        runs.append(dict(id=f"CC{j+5}", family="DoryNew", H=H4,
                         rho=DORY_MID_RHO, count=n))
    return runs


def print_table(runs):
    print(f"{'ID':<6}{'family':<9}{'H_mm':>6}{'rho':>7}{'N':>6}")
    print("-" * 34)
    for r in runs:
        print(f"{r['id']:<6}{r['family']:<9}{r['H']:>6}{r['rho']:>7.0f}{r['count']:>6}")
    print("-" * 34)
    print(f"total runs: {len(runs)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--submit", action="store_true", help="bsub each run")
    ap.add_argument("--only", nargs="*", default=None, help="subset of run IDs")
    ap.add_argument("--list", action="store_true", help="print the table and exit")
    ap.add_argument("--ncores", type=int, default=NCORES)
    ap.add_argument("--walltime", default=WALLTIME)
    a = ap.parse_args()

    runs = doe_table()
    if a.only:
        runs = [r for r in runs if r["id"] in set(a.only)]

    if a.list:
        print_table(runs)
        return

    print_table(runs)
    print()
    for r in runs:
        build_run.build(
            run_id=r["id"], family=r["family"], H_mm=r["H"],
            density=r["rho"], count=r["count"], dmult=5.0,
            ncores=a.ncores, walltime=a.walltime, seed=42, submit=a.submit)

    if not a.submit:
        print("\n(DRY build only -- rerun with --submit to queue the jobs)")


if __name__ == "__main__":
    main()
