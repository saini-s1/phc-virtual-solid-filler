#!/usr/bin/env python3
"""
postprocess_cyl.py -- Extract the bulk SOLID FRACTION (phi) and bed metrics
from a settled cylinder-DOE run.

This is the PRIMARY surrogate output: phi = N_in * V_gummy / (pi R^2 h_bed),
measured in the normalized cylinder. phi (and the bulk density it implies) is
what gets applied to bottle V(h) curves in bottle_translate.py.

Usage:
    python3 postprocess_cyl.py runs/FEAS_EC_H4
    python3 postprocess_cyl.py runs/FEAS_EC_H4 --json
"""
import argparse
import json
import math
import struct
import sys
from pathlib import Path


# ----------------------------------------------------------------------------
# BINARY VTK PARSER (Aspherix 6.5.0 POLYDATA, big-endian)
# ----------------------------------------------------------------------------
def _read_line(f):
    buf = b""
    while True:
        c = f.read(1)
        if not c or c == b"\n":
            return buf.decode("latin1").strip()
        buf += c


def parse_vtk(path):
    """Return (xs, ys, zs, radii) in metres from a binary POLYDATA VTK."""
    with open(path, "rb") as f:
        n_points = None
        while True:
            line = _read_line(f)
            if line.startswith("POINTS"):
                n_points = int(line.split()[1])
                break
            if not line and not f.read(1):
                raise ValueError(f"No POINTS in {path.name}")
        if not n_points:
            raise ValueError(f"Zero particles in {path.name}")
        raw = f.read(n_points * 3 * 4)
        coords = struct.unpack(f">{n_points * 3}f", raw)
        xs = [coords[i * 3]     for i in range(n_points)]
        ys = [coords[i * 3 + 1] for i in range(n_points)]
        zs = [coords[i * 3 + 2] for i in range(n_points)]
        radii = None
        for _ in range(200):
            line = _read_line(f)
            if line.startswith("radius"):
                nr = int(line.split()[2])
                radii = list(struct.unpack(f">{nr}d", f.read(nr * 8)))
                break
            if line.startswith("id"):
                ni = int(line.split()[2])
                f.read(ni * 4)
        if radii is None:
            raise ValueError(f"No radius field in {path.name}")
    return xs, ys, zs, radii


# ----------------------------------------------------------------------------
def _quantile(vals, q):
    if not vals:
        return 0.0
    s = sorted(vals)
    i = q * (len(s) - 1)
    lo = int(math.floor(i))
    hi = int(math.ceil(i))
    if lo == hi:
        return s[lo]
    return s[lo] + (s[hi] - s[lo]) * (i - lo)


def final_vtk(run_dir):
    post = run_dir / "post"
    vtks = sorted(post.glob("particles*.vtk"),
                  key=lambda p: int("".join(filter(str.isdigit, p.stem)) or "0"))
    # exclude boundingBox etc. (already excluded by 'particles<digits>.vtk' glob
    # only if names match; filter defensively)
    vtks = [p for p in vtks if p.stem[len("particles"):].isdigit()]
    if not vtks:
        raise FileNotFoundError(f"No particles*.vtk in {post}")
    return vtks[-1]


