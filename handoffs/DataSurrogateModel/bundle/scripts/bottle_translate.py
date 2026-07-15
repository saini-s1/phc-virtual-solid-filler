#!/usr/bin/env python3
"""
bottle_translate.py -- Apply a cylinder-measured SOLID FRACTION (phi) to real
bottle geometry and report the packaging metrics the reviewer asked for:

    * product fill height          (how high the gummies stack)
    * fill height %                (of total bottle height)
    * slack fill %                 (headspace / total volume)
    * shoulder height + ideal fill (fill-to-shoulder is the target line)
    * gummy count at ideal fill    (label-claim feasibility)

This is the "hypothetical surrogate application": phi trained in the normalized
cylinder is the ONLY packing input; bottle V(h) comes from the STL geometry.

Usage:
    python3 bottle_translate.py --phi 0.508 --vg 2616 \
        --stl surrogatetest/bottle_sizes/AX-1397-0_625cc_Packer_Rd.stl
    # or sweep all bottles for a given phi + gummy:
    python3 bottle_translate.py --phi 0.508 --vg 2616 --all
"""
import argparse
import math
import struct
from pathlib import Path

BOTTLE_DIR = Path("/home/health/fd2997/surrogatetest/bottle_sizes")


# ----------------------------------------------------------------------------
# STL PARSER  (binary OR ascii, auto-detected)
# ----------------------------------------------------------------------------
def read_stl(path):
    """Return list of triangles; each = ((x0,y0,z0),(x1,y1,z1),(x2,y2,z2)).
    Handles both binary and ASCII STL (real bottle exports come in both)."""
    raw = open(path, "rb").read()
    is_ascii = raw[:5].lower() == b"solid" and b"facet" in raw[:4096]
    tris = []
    if is_ascii:
        vs = []
        for line in raw.decode("latin1", "ignore").splitlines():
            line = line.strip()
            if line.startswith("vertex"):
                _, x, y, z = line.split()
                vs.append((float(x), float(y), float(z)))
                if len(vs) == 3:
                    tris.append((vs[0], vs[1], vs[2]))
                    vs = []
    else:
        n_tri = struct.unpack("<I", raw[80:84])[0]
        off = 84
        for _ in range(n_tri):
            data = raw[off:off + 50]
            off += 50
            if len(data) < 50:
                break
            vals = struct.unpack("<12f", data[:48])
            tris.append(((vals[3], vals[4], vals[5]),
                         (vals[6], vals[7], vals[8]),
                         (vals[9], vals[10], vals[11])))
    return tris


# ----------------------------------------------------------------------------
# SLICE -> AREA(z) -> V(h)
# ----------------------------------------------------------------------------
def _slice_area(tris, ai, u, v, Z):
    """Cross-sectional area of the mesh at height Z along axis `ai`.
    (u,v)=the two in-plane axis indices. Bottles are bodies of revolution so
    each slice is a single star-convex loop -> angular-sort shoelace."""
    pts = []
    for tri in tris:
        h = [tri[k][ai] for k in range(3)]
        # find edges crossing the plane
        for a, b in ((0, 1), (1, 2), (2, 0)):
            ha, hb = h[a], h[b]
            if (ha - Z) * (hb - Z) < 0:                 # strict crossing
                t = (Z - ha) / (hb - ha)
                pu = tri[a][u] + t * (tri[b][u] - tri[a][u])
                pv = tri[a][v] + t * (tri[b][v] - tri[a][v])
                pts.append((pu, pv))
    if len(pts) < 3:
        return 0.0
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    pts.sort(key=lambda p: math.atan2(p[1] - cy, p[0] - cx))
    area = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % len(pts)]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0


