// the landing screen — two big tiles that route into the two modules. this IS
// the nav for the whole suite. change the tiles or the hero copy here.
import { FlaskConical, Apple, ArrowRight, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export type AppView = "home" | "packaging" | "nutrition";

type Props = {
  onSelect: (view: AppView) => void;
};

/** Landing screen with the two module-selector tiles. */
export default function HomePage({ onSelect }: Props) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      {/* Animated grid + accent washes */}
      <BackdropGrid />

      {/* Compact brand bar (no nav — this IS the nav) */}
      <header className="relative z-10 mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-pg-blue-700 text-white ring-1 ring-inset ring-white/15 shadow-[0_8px_20px_-10px_rgba(38,73,234,0.7)]">
            <Sparkles className="h-[16px] w-[16px]" aria-hidden="true" />
          </div>
          <h1 className="text-[1.15rem] font-extrabold tracking-[-0.025em] text-ink-900">
            PHC Modeling Suite
          </h1>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-pg-cyan-500/30 bg-pg-cyan-500/8 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-pg-cyan-600">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pg-cyan-500 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-pg-cyan-500" />
          </span>
          Prototype · v0.2
        </span>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-6 pb-12">
        {/* Hero */}
        <section className="mx-auto mt-10 max-w-2xl animate-fade-up text-center">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-pg-cyan-600">
            Select a module
          </p>
          <h2 className="mt-3 text-3xl font-extrabold leading-[1.05] tracking-[-0.03em] text-ink-900 md:text-[2.6rem]">
            Choose a modeling workspace
          </h2>
        </section>

        {/* Module tiles */}
        <section className="mx-auto mt-10 grid w-full max-w-5xl gap-6 lg:grid-cols-2">
          <ModuleTile
            tag="MODULE_01"
            icon={<FlaskConical className="h-7 w-7" />}
            name="Virtual Solid Filler"
            kicker="Packaging · DEM Surrogate"
            description="Predict bottle fill height, slack-fill, and solid packing for PHC gummies, using a surrogate trained on DEM simulation data."
            chips={["Gummies", "Bottles", "Fill height", "Slack-fill"]}
            cta="Launch module"
            accent="cyan"
            onClick={() => onSelect("packaging")}
            delay={120}
          />
          <ModuleTile
            tag="MODULE_02"
            icon={<Apple className="h-7 w-7" />}
            name="Nutrition Calculator"
            kicker="Formulation · Nutrition Facts"
            description="Turn ingredient and serving inputs into a rounded, FDA-style Nutrition Facts panel — with %DV and compliance checks."
            chips={["Macros", "Micros", "%DV", "Compliance"]}
            cta="Launch module"
            accent="lime"
            onClick={() => onSelect("nutrition")}
            delay={200}
          />
        </section>
      </main>

      <footer className="relative z-10 border-t border-ink-100/70 bg-white/60 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-center px-6 py-3 text-[11px] text-ink-400">
          <p>© 2026 P&amp;G Internal · PHC Modeling Suite</p>
        </div>
      </footer>
    </div>
  );
}

// Module tile
type TileAccent = "cyan" | "lime";

type ModuleTileProps = {
  tag: string;
  icon: ReactNode;
  name: string;
  kicker: string;
  description: string;
  chips: string[];
  cta: string;
  accent: TileAccent;
  onClick: () => void;
  delay?: number;
};

const ACCENT: Record<
  TileAccent,
  {
    ring: string;
    glow: string;
    text: string;
    chipBorder: string;
    chipText: string;
    iconBg: string;
    iconRing: string;
    bracket: string;
    scan: string;
  }
