// left panel — where you pick the gummy, the bottle and the count, and can also
// nudge the gummy geometry by hand. it only reads/writes the scenario state and
// hands it back up the tree; it never runs the model itself.
// change which inputs are exposed, or how the form looks, right here.
import { Sparkles, RotateCcw, PencilRuler } from "lucide-react";
import { GUMMY_PRESETS, type GummyPreset } from "../data/productPresets";
import { gummyVolumeMm3 } from "../model/realSurrogate";
import {
  BOTTLE_PRESETS,
  CUSTOM_BOTTLE_ID,
  CUSTOM_VOLUME_RANGE,
  mlToOz,
  type BottleShape,
} from "../data/bottlePresets";

export type ScenarioState = {
  gummyId: GummyPreset["id"];
  bottleId: string;
  count: number;
  // Present only while the "Create custom bottle" option is selected.
  customBottle?: { volumeMl: number; shape: BottleShape };
  // Optional gummy overrides — when present, displace preset values.
  custom?: Partial<{
    radiusTopMm: number;
    radiusBottomMm: number;
    heightMm: number;
    densityGPerMl: number;
    weightG: number;
  }>;
};

type Props = {
  state: ScenarioState;
  gummy: GummyPreset;
  onChange: (next: ScenarioState) => void;
  onRun: () => void;
};

/** Resolve the effective gummy geometry (custom overrides win). */
export function resolveGummy(state: ScenarioState, gummy: GummyPreset) {
  const c = state.custom ?? {};
  return {
    radiusTopMm: c.radiusTopMm ?? gummy.radiusTopMm,
    radiusBottomMm: c.radiusBottomMm ?? gummy.radiusBottomMm,
    heightMm: c.heightMm ?? gummy.heightMm,
    densityGPerMl: c.densityGPerMl ?? gummy.densityGPerMl,
    weightG: c.weightG ?? gummy.weightG,
  };
}

