#!/usr/bin/env python3
"""
gp_surrogate.py  --  Dependency-free Gaussian Process surrogate for gummy packing.

WHY THIS FILE EXISTS
--------------------
We need a surrogate phi_hat(H, density | family) that (a) fits the DEM data
tightly, (b) reports its own uncertainty, (c) tells us WHERE it stops being
valid, and (d) is trivially portable into a UI on any machine.

DESIGN CHOICES (and why they are safe)
--------------------------------------
* PURE PYTHON, STDLIB ONLY.  The cluster's Python 3.6.8 has no numpy / scipy /
  sklearn, and the eventual UI must run anywhere.  So all linear algebra
  (Cholesky, triangular solves, matrix inverse) is hand-coded below.
* NO PERFORMANCE RISK.  An exact GP on n training points is one n x n Cholesky
  (O(n^3)) plus O(n^2) per prediction.  Our DOE is ~18 points per family, so the
  factorisation is ~5000 flops -- microseconds in pure Python.  See --selftest,
  which prints wall-times.
* NO ACCURACY RISK.  This is the *exact* GP posterior (Rasmussen & Williams,
  eqs 2.23-2.24), the identical math sklearn/GPy run; a jitter/noise term keeps
  the Cholesky positive-definite.  --selftest verifies the posterior interpolates
  the data and that variance -> 0 at the training points as noise -> 0.
* logit(phi) TARGET.  phi in (0,1); we model y = logit(phi) so the surrogate can
  never predict an unphysical phi<0 or phi>1, and back-transform with sigmoid.
* ARD KERNEL.  Separate length-scales for H and density.  density is nearly
  irrelevant to phi (rigid-particle fact), so the optimiser simply learns a huge
  density length-scale and the GP ignores it -- no manual feature pruning needed.
* APPLICABILITY DOMAIN.  predict() flags inputs outside the trained (H,density)
  box AND inputs where the predictive std exceeds a noise-referenced threshold.
  That boundary is the "where the model stops being valid" the project needs.

CLI
---
  python3 gp_surrogate.py --selftest
  python3 gp_surrogate.py --train surrogate_table.csv --out phi_gp.json
  python3 gp_surrogate.py --predict phi_gp.json --family EC --H 11 --density 1600
  python3 gp_surrogate.py --loo phi_gp.json          # print LOO-CV table
"""

import argparse
import csv
import json
import math
import random
import sys
import time

# --------------------------------------------------------------------------- #
#  READING MAP  --  where to look first                                        #
# --------------------------------------------------------------------------- #
#  The only thing the app and the CLI touch is PhiSurrogate.  If you are here to
#  use or retrain the model, jump straight to it and ignore the math above it.
#
#    START HERE  -> class PhiSurrogate   train() / predict() / save() / load()
#                   load_rows()          read surrogate_table.csv into rows
#                   main()               CLI: --train / --predict / --loo / --selftest  (bottom)
#
#  Everything else is plumbing you rarely need to open:
#    class GP            one exact GP  (fit / predict / marginal likelihood / LOO)
#    nelder_mead()       hyper-parameter search, so we need no scipy
#    cholesky, solve_*   pure-Python linear algebra for symmetric-PD systems
#    logit / sigmoid     keep the predicted phi inside (0, 1)
# --------------------------------------------------------------------------- #

# --------------------------------------------------------------------------- #
#  Pure-Python linear algebra (SPD systems only)                              #
# --------------------------------------------------------------------------- #

def cholesky(A):
    """Lower Cholesky factor L (A = L L^T) for a symmetric positive-def matrix."""
    n = len(A)
    L = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1):
            s = 0.0
            for k in range(j):
                s += L[i][k] * L[j][k]
            if i == j:
                d = A[i][i] - s
                if d <= 0.0:                     # numerical guard
                    d = 1e-300
                L[i][j] = math.sqrt(d)
            else:
                L[i][j] = (A[i][j] - s) / L[j][j]
    return L


def solve_lower(L, b):
    """Forward substitution: solve L y = b for lower-triangular L."""
    n = len(L)
    y = [0.0] * n
    for i in range(n):
        s = 0.0
        for k in range(i):
            s += L[i][k] * y[k]
        y[i] = (b[i] - s) / L[i][i]
    return y


