// center panel — the drawn bottle plus the live 3d gummy pile inside it.
// pure presentation: give it a prediction result and it draws it. the 2d bottle
// outline is svg (see computeGeometry lower down), the gummies are three.js and
// live in GummyFill3D. tweak the bottle look here, gummy physics in GummyFill3D.
import { useMemo } from "react";
import { motion } from "framer-motion";
import type { BottlePreset } from "../data/bottlePresets";
import { targetBandMm, type PredictionResult } from "../model/surrogateModel";
import GummyFill3D from "./GummyFill3D";

type Props = {
  bottle: BottlePreset;
  result: PredictionResult;
  /** Number of gummies — drives the height of the 3D pile. */
  count: number;
  /** Increments to retrigger fill animation when "Run prediction" is clicked. */
  runId: number;
};

/**
 * Realistic supplement-bottle visualization.
 *
 * Two cross-section families are drawn:
 *   • Round — chunky cap, short wide neck (lip), brief sloped shoulder, then
 *     a tall cylinder that makes up ~95% of the body.
 *   • Rectangle — same cap/neck but a tall rounded-rectangle body with a
 *     shorter, steeper shoulder ramp matching real oblong PHC bottles.
 *
 * Product fills from the bottom up and normally lands in the upper half of
 * the bottle. Geometry is scaled across the preset range so the smallest
 * bottle (6 oz / 175 cc) still reads clearly while the largest (635 cc rect)
 * fills the available canvas.
 */
