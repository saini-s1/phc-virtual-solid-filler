#!/usr/bin/env python3
"""
analyze_bottle.py -- Post-process the full-bottle validation runs and build a
PREDICTED vs SIMULATED comparison table.

For each runs_bottle/<id> it measures from the settled DEM packing:
  * fill height              (p98 particle z + half gummy thickness, above base)
  * solid fraction phi_eff   (N*Vg / occupied bottle volume up to fill height)
  * slack fill %             ((bottle_H - fill_height)/bottle_H * 100)
  * settling drift           (max p98 movement over the last two dump frames)
  * leaks                    (particles above the bottle top or outside the wall)
and compares them to prediction.json (the model's numbers).

Pass criteria: |fill| within +-5 %, |phi| within +-0.02, 0 leaks, settled.

Usage:  python3 analyze_bottle.py [-o validation_table.csv]
"""
import glob
import json
import math
import os
import re
import struct
import sys
from pathlib import Path

HERE = Path(__file__).parent.resolve()
RUNS = HERE / "runs_bottle"
sys.path.insert(0, str(HERE))
import gen_gummy                                                  # noqa: E402
from build_bottle import read_stl_tris, slice_radius             # noqa: E402


def read_points(vtk_path):
    """Return list of (x,y,z) from a legacy-binary particle VTK (big-endian)."""
    data = open(vtk_path, "rb").read()
    i = data.find(b"POINTS")
    j = data.find(b"\n", i)
    n = int(data[i:j].split()[1])
    off = j + 1
    pts = []
    for k in range(n):
        x, y, z = struct.unpack(">3f", data[off + k * 12:off + k * 12 + 12])
        pts.append((x, y, z))
    return pts


def frames(post_dir):
    fs = [f for f in glob.glob(os.path.join(post_dir, "particles*.vtk"))
          if "bound" not in f]
    fs.sort(key=lambda s: int(re.sub(r"[^0-9]", "", os.path.basename(s)) or 0))
    return fs


def p98(zs):
    zs = sorted(zs)
    return zs[int(0.98 * (len(zs) - 1))]


def occupied_volume_m3(tris, z0, z_top, nseg=300):
    """Trapezoidal integration of bottle cross-section area from z0 to z_top."""
    prev = math.pi * slice_radius(tris, z0 + 1e-5) ** 2
    V = 0.0
    dz = (z_top - z0) / nseg
    for i in range(1, nseg + 1):
        Z = z0 + dz * i
        a = math.pi * slice_radius(tris, Z) ** 2
        V += 0.5 * (a + prev) * dz
        prev = a
    return V


