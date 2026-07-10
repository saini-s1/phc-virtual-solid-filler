import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ShieldOff, ArrowRightLeft } from "lucide-react";
import type {
  CalcResponse,
  CalorieMethod,
  NutrientResult,
  NutritionPanel,
} from "../index";
import { NUTRIENTS } from "../config/nutrients";
import CalorieMethodToggle from "./CalorieMethodToggle";

// CENTER focal point — renders the structured CalcResponse as an FDA-faithful Supplement
// Facts panel (21 CFR 101.36, which incorporates 101.9(c) for Daily Values, rounding, and
// compliance). PURE RENDER: no nutrient math, no rounding. All numbers/strings come from the
// engine; this component only lays them out. The panel heading comes from the engine (panel.title).

type Props = {
  response: CalcResponse;
  /** Optional second dose column (identical formulation at a different serving weight). */
  response2?: CalcResponse | null;
  onMethodChange: (m: CalorieMethod) => void;
  /** Bumped on "Recalculate" to retrigger entrance motion. */
  runId: number;
};

const MULTI_WORD_UNITS = new Set(["mcg RAE", "mcg DFE", "mg NE"]);

function formatAmount(value: number | string, unit: string): string {
  if (typeof value === "string") return value; // regulatory declaration (e.g. "Less than 1 g")
  if (unit === "") return String(value);
  return MULTI_WORD_UNITS.has(unit) ? `${value} ${unit}` : `${value}${unit}`;
}

const INDENT: Record<0 | 1 | 2, string> = { 0: "", 1: "pl-4", 2: "pl-8" };

function ThickBar() {
  return <div className="my-1 h-[7px] bg-ink-900" aria-hidden="true" />;
}
function MediumBar() {
  return <div className="my-1 h-[4px] bg-ink-900" aria-hidden="true" />;
}

function NutrientLabelRow({ n }: { n: NutrientResult }) {
  const meta = NUTRIENTS[n.nutrientId];
  const bold = meta.kind === "macro" && meta.indentLevel === 0;
  const indent = INDENT[meta.indentLevel];
  const amount = formatAmount(n.declaredAmountRounded, n.unit);
  const pct = n.pctDVRounded !== null ? `${n.pctDVRounded}%` : "";

  // Added sugars uses the FDA "Includes Xg Added Sugars" phrasing.
  const isAddedSugars = n.nutrientId === "addedSugars";
  const left = isAddedSugars ? (
    <span>
      Includes {amount} <span className="font-semibold">Added Sugars</span>
    </span>
  ) : (
    <span>
      <span className={bold ? "font-bold text-ink-900" : "text-ink-800"}>{meta.displayName}</span>{" "}
      <span className="text-ink-800">{amount}</span>
    </span>
  );

  return (
    <div className={`flex items-baseline justify-between border-b border-ink-200 py-1 text-[13px] ${indent}`}>
      <div className="leading-snug">{left}</div>
      {pct && <div className="font-bold tabular-nums text-ink-900">{pct}</div>}
    </div>
  );
}