> = {
  cyan: {
    ring: "hover:border-pg-cyan-500/50",
    glow: "group-hover:shadow-[0_0_0_1px_rgba(6,182,212,0.18),0_30px_60px_-30px_rgba(6,182,212,0.55)]",
    text: "text-pg-cyan-600",
    chipBorder: "border-pg-cyan-500/20",
    chipText: "text-pg-cyan-600",
    iconBg: "bg-pg-blue-700 text-white",
    iconRing: "ring-pg-cyan-400/40",
    bracket: "text-pg-cyan-500/60",
    scan: "from-transparent via-pg-cyan-400/60 to-transparent",
  },
  lime: {
    ring: "hover:border-pg-lime-500/60",
    glow: "group-hover:shadow-[0_0_0_1px_rgba(132,204,22,0.22),0_30px_60px_-30px_rgba(132,204,22,0.45)]",
    text: "text-pg-lime-500",
    chipBorder: "border-pg-lime-500/25",
    chipText: "text-pg-lime-500",
    iconBg: "bg-emerald-700 text-white",
    iconRing: "ring-pg-lime-500/40",
    bracket: "text-pg-lime-500/70",
    scan: "from-transparent via-pg-lime-500/60 to-transparent",
  },
};

function ModuleTile({
  tag,
  icon,
  name,
  kicker,
  description,
  chips,
  cta,
  accent,
  onClick,
  delay = 0,
}: ModuleTileProps) {
  const a = ACCENT[accent];

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={`group surface relative flex animate-fade-up flex-col gap-6 overflow-hidden p-7 text-left transition-all duration-300 ${a.ring} ${a.glow} hover:-translate-y-1`}
    >
      {/* Corner brackets */}
      <CornerBracket className={`top-3 left-3 ${a.bracket}`} />
      <CornerBracket className={`top-3 right-3 rotate-90 ${a.bracket}`} />
      <CornerBracket className={`bottom-3 left-3 -rotate-90 ${a.bracket}`} />
      <CornerBracket className={`bottom-3 right-3 rotate-180 ${a.bracket}`} />

      {/* Scan-line accent (visible on hover) */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r ${a.scan} opacity-0 transition-opacity duration-500 group-hover:opacity-100`}
      />

      {/* Header row: tag + status */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-ink-500">
          {tag}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/50 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
          Live
        </span>
      </div>

      {/* Icon + title */}
      <div className="flex items-start gap-5">
        <div
          className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ${a.iconRing} shadow-[0_10px_28px_-14px_rgba(15,26,61,0.6)] ${a.iconBg}`}
          aria-hidden="true"
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className={`font-mono text-[10px] font-semibold uppercase tracking-[0.18em] ${a.text}`}>
            {kicker}
          </p>
          <h3 className="mt-1 text-[1.55rem] font-extrabold leading-tight tracking-[-0.02em] text-ink-900">
            {name}
          </h3>
        </div>
      </div>

      {/* Description */}
      <p className="text-[14px] leading-relaxed text-ink-600">{description}</p>

      {/* Chips */}
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span
            key={c}
            className={`inline-flex items-center rounded-md border ${a.chipBorder} bg-white px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] ${a.chipText}`}
          >
            {c}
          </span>
        ))}
      </div>

      {/* CTA row */}
      <div className="mt-auto flex items-center justify-between border-t border-ink-100 pt-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
          Ready · click to enter
        </span>
        <span
          className={`inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 transition-colors group-hover:border-ink-300 group-hover:bg-ink-50`}
        >
          {cta}
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}

// Background decorations
function CornerBracket({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      className={`pointer-events-none absolute ${className}`}
    >
      <path
        d="M1 4 V1 H4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BackdropGrid() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {/* Soft brand washes */}
      <div className="absolute inset-0 bg-[radial-gradient(900px_440px_at_92%_-10%,rgba(6,182,212,0.10),transparent_60%),radial-gradient(760px_420px_at_-8%_4%,rgba(38,73,234,0.08),transparent_58%)]" />
      {/* Grid lines */}
      <div
        className="absolute inset-0 opacity-[0.55] [mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_85%)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(38,73,234,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(38,73,234,0.06) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      {/* Slow drifting accent line */}
      <div
        className="absolute left-0 right-0 top-1/3 h-px bg-gradient-to-r from-transparent via-pg-cyan-500/40 to-transparent"
        style={{ animation: "sheen 6s ease-in-out infinite" }}
      />
    </div>
  );
}
