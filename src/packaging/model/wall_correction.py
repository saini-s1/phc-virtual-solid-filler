#!/usr/bin/env python3
"""
wall_correction.py -- quantify how the BULK solid fraction phi_bulk drops to an
EFFECTIVE phi in finite-width containers, and validate it against a real bottle.

MODEL
-----
Finite-size packing: phi_eff(lambda) = phi_bulk * (1 - c / lambda),
  lambda = container_diameter / gummy_base_diameter  ("gummies across").
c is the wall-exclusion coefficient (fit from the cylinder lambda-sweep).
As lambda -> infinity, phi_eff -> phi_bulk (no walls).  Small bottles (small
lambda) pack looser -> fewer gummies -> higher fill line than bulk-phi predicts.

DATA SOURCES
------------
 * lambda-sweep cylinders (runs_lambda/, dmult = lambda = 3..6) -> phi_eff(lambda)
 * lambda~8 bulk anchor    (surrogate_table.csv, nominal-H N=150 runs)
 * FREE real-bottle point  (110count: 635 bottle, EC, N=110)   -> validation

USAGE
-----
  python3 wall_correction.py --bottle110         # just the free bottle point
  python3 wall_correction.py --fit               # postprocess sweep + fit + save
"""
import argparse
import glob
import json
import math
import os
import re
import struct
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent.resolve()
FD = Path("/home/health/fd2997")
GUMMY_H_EC = 9.5     # nominal EC gummy height (mm) used in the 110count reference


# --------------------------------------------------------------------------- #
#  STL parsing (ascii OR binary) + slice areas -- works in the STL's own units #
# --------------------------------------------------------------------------- #
def read_stl_any(path):
    b = open(path, "rb").read()
    is_ascii = b[:5].decode("latin1", "ignore").lower() == "solid" and b"facet" in b[:2048]
    tris = []
    if is_ascii:
        vs = []
        for line in b.decode("latin1", "ignore").splitlines():
            line = line.strip()
            if line.startswith("vertex"):
                _, x, y, z = line.split()
                vs.append((float(x), float(y), float(z)))
                if len(vs) == 3:
                    tris.append(tuple(vs)); vs = []
    else:
        n = struct.unpack("<I", b[80:84])[0]
        off = 84
        for _ in range(n):
            v = struct.unpack("<12f", b[off:off + 48]); off += 50
            tris.append(((v[3], v[4], v[5]), (v[6], v[7], v[8]), (v[9], v[10], v[11])))
    return tris


def slice_area(tris, ai, u, v, Z):
    pts = []
    for tri in tris:
        h = [tri[k][ai] for k in range(3)]
        for a, b in ((0, 1), (1, 2), (2, 0)):
            ha, hb = h[a], h[b]
            if (ha - Z) * (hb - Z) < 0:
                t = (Z - ha) / (hb - ha)
                pts.append((tri[a][u] + t * (tri[b][u] - tri[a][u]),
                            tri[a][v] + t * (tri[b][v] - tri[a][v])))
    if len(pts) < 3:
        return 0.0
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    pts.sort(key=lambda p: math.atan2(p[1] - cy, p[0] - cx))
    area = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]; x2, y2 = pts[(i + 1) % len(pts)]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0


def read_particles(vtk_path):
    data = open(vtk_path, "rb").read()
    i = data.find(b"POINTS"); j = data.find(b"\n", i)
    n = int(data[i:j].split()[1]); off = j + 1
    zs = []
    for k in range(n):
        _, _, z = struct.unpack(">3f", data[off + k * 12:off + k * 12 + 12])
        zs.append(z)
    return n, zs


def final_vtk(post_dir):
    fs = [f for f in glob.glob(os.path.join(post_dir, "particles*.vtk")) if "bound" not in f]
    fs.sort(key=lambda s: int(re.sub(r"[^0-9]", "", os.path.basename(s)) or 0))
    return fs[-1] if fs else None


