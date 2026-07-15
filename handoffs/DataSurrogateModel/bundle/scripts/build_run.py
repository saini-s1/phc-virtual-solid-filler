#!/usr/bin/env python3
"""
build_run.py -- Assemble one cylinder-DOE run folder and (optionally) submit to LSF.

Creates: gummy STL, cylinder mesh STL, creation.asx (compact non-overlapping
grid stack), packing.asx (MESHED cylinder wall), submit.sh, run_config.json.

Heavy DEM is ALWAYS submitted via bsub (LSF) -- never run on the login node.

Usage:
    python3 build_run.py --id C4 --family EC --H 12.5 --density 1760 \
        --count 150 --dmult 5 [--submit]
"""
import argparse
import json
import math
import random
from pathlib import Path

import gen_gummy
import gen_cylinder

HERE = Path(__file__).parent.resolve()
RUNS = HERE / "runs"

TS = 5e-6
SIM_TIME = 2.0       # >= reference 1.5s; extra margin for the taller drop stacks
YOUNG = 5.0e6
POISSON = 0.25
COR = 0.25
CoF = 0.01           # matches the validated, realistic 110-count reference model
CoRF = 0.10


def grid_stack(count, R_cyl_m, D_base_m, gummy_h_m, seed=42):
    """
    Place `count` gummies on a loose 3-D lattice inside the (capped) cylinder
    with RANDOM orientations, as in the realistic 110-count reference.

    Spacing is based on the gummy's ORIENTATION-INVARIANT bounding-sphere
    diameter  d = sqrt(D_base^2 + h^2)  so that no matter how a particle is
    rotated it can never overlap a neighbour at t=0.  Eliminating initial
    overlaps removes the explosive-repulsion ejection that used to fling flat
    gummies over the rim -> zero leaks (the lid guarantees the rest).
    """
    rng = random.Random(seed)
    bsphere = math.hypot(D_base_m, gummy_h_m)   # max extent for ANY orientation
    s = bsphere * 1.20                          # cubic lattice pitch (all 3 axes)
    r_lim = R_cyl_m - bsphere * 0.55            # keep whole particle off the wall
    if r_lim < 0:
        r_lim = 0.0
    # candidate grid points within radius limit
    pts = []
    k = int(r_lim / s) + 1
    for ix in range(-k, k + 1):
        for iy in range(-k, k + 1):
            x = ix * s
            y = iy * s
            if math.hypot(x, y) <= r_lim:
                pts.append((x, y))
    if not pts:
        pts = [(0.0, 0.0)]
    per_layer = len(pts)
    out = []
    z0 = bsphere * 0.6 + 0.002
    for i in range(count):
        layer = i // per_layer
        x, y = pts[i % per_layer]
        z = z0 + layer * s                      # vertical pitch == in-plane pitch
        # random orientation (as in the realistic reference)
        while True:
            ax, ay, az = rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1)
            m = math.sqrt(ax*ax + ay*ay + az*az)
            if m > 1e-9:
                break
        out.append((x, y, z, (ax/m, ay/m, az/m), rng.uniform(0, 360)))
    return out, per_layer


def write_creation(path, placements):
    lines = [f"# creation.asx -- {len(placements)} gummies, compact grid stack"]
    for x, y, z, (ax, ay, az), ang in placements:
        lines.append(
            f"create_particles template pts mode single "
            f"position ( {x:10.6f}, {y:10.6f}, {z:10.6f}) "
            f"orientation axis ( {ax:10.6f}, {ay:10.6f}, {az:10.6f}) "
            f"angle {ang:10.3f}")
    Path(path).write_text("\n".join(lines) + "\n")


PACKING = """\
# Cylinder-DOE packing run -- AUTO-GENERATED
# Run {run_id}: {family} H={H_mm}mm  density={density}kg/m3  N={count}
#   D_base={dbase_mm}mm  V_gummy={vg_mm3}mm3  mass={mass_g}g
#   cylinder D={cylD_mm}mm (={dmult}x D_base)  H={cylH_mm}mm
echo both

particle_shape convex

variable ts equal {ts}
variable viz equal 0.02/${{ts}}

simulation_domain low (-{dom_xy:.4f}, -{dom_xy:.4f}, -0.005) high ({dom_xy:.4f}, {dom_xy:.4f}, {dom_z:.4f})
neigh_modify one 10000

materials {{m1}}
material_properties m1 youngsModulus {young} poissonsRatio {poisson} coefficientRestitution {cor} coefficientFriction {cof} coefficientRollingFriction {corf} density {density}

particle_contact_model normal hertz tangential history rolling_friction epsd2
wall_contact_model normal hertz tangential history rolling_friction epsd2 settings store_force_contact yes

enable_gravity
simulation_timestep ${{ts}}

# CAPPED MESHED cylinder container (primitive_wall incompatible with convex particles)
mesh id cad1 file cylinder.stl material m1 scale 1.0 solid yes

particle_template id pts material m1 shape convex file {gummy_stl}
particle_distribution id pdd templates {{pts}} fractions {{1.0}}

include creation.asx

output_settings id output write_every_time 0.05 write_particles yes write_meshes no ascii yes
dump dmp_par all custom/vtk ${{viz}} post/particles*.vtk id x y z radius
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

# Data isolation: every job runs entirely inside its OWN folder so the
# fixed-name outputs (post/particles*.vtk, log_aspherix.txt,
# simulation_data_aspherix.csv) can never collide between concurrent runs.
cd "{run_abspath}" || exit 1
source /etc/profile.d/modules.sh
module load aspherix
mkdir -p post
mpirun -np {ncores} aspherix -in packing.asx
"""


