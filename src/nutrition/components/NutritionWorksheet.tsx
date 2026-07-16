import { Table2, ShieldCheck, ShieldAlert, ShieldOff, Sigma } from "lucide-react";
import type {
  CalcResponse,
  CalorieResult,
  NutrientResult,
  NutritionPanel,
} from "../index";
import type { ComplianceClass } from "../types/config";
import { NUTRIENTS } from "../config/nutrients";
import { US_REGION } from "../config/regions";

// "Nutrition tab" worksheet — a faithful reproduction of the source Excel's Nutrition sheet.
// For each 21 CFR 101.9(g) compliance class it lays out, per nutrient:
//   Total (summed across all ingredients) → Daily Value (RDI/DRV) → %DV (raw → label) →
//   rounding rule → declared label value.
// PURE RENDER: every amount/%/declaration comes from the engine response; the only extra
// input is the static US Daily Value table (reference constants, not computation).

type Props = {
  response: CalcResponse;
};

const MULTI_WORD_UNITS = new Set(["mcg RAE", "mcg DFE", "mg NE"]);
const DV_BY_ID = new Map(US_REGION.dailyValues.map((d) => [d.nutrientId, d]));

/** Compact numeric formatting for the high-precision "Total" column. */
function num(n: number, maxFrac = 4): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: maxFrac });
}

/** Amount + unit with the FDA spacing convention (e.g. "5 g", "55 mg", "4 mcg RAE"). */
function withUnit(value: number | string, unit: string): string {
  if (typeof value === "string") return value; // regulatory declaration, e.g. "Less than 1 g"
  if (unit === "") return num(value);
  return MULTI_WORD_UNITS.has(unit) ? `${num(value)} ${unit}` : `${num(value)} ${unit}`;
}

/**
 * Plain-English description of the SINGLE rounding step the engine applied to this value.
 * Picks the matching tier the same way the engine does (see rounding.ts) instead of dumping
 * the whole tier table, so each row reads as one clear rule.
 */
function roundingApplied(group: string, value: number, isPctDv: boolean, unit: string): string {
  const rule = US_REGION.roundingRules.find((r) => r.group === group);
  if (!rule) return "n/a";
  if ((rule.strategy ?? "tiers") === "significantFigures") {
    return `${rule.sigFigs ?? 2} significant figures`;
  }
  const v = Math.abs(value);
  const tier = (rule.tiers ?? []).find(
    (t) => t.upTo === null || (t.inclusive ? v <= t.upTo : v < t.upTo),
  );
  if (!tier) return "shown as calculated";
  if (tier.mode === "zero") return isPctDv ? "Rounds down to 0%" : `Rounds down to 0 ${unit}`.trimEnd();
  if (tier.mode === "text") return `Shows “${tier.text ?? ""}”`;
  return isPctDv ? `Nearest ${tier.increment ?? 1}%` : `Nearest ${tier.increment ?? 1} ${unit}`.trimEnd();
}

/** The one rounding rule that governs this nutrient's headline declaration. */
function roundingForRow(n: NutrientResult): string {
  const meta = NUTRIENTS[n.nutrientId];
  // Vitamins/minerals declare as a % Daily Value → the %DV tiers govern (applied to raw %DV).
  if (meta.kind === "vitaminMineral" && n.pctDV !== null) {
    return roundingApplied(US_REGION.pctDvRoundingGroup, n.pctDV, true, "");
  }
  // Macros (and micros with no Daily Value) declare as an amount → the amount tiers govern.
  return roundingApplied(meta.amountRoundingGroup, n.stages.asDeclared, false, n.unit);
}

/** The label value as it would print: %DV for micros (amount as backup), amount for macros. */
function declaredLabel(n: NutrientResult): string {
  const meta = NUTRIENTS[n.nutrientId];
  const amount = withUnit(n.declaredAmountRounded, n.unit);
  if (meta.kind === "vitaminMineral" && n.pctDVRounded !== null) {
    const amt = typeof n.declaredAmountRounded === "number" ? ` · ${amount}` : "";
    return `${n.pctDVRounded}% DV${amt}`;
  }
  return amount;
}

// ── Compliance-class metadata (header copy + the 101.9(g) rule) ──────────────────────────
const CLASS_META: Record<
  Exclude<ComplianceClass, "none">,
  { title: string; rule: string; citation: string }