def analyze(run_dir):
    run_dir = Path(run_dir)
    cfg = json.loads((run_dir / "run_config.json").read_text())

    R = cfg["cyl_diameter_mm"] / 2000.0          # m
    H_tube = cfg["cyl_height_mm"] / 1000.0        # m
    Vg = cfg["gummy_vol_mm3"] * 1e-9              # m^3
    rho_solid = cfg["density_kgm3"]
    gummy_h = cfg["H_mm"] / 1000.0                # m
    N_created = cfg["count"]

    vtk = final_vtk(run_dir)
    xs, ys, zs, radii = parse_vtk(vtk)
    n_all = len(xs)

    # keep only particles whose CENTROID is inside the tube radius (settled bed)
    rad = [math.hypot(xs[i], ys[i]) for i in range(n_all)]
    inside = [i for i in range(n_all) if rad[i] <= R * 1.001]
    n_in = len(inside)
    n_leaked = N_created - n_in

    z_in = [zs[i] for i in inside]
    r_in = [rad[i] for i in inside]

    # bed surface height: robust top of the settled bed
    #   use p98 of particle centroids + one gummy half-height (top of top layer)
    z_top_p98 = _quantile(z_in, 0.98)
    z_top_max = max(z_in) if z_in else 0.0
    h_bed = z_top_p98 + gummy_h / 2.0            # bed free-surface estimate

    V_bed = math.pi * R * R * h_bed
    V_solid = n_in * Vg

    phi = V_solid / V_bed if V_bed > 0 else float("nan")
    rho_bulk = phi * rho_solid

    # bed aspect (bulk-sample quality checks)
    bed_over_D = h_bed / (2 * R)
    gummies_across = 2 * R / cfg["d_base_mm"] * 1000.0 if False else (2 * R) / (cfg["d_base_mm"] / 1000.0)
    layers_deep = h_bed / gummy_h

    # radial fill fraction (how close bed reaches wall)
    r_fill = (max(r_in) / R) if r_in else float("nan")

    # surface roughness: std of top-layer centroids
    n_topband = max(1, n_in // 8)
    top_band = sorted(z_in, reverse=True)[:n_topband]
    mean_tb = sum(top_band) / len(top_band)
    rough = math.sqrt(sum((z - mean_tb) ** 2 for z in top_band) / len(top_band))

    return {
        "run_id": cfg["run_id"],
        "family": cfg["family"],
        "H_mm": cfg["H_mm"],
        "density_kgm3": rho_solid,
        "final_vtk": vtk.name,
        # counts
        "N_created": N_created,
        "N_settled_in": n_in,
        "N_leaked": n_leaked,
        "leak_pct": round(100.0 * n_leaked / N_created, 1),
        # geometry (mm)
        "cyl_R_mm": round(R * 1000, 2),
        "cyl_H_tube_mm": round(H_tube * 1000, 1),
        "bed_height_mm": round(h_bed * 1000, 2),
        "bed_height_max_mm": round((z_top_max + gummy_h / 2) * 1000, 2),
        # THE key outputs
        "solid_fraction_phi": round(phi, 4),
        "bulk_density_kgm3": round(rho_bulk, 1),
        "V_bed_cc": round(V_bed * 1e6, 2),
        "V_solid_cc": round(V_solid * 1e6, 2),
        # bulk-sample quality
        "bed_over_diameter": round(bed_over_D, 3),
        "layers_deep": round(layers_deep, 2),
        "gummies_across": round(gummies_across, 2),
        "radial_fill_frac": round(r_fill, 3),
        "surface_roughness_mm": round(rough * 1000, 2),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("run_dir")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--batch", action="store_true",
                    help="treat run_dir as a PARENT folder; process every "
                         "completed sub-run and write a combined CSV")
    ap.add_argument("-o", "--out", default="surrogate_table.csv",
                    help="output CSV path for --batch")
    a = ap.parse_args()

    if a.batch:
        run_batch(Path(a.run_dir), Path(a.out))
        return

    m = analyze(a.run_dir)
    if a.json:
        print(json.dumps(m, indent=2))
        return
    _print_report(m)


# ----------------------------------------------------------------------------
# BATCH: scan every completed run -> one CSV row each (surrogate training set)
# ----------------------------------------------------------------------------
_CSV_COLS = [
    "run_id", "family", "H_mm", "density_kgm3",
    "N_created", "N_settled_in", "N_leaked", "leak_pct",
    "cyl_R_mm", "bed_height_mm",
    "solid_fraction_phi", "bulk_density_kgm3", "V_bed_cc", "V_solid_cc",
    "bed_over_diameter", "layers_deep", "gummies_across",
    "radial_fill_frac", "surface_roughness_mm", "final_vtk",
]


def run_batch(parent, out_csv):
    import csv
    runs = []
    for d in sorted(parent.iterdir()):
        if not d.is_dir():
            continue
        if not (d / "run_config.json").exists():
            continue
        post = d / "post"
        if not post.exists() or not any(post.glob("particles*.vtk")):
            print(f"  SKIP {d.name}: no particle VTK yet")
            continue
        try:
            m = analyze(d)
            runs.append(m)
            print(f"  OK   {m['run_id']:<8} phi={m['solid_fraction_phi']:.4f} "
                  f"rho_bulk={m['bulk_density_kgm3']:.0f}  "
                  f"({m['N_settled_in']}/{m['N_created']}, leak {m['leak_pct']}%)")
        except Exception as e:
            print(f"  FAIL {d.name}: {e}")
    if not runs:
        print("No completed runs found.")
        return
    # stable ordering: C1..C24 then CC1..CC8, else alnum
    def _key(r):
        rid = r["run_id"]
        pre = "".join(c for c in rid if c.isalpha())
        num = "".join(c for c in rid if c.isdigit())
        return (pre, int(num) if num else 0)
    runs.sort(key=_key)
    with open(out_csv, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=_CSV_COLS, extrasaction="ignore")
        w.writeheader()
        for r in runs:
            w.writerow(r)
    print(f"\nWrote {len(runs)} rows -> {out_csv}")


def _print_report(m):
    print(f"\n=== CYLINDER SOLID-FRACTION REPORT: {m['run_id']} ===")
    print(f"  gummy         : {m['family']}  H={m['H_mm']}mm  rho_solid={m['density_kgm3']} kg/m3")
    print(f"  final frame   : {m['final_vtk']}")
    print(f"  particles     : {m['N_settled_in']}/{m['N_created']} settled "
          f"({m['N_leaked']} leaked, {m['leak_pct']}%)")
    print(f"  cylinder      : R={m['cyl_R_mm']}mm  tube H={m['cyl_H_tube_mm']}mm")
    print(f"  bed height    : {m['bed_height_mm']}mm (p98)  |  max {m['bed_height_max_mm']}mm")
    print(f"  ---------------------------------------------------------")
    print(f"  SOLID FRACTION phi = {m['solid_fraction_phi']}")
    print(f"  BULK DENSITY       = {m['bulk_density_kgm3']} kg/m3")
    print(f"  V_solid / V_bed    = {m['V_solid_cc']} / {m['V_bed_cc']} cc")
    print(f"  ---------------------------------------------------------")
    print(f"  bulk-sample check : bed/D={m['bed_over_diameter']}  "
          f"layers={m['layers_deep']}  gummies_across={m['gummies_across']}")
    print(f"  radial fill       : {m['radial_fill_frac']} of R")
    print(f"  surface roughness : {m['surface_roughness_mm']}mm")
    print()


if __name__ == "__main__":
    main()
