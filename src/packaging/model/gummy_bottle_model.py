#!/usr/bin/env python3
"""
gummy_bottle_model.py -- END-TO-END packaging model.

INPUTS:
  * gummy size   : family (EC/DoryNew) + total height H (mm)  -> Vg, D_base, mass
  * density      : kg/m3 (for mass / bulk-density outputs)
  * bottle       : a PRESET name, an arbitrary STL path, OR new dimensions
  * (optional)   : a target label-claim count

OUTPUTS (all the reviewer's asks):
  * solid fraction phi (from the cylinder surrogate)
  * product fill height + fill % of bottle height
  * SLACK FILL %
  * shoulder height + ideal fill (fill-to-shoulder) + count to shoulder
  * product mass + bulk density
  * density sensitivity table (phi/geometry invariant; mass side scales with rho)

The phi surrogate auto-loads from surrogate_table.csv (produced by
`postprocess_cyl.py --batch`) once the DOE has run; until then it falls back to
the measured feasibility value with a clear note.

Physics: for near-rigid grains (contact overlap <1% here) phi is set by SHAPE
(H aspect ratio) and is ~density-independent -> fill height / slack / count are
density-invariant; only mass = rho*Vg and bulk density = phi*rho scale with rho.

HOW THE PIECES FIT (this file is the one you import):
    gen_gummy        gummy shape -> base diameter, single-gummy volume Vg
    gp_surrogate     GP(H, density) -> the shape/density phi trend
    wall_gp          phi_eff(lambda) -> the wall / finite-size correction
    bottle_translate STL/dimensions -> V(h), shoulder, fill %, slack %
  evaluate() below stitches them together; recommend_bottle() ranks bottles.

Usage:
    # preset bottle
    python3 gummy_bottle_model.py --family EC --H 9.5 --density 1760 \
        --bottle 625cc --count 110
    # new bottle from dimensions (mm)
    python3 gummy_bottle_model.py --family DoryNew --H 13 --density 1920 \
        --new-bottle body_D=70,body_H=90,shoulder_H=12,neck_D=28 --count 90
    # arbitrary STL
    python3 gummy_bottle_model.py --family EC --H 9.5 --density 1760 \
        --stl /path/to/bottle.stl
"""
import argparse
import csv
import json
import tempfile
from pathlib import Path

import gen_gummy
import bottle_translate as bt
import wall_gp
from gp_surrogate import PhiSurrogate as _GPPhi

HERE = Path(__file__).parent.resolve()
DEFAULT_SURROGATE = HERE / "surrogate_table.csv"
DEFAULT_GP = HERE / "phi_gp.json"
DEFAULT_WALL = HERE / "wall_correction.json"
DEFAULT_WALL_GP = HERE / "wall_gp.json"
FALLBACK_PHI = 0.51           # measured bulk-phi plateau until the GP is trained

# nominal shape/density per family (the lambda-sweep anchor point).  The 36-run
# GP contributes the RELATIVE gummy-parameter (H, rho) trend, normalized here so
# it does not double-count the absolute level already set by the deep-bed sweep.
NOMINAL_H = {"EC": 9.5, "DoryNew": 13.0}
NOMINAL_RHO = 1425.0

# Validated applicability window of the deep-bed wall law.  lambda = "gummies
# across" (bottle body diameter / gummy base diameter).  The cylinder sweep that
# trained phi_eff(lambda) spanned lambda = 2.5-6; real-bottle DEM validation sits
# at lambda ~ 3.9-4.7.  Outside [2.5, 6] phi_eff is an EXTRAPOLATION and the
# result is flagged (validity_warnings / in_validated_domain) rather than trusted.
VALID_LAMBDA = (2.5, 6.0)


