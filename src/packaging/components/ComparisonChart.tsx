// bottom strip — bar chart that compares every gummy (or every bottle) side by
// side for the current scenario. it re-runs the model once per preset and plots
// the fill heights. want a different metric or a restyle? this is the file.
import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { BarChart3, Boxes, Bottle } from "../../shared/icons";
import { GUMMY_PRESETS, type GummyPreset } from "../data/productPresets";
import { BOTTLE_PRESETS, type BottlePreset } from "../data/bottlePresets";
import { predictFill } from "../model/surrogateModel";

type Mode = "gummies" | "bottles";

type Props = {
  gummy: GummyPreset;
  bottle: BottlePreset;
  count: number;
};

export default function ComparisonChart({ gummy, bottle, count }: Props) {
  const [mode, setMode] = useState<Mode>("gummies");

  const data = useMemo(() => {
    if (mode === "gummies") {
      return GUMMY_PRESETS.map((g) => {
        const r = predictFill({
          bottleVolumeMl: bottle.volumeMl,
          shoulderHeightMm: bottle.shoulderHeightMm,
          neckHeightMm: bottle.neckHeightMm,
          bodyWidthMm: bottle.bodyWidthMm,
          radiusTopMm: g.radiusTopMm,
          radiusBottomMm: g.radiusBottomMm,
          heightMm: g.heightMm,
          densityGPerMl: g.densityGPerMl,
          weightG: g.weightG,
          count,
        });
        return {
          name: g.shortName,
          id: g.id,
          fillHeight: Number(r.productFillHeightMm.toFixed(1)),
          shoulder: bottle.shoulderHeightMm,
          color: g.accentColor,
          selected: g.id === gummy.id,
        };
      });
    }
    return BOTTLE_PRESETS.map((b) => {
      const r = predictFill({
        bottleVolumeMl: b.volumeMl,
        shoulderHeightMm: b.shoulderHeightMm,
        neckHeightMm: b.neckHeightMm,
        bodyWidthMm: b.bodyWidthMm,
        radiusTopMm: gummy.radiusTopMm,
        radiusBottomMm: gummy.radiusBottomMm,
        heightMm: gummy.heightMm,
        densityGPerMl: gummy.densityGPerMl,
        weightG: gummy.weightG,
        count,
      });
      return {
        name: b.id,
        id: b.id,
        fillHeight: Number(r.productFillHeightMm.toFixed(1)),
        shoulder: b.shoulderHeightMm,
        color: "#2649ea",
        selected: b.id === bottle.id,
      };
    });
  }, [mode, gummy, bottle, count]);

  return (
    <section className="surface p-6" aria-labelledby="compare-heading">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Scenario comparison</p>
          <h2
            id="compare-heading"
            className="mt-1 flex items-center gap-2 text-lg font-bold text-ink-900"
          >
            <BarChart3 className="h-4 w-4 text-pg-blue-700" aria-hidden="true" />
            Predicted fill across presets
          </h2>
        </div>
        <div
          className="inline-flex items-center rounded-2xl border border-ink-100 bg-ink-50 p-1"
          role="tablist"
        >
          <ToggleButton
            active={mode === "gummies"}
            onClick={() => setMode("gummies")}
            icon={<Boxes className="h-3.5 w-3.5" />}
            label="Compare gummy designs"
          />
          <ToggleButton
            active={mode === "bottles"}
            onClick={() => setMode("bottles")}
            icon={<Bottle className="h-3.5 w-3.5" />}
            label="Compare bottle sizes"
          />
        </div>
      </header>

      <p className="mb-3 text-xs text-ink-500">
        {mode === "gummies"
          ? `Predicted product fill height for each gummy design in ${bottle.name}, count ${count}.`
          : `Predicted product fill height for ${gummy.shortName} across every bottle preset, count ${count}.`}
        <span className="ml-1 text-ink-400">
          (Dashed line = shoulder reference{mode === "gummies" ? "" : " of each bottle"}.)
        </span>
      </p>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: "#475569", fontWeight: 600 }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={false}
              label={{
                value: "Fill height (mm)",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11, fill: "#64748b" },
              }}
            />
            <Tooltip
              cursor={{ fill: "rgba(30,58,138,0.05)" }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                fontSize: 12,
              }}
              formatter={(v: number) => [`${v} mm`, "Fill height"]}
            />
            {mode === "gummies" && (
              <ReferenceLine
                y={bottle.shoulderHeightMm}
                stroke="#06b6d4"
                strokeDasharray="4 3"
                label={{
                  value: `Shoulder ${bottle.shoulderHeightMm} mm`,
                  position: "insideTopRight",
                  fontSize: 11,
                  fill: "#06b6d4",
                }}
              />
            )}
            <Bar dataKey="fillHeight" radius={[8, 8, 0, 0]}>
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.selected ? d.color : `${d.color}80`}
                  stroke={d.selected ? d.color : "transparent"}
                  strokeWidth={d.selected ? 2 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>


    </section>
  );
}

function ToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-white text-pg-blue-800 shadow-soft"
          : "text-ink-500 hover:text-ink-700"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
