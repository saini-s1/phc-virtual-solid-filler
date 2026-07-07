// "how we'd make this real" roadmap cards. not wired into the dashboard right
// now (kept around because it's a handy slide for showing where dem data plugs
// in). drop <RealDataPanel /> into PackagingApp if you want it back on screen.
import {
  Upload,
  BrainCircuit,
  ClipboardCheck,
  Activity,
  Rocket,
  Plug,
} from "lucide-react";

const ITEMS = [
  {
    icon: Upload,
    title: "Upload DEM simulation outputs",
    body: "Ingest raw DEM packing simulations across the DOX design space.",
  },
  {
    icon: BrainCircuit,
    title: "Train surrogate model",
    body: "Fit a fast regression surrogate (GP / GBM / NN) on DEM responses.",
  },
  {
    icon: ClipboardCheck,
    title: "Validate against lab/DEM cases",
    body: "Hold-out validation vs. lab fill tests and unseen DEM runs.",
  },
  {
    icon: Activity,
    title: "Add model confidence ranges",
    body: "Surface prediction intervals and out-of-domain alerts in the UI.",
  },
  {
    icon: Rocket,
    title: "Deploy to broader packaging users",
    body: "Enterprise rollout: SSO, audit trail, versioned model registry.",
  },
];

export default function RealDataPanel() {
  return (
    <section className="surface p-6" aria-labelledby="realdata-heading">
      <header className="mb-4 flex items-center gap-2">
        <Plug className="h-4 w-4 text-pg-blue-700" aria-hidden="true" />
        <h2
          id="realdata-heading"
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-600"
        >
          Where Real Data Connects
        </h2>
      </header>
      <p className="mb-4 text-xs text-ink-500">
        Roadmap for connecting validated DEM data and replacing every
        placeholder coefficient in <code className="font-mono text-[11px] text-pg-blue-800">src/utils/surrogateModel.ts</code>.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          return (
            <div
              key={it.title}
              className="flex h-full flex-col rounded-xl border border-ink-100 bg-white p-4 transition-colors duration-200 hover:border-ink-200"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-pg-cyan-500/8 text-pg-cyan-600">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="pill bg-ink-50 text-ink-500 ring-1 ring-ink-100">
                  Planned
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-ink-800">
                {it.title}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
                {it.body}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
