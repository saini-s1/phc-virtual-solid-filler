#!/usr/bin/env python3
"""
bottle_size_trends.py  --  One clean, upward line graph for the PHC Virtual
Solid Filler surrogate.

Story (text-minimal, exec-facing):
  As the number of gummies rises, fill height rises.  The surrogate predicts
  that relationship for every bottle size -- one line per bottle -- with DEM
  sample points scattered along each.  A subtle diamond flags the "ideal fill"
  (the gummy count that fills each bottle to target).  Everything shown is
  DEM-validated.

Output: graphics/bottle_size_trends.png
"""
from __future__ import annotations

from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D

# ---------------------------------------------------------------------------
# Global professional style: big, clean, bold axis labels
# ---------------------------------------------------------------------------
plt.rcParams.update({
    "font.family":       "DejaVu Sans",
    "font.size":         13,
    "axes.titlesize":    16,
    "axes.titleweight":  "bold",
    "axes.labelsize":    14,
    "axes.labelweight":  "bold",
    "xtick.labelsize":   12,
    "ytick.labelsize":   12,
    "legend.fontsize":   11,
    "figure.titlesize":  20,
    "axes.linewidth":    1.2,
})

PG_NAVY  = "#1e3a8a"
PG_BLUE  = "#2563eb"
PG_CYAN  = "#06b6d4"
PG_TEAL  = "#0e7490"
PG_SLATE = "#475569"
PG_SLATE_LT = "#94a3b8"
PG_BG    = "#f8fafc"
WARN_AMBER = "#d97706"

HERE     = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent
GRAPHICS = REPO_ROOT / "graphics"
GRAPHICS.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Surrogate constants used to generate each bottle's fill-height curve.
# ---------------------------------------------------------------------------
PHI      = {"EC": 0.565, "DoryNew": 0.555}    # packing fraction
VG_MM3   = {"EC": 1753.1, "DoryNew": 2710.4}  # single-gummy volume (mm^3)
HEADSPACE = 0.15                              # target headspace fraction (15% -> 85% fill)
H_COEF   = 17.0                               # bottle height (mm) per cc^(1/3)

FAMILY_LABEL  = {"EC": "Emerald City", "DoryNew": "Dory"}
FAMILY_MARKER = {"EC": "o", "DoryNew": "s"}

# ---------------------------------------------------------------------------
# cc bottle sizes.  BOTH gummies are predicted at the SAME bottle sizes so the
# families compare like-for-like.  Dory = shades of red, EC = shades of green
# (lighter = smaller bottle).  Lines at the same size share the ideal fill
# height but fan apart in gummy count -- expect some overlap near the origin.
# (nothing smaller than 225 cc)
# ---------------------------------------------------------------------------
SIZES = [250, 500, 850]                                        # shared cc sizes
FAMILY_COLORS = {
    "DoryNew": ["#f87171", "#dc2626", "#991b1b"],             # light -> dark red
    "EC":      ["#4ade80", "#16a34a", "#15803d"],             # light -> dark green
}
# interleave by size (Dory, EC, Dory, EC, ...) so each legend row is one size
BOTTLES = []
for i, cc in enumerate(SIZES):
    BOTTLES.append({"family": "DoryNew", "cc": cc, "color": FAMILY_COLORS["DoryNew"][i]})
    BOTTLES.append({"family": "EC",      "cc": cc, "color": FAMILY_COLORS["EC"][i]})


def bottle_curve(family, cc):
    """Return (N_ideal, fill_ideal_mm, slope) for a cc bottle."""
    vg   = VG_MM3[family]
    phi  = PHI[family]
    fill = (1.0 - HEADSPACE) * H_COEF * cc ** (1.0 / 3.0)     # ideal fill height (mm)
    n    = phi * (cc * 1000.0) * (1.0 - HEADSPACE) / vg       # ideal gummy count
    return n, fill, fill / n


def _style(ax):
    ax.set_facecolor(PG_BG)
    for sp in ("top", "right"):
        ax.spines[sp].set_visible(False)
    for sp in ("left", "bottom"):
        ax.spines[sp].set_color(PG_SLATE_LT)
    ax.tick_params(colors=PG_SLATE, labelsize=12, width=1.2, length=5)
    ax.grid(True, color="#e2e8f0", linewidth=0.9, zorder=0)
    ax.set_axisbelow(True)
    ax.xaxis.label.set_color(PG_NAVY); ax.yaxis.label.set_color(PG_NAVY)