export default function InputPanel({
  state,
  gummy,
  onChange,
  onRun,
}: Props) {
  const update = (patch: Partial<ScenarioState>) =>
    onChange({ ...state, ...patch });

  const updateCustom = (patch: NonNullable<ScenarioState["custom"]>) =>
    onChange({ ...state, custom: { ...(state.custom ?? {}), ...patch } });

  const g = resolveGummy(state, gummy);
  // The model derives single-gummy volume from the DEM mold curve (family +
  // height), NOT from the frustum radii — so show that number here to stay
  // consistent with what actually drives the prediction.
  const gummyVolumeMl = gummyVolumeMm3(gummy.family, g.heightMm) / 1000;
  const hasCustom = !!state.custom && Object.keys(state.custom).length > 0;

  const isCustomBottle = state.bottleId === CUSTOM_BOTTLE_ID;
  const customBottle =
    state.customBottle ?? { volumeMl: 500, shape: "round" as BottleShape };

  return (
    <section
      className="surface flex flex-col gap-6 p-6"
      aria-labelledby="scenario-heading"
    >
      <header className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Inputs</p>
          <h2 id="scenario-heading" className="mt-1 text-lg font-bold text-ink-900">
            Configure scenario
          </h2>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-100 bg-ink-50 text-pg-cyan-600">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
      </header>

      {/* Preset selectors */}
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label htmlFor="gummy-preset" className="field-label">
            Gummy preset
          </label>
          <div className="relative">
            <select
              id="gummy-preset"
              className="select-input pr-9"
              value={state.gummyId}
              onChange={(e) =>
                update({
                  gummyId: e.target.value as GummyPreset["id"],
                  custom: undefined,
                })
              }
            >
              {GUMMY_PRESETS.map((gp) => (
                <option key={gp.id} value={gp.id}>
                  {gp.name}
                </option>
              ))}
            </select>
            <Chevron />
          </div>
        </div>

        <div>
          <label htmlFor="bottle-preset" className="field-label">
            Bottle preset
          </label>
          <div className="relative">
            <select
              id="bottle-preset"
              className="select-input pr-9"
              value={state.bottleId}
              onChange={(e) => {
                const bottleId = e.target.value;
                if (bottleId === CUSTOM_BOTTLE_ID) {
                  update({
                    bottleId,
                    customBottle: state.customBottle ?? {
                      volumeMl: 500,
                      shape: "round",
                    },
                  });
                } else {
                  update({ bottleId });
                }
              }}
            >
              {(["round", "rectangle"] as const).map((shape) => {
                const items = BOTTLE_PRESETS.filter((b) => b.shape === shape);
                if (items.length === 0) return null;
                return (
                  <optgroup
                    key={shape}
                    label={shape === "round" ? "Round" : "Rectangle"}
                  >
                    {items.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
              <optgroup label="Custom">
                <option value={CUSTOM_BOTTLE_ID}>
                  Create custom bottle…
                </option>
              </optgroup>
            </select>
            <Chevron />
          </div>
        </div>
      </div>

      {/* Custom bottle builder — only while the custom option is selected */}
      {isCustomBottle && (
        <div className="surface-inset p-4">
          <div className="mb-3 flex items-center gap-2">
            <PencilRuler
              className="h-4 w-4 text-pg-cyan-600"
              aria-hidden="true"
            />
            <p className="eyebrow mb-0">Custom bottle</p>
          </div>

          {/* Shape toggle */}
          <div
            className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-ink-100 p-1"
            role="group"
            aria-label="Custom bottle shape"
          >
            {(["round", "rectangle"] as const).map((shape) => {
              const active = customBottle.shape === shape;
              return (
                <button
                  key={shape}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    update({
                      customBottle: { ...customBottle, shape },
                    })
                  }
                  className={
                    "rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition " +
                    (active
                      ? "bg-white text-pg-blue-700 shadow-sm"
                      : "text-ink-500 hover:text-ink-700")
                  }
                >
                  {shape}
                </button>
              );
            })}
          </div>

          {/* Volume: free number entry + quick-pick slider */}
          <div className="mb-1 flex items-end justify-between">
            <label htmlFor="custom-volume" className="field-label mb-0">
              Nominal volume
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                step={5}
                value={customBottle.volumeMl}
                onChange={(e) =>
                  update({
                    customBottle: {
                      ...customBottle,
                      volumeMl: Number(e.target.value),
                    },
                  })
                }
                className="number-input w-24 text-right"
                aria-label="Custom bottle nominal volume in cc"
              />
              <span className="text-xs font-medium text-ink-400">
                cc · {mlToOz(customBottle.volumeMl).toFixed(1)} oz
              </span>
            </div>
          </div>
          <input
            id="custom-volume"
            type="range"
            min={CUSTOM_VOLUME_RANGE.minMl}
            max={CUSTOM_VOLUME_RANGE.maxMl}
            step={CUSTOM_VOLUME_RANGE.stepMl}
            value={Math.min(
              Math.max(customBottle.volumeMl, CUSTOM_VOLUME_RANGE.minMl),
              CUSTOM_VOLUME_RANGE.maxMl
            )}
            onChange={(e) =>
              update({
                customBottle: {
                  ...customBottle,
                  volumeMl: Number(e.target.value),
                },
              })
            }
            className="w-full"
            aria-label="Custom bottle volume quick-pick slider"
          />
          <div className="mt-1 flex justify-between text-[10px] font-medium tabular-nums text-ink-300">
            <span>{CUSTOM_VOLUME_RANGE.minMl} cc (6 oz)</span>
            <span>{CUSTOM_VOLUME_RANGE.maxMl} cc · type for more</span>
          </div>
        </div>
      )}

      {/* Gummy geometry */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="eyebrow">Gummy parameters</p>
          <span className="pill bg-pg-blue-50 text-pg-blue-700">
            {gummyVolumeMl.toFixed(2)} mL each
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumField
            label="Radius top"
            unit="mm"
            value={g.radiusTopMm}
            step={0.1}
            onChange={(v) => updateCustom({ radiusTopMm: v })}
          />
          <NumField
            label="Radius bottom"
            unit="mm"
            value={g.radiusBottomMm}
            step={0.1}
            onChange={(v) => updateCustom({ radiusBottomMm: v })}
          />
          <NumField
            label="Height"
            unit="mm"
            value={g.heightMm}
            step={0.1}
            onChange={(v) => updateCustom({ heightMm: v })}
          />
          <NumField
            label="Density"
            unit="g/mL"
            value={g.densityGPerMl}
            step={0.01}
            onChange={(v) => updateCustom({ densityGPerMl: v })}
          />
          <NumField
            label="Product weight"
            unit="g"
            value={g.weightG}
            step={0.01}
            onChange={(v) => updateCustom({ weightG: v })}
          />
          <div className="flex items-end">
            {hasCustom ? (
              <button
                type="button"
                onClick={() => update({ custom: undefined })}
                className="btn-ghost h-[42px] w-full justify-center"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Reset
              </button>
            ) : (
              <p className="px-1 pb-1 text-[11px] leading-snug text-ink-400">
                Edit any field to override the preset.
              </p>
            )}
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-ink-400">
          The surrogate is driven by <strong className="text-ink-500">height</strong>{" "}
          and <strong className="text-ink-500">density</strong> (via the DEM mold
          family). Radii are used for the 3D view and mass estimate only.
        </p>
      </div>

      {/* Count */}
      <div>
        <div className="mb-2 flex items-end justify-between">
          <label htmlFor="count-slider" className="field-label mb-0">
            Gummy count
          </label>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-3xl font-bold tabular-nums text-pg-blue-700">
              {state.count}
            </span>
            <span className="text-xs font-medium text-ink-400">per bottle</span>
          </div>
        </div>
        <input
          id="count-slider"
          type="range"
          min={5}
          max={250}
          step={1}
          value={state.count}
          onChange={(e) => update({ count: Number(e.target.value) })}
          className="w-full"
          aria-label="Gummy count"
        />
        <div className="mt-1 flex justify-between text-[10px] font-medium tabular-nums text-ink-300">
          <span>5</span>
          <span>250</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onRun}
        className="btn-primary w-full text-base"
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        Run prediction
      </button>
    </section>
  );
}

function NumField({
  label,
  unit,
  value,
  onChange,
  step = 0.1,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-400">
        {label}
      </span>
      <div className="relative">
        <input
          type="number"
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="number-input pr-12"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-ink-300">
          {unit}
        </span>
      </div>
    </label>
  );
}

function Chevron() {
  return (
    <svg
      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
