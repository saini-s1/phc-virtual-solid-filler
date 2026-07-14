#!/usr/bin/env python3
"""
wall_gp.py -- Gaussian-Process wall/finite-size correction phi_eff(lambda).

WHY THIS FILE EXISTS
--------------------
The first-generation wall correction (wall_correction.py) fit a 2-parameter
straight line  phi_eff = phi_inf*(1 - c/lambda)  to the cylinder lambda-sweep,
and used the real bottles only as an after-the-fact check.  We now have
independently VALIDATED full-bottle DEM runs (100 %% particle retention, drift
< 2 mm) that measure phi_eff directly in the true tapered geometry.  This module
folds that correct data INTO the surrogate the mathematically-honest way.

MODEL  (Rasmussen & Williams, Gaussian Processes for ML)
--------------------------------------------------------
  phi_eff(lambda) = m(lambda)  +  g(x),        x = 1/lambda
    * m(lambda) = phi_inf*(1 - c/lambda)    -- PARAMETRIC MEAN FUNCTION (R&W 2.7)
        the physical wall law; its coefficients (phi_inf, c) are inferred by OLS
        on ALL correct DEEP-BED points (cylinder sweep + validated bottles +
        110-count ref -- all 5+ layers deep, the same regime), so the real
        bottles anchor the absolute level while the wide-range cylinder sweep
        (lambda = 2.5 .. 6) pins the SHAPE and the bulk limit.
    * g(x) ~ GP(0, k(x,x'))                  -- ZERO-MEAN residual GP (R&W 2.2)
        an ARD-RBF residual process trained on ALL correct phi_eff points
        (cylinder sweep + validated bottles + the 110-count reference).  Being
        zero-mean, g -> 0 away from data, so far from the observations (e.g. the
        bulk limit lambda -> inf, x -> 0) the prediction reverts EXACTLY to the
        validated physical law m(lambda).  Where real bottles were measured, g
        bends the curve onto them and reports a calibrated uncertainty band.

  Hyperparameters (length-scale, signal var, noise) are chosen by maximising the
  log marginal likelihood (R&W 5.4); leave-one-out CV (R&W 5.4.2, closed form)
  reports the honest predictive error.  All linear algebra is the exact,
  dependency-free GP machinery already in gp_surrogate.py.

USAGE
-----
  python3 wall_gp.py --fit                 # collect points, fit, LOO, save
  python3 wall_gp.py --predict --family EC --lambda 4.2
"""
import argparse
import csv
import json
import math
import sys
from pathlib import Path

from gp_surrogate import GP, _k, cholesky, chol_solve, solve_lower, nelder_mead
import wall_correction as wc

HERE = Path(__file__).parent.resolve()
OUT = HERE / "wall_gp.json"

# Nominal gummy height per family (the height at which the cylinder lambda-sweep
# -- the wall-law backbone -- was run).  Only bottles at this height may train
# the phi_eff(lambda) size law; any height trend is carried SEPARATELY by
# GP(H, rho) in gummy_bottle_model, so an off-nominal-H bottle would fold the
# height effect into the size law and be double-counted at predict time.
NOMINAL_H = {"EC": 9.5, "DoryNew": 13.0}
NOMINAL_H_TOL = 0.25   # mm


# --------------------------------------------------------------------------- #
#  1.  Collect every CORRECT phi_eff(lambda) observation, per family          #
# --------------------------------------------------------------------------- #
def collect_points():
    """Return {family: [(lambda, phi_eff, source), ...]} from the clean data."""
    pts = {"EC": [], "DoryNew": []}

    # (a) cylinder lambda-sweep -- the backbone shape (lambda == gummies_across)
    lam_csv = HERE / "lambda_table.csv"
    if lam_csv.exists():
        for r in csv.DictReader(open(lam_csv)):
            try:
                fam = r["family"]
                lam = float(r["gummies_across"])
                phi = float(r["solid_fraction_phi"])
            except (KeyError, ValueError):
                continue
            if fam in pts:
                pts[fam].append((lam, phi, "cyl-sweep:%s" % r.get("run_id", "?")))

    # (b) validated full-bottle runs -- real tapered geometry (PASS only, and
    #     ONLY at nominal gummy height -- see NOMINAL_H note above).  H-variant
    #     bottles stay in validation_table.csv for held-out validation but must
    #     NOT train the size law.
    val_csv = HERE / "validation_table.csv"
    if val_csv.exists():
        for r in csv.DictReader(open(val_csv)):
            if r.get("verdict", "").strip().upper() != "PASS":
                continue
            try:
                fam = r["family"]
                lam = float(r["lambda"])
                phi = float(r["sim_phi"])
                H = float(r["H_mm"])
            except (KeyError, ValueError):
                continue
            if fam not in pts or phi <= 0:
                continue
            Hnom = NOMINAL_H.get(fam)
            if Hnom is not None and abs(H - Hnom) > NOMINAL_H_TOL:
                sys.stderr.write(
                    "wall_gp: excluding off-nominal-H bottle %s (H=%.2f, "
                    "nominal %.2f) from the phi_eff(lambda) fit\n"
                    % (r.get("run_id", "?"), H, Hnom))
                continue
            pts[fam].append((lam, phi, "bottle:%s" % r.get("run_id", "?")))

    # (c) the free 110-count reference bottle (EC) -- computed live from the DEM
    try:
        b = wc.bottle110_point()
        pts[b["family"]].append((b["lambda"], b["phi_eff"], "110count-ref"))
    except Exception as e:
        sys.stderr.write("warn: 110count point unavailable (%s)\n" % e)

    for f in pts:
        pts[f].sort()
    return pts


