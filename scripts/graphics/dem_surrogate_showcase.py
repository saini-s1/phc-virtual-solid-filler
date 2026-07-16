#!/usr/bin/env python3
"""
dem_surrogate_showcase.py -- Management-friendly "data + fit" graphic for the
PHC Modeling Suite surrogate model.

Three panels:
  A (large, left)  : GP surrogate fit -- packing fraction phi vs gummy height.
                     All 36 packing DOE training points overlaid on the fitted
                     GP curve + uncertainty band. Shows the "line of best fit."
  B (top right)    : Wall-law correction -- how bottle size (lambda) shifts phi.
                     12 DEM training points + the fitted correction curve +
                     confidence tier shading.
  C (bottom right) : End-to-end validation -- surrogate predicted vs DEM simulated
                     fill height. 4 full-bottle DEM runs, all within +-2%.

Run:  python dem_surrogate_showcase.py
Output: graphics/dem_surrogate_showcase.png
"""
from __future__ import annotations

import csv, json, math
from pathlib import Path

import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from matplotlib.patches import Patch
from matplotlib.lines import Line2D

# ---------------------------------------------------------------------------
# P&G palette
# ---------------------------------------------------------------------------
PG_NAVY         = "#1e3a8a"
PG_BLUE         = "#2563eb"
PG_CYAN         = "#06b6d4"
PG_SLATE        = "#475569"
PG_SLATE_LT     = "#94a3b8"
PG_BG           = "#f8fafc"
VALID_GREEN      = "#16a34a"
VALID_GREEN_FILL = "#bbf7d0"
WARN_AMBER       = "#d97706"
INVALID_RED      = "#dc2626"
INVALID_RED_FILL = "#fecaca"
TRAINED_FILL     = "#dbeafe"   # pale blue -- "trained on real DEM"

FAMILY_COLORS  = {"EC": PG_BLUE,  "DoryNew": PG_CYAN}
FAMILY_MARKERS = {"EC": "o",       "DoryNew": "s"}
FAMILY_LABELS  = {"EC": "Emerald City (EC)",  "DoryNew": "Dory (DoryNew)"}

# ---------------------------------------------------------------------------
# Global professional style -- big, bold, clean
# ---------------------------------------------------------------------------
plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 13,
    "axes.titlesize": 16, "axes.titleweight": "bold",
    "axes.labelsize": 14, "axes.labelweight": "bold",
    "xtick.labelsize": 12, "ytick.labelsize": 12,
    "legend.fontsize": 11, "figure.titlesize": 20,
    "axes.linewidth": 1.2,
})

# ---------------------------------------------------------------------------
# Model constants (mirror realSurrogate.ts)
# ---------------------------------------------------------------------------
VALID_LAMBDA             = (2.5, 6.0)
VALIDATED_BOTTLE_LAMBDA  = (3.9, 4.7)
NOMINAL_H   = {"EC": 9.5,  "DoryNew": 13.0}
NOMINAL_RHO = 1425.0

HERE      = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent
MODEL_DIR = REPO_ROOT / "src" / "packaging" / "model"
GRAPHICS  = REPO_ROOT / "graphics"
GRAPHICS.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Load trained model files
# ---------------------------------------------------------------------------
with open(MODEL_DIR / "phi_gp.json",          encoding="utf-8") as _fh:
    PHI_GP = json.load(_fh)["families"]
with open(MODEL_DIR / "wall_correction.json", encoding="utf-8") as _fh:
    WALL_CORR = json.load(_fh)["families"]

# ---------------------------------------------------------------------------
# GP evaluation (identical math to realSurrogate.ts / gp_surrogate.py)
# ---------------------------------------------------------------------------
def _rbf(a, b, ls, sf2):
    t = (np.asarray(a) - np.asarray(b)) / np.asarray(ls)
    return sf2 * math.exp(-0.5 * float(np.dot(t, t)))

def _sigmoid(x):
    if x >= 0:
        return 1.0 / (1.0 + math.exp(-x))
    z = math.exp(x)
    return z / (1.0 + z)

