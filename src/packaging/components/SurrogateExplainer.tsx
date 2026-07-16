// bottom-of-page explainer — a guided walkthrough of what the surrogate model
// actually is: how DEM simulations become a fast φ predictor, the two-part
// packing-fraction law, the validated envelope, and the end-to-end validation
// results. Purely presentational; reads the shared validity constants so the
// "valid range" chips can never drift from the model.
import {
  Cpu,
  FunctionSquare,
  Gauge,
  ShieldCheck,
  FlaskConical,
  ArrowRight,
} from "lucide-react";
import {
  FAMILY_H_RANGE,
  VALID_LAMBDA,
  VALIDATED_BOTTLE_LAMBDA,
} from "../model/surrogateModel";

const STEPS = [
  {
    icon: Cpu,
    title: "1 · DEM ground truth",
    body: "Aspherix discrete-element simulations drop thousands of real mold-shaped gummies into cylinders and bottles and measure how densely they settle. Each run takes ~1.7 h.",
  },
  {
    icon: FunctionSquare,
    title: "2 · Fit the surrogate",
    body: "Two Gaussian-Process models are fit to that data: a wall/size law φ_eff(λ) and a gummy-shape trend GP(H, ρ). Together they predict packing fraction φ in under a millisecond.",
  },
  {
    icon: Gauge,
    title: "3 · Predict the fill",
    body: "For your gummy + bottle, φ becomes the occupied bulk volume, which is walked up the bottle profile to give fill height, slack fill, and the count that reaches the shoulder.",
  },
];