def bottle_profile(path, n_slices=400):
    """Return dict with axis, height array (mm from base), area array (mm^2),
    cumulative volume V(h) (cc), total height & volume, and scale detection."""
    tris = read_stl(path)
    # bounding box
    mins = [min(t[k][d] for t in tris for k in range(3)) for d in range(3)]
    maxs = [max(t[k][d] for t in tris for k in range(3)) for d in range(3)]
    ext = [maxs[d] - mins[d] for d in range(3)]
    # UNIT AUTO-DETECT: a real bottle is ~0.05-0.30 m = 50-300 mm.  If the
    # longest extent is < 3, the file is in METRES -> scale to mm (x1000) so all
    # downstream math (and the mm-based surrogate) is unit-consistent.
    unit_scale = 1000.0 if max(ext) < 3.0 else 1.0
    if unit_scale != 1.0:
        tris = [tuple(tuple(c * unit_scale for c in vtx) for vtx in tri) for tri in tris]
        mins = [m * unit_scale for m in mins]
        maxs = [m * unit_scale for m in maxs]
        ext = [e * unit_scale for e in ext]
    ai = ext.index(max(ext))                 # height axis = longest extent
    u, v = [d for d in range(3) if d != ai]

    z0, z1 = mins[ai], maxs[ai]
    Htot = z1 - z0
    zs, areas = [], []
    for i in range(1, n_slices):             # skip exact endpoints
        Z = z0 + Htot * i / n_slices
        zs.append(Z - z0)                    # height from base
        areas.append(_slice_area(tris, ai, u, v, Z))

    # cumulative volume via trapezoid.  Seed with the base sliver (volume from
    # z=0 up to the first slice) so Vcum is measured from the true base and
    # stays consistent with V_total -- otherwise fill volumes were ~0.5-1 cc low.
    Vc = [0.5 * areas[0] * zs[0]]
    for i in range(1, len(zs)):
        dz = zs[i] - zs[i - 1]
        Vc.append(Vc[-1] + 0.5 * (areas[i] + areas[i - 1]) * dz)
    V_native = Vc[-1]

    # unit detection: assume STL is mm; volume in mm^3 -> cc = /1000
    # (metres would give absurdly tiny numbers)
    to_cc = 1e-3
    V_total_cc = V_native * to_cc
    Vc_cc = [x * to_cc for x in Vc]

    return {
        "path": str(path),
        "name": Path(path).stem,
        "axis": "XYZ"[ai],
        "H_total_mm": Htot,
        "V_total_cc": V_total_cc,
        "z_mm": zs,
        "area_mm2": areas,
        "Vcum_cc": Vc_cc,
    }


def parametric_profile(body_D_mm, body_H_mm, shoulder_H_mm, neck_D_mm,
                       neck_H_mm=15.0, n_slices=400, name="custom_bottle"):
    """Synthesize a bottle V(h) profile from simple dimensions -- for a NEW
    bottle the user specifies rather than an STL. Body (straight wall) ->
    shoulder (linear taper) -> neck (straight). Only bottom+sides geometry
    matters for fill, so the neck is a coarse stub."""
    Rb = body_D_mm / 2.0
    Rn = neck_D_mm / 2.0
    z_body = body_H_mm
    z_sh = body_H_mm + shoulder_H_mm
    Htot = body_H_mm + shoulder_H_mm + neck_H_mm

    def radius(z):
        if z <= z_body:
            return Rb
        if z <= z_sh:
            f = (z - z_body) / max(shoulder_H_mm, 1e-9)
            return Rb + (Rn - Rb) * f
        return Rn

    zs, areas = [], []
    for i in range(1, n_slices):
        z = Htot * i / n_slices
        zs.append(z)
        r = radius(z)
        areas.append(math.pi * r * r)

    Vc = [0.5 * areas[0] * zs[0]]        # seed with base sliver (see bottle_profile)
    for i in range(1, len(zs)):
        dz = zs[i] - zs[i - 1]
        Vc.append(Vc[-1] + 0.5 * (areas[i] + areas[i - 1]) * dz)
    V_native = Vc[-1]
    to_cc = 1e-3
    return {
        "path": "(parametric)",
        "name": name,
        "axis": "Z",
        "H_total_mm": Htot,
        "V_total_cc": V_native * to_cc,
        "z_mm": zs,
        "area_mm2": areas,
        "Vcum_cc": [x * to_cc for x in Vc],
    }