# --------------------------------------------------------------------------- #
#  FREE validation point: the 110-count reference bottle                      #
# --------------------------------------------------------------------------- #
def bottle110_point():
    stl = FD / "110count/meshes/635Bottle.stl"
    vtk = final_vtk(str(FD / "110count/post"))
    tris = read_stl_any(str(stl))          # metres
    # height axis = longest extent
    mins = [min(t[k][d] for t in tris for k in range(3)) for d in range(3)]
    maxs = [max(t[k][d] for t in tris for k in range(3)) for d in range(3)]
    ext = [maxs[d] - mins[d] for d in range(3)]
    ai = ext.index(max(ext)); u, v = [d for d in range(3) if d != ai]
    z0 = mins[ai]

    n, zs = read_particles(vtk)
    zs_sorted = sorted(zs)
    z_p98 = zs_sorted[int(0.98 * (len(zs_sorted) - 1))]
    bed_top = z_p98 + (GUMMY_H_EC / 1000.0) / 2.0     # metres, above z0 frame? zs already in sim frame == STL frame

    # cumulative volume from base (z0) up to bed_top, and max area for D_eq
    N = 300
    zc = z0
    prev_a = slice_area(tris, ai, u, v, z0 + 1e-5)
    Vocc = 0.0
    a_max = 0.0
    top = bed_top
    for i in range(1, N + 1):
        Z = z0 + (top - z0) * i / N
        a = slice_area(tris, ai, u, v, Z)
        a_max = max(a_max, a)
        dz = (top - z0) / N
        Vocc += 0.5 * (a + prev_a) * dz
        prev_a = a
    # also scan full body for true max area (D_eq)
    a_body = 0.0
    for i in range(1, N + 1):
        Z = z0 + (maxs[ai] - z0) * i / N
        a_body = max(a_body, slice_area(tris, ai, u, v, Z))

    Vocc_mm3 = Vocc * 1e9
    D_eq_mm = 2.0 * math.sqrt(a_body / math.pi) * 1000.0

    # gummy volume (EC nominal) via gen_gummy
    sys.path.insert(0, str(HERE))
    import gen_gummy
    ginfo = gen_gummy.generate("EC", GUMMY_H_EC, "/tmp/_ec_probe.stl")
    Vg = ginfo["vol_mm3"]; dbase = ginfo["D_base_mm"]

    phi_eff = n * Vg / Vocc_mm3
    lam = D_eq_mm / dbase
    return {
        "source": "110count 635 bottle", "family": "EC", "N": n,
        "Vg_mm3": round(Vg, 1), "bed_top_mm": round((bed_top - z0) * 1000, 2),
        "V_occ_cc": round(Vocc_mm3 / 1000.0, 2), "D_eq_mm": round(D_eq_mm, 2),
        "D_base_mm": round(dbase, 2), "lambda": round(lam, 2),
        "phi_eff": round(phi_eff, 4),
    }


# --------------------------------------------------------------------------- #
#  lambda-sweep + fit                                                          #
# --------------------------------------------------------------------------- #
def postprocess_lambda():
    out = HERE / "lambda_table.csv"
    subprocess.call([sys.executable, str(HERE / "postprocess_cyl.py"),
                     str(HERE / "runs_lambda"), "--batch", "-o", str(out)])
    return out


def load_lambda_rows(csv_path):
    """phi + settled-bed depth per run; lambda(=dmult) read from run_config.json
    since postprocess_cyl does not emit it."""
    import csv
    rows = []
    for r in csv.DictReader(open(csv_path)):
        rid = r.get("run_id", "")
        cfg = HERE / "runs_lambda" / rid / "run_config.json"
        if not cfg.exists():
            continue
        lam = json.load(open(cfg)).get("dmult")
        try:
            rows.append({"run_id": rid, "family": r["family"], "lambda": float(lam),
                         "phi": float(r["solid_fraction_phi"]),
                         "layers": float(r.get("layers_deep", 0) or 0),
                         "N": int(float(r["N_created"]))})
        except (KeyError, ValueError, TypeError):
            continue
    return rows


def bulk_anchor(family):
    """phi_bulk = mean phi of nominal-H N=150 runs (lambda~8) for a family."""
    import csv
    p = HERE / "surrogate_table.csv"
    Hn = {"EC": 9.5, "DoryNew": 13.0}[family]
    vals = []
    for r in csv.DictReader(open(p)):
        try:
            if r["family"] == family and abs(float(r["H_mm"]) - Hn) < 1e-6 \
               and int(float(r["N_created"])) == 150 and not r["run_id"].startswith("QC"):
                vals.append(float(r["solid_fraction_phi"]))
        except (KeyError, ValueError):
            continue
    return sum(vals) / len(vals) if vals else None


