#!/usr/bin/env python3
"""
build_bottle.py -- Assemble ONE full-bottle validation run and (optionally)
submit it to LSF.

This reproduces the *validated* 110-count reference setup EXACTLY
(110count/packing.asx + creation.asx):

  * identical DEM physics  (E=5e6, nu=0.25, e=0.25, mu=0.01, mu_r=0.10,
    density=1425, ts=5e-6, hertz + history + rolling_friction epsd2)
  * the real bottle mesh used directly as a solid meshed wall (metres,
    scale 1.0)
  * gummies poured in as narrow, vertically pre-stacked strands threaded
    through the bottle mouth (random orientations), using the same gentle
    mechanism as the validated 110-count creation.asx: grains are spaced ~1.5
    bounding-diameters apart so they collapse and settle one at a time under
    gravity (no mid-air clumping, no chute).  For high grain counts the column
    is split across several parallel strands so the drop height -- and therefore
    the impact velocity -- stays as low as the zero-loss 110-count pour, instead
    of growing into a single tall tower that splashes grains back out.

The only differences from build_run.py are that the container is a real
bottle STL (not a generated cylinder) and the insertion column is sized to
clear the bottle *mouth* so it works for any bottle geometry.

Usage:
    python3 build_bottle.py --id VB_EC_635 --family EC --H 9.5 \
        --bottle /home/health/fd2997/110count/meshes/635cc_bottle.stl \
        --count 212 [--submit]
"""
import argparse
import json
import math
import random
from pathlib import Path

import gen_gummy

HERE = Path(__file__).parent.resolve()
RUNS = HERE / "runs_bottle"

TS = 5e-6
YOUNG = 5.0e6
POISSON = 0.25
COR = 0.25
CoF = 0.01
CoRF = 0.10


# --------------------------------------------------------------------------- #
#  STL reading (ascii + binary) with unit auto-detection -> always metres
# --------------------------------------------------------------------------- #
def read_stl_tris(path):
    """Return list of triangles [[(x,y,z)*3], ...] in the file's own units."""
    raw = Path(path).read_bytes()
    is_ascii = raw[:5].lower() == b"solid" and b"facet" in raw[:4096]
    tris = []
    if is_ascii:
        vs = []
        for ln in raw.decode("ascii", "ignore").splitlines():
            ln = ln.strip()
            if ln.startswith("vertex"):
                _, x, y, z = ln.split()
                vs.append((float(x), float(y), float(z)))
                if len(vs) == 3:
                    tris.append(vs)
                    vs = []
    else:
        import struct
        n = struct.unpack("<I", raw[80:84])[0]
        off = 84
        for _ in range(n):
            vals = struct.unpack("<12f", raw[off:off + 48])   # normal(3) + 3 verts(9)
            tris.append([(vals[3], vals[4], vals[5]),
                         (vals[6], vals[7], vals[8]),
                         (vals[9], vals[10], vals[11])])
            off += 50
    return tris


def to_metres(tris):
    """Auto-detect mm vs m (bottles are < ~3 m tall) and return metres."""
    ext = [max(t[k][d] for t in tris for k in range(3))
           - min(t[k][d] for t in tris for k in range(3)) for d in range(3)]
    scale = 0.001 if max(ext) > 3.0 else 1.0        # >3 -> was millimetres
    if scale == 1.0:
        return tris, 1.0
    return [[(x * scale, y * scale, z * scale) for (x, y, z) in t]
            for t in tris], scale


def write_stl_ascii(path, tris, name="bottle"):
    out = [f"solid {name}"]
    for t in tris:
        ux, uy, uz = t[0]
        vx, vy, vz = t[1]
        wx, wy, wz = t[2]
        ax, ay, az = vx - ux, vy - uy, vz - uz
        bx, by, bz = wx - ux, wy - uy, wz - uz
        nx, ny, nz = ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx
        m = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
        out.append(f"  facet normal {nx/m:.6e} {ny/m:.6e} {nz/m:.6e}")
        out.append("    outer loop")
        for (x, y, z) in t:
            out.append(f"      vertex {x:.6e} {y:.6e} {z:.6e}")
        out.append("    endloop")
        out.append("  endfacet")
    out.append(f"endsolid {name}")
    Path(path).write_text("\n".join(out) + "\n")