# --------------------------------------------------------------------------- #
#  2.  Parametric mean function: OLS phi_inf*(1 - c/lambda) on all deep-bed pts #
# --------------------------------------------------------------------------- #
def fit_mean_law(points):
    """points: [(lambda, phi, source)] -> (phi_inf, c) via the wall_correction OLS."""
    return wc.fit_lambda([(lam, phi) for lam, phi, _ in points])


# --------------------------------------------------------------------------- #
#  3.  Zero-mean residual GP over x = 1/lambda                                 #
# --------------------------------------------------------------------------- #
def _fit_zero_mean_gp(Xs, ys, ls, sf2, noise):
    """Exact GP with a ZERO mean prior (so predictions -> 0 far from data)."""
    gp = GP(ls, sf2, noise)
    gp.X = [list(x) for x in Xs]
    gp.ymean = 0.0
    gp.y = list(ys)
    n = len(Xs)
    K = [[_k(gp.X[i], gp.X[j], gp.ls, gp.sf2) for j in range(n)] for i in range(n)]
    for i in range(n):
        K[i][i] += gp.noise
    gp.L = cholesky(K)
    gp.alpha = chol_solve(gp.L, gp.y)
    return gp


def fit_residual_gp(points, phi_inf, c):
    """Fit g(x)=phi_meas-m(lambda) with a zero-mean 1-D ARD-RBF GP.
    Returns a dict (portable) with the standardisation + GP state."""
    lam = [p[0] for p in points]
    phi = [p[1] for p in points]
    x = [1.0 / l for l in lam]                       # feature
    r = [phi[i] - phi_inf * (1.0 - c / lam[i]) for i in range(len(lam))]  # residual

    xmean = sum(x) / len(x)
    xvar = sum((v - xmean) ** 2 for v in x) / max(len(x) - 1, 1)
    xstd = math.sqrt(xvar) if xvar > 1e-18 else 1.0
    # scale residual by RMS (NOT mean-centred: keeps the zero-mean-at-infinity prior)
    ystd = math.sqrt(sum(v * v for v in r) / len(r)) or 1.0

    Xs = [[(v - xmean) / xstd] for v in x]
    ys = [v / ystd for v in r]

    def neg_lml(theta):
        ls = [math.exp(theta[0])]
        sf2 = math.exp(theta[1])
        noise = math.exp(theta[2]) + 1e-10
        try:
            return -_fit_zero_mean_gp(Xs, ys, ls, sf2, noise).log_marginal_likelihood()
        except Exception:
            return 1e18

    best = None
    for s in ([0.0, 0.0, math.log(0.1)],
              [0.7, -0.3, math.log(0.05)],
              [-0.5, 0.3, math.log(0.2)]):
        theta, val = nelder_mead(neg_lml, s, step=0.6, iters=300)
        if best is None or val < best[1]:
            best = (theta, val)
    theta = best[0]
    ls = [math.exp(theta[0])]
    sf2 = math.exp(theta[1])
    noise = math.exp(theta[2]) + 1e-10
    gp = _fit_zero_mean_gp(Xs, ys, ls, sf2, noise)

    return {
        "ls": gp.ls, "sf2": gp.sf2, "noise": gp.noise,
        "X": gp.X, "alpha": gp.alpha, "L": gp.L,
        "xmean": xmean, "xstd": xstd, "ystd": ystd,
        "n": len(points),
    }


# --------------------------------------------------------------------------- #
#  4.  Prediction (mean law + residual GP)                                     #
# --------------------------------------------------------------------------- #
def predict(fam_model, lam, z=1.645):
    """Return (phi_eff, phi_lo, phi_hi, note).  z=1.645 -> 90% interval."""
    phi_inf = fam_model["phi_inf"]
    c = fam_model["c"]
    mean_law = phi_inf * (1.0 - c / lam)
    gp = fam_model.get("gp")
    if not gp:
        return mean_law, mean_law, mean_law, \
            "wall-law only: phi_inf=%.3f c=%.3f lambda=%.2f" % (phi_inf, c, lam)

    xs = [((1.0 / lam) - gp["xmean"]) / gp["xstd"]]
    ks = [_k(Xi, xs, gp["ls"], gp["sf2"]) for Xi in gp["X"]]
    r_s = sum(ks[i] * gp["alpha"][i] for i in range(len(ks)))
    v = solve_lower([list(row) for row in gp["L"]], ks)
    var_s = gp["sf2"] + gp["noise"] - sum(vi * vi for vi in v)
    if var_s < 0.0:
        var_s = 0.0
    r = r_s * gp["ystd"]
    std = math.sqrt(var_s) * gp["ystd"]
    phi = mean_law + r
    return (phi, phi - z * std, phi + z * std,
            "wall-GP: mean(phi_inf=%.3f,c=%.3f)+resid=%.4f  lambda=%.2f  90%%CI[%.3f,%.3f]"
            % (phi_inf, c, r, lam, phi - z * std, phi + z * std))