def detect_shoulder(prof, body_frac=0.90):
    """Shoulder = first height above the body's max-area zone where the
    cross-section area falls below body_frac * A_body_max. That is the
    standard 'fill line' (fill-to-shoulder).

    The body reference area (which sets body_diameter -> lambda) is measured
    ONLY over the 10-80% height band -- the straight cylindrical body -- to
    match build_bottle.bottle_geometry() exactly.  This guarantees the lambda
    used at predict time equals the lambda recorded during DEM validation, so
    a base fillet or shoulder bulge can never silently shift lambda."""
    areas = prof["area_mm2"]
    zs = prof["z_mm"]
    Htot = prof["H_total_mm"]
    lo, hi = 0.10 * Htot, 0.80 * Htot
    band = [(a, i) for i, a in enumerate(areas) if lo <= zs[i] <= hi]
    if band:
        a_max, i_max = max(band, key=lambda t: t[0])
    else:                                    # degenerate/squat profile fallback
        a_max = max(areas)
        i_max = areas.index(a_max)
    thr = body_frac * a_max
    z_shoulder = zs[-1]
    i_shoulder = len(zs) - 1
    for i in range(i_max, len(areas)):
        if areas[i] < thr:
            z_shoulder = zs[i]
            i_shoulder = i
            break
    # volume up to shoulder
    V_shoulder = prof["Vcum_cc"][i_shoulder]
    return {
        "z_shoulder_mm": z_shoulder,
        "V_shoulder_cc": V_shoulder,
        "shoulder_pct_of_H": 100.0 * z_shoulder / prof["H_total_mm"],
        "A_body_max_mm2": a_max,
        "body_diameter_mm": 2.0 * math.sqrt(a_max / math.pi),
    }


def height_for_volume(prof, V_target_cc):
    """Interpolate the height (mm) at which cumulative volume = V_target."""
    Vc = prof["Vcum_cc"]
    zs = prof["z_mm"]
    if V_target_cc <= 0:
        return 0.0
    if V_target_cc >= Vc[-1]:
        return zs[-1]
    for i in range(1, len(Vc)):
        if Vc[i] >= V_target_cc:
            f = (V_target_cc - Vc[i - 1]) / (Vc[i] - Vc[i - 1] + 1e-12)
            return zs[i - 1] + f * (zs[i] - zs[i - 1])
    return zs[-1]


# ----------------------------------------------------------------------------
# SURROGATE APPLICATION
# ----------------------------------------------------------------------------
def apply_phi(prof, phi, vg_mm3, target_count=None):
    """Translate a solid fraction phi + single-gummy volume into bottle
    packaging metrics."""
    sh = detect_shoulder(prof)
    vg_cc = vg_mm3 * 1e-3
    Vtot = prof["V_total_cc"]

    # --- ideal fill = fill to shoulder ---
    V_fill_ideal = sh["V_shoulder_cc"]
    # bulk product volume that gummies+voids occupy = N*vg/phi
    # so gummies that REACH the shoulder:
    N_ideal = phi * V_fill_ideal / vg_cc
    slack_ideal = 100.0 * (Vtot - V_fill_ideal) / Vtot
    fillpct_ideal = 100.0 * sh["z_shoulder_mm"] / prof["H_total_mm"]

    out = {
        "bottle": prof["name"],
        "V_total_cc": round(Vtot, 1),
        "H_total_mm": round(prof["H_total_mm"], 1),
        "body_diameter_mm": round(sh["body_diameter_mm"], 1),
        "shoulder_height_mm": round(sh["z_shoulder_mm"], 1),
        "ideal_fill_pct_of_H": round(fillpct_ideal, 1),
        "V_fill_to_shoulder_cc": round(V_fill_ideal, 1),
        "N_gummies_at_shoulder": round(N_ideal, 0),
        "product_mass_g_at_shoulder": None,   # filled by caller if density known
        "slack_fill_pct_ideal": round(slack_ideal, 1),
        "headspace_mm_ideal": round(prof["H_total_mm"] - sh["z_shoulder_mm"], 1),
        "headspace_cc_ideal": round(Vtot - V_fill_ideal, 1),
    }

    # --- specific target count (label claim feasibility) ---
    if target_count:
        V_bulk = target_count * vg_cc / phi           # product bulk volume (cc)
        h_fill = height_for_volume(prof, V_bulk)
        fillpct = 100.0 * h_fill / prof["H_total_mm"]
        slack = 100.0 * (Vtot - min(V_bulk, Vtot)) / Vtot
        over_shoulder = h_fill > sh["z_shoulder_mm"]
        out["target_count"] = target_count
        out["target_bulk_vol_cc"] = round(V_bulk, 1)
        out["target_fill_height_mm"] = round(h_fill, 1)
        out["target_fill_pct_of_H"] = round(fillpct, 1)
        out["target_slack_fill_pct"] = round(slack, 1)
        out["target_headspace_mm"] = round(prof["H_total_mm"] - h_fill, 1)
        out["target_headspace_cc"] = round(Vtot - min(V_bulk, Vtot), 1)
        out["target_exceeds_shoulder"] = over_shoulder
    return out