# ----------------------------------------------------------------------------
# wall / depth correction:  phi_eff(lambda) = phi_inf * (1 - c/lambda)
#   lambda = bottle body diameter / gummy base diameter  ("gummies across").
#   Fit from the DEEP-BED cylinder lambda-sweep (runs_lambda) + validated against
#   the 110-count reference bottle.  This is the bottle-relevant effective phi
#   (~0.55), NOT the shallow 3.2-layer main-DOE phi (~0.515), which under-predicts
#   fill because real bottles are several gummies deep.
# ----------------------------------------------------------------------------
class WallCorrection:
    """phi_eff(lambda) = physical wall law + zero-mean residual GP, the latter
    trained on the cylinder lambda-sweep PLUS the independently-validated
    full-bottle DEM runs and the 110-count reference (see wall_gp.py).  Prefers
    the GP file (wall_gp.json); falls back to the legacy pure-law fit."""
    def __init__(self, gp_path=DEFAULT_WALL_GP, law_path=DEFAULT_WALL):
        self.gp_fam = {}
        self.law_fam = {}
        try:
            if Path(gp_path).exists():
                self.gp_fam = json.load(open(gp_path)).get("families", {})
        except Exception:
            self.gp_fam = {}
        try:
            if Path(law_path).exists():
                self.law_fam = json.load(open(law_path)).get("families", {})
        except Exception:
            self.law_fam = {}

    def phi_eff(self, family, lam):
        # 1) GP wall correction (mean law + residual GP, validated on real bottles)
        f = self.gp_fam.get(family)
        if f:
            phi, lo, hi, note = wall_gp.predict(f, lam)
            return phi, note
        # 2) legacy pure-law fit
        f = self.law_fam.get(family)
        if f:
            pi, c = f["phi_inf"], f["c"]
            phi = pi * (1.0 - c / lam)
            return phi, "wall-corr(deep-bed law): phi_inf=%.3f c=%.3f lambda=%.2f" % (pi, c, lam)
        return None, None

PRESET_BOTTLES = {
    "625cc": "/home/health/fd2997/surrogatetest/bottle_sizes/AX-1397-0_625cc_Packer_Rd.stl",
    "300cc": "/home/health/fd2997/surrogatetest/bottle_sizes/Axium_AX-2513-0_300cc.stl",
    "8oz":   "/home/health/fd2997/surrogatetest/bottle_sizes/BST-1940-0_8oz_Mayo_Round.stl",
}


def _resolve_preset(path):
    """Presets are convenience STLs; resolve them bundle-first (a 'bottles/'
    folder next to this script) then fall back to the original absolute path.
    Any bottle can also be passed directly via --stl, so presets are optional."""
    p = Path(path)
    cand = HERE / "bottles" / p.name
    if cand.exists():
        return str(cand)
    return path


# ----------------------------------------------------------------------------
# phi surrogate
#   1st choice : trained GP (phi_gp.json)  -> phi(H, density | family) + CI/domain
#   2nd choice : piecewise-linear over the raw CSV (density-collapsed)
#   3rd choice : constant fallback
# ----------------------------------------------------------------------------
class PhiSurrogate:
    def __init__(self, csv_path=DEFAULT_SURROGATE, gp_path=DEFAULT_GP):
        self.gp = None
        self.by_family = {}      # family -> list of (H, phi)   (CSV fallback)
        self.source = "fallback"

        # 1) trained GP
        try:
            if Path(gp_path).exists():
                self.gp = _GPPhi.load(str(gp_path))
                self.source = str(gp_path)
        except Exception:
            self.gp = None

        # 2) CSV piecewise-linear (also used if a family is absent from the GP)
        p = Path(csv_path)
        if p.exists():
            data = {}
            for r in csv.DictReader(open(p)):
                try:
                    fam = r["family"]
                    H = float(r["H_mm"])
                    phi = float(r["solid_fraction_phi"])
                    n = int(float(r.get("N_created", "150") or 150))
                except (KeyError, ValueError):
                    continue
                if n != 150:            # exclude QC finite-size runs
                    continue
                data.setdefault(fam, {}).setdefault(H, []).append(phi)
            for fam, hd in data.items():
                pts = sorted((H, sum(v) / len(v)) for H, v in hd.items())
                if pts:
                    self.by_family[fam] = pts
            if self.by_family and self.source == "fallback":
                self.source = str(p)

    def predict(self, family, H, density=1425.0):
        # 1) GP
        if self.gp is not None and family in getattr(self.gp, "models", {}):
            out = self.gp.predict(family, H, density, z=1.645)   # 90% interval
            if out.get("phi") is not None:
                note = "GP %s: 90%%CI[%.3f,%.3f]%s" % (
                    Path(self.source).name, out["phi_lo"], out["phi_hi"],
                    "" if out["in_domain"] else "  OUT-OF-DOMAIN: " + out["reason"])
                return out["phi"], note
        # 2) CSV piecewise-linear
        pts = self.by_family.get(family)
        if pts:
            if len(pts) == 1:
                return pts[0][1], "single-point CSV"
            if H <= pts[0][0]:
                return pts[0][1], "clamped-low CSV"
            if H >= pts[-1][0]:
                return pts[-1][1], "clamped-high CSV"
            for i in range(1, len(pts)):
                if H <= pts[i][0]:
                    (h0, p0), (h1, p1) = pts[i - 1], pts[i]
                    f = (H - h0) / (h1 - h0)
                    return p0 + (p1 - p0) * f, "interp CSV"
        # 3) fallback
        return FALLBACK_PHI, "fallback (no data for family)"