# --------------------------------------------------------------------------- #
#  5.  Leave-one-out CV in phi units (R&W 5.4.2 closed form)                   #
# --------------------------------------------------------------------------- #
def loo_phi(points, phi_inf, c, gpd):
    lam = [p[0] for p in points]
    phi = [p[1] for p in points]
    gp = GP(gpd["ls"], gpd["sf2"], gpd["noise"])
    gp.X = [list(x) for x in gpd["X"]]
    gp.ymean = 0.0
    gp.y = [(phi[i] - phi_inf * (1.0 - c / lam[i])) / gpd["ystd"] for i in range(len(lam))]
    gp.L = [list(row) for row in gpd["L"]]
    gp.alpha = chol_solve(gp.L, gp.y)
    loo = gp.loo()
    pred = []
    for i in range(len(lam)):
        r_hat = loo[i][0] * gpd["ystd"]
        pred.append(phi_inf * (1.0 - c / lam[i]) + r_hat)
    n = len(phi)
    m = sum(phi) / n
    ss_tot = sum((v - m) ** 2 for v in phi) or 1e-18
    ss_res = sum((phi[i] - pred[i]) ** 2 for i in range(n))
    r2 = 1.0 - ss_res / ss_tot
    rmse = math.sqrt(ss_res / n)
    mae = sum(abs(phi[i] - pred[i]) for i in range(n)) / n
    return {"R2": r2, "RMSE": rmse, "MAE": mae, "pred": pred}


# --------------------------------------------------------------------------- #
#  fit / predict CLI                                                           #
# --------------------------------------------------------------------------- #
def build():
    allpts = collect_points()
    result = {
        "model": "phi_eff(lambda) = phi_inf*(1 - c/lambda) + zero-mean residual GP(1/lambda)",
        "method": "R&W GP with parametric mean function; mean=OLS on ALL correct "
                  "deep-bed points (cylinder sweep + validated bottles + 110-count "
                  "ref), zero-mean residual GP for local structure + uncertainty; "
                  "hypers by log-marginal-likelihood, honest error by LOO-CV.",
        "families": {},
    }
    for fam, pts in allpts.items():
        if len(pts) < 4:
            continue
        cyl = [p for p in pts if p[2].startswith("cyl")]
        phi_inf, c = fit_mean_law(pts)          # mean coeffs from ALL correct pts
        gpd = fit_residual_gp(pts, phi_inf, c)
        loo = loo_phi(pts, phi_inf, c, gpd)
        result["families"][fam] = {
            "phi_inf": round(phi_inf, 4), "c": round(c, 4),
            "gp": gpd,
            "points": [[round(l, 3), round(p, 4), s] for l, p, s in pts],
            "loo": {"R2": round(loo["R2"], 4), "RMSE": round(loo["RMSE"], 5),
                    "MAE": round(loo["MAE"], 5)},
        }

        print("\n=== %s wall GP ===" % fam)
        print("  mean law: phi_inf=%.4f  c=%.4f  (OLS on %d pts: %d cyl + %d bottle/ref)"
              % (phi_inf, c, len(pts), len(cyl), len(pts) - len(cyl)))
        print("  residual GP: %d points  ls=%.3f sf2=%.4f noise=%.4g"
              % (gpd["n"], gpd["ls"][0], gpd["sf2"], gpd["noise"]))
        print("  LOO-CV:  R2=%.3f  RMSE=%.4f  MAE=%.4f" % (loo["R2"], loo["RMSE"], loo["MAE"]))
        print("  %-22s %-7s %-8s %-8s %-8s %-8s"
              % ("source", "lambda", "phi_meas", "law", "GP", "resid"))
        for i, (l, pm, s) in enumerate(pts):
            law = phi_inf * (1.0 - c / l)
            pf, lo, hi, _ = predict(result["families"][fam], l)
            print("  %-22s %-7.3f %-8.4f %-8.4f %-8.4f %+.4f"
                  % (s, l, pm, law, pf, pm - pf))

    json.dump(result, open(OUT, "w"), indent=2)
    print("\nSaved -> %s" % OUT)
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fit", action="store_true")
    ap.add_argument("--predict", action="store_true")
    ap.add_argument("--family", default="EC")
    ap.add_argument("--lambda", dest="lam", type=float, default=4.2)
    a = ap.parse_args()

    if a.predict:
        model = json.load(open(OUT))["families"].get(a.family)
        if not model:
            print("no model for family %r" % a.family)
            return 1
        phi, lo, hi, note = predict(model, a.lam)
        print("phi_eff=%.4f  90%%CI=[%.4f, %.4f]\n  %s" % (phi, lo, hi, note))
        return 0

    build()
    return 0


if __name__ == "__main__":
    sys.exit(main())
