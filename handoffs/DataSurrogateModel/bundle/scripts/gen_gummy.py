#!/usr/bin/env python3
"""
gen_gummy.py -- Parametric mold-constrained gummy STL generator.

We only have two real reference STLs (EC25mm, DoryNew). To build a height
sweep (H1..H6) that stays on the mold curve, we non-uniformly SCALE each
family's real reference shape:

    - height axis   scaled by  sz  = H_target / H_ref
    - transverse XY scaled by  sxy = D_base_target / D_base_ref

with the provisional linear mold curve derived from the two references:

    D_base(H) = 0.3910 * H + 14.3533     [mm]   (~11 deg draft angle)

Linear scaling preserves convexity, so the resulting STL is still a valid
convex particle for Aspherix. Volume scales as sxy^2 * sz.

Once the official mold equation is available, only MOLD_A / MOLD_B change.
"""
import math
import struct
from pathlib import Path

HERE = Path(__file__).parent.resolve()

# ---- provisional mold curve (from EC + DoryNew references) ----
MOLD_A = 0.3910
MOLD_B = 14.3533   # mm

# ---- reference geometry: (stl_filename, height_axis_index) ----
# The two reference gummy STLs are REQUIRED to build any gummy.  They are looked
# up in this order so the package is portable: (1) a "refs/" subfolder next to
# this script (the bundle layout), (2) flat next to this script, (3) the original
# absolute path on the HPC.  To move to another machine, just ship the STLs in
# a refs/ folder alongside these .py files -- no code edits needed.
REF = {
    "EC":      ("EC25mm.stl", 1),   # height = Y
    "DoryNew": ("DoryNew.stl", 2),  # height = Z
}
_REF_FALLBACK = {
    "EC25mm.stl":  "/home/health/fd2997/110count/data/EC25mm.stl",
    "DoryNew.stl": "/home/health/fd2997/110count/data/DoryNew.stl",
}


def _resolve_ref(fname):
    for cand in (HERE / "refs" / fname, HERE / fname,
                 Path(_REF_FALLBACK.get(fname, fname))):
        if cand.exists():
            return str(cand)
    raise FileNotFoundError(
        "reference STL %r not found. Ship it in a 'refs/' folder next to "
        "gen_gummy.py (see REF lookup order)." % fname)


def base_diameter_mm(H_mm: float) -> float:
    """Mold-constrained base diameter for a given total height."""
    return MOLD_A * H_mm + MOLD_B


def load_facets(path):
    """Return list of (v1, v2, v3) triangles from an ASCII STL. Units: metres."""
    tris, tri = [], []
    for line in open(path):
        s = line.strip()
        if s.startswith("vertex "):
            p = s.split()
            tri.append((float(p[1]), float(p[2]), float(p[3])))
            if len(tri) == 3:
                tris.append(tuple(tri))
                tri = []
    return tris


def measure(tris, ai):
    """Return (H_m, Dbase_m) of a triangle set along axis index ai."""
    other = [i for i in (0, 1, 2) if i != ai]
    hs = [v[ai] for t in tris for v in t]
    H = max(hs) - min(hs)
    rmax = max(math.hypot(v[other[0]], v[other[1]]) for t in tris for v in t)
    return H, 2 * rmax


def _normal(a, b, c):
    ux, uy, uz = b[0]-a[0], b[1]-a[1], b[2]-a[2]
    vx, vy, vz = c[0]-a[0], c[1]-a[1], c[2]-a[2]
    nx, ny, nz = uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx
    m = math.sqrt(nx*nx + ny*ny + nz*nz) or 1.0
    return nx/m, ny/m, nz/m


def write_ascii_stl(path, tris, name="gummy"):
    with open(path, "w") as f:
        f.write(f'solid "{name}"\n')
        for a, b, c in tris:
            n = _normal(a, b, c)
            f.write(f"  facet normal {n[0]:.6e} {n[1]:.6e} {n[2]:.6e}\n")
            f.write("    outer loop\n")
            for v in (a, b, c):
                f.write(f"      vertex {v[0]:.6e} {v[1]:.6e} {v[2]:.6e}\n")
            f.write("    endloop\n  endfacet\n")
        f.write(f'endsolid "{name}"\n')


def signed_volume_mm3(tris):
    vol = 0.0
    for a, b, c in tris:
        vol += (a[0]*(b[1]*c[2]-b[2]*c[1])
                - a[1]*(b[0]*c[2]-b[2]*c[0])
                + a[2]*(b[0]*c[1]-b[1]*c[0])) / 6.0
    return abs(vol) * 1e9   # m^3 -> mm^3


def generate(family: str, H_mm: float, out_path: str):
    """Generate a mold-constrained gummy STL for `family` at total height H_mm."""
    ref_fname, ai = REF[family]
    ref_path = _resolve_ref(ref_fname)
    tris = load_facets(ref_path)
    H_ref, D_ref = measure(tris, ai)              # metres
    D_tar = base_diameter_mm(H_mm) / 1000.0       # metres
    sz = (H_mm / 1000.0) / H_ref                  # height-axis scale
    sxy = D_tar / D_ref                            # transverse scale
    other = [i for i in (0, 1, 2) if i != ai]

    scale = [0.0, 0.0, 0.0]
    scale[ai] = sz
    scale[other[0]] = sxy
    scale[other[1]] = sxy

    scaled = [tuple((v[0]*scale[0], v[1]*scale[1], v[2]*scale[2]) for v in t)
              for t in tris]
    write_ascii_stl(out_path, scaled, name=f"{family}_H{H_mm:.2f}")

    H_out, D_out = measure(scaled, ai)
    return {
        "family": family,
        "H_mm": round(H_out * 1000, 3),
        "D_base_mm": round(D_out * 1000, 3),
        "vol_mm3": round(signed_volume_mm3(scaled), 2),
        "height_axis": "XYZ"[ai],
        "stl": out_path,
    }


if __name__ == "__main__":
    # quick self-test: regenerate the two references at their own heights
    for fam, H in (("EC", 9.5), ("DoryNew", 13.0)):
        info = generate(fam, H, f"/tmp/_selftest_{fam}.stl")
        print(info)