export default function SurrogateExplainer() {
  return (
    <section
      className="surface p-6 md:p-8"
      aria-labelledby="explainer-heading"
    >
      <header className="mb-6 max-w-3xl">
        <p className="eyebrow">Under the hood</p>
        <h2
          id="explainer-heading"
          className="mt-1 flex items-center gap-2 text-xl font-bold text-ink-900"
        >
          <FlaskConical className="h-5 w-5 text-pg-blue-700" aria-hidden="true" />
          What the surrogate model actually is
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          A <strong>surrogate model</strong> is a fast stand-in for a slow
          physics simulation: run the expensive DEM a few times, learn the
          pattern, then evaluate it instantly. This one is trained on real DEM
          packing data for the EC and DoryNew gummy molds.
        </p>
      </header>

      {/* Three-step flow */}
      <div className="grid gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <div key={s.title} className="relative">
            <div className="surface-inset h-full p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-pg-blue-50 text-pg-blue-700">
                <s.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-sm font-bold text-ink-900">{s.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-600">
                {s.body}
              </p>
            </div>
            {i < STEPS.length - 1 && (
              <ArrowRight
                className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-ink-300 md:block"
                aria-hidden="true"
              />
            )}
          </div>
        ))}
      </div>

      {/* The two-part law — rendered equations */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="surface-inset p-5">
          <p className="eyebrow">The packing-fraction law</p>
          <p className="mt-2 text-xs leading-relaxed text-ink-600">
            Predicted packing fraction φ = wall/size law × normalized shape trend:
          </p>

          <EqBlock caption="master equation for combined φ">
            <Sub base="φ" sub="used" />
            <Op>=</Op>
            <Sub base="φ" sub="eff" />
            <Paren>
              <Var>λ</Var>
            </Paren>
            <Op>·</Op>
            <Frac
              num={
                <>
                  <Fn>GP</Fn>
                  <Paren>
                    <Var>H</Var>, <Var>ρ</Var>
                  </Paren>
                </>
              }
              den={
                <>
                  <Fn>GP</Fn>
                  <Paren>
                    <Sub base="H" sub="nom" />, <Sub base="ρ" sub="nom" />
                  </Paren>
                </>
              }
            />
          </EqBlock>

          <EqBlock caption="wall / finite-size law">
            <Sub base="φ" sub="eff" />
            <Paren>
              <Var>λ</Var>
            </Paren>
            <Op>=</Op>
            <Sub base="φ" sub="∞" />
            <Paren>
              <>
                1 <Op>−</Op> <Frac num={<Var>c</Var>} den={<Var>λ</Var>} />
              </>
            </Paren>
            <Op>+</Op>
            <Fn>GP</Fn>
            <Sub base="" sub="res" />
            <Paren>
              <Frac num={<>1</>} den={<Var>λ</Var>} />
            </Paren>
          </EqBlock>

          <EqBlock caption="gummies-across, from the DEM mold curve">
            <Var>λ</Var>
            <Op>=</Op>
            <Frac num={<Sub base="D" sub="body" />} den={<Sub base="d" sub="base" />} />
            <Op>,</Op>
            <span className="ml-2" />
            <Sub base="d" sub="base" />
            <Op>=</Op>
            <Var>a</Var>
            <Var>H</Var>
            <Op>+</Op>
            <Var>b</Var>
          </EqBlock>

          <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-ink-600">
            <li>
              <strong className="text-ink-800">φ_eff(λ)</strong>: the wall law; λ
              is “gummies across”.
            </li>
            <li>
              <strong className="text-ink-800">GP(H, ρ) ratio</strong>: relative
              height/density effect versus the nominal shape.
            </li>
            <li>
              Each GP reports a{" "}
              <strong className="text-ink-800">90% credible interval</strong>.
            </li>
          </ul>
        </div>

        {/* Fill geometry equations + validated envelope */}
        <div className="flex flex-col gap-4">
          <div className="surface-inset p-5">
            <p className="eyebrow">From φ to a fill line</p>
            <p className="mt-2 text-xs leading-relaxed text-ink-600">
              φ sets the occupied bulk volume, walked up the bottle profile:
            </p>
            <EqBlock caption="occupied bulk volume">
              <Sub base="V" sub="bulk" />
              <Op>=</Op>
              <Frac
                num={
                  <>
                    <Var>N</Var> <Op>·</Op> <Sub base="V" sub="g" />
                  </>
                }
                den={<Var>φ</Var>}
              />
            </EqBlock>
            <EqBlock caption="slack fill (headspace fraction)">
              <Fn>slack</Fn>
              <Op>=</Op>
              <Frac
                num={
                  <>
                    <Sub base="V" sub="total" /> <Op>−</Op>{" "}
                    <Sub base="V" sub="bulk" />
                  </>
                }
                den={<Sub base="V" sub="total" />}
              />
              <Op>·</Op> 100%
            </EqBlock>
          </div>

          <div className="surface-inset p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck
                className="h-4 w-4 text-emerald-600"
                aria-hidden="true"
              />
              <p className="eyebrow">Where the model is valid</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-600">
            Validated across its trained envelope. Well outside that box the
            results panel simply notes an <strong>extrapolation</strong>.
            </p>
            <dl className="mt-3 space-y-2 text-xs">
              <Range
                label="λ (gummies across)"
                value={`${VALID_LAMBDA[0]} – ${VALID_LAMBDA[1]}`}
                note={`full-bottle proof ${VALIDATED_BOTTLE_LAMBDA[0]}–${VALIDATED_BOTTLE_LAMBDA[1]}`}
              />
              <Range
                label="EC gummy height"
                value={`${FAMILY_H_RANGE.EC[0]} – ${FAMILY_H_RANGE.EC[1]} mm`}
              />
              <Range
                label="DoryNew gummy height"
                value={`${FAMILY_H_RANGE.DoryNew[0]} – ${FAMILY_H_RANGE.DoryNew[1]} mm`}
              />
              <Range
                label="Bottle shape"
                value="straight cylindrical body"
                note="squat jars excluded"
              />
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

function Range({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink-100 pb-2">
      <dt className="text-ink-600">{label}</dt>
      <dd className="text-right">
        <span className="font-semibold tabular-nums text-ink-900">{value}</span>
        {note && <span className="ml-2 text-[10px] text-ink-400">{note}</span>}
      </dd>
    </div>
  );
}

// Tiny dependency-free math renderer. Enough to typeset the handful of
// equations above crisply (fractions, sub/superscripts, Greek via unicode)
// without pulling in KaTeX/MathJax. Everything is inline-flex so baselines and
// fraction bars line up regardless of surrounding text size.
function EqBlock({
  children,
  caption,
}: {
  children: React.ReactNode;
  caption?: string;
}) {
  return (
    <figure className="mt-3">
      <div className="flex items-center overflow-x-auto rounded-lg border border-pg-blue-100 bg-white px-4 py-3">
        <span className="flex items-center font-serif text-[15px] italic text-ink-900">
          {children}
        </span>
      </div>
      {caption && (
        <figcaption className="mt-1 text-[10px] uppercase tracking-[0.08em] text-ink-400">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function Frac({
  num,
  den,
}: {
  num: React.ReactNode;
  den: React.ReactNode;
}) {
  return (
    <span className="mx-1.5 inline-flex flex-col items-center text-center align-middle text-[13px] leading-tight">
      <span className="px-1.5 pb-0.5">{num}</span>
      <span className="w-full border-t border-ink-400 px-1.5 pt-0.5">{den}</span>
    </span>
  );
}

function Sub({ base, sub }: { base: React.ReactNode; sub: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline">
      {base}
      <sub className="ml-[1px] text-[0.62em] not-italic text-ink-500">{sub}</sub>
    </span>
  );
}

function Var({ children }: { children: React.ReactNode }) {
  return <span className="italic">{children}</span>;
}

function Fn({ children }: { children: React.ReactNode }) {
  return <span className="not-italic font-medium">{children}</span>;
}

function Op({ children }: { children: React.ReactNode }) {
  return <span className="mx-1.5 not-italic text-ink-500">{children}</span>;
}

function Paren({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center">
      <span className="text-ink-400">(</span>
      <span className="px-0.5">{children}</span>
      <span className="text-ink-400">)</span>
    </span>
  );
}