# ----------------------------------------------------------------------------
# gummy geometry for any (family, H)
# ----------------------------------------------------------------------------
def gummy_props(family, H_mm):
    with tempfile.NamedTemporaryFile(suffix=".stl", delete=True) as tf:
        info = gen_gummy.generate(family, H_mm, tf.name)
    return info["vol_mm3"], info["D_base_mm"]


# ----------------------------------------------------------------------------
# bottle resolver: preset | stl | parametric dims
# ----------------------------------------------------------------------------
def resolve_bottle(preset=None, stl=None, new_dims=None):
    if preset:
        path = PRESET_BOTTLES.get(preset)
        if not path:
            raise ValueError(f"unknown preset '{preset}'. "
                             f"choose from {list(PRESET_BOTTLES)}")
        return bt.bottle_profile(_resolve_preset(path))
    if stl:
        return bt.bottle_profile(stl)
    if new_dims:
        return bt.parametric_profile(
            body_D_mm=new_dims["body_D"], body_H_mm=new_dims["body_H"],
            shoulder_H_mm=new_dims.get("shoulder_H", 12.0),
            neck_D_mm=new_dims.get("neck_D", new_dims["body_D"] * 0.4),
            neck_H_mm=new_dims.get("neck_H", 15.0),
            name=new_dims.get("name", "custom_bottle"))
    raise ValueError("specify a bottle: preset, stl, or new_dims")