def slice_radius(tris, Z):
    """Effective radius (mm-agnostic, same units as tris) of the z=Z slice."""
    pts = []
    for t in tris:
        h = [t[k][2] for k in range(3)]
        for a, b in ((0, 1), (1, 2), (2, 0)):
            if (h[a] - Z) * (h[b] - Z) <= 0 and h[a] != h[b]:
                s = (Z - h[a]) / (h[b] - h[a])
                if 0 <= s <= 1:
                    pts.append((t[a][0] + s * (t[b][0] - t[a][0]),
                                t[a][1] + s * (t[b][1] - t[a][1])))
    if len(pts) < 3:
        return 0.0
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    pts.sort(key=lambda p: math.atan2(p[1] - cy, p[0] - cx))
    A = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % len(pts)]
        A += x1 * y2 - x2 * y1
    return math.sqrt(abs(A) / 2.0 / math.pi)


def bottle_geometry(tris):
    """tris already in METRES, height along z. Return dict of key radii/heights."""
    zmin = min(t[k][2] for t in tris for k in range(3))
    zmax = max(t[k][2] for t in tris for k in range(3))
    H = zmax - zmin
    body_r = 0.0
    for i in range(10, 81, 2):                       # 10-80 % = straight body
        body_r = max(body_r, slice_radius(tris, zmin + H * i / 100.0))
    mouth_r = 1e9
    for i in range(85, 101):                          # top 15 % = shoulder+mouth
        r = slice_radius(tris, zmin + H * i / 100.0)
        if r > 1e-4:
            mouth_r = min(mouth_r, r)
    if mouth_r > 1e8:
        mouth_r = body_r
    return {"zmin": zmin, "zmax": zmax, "H": H,
            "body_r": body_r, "mouth_r": mouth_r}


