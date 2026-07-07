// shared top bar, used by both modules. title / subtitle / module tag are all
// props so each page can label itself. the little "prototype" pill and the back
// button live here too.
import { FlaskConical, ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  /** Short monospace module tag, e.g. "MODULE_01". */
  moduleTag?: string;
  /** Page / module title. Defaults to "PHC Virtual Solid Filler". */
  title?: string;
  /** Subtitle / tagline shown beneath the title. */
  subtitle?: string;
  /** Optional brand-mark icon override. */
  icon?: ReactNode;
  /** When provided, renders a back button in the top-right. */
  onBack?: () => void;
  /** Label for the back button. */
  backLabel?: string;
};

export default function Header({
  moduleTag,
  title = "PHC Virtual Solid Filler",
  subtitle = "DEM → surrogate fill prediction · gummies",
  icon,
  onBack,
  backLabel = "Suite home",
}: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-100/70 bg-white/80 backdrop-blur-xl">
      {/* Hairline brand accent */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-pg-cyan-500/50 to-transparent" />
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-3.5">
        <div className="flex items-center gap-3.5">
          <div
            className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-pg-blue-700 text-white ring-1 ring-inset ring-white/15 shadow-[0_8px_20px_-10px_rgba(38,73,234,0.7)]"
            aria-hidden="true"
          >
            {icon ?? <FlaskConical className="h-[18px] w-[18px]" />}
          </div>
          <div className="leading-tight">
            {moduleTag && (
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-pg-cyan-600">
                {moduleTag}
              </p>
            )}
            <h1 className="text-[1.3rem] font-extrabold tracking-[-0.025em] text-ink-900">
              {title}
            </h1>
            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="hidden items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500 sm:inline-flex">
            v0.2
          </span>
          <span className="hidden items-center gap-1.5 rounded-full border border-pg-cyan-500/30 bg-pg-cyan-500/8 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-pg-cyan-600 sm:inline-flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pg-cyan-500 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-pg-cyan-500" />
            </span>
            Prototype
          </span>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="group inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 transition hover:border-pg-cyan-500/50 hover:bg-pg-cyan-500/5 hover:text-pg-cyan-700 focus-visible:border-pg-cyan-500"
              aria-label={`Back to ${backLabel}`}
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
              {backLabel}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