# ----------------------------------------------------------------------------
# the model
# ----------------------------------------------------------------------------
def evaluate(family, H_mm, density, bottle_spec, target_count=None,
             surrogate=None, wall=None):
    surrogate = surrogate or PhiSurrogate()
    wall = wall or WallCorrection()
    phi_shallow, phi_note = surrogate.predict(family, H_mm, density)
    vg_mm3, dbase_mm = gummy_props(family, H_mm)
    mass_g = density * (vg_mm3 * 1e-9) * 1000.0

    prof = resolve_bottle(**bottle_spec)

    # bottle-relevant EFFECTIVE phi via the deep-bed wall correction; falls back
    # to the shallow bulk phi if wall_correction.json is not present yet.
    body_D = bt.detect_shoulder(prof)["body_diameter_mm"]
    lam = body_D / dbase_mm
    phi, wnote = wall.phi_eff(family, lam)

    # ------- applicability / VALIDITY guard (surface where the model is trusted) -
    # The surrogate is only validated inside a finite envelope; outside it the
    # numbers are EXTRAPOLATIONS and must be flagged, never trusted silently.
    #   * wall law phi_eff(lambda): validated for lambda in VALID_LAMBDA (the
    #     cylinder lambda-sweep span); full-bottle DEM validation sits ~3.9-4.7.
    #   * GP(H, rho): validated inside its trained (H, density) box; the GP's own
    #     domain check (carried in phi_note) flags H or rho outside the DOE range.
    warnings = []
    lo_lam, hi_lam = VALID_LAMBDA
    if lam < lo_lam or lam > hi_lam:
        warnings.append("lambda=%.2f outside validated wall-law range [%.1f,%.1f] "
                        "(EXTRAPOLATION)" % (lam, lo_lam, hi_lam))
    if "OUT-OF-DOMAIN" in (phi_note or ""):
        warnings.append("gummy (H=%.1f, rho=%.0f) outside trained GP domain: %s"
                        % (H_mm, density,
                           phi_note.split("OUT-OF-DOMAIN:")[-1].strip()))

    if phi is None:
        phi, wnote = phi_shallow, "no wall_correction.json -> shallow phi (%s)" % phi_note
    else:
        # fold in the 36-run GP's RELATIVE gummy-parameter (H, rho) trend:
        # deep-bed sweep sets the absolute level + lambda dependence at nominal H;
        # the GP ratio vs nominal carries any H/density signal from the main DOE.
        Hn = NOMINAL_H.get(family, H_mm)
        phi_nom, _ = surrogate.predict(family, Hn, NOMINAL_RHO)
        if phi_nom and phi_nom > 0:
            ratio = phi_shallow / phi_nom
            phi *= ratio
            wnote += "  x GP(H,rho)/nom=%.3f" % ratio
    if warnings:
        wnote += "  [!! VALIDITY: " + "; ".join(warnings) + "]"
    bulk_density = phi * density

    rep = bt.apply_phi(prof, phi, vg_mm3, target_count=target_count)

    # attach gummy + mass-side outputs
    rep["gummy_family"] = family
    rep["gummy_H_mm"] = H_mm
    rep["gummy_Vg_mm3"] = round(vg_mm3, 1)
    rep["gummy_D_base_mm"] = round(dbase_mm, 2)
    rep["gummy_mass_g"] = round(mass_g, 3)
    rep["density_kgm3"] = density
    rep["lambda_gummies_across"] = round(lam, 2)
    rep["phi_used"] = round(phi, 4)
    rep["phi_source"] = wnote
    rep["validity_warnings"] = warnings
    rep["in_validated_domain"] = (len(warnings) == 0)
    rep["phi_bulk_shallow_ref"] = round(phi_shallow, 4)
    rep["bulk_density_kgm3"] = round(bulk_density, 1)
    rep["product_mass_g_at_shoulder"] = round(
        rep["N_gummies_at_shoulder"] * mass_g, 1)
    if target_count:
        rep["target_product_mass_g"] = round(target_count * mass_g, 1)
    return rep


def density_sensitivity(family, H_mm, bottle_spec, densities, surrogate=None):
    """Show how outputs move with density: phi/geometry FLAT, mass side linear."""
    rows = []
    for rho in densities:
        r = evaluate(family, H_mm, rho, bottle_spec, surrogate=surrogate)
        rows.append({
            "density": rho,
            "phi": r["phi_used"],
            "N_to_shoulder": r["N_gummies_at_shoulder"],
            "slack_pct": r["slack_fill_pct_ideal"],
            "gummy_mass_g": r["gummy_mass_g"],
            "product_mass_g": r["product_mass_g_at_shoulder"],
            "bulk_density": r["bulk_density_kgm3"],
        })
    return rows