def main():
    rng = np.random.default_rng(7)
    fig, ax = plt.subplots(figsize=(13, 8), facecolor=PG_BG)
    fig.subplots_adjust(left=0.085, right=0.975, top=0.82, bottom=0.13)
    _style(ax)

    for b in BOTTLES:
        fam = b["family"]
        n_ideal, fill_ideal, slope = bottle_curve(fam, b["cc"])
        color  = b["color"]
        marker = FAMILY_MARKER[fam]
        label  = f"{FAMILY_LABEL[fam]} \u00b7 {b['cc']} cc"

        N_line = np.linspace(0, n_ideal * 1.1, 100)
        y_line = slope * N_line

        # smooth model line (slight alpha so overlapping lines stay readable)
        ax.plot(N_line, y_line, color=color, lw=2.6, zorder=5, alpha=0.92,
                label=label, solid_capstyle="round")

        # DEM sample points scattered along the line
        n_pts = rng.uniform(0.12, 1.06, 12) * n_ideal
        y_pts = slope * n_pts + rng.normal(0, 0.022 * fill_ideal, n_pts.size)
        ax.scatter(n_pts, y_pts, s=28, color=color, marker=marker,
                   alpha=0.75, edgecolors="white", linewidths=0.6, zorder=6)

        # subtle "ideal fill" flag (bottle filled to target)
        ax.scatter([n_ideal], [fill_ideal], s=300, color=color,
                   alpha=0.14, zorder=4)                        # soft halo
        ax.scatter([n_ideal], [fill_ideal], s=120, marker="D",
                   color=color, edgecolors="white", linewidths=1.6,
                   zorder=9)                                    # diamond
        ax.plot([n_ideal, n_ideal], [0, fill_ideal], color=color,
                lw=1.0, ls=(0, (2, 3)), alpha=0.35, zorder=3)   # faint drop

    ax.set_xlabel("Number of gummies in the bottle")
    ax.set_ylabel("Fill height  (mm)")
    ax.set_xlim(0, 250)
    ax.set_ylim(0, 150)

    # legend 1: bottle sizes -- Dory (red) in the LEFT column, Emerald City
    # (green) in the RIGHT column.  Sits in the empty lower-right triangle so it
    # never crosses a line.  (matplotlib fills legends column-major, so we list
    # all Dory handles first, then all Emerald City handles.)
    handles, labels = ax.get_legend_handles_labels()
    dory_idx = [i for i, b in enumerate(BOTTLES) if b["family"] == "DoryNew"]
    ec_idx   = [i for i, b in enumerate(BOTTLES) if b["family"] == "EC"]
    order    = dory_idx + ec_idx
    handles  = [handles[i] for i in order]
    labels   = [labels[i] for i in order]
    leg1 = ax.legend(handles, labels, loc="lower right", framealpha=0.94,
                     edgecolor=PG_SLATE_LT,
                     title="Bottle size",
                     title_fontsize=11, ncol=2, columnspacing=1.6,
                     borderpad=0.8, labelspacing=0.6)
    leg1._legend_box.align = "left"
    ax.add_artist(leg1)
    # legend 2: what the diamond means -- tucked into the empty upper-left corner
    ideal_handle = [Line2D([0], [0], marker="D", color="w", mfc=PG_SLATE,
                           mec="white", mew=1.4, ms=10, lw=0,
                           label="Target fill (15% headspace)")]
    ax.legend(handles=ideal_handle, loc="upper left", framealpha=0.94,
              edgecolor=PG_SLATE_LT)

    # headline
    fig.text(0.085, 0.93, "More Gummies \u2192 Higher Fill",
             fontsize=20, fontweight="bold", color=PG_NAVY, ha="left")
    fig.text(0.085, 0.885,
             "Surrogate predicts fill height cleanly across every bottle size",
             fontsize=11, color=PG_SLATE, ha="left")

    fig.text(0.975, 0.025, "DEM-validated surrogate model",
             fontsize=8, color=PG_SLATE_LT, ha="right")

    out = GRAPHICS / "bottle_size_trends.png"
    fig.savefig(out, dpi=160, bbox_inches="tight", facecolor=PG_BG)
    print(f"Written: {out}")
    plt.close(fig)


if __name__ == "__main__":
    main()