def _print(rep, phi, vg_mm3):
    print(f"\n  BOTTLE: {rep['bottle']}")
    print(f"    geometry     : V_total={rep['V_total_cc']}cc  H={rep['H_total_mm']}mm  "
          f"body_D={rep['body_diameter_mm']}mm")
    print(f"    shoulder     : {rep['shoulder_height_mm']}mm "
          f"({rep['ideal_fill_pct_of_H']}% of H)  V_to_shoulder={rep['V_fill_to_shoulder_cc']}cc")
    print(f"    IDEAL FILL (to shoulder), phi={phi}, Vg={vg_mm3}mm3:")
    print(f"      gummies to shoulder : {rep['N_gummies_at_shoulder']:.0f}")
    print(f"      slack fill          : {rep['slack_fill_pct_ideal']}%")
    if "target_count" in rep:
        flag = "  <-- OVER SHOULDER (into neck!)" if rep["target_exceeds_shoulder"] else ""
        print(f"    TARGET COUNT = {rep['target_count']}:")
        print(f"      bulk product vol    : {rep['target_bulk_vol_cc']}cc")
        print(f"      product fill height : {rep['target_fill_height_mm']}mm "
              f"({rep['target_fill_pct_of_H']}% of H){flag}")
        print(f"      slack fill          : {rep['target_slack_fill_pct']}%")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--phi", type=float, required=True)
    ap.add_argument("--vg", type=float, required=True, help="single gummy volume, mm^3")
    ap.add_argument("--stl", help="one bottle STL")
    ap.add_argument("--all", action="store_true", help="sweep all bottles in bottle_sizes/")
    ap.add_argument("--count", type=int, default=None, help="target label-claim count")
    ap.add_argument("--density", type=float, default=None, help="gummy density kg/m3")
    a = ap.parse_args()

    stls = []
    if a.all:
        stls = sorted(BOTTLE_DIR.glob("*.stl"))
    elif a.stl:
        stls = [Path(a.stl)]
    else:
        ap.error("give --stl PATH or --all")

    print(f"\n=== SURROGATE APPLICATION: phi={a.phi}  Vg={a.vg}mm3 ===")
    for s in stls:
        prof = bottle_profile(s)
        rep = apply_phi(prof, a.phi, a.vg, target_count=a.count)
        if a.density:
            m = rep["N_gummies_at_shoulder"] * a.vg * 1e-9 * a.density * 1000.0
            rep["product_mass_g_at_shoulder"] = round(m, 1)
        _print(rep, a.phi, a.vg)
    print()


if __name__ == "__main__":
    main()