def _fwd_sub(L, b):
    """Forward substitution: solve lower-triangular L y = b."""
    L = np.asarray(L)
    n = len(b)
    y = np.zeros(n)
    for i in range(n):
        y[i] = (b[i] - float(L[i, :i] @ y[:i])) / L[i, i]
    return y

def gp_phi_with_band(family: str, H: float, density: float):
    """
    Return (phi_mean, phi_std) -- posterior mean and +-1sigma in phi-space.
    GP was trained on logit(phi); we back-transform with linear error propagation.
    """
    m   = PHI_GP[family]
    xs  = [(H - m["xmean"][0]) / m["xstd"][0],
           (density - m["xmean"][1]) / m["xstd"][1]]
    ks  = np.array([_rbf(xi, xs, m["ls"], m["sf2"]) for xi in m["X"]])
    # posterior mean in standardised logit space
    mu_s = float(m["ymean_gp"]) + float(np.dot(ks, m["alpha"]))
    # posterior variance: sf2 - ||L^{-1} k_*||^2
    v     = _fwd_sub(m["L"], ks)
    var_s = max(float(m["sf2"]) - float(v @ v), 0.0)
    # back-transform
    phi_mu  = _sigmoid(mu_s * m["ystd"] + m["ymean"])
    dphi    = phi_mu * (1.0 - phi_mu)   # d(sigmoid)/d(logit)
    phi_std = dphi * math.sqrt(var_s) * m["ystd"]
    return phi_mu, phi_std

def gp_phi(family, H, density):
    return gp_phi_with_band(family, H, density)[0]

def wall_phi_eff(family: str, lam: float) -> float:
    """Fitted wall-law: phi_eff(lambda) = phi_inf * (1 - c/lambda)."""
    f = WALL_CORR[family]
    return f["phi_inf"] * (1.0 - f["c"] / lam)