def analyze_run(run_dir):
    cfg = json.loads((run_dir / "run_config.json").read_text())
    pred_path = run_dir / "prediction.json"
    pred = json.loads(pred_path.read_text()) if pred_path.exists() else {}
    fs = frames(str(run_dir / "post"))
    if not fs:
        return {"run_id": cfg["run_id"], "status": "no-output"}

    tris = read_stl_tris(str(run_dir / "bottle.stl"))             # already metres
    z0 = min(t[k][2] for t in tris for k in range(3))
    z_top_bottle = max(t[k][2] for t in tris for k in range(3))
    body_r = cfg["body_diameter_mm"] / 2000.0
    gummy_h_m = cfg["H_mm"] / 1000.0

    pts = read_points(fs[-1])
    n = len(pts)
    zs = [p[2] for p in pts]

    # HARD RETENTION GATE: if particles escaped the domain the packing is not a
    # valid bottle fill -- refuse to emit any phi/fill so bad data can never be
    # mistaken for a validation point.
    retention = n / cfg["count"] if cfg["count"] else 0.0
    if retention < 0.90:
        return {"run_id": cfg["run_id"], "family": cfg["family"],
                "H_mm": cfg["H_mm"], "N": n, "N_target": cfg["count"],
                "lambda": cfg["lambda_gummies_across"], "retention_pct": round(retention * 100, 1),
                "sim_fill_mm": "", "pred_fill_mm": pred.get("fill_mm"),
                "sim_phi": "", "pred_phi": pred.get("phi"),
                "sim_slack_pct": "", "pred_slack_pct": pred.get("slack_pct"),
                "leaks": cfg["count"] - n, "drift_mm": "", "frames": len(fs),
                "verdict": "INVALID"}

    # leak detection: particle center clearly above the bottle mouth or outside wall
    leaks = 0
    for x, y, z in pts:
        if z > z_top_bottle + gummy_h_m or math.hypot(x, y) > body_r + gummy_h_m:
            leaks += 1

    # settling drift over the last two frames
    drift_mm = None
    if len(fs) >= 2:
        z_prev = [p[2] for p in read_points(fs[-2])]
        drift_mm = abs(p98(zs) - p98(z_prev)) * 1000.0

    bed_top = p98(zs) + gummy_h_m / 2.0
    fill_mm = (bed_top - z0) * 1000.0
    Vg = cfg["gummy_vol_mm3"]
    Vocc = occupied_volume_m3(tris, z0, bed_top) * 1e9              # mm3
    phi_eff = n * Vg / Vocc if Vocc > 0 else 0.0
    bottle_H = (z_top_bottle - z0) * 1000.0
    slack_pct = (bottle_H - fill_mm) / bottle_H * 100.0

    res = {
        "run_id": cfg["run_id"], "family": cfg["family"], "H_mm": cfg["H_mm"],
        "N": n, "N_target": cfg["count"], "retention_pct": round(retention * 100, 1),
        "lambda": cfg["lambda_gummies_across"],
        "leaks": leaks, "drift_mm": None if drift_mm is None else round(drift_mm, 3),
        "sim_fill_mm": round(fill_mm, 1), "pred_fill_mm": pred.get("fill_mm"),
        "sim_phi": round(phi_eff, 4), "pred_phi": pred.get("phi"),
        "sim_slack_pct": round(slack_pct, 1), "pred_slack_pct": pred.get("slack_pct"),
        "frames": len(fs),
    }
    if pred.get("fill_mm"):
        res["fill_err_pct"] = round((fill_mm - pred["fill_mm"]) / pred["fill_mm"] * 100, 1)
    if pred.get("phi"):
        res["phi_err"] = round(phi_eff - pred["phi"], 4)
    # verdict
    ok = (leaks == 0
          and (drift_mm is None or drift_mm < 2.0)
          and (not pred.get("fill_mm") or abs(res.get("fill_err_pct", 99)) <= 5.0)
          and (not pred.get("phi") or abs(res.get("phi_err", 9)) <= 0.02))
    res["verdict"] = "PASS" if ok else "CHECK"
    return res


def main():
    out = "validation_table.csv"
    if "-o" in sys.argv:
        out = sys.argv[sys.argv.index("-o") + 1]
    rows = []
    for d in sorted(RUNS.glob("VB_*")):
        if (d / "run_config.json").exists():
            rows.append(analyze_run(d))

    cols = ["run_id", "family", "H_mm", "lambda", "N", "N_target", "retention_pct",
            "sim_fill_mm", "pred_fill_mm", "fill_err_pct",
            "sim_phi", "pred_phi", "phi_err",
            "sim_slack_pct", "pred_slack_pct",
            "leaks", "drift_mm", "frames", "verdict"]
    with open(out, "w") as fh:
        fh.write(",".join(cols) + "\n")
        for r in rows:
            fh.write(",".join(str(r.get(c, "")) for c in cols) + "\n")

    hdr = f"{'run':16}{'fam':8}{'lam':6}{'N/tgt':10}{'fill sim/pred':18}{'phi sim/pred':16}{'leak':5}{'drift':7}{'verdict':8}"
    print(hdr)
    print("-" * len(hdr))
    for r in rows:
        if r.get("status") == "no-output":
            print(f"{r['run_id']:16}(no output yet)")
            continue
        print(f"{r['run_id']:16}{r['family']:8}{r['lambda']:<6}"
              f"{str(r['N'])+'/'+str(r['N_target']):10}"
              f"{str(r['sim_fill_mm'])+'/'+str(r['pred_fill_mm']):18}"
              f"{str(r['sim_phi'])+'/'+str(r['pred_phi']):16}"
              f"{r['leaks']:<5}{str(r['drift_mm']):7}{r['verdict']:8}")
    print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