> = {
  I: {
    title: "Class I · added nutrients",
    rule: "Must stay at or above 100% of the label.",
    citation: "101.9(g)(4)(i)",
  },
  II: {
    title: "Class II · naturally occurring",
    rule: "Must stay at or above 80% of the label.",
    citation: "101.9(g)(4)(ii)",
  },
  thirdGroup: {
    title: "Third group · calories, sugars, fats, sodium",
    rule: "Must stay at or below 120% of the label.",
    citation: "101.9(g)(5)",
  },
};

function HeadCell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-ink-400 ${className}`}
    >
      {children}
    </th>
  );
}

/** One nutrient row: Total → DV → %DV (raw → label) → declared → rounding rule. */
function Row({ n }: { n: NutrientResult }) {
  const meta = NUTRIENTS[n.nutrientId];
  const dv = DV_BY_ID.get(n.nutrientId);
  const pct =
    n.pctDV !== null
      ? `${num(n.pctDV, 2)}% → ${n.pctDVRounded}%`
      : "n/a";
  const fails = n.meetsCompliance === false;

  return (
    <tr className={`border-t border-ink-100 ${fails ? "bg-rose-50/40" : ""}`}>
      <th scope="row" className="px-3 py-2 text-left text-[13px] font-semibold text-ink-800">
        {meta.displayName}
      </th>
      <td className="px-3 py-2 text-right font-mono text-[12px] tabular-nums text-ink-700">
        {num(n.stages.raw)} <span className="text-ink-400">{n.unit}</span>
      </td>
      <td className="px-3 py-2 text-right font-mono text-[12px] tabular-nums text-ink-500">
        {dv ? `${num(dv.value)} ${dv.unit}` : "n/a"}
      </td>
      <td className="px-3 py-2 text-right font-mono text-[12px] tabular-nums text-ink-600">{pct}</td>
      <td className="px-3 py-2 text-right text-[13px] font-bold tabular-nums text-ink-900">
        {declaredLabel(n)}
      </td>
      <td className="px-3 py-2 text-left text-[11px] leading-snug text-ink-400">
        {roundingForRow(n)}
      </td>
    </tr>
  );
}

/** Calories sits in the third group in the Excel; it has its own (non-%DV) shape. */
function CalorieRow({ cal }: { cal: CalorieResult }) {
  return (
    <tr className="border-t border-ink-100">
      <th scope="row" className="px-3 py-2 text-left text-[13px] font-semibold text-ink-800">
        Calories
      </th>
      <td className="px-3 py-2 text-right font-mono text-[12px] tabular-nums text-ink-700">
        {num(cal.unrounded)} <span className="text-ink-400">kcal</span>
      </td>
      <td className="px-3 py-2 text-right font-mono text-[12px] text-ink-400">n/a</td>
      <td className="px-3 py-2 text-right font-mono text-[12px] text-ink-400">n/a</td>
      <td className="px-3 py-2 text-right text-[13px] font-bold tabular-nums text-ink-900">
        {cal.value}{" "}
        <span className="font-mono text-[10px] font-normal text-ink-400">· Method {cal.method}</span>
      </td>
      <td className="px-3 py-2 text-left text-[11px] leading-snug text-ink-400">
        {roundingApplied("calories", cal.unrounded, false, "kcal")}
      </td>
    </tr>
  );
}

function ClassSection({
  klass,
  nutrients,
  calories,
}: {
  klass: Exclude<ComplianceClass, "none">;
  nutrients: NutrientResult[];
  calories?: CalorieResult;
}) {
  if (nutrients.length === 0 && !calories) {
    // Show the class even when empty (e.g. no added nutrients in this formula) so the three
    // 101.9(g) groups are always visible and the structure is clear.
    const meta = CLASS_META[klass];
    return (
      <div className="surface-inset overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-ink-50/60 px-3 py-2.5">
          <div>
            <p className="text-[13px] font-bold text-ink-800">{meta.title}</p>
            <p className="text-[11px] text-ink-500">{meta.rule}</p>
          </div>
          <span className="pill border border-ink-200 bg-white text-ink-400">none in this formula</span>
        </div>
      </div>
    );
  }
  const meta = CLASS_META[klass];
  const failing = nutrients.filter((n) => n.meetsCompliance === false).length;
  const Status = failing > 0 ? ShieldAlert : ShieldCheck;
  const statusTone =
    failing > 0 ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div className="surface-inset overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 bg-ink-50/60 px-3 py-2.5">
        <div>
          <p className="text-[13px] font-bold text-ink-800">{meta.title}</p>
          <p className="text-[11px] text-ink-500">
            {meta.rule}{" "}
            <code className="rounded bg-white px-1 py-0.5 font-mono text-[10px] text-ink-400">
              {meta.citation}
            </code>
          </p>
        </div>
        <span className={`pill border ${statusTone}`}>
          <Status className="h-3 w-3" aria-hidden="true" />
          {failing > 0 ? `${failing} outside limit` : "within limits"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-white">
              <HeadCell>Nutrient</HeadCell>
              <HeadCell className="text-right">Total / serving</HeadCell>
              <HeadCell className="text-right">Daily Value</HeadCell>
              <HeadCell className="text-right">% DV (raw → label)</HeadCell>
              <HeadCell className="text-right">Declared</HeadCell>
              <HeadCell>How it's rounded</HeadCell>
            </tr>
          </thead>
          <tbody>
            {calories && <CalorieRow cal={calories} />}
            {nutrients.map((n) => (
              <Row key={n.nutrientId} n={n} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function NutritionWorksheet({ response }: Props) {
  const panel = response.panel;

  return (
    <section
      className="surface flex animate-fade-up flex-col gap-5 p-6 [animation-delay:240ms]"
      aria-labelledby="nutrition-worksheet"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Label worksheet</p>
          <h2 id="nutrition-worksheet" className="mt-1 text-lg font-bold text-ink-900">
            Nutrition tab · totals → Daily Value → %DV → rounding → declared
          </h2>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink-500">
            The same math as the source Excel “Nutrition” sheet: add each nutrient across all
            ingredients, divide by its Daily Value for %DV, round to the legal increment, and group
            by compliance class (21 CFR 101.9(g)).
          </p>
        </div>
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-ink-100 bg-ink-50 text-pg-blue-700">
          <Table2 className="h-4 w-4" />
        </span>
      </header>

      {!panel ? (
        <div className="surface-inset flex items-center gap-2.5 p-4 text-[13px] text-ink-500">
          <ShieldOff className="h-4 w-4 flex-shrink-0 text-violet-500" aria-hidden="true" />
          The worksheet appears once the formulation resolves. Clear the blocking issues in the
          panel above (for example, complete an ingredient, or pick a calorie method that has its
          fiber split).
        </div>
      ) : (
        <WorksheetBody panel={panel} />
      )}

      <p className="text-[11px] leading-relaxed text-ink-400">
        Rounding follows the fixed 21 CFR 101.9(c) increments, never a hand-picked “Reco.” cell.
        Vitamins and minerals print as % Daily Value, with the amount alongside.
      </p>
    </section>
  );
}

function WorksheetBody({ panel }: { panel: NutritionPanel }) {
  const byClass = (k: Exclude<ComplianceClass, "none">) =>
    panel.nutrients.filter((n) => n.complianceClass === k);
  const classI = byClass("I");
  const classII = byClass("II");
  const third = byClass("thirdGroup");

  return (
    <div className="flex flex-col gap-4">
      {/* Serving context — the worksheet's basis row, like the Excel header. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <Sigma className="h-3.5 w-3.5 text-pg-cyan-600" aria-hidden="true" />
          <span className="font-semibold text-ink-700">Per serving:</span>{" "}
          {panel.servingWeightG.toFixed(2)} g
        </span>
        <span>
          <span className="font-semibold text-ink-700">{panel.servingsPerContainer ?? "X"}</span>{" "}
          servings / container
        </span>
        <span>
          <span className="font-semibold text-ink-700">{panel.nutrients.length}</span> nutrients
          declared
        </span>
      </div>

      <ClassSection klass="I" nutrients={classI} />
      <ClassSection klass="II" nutrients={classII} />
      <ClassSection klass="thirdGroup" nutrients={third} calories={panel.calories} />
    </div>
  );
}