function FactsBody({
  panel,
  onMethodChange,
}: {
  panel: NutritionPanel;
  onMethodChange: (m: CalorieMethod) => void;
}) {
  const macros = panel.nutrients.filter((n) => NUTRIENTS[n.nutrientId].kind === "macro");
  const micros = panel.nutrients.filter((n) => NUTRIENTS[n.nutrientId].kind === "vitaminMineral");
  const cal = panel.calories;

  return (
    <div className="font-sans text-ink-900">
      <h3 className="text-[30px] font-extrabold leading-none tracking-[-0.02em]">{panel.title}</h3>
      <div className="mt-1 h-px bg-ink-900" />

      <p className="pt-1 text-[13px]">
        {panel.servingsPerContainer ?? "X"} servings per container
      </p>
      <div className="flex items-baseline justify-between pb-1 text-[15px] font-bold">
        <span>Serving size</span>
        <span className="tabular-nums">{panel.servingWeightG.toFixed(2)} g</span>
      </div>

      <ThickBar />

      <p className="text-[11px] font-semibold">Amount per serving</p>
      <div className="flex items-end justify-between">
        <span className="text-[26px] font-extrabold leading-none">Calories</span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={`${cal.method}-${cal.value}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="font-mono text-[40px] font-extrabold leading-none tabular-nums"
          >
            {cal.value}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Method toggle + side-by-side comparisons: D / B / C at a glance (active emphasized) */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <CalorieMethodToggle
          method={cal.method}
          onChange={onMethodChange}
          layoutGroup="label"
          size="sm"
        />
        <div
          className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-400"
          aria-label="Calorie methods compared"
        >
          {cal.comparisons.map((c, i) => {
            const active = c.method === cal.method;
            return (
              <span key={c.method} className="inline-flex items-center gap-1">
                {i > 0 && (
                  <span className="text-ink-300" aria-hidden="true">
                    ·
                  </span>
                )}
                <span
                  className={
                    active
                      ? "rounded bg-pg-blue-50 px-1.5 py-0.5 font-bold text-pg-blue-700"
                      : ""
                  }
                >
                  {c.method}{" "}
                  <strong className={active ? "text-pg-blue-700" : "text-ink-600"}>
                    {c.value}
                  </strong>
                </span>
              </span>
            );
          })}
        </div>
      </div>

      <MediumBar />
      <p className="text-right text-[12px] font-bold">% Daily Value*</p>
      <div className="h-px bg-ink-900" />

      {macros.map((n) => (
        <NutrientLabelRow key={n.nutrientId} n={n} />
      ))}

      <ThickBar />

      {micros.map((n) => (
        <NutrientLabelRow key={n.nutrientId} n={n} />
      ))}

      <MediumBar />
      <p className="pt-1 text-[10px] leading-snug text-ink-500">
        {panel.footnotes.join(" ")}
      </p>
    </div>
  );
}

// Two-dose amount cell: declared amount over its % Daily Value.
function DoseCell({ n }: { n: NutrientResult }) {
  const pct = n.pctDVRounded !== null ? `${n.pctDVRounded}%` : "";
  return (
    <>
      <div className="text-right tabular-nums text-ink-800">
        {formatAmount(n.declaredAmountRounded, n.unit)}
      </div>
      <div className="text-right font-bold tabular-nums text-ink-900">{pct}</div>
    </>
  );
}

const DUAL_GRID = "grid grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))] items-baseline gap-x-1.5";

function DualNutrientRow({ n1, n2 }: { n1: NutrientResult; n2: NutrientResult }) {
  const meta = NUTRIENTS[n1.nutrientId];
  const bold = meta.kind === "macro" && meta.indentLevel === 0;
  const indent = INDENT[meta.indentLevel];
  const label =
    n1.nutrientId === "addedSugars" ? "Includes Added Sugars" : meta.displayName;
  return (
    <div className={`${DUAL_GRID} border-b border-ink-200 py-1 text-[12px] ${indent}`}>
      <div className={`leading-snug ${bold ? "font-bold text-ink-900" : "text-ink-800"}`}>
        {label}
      </div>
      <DoseCell n={n1} />
      <DoseCell n={n2} />
    </div>
  );
}

// Dual-column Supplement Facts panel: one heading, two dose columns (e.g. per 1 vs per 2).
// Both panels come from independent engine runs on the same recipe, so amounts and %DV
// stay internally consistent per column.
function DualFactsBody({
  panel,
  panel2,
}: {
  panel: NutritionPanel;
  panel2: NutritionPanel;
}) {
  const macros = panel.nutrients.filter((n) => NUTRIENTS[n.nutrientId].kind === "macro");
  const micros = panel.nutrients.filter((n) => NUTRIENTS[n.nutrientId].kind === "vitaminMineral");
  const by2 = new Map(panel2.nutrients.map((n) => [n.nutrientId, n]));
  const doseLabel = (g: number) => `Per ${Number(g.toFixed(2))} g`;

  return (
    <div className="font-sans text-ink-900">
      <h3 className="text-[30px] font-extrabold leading-none tracking-[-0.02em]">{panel.title}</h3>
      <div className="mt-1 h-px bg-ink-900" />

      <p className="pt-1 text-[13px]">{panel.servingsPerContainer ?? "X"} servings per container</p>
      <p className="pb-1 text-[13px] text-ink-600">
        Two serving sizes shown: {doseLabel(panel.servingWeightG)} and{" "}
        {doseLabel(panel2.servingWeightG)}
      </p>

      <ThickBar />

      {/* Column headers */}
      <div className={`${DUAL_GRID} pb-1`}>
        <div className="text-[11px] font-semibold">Amount per serving</div>
        <div className="col-span-2 text-center text-[11px] font-bold">
          {doseLabel(panel.servingWeightG)}
        </div>
        <div className="col-span-2 text-center text-[11px] font-bold">
          {doseLabel(panel2.servingWeightG)}
        </div>
      </div>
      <div className={`${DUAL_GRID} border-b border-ink-900 pb-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-500`}>
        <div />
        <div className="text-right">Amount</div>
        <div className="text-right">% DV*</div>
        <div className="text-right">Amount</div>
        <div className="text-right">% DV*</div>
      </div>

      {/* Calories row */}
      <div className={`${DUAL_GRID} border-b border-ink-200 py-1`}>
        <div className="text-[15px] font-extrabold">Calories</div>
        <div className="col-span-2 text-right font-mono text-[18px] font-extrabold tabular-nums">
          {panel.calories.value}
        </div>
        <div className="col-span-2 text-right font-mono text-[18px] font-extrabold tabular-nums">
          {panel2.calories.value}
        </div>
      </div>

      {macros.map((n) => {
        const n2 = by2.get(n.nutrientId);
        return n2 ? <DualNutrientRow key={n.nutrientId} n1={n} n2={n2} /> : null;
      })}

      <ThickBar />

      {micros.map((n) => {
        const n2 = by2.get(n.nutrientId);
        return n2 ? <DualNutrientRow key={n.nutrientId} n1={n} n2={n2} /> : null;
      })}

      <MediumBar />
      <p className="pt-1 text-[10px] leading-snug text-ink-500">{panel.footnotes.join(" ")}</p>
    </div>
  );
}

function BlockedBody({
  response,
  onMethodChange,
}: {
  response: CalcResponse;
  onMethodChange: (m: CalorieMethod) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-violet-700">
          <ShieldOff className="h-5 w-5" />
        </span>
        <div>
          <p className="eyebrow text-violet-500">Panel blocked</p>
          <h3 className="text-lg font-bold text-ink-900">Resolve before a label can emit</h3>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {response.blockingIssues.map((issue) => (
          <div key={issue.code} className="surface-inset border border-violet-200 bg-violet-50/40 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-violet-600" aria-hidden="true" />
              <code className="font-mono text-[11px] font-semibold text-violet-700">{issue.code}</code>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-700">{issue.message}</p>
            {issue.offenders.length > 0 && (
              <p className="mt-1.5 text-[12px] text-ink-500">
                <span className="font-semibold">Affected:</span> {issue.offenders.join(", ")}
              </p>
            )}
            {issue.code === "METHOD_C_FIBER_SPLIT_MISSING" && (
              <button
                type="button"
                onClick={() => onMethodChange("C")}
                className="btn-ghost mt-3"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Switch to Method C
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NutritionFactsLabel({
  response,
  response2,
  onMethodChange,
  runId,
}: Props) {
  const blocked = response.status === "blocked" || response.panel === null;
  const panelTitle = response.panel?.title ?? "Supplement Facts";
  // Show the dual-dose layout only when a second dose is active and both columns resolve.
  const dual = !blocked && response.panel !== null && response2?.panel != null;

  return (
    <section
      className="surface flex animate-fade-up flex-col p-6 shadow-elevated [animation-delay:120ms]"
      aria-label={`Prototype ${panelTitle} panel`}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="eyebrow">
          {panelTitle} · prototype{dual ? " · two doses" : ""}
        </p>
      </div>

      <div
        key={`${runId}-${dual ? "dual" : "single"}`}
        className={`mx-auto w-full animate-fade-up rounded-xl border-2 border-ink-900 bg-white px-4 py-3 ${
          dual ? "max-w-[560px]" : "max-w-[420px]"
        }`}
      >
        {blocked || !response.panel ? (
          <BlockedBody response={response} onMethodChange={onMethodChange} />
        ) : dual && response2?.panel ? (
          <DualFactsBody panel={response.panel} panel2={response2.panel} />
        ) : (
          <FactsBody panel={response.panel} onMethodChange={onMethodChange} />
        )}
      </div>
    </section>
  );
}