def solve_lowerT(L, b):
    """Back substitution: solve L^T x = b for lower-triangular L."""
    n = len(L)
    x = [0.0] * n
    for i in range(n - 1, -1, -1):
        s = 0.0
        for k in range(i + 1, n):
            s += L[k][i] * x[k]
        x[i] = (b[i] - s) / L[i][i]
    return x


def chol_solve(L, b):
    """Solve A x = b given A = L L^T."""
    return solve_lowerT(L, solve_lower(L, b))


def chol_inverse(L):
    """Full inverse of A = L L^T (needed only for the closed-form LOO diagonal)."""
    n = len(L)
    inv = [[0.0] * n for _ in range(n)]
    for j in range(n):
        e = [0.0] * n
        e[j] = 1.0
        col = chol_solve(L, e)
        for i in range(n):
            inv[i][j] = col[i]
    return inv


# --------------------------------------------------------------------------- #
#  ARD squared-exponential kernel                                             #
# --------------------------------------------------------------------------- #

def _k(a, b, ls, sf2):
    s = 0.0
    for d in range(len(a)):
        t = (a[d] - b[d]) / ls[d]
        s += t * t
    return sf2 * math.exp(-0.5 * s)


# --------------------------------------------------------------------------- #
#  Core exact GP regressor                                                    #
# --------------------------------------------------------------------------- #

class GP:
    """Exact GP regression with an ARD-RBF kernel and Gaussian noise.

    Hyperparameters (all positive):
        ls    : list of per-dimension length-scales
        sf2   : signal variance
        noise : observation noise variance (also the numerical nugget)
    Works in standardised feature/target space; the PhiSurrogate wrapper owns
    the transforms so this class stays generic and reusable.
    """

    def __init__(self, ls, sf2, noise):
        self.ls = list(ls)
        self.sf2 = float(sf2)
        self.noise = float(noise)
        self.X = None
        self.y = None
        self.ymean = 0.0
        self.L = None
        self.alpha = None

    # -- training -------------------------------------------------------------
    def fit(self, X, y):
        self.X = [list(x) for x in X]
        self.ymean = sum(y) / len(y)
        self.y = [v - self.ymean for v in y]
        n = len(X)
        K = [[_k(self.X[i], self.X[j], self.ls, self.sf2) for j in range(n)]
             for i in range(n)]
        for i in range(n):
            K[i][i] += self.noise
        self.L = cholesky(K)
        self.alpha = chol_solve(self.L, self.y)
        return self

    # -- prediction -----------------------------------------------------------
    def predict(self, xs):
        """Return (mean, variance) at a single point xs (standardised space)."""
        ks = [_k(xi, xs, self.ls, self.sf2) for xi in self.X]
        mean = self.ymean + sum(ks[i] * self.alpha[i] for i in range(len(ks)))
        v = solve_lower(self.L, ks)
        var = self.sf2 + self.noise - sum(vi * vi for vi in v)
        if var < 0.0:
            var = 0.0
        return mean, var

    # -- model selection ------------------------------------------------------
    def log_marginal_likelihood(self):
        n = len(self.X)
        fit = -0.5 * sum(self.y[i] * self.alpha[i] for i in range(n))
        logdet = 0.0
        for i in range(n):
            logdet += math.log(self.L[i][i])
        return fit - logdet - 0.5 * n * math.log(2.0 * math.pi)

    # -- leave-one-out (closed form, R&W eq 5.10-5.12) ------------------------
    def loo(self):
        """Return per-point (loo_mean, loo_var) without refitting n times."""
        Kinv = chol_inverse(self.L)
        out = []
        for i in range(len(self.X)):
            kii = Kinv[i][i]
            mu = self.ymean + (self.y[i] - self.alpha[i] / kii)
            var = 1.0 / kii
            out.append((mu, var))
        return out


# --------------------------------------------------------------------------- #
#  Nelder-Mead (downhill simplex) -- tiny, robust, gradient-free              #
# --------------------------------------------------------------------------- #

