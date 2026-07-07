import { CheckCircle2, MinusCircle, AlertTriangle } from "lucide-react";
import type { Completeness } from "../index";

// Small status pill for an ingredient nutrient's completeness (FLAG 2). Color is always
// paired with an icon + text label — never color alone (accessibility).

type Props = {
  completeness: Completeness;
  /** When provided, the badge is a button that cycles the completeness state. */
  onCycle?: () => void;
};

const META: Record<Completeness, { label: string; pill: string; icon: typeof CheckCircle2 }> = {
  known: {
    label: "Known",
    pill: "border-pg-cyan-500/30 bg-pg-cyan-500/10 text-pg-cyan-600",
    icon: CheckCircle2,
  },
  zeroConfirmed: {
    label: "Zero confirmed",
    pill: "border-ink-200 bg-ink-50 text-ink-500",
    icon: MinusCircle,
  },
  unknown: {
    label: "Unknown",
    pill: "border-amber-300 bg-amber-50 text-amber-700",
    icon: AlertTriangle,
  },
};

export default function CompletenessBadge({ completeness, onCycle }: Props) {
  const meta = META[completeness];
  const Icon = meta.icon;
  const className = `pill border ${meta.pill}`;

  if (onCycle) {
    return (
      <button
        type="button"
        onClick={onCycle}
        className={`${className} transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-pg-cyan-500/40`}
        aria-label={`Completeness: ${meta.label}. Click to change.`}
        title="Cycle completeness (known → zero confirmed → unknown)"
      >
        <Icon className="h-3 w-3" aria-hidden="true" />
        {meta.label}
      </button>
    );
  }

  return (
    <span className={className}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {meta.label}
    </span>
  );
}
