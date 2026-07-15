#!/usr/bin/env python3
"""
gen_cylinder.py -- Parametric cylinder container mesh (tube wall + bottom cap).

primitive_wall type cylinder is NOT compatible with convex particles in
Aspherix, so the container must be a MESHED STL (verified in cyltest/).

Cylinder is a closed can by default: side tube + bottom disk + top lid.
Units: metres.
"""
import math


def _tri(f, n, a, b, c):
    f.write(f"  facet normal {n[0]:.6e} {n[1]:.6e} {n[2]:.6e}\n")
    f.write("    outer loop\n")
    for v in (a, b, c):
        f.write(f"      vertex {v[0]:.6e} {v[1]:.6e} {v[2]:.6e}\n")
    f.write("    endloop\n  endfacet\n")


def generate(out_path, radius_m, height_m, n_seg=64, name="cylinder", cap=True):
    """Meshed tube: side wall + closed bottom disk, and (default) a top LID.

    The top lid makes particle escape physically impossible -- combined with the
    overlap-free insertion in build_run.py, no gummy can ever leave the domain.
    """
    R, H, N = radius_m, height_m, n_seg
    with open(out_path, "w") as f:
        f.write(f'solid "{name}"\n')
        for i in range(N):
            a0 = 2*math.pi*i/N
            a1 = 2*math.pi*(i+1)/N
            x0, y0 = R*math.cos(a0), R*math.sin(a0)
            x1, y1 = R*math.cos(a1), R*math.sin(a1)
            mx, my = (x0+x1)/2, (y0+y1)/2
            ml = math.hypot(mx, my) or 1.0
            nin = (-mx/ml, -my/ml, 0.0)          # inward-facing side normal
            p0, p1 = (x0, y0, 0.0), (x1, y1, 0.0)
            p2, p3 = (x1, y1, H), (x0, y0, H)
            _tri(f, nin, p0, p2, p1)
            _tri(f, nin, p0, p3, p2)
            _tri(f, (0, 0, 1), (0, 0, 0.0), (x1, y1, 0.0), (x0, y0, 0.0))  # bottom
            if cap:
                # top lid, inward (downward) normal so particles bounce back in
                _tri(f, (0, 0, -1), (0, 0, H), (x0, y0, H), (x1, y1, H))
        f.write(f'endsolid "{name}"\n')
    return {"radius_m": R, "height_m": H, "n_tri": N*(4 if cap else 3), "capped": cap}


if __name__ == "__main__":
    info = generate("/tmp/_cyl.stl", 0.0481, 0.25)
    print(info)
