// right panel — the readout. takes a prediction result and shows the headline
// numbers (fill height, slack-fill, dosage, status) as metric cards, plus a
// plain-english interpretation. no math here, just formatting and layout.
import {
  Ruler,
  PercentDiamond,
  Beaker,
  Pill,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ShieldCheck,
  Info,
} from "lucide-react";
import { interpret, type PredictionResult } from "../model/surrogateModel";
import MetricCard, { type MetricTone } from "../../shared/MetricCard";

type Props = {
  result: PredictionResult;
};

const STATUS_TONE: Record<PredictionResult["status"], MetricTone> = {
  Good: "success",
  Watchout: "warning",
  Overfilled: "danger",
  "Outside model range": "danger",
};

const STATUS_ICON: Record<PredictionResult["status"], React.ReactNode> = {
  Good: <CheckCircle2 className="h-5 w-5" />,
  Watchout: <AlertTriangle className="h-5 w-5" />,
  Overfilled: <AlertOctagon className="h-5 w-5" />,
  "Outside model range": <AlertOctagon className="h-5 w-5" />,
};

const STATUS_STYLES: Record<
  MetricTone,
  { wrap: string; chip: string; text: string }
> = {
  default: { wrap: "", chip: "", text: "" },
  success: {
    wrap: "border-emerald-200 bg-emerald-50/80",
    chip: "bg-emerald-100 text-emerald-700",
    text: "text-emerald-800",
  },
  warning: {
    wrap: "border-amber-200 bg-amber-50/80",
    chip: "bg-amber-100 text-amber-700",
    text: "text-amber-800",
  },
  danger: {
    wrap: "border-rose-200 bg-rose-50/80",
    chip: "bg-rose-100 text-rose-700",
    text: "text-rose-800",
  },
  muted: {
    wrap: "border-violet-200 bg-violet-50/80",
    chip: "bg-violet-100 text-violet-700",
    text: "text-violet-800",
  },
};

