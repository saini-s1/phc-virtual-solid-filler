// shared little stat card: label + big number + optional unit/icon. used by
// both the packaging output panel and the nutrition panel. `tone` picks the
// color (success / warning / danger / muted).
import type { ReactNode } from "react";

export type MetricTone = "default" | "success" | "warning" | "danger" | "muted";

type Props = {
  label: string;
  value: string | number;
  unit?: string;
  icon?: ReactNode;
  tone?: MetricTone;
  sublabel?: string;
  className?: string;
};

const toneStyles: Record<MetricTone, string> = {
  default: "bg-white border-ink-100",
  success: "bg-emerald-50/50 border-emerald-200/70",
  warning: "bg-amber-50/50 border-amber-200/70",
  danger: "bg-rose-50/50 border-rose-200/70",
  muted: "bg-violet-50/50 border-violet-200/70",
};

const toneAccent: Record<MetricTone, string> = {
  default: "text-pg-blue-700",
  success: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-rose-700",
  muted: "text-violet-700",
};

export default function MetricCard({
  label,
  value,
  unit,
  icon,
  tone = "default",
  sublabel,
  className = "",
}: Props) {
  return (
    <div
      className={`group rounded-xl border ${toneStyles[tone]} p-4 transition-colors duration-200 hover:border-ink-200 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">
          {label}
        </p>
        {icon && (
          <span className={`${toneAccent[tone]} opacity-70`} aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <p
          className={`font-mono text-[1.7rem] font-bold leading-none tracking-[-0.01em] ${toneAccent[tone]}`}
        >
          {value}
        </p>
        {unit && (
          <span className="text-sm font-medium text-ink-400">{unit}</span>
        )}
      </div>
      {sublabel && (
        <p className="mt-1.5 text-[11px] text-ink-400">{sublabel}</p>
      )}
    </div>
  );
}
