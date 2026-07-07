// the 5-step "inputs -> dem dox -> surrogate -> prediction -> decision" strip.
// explains the methodology at a glance. currently not mounted in the dashboard;
// drop <WorkflowDiagram /> into PackagingApp if you want the story back.
import {
  Boxes,
  FlaskConical,
  BrainCircuit,
  Gauge,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

const STEPS = [
  {
    icon: Boxes,
    title: "Product + Package Inputs",
    detail: "Gummy geometry, bottle CAD, count, packing assumptions.",
  },
  {
    icon: FlaskConical,
    title: "DEM DOX",
    detail: "Design-of-experiments across the meaningful input space.",
  },
  {
    icon: BrainCircuit,
    title: "Surrogate Model",
    detail: "Trained on DEM outputs — fast, regression-friendly predictor.",
  },
  {
    icon: Gauge,
    title: "Instant UI Prediction",
    detail: "Fill height, slack-fill, status — in milliseconds.",
  },
  {
    icon: CheckCircle2,
    title: "Packaging Decision",
    detail: "Go / no-go, slack-fill compliance, scenario comparison.",
  },
];

export default function WorkflowDiagram() {
  return (
    <section className="surface p-6" aria-labelledby="workflow-heading">
      <header className="mb-4">
        <p className="eyebrow">Methodology</p>
        <h2
          id="workflow-heading"
          className="mt-1 text-lg font-bold text-ink-900"
        >
          DEM-to-Surrogate Workflow
        </h2>
      </header>

      <ol className="flex flex-wrap items-stretch gap-2 lg:flex-nowrap">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <li
              key={step.title}
              className="flex flex-1 items-stretch gap-2 min-w-[200px]"
            >
              <div className="flex flex-1 flex-col rounded-xl border border-ink-100 bg-white p-3 transition-colors duration-200 hover:border-ink-200">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pg-blue-700/8 text-pg-blue-700">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-300">
                    Step&nbsp;{i + 1}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-ink-800">
                  {step.title}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
                  {step.detail}
                </p>
              </div>
              {i < STEPS.length - 1 && (
                <ChevronRight
                  className="hidden h-5 w-5 self-center text-ink-300 lg:block"
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