export default function BottleVisualizer({ bottle, result, count, runId }: Props) {
  const W = 320;
  const H = 520;
  const g = useMemo(() => computeGeometry(bottle, W, H), [bottle]);

  const fillFraction = clamp(
    result.productFillHeightMm / result.totalInternalHeightMm,
    0,
    1.03
  );
  const shoulderFraction = clamp(
    bottle.shoulderHeightMm / result.totalInternalHeightMm,
    0,
    1
  );
  const band = targetBandMm(result);
  const targetFraction = clamp(
    Math.max(0, band.idealMm) / result.totalInternalHeightMm,
    0,
    1
  );

  const span = g.bodyBottomY - g.fillTopY; // pixels from base to "100% fill"
  const fillY = g.bodyBottomY - fillFraction * span;
  const shoulderY = g.bodyBottomY - shoulderFraction * span;
  const targetY = g.bodyBottomY - targetFraction * span;

  // Real gummy size relative to THIS bottle. The 3D fill region spans the full
  // bottle width (2 world units), so a gummy whose sphere-equivalent diameter
  // is `gummyDiameterMm` occupies `gummyDiameterMm / bodyWidthMm` of the
  // width — i.e. small bottles show proportionally larger gummies.
  const gummyDiameterMm =
    2 * Math.cbrt((3 * (result.gummyVolumeMl * 1000)) / (4 * Math.PI));
  const gummyScale = clamp(gummyDiameterMm / bottle.bodyWidthMm, 0.1, 0.34);

  const isRect = bottle.shape === "rectangle";
  const bodyStatLabel = isRect
    ? `${bottle.bodyWidthMm.toFixed(0)}×${(bottle.bodyDepthMm ?? bottle.bodyWidthMm).toFixed(0)}`
    : `Ø${bottle.bodyWidthMm.toFixed(0)}`;

  return (
    <section
      className="surface relative flex h-full flex-col overflow-hidden"
      aria-label="Bottle fill visualization"
    >
      <div className="flex items-center justify-between px-6 pt-6">
        <div>
          <p className="eyebrow">Visualization</p>
          <h3 className="mt-1 text-lg font-bold text-ink-900">{bottle.name}</h3>
        </div>
        <div className="flex gap-2">
          <Stat value={`${bottle.volumeMl}`} unit="mL" label="nominal" />
          <Stat value={bodyStatLabel} unit="mm" label="body" />
        </div>
      </div>

      <div className="relative flex-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-full max-h-[540px] w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-labelledby="bottle-title"
        >
          <title id="bottle-title">
            Bottle showing predicted product fill height of{" "}
            {result.productFillHeightMm.toFixed(1)} millimeters out of{" "}
            {result.totalInternalHeightMm.toFixed(0)} millimeters usable height.
          </title>

          <defs>
            <linearGradient id="bottleGlass" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#e7ecf6" stopOpacity="0.9" />
              <stop offset="22%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#f1f4fb" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#d7deec" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="cap" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#23408f" />
              <stop offset="100%" stopColor="#16265c" />
            </linearGradient>
            <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="18%" stopColor="#ffffff" stopOpacity="0.75" />
              <stop offset="34%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <clipPath id="interior">
              <path d={bottleBodyPath(g, true)} />
            </clipPath>
            <filter id="bottleShadow" x="-40%" y="-15%" width="180%" height="135%">
              <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#1e3a8a" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* Soft ground shadow */}
          <ellipse
            cx={W / 2}
            cy={g.bodyBottomY + 14}
            rx={g.bodyWidth / 2}
            ry={12}
            fill="#1e293b"
            opacity={0.1}
          />

          <g filter="url(#bottleShadow)">
            {/* Cap */}
            <rect
              x={(W - g.capWidth) / 2}
              y={g.capTopY}
              width={g.capWidth}
              height={g.capHeight}
              rx={9}
              fill="url(#cap)"
            />
            {/* Cap ribs */}
            {Array.from({ length: 9 }).map((_, i) => {
              const cx0 = (W - g.capWidth) / 2 + 6;
              const step = (g.capWidth - 12) / 8;
              return (
                <line
                  key={i}
                  x1={cx0 + i * step}
                  x2={cx0 + i * step}
                  y1={g.capTopY + 5}
                  y2={g.capTopY + g.capHeight - 5}
                  stroke="#0d1734"
                  strokeOpacity={0.4}
                  strokeWidth={1.4}
                />
              );
            })}
            {/* Lip ring under the cap */}
            <rect
              x={(W - g.neckWidth) / 2 - 4}
              y={g.capTopY + g.capHeight - 2}
              width={g.neckWidth + 8}
              height={7}
              rx={3}
              fill="#c3cce0"
            />

            {/* Bottle body glass */}
            <path
              d={bottleBodyPath(g, false)}
              fill="url(#bottleGlass)"
              stroke="#aab6d0"
              strokeWidth={1.4}
              strokeLinejoin="round"
            />

            {/* Product fill — real 3D vitamin gummies, clipped to the bottle
                interior so the settled pile appears inside the bottle. */}
            <foreignObject
              x={(W - g.bodyWidth) / 2}
              y={g.fillTopY}
              width={g.bodyWidth}
              height={g.bodyBottomY - g.fillTopY}
              clipPath="url(#interior)"
            >
              <div
                // @ts-expect-error xmlns is valid on the embedded HTML root
                xmlns="http://www.w3.org/1999/xhtml"
                style={{ width: "100%", height: "100%" }}
              >
                <GummyFill3D
                  count={count}
                  fillFraction={fillFraction}
                  aspect={g.bodyWidth / (g.bodyBottomY - g.fillTopY)}
                  gummyScale={gummyScale}
                  runId={runId}
                />
              </div>
            </foreignObject>

            {/* Glass sheen */}
            <path
              d={bottleBodyPath(g, false)}
              fill="url(#sheen)"
              opacity={0.55}
              pointerEvents="none"
            />
          </g>

          {/* Reference lines */}
          <RefLine
            y={shoulderY}
            x2={(W + g.bodyWidth) / 2}
            label="Shoulder"
            value={`${bottle.shoulderHeightMm} mm`}
            color="#8a93b5"
          />
          <RefLine
            y={targetY}
            x2={(W + g.bodyWidth) / 2}
            label="Target band"
            value={`${band.idealMm.toFixed(0)} mm`}
            color="#06b6d4"
            dashed
          />
          <motion.g
            key={`fillline-${runId}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.65, duration: 0.5 }}
          >
            <RefLine
              y={fillY}
              x1={(W - g.bodyWidth) / 2}
              label="Predicted fill"
              value={`${result.productFillHeightMm.toFixed(0)} mm`}
              color="#1e3a8a"
              strong
              side="left"
            />
          </motion.g>
        </svg>
      </div>


    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Geometry
// ──────────────────────────────────────────────────────────────────────────

type Geometry = {
  W: number;
  H: number;
  shape: "round" | "rectangle";
  bodyWidth: number;
  neckWidth: number;
  capWidth: number;
  capTopY: number;
  capHeight: number;
  neckBaseY: number; // where neck meets shoulder
  bodyTopY: number; // where shoulder meets cylinder/wall
  bodyBottomY: number;
  fillTopY: number; // y for "100% usable fill"
  cornerR: number;
  shoulderTaperPx: number;
};

function computeGeometry(b: BottlePreset, W: number, H: number): Geometry {
  // Front-face widths across the new preset range: round 52..82 mm,
  // rectangle 58..88 mm. Map the combined 52..88 window to 150..220 px so the
  // smallest bottle stays readable and the largest still fits inside the SVG
  // canvas (W = 320 px) with breathing room for reference labels.
  const bw = Math.max(50, Math.min(92, b.bodyWidthMm));
  const bodyWidth = 150 + ((bw - 50) / 42) * 70;
  const neckWidth = Math.max(48, bodyWidth * (b.shape === "rectangle" ? 0.48 : 0.56));
  const capWidth = neckWidth + 16;

  // Scale the drawn bottle HEIGHT by the real internal height so a 175 cc
  // bottle looks short and a 635 cc bottle looks tall. Bottle sits on the
  // shelf (bottom-aligned) and grows upward.
  const bodyBottomY = H - 26;
  const pxPerMm = 2.6;
  const maxBodyPx = bodyBottomY - 96; // leave room for neck + cap at the top
  const bodyPx = Math.max(180, Math.min(maxBodyPx, b.neckHeightMm * pxPerMm));

  const bodyTopY = bodyBottomY - bodyPx; // cylinder top (shoulder ends here)
  // Rectangles have a tighter, steeper shoulder than round packer bottles.
  const shoulderTaperPx = b.shape === "rectangle" ? 12 : 22;
  const neckBaseY = bodyTopY - shoulderTaperPx; // shoulder top / neck bottom
  const neckPx = 14;
  const capHeight = 30;
  const capTopY = neckBaseY - neckPx - capHeight + 2;

  // 100% usable fill is at the mouth (top of the neck region).
  const fillTopY = neckBaseY;

  return {
    W,
    H,
    shape: b.shape,
    bodyWidth,
    neckWidth,
    capWidth,
    capTopY,
    capHeight,
    neckBaseY,
    bodyTopY,
    bodyBottomY,
    fillTopY,
    // Rectangle bottles have a small radius rounded-rect body; round bottles
    // use the larger radius for their soft-shouldered base.
    cornerR: b.shape === "rectangle" ? 10 : 20,
    shoulderTaperPx,
  };
}

/**
 * Body silhouette. Two shapes are supported:
 *   • round       — short neck → soft curved shoulder → tall cylinder with
 *                   a generously rounded base.
 *   • rectangle   — short neck → short straight shoulder ramp → tall
 *                   rounded-rectangle body (small corner radius).
 *
 * The `interior` flag insets the path by a few pixels so it can also be used
 * as a clipPath for the 3D gummy fill, keeping product safely inside the
 * glass even on rectangular bottles where the wall is straight.
 */
function bottleBodyPath(g: Geometry, interior: boolean): string {
  const inset = interior ? 3 : 0;
  const cx = g.W / 2;
  const bw = g.bodyWidth - inset * 2;
  const nw = g.neckWidth - inset * 2;
  const bl = cx - bw / 2;
  const br = cx + bw / 2;
  const nl = cx - nw / 2;
  const nr = cx + nw / 2;
  const r = g.cornerR;
  const neckTop = g.capTopY + g.capHeight - 2 + inset;
  const top = g.bodyTopY;
  const bottom = g.bodyBottomY - inset;

  if (g.shape === "rectangle") {
    // Straight shoulder ramp + boxy body with rounded corners.
    return [
      `M ${nl} ${neckTop}`,
      `L ${nl} ${g.neckBaseY}`,
      // straight shoulder ramp (left)
      `L ${bl} ${top}`,
      // rounded-rectangle body (left wall + bottom + right wall)
      `L ${bl} ${bottom - r}`,
      `Q ${bl} ${bottom}, ${bl + r} ${bottom}`,
      `L ${br - r} ${bottom}`,
      `Q ${br} ${bottom}, ${br} ${bottom - r}`,
      `L ${br} ${top}`,
      // straight shoulder ramp (right)
      `L ${nr} ${g.neckBaseY}`,
      `L ${nr} ${neckTop}`,
      `Z`,
    ].join(" ");
  }

  // Round packer bottle — soft sigmoid shoulders.
  return [
    `M ${nl} ${neckTop}`,
    `L ${nl} ${g.neckBaseY}`,
    `C ${nl} ${top - 10}, ${bl} ${g.neckBaseY + 6}, ${bl} ${top}`,
    `L ${bl} ${bottom - r}`,
    `Q ${bl} ${bottom}, ${bl + r} ${bottom}`,
    `L ${br - r} ${bottom}`,
    `Q ${br} ${bottom}, ${br} ${bottom - r}`,
    `L ${br} ${top}`,
    `C ${br} ${g.neckBaseY + 6}, ${nr} ${top - 10}, ${nr} ${g.neckBaseY}`,
    `L ${nr} ${neckTop}`,
    `Z`,
  ].join(" ");
}

// Blue gummy palette — subtle variation in shade so the pile has depth.
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

// ──────────────────────────────────────────────────────────────────────────
// Small UI bits
// ──────────────────────────────────────────────────────────────────────────

function Stat({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div className="rounded-xl bg-ink-50 px-3 py-1.5 text-right">
      <p className="text-sm font-bold tabular-nums text-ink-800">
        {value}
        <span className="ml-0.5 text-[11px] font-medium text-ink-400">{unit}</span>
      </p>
      <p className="text-[10px] font-medium uppercase tracking-wide text-ink-400">
        {label}
      </p>
    </div>
  );
}

function RefLine({
  y,
  x1,
  x2,
  label,
  value,
  color,
  dashed,
  strong,
  side = "right",
}: {
  y: number;
  x1?: number;
  x2?: number;
  label: string;
  value: string;
  color: string;
  dashed?: boolean;
  strong?: boolean;
  side?: "right" | "left";
}) {
  const W = 320;
  if (side === "left") {
    const startX = x1 ?? 70;
    return (
      <g>
        <line
          x1={Math.max(8, startX - 64)}
          x2={startX}
          y1={y}
          y2={y}
          stroke={color}
          strokeWidth={strong ? 2 : 1.2}
          strokeDasharray={dashed ? "5 4" : undefined}
        />
        <g transform={`translate(${Math.max(8, startX - 64)} ${y})`}>
          <rect x={-4} y={-20} width={70} height={17} rx={5} fill={color} />
          <text x={31} y={-8} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff">
            {label}
          </text>
          <text x={-4} y={13} fontSize={10} fontWeight={700} fill={color}>
            {value}
          </text>
        </g>
      </g>
    );
  }
  const endX = x2 ?? W - 70;
  return (
    <g>
      <line
        x1={endX}
        x2={Math.min(W - 8, endX + 64)}
        y1={y}
        y2={y}
        stroke={color}
        strokeWidth={strong ? 2 : 1.2}
        strokeDasharray={dashed ? "5 4" : undefined}
      />
      <g transform={`translate(${Math.min(W - 8, endX + 64)} ${y})`}>
        <text x={-2} y={-6} textAnchor="end" fontSize={9} fontWeight={700} fill={color}>
          {label}
        </text>
        <text x={-2} y={12} textAnchor="end" fontSize={10} fontWeight={700} fill={color}>
          {value}
        </text>
      </g>
    </g>
  );
}