def rain_column(count, z_start, pitch, bsphere, max_ring, z_top_target, seed=42):
    """Emit `count` create_particles lines forming a gentle pour (mirrors the
    zero-loss 110count/creation.asx mechanism).  A single tall file of many
    grains hits the pile too fast and splashes back out; instead the grains are
    split across K parallel strands so the column stays as SHORT as the proven
    110-count pour (same impact velocity, no loss) while every grain still keeps
    >= one bounding-diameter of clearance from its neighbours (no mid-air
    overlap).  Strands sit on a small ring that threads the bottle mouth, and
    grains are dealt round-robin so all strands feed together.  Returns
    (text, z_top, n_strands, ring_radius)."""
    rng = random.Random(seed)
    n_per = max(1, int((z_top_target - z_start) / pitch))     # grains per strand
    n_strands = max(1, (count + n_per - 1) // n_per)          # ceil division
    if n_strands == 1:
        centers = [(0.0, 0.0)]
        r_ring = 0.0
    else:
        r_min = bsphere / (2.0 * math.sin(math.pi / n_strands))  # neighbours >= bsphere
        # give ~8% extra spacing so bounding spheres do NOT touch at insertion
        # (touching strands kick a few grains out on the first step); widen up to
        # whatever the mouth allows.
        r_ring = min(max(r_min * 1.08, 0.010), max_ring)
        if r_ring < r_min:
            r_ring = r_min
        centers = [(r_ring * math.cos(2.0 * math.pi * k / n_strands),
                    r_ring * math.sin(2.0 * math.pi * k / n_strands))
                   for k in range(n_strands)]
    jit = 0.002
    lines = []
    for i in range(count):
        k = i % n_strands
        layer = i // n_strands
        cx, cy = centers[k]
        rr = jit * math.sqrt(rng.random())
        th = rng.uniform(0.0, 2.0 * math.pi)
        x = cx + rr * math.cos(th)
        y = cy + rr * math.sin(th)
        z = z_start + layer * pitch
        ax, ay, az = (rng.uniform(-1.0, 1.0) for _ in range(3))
        n = math.sqrt(ax * ax + ay * ay + az * az) or 1.0
        ax, ay, az = ax / n, ay / n, az / n
        ang = rng.uniform(0.0, 360.0)
        lines.append(
            f"create_particles template pts mode single position "
            f"( {x:9.6f}, {y:9.6f}, {z:9.6f}) orientation axis "
            f"( {ax:9.6f}, {ay:9.6f}, {az:9.6f}) angle {ang:8.3f}")
    z_top = z_start + ((count - 1) // n_strands) * pitch
    return "\n".join(lines) + "\n", z_top, n_strands, r_ring


def write_funnel(path, r_bottom, r_top, z_bottom, z_cone_top, z_top, nseg=48):
    """Write an ASCII-STL filling funnel (cone + cylinder, side wall only) that
    sits on the bottle mouth: a cone widening from the mouth radius at the rim up
    to body width, then a straight cylinder above.  Because the cone starts at
    the mouth radius there is NO annular gap at the rim, so grains that splash up
    during the pour are funnelled straight back down into the mouth instead of
    escaping the open domain -- exactly like a real bottle-filling funnel.  Walls
    are subdivided vertically so the triangles stay well-shaped."""
    def ring_rows(r0, r1, za, zb):
        seg_w = 2.0 * math.pi * max(r0, r1) / nseg
        nz = max(1, int(math.ceil(abs(zb - za) / (4.0 * seg_w))))
        rows = []
        for j in range(nz + 1):
            f = j / nz
            rows.append((r0 + (r1 - r0) * f, za + (zb - za) * f))
        return rows

    rows = ring_rows(r_bottom, r_top, z_bottom, z_cone_top)      # cone
    rows += ring_rows(r_top, r_top, z_cone_top, z_top)[1:]        # cylinder above
    tris = []
    for k in range(len(rows) - 1):
        rl, zl = rows[k]
        rh, zh = rows[k + 1]
        for i in range(nseg):
            a0 = 2.0 * math.pi * i / nseg
            a1 = 2.0 * math.pi * (i + 1) / nseg
            cl0, sl0 = rl * math.cos(a0), rl * math.sin(a0)
            cl1, sl1 = rl * math.cos(a1), rl * math.sin(a1)
            ch0, sh0 = rh * math.cos(a0), rh * math.sin(a0)
            ch1, sh1 = rh * math.cos(a1), rh * math.sin(a1)
            tris.append(((cl0, sl0, zl), (cl1, sl1, zl), (ch1, sh1, zh)))
            tris.append(((cl0, sl0, zl), (ch1, sh1, zh), (ch0, sh0, zh)))
    write_stl_ascii(path, tris, name="funnel")


PACKING = """\
# Full-bottle validation run -- AUTO-GENERATED (mirrors validated 110count setup)
# Run {run_id}: {family} H={H_mm}mm  density={density}kg/m3  N={count}
#   D_base={dbase_mm}mm  V_gummy={vg_mm3}mm3  bottle={bottle_name}
#   body_D={bodyD_mm}mm mouth_D={mouthD_mm}mm  lambda={lam}
echo both

particle_shape convex

variable ts equal {ts}
variable viz equal 0.02/${{ts}}

simulation_domain low (-{dom_xy:.4f}, -{dom_xy:.4f}, -0.02) high ({dom_xy:.4f}, {dom_xy:.4f}, {dom_z:.4f})
neigh_modify one 10000

materials {{m1}}
material_properties m1 youngsModulus {young} poissonsRatio {poisson} coefficientRestitution {cor} coefficientFriction {cof} coefficientRollingFriction {corf} density {density}

particle_contact_model normal hertz tangential history rolling_friction epsd2
# store_force_contact is OUTPUT-ONLY (per-contact wall force storage); it does
# not affect the contact-force calculation or particle dynamics, and we never
# dump/use wall forces (the analyzer reads particle positions only).  Keeping it
# OFF avoids a forward-comm buffer overflow with large particles contacting the
# highly-triangulated bottle mesh (crashed VB_DN_900_H150 at H=15 insertion).
wall_contact_model normal hertz tangential history rolling_friction epsd2 settings store_force_contact no

enable_gravity
simulation_timestep ${{ts}}

# real bottle, re-emitted in METRES so scale is always 1.0 (matches validated setup)
mesh id cad1 file bottle.stl material m1 scale 1.0 solid yes

particle_template id pts material m1 shape convex file {gummy_stl}
particle_distribution id pdd templates {{pts}} fractions {{1.0}}

# Pre-stacked single-file pour column on the bottle axis (mirrors the validated
# 110count / VB_EC_500 recipe): a narrow vertical stack of grains spaced ~1.15
# bounding-diameters apart that collapses and settles one grain at a time.
# Single-file on the axis passes cleanly through the neck (no bridging), and the
# tight pitch keeps impact velocity low so nothing splashes back out.
{insertion_cmd}

output_settings id output write_every_time 0.05 write_particles yes write_meshes yes meshes {{ cad1 }} ascii yes
dump dmp_par all custom/vtk ${{viz}} post/particles*.vtk id x y z radius
dump dmp_geo all mesh/vtk ${{viz}} post/geometry*.vtk id cad1
status ${{viz}}
enable_loadbalancing

simulate target_time {sim_time}
"""

SUBMIT = """\
#!/bin/bash
#BSUB -J {run_id}
#BSUB -n {ncores}
#BSUB -g /fd2997/cyl_doe
#BSUB -q standard
#BSUB -G health
#BSUB -P 2026
#BSUB -W {walltime}
#BSUB -cwd "{run_abspath}"
#BSUB -R "select[defined(aspherix_solver)] rusage[aspherix_solver={ncores}:duration=5]"
#BSUB -app aspherix
#BSUB -o {run_abspath}/lsf_%J.o
#BSUB -e {run_abspath}/lsf_%J.e

cd "{run_abspath}" || exit 1
source /etc/profile.d/modules.sh
module load aspherix
mkdir -p post
mpirun -np {ncores} aspherix -in packing.asx
"""


def build(run_id, family, H_mm, density, bottle_path, count,
          ncores=16, walltime="8:00", seed=42, submit=False):
    run_dir = RUNS / run_id
    (run_dir / "post").mkdir(parents=True, exist_ok=True)

    # --- bottle mesh -> metres, geometry ---
    tris_raw = read_stl_tris(bottle_path)
    tris, src_scale = to_metres(tris_raw)
    geo = bottle_geometry(tris)
    write_stl_ascii(run_dir / "bottle.stl", tris, name=Path(bottle_path).stem)

    # --- gummy geometry ---
    gummy_stl = run_dir / f"gummy_{family}_H{H_mm:.2f}.stl"
    ginfo = gen_gummy.generate(family, H_mm, str(gummy_stl))
    dbase_m = ginfo["D_base_mm"] / 1000.0
    vg_mm3 = ginfo["vol_mm3"]
    lam = (2.0 * geo["body_r"]) / dbase_m

    # --- gentle single-file pour column, the validated 110count/VB_EC_500 recipe
    # A single-file stack on the bottle axis, spaced ~1.15 bounding-diameters
    # apart, collapses and settles one grain at a time.  Because it is single
    # file on the centreline it passes straight through the bottle neck without
    # bridging, and because the pitch is tight (~3 mm gap) each grain free-falls
    # only a few mm onto the one below -- impact velocity stays low so nothing
    # splashes back out, even for a near-full bottle.  (A looser 1.5x pitch,
    # multi-strand ring, or an added mouth funnel all fail: the funnel bridges at
    # the neck and only a handful of grains ever enter the bottle.)
    bsphere = math.hypot(dbase_m, H_mm / 1000.0)          # orientation-invariant size
    pitch = 1.15 * bsphere                                # proven VB_EC_500 spacing (23.5mm for EC)
    max_ring = 0.0                                        # single file on the axis
    z_start = geo["zmin"] + 0.015                         # first grain just above the base
    z_top_target = z_start + count * pitch                # forces a single strand
    creation_txt, z_top, n_strands, r_ring = rain_column(
        count, z_start, pitch, bsphere, max_ring, z_top_target, seed=seed)
    (run_dir / "creation.asx").write_text(creation_txt)
    insertion_cmd = "include creation.asx"

    dom_xy = geo["body_r"] + 0.02
    dom_z = z_top + 0.15

    # remove any stale files left by earlier chute / funnel / region-pack builds
    for stale in ("guide.stl", "collar.stl"):
        p = run_dir / stale
        if p.exists():
            p.unlink()

    # column collapse (top grain free-fall ~sqrt(2 z_top/g)) + settling margin
    sim_time = round(math.sqrt(2.0 * z_top / 9.81) + 2.5, 2)

    (run_dir / "packing.asx").write_text(PACKING.format(
        run_id=run_id, family=family, H_mm=f"{H_mm:.2f}", density=f"{density:.1f}",
        count=count, dbase_mm=f"{ginfo['D_base_mm']:.2f}", vg_mm3=f"{vg_mm3:.1f}",
        bottle_name=Path(bottle_path).name, bodyD_mm=f"{geo['body_r']*2000:.1f}",
        mouthD_mm=f"{geo['mouth_r']*2000:.1f}", lam=f"{lam:.3f}",
        ts=f"{TS:.2e}", dom_xy=dom_xy, dom_z=dom_z,
        young=YOUNG, poisson=POISSON, cor=COR, cof=CoF, corf=CoRF,
        gummy_stl=gummy_stl.name, sim_time=f"{sim_time:.2f}", insertion_cmd=insertion_cmd))

    (run_dir / "submit.sh").write_text(SUBMIT.format(
        run_id=run_id, ncores=ncores, walltime=walltime,
        run_abspath=str(run_dir.resolve())))
    (run_dir / "submit.sh").chmod(0o755)

    cfg = {
        "run_id": run_id, "family": family, "H_mm": H_mm, "density_kgm3": density,
        "count": count, "bottle_src": str(bottle_path), "src_unit_scale": src_scale,
        "d_base_mm": ginfo["D_base_mm"], "gummy_vol_mm3": vg_mm3,
        "bottle_H_mm": round(geo["H"] * 1000, 1),
        "body_diameter_mm": round(geo["body_r"] * 2000, 2),
        "mouth_diameter_mm": round(geo["mouth_r"] * 2000, 2),
        "lambda_gummies_across": round(lam, 3),
        "fill_method": "single_file_axis_column",
        "pour_pitch_mm": round(pitch * 1000, 2),
        "pour_n_strands": n_strands,
        "pour_ring_r_mm": round(r_ring * 1000, 2),
        "pour_z_start_mm": round(z_start * 1000, 1),
        "pour_z_top_mm": round(z_top * 1000, 1),
        "pour_impact_v_ms": round(math.sqrt(2.0 * 9.81 * max(0.0, z_top - z_start)), 2),
        "sim_time_s": round(sim_time, 2),
        "height_axis": ginfo["height_axis"], "seed": seed,
    }
    (run_dir / "run_config.json").write_text(json.dumps(cfg, indent=2) + "\n")

    print(f"[{run_id}] {family} H={H_mm}mm rho={density} N={count} "
          f"D_base={ginfo['D_base_mm']:.2f}mm Vg={vg_mm3:.0f}mm3")
    print(f"          bottle: {Path(bottle_path).name}  H={geo['H']*1000:.1f}mm "
          f"bodyD={geo['body_r']*2000:.1f}mm mouthD={geo['mouth_r']*2000:.1f}mm "
          f"lambda={lam:.2f}")
    print(f"          fill: single-file axis column  strands={n_strands} "
          f"pitch={pitch*1000:.1f}mm  column z={z_start*1000:.0f}-{z_top*1000:.0f}mm "
          f"(~{math.sqrt(2.0*9.81*max(0.0,z_top-z_start)):.1f} m/s)  sim_time={sim_time:.1f}s")
    print(f"          folder: {run_dir}")

    if submit:
        import subprocess
        with open(run_dir / "submit.sh") as fh:
            r = subprocess.run(["bsub"], stdin=fh, cwd=str(run_dir),
                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        print("          bsub:", r.stdout.decode().strip())
    return cfg


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", required=True)
    ap.add_argument("--family", required=True, choices=["EC", "DoryNew"])
    ap.add_argument("--H", type=float, required=True)
    ap.add_argument("--density", type=float, default=1425.0)
    ap.add_argument("--bottle", required=True)
    ap.add_argument("--count", type=int, required=True)
    ap.add_argument("--ncores", type=int, default=16)
    ap.add_argument("--walltime", default="8:00")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--submit", action="store_true")
    a = ap.parse_args()
    build(a.id, a.family, a.H, a.density, a.bottle, a.count,
          a.ncores, a.walltime, a.seed, a.submit)
