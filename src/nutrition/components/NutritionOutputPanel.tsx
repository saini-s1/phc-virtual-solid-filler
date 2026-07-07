import { ShieldCheck, AlertTriangle, ShieldOff, Info, CheckCircle2 } from "lucide-react";
import type { CalcResponse, NutritionPanel } from "../index";
import { NUTRIENTS } from "../config/nutrients";
import type { MetricTone } from "../../shared/MetricCard";

// Sits directly UNDER the Nutrition Facts label: the compliance verdict, validation flags,
// and per-nutrient assumptions, read straight off the structured CalcResponse. No nutrient math.

type Props = {
  response: CalcResponse;
};

type Compliance = { tone: MetricTone; label: string; sublabel: string; icon: typeof ShieldCheck };

function summarizeCompliance(response: CalcResponse): Compliance {
  if (response.status === "blocked" || !response.panel) {
    return {
      tone: "muted",
      label: "Blocked",
      sublabel: "Inputs incomplete, so the panel cannot emit. See the label above.",
      icon: ShieldOff,
    };
  }
  const failing = response.panel.nutrients.filter((n) => n.meetsCompliance === false);
  if (failing.length > 0) {
    return {
      tone: "danger",
      label: "Out of tolerance",
      sublabel: `${failing.length} nutrient(s) outside 101.9(g) limits (Class I ≥100% / II ≥80% / third group ≤120%).`,
      icon: AlertTriangle,
    };
  }
  if (response.validationFlags.length > 0) {
    return {
      tone: "warning",
      label: "Review",
      sublabel: "Compliant, but with assumptions/flags to confirm.",
      icon: AlertTriangle,
    };
  }
  return {
    tone: "success",
    label: "Compliant",
    sublabel: "End-of-shelf-life within Class I/II floors; third group within ceiling.",
    icon: ShieldCheck,
  };
}

const TONE_WRAP: Record<MetricTone, string> = {
  default: "border-ink-200 bg-ink-50",
  success: "border-emerald-200 bg-emerald-50/80",
  warning: "border-amber-200 bg-amber-50/80",
  danger: "border-rose-200 bg-rose-50/80",
  muted: "border-violet-200 bg-violet-50/80",
};
const TONE_TEXT: Record<MetricTone, string> = {
  default: "text-ink-700",
  success: "text-emerald-800",
  warning: "text-amber-800",
  danger: "text-rose-800",
  muted: "text-violet-800",
};

export default function NutritionOutputPanel({ response }: Props) {
  const compliance = summarizeCompliance(response);
  const ComplianceIcon = compliance.icon;
  const panel = response.panel;

  return (
    <section
      className="surface flex animate-fade-up flex-col gap-4 p-6 [animation-delay:200ms]"
      aria-labelledby="nutri-output"
    >
      <header className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Results</p>
          <h2 id="nutri-output" className="mt-1 text-lg font-bold text-ink-900">
            Compliance &amp; assumptions
          </h2>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-100 bg-ink-50 text-pg-blue-700">
          <ShieldCheck className="h-4 w-4" />
        </span>
      </header>

      {/* Compliance verdict */}
      <div className={`rounded-xl border ${TONE_WRAP[compliance.tone]} p-4`} role="status">
        <div className="flex items-center gap-2">
          <ComplianceIcon className={`h-5 w-5 ${TONE_TEXT[compliance.tone]}`} aria-hidden="true" />
          <p className={`text-[15px] font-bold ${TONE_TEXT[compliance.tone]}`}>
            Compliance · {compliance.label}
          </p>
        </div>
        <p className={`mt-1.5 text-[13px] leading-relaxed ${TONE_TEXT[compliance.tone]}`}>
          {compliance.sublabel}
        </p>
      </div>

      {/* Flags & assumptions */}
      <div>
        <p className="field-label">Flags &amp; assumptions</p>
        {response.validationFlags.length === 0 ? (
          <div className="surface-inset flex items-center gap-2 p-3 text-[13px] text-ink-500">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden="true" />
            No outstanding validation flags for this configuration.
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {response.validationFlags.map((flag, i) => (
              <li
                key={i}
                className="surface-inset flex items-start gap-2 p-3 text-[13px] leading-relaxed text-ink-600"
              >
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" aria-hidden="true" />
                {flag}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Per-nutrient notes (e.g. assumed loss/decay), if any */}
      {panel && <NutrientFlagsRollup panel={panel} />}
    </section>
  );
}

function NutrientFlagsRollup({ panel }: { panel: NutritionPanel }) {
  const withFlags = panel.nutrients.filter((n) => n.flags.length > 0);
  if (withFlags.length === 0) return null;
  return (
    <div>
      <p className="field-label">Per-nutrient notes</p>
      <ul className="flex flex-col gap-1.5">
        {withFlags.map((n) => (
          <li
            key={n.nutrientId}
            className="surface-inset flex items-start gap-2 p-3 text-[13px] leading-relaxed text-ink-600"
          >
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-400" aria-hidden="true" />
            <span>
              <span className="font-semibold text-ink-700">{NUTRIENTS[n.nutrientId].displayName}:</span>{" "}
              {n.flags.join(" ")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
