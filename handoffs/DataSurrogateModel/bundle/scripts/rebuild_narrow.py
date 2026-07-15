#!/usr/bin/env python3
"""
rebuild_narrow.py -- rebuild the narrow lambda-sweep tubes that crashed.

The default grid_stack uses an orientation-invariant bounding-sphere pitch, which
is far too conservative for narrow tubes (lambda<=4): only the centre column fits,
producing a single ~1 m-tall column that crashes the MPI domain decomposition.

Fix: pack these tubes FLAT -- gummy thickness (h) vertical, footprint = base
diameter (D_base) -- which is exactly how flat gummies settle anyway.  Horizontal
pitch = D_base (just touching, no initial overlap), vertical pitch = 1.2 h.  This
lets several columns fit even at lambda=3, giving a well-conditioned 3-D bed.
Fewer cores (8) also avoids thin-domain decomposition aborts.
"""
import math
import random
from pathlib import Path

import build_run
import build_lambda

FAILED = ["LAM_EC_d3", "LAM_DN_d3", "LAM_DN_d4"]
# lay the gummy flat: map its template height-axis onto world Z (thickness up).
FLAT_ORIENT = {"EC": ((1.0, 0.0, 0.0), 90.0),   # EC axis=Y -> rotate 90deg about X
               "DoryNew": ((0.0, 0.0, 1.0), 0.0)}  # DoryNew axis=Z -> already vertical


def make_flat_grid(family):
    def grid_stack(count, R_cyl_m, D_base_m, gummy_h_m, seed=42):
        pit_xy = D_base_m * 0.98                 # flat footprint, just touching
        pit_z = gummy_h_m * 1.20 + 5e-4          # thickness stack, no overlap
        r_lim = R_cyl_m - D_base_m * 0.48        # base edge may rest on wall
        if r_lim < 0:
            r_lim = 0.0
        pts = []
        k = int(r_lim / pit_xy) + 1
        for ix in range(-k, k + 1):
            for iy in range(-k, k + 1):
                x, y = ix * pit_xy, iy * pit_xy
                if math.hypot(x, y) <= r_lim:
                    pts.append((x, y))
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


def main():
    runs = {r["run_id"]: r for r in build_lambda.plan()}
    build_run.RUNS = build_lambda.HERE / "runs_lambda"
    build_run.SIM_TIME = 5.0
    orig = build_run.grid_stack
    for rid in FAILED:
        r = runs[rid]
        build_run.grid_stack = make_flat_grid(r["family"])
        build_run.build(rid, r["family"], r["H_mm"], r["density"],
                        count=r["count"], dmult=r["dmult"],
                        ncores=8, walltime="4:00", submit=True)
    build_run.grid_stack = orig
    print("\nrebuilt + resubmitted (flat packing, 8 cores): %s" % ", ".join(FAILED))


if __name__ == "__main__":
    main()