def build(run_id, family, H_mm, density, count=150, dmult=8.0,
          ncores=16, walltime="2:00", seed=42, submit=False):
    run_dir = RUNS / run_id
    (run_dir / "post").mkdir(parents=True, exist_ok=True)

    # gummy geometry
    gummy_stl = run_dir / f"gummy_{family}_H{H_mm:.2f}.stl"
    ginfo = gen_gummy.generate(family, H_mm, str(gummy_stl))
    dbase_m = ginfo["D_base_mm"] / 1000.0
    vg_mm3 = ginfo["vol_mm3"]
    mass_g = density * (vg_mm3 * 1e-9) * 1000.0

    # cylinder radius
    cylD_m = dmult * dbase_m
    R_m = cylD_m / 2.0

    # insertion stack (computed BEFORE the tube so the wall can enclose it)
    gummy_w_m = dbase_m
    gummy_h_m = H_mm / 1000.0
    placements, per_layer = grid_stack(count, R_m, gummy_w_m, gummy_h_m, seed=seed)
    write_creation(run_dir / "creation.asx", placements)
    bsphere_m = math.hypot(gummy_w_m, gummy_h_m)
    stack_top = placements[-1][2] + bsphere_m

    # capped tube: lid sits a full bounding-sphere ABOVE the insertion stack so
    # nothing is ever pinned against it; the lid + overlap-free insert make leaks
    # physically impossible.
    cylH_m = stack_top + 2.0 * bsphere_m
    gen_cylinder.generate(str(run_dir / "cylinder.stl"), R_m, cylH_m, cap=True)

    dom_xy = R_m + 0.02
    dom_z = max(cylH_m, stack_top) + 0.05

    (run_dir / "packing.asx").write_text(PACKING.format(
        run_id=run_id, family=family, H_mm=f"{H_mm:.2f}", density=f"{density:.1f}",
        count=count, dbase_mm=f"{ginfo['D_base_mm']:.2f}", vg_mm3=f"{vg_mm3:.1f}",
        mass_g=f"{mass_g:.3f}", cylD_mm=f"{cylD_m*1000:.1f}", dmult=dmult,
        cylH_mm=f"{cylH_m*1000:.1f}", ts=f"{TS:.2e}", dom_xy=dom_xy, dom_z=dom_z,
        young=YOUNG, poisson=POISSON, cor=COR, cof=CoF, corf=CoRF,
        gummy_stl=gummy_stl.name, sim_time=SIM_TIME))

    (run_dir / "submit.sh").write_text(SUBMIT.format(
        run_id=run_id, ncores=ncores, walltime=walltime,
        run_abspath=str(run_dir.resolve())))
    (run_dir / "submit.sh").chmod(0o755)

    cfg = {
        "run_id": run_id, "family": family, "H_mm": H_mm, "density_kgm3": density,
        "count": count, "dmult": dmult, "d_base_mm": ginfo["D_base_mm"],
        "gummy_vol_mm3": vg_mm3, "mass_g": round(mass_g, 4),
        "cyl_diameter_mm": round(cylD_m*1000, 2), "cyl_height_mm": round(cylH_m*1000, 2),
        "per_layer": per_layer, "stack_top_mm": round(stack_top*1000, 1),
        "height_axis": ginfo["height_axis"], "seed": seed,
    }
    (run_dir / "run_config.json").write_text(json.dumps(cfg, indent=2) + "\n")

    print(f"[{run_id}] {family} H={H_mm}mm rho={density} N={count} "
          f"D_base={ginfo['D_base_mm']:.2f}mm Vg={vg_mm3:.0f}mm3 mass={mass_g:.2f}g")
    print(f"          cyl D={cylD_m*1000:.1f}mm H={cylH_m*1000:.1f}mm "
          f"stack_top={stack_top*1000:.0f}mm per_layer={per_layer}")
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
    ap.add_argument("--density", type=float, required=True)
    ap.add_argument("--count", type=int, default=150)
    ap.add_argument("--dmult", type=float, default=8.0)
    ap.add_argument("--ncores", type=int, default=16)
    ap.add_argument("--walltime", default="2:00")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--submit", action="store_true")
    a = ap.parse_args()
    build(a.id, a.family, a.H, a.density, a.count, a.dmult,
          a.ncores, a.walltime, a.seed, a.submit)
