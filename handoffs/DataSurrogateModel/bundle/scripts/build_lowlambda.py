#!/usr/bin/env python3
"""
build_lowlambda.py -- extend the wall-correction sweep to SMALL bottles (4-8 oz).

The main lambda-sweep covers lambda = 3..6, but 4 oz bottles are only ~2.5-2.9
gummies across -- BELOW the lowest measured point, in the regime where the wall
effect is steepest.  Extrapolating the (1 - c/lambda) fit down there is risky, so
we MEASURE lambda = 2.5 and 2.75 directly to BRACKET the 4 oz point.

Narrow tubes can't hold a centre disk (a 2.5-wide tube has no room for a disk at
r=0 plus neighbours), so gummies pack as a RING against the wall.  flat_ring_grid
places n disks on a ring of radius (R - r_disk), n set by the no-overlap chord
condition, laid FLAT (thickness vertical) -- the physically correct dense small-
tube arrangement.  Runs go to runs_lambda/ alongside the rest.
"""
import math
from pathlib import Path

import build_run
import build_lambda
import gen_gummy

HERE = Path(__file__).parent.resolve()
DMULTS = [2.5, 2.75]
FLAT_ORIENT = {"EC": ((1.0, 0.0, 0.0), 90.0),      # EC axis Y -> vertical
               "DoryNew": ((0.0, 0.0, 1.0), 0.0)}   # DoryNew axis Z -> vertical


def flat_ring_grid(family):
    def grid_stack(count, R_cyl_m, D_base_m, gummy_h_m, seed=42):
        rd = 0.5 * D_base_m
        pit_z = gummy_h_m * 1.20 + 5e-4
        pts = []
        # concentric rings from the wall inward; each ring radius spaced ~D apart
        ring_r = R_cyl_m - rd * 1.02
        while ring_r > 0:
            ratio = rd / ring_r if ring_r > rd else 1.0
            if ratio >= 1.0:
                # too small for a ring -> single centre disk, done
                pts.append((0.0, 0.0))
                break
            n = int(math.floor(math.pi / math.asin(ratio)))
            n = max(n, 1)
            off = (len(pts) % 2) * (math.pi / n)   # stagger successive rings
            for i in range(n):
                a = 2 * math.pi * i / n + off
                pts.append((ring_r * math.cos(a), ring_r * math.sin(a)))
            ring_r -= D_base_m * 0.90               # next inner ring
            if ring_r < rd * 0.5:                   # room for a centre disk?
                if ring_r > -rd:
                    pts.append((0.0, 0.0))
                break
        if not pts:
            pts = [(0.0, 0.0)]
        per_layer = len(pts)
        ax, ang = FLAT_ORIENT[family]
        out = []
        z0 = gummy_h_m * 0.6 + 0.002
        for i in range(count):
            layer = i // per_layer
            x, y = pts[i % per_layer]
            z = z0 + layer * pit_z
            out.append((x, y, z, ax, ang))
        return out, per_layer
    return grid_stack


def plan():
    runs = []
    for family, H in build_lambda.NOMINAL_H.items():
        info = gen_gummy.generate(family, H, "/tmp/_low_probe.stl")
        dbase = info["D_base_mm"]; vg = info["vol_mm3"]
        for dm in DMULTS:
            gs = flat_ring_grid(family)
            _, per = gs(1000, dm * dbase / 2000.0, dbase / 1000.0, H / 1000.0)
            D_cyl = dm * dbase
            area = math.pi / 4.0 * D_cyl ** 2
            count = max(int(round(0.50 * area * (6 * H) / vg)), 12)
            runs.append({"run_id": "LAM_%s_d%d" % ("EC" if family == "EC" else "DN",
                                                    int(dm * 100)),
                         "family": family, "H_mm": H, "density": build_lambda.RHO_NOM,
                         "count": count, "dmult": dm, "per_layer": per,
                         "d_base_mm": dbase})
    return runs


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--submit", action="store_true")
    a = ap.parse_args()
    runs = plan()
    print("LOW-lambda sweep (4 oz coverage) -- %d runs" % len(runs))
    for r in runs:
        print("  %-12s %-8s lambda=%.2f  N=%d  per_layer=%d" %
              (r["run_id"], r["family"], r["dmult"], r["count"], r["per_layer"]))
    if a.list:
        return 0
    build_run.RUNS = HERE / "runs_lambda"
    build_run.SIM_TIME = 6.0
    orig = build_run.grid_stack
    for r in runs:
        build_run.grid_stack = flat_ring_grid(r["family"])
        build_run.build(r["run_id"], r["family"], r["H_mm"], r["density"],
                        count=r["count"], dmult=r["dmult"],
                        ncores=8, walltime="4:00", submit=a.submit)
    build_run.grid_stack = orig
    print("\n%d low-lambda runs %s" % (len(runs), "SUBMITTED" if a.submit else "built (dry)"))


if __name__ == "__main__":
    main()