def recommend_bottle(family, H_mm, density, target_count, bottles=None,
                     surrogate=None, wall=None):
    """Given a gummy + target label-claim count, rank candidate bottles by how
    IDEALLY that count fills them (closest to the fill-to-shoulder line without
    exceeding it).

    `bottles` is a list of (spec_dict) or None to use PRESET_BOTTLES. Each spec
    is the same dict passed to evaluate(): {"preset":..} | {"stl":..} |
    {"new_dims":..}. Returns a list of result rows sorted best-first plus the
    full per-bottle rep for the winner.
    """
    surrogate = surrogate or PhiSurrogate()
    wall = wall or WallCorrection()
    if bottles is None:
        bottles = [{"preset": name} for name in PRESET_BOTTLES]

    rows = []
    for spec in bottles:
        try:
            r = evaluate(family, H_mm, density, spec, target_count=target_count,
                         surrogate=surrogate, wall=wall)
        except Exception as e:                       # skip unreadable bottles
            rows.append({"bottle": str(spec), "error": str(e)})
            continue
        rows.append({
            "spec": spec,
            "bottle": r["bottle"],
            "V_total_cc": r["V_total_cc"],
            "N_at_shoulder": r["N_gummies_at_shoulder"],
            "target_fill_pct_of_H": r.get("target_fill_pct_of_H"),
            "target_slack_pct": r.get("target_slack_fill_pct"),
            "exceeds_shoulder": bool(r.get("target_exceeds_shoulder")),
            "product_mass_g": r.get("target_product_mass_g"),
        })

    # ideal = target count reaches close to (but not past) the shoulder line,
    # i.e. smallest non-negative slack among bottles that are NOT overfilled.
    def _key(x):
        if "error" in x:
            return (2, 0.0)
        overfilled = x["exceeds_shoulder"]
        slack = x["target_slack_pct"] if x["target_slack_pct"] is not None else 99.0
        # rank: not-overfilled first, then tightest fit (smallest slack)
        return (1 if overfilled else 0, abs(slack))

    rows.sort(key=_key)
    return rows


def _parse_dims(s):
    d = {}
    for kv in s.split(","):
        k, v = kv.split("=")
        k = k.strip()
        d[k] = v if k == "name" else float(v)
    return d