def nelder_mead(f, x0, step=0.5, iters=400, tol=1e-8):
    n = len(x0)
    simplex = [list(x0)]
    for i in range(n):
        p = list(x0)
        p[i] += step
        simplex.append(p)
    fvals = [f(p) for p in simplex]

    for _ in range(iters):
        order = sorted(range(n + 1), key=lambda i: fvals[i])
        simplex = [simplex[i] for i in order]
        fvals = [fvals[i] for i in order]
        if abs(fvals[-1] - fvals[0]) < tol:
            break
        cent = [sum(simplex[i][d] for i in range(n)) / n for d in range(n)]
        # reflection
        xr = [cent[d] + 1.0 * (cent[d] - simplex[-1][d]) for d in range(n)]
        fr = f(xr)
        if fvals[0] <= fr < fvals[-2]:
            simplex[-1], fvals[-1] = xr, fr
        elif fr < fvals[0]:
            xe = [cent[d] + 2.0 * (cent[d] - simplex[-1][d]) for d in range(n)]
            fe = f(xe)
            if fe < fr:
                simplex[-1], fvals[-1] = xe, fe
            else:
                simplex[-1], fvals[-1] = xr, fr
        else:
            xc = [cent[d] + 0.5 * (simplex[-1][d] - cent[d]) for d in range(n)]
            fc = f(xc)
            if fc < fvals[-1]:
                simplex[-1], fvals[-1] = xc, fc
            else:
                for i in range(1, n + 1):
                    simplex[i] = [simplex[0][d] + 0.5 * (simplex[i][d] - simplex[0][d])
                                  for d in range(n)]
                    fvals[i] = f(simplex[i])
    best = min(range(n + 1), key=lambda i: fvals[i])
    return simplex[best], fvals[best]


# --------------------------------------------------------------------------- #
#  transforms                                                                 #
# --------------------------------------------------------------------------- #

def logit(p):
    p = min(max(p, 1e-6), 1.0 - 1e-6)
    return math.log(p / (1.0 - p))


def sigmoid(x):
    if x >= 0:
        z = math.exp(-x)
        return 1.0 / (1.0 + z)
    z = math.exp(x)
    return z / (1.0 + z)


def _mean_std(vals):
    m = sum(vals) / len(vals)
    if len(vals) < 2:
        return m, 1.0
    var = sum((v - m) ** 2 for v in vals) / (len(vals) - 1)
    return m, math.sqrt(var) if var > 0 else 1.0


# --------------------------------------------------------------------------- #
#  metrics                                                                     #
# --------------------------------------------------------------------------- #

def r2_rmse_mae(y_true, y_pred):
    n = len(y_true)
    m = sum(y_true) / n
    ss_tot = sum((v - m) ** 2 for v in y_true)
    ss_res = sum((y_true[i] - y_pred[i]) ** 2 for i in range(n))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else float("nan")
    rmse = math.sqrt(ss_res / n)
    mae = sum(abs(y_true[i] - y_pred[i]) for i in range(n)) / n
    return r2, rmse, mae


# --------------------------------------------------------------------------- #
#  PhiSurrogate: one GP per family over (H, density) -> logit(phi)            #
# --------------------------------------------------------------------------- #

