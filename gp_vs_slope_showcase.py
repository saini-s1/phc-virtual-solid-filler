#!/usr/bin/env python3
"""
gp_vs_slope_showcase.py  --  One exec-facing graphic that answers
"why a Gaussian Process instead of a simple slope / linear fit?"

Story (text-minimal):
  Real DEM points sit inside a trained box.  A straight-line "slope" fit runs
  off confidently in both directions -- it invents a trend through what is
  mostly run-to-run noise and has NO idea where it stops being valid.  The GP
  hugs the same data, but its shaded uncertainty band stays tight inside the
  trained box and FANS OUT the moment you leave it -- so the model tells you
  when to stop trusting it.  That self-aware uncertainty is the unique thing a
  slope fit can never give you.

Uses the REAL trained surrogate (phi_gp.json) and REAL DEM rows
(surrogate_table.csv).  Output: graphics/gp_vs_slope_showcase.png
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Patch
from matplotlib.lines import Line2D

HERE = Path(__file__).resolve().parent
MODEL_DIR = HERE / "src" / "packaging" / "model"
sys.path.insert(0, str(MODEL_DIR))
import gp_surrogate as gpm  # noqa: E402

GRAPHICS = HERE / "graphics"
GRAPHICS.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# professional style
# ---------------------------------------------------------------------------
plt.rcParams.update({
    "font.family":      "DejaVu Sans",
    "font.size":        13,
    "axes.titlesize":   15,
    "axes.titleweight": "bold",
    "axes.labelsize":   13,
    "axes.labelweight": "bold",
    "xtick.labelsize":  11,
    "ytick.labelsize":  11,
    "legend.fontsize":  10,
    "axes.linewidth":   1.2,
})

PG_NAVY  = "#1e3a8a"
PG_BLUE  = "#2563eb"
PG_CYAN  = "#06b6d4"
PG_SLATE = "#475569"
PG_SLATE_LT = "#94a3b8"
PG_BG    = "#f8fafc"
GP_BLUE  = "#2563eb"
GP_FILL  = "#93c5fd"
SLOPE_RD = "#dc2626"
BOX_GRN  = "#16a34a"

FAM_LABEL = {"EC": "Emerald City gummy", "DoryNew": "Dory gummy"}


def _style(ax):
    ax.set_facecolor(PG_BG)
    for sp in ("top", "right"):
        ax.spines[sp].set_visible(False)
    for sp in ("left", "bottom"):
        ax.spines[sp].set_color(PG_SLATE_LT)
    ax.tick_params(colors=PG_SLATE, labelsize=11, width=1.2, length=5)
    ax.grid(True, color="#e2e8f0", linewidth=0.9, zorder=0)
    ax.set_axisbelow(True)
    ax.xaxis.label.set_color(PG_NAVY)
    ax.yaxis.label.set_color(PG_NAVY)


def ols_fit(x, y):
    """Plain least-squares slope + intercept (the 'simple' baseline)."""
    x = np.asarray(x); y = np.asarray(y)
    A = np.vstack([x, np.ones_like(x)]).T
    slope, intercept = np.linalg.lstsq(A, y, rcond=None)[0]
    return slope, intercept


def panel(ax, surrogate, rows, family):
    fam_rows = [r for r in rows if r["family"] == family]
    H   = np.array([r["H_mm"] for r in fam_rows])
    phi = np.array([r["phi"] for r in fam_rows])
    dens = float(np.mean([r["density_kgm3"] for r in fam_rows]))

    h_lo, h_hi = H.min(), H.max()
    span = h_hi - h_lo
    # sweep well beyond the trained box on both sides
    hs = np.linspace(h_lo - 0.9 * span, h_hi + 0.9 * span, 240)

    gp_mean, gp_lo, gp_hi = [], [], []
    for h in hs:
        p = surrogate.predict(family, float(h), dens, z=2.0)  # +/- 2 sigma
        gp_mean.append(p["phi"]); gp_lo.append(p["phi_lo"]); gp_hi.append(p["phi_hi"])
    gp_mean = np.array(gp_mean); gp_lo = np.array(gp_lo); gp_hi = np.array(gp_hi)

    # simple slope / linear fit through the SAME data
    slope, intercept = ols_fit(H, phi)
    lin = slope * hs + intercept

    # shaded trained box (where DEM data actually lives)
    ax.axvspan(h_lo, h_hi, color=BOX_GRN, alpha=0.07, zorder=1)
    ax.axvline(h_lo, color=BOX_GRN, lw=1.1, ls=(0, (4, 3)), alpha=0.55, zorder=2)
    ax.axvline(h_hi, color=BOX_GRN, lw=1.1, ls=(0, (4, 3)), alpha=0.55, zorder=2)

    # GP uncertainty band + mean
    ax.fill_between(hs, gp_lo, gp_hi, color=GP_FILL, alpha=0.55, zorder=3,
                    label="GP uncertainty (\u00b12\u03c3)")
    ax.plot(hs, gp_mean, color=GP_BLUE, lw=2.6, zorder=6,
            label="GP prediction", solid_capstyle="round")

    # simple slope fit
    ax.plot(hs, lin, color=SLOPE_RD, lw=2.2, ls=(0, (6, 3)), zorder=5,
            label="Simple slope fit")

    # DEM data
    ax.scatter(H, phi, s=52, color=PG_NAVY, edgecolors="white", linewidths=0.8,
               zorder=8, label="DEM runs")

    _style(ax)
    ax.set_title(FAM_LABEL[family], color=PG_NAVY, pad=10)
    ax.set_xlabel("Gummy height  H  (mm)")
    ax.set_ylabel("Packing fraction  \u03c6")

    # keep y focused on the physics, let the band show the fan-out
    ax.set_ylim(0.30, 0.72)

    # a subtle "trained box" tag inside the shaded region
    ax.text((h_lo + h_hi) / 2, 0.335, "DEM-trained box", color=BOX_GRN,
            fontsize=9, fontweight="bold", ha="center", va="center", zorder=9)


def main():
    surrogate = gpm.PhiSurrogate.load(str(MODEL_DIR / "phi_gp.json"))
    rows = gpm.load_rows(str(MODEL_DIR / "surrogate_table.csv"), only_count=150)

    fig, axes = plt.subplots(1, 2, figsize=(14, 6.8), facecolor=PG_BG)
    fig.subplots_adjust(left=0.07, right=0.985, top=0.80, bottom=0.20, wspace=0.18)

    panel(axes[0], surrogate, rows, "DoryNew")
    panel(axes[1], surrogate, rows, "EC")

    # headline
    fig.text(0.07, 0.93, "Why a Gaussian Process, not a Simple Slope",
             fontsize=20, fontweight="bold", color=PG_NAVY, ha="left")
    fig.text(0.07, 0.875,
             "The slope fit chases noise — it tilts DOWN for Dory yet UP for "
             "Emerald City. The GP holds the physically-stable φ with a "
             "calibrated band and flags anything outside the trained box.",
             fontsize=11.5, color=PG_SLATE, ha="left")

    # one shared legend
    handles = [
        Line2D([0], [0], marker="o", color="w", mfc=PG_NAVY, mec="white",
               ms=9, lw=0, label="DEM runs"),
        Line2D([0], [0], color=GP_BLUE, lw=2.6, label="GP prediction"),
        Patch(facecolor=GP_FILL, alpha=0.6, label="GP uncertainty (\u00b12\u03c3)"),
        Line2D([0], [0], color=SLOPE_RD, lw=2.2, ls=(0, (6, 3)),
               label="Simple slope fit"),
        Patch(facecolor=BOX_GRN, alpha=0.18, label="DEM-trained box"),
    ]
    fig.legend(handles=handles, loc="lower center", ncol=5, frameon=True,
               framealpha=0.94, edgecolor=PG_SLATE_LT,
               bbox_to_anchor=(0.53, 0.015))

    fig.text(0.985, 0.028, "DEM-validated surrogate model",
             fontsize=8, color=PG_SLATE_LT, ha="right")

    out = GRAPHICS / "gp_vs_slope_showcase.png"
    fig.savefig(out, dpi=160, bbox_inches="tight", facecolor=PG_BG)
    print("Written:", out)


if __name__ == "__main__":
    main()
