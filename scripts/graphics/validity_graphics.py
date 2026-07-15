#!/usr/bin/env python3
"""
validity_graphics.py -- P&G-themed graphics showing WHERE the DEM-trained
gummy packing surrogate stops being valid.

This does NOT retrain anything. It loads the exact fitted coefficients that the
production model uses in the browser (src/packaging/model/phi_gp.json and
wall_gp.json) and re-runs the same Gaussian-Process evaluation path to draw:

    1. wall_law_validity.png  -- phi_eff(lambda) wall law per family, with the
       validated lambda band and the red EXTRAPOLATION zones.
    2. gp_domain_validity.png -- phi vs gummy height per family with the trained
       GP box (green) and the red extrapolation region + 90% CI band.
    3. validity_map.png       -- 2D go/no-go map over (height, lambda): green =
       DEM-validated, amber = usable-but-unvalidated, red = do NOT trust.

Run:  python scripts/graphics/validity_graphics.py (from the repo root)
Outputs the three PNGs into graphics/ at the repo root so they are easy to find.

NOTE: prototype surrogate visualization -- illustrative of model boundaries,
not a validated engineering deliverable.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Patch
from matplotlib.lines import Line2D

# ---------------------------------------------------------------------------
# P&G-inspired palette (matches the dashboard theme)
# ---------------------------------------------------------------------------
PG_NAVY = "#1e3a8a"
PG_BLUE = "#2563eb"
PG_CYAN = "#06b6d4"
PG_SKY = "#0ea5e9"
PG_SLATE = "#475569"
PG_SLATE_LT = "#94a3b8"
PG_BG = "#f8fafc"
PG_SURFACE = "#f1f5f9"
VALID_GREEN = "#16a34a"
VALID_GREEN_FILL = "#bbf7d0"
WARN_AMBER = "#d97706"
WARN_AMBER_FILL = "#fde68a"
INVALID_RED = "#dc2626"
INVALID_RED_FILL = "#fecaca"

FAMILY_COLORS = {"EC": PG_BLUE, "DoryNew": PG_CYAN}

# ---------------------------------------------------------------------------
# Model constants (mirror src/packaging/model/realSurrogate.ts)
# ---------------------------------------------------------------------------
VALID_LAMBDA = (2.5, 6.0)            # wall-law validated range
VALIDATED_BOTTLE_LAMBDA = (3.9, 4.7)  # tighter full-bottle DEM band
FAMILY_H_RANGE = {"EC": (6.5, 11.5), "DoryNew": (10.0, 15.0)}
NOMINAL_H = {"EC": 9.5, "DoryNew": 13.0}
NOMINAL_RHO = 1425.0
MOLD_A = 0.391
MOLD_B = 14.3533

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent
MODEL_DIR = REPO_ROOT / "src" / "packaging" / "model"
GRAPHICS = REPO_ROOT / "graphics"
GRAPHICS.mkdir(exist_ok=True)

with open(MODEL_DIR / "phi_gp.json", "r", encoding="utf-8") as fh:
    PHI_GP = json.load(fh)["families"]
with open(MODEL_DIR / "wall_gp.json", "r", encoding="utf-8") as fh:
    WALL_GP = json.load(fh)["families"]


# ---------------------------------------------------------------------------
# GP evaluation (identical math to realSurrogate.ts / gp_surrogate.py)
# ---------------------------------------------------------------------------
def _rbf(a, b, ls, sf2):
    t = (np.asarray(a) - np.asarray(b)) / np.asarray(ls)
    return sf2 * math.exp(-0.5 * float(np.dot(t, t)))


def _solve_lower(L, b):
    L = np.asarray(L)
    n = len(b)
    y = np.zeros(n)
    for i in range(n):
        y[i] = (b[i] - float(L[i, :i] @ y[:i])) / L[i, i]
    return y


def _sigmoid(x):
    if x >= 0:
        return 1.0 / (1.0 + math.exp(-x))
    z = math.exp(x)
    return z / (1.0 + z)


def base_diameter_mm(H):
    return MOLD_A * H + MOLD_B


def gp_phi_h_rho(family, H, density, z=1.645):
    """Returns (phi, phi_lo, phi_hi, in_domain)."""
    m = PHI_GP[family]
    xs = [(H - m["xmean"][0]) / m["xstd"][0],
          (density - m["xmean"][1]) / m["xstd"][1]]
    ks = [_rbf(xi, xs, m["ls"], m["sf2"]) for xi in m["X"]]
    mean_s = m["ymean_gp"] + float(np.dot(ks, m["alpha"]))
    v = _solve_lower(m["L"], ks)
    var_s = max(m["sf2"] + m["noise"] - float(np.dot(v, v)), 0.0)
    mean = mean_s * m["ystd"] + m["ymean"]
    std = math.sqrt(var_s) * m["ystd"]
    phi = _sigmoid(mean)
    phi_lo = _sigmoid(mean - z * std)
    phi_hi = _sigmoid(mean + z * std)

    in_domain = True
    for name, val in (("H_mm", H), ("density_kgm3", density)):
        lo, hi = m["box"][name]
        span = (hi - lo) if hi > lo else 1.0
        if val < lo - 0.05 * span or val > hi + 0.05 * span:
            in_domain = False
    if std > 2.5 * m["noise_std_logit"]:
        in_domain = False
    return phi, phi_lo, phi_hi, in_domain


def wall_phi_eff(family, lam, z=1.645):
    """Returns (phi, phi_lo, phi_hi)."""
    f = WALL_GP[family]
    mean_law = f["phi_inf"] * (1.0 - f["c"] / lam)
    gp = f.get("gp")
    if not gp:
        return mean_law, mean_law, mean_law
    xs = [(1.0 / lam - gp["xmean"]) / gp["xstd"]]
    ks = [_rbf(xi, xs, gp["ls"], gp["sf2"]) for xi in gp["X"]]
    r_s = float(np.dot(ks, gp["alpha"]))
    v = _solve_lower(gp["L"], ks)
    var_s = max(gp["sf2"] + gp["noise"] - float(np.dot(v, v)), 0.0)
    r = r_s * gp["ystd"]
    std = math.sqrt(var_s) * gp["ystd"]
    phi = mean_law + r
    return phi, phi - z * std, phi + z * std


def evaluate_phi(family, H, density, lam):
    """phi_used = phi_eff(lambda) * [GP(H,rho) / GP(H_nom, rho_nom)]."""
    wall, wall_lo, wall_hi = wall_phi_eff(family, lam)
    gp, _, _, gp_in = gp_phi_h_rho(family, H, density)
    gp_nom, _, _, _ = gp_phi_h_rho(family, NOMINAL_H[family], NOMINAL_RHO)
    ratio = gp / gp_nom if gp_nom > 0 else 1.0
    lam_ok = VALID_LAMBDA[0] <= lam <= VALID_LAMBDA[1]
    return wall * ratio, wall_lo * ratio, wall_hi * ratio, (gp_in and lam_ok), gp_in, lam_ok


# ---------------------------------------------------------------------------
# Shared styling helpers
# ---------------------------------------------------------------------------
def _style_axes(ax):
    ax.set_facecolor(PG_BG)
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    for spine in ("left", "bottom"):
        ax.spines[spine].set_color(PG_SLATE_LT)
    ax.tick_params(colors=PG_SLATE, labelsize=9)
    ax.grid(True, color="#e2e8f0", linewidth=0.8, zorder=0)
    ax.set_axisbelow(True)


def _footer(fig):
    fig.text(0.5, 0.012,
             "PHC Virtual Solid Filler  \u00b7  prototype DEM surrogate  \u00b7  "
             "boundaries drawn from the fitted phi_gp / wall_gp coefficients",
             ha="center", fontsize=8, color=PG_SLATE_LT, style="italic")


# ---------------------------------------------------------------------------
# FIGURE 1 -- wall law phi_eff(lambda) validity
# ---------------------------------------------------------------------------
def fig_wall_law():
    fig, ax = plt.subplots(figsize=(10, 6), dpi=130)
    fig.patch.set_facecolor("white")
    _style_axes(ax)

    lam = np.linspace(1.2, 8.0, 400)
    for fam, color in FAMILY_COLORS.items():
        phi = np.array([wall_phi_eff(fam, L)[0] for L in lam])
        lo = np.array([wall_phi_eff(fam, L)[1] for L in lam])
        hi = np.array([wall_phi_eff(fam, L)[2] for L in lam])
        ax.fill_between(lam, lo, hi, color=color, alpha=0.12, zorder=2)
        ax.plot(lam, phi, color=color, lw=2.6, zorder=4,
                label=f"{fam} wall law  \u03c6_eff(\u03bb)")

    # extrapolation zones (outside VALID_LAMBDA)
    ax.axvspan(1.2, VALID_LAMBDA[0], color=INVALID_RED_FILL, alpha=0.55,
               zorder=1, hatch="//", edgecolor=INVALID_RED, linewidth=0.0)
    ax.axvspan(VALID_LAMBDA[1], 8.0, color=INVALID_RED_FILL, alpha=0.55,
               zorder=1, hatch="//", edgecolor=INVALID_RED, linewidth=0.0)
    # validated full-bottle band
    ax.axvspan(*VALIDATED_BOTTLE_LAMBDA, color=VALID_GREEN_FILL, alpha=0.55,
               zorder=1)

    for x in VALID_LAMBDA:
        ax.axvline(x, color=INVALID_RED, ls="--", lw=1.4, zorder=3)
    ax.text((VALID_LAMBDA[0] + VALIDATED_BOTTLE_LAMBDA[0]) / 2, ax.get_ylim()[1],
            "", ha="center")

    y_top = 0.62
    ax.set_ylim(0.30, y_top)
    ax.set_xlim(1.2, 8.0)
    ax.text(np.mean(VALIDATED_BOTTLE_LAMBDA), 0.60, "DEM-validated\nfull bottle",
            ha="center", va="top", fontsize=9, color=VALID_GREEN, fontweight="bold")
    ax.text(1.85, 0.60, "EXTRAPOLATION\n\u03bb too small", ha="center", va="top",
            fontsize=9, color=INVALID_RED, fontweight="bold")
    ax.text(7.0, 0.60, "EXTRAPOLATION\n\u03bb too large", ha="center", va="top",
            fontsize=9, color=INVALID_RED, fontweight="bold")

    ax.set_xlabel("\u03bb  =  bottle-body diameter / gummy base diameter  (gummies across)",
                  fontsize=10.5, color=PG_NAVY)
    ax.set_ylabel("packing fraction  \u03c6", fontsize=10.5, color=PG_NAVY)
    ax.set_title("Where the wall law is valid  \u2014  finite-size packing vs \u03bb",
                 fontsize=14, color=PG_NAVY, fontweight="bold", pad=14)

    handles = [
        Line2D([0], [0], color=PG_BLUE, lw=2.6, label="EC wall law"),
        Line2D([0], [0], color=PG_CYAN, lw=2.6, label="DoryNew wall law"),
        Patch(facecolor=VALID_GREEN_FILL, label="DEM-validated \u03bb band"),
        Patch(facecolor=INVALID_RED_FILL, hatch="//", label="extrapolation (do not trust)"),
    ]
    ax.legend(handles=handles, loc="lower right", frameon=True, fontsize=9,
              facecolor="white", edgecolor=PG_SLATE_LT)

    _footer(fig)
    fig.tight_layout(rect=(0, 0.03, 1, 1))
    out = GRAPHICS / "wall_law_validity.png"
    fig.savefig(out, facecolor="white")
    plt.close(fig)
    return out


# ---------------------------------------------------------------------------
# FIGURE 2 -- GP(H) domain validity per family
# ---------------------------------------------------------------------------
def fig_gp_domain():
    fig, axes = plt.subplots(1, 2, figsize=(12, 5.6), dpi=130)
    fig.patch.set_facecolor("white")

    for ax, fam in zip(axes, ("EC", "DoryNew")):
        _style_axes(ax)
        color = FAMILY_COLORS[fam]
        lo_h, hi_h = FAMILY_H_RANGE[fam]
        H = np.linspace(lo_h - 3.5, hi_h + 3.5, 300)

        phi, plo, phi_lo, phi_hi = [], [], [], []
        for h in H:
            p, l, hgh, _ = gp_phi_h_rho(fam, h, NOMINAL_RHO)
            phi.append(p)
            phi_lo.append(l)
            phi_hi.append(hgh)
        phi = np.array(phi)
        phi_lo = np.array(phi_lo)
        phi_hi = np.array(phi_hi)

        ax.fill_between(H, phi_lo, phi_hi, color=color, alpha=0.14, zorder=2,
                        label="90% credible interval")
        ax.plot(H, phi, color=color, lw=2.6, zorder=4, label="GP mean \u03c6(H)")

        # extrapolation shading outside trained H box
        ax.axvspan(H.min(), lo_h, color=INVALID_RED_FILL, alpha=0.5, zorder=1,
                   hatch="//")
        ax.axvspan(hi_h, H.max(), color=INVALID_RED_FILL, alpha=0.5, zorder=1,
                   hatch="//")
        ax.axvspan(lo_h, hi_h, color=VALID_GREEN_FILL, alpha=0.45, zorder=1)
        ax.axvline(NOMINAL_H[fam], color=PG_NAVY, ls=":", lw=1.6, zorder=3)

        y0, y1 = ax.get_ylim()
        ax.text(NOMINAL_H[fam], y1, " nominal", ha="left", va="top",
                fontsize=8.5, color=PG_NAVY)
        ax.text((lo_h + hi_h) / 2, y0, "trained / valid", ha="center",
                va="bottom", fontsize=9, color=VALID_GREEN, fontweight="bold")

        ax.set_xlabel("gummy height H  (mm)", fontsize=10.5, color=PG_NAVY)
        if fam == "EC":
            ax.set_ylabel("packing fraction  \u03c6", fontsize=10.5, color=PG_NAVY)
        ax.set_title(f"{fam} mold  \u2014  GP trained on H \u2208 [{lo_h}, {hi_h}] mm",
                     fontsize=12, color=PG_NAVY, fontweight="bold", pad=10)
        ax.legend(loc="best", frameon=True, fontsize=8.5, facecolor="white",
                  edgecolor=PG_SLATE_LT)

    fig.suptitle("Where the gummy-height GP is valid  (\u03c1 = nominal 1425 kg/m\u00b3)",
                 fontsize=14, color=PG_NAVY, fontweight="bold")
    _footer(fig)
    fig.tight_layout(rect=(0, 0.04, 1, 0.95))
    out = GRAPHICS / "gp_domain_validity.png"
    fig.savefig(out, facecolor="white")
    plt.close(fig)
    return out


# ---------------------------------------------------------------------------
# FIGURE 3 -- 2D go / no-go validity map over (H, lambda)
# ---------------------------------------------------------------------------
def fig_validity_map():
    from matplotlib.colors import ListedColormap, BoundaryNorm

    fig, axes = plt.subplots(1, 2, figsize=(12.5, 5.8), dpi=130)
    fig.patch.set_facecolor("white")

    cmap = ListedColormap([INVALID_RED_FILL, WARN_AMBER_FILL, VALID_GREEN_FILL])
    norm = BoundaryNorm([-0.5, 0.5, 1.5, 2.5], cmap.N)

    for ax, fam in zip(axes, ("EC", "DoryNew")):
        _style_axes(ax)
        lo_h, hi_h = FAMILY_H_RANGE[fam]
        H = np.linspace(lo_h - 3.5, hi_h + 3.5, 160)
        lam = np.linspace(1.5, 7.5, 160)
        HH, LL = np.meshgrid(H, lam)
        grid = np.zeros_like(HH)

        for i in range(HH.shape[0]):
            for j in range(HH.shape[1]):
                _, _, _, ok, gp_in, lam_ok = evaluate_phi(
                    fam, HH[i, j], NOMINAL_RHO, LL[i, j])
                if not (gp_in and lam_ok):
                    grid[i, j] = 0            # invalid
                elif VALIDATED_BOTTLE_LAMBDA[0] <= LL[i, j] <= VALIDATED_BOTTLE_LAMBDA[1] \
                        and lo_h <= HH[i, j] <= hi_h:
                    grid[i, j] = 2            # fully DEM-validated
                else:
                    grid[i, j] = 1            # usable but unvalidated

        ax.pcolormesh(H, lam, grid, cmap=cmap, norm=norm, shading="auto",
                      zorder=1)
        # boundary lines
        ax.axhline(VALID_LAMBDA[0], color=INVALID_RED, ls="--", lw=1.2)
        ax.axhline(VALID_LAMBDA[1], color=INVALID_RED, ls="--", lw=1.2)
        ax.axvline(lo_h, color=INVALID_RED, ls="--", lw=1.2)
        ax.axvline(hi_h, color=INVALID_RED, ls="--", lw=1.2)
        # nominal operating point
        ax.plot(NOMINAL_H[fam], np.mean(VALIDATED_BOTTLE_LAMBDA), "*",
                color=PG_NAVY, markersize=16, zorder=5,
                markeredgecolor="white", markeredgewidth=1.0)

        ax.set_xlabel("gummy height H  (mm)", fontsize=10.5, color=PG_NAVY)
        if fam == "EC":
            ax.set_ylabel("\u03bb  (gummies across)", fontsize=10.5, color=PG_NAVY)
        ax.set_title(f"{fam} mold", fontsize=12, color=PG_NAVY,
                     fontweight="bold", pad=10)

    fig.suptitle("Model go / no-go map  \u2014  where the surrogate stops being valid",
                 fontsize=14, color=PG_NAVY, fontweight="bold")
    handles = [
        Patch(facecolor=VALID_GREEN_FILL, edgecolor=VALID_GREEN,
              label="DEM-validated (trust)"),
        Patch(facecolor=WARN_AMBER_FILL, edgecolor=WARN_AMBER,
              label="in-domain, not DEM-validated (use with caution)"),
        Patch(facecolor=INVALID_RED_FILL, edgecolor=INVALID_RED,
              label="extrapolation \u2014 NOT valid"),
        Line2D([0], [0], marker="*", color="none", markerfacecolor=PG_NAVY,
               markeredgecolor="white", markersize=13, label="nominal operating point"),
    ]
    fig.legend(handles=handles, loc="lower center", ncol=4, frameon=True,
               fontsize=8.6, facecolor="white", edgecolor=PG_SLATE_LT,
               bbox_to_anchor=(0.5, 0.0))
    fig.tight_layout(rect=(0, 0.10, 1, 0.94))
    out = GRAPHICS / "validity_map.png"
    fig.savefig(out, facecolor="white")
    plt.close(fig)
    return out


def main():
    outs = [fig_wall_law(), fig_gp_domain(), fig_validity_map()]
    print("Saved:")
    for o in outs:
        print("  " + str(o))


if __name__ == "__main__":
    main()