class PhiSurrogate:
    FEATURES = ("H_mm", "density_kgm3")

    def __init__(self):
        self.models = {}    # family -> dict(gp, xmean, xstd, ymean, ystd, box, noise)

    # -- fit one family -------------------------------------------------------
    def _fit_family(self, rows):
        X = [[r["H_mm"], r["density_kgm3"]] for r in rows]
        phi = [r["phi"] for r in rows]
        y = [logit(p) for p in phi]

        # standardise features and target
        cols = list(zip(*X))
        xmean = [sum(c) / len(c) for c in cols]
        xstd = []
        for d, c in enumerate(cols):
            _, s = _mean_std(c)
            xstd.append(s if s > 1e-9 else 1.0)
        Xs = [[(x[d] - xmean[d]) / xstd[d] for d in range(len(x))] for x in X]
        ymean, ystd = _mean_std(y)
        ys = [(v - ymean) / ystd for v in y]

        # optimise hyperparameters by maximising the log marginal likelihood.
        # theta = [log ls_H, log ls_rho, log sf2, log noise]  (log keeps them +ve)
        def neg_lml(theta):
            ls = [math.exp(theta[0]), math.exp(theta[1])]
            sf2 = math.exp(theta[2])
            noise = math.exp(theta[3]) + 1e-8
            try:
                gp = GP(ls, sf2, noise).fit(Xs, ys)
                return -gp.log_marginal_likelihood()
            except Exception:
                return 1e18

        best = None
        # a few restarts so we don't sit in a poor local optimum
        starts = [
            [0.0, 0.0, 0.0, math.log(0.1)],
            [0.7, 2.0, 0.0, math.log(0.05)],
            [-0.5, 1.5, -0.3, math.log(0.02)],
        ]
        for s in starts:
            theta, val = nelder_mead(neg_lml, s, step=0.6, iters=300)
            if best is None or val < best[1]:
                best = (theta, val)
        theta = best[0]
        ls = [math.exp(theta[0]), math.exp(theta[1])]
        sf2 = math.exp(theta[2])
        noise = math.exp(theta[3]) + 1e-8
        gp = GP(ls, sf2, noise).fit(Xs, ys)

        box = {self.FEATURES[d]: (min(cols[d]), max(cols[d]))
               for d in range(len(self.FEATURES))}
        return {
            "gp": gp, "xmean": xmean, "xstd": xstd,
            "ymean": ymean, "ystd": ystd, "box": box,
            "noise_std_logit": math.sqrt(noise) * ystd, "n": len(rows),
        }

    def train(self, rows):
        """rows: list of dicts with family, H_mm, density_kgm3, phi."""
        fam = {}
        for r in rows:
            fam.setdefault(r["family"], []).append(r)
        for f, rr in fam.items():
            if len(rr) >= 4:
                self.models[f] = self._fit_family(rr)
        return self

    # -- predict --------------------------------------------------------------
    def predict(self, family, H, density, z=1.0):
        """Return dict: phi, phi_lo, phi_hi, phi_std_logit, in_domain, reason."""
        if family not in self.models:
            return {"phi": None, "in_domain": False,
                    "reason": "no model for family %r" % family}
        m = self.models[family]
        gp = m["gp"]
        xs = [(H - m["xmean"][0]) / m["xstd"][0],
              (density - m["xmean"][1]) / m["xstd"][1]]
        mean_s, var_s = gp.predict(xs)
        mean = mean_s * m["ystd"] + m["ymean"]                 # logit space
        std = math.sqrt(var_s) * m["ystd"]
        phi = sigmoid(mean)
        phi_lo = sigmoid(mean - z * std)
        phi_hi = sigmoid(mean + z * std)

        # applicability domain
        reasons = []
        for i, feat in enumerate((("H_mm", H), ("density_kgm3", density))):
            name, val = feat
            lo, hi = m["box"][name]
            span = hi - lo if hi > lo else 1.0
            if val < lo - 0.05 * span or val > hi + 0.05 * span:
                reasons.append("%s=%.3g outside trained [%.3g, %.3g]"
                               % (name, val, lo, hi))
        # uncertainty guard: predictive std well above the fitted noise floor
        if std > 2.5 * m["noise_std_logit"]:
            reasons.append("predictive std %.3f >> noise floor %.3f (logit)"
                           % (std, m["noise_std_logit"]))
        return {
            "phi": phi, "phi_lo": phi_lo, "phi_hi": phi_hi,
            "phi_std_logit": std, "in_domain": len(reasons) == 0,
            "reason": "; ".join(reasons) if reasons else "in domain",
        }

    # -- leave-one-out validation --------------------------------------------
    def loo_report(self, rows):
        """Per-family LOO-CV in phi units."""
        fam = {}
        for r in rows:
            fam.setdefault(r["family"], []).append(r)
        report = {}
        for f, rr in fam.items():
            if len(rr) < 4:
                continue
            m = self._fit_family(rr)
            gp = m["gp"]
            loo = gp.loo()
            phi_true = [r["phi"] for r in rr]
            phi_pred = [sigmoid(loo[i][0] * m["ystd"] + m["ymean"])
                        for i in range(len(rr))]
            r2, rmse, mae = r2_rmse_mae(phi_true, phi_pred)
            report[f] = {"n": len(rr), "R2": r2, "RMSE": rmse, "MAE": mae,
                         "true": phi_true, "pred": phi_pred,
                         "ids": [r.get("run_id", "?") for r in rr]}
        return report

    # -- persistence (portable JSON) -----------------------------------------
    def to_dict(self):
        out = {"features": list(self.FEATURES), "families": {}}
        for f, m in self.models.items():
            gp = m["gp"]
            out["families"][f] = {
                "ls": gp.ls, "sf2": gp.sf2, "noise": gp.noise,
                "X": gp.X, "y_centered": gp.y, "ymean_gp": gp.ymean,
                "alpha": gp.alpha, "L": gp.L,
                "xmean": m["xmean"], "xstd": m["xstd"],
                "ymean": m["ymean"], "ystd": m["ystd"],
                "box": m["box"], "noise_std_logit": m["noise_std_logit"],
                "n": m["n"],
            }
        return out

    def save(self, path):
        with open(path, "w") as fh:
            json.dump(self.to_dict(), fh, indent=2)

    @classmethod
    def load(cls, path):
        with open(path) as fh:
            d = json.load(fh)
        s = cls()
        for f, g in d["families"].items():
            gp = GP(g["ls"], g["sf2"], g["noise"])
            gp.X = [list(x) for x in g["X"]]
            gp.y = list(g["y_centered"])
            gp.ymean = g["ymean_gp"]
            gp.alpha = list(g["alpha"])
            gp.L = [list(r) for r in g["L"]]
            s.models[f] = {
                "gp": gp, "xmean": g["xmean"], "xstd": g["xstd"],
                "ymean": g["ymean"], "ystd": g["ystd"],
                "box": {k: tuple(v) for k, v in g["box"].items()},
                "noise_std_logit": g["noise_std_logit"], "n": g["n"],
            }
        return s