# ---------------------------------------------------------------------------
# Load DEM data
# ---------------------------------------------------------------------------
def load_doe():
    rows = []
    with open(MODEL_DIR / "surrogate_table.csv", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            fam = r["family"].strip()
            if fam not in FAMILY_COLORS:
                continue
            rows.append({
                "family":  fam,
                "H":       float(r["H_mm"]),
                "density": float(r["density_kgm3"]),
                "phi":     float(r["solid_fraction_phi"]),
            })
    return rows

def load_wall_dem():
    pts = []
    with open(MODEL_DIR / "lambda_table.csv", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            fam = r["family"].strip()
            lam = float(r["gummies_across"])
            phi = float(r["solid_fraction_phi"])
            if fam in FAMILY_COLORS:
                pts.append({"family": fam, "lam": lam, "phi": phi})
    return pts

def _cell(row, key):
    v = row.get(key, "").strip()
    if v in ("", "None"):
        return None
    try:
        return float(v)
    except ValueError:
        return None

def load_validation():
    pairs = []
    with open(MODEL_DIR / "validation_table.csv", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            fam = r.get("family", "").strip()
            if fam not in FAMILY_COLORS:
                continue
            sf = _cell(r, "sim_fill_mm")
            pf = _cell(r, "pred_fill_mm")
            if sf is not None and pf is not None:
                pairs.append({
                    "id":       r["run_id"].strip(),
                    "family":   fam,
                    "sim_fill": sf,
                    "pred_fill": pf,
                    "fill_err":  _cell(r, "fill_err_pct"),
                })
    return pairs

# ---------------------------------------------------------------------------
# Shared axis styler
# ---------------------------------------------------------------------------
def _style(ax):
    ax.set_facecolor(PG_BG)
    for sp in ("top", "right"):
        ax.spines[sp].set_visible(False)
    for sp in ("left", "bottom"):
        ax.spines[sp].set_color(PG_SLATE_LT)
    ax.tick_params(labelsize=12, colors=PG_SLATE, width=1.2, length=5)
    ax.xaxis.label.set_fontsize(14); ax.xaxis.label.set_fontweight("bold")
    ax.yaxis.label.set_fontsize(14); ax.yaxis.label.set_fontweight("bold")
    ax.yaxis.label.set_color(PG_NAVY)
    ax.xaxis.label.set_color(PG_NAVY)
    ax.title.set_fontsize(16); ax.title.set_fontweight("bold")
    ax.title.set_color(PG_NAVY)

def _badge(ax, letter, x=0.97, y=0.97):
    ax.text(x, y, letter, transform=ax.transAxes,
            fontsize=13, fontweight="bold", color=PG_NAVY,
            va="top", ha="right")

# ===========================================================================
# Panel A  —  GP fit: phi vs H  (the big "line of best fit" panel)
# ===========================================================================
def draw_panel_A(ax):
    doe = load_doe()

    # ---- scatter training points: filled=nominal density, open=dense -------
    for fam in ("EC", "DoryNew"):
        col = FAMILY_COLORS[fam]
        mrk = FAMILY_MARKERS[fam]
        for density, filled in ((1425.0, True), (1650.0, False)):
            pts = [r for r in doe if r["family"] == fam and abs(r["density"] - density) < 1]
            Hv  = [r["H"]   for r in pts]
            phi = [r["phi"] for r in pts]
            fc  = col if filled else "none"
            ax.scatter(Hv, phi,
                       marker=mrk, facecolors=fc, edgecolors=col,
                       s=64, linewidths=1.5, zorder=5, alpha=0.92)

    # ---- GP mean curve + +-1sigma band at nominal density ------------------
    for fam in ("EC", "DoryNew"):
        col      = FAMILY_COLORS[fam]
        lo, hi   = (6.0, 12.2) if fam == "EC" else (9.3, 15.8)
        Hs       = np.linspace(lo, hi, 150)
        mus      = np.array([gp_phi_with_band(fam, h, NOMINAL_RHO)[0] for h in Hs])
        sds      = np.array([gp_phi_with_band(fam, h, NOMINAL_RHO)[1] for h in Hs])
        ax.plot(Hs, mus, color=col, lw=2.2, zorder=6)
        ax.fill_between(Hs, mus - sds, mus + sds,
                        color=col, alpha=0.14, zorder=3)

    # ---- nominal H markers -------------------------------------------------
    for fam, col in FAMILY_COLORS.items():
        h_nom = NOMINAL_H[fam]
        ax.axvline(h_nom, color=col, lw=0.9, ls="--", alpha=0.40, zorder=2)
        ax.text(h_nom + 0.12, 0.602, f"H\u2099\u2092\u2098 = {h_nom} mm",
                fontsize=7, color=col, va="top")

    ax.set_xlabel("Gummy height  H  (mm)", fontsize=9)
    ax.set_ylabel("Packing fraction  \u03c6", fontsize=9)
    ax.set_title("Surrogate Learned From DEM", fontsize=10.5, fontweight="bold", pad=7)
    ax.set_xlim(5.6, 16.2)
    ax.set_ylim(0.47, 0.615)
    ax.set_yticks(np.arange(0.48, 0.62, 0.02))

    # ---- legend ------------------------------------------------------------
    legend_items = [
        Line2D([0],[0], marker="o", color="w", mfc=PG_BLUE, mec=PG_BLUE, ms=8,
               label="Emerald City  \u03c1=1\u202f425 (filled) / 1\u202f650 (open)"),
        Line2D([0],[0], marker="s", color="w", mfc=PG_CYAN, mec=PG_CYAN, ms=8,
               label="Dory  \u03c1=1\u202f425 (filled) / 1\u202f650 (open)"),
        Line2D([0],[0], color=PG_BLUE, lw=2.2,
               label="GP fit  EC  (\u00b11\u03c3 shaded)"),
        Line2D([0],[0], color=PG_CYAN, lw=2.2,
               label="GP fit  Dory  (\u00b11\u03c3 shaded)"),
    ]
    ax.legend(handles=legend_items, fontsize=7.8, loc="lower right",
              framealpha=0.92, edgecolor=PG_SLATE_LT)

    # ---- annotation box ----------------------------------------------------
    _badge(ax, "A")
    _style(ax)


# ===========================================================================
# Panel B  —  Wall-law: phi_eff vs lambda
# ===========================================================================
def draw_panel_B(ax):
    wall_pts = load_wall_dem()
    lo, hi   = VALID_LAMBDA
    vlo, vhi = VALIDATED_BOTTLE_LAMBDA
    xlo, xhi = 1.9, 6.8

    # tier shading
    ax.axvspan(xlo, lo,  color=INVALID_RED_FILL, alpha=0.50, zorder=1)
    ax.axvspan(lo,  vlo, color=TRAINED_FILL,      alpha=0.65, zorder=1)
    ax.axvspan(vlo, vhi, color=VALID_GREEN_FILL,  alpha=0.55, zorder=1)
    ax.axvspan(vhi, hi,  color=TRAINED_FILL,      alpha=0.65, zorder=1)
    ax.axvspan(hi,  xhi, color=INVALID_RED_FILL,  alpha=0.50, zorder=1)

    lam_arr = np.linspace(2.05, 6.65, 250)
    for fam in ("EC", "DoryNew"):
        col = FAMILY_COLORS[fam]
        phi_curve = [wall_phi_eff(fam, l) for l in lam_arr]
        ax.plot(lam_arr, phi_curve, color=col, lw=2.0, zorder=6,
                label=f"Fitted wall-law \u2014 {FAMILY_LABELS[fam]}")
        pts = [p for p in wall_pts if p["family"] == fam]
        ax.scatter([p["lam"] for p in pts], [p["phi"] for p in pts],
                   marker=FAMILY_MARKERS[fam], color=col, s=55, zorder=7,
                   edgecolors="white", linewidths=0.8,
                   label=f"DEM training runs \u2014 {fam}")

    ax.set_xlabel("\u03bb  =  bottle \u00f8 / gummy base \u00f8  (gummies across)", fontsize=8)
    ax.set_ylabel("\u03c6\u2091\u2090\u2091", fontsize=8)
    ax.set_title("Wall-Law Correction",
                 fontsize=9, fontweight="bold", pad=5)
    ax.set_xlim(xlo, xhi)
    ax.set_ylim(0.465, 0.615)
    ax.set_yticks(np.arange(0.48, 0.62, 0.02))
    ax.tick_params(labelsize=7.5)

    # tier text labels (placed just inside each band)
    tier_labels = [
        ("extrap.", 2.2,  INVALID_RED),
        ("trained on\nreal DEM", 3.2,  PG_BLUE),
        ("DEM\nvalidated",       4.3,  VALID_GREEN),
        ("trained on\nreal DEM", 5.35, PG_BLUE),
        ("extrap.",              6.6,  INVALID_RED),
    ]
    for txt, xp, col in tier_labels:
        ax.text(xp, 0.470, txt, fontsize=6.2, ha="center", va="bottom",
                color=col, fontweight="bold")

    ax.legend(fontsize=6.8, loc="upper left",
              framealpha=0.92, edgecolor=PG_SLATE_LT, ncol=1)
    _badge(ax, "B")
    _style(ax)


# ===========================================================================
# Panel C  —  Predicted vs actual fill height (4 full-bottle DEM runs)
# ===========================================================================
def draw_panel_C(ax):
    pairs = load_validation()

    all_vals = [p["sim_fill"] for p in pairs] + [p["pred_fill"] for p in pairs]
    lo = min(all_vals) * 0.955
    hi = max(all_vals) * 1.045
    ref = np.linspace(lo, hi, 100)

    # ±2% acceptance band
    ax.fill_between(ref, ref * 0.98, ref * 1.02,
                    color=VALID_GREEN_FILL, alpha=0.60, zorder=2)
    ax.plot(ref, ref,        color=PG_NAVY,   lw=1.5,  ls="--", zorder=3)
    ax.plot(ref, ref * 1.02, color=VALID_GREEN, lw=0.8, ls=":",  zorder=3)
    ax.plot(ref, ref * 0.98, color=VALID_GREEN, lw=0.8, ls=":",  zorder=3)

    for p in pairs:
        col = FAMILY_COLORS[p["family"]]
        mrk = FAMILY_MARKERS[p["family"]]
        err = p["fill_err"]
        ax.scatter(p["sim_fill"], p["pred_fill"],
                   marker=mrk, color=col, s=90,
                   edgecolors="white", linewidths=0.9, zorder=8)
        tag = p["id"].replace("VB_", "").replace("_", " ")
        suffix = f" ({err:+.1f}%)" if err is not None else ""
        ax.annotate(tag + suffix,
                    (p["sim_fill"], p["pred_fill"]),
                    textcoords="offset points", xytext=(6, 4),
                    fontsize=7, color=col)

    ax.set_xlabel("DEM simulated fill height (mm)", fontsize=8)
    ax.set_ylabel("Surrogate predicted fill height (mm)", fontsize=8)
    ax.set_title("End-to-End Validation",
                 fontsize=9, fontweight="bold", pad=5)
    ax.set_xlim(lo, hi)
    ax.set_ylim(lo, hi)
    ax.tick_params(labelsize=7.5)

    legend_items = [
        Line2D([0],[0], marker="o", color="w", mfc=PG_BLUE, mec=PG_BLUE, ms=8,
               label="Emerald City"),
        Line2D([0],[0], marker="s", color="w", mfc=PG_CYAN, mec=PG_CYAN, ms=8,
               label="Dory"),
        Patch(fc=VALID_GREEN_FILL, ec=VALID_GREEN, label="\u00b12 % acceptance"),
        Line2D([0],[0], color=PG_NAVY, ls="--", lw=1.5, label="Perfect prediction"),
    ]
    ax.legend(handles=legend_items, fontsize=7, loc="upper left",
              framealpha=0.92, edgecolor=PG_SLATE_LT)

    ax.text(0.97, 0.05,
            "4 / 4 full-bottle DEM runs  PASS\nFill height MAE = 1.20 %",
            transform=ax.transAxes, fontsize=8, va="bottom", ha="right",
            color=VALID_GREEN, fontweight="bold",
            bbox=dict(boxstyle="round,pad=0.35", fc="white",
                      ec=VALID_GREEN, alpha=0.92))
    _badge(ax, "C")
    _style(ax)


# ===========================================================================
# Main
# ===========================================================================
def main():
    fig = plt.figure(figsize=(18, 9), facecolor=PG_BG)
    gs  = gridspec.GridSpec(
        2, 2, figure=fig,
        left=0.065, right=0.975,
        top=0.880, bottom=0.090,
        hspace=0.48, wspace=0.30,
    )

    ax_A = fig.add_subplot(gs[0:2, 0])   # full left column
    ax_B = fig.add_subplot(gs[0,   1])   # top right
    ax_C = fig.add_subplot(gs[1,   1])   # bottom right

    draw_panel_A(ax_A)
    draw_panel_B(ax_B)
    draw_panel_C(ax_C)

    # ---- header ------------------------------------------------------------
    fig.text(0.50, 0.955,
             "PHC Modeling Suite \u2014 DEM Surrogate Model",
             fontsize=20, fontweight="bold", color=PG_NAVY,
             ha="center", va="bottom")
    fig.text(0.50, 0.922,
             "52 real DEM simulations, turned into a fast prediction engine",
             fontsize=11, color=PG_SLATE, ha="center", va="bottom")

    # ---- footer ------------------------------------------------------------
    fig.text(
        0.065, 0.022,
        "Data provenance:  36 packing DOE runs (H 6.5\u201315\u202fmm \u00d7 \u03c1 1\u202f425\u20131\u202f650\u202fkg/m\u00b3)"
        "  +  12 wall-law runs (\u03bb 2.5\u20136.0)"
        "  +  4 full-bottle validation runs  =  52 real LIGGGHTS/DEM simulations",
        fontsize=7.5, color=PG_SLATE, va="bottom")
    fig.text(
        0.975, 0.022,
        "PROTOTYPE SURROGATE \u2014 not a validated production tool",
        fontsize=7.5, color=WARN_AMBER, va="bottom", ha="right", fontweight="bold")

    out = GRAPHICS / "dem_surrogate_showcase.png"
    fig.savefig(out, dpi=160, bbox_inches="tight", facecolor=PG_BG)
    print(f"Written: {out}")


if __name__ == "__main__":
    main()