def main():
    ap = argparse.ArgumentParser(formatter_class=argparse.RawDescriptionHelpFormatter,
                                 description=__doc__)
    ap.add_argument("--family", required=True, choices=["EC", "DoryNew"])
    ap.add_argument("--H", type=float, required=True, help="gummy total height mm")
    ap.add_argument("--density", type=float, default=1760.0)
    g = ap.add_mutually_exclusive_group(required=False)
    g.add_argument("--bottle", help=f"preset: {list(PRESET_BOTTLES)}")
    g.add_argument("--stl", help="arbitrary bottle STL path")
    g.add_argument("--new-bottle", dest="new_bottle",
                   help="dims mm: body_D=..,body_H=..,shoulder_H=..,neck_D=..[,neck_H=..,name=..]")
    ap.add_argument("--count", type=int, default=None, help="target label-claim count")
    ap.add_argument("--sens", action="store_true",
                    help="print density-sensitivity table")
    ap.add_argument("--recommend", action="store_true",
                    help="rank candidate bottles for the given --count "
                         "(uses presets, plus any STLs given via --catalog)")
    ap.add_argument("--catalog", default=None,
                    help="extra bottle STLs for --recommend: comma-separated "
                         "paths or a directory of *.stl")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()

    # ---- recommend mode: pick the ideal bottle for a target count ----
    if a.recommend:
        if not a.count:
            ap.error("--recommend requires --count")
        bottles = [{"preset": name} for name in PRESET_BOTTLES]
        if a.catalog:
            paths = []
            if Path(a.catalog).is_dir():
                paths = sorted(str(p) for p in Path(a.catalog).glob("*.stl"))
            else:
                paths = [p.strip() for p in a.catalog.split(",") if p.strip()]
            bottles += [{"stl": p} for p in paths]
        surr = PhiSurrogate()
        rows = recommend_bottle(a.family, a.H, a.density, a.count, bottles, surr)
        if a.json:
            print(json.dumps(rows, indent=2, default=str))
        else:
            print(f"\n=== BOTTLE RECOMMENDATION  ({a.family} H={a.H}mm, "
                  f"count={a.count}) ===")
            print(f"  {'rank':>4} {'bottle':<28}{'V_cc':>7}{'N_shldr':>8}"
                  f"{'fill%H':>8}{'slack%':>8}  note")
            for i, r in enumerate(rows, 1):
                if "error" in r:
                    print(f"  {i:>4} {r['bottle'][:28]:<28}  (skipped: {r['error']})")
                    continue
                note = "OVER shoulder" if r["exceeds_shoulder"] else \
                       ("BEST" if i == 1 else "")
                print(f"  {i:>4} {r['bottle'][:28]:<28}{r['V_total_cc']:>7.0f}"
                      f"{r['N_at_shoulder']:>8.0f}"
                      f"{(r['target_fill_pct_of_H'] or 0):>8.1f}"
                      f"{(r['target_slack_pct'] or 0):>8.1f}  {note}")
        print()
        return

    if not (a.bottle or a.stl or a.new_bottle):
        ap.error("specify a bottle (--bottle/--stl/--new-bottle) or use --recommend")

    spec = {}
    if a.bottle:
        spec = {"preset": a.bottle}
    elif a.stl:
        spec = {"stl": a.stl}
    else:
        spec = {"new_dims": _parse_dims(a.new_bottle)}

    surr = PhiSurrogate()
    rep = evaluate(a.family, a.H, a.density, spec, target_count=a.count, surrogate=surr)

    if a.json:
        print(json.dumps(rep, indent=2))
    else:
        print(f"\n=== GUMMY x BOTTLE MODEL ===")
        print(f"  gummy : {rep['gummy_family']} H={rep['gummy_H_mm']}mm  "
              f"Vg={rep['gummy_Vg_mm3']}mm3  D_base={rep['gummy_D_base_mm']}mm  "
              f"mass={rep['gummy_mass_g']}g @ {rep['density_kgm3']}kg/m3")
        print(f"  phi   : {rep['phi_used']}  [{rep['phi_source']}]   "
              f"bulk_density={rep['bulk_density_kgm3']}kg/m3")
        print(f"          lambda={rep['lambda_gummies_across']} gummies-across   "
              f"(shallow-bulk ref phi={rep['phi_bulk_shallow_ref']})")
        print(f"  bottle: {rep['bottle']}  V_total={rep['V_total_cc']}cc  "
              f"H={rep['H_total_mm']}mm  body_D={rep['body_diameter_mm']}mm")
        print(f"  shoulder (ideal fill): {rep['shoulder_height_mm']}mm "
              f"({rep['ideal_fill_pct_of_H']}% of H)")
        print(f"    -> gummies to shoulder : {rep['N_gummies_at_shoulder']:.0f}  "
              f"(mass {rep['product_mass_g_at_shoulder']}g)")
        print(f"    -> headspace           : {rep['headspace_mm_ideal']}mm "
              f"({rep['headspace_cc_ideal']}cc)")
        print(f"    -> slack fill          : {rep['slack_fill_pct_ideal']}%")
        if a.count:
            flag = "  <-- OVER SHOULDER!" if rep["target_exceeds_shoulder"] else ""
            print(f"  TARGET COUNT = {rep['target_count']}:")
            print(f"    -> fill height : {rep['target_fill_height_mm']}mm "
                  f"({rep['target_fill_pct_of_H']}% of H){flag}")
            print(f"    -> headspace   : {rep['target_headspace_mm']}mm "
                  f"({rep['target_headspace_cc']}cc)")
            print(f"    -> slack fill  : {rep['target_slack_fill_pct']}%")
            print(f"    -> product mass: {rep['target_product_mass_g']}g")

    if a.sens:
        print(f"\n  DENSITY SENSITIVITY ({a.family} H={a.H}, {rep['bottle']}):")
        print(f"  {'rho':>6}{'phi':>8}{'N_shldr':>9}{'slack%':>8}"
              f"{'gummy_g':>9}{'prod_g':>9}{'bulk_rho':>10}")
        for r in density_sensitivity(a.family, a.H, spec,
                                     [800, 1200, 1600, 2000, 2400], surr):
            print(f"  {r['density']:>6.0f}{r['phi']:>8.3f}{r['N_to_shoulder']:>9.0f}"
                  f"{r['slack_pct']:>8.1f}{r['gummy_mass_g']:>9.3f}"
                  f"{r['product_mass_g']:>9.1f}{r['bulk_density']:>10.1f}")
    print()


if __name__ == "__main__":
    main()