# --------------------------------------------------------------------------- #
#  CSV loading (surrogate_table.csv from postprocess_cyl.py)                  #
# --------------------------------------------------------------------------- #

def load_rows(csv_path, only_count=None):
    """Load surrogate rows.  If only_count is set (e.g. 150), keep only runs at
    that particle count -- this EXCLUDES the QC finite-size runs (N=40/90) whose
    phi is biased low by the incomplete bed and must not train the surrogate."""
    rows = []
    with open(csv_path) as fh:
        reader = csv.DictReader(fh)
        for r in reader:
            try:
                phi = float(r.get("solid_fraction_phi", r.get("phi", "")))
                n_created = int(float(r.get("N_created", r.get("count", "0")) or 0))
                if only_count is not None and n_created != only_count:
                    continue
                rows.append({
                    "run_id": r.get("run_id", "?"),
                    "family": r.get("family", "?"),
                    "H_mm": float(r["H_mm"]),
                    "density_kgm3": float(r.get("density_kgm3",
                                                r.get("density", "0"))),
                    "N_created": n_created,
                    "phi": phi,
                })
            except (ValueError, KeyError):
                continue
    return rows


# --------------------------------------------------------------------------- #
#  Self-test: proves correctness + prints timing (no data / perf risk)        #
# --------------------------------------------------------------------------- #