def fit_lambda(points):
    """2-parameter OLS of phi = a + b*(1/lambda)  ==  phi_inf*(1 - c/lambda),
    where phi_inf = a (bulk at infinite width) and c = -b/a (wall coefficient).
    Fit uses the deep-bed sweep points ONLY, so all points share ~same depth and
    the residual dependence is purely on lambda."""
    n = len(points)
    sx = sum(1.0 / lam for lam, _ in points)
    sy = sum(phi for _, phi in points)
    sxx = sum((1.0 / lam) ** 2 for lam, _ in points)
    sxy = sum(phi / lam for lam, phi in points)
    den = n * sxx - sx * sx
    if abs(den) < 1e-12:
        a = sy / n; b = 0.0
    else:
        b = (n * sxy - sx * sy) / den
        a = (sy - b * sx) / n
    c = -b / a if a else 0.0
    return a, c    # phi_inf, c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bottle110", action="store_true")
    ap.add_argument("--fit", action="store_true")
    a = ap.parse_args()

    if a.bottle110 or not a.fit:
        pt = bottle110_point()
        print("=== FREE VALIDATION POINT (110-count reference bottle) ===")
        for k, v in pt.items():
            print("  %-12s %s" % (k, v))
        if not a.fit:
            return 0

    if a.fit:
        csv_path = postprocess_lambda()
        rows = load_lambda_rows(csv_path)
        result = {"model": "phi_eff = phi_inf*(1 - c/lambda)  [deep-bed]",
                  "note": "fit uses deep-bed lambda-sweep (~5-8 layers) ONLY; the "
                          "shallow main-DOE lambda~8 anchor (~3.2 layers) is a "
                          "DIFFERENT depth regime and is reported for contrast only.",
                  "families": {}}
        for fam in ("EC", "DoryNew"):
            pts = sorted((r["lambda"], r["phi"]) for r in rows if r["family"] == fam)
            depths = {r["lambda"]: r["layers"] for r in rows if r["family"] == fam}
            phi_inf, c = fit_lambda(pts)
            shallow = bulk_anchor(fam)   # shallow ~3.2-layer main-DOE anchor
            result["families"][fam] = {
                "phi_inf": round(phi_inf, 4), "c": round(c, 4),
                "shallow_phi_lambda8_3p2layers": round(shallow, 4) if shallow else None,
                "points": [[lam, round(phi, 4), round(depths[lam], 2)] for lam, phi in pts]}
            print("\n=== %s deep-bed wall correction ===" % fam)
            print("  phi_inf (bulk, lambda->inf) = %.4f" % phi_inf)
            print("  fitted c                    = %.4f" % c)
            print("  shallow main-DOE phi (~3.2 layers, lambda~8) = %.4f  <-- different depth"
                  % (shallow or 0))
            print("  %-8s %-8s %-8s %-8s %-8s" % ("lambda", "layers", "phi_meas", "phi_fit", "resid"))
            for lam, phi in pts:
                pf = phi_inf * (1 - c / lam)
                print("  %-8.2f %-8.2f %-8.4f %-8.4f %+.4f"
                      % (lam, depths[lam], phi, pf, phi - pf))
        # validate against the free bottle point
        pt = bottle110_point()
        phi_inf = result["families"]["EC"]["phi_inf"]; c = result["families"]["EC"]["c"]
        pred = phi_inf * (1 - c / pt["lambda"])
        print("\n=== VALIDATION vs 110-count bottle (EC, lambda=%.2f, %.1f layers) ==="
              % (pt["lambda"], pt["bed_top_mm"] / GUMMY_H_EC))
        print("  measured phi_eff (bottle)  = %.4f" % pt["phi_eff"])
        print("  predicted phi_eff (cyl fit)= %.4f   (err %+.4f, %.1f%%)"
              % (pred, pt["phi_eff"] - pred, 100 * (pt["phi_eff"] - pred) / pt["phi_eff"]))
        result["validation_110count"] = {**pt, "phi_pred": round(pred, 4)}
        json.dump(result, open(HERE / "wall_correction.json", "w"), indent=2)
        print("\nSaved -> wall_correction.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