export default function OutputPanel({ result }: Props) {
  const tone = STATUS_TONE[result.status];
  const s = STATUS_STYLES[tone];

  return (
    <section className="surface flex flex-col gap-5 p-6" aria-labelledby="outputs-heading">
      <header className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Predicted outputs</p>
          <h2 id="outputs-heading" className="mt-1 text-lg font-bold text-ink-900">
            Results
          </h2>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-100 bg-ink-50 text-pg-blue-700">
          <Beaker className="h-4 w-4" aria-hidden="true" />
        </span>
      </header>

      {/* Model-validity indicator — hard stop when the surrogate is asked to
          extrapolate beyond its DEM-validated design space. The softer
          "inside domain" states are shown compactly at the foot of the sheet. */}
      {!result.inValidatedDomain && (
        <div
          className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4"
          role="alert"
        >
          <div className="flex items-center gap-2.5">
            <AlertOctagon className="h-5 w-5 flex-shrink-0 text-rose-600" aria-hidden="true" />
            <p className="text-sm font-bold uppercase tracking-wide text-rose-700">
              Model not valid — extrapolation
            </p>
          </div>
          <ul className="mt-2 space-y-1">
            {result.validityWarnings.map((w, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-rose-700">
                <span aria-hidden="true">•</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Product fill height"
          value={result.productFillHeightMm.toFixed(1)}
          unit="mm"
          icon={<Ruler className="h-4 w-4" />}
        />
        <MetricCard
          label="Slack fill"
          value={result.slackFillPct.toFixed(1)}
          unit="%"
          icon={<PercentDiamond className="h-4 w-4" />}
          sublabel="Headspace above product"
        />
        <MetricCard
          label="Fill rate"
          value={result.fillRatePct.toFixed(0)}
          unit="%"
          icon={<Beaker className="h-4 w-4" />}
          sublabel="Bottle volume occupied"
        />
        <MetricCard
          label="Dosage"
          value={result.dosageG.toFixed(0)}
          unit="g"
          icon={<Pill className="h-4 w-4" />}
          sublabel="Total product per bottle"
        />
      </div>

      {/* Status */}
      <div
        className={`flex items-center justify-between rounded-xl border ${s.wrap} p-4`}
        role="status"
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-lg ${s.chip}`}
            aria-hidden="true"
          >
            {STATUS_ICON[result.status]}
          </span>
          <div>
            <p className="eyebrow">Status</p>
            <p className={`text-xl font-bold ${s.text}`}>{result.status}</p>
          </div>
        </div>
        <span className="rounded-lg bg-white/70 px-2.5 py-1 font-mono text-xs text-ink-500">
          ƒ&nbsp;=&nbsp;{result.fillFraction.toFixed(2)}
        </span>
      </div>

      {/* Real-model readout: predicted packing fraction + finite-size ratio. */}
      <div className="surface-inset grid grid-cols-3 gap-3 p-4">
        <div>
          <p className="eyebrow">Packing φ</p>
          <p className="mt-0.5 font-display text-lg font-bold tabular-nums text-ink-900">
            {result.phiUsed.toFixed(3)}
          </p>
          <p className="text-[10px] text-ink-400">
            90% CI {result.phiLo.toFixed(3)}–{result.phiHi.toFixed(3)}
          </p>
        </div>
        <div>
          <p className="eyebrow">λ across</p>
          <p className="mt-0.5 font-display text-lg font-bold tabular-nums text-ink-900">
            {result.lambda.toFixed(2)}
          </p>
          <p className="text-[10px] text-ink-400">gummies across</p>
        </div>
        <div>
          <p className="eyebrow">Ideal count</p>
          <p className="mt-0.5 font-display text-lg font-bold tabular-nums text-ink-900">
            {result.nAtTarget.toFixed(0)}
          </p>
          <p className="text-[10px] text-ink-400">at 15% headspace</p>
        </div>
      </div>

      {/* Cross-section readout: shows how a non-round bottle is mapped onto the
          round wall-law via the hydraulic diameter + flat-wall factor. Only
          meaningful when the body isn't round, so hidden for round bottles. */}
      {result.wallShapeFactor !== 1 && (
        <div className="surface-inset grid grid-cols-3 gap-3 p-4">
          <div>
            <p className="eyebrow">Effective ⌀</p>
            <p className="mt-0.5 font-display text-lg font-bold tabular-nums text-ink-900">
              {result.effectiveDiameterMm.toFixed(1)}
              <span className="text-xs font-medium text-ink-400"> mm</span>
            </p>
            <p className="text-[10px] text-ink-400">hydraulic 4·A/P</p>
          </div>
          <div>
            <p className="eyebrow">Aspect ratio</p>
            <p className="mt-0.5 font-display text-lg font-bold tabular-nums text-ink-900">
              {result.crossSectionAspectRatio.toFixed(2)}
            </p>
            <p className="text-[10px] text-ink-400">width : depth</p>
          </div>
          <div>
            <p className="eyebrow">Flat-wall f</p>
            <p className="mt-0.5 font-display text-lg font-bold tabular-nums text-ink-900">
              {result.wallShapeFactor.toFixed(3)}
            </p>
            <p className="text-[10px] text-ink-400">φ shape factor</p>
          </div>
        </div>
      )}

      {/* Interpretation */}
      <div className="surface-inset p-4">
        <div className="flex items-start gap-2.5">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-pg-cyan-600" aria-hidden="true" />
          <div>
            <p className="eyebrow">Interpretation</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-700">
              {interpret(result)}
            </p>
          </div>
        </div>
      </div>

      {/* Soft validity note — only when inside the domain (the hard red banner
          at the top covers the extrapolation case). Kept minimal and last. */}
      {result.inValidatedDomain && (
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
            result.isFullyValidated
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700"
          }`}
          role="status"
        >
          <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span>
            {result.isFullyValidated
              ? "DEM-validated envelope"
              : result.wallShapeFactor !== 1
              ? "Oblong body — modeled via hydraulic-diameter equivalence"
              : "Outside the full-bottle validation band — use with care"}
          </span>
        </div>
      )}
    </section>
  );
}