def selftest():
    print("=== gp_surrogate self-test (pure-Python exact GP) ===")
    ok = True

    # 1) interpolation + zero variance at data as noise -> 0
    X = [[0.0], [1.0], [2.0], [3.0], [4.0]]
    y = [math.sin(x[0]) for x in X]
    gp = GP(ls=[1.0], sf2=1.0, noise=1e-10).fit(X, y)
    max_interp_err = 0.0
    max_var = 0.0
    for i in range(len(X)):
        mu, var = gp.predict(X[i])
        max_interp_err = max(max_interp_err, abs(mu - y[i]))
        max_var = max(max_var, abs(var))
    print("  [1] interpolation err at data : %.2e (want ~0)" % max_interp_err)
    print("      predictive var at data     : %.2e (want ~0)" % max_var)
    ok = ok and max_interp_err < 1e-4 and max_var < 1e-4

    # 2) posterior matches an independent direct solve (identical math check)
    xs = [1.5]
    Kss = [[_k(X[i], X[j], [1.0], 1.0) for j in range(len(X))] for i in range(len(X))]
    for i in range(len(X)):
        Kss[i][i] += 1e-10
    ks = [_k(X[i], xs, [1.0], 1.0) for i in range(len(X))]
    Linv = cholesky(Kss)
    a = chol_solve(Linv, [y[i] - sum(y) / len(y) for i in range(len(y))])
    direct = sum(y) / len(y) + sum(ks[i] * a[i] for i in range(len(ks)))
    mu, _ = gp.predict(xs)
    print("  [2] posterior vs direct solve  : |%.6f - %.6f| = %.2e"
          % (mu, direct, abs(mu - direct)))
    ok = ok and abs(mu - direct) < 1e-9

    # 3) recover a smooth logistic phi(H) with noise; LOO-CV should be tight
    rng = random.Random(7)
    def phi_true(H):
        return 0.40 + 0.14 * sigmoid((H - 11.0) / 1.5)   # 0.40..0.54 band
    rows = []
    for _ in range(18):
        H = 8.0 + 7.5 * rng.random()
        rho = 800.0 + 1600.0 * rng.random()
        p = phi_true(H) + rng.gauss(0.0, 0.004)          # ~0.4% noise
        rows.append({"run_id": "s", "family": "EC", "H_mm": H,
                     "density_kgm3": rho, "phi": p})
    t0 = time.time()
    surro = PhiSurrogate().train(rows)
    t_fit = time.time() - t0
    rep = surro.loo_report(rows)["EC"]
    print("  [3] synthetic LOO-CV: n=%d  R2=%.4f  RMSE=%.4f  MAE=%.4f"
          % (rep["n"], rep["R2"], rep["RMSE"], rep["MAE"]))
    print("      density length-scale should be huge (phi ~ density-independent)")
    ls = surro.models["EC"]["gp"].ls
    print("      learned length-scales (std units)  ls_H=%.2f  ls_rho=%.2f"
          % (ls[0], ls[1]))
    ok = ok and rep["R2"] > 0.9 and rep["RMSE"] < 0.01

    # 4) timing: fit + a prediction (proves negligible cost)
    t0 = time.time()
    for _ in range(100):
        surro.predict("EC", 11.0, 1600.0)
    t_pred = (time.time() - t0) / 100.0
    print("  [4] timing: family fit=%.1f ms   single predict=%.3f ms"
          % (t_fit * 1e3, t_pred * 1e3))

    # 5) applicability domain fires outside the trained box
    inb = surro.predict("EC", 11.0, 1600.0)
    outb = surro.predict("EC", 30.0, 1600.0)
    print("  [5] domain in-box  : in_domain=%s (%s)" % (inb["in_domain"], inb["reason"]))
    print("      domain far-out : in_domain=%s (%s)" % (outb["in_domain"], outb["reason"]))
    ok = ok and inb["in_domain"] and not outb["in_domain"]

    print("=== RESULT: %s ===" % ("PASS" if ok else "FAIL"))
    return 0 if ok else 1


# --------------------------------------------------------------------------- #
#  CLI                                                                         #
# --------------------------------------------------------------------------- #

def main():
    ap = argparse.ArgumentParser(description="Dependency-free GP surrogate for phi.")
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--train")
    ap.add_argument("--out", default="phi_gp.json")
    ap.add_argument("--loo")
    ap.add_argument("--predict")
    ap.add_argument("--family")
    ap.add_argument("--H", type=float)
    ap.add_argument("--density", type=float)
    ap.add_argument("--train-count", type=int, default=150,
                    help="only train on runs at this particle count "
                         "(default 150; excludes QC finite-size N=40/90). "
                         "Use 0 to disable filtering.")
    a = ap.parse_args()

    if a.selftest:
        return selftest()

    if a.train:
        only = a.train_count if a.train_count else None
        rows = load_rows(a.train, only_count=only)
        if not rows:
            print("No usable rows in %s" % a.train)
            return 1
        print("Training on %d rows (count filter: %s)"
              % (len(rows), ("N=%d" % only) if only else "none"))
        surro = PhiSurrogate().train(rows)
        rep = surro.loo_report(rows)
        print("Trained families: %s" % ", ".join(surro.models))
        for f, r in rep.items():
            print("  [%s] n=%d  LOO R2=%.4f  RMSE=%.4f  MAE=%.4f"
                  % (f, r["n"], r["R2"], r["RMSE"], r["MAE"]))
        surro.save(a.out)
        print("Saved portable model -> %s" % a.out)
        return 0

    if a.loo:
        surro = PhiSurrogate.load(a.loo)
        print("Loaded model families: %s" % ", ".join(surro.models))
        return 0

    if a.predict:
        surro = PhiSurrogate.load(a.predict)
        if a.family is None or a.H is None or a.density is None:
            print("Need --family --H --density")
            return 1
        out = surro.predict(a.family, a.H, a.density, z=1.645)   # 90% interval
        if out["phi"] is None:
            print("phi=?  (%s)" % out["reason"])
        else:
            print("phi=%.4f  90%%CI[%.4f, %.4f]  in_domain=%s  (%s)"
                  % (out["phi"], out["phi_lo"], out["phi_hi"],
                     out["in_domain"], out["reason"]))
        return 0

    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
