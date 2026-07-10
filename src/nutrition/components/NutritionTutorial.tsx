import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  ChevronDown,
  Flame,
  Layers,
  Ruler,
  ShieldCheck,
  Percent,
  FileSpreadsheet,
  Info,
  Scale,
} from "lucide-react";

// Below-fold "Learn" section — a scroll-down tutorial that gives the full background on
// every number the calculator produces. PURE STATIC CONTENT: it reads nothing from the
// engine and computes nothing; it explains the engine that the panels above already ran.
// Worked numbers are the verified Irovy Orange psyllium example (10.68 g dose, 30 servings).

type Topic = {
  id: string;
  icon: typeof Flame;
  eyebrow: string;
  title: string;
  body: React.ReactNode;
};

/** Citation chip — monospace, regulatory reference. */
function Cite({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-ink-50 px-1.5 py-0.5 font-mono text-[11px] text-ink-500">
      {children}
    </code>
  );
}

/** A compact equation / value line. */
function Calc({ children }: { children: React.ReactNode }) {
  return (
    <div className="surface-inset px-3 py-2 font-mono text-[12px] leading-relaxed text-ink-700">
      {children}
    </div>
  );
}

function MethodCard({
  badge,
  name,
  result,
  accent,
  children,
}: {
  badge: string;
  name: string;
  result: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-md font-mono text-sm font-bold text-white ${accent}`}
          >
            {badge}
          </span>
          <span className="text-[13px] font-semibold text-ink-800">{name}</span>
        </div>
        <span className="font-mono text-lg font-extrabold tabular-nums text-ink-900">{result}</span>
      </div>
      <div className="mt-2.5 flex flex-col gap-1.5 text-[12px] leading-relaxed text-ink-600">
        {children}
      </div>
    </div>
  );
}

const TOPICS: Topic[] = [
  {
    id: "overview",
    icon: Info,
    eyebrow: "Big picture",
    title: "What this calculator does",
    body: (
      <div className="flex flex-col gap-3 text-[13px] leading-relaxed text-ink-600">
        <p>
          You give it a <strong className="text-ink-800">formulation</strong> — the ingredients,
          each ingredient's nutrients per 100 g, how much of each is in the blend (% by weight), and
          the <strong className="text-ink-800">dose weight</strong> (grams per serving). It returns a
          Nutrition Facts panel for one serving.
        </p>
        <p>
          It follows one fixed path: add up each nutrient across the recipe, round it to the legal
          increment, work out the % Daily Value, and check it against its compliance limit. The
          label, the results panel, and the audit trail all read the same result.
        </p>
        <p className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-[12px] text-amber-900">
          <strong>Prototype.</strong> The logic follows the source Excel and 21 CFR 101.9. Treat the
          output as illustrative — confirm it in the controlled labeling system before any real use.
        </p>
      </div>
    ),
  },
  {
    id: "calories",
    icon: Flame,
    eyebrow: "The B / C / C+ question",
    title: "How calories are calculated, and why the methods disagree",
    body: (
      <div className="flex flex-col gap-3">
        <p className="text-[13px] leading-relaxed text-ink-600">
          21 CFR 101.9(c)(1)(i) allows several ways to compute calories. They use the{" "}
          <em>same</em> nutrient grams but credit them differently, so for a high-fiber product
          like psyllium they can land far apart. Here are the three this tool implements, run on the
          example serving (≈ 0.14 g protein, 9.48 g total carb, 5.48 g fiber of which 4.66 g
          soluble, 0 g fat):
        </p>

        <div className="grid gap-2.5 sm:grid-cols-3">
          <MethodCard badge="C+" name="Soluble split" result="25" accent="bg-pg-cyan-500">
            <p>
              Removes non-digestible fiber from the carb base, then credits{" "}
              <strong>soluble</strong> fiber at 2 cal/g. The value the workbook declares.
            </p>
            <Calc>4(0.14) + 4(9.48−5.48) + 2(4.66) = 25.9 → 25</Calc>
            <p className="text-ink-400">
              <Cite>101.9(c)(1)(i)(C)</Cite> · <strong className="text-ink-600">default</strong>
            </p>
          </MethodCard>

          <MethodCard badge="C" name="Total fiber" result="30" accent="bg-pg-blue-600">
            <p>
              Same idea, but credits <strong>total</strong> dietary fiber at 2 cal/g — used when no
              soluble/insoluble split is available.
            </p>
            <Calc>4(0.14) + 4(9.48−5.48) + 2(5.48) = 27.5 → 30</Calc>
            <p className="text-ink-400">
              <Cite>101.9(c)(1)(i)(C)</Cite>
            </p>
          </MethodCard>

          <MethodCard badge="B" name="Legacy 4/4/9" result="40" accent="bg-ink-500">
            <p>General factors: 4 cal/g protein &amp; carb, 9 cal/g fat. Fiber counts as carb.</p>
            <Calc>4(0.14) + 4(9.48) + 9(0) = 38.50 → 40</Calc>
            <p className="text-ink-400">
              <Cite>101.9(c)(1)(i)(B)</Cite>
            </p>
          </MethodCard>
        </div>

        <div className="rounded-lg border border-pg-blue-100 bg-pg-blue-50/50 px-3 py-2.5 text-[12px] leading-relaxed text-ink-700">
          <strong className="text-pg-blue-700">Why B = 40 but C+ = 25:</strong> psyllium is almost
          entirely fiber. Method B treats that carbohydrate at ≈ 4 cal/g; Methods C and C+ drop the
          non-digestible part from the carb calories and re-credit fiber at just 2 cal/g — C on the
          full ~5.5 g of fiber, C+ on the ~4.66 g that is soluble. The difference <em>is</em> the fiber.
        </div>
        <p className="text-[12px] leading-relaxed text-ink-500">
          We default to <strong>C+</strong> because it is the value the source Excel declares. C and
          B sit beside the Calories line as permitted cross-checks, so you can see all three at once.
        </p>
      </div>
    ),
  },
  {
    id: "pipeline",
    icon: Layers,
    eyebrow: "From recipe to declared",
    title: "The four-stage value pipeline",
    body: (
      <div className="flex flex-col gap-3">
        <p className="text-[13px] leading-relaxed text-ink-600">
          Every nutrient amount passes through four stages before it is rounded. % Daily Value and
          compliance read these stages; rounding happens only at the very end.
        </p>
        <ol className="flex flex-col gap-2">
          {[
            { k: "Raw", f: "recipe total", d: "Σ (ingredient per-100 g × dose) across the formula; the as-is content." },
            { k: "As-formulated", f: "raw × (1 − process loss)", d: "Subtracts manufacturing losses (e.g. heat- or shear-sensitive actives)." },
            { k: "As-declared", f: "as-formulated ÷ (1 + overage)", d: "Declares down when a formula carries overage, so the label is not overstated." },
            { k: "End-of-shelf-life", f: "as-formulated × (1 − decay)", d: "What remains at the end of shelf life after stability decay." },
          ].map((s, i) => (
            <li key={s.k} className="flex gap-3 rounded-lg border border-ink-100 bg-white px-3 py-2.5">
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-ink-100 font-mono text-[11px] font-bold text-ink-600">
                {i + 1}
              </span>
              <div>
                <p className="text-[13px] font-semibold text-ink-800">{s.k}</p>
                <code className="font-mono text-[11px] text-pg-blue-600">{s.f}</code>
                <p className="mt-0.5 text-[12px] leading-relaxed text-ink-500">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    ),
  },
  {
    id: "rounding",
    icon: Ruler,
    eyebrow: "Why 38.5 becomes 40",
    title: "Rounding to the legal increment",
    body: (
      <div className="flex flex-col gap-3">
        <p className="text-[13px] leading-relaxed text-ink-600">
          The label never shows raw decimals. Each quantity is rounded to a tier fixed by the
          regulation, replacing the Excel's human "Reco." judgment column with deterministic rules.
        </p>
        <div className="overflow-hidden rounded-lg border border-ink-100">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-ink-50 text-left text-ink-500">
                <th className="px-3 py-2 font-semibold">Quantity</th>
                <th className="px-3 py-2 font-semibold">Rule</th>
                <th className="px-3 py-2 font-semibold">Cite</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 text-ink-700">
              {[
                ["Calories", "< 5 → 0 · ≤ 50 → nearest 5 · > 50 → nearest 10", "(c)(1)"],
                ["Fat", "< 0.5 → 0 · < 5 → nearest 0.5 g · ≥ 5 → nearest 1 g", "(c)(2)"],
                ["Cholesterol", "< 2 → 0 · 2–5 → “Less than 5 mg” · > 5 → nearest 5 mg", "(c)(3)"],
                ["Sodium", "< 5 → 0 · ≤ 140 → nearest 5 · > 140 → nearest 10 mg", "(c)(4)"],
                ["Carb / fiber / sugars / protein", "< 0.5 → 0 · < 1 → “Less than 1 g” · ≥ 1 → nearest 1 g", "(c)(6),(7)"],
                ["% Daily Value", "≤ 10% → nearest 2 · ≤ 50% → nearest 5 · > 50% → nearest 10", "(c)(8)(iii)"],
                ["Vitamins / minerals", "2 significant figures", "(c)(8)(iii)"],
              ].map((r) => (
                <tr key={r[0]}>
                  <td className="px-3 py-2 font-medium text-ink-800">{r[0]}</td>
                  <td className="px-3 py-2 font-mono text-[11px] leading-relaxed">{r[1]}</td>
                  <td className="px-3 py-2">
                    <Cite>{r[2]}</Cite>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  {
    id: "compliance",
    icon: ShieldCheck,
    eyebrow: "Pass / fail bands",
    title: "Compliance classes",
    body: (
      <div className="flex flex-col gap-3">
        <p className="text-[13px] leading-relaxed text-ink-600">
          21 CFR 101.9(g) groups nutrients by how the measured value must relate to the label. The
          engine tags each nutrient with its class and whether the declared amount sits inside the
          band. (The Excel calls these "NLT 80% of Label" and "NMT 120% of Label", i.e. not-less-than
          and not-more-than.)
        </p>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {[
            { k: "Class I", band: "≥ 100%", who: "Added vitamins, minerals, protein, fiber", cite: "(g)(4)(i)", accent: "border-emerald-200 bg-emerald-50 text-emerald-700" },
            { k: "Class II", band: "≥ 80%", who: "Naturally-occurring nutrients", cite: "(g)(4)(ii)", accent: "border-pg-blue-200 bg-pg-blue-50 text-pg-blue-700" },
            { k: "Third group", band: "≤ 120%", who: "Calories, sugars, fat, sat fat, sodium, cholesterol", cite: "(g)(5)", accent: "border-amber-300 bg-amber-50 text-amber-700" },
          ].map((c) => (
            <div key={c.k} className={`rounded-xl border p-3 ${c.accent}`}>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold">{c.k}</span>
                <span className="font-mono text-sm font-extrabold">{c.band}</span>
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed opacity-90">{c.who}</p>
              <p className="mt-1.5 font-mono text-[10px] opacity-70">101.9{c.cite}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "overage",
    icon: Scale,
    eyebrow: "Internal standards mapping",
    title: "OH-234 (overage math) and OH-222 (label governance): what's wired, what isn't",
    body: (
      <div className="flex flex-col gap-3">
        <p className="text-[13px] leading-relaxed text-ink-600">
          Two P&amp;G PHC standards sit on top of 21 CFR. The short version:{" "}
          <strong className="text-ink-800">OH-234 is about the math; OH-222 is about the format and
          sign-off.</strong>
        </p>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-bold text-emerald-800">
              OH-234 · Overages <span className="font-mono font-normal opacity-70">VV-QUAL-2019440</span>
            </span>
            <span className="pill border border-emerald-300 bg-white text-emerald-700">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              Wired
            </span>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-emerald-900/90">
            The three compliance classes are enforced, and the label declares down from the
            formulated amount:
          </p>
          <Calc>as-declared = as-formulated ÷ (1 + overage)</Calc>
          <p className="mt-2 text-[12px] leading-relaxed text-emerald-900/90">
            Every floor (Class I/II) nutrient needs an explicit overage; a missing one hard-blocks
            the label (<Cite>OVERAGE_MISSING</Cite>) rather than being guessed. What's{" "}
            <strong>not</strong> done: deriving that overage from stability data{" "}
            <span className="font-mono">(ΔX + ΔY + CI·√Σσ²)</span> — it is taken as an input.
          </p>
        </div>

        <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-bold text-amber-800">
              OH-222 · Labeling content <span className="font-mono font-normal opacity-70">VV-QUAL-569949</span>
            </span>
            <span className="pill border border-amber-300 bg-white text-amber-700">
              <Info className="h-3 w-3" aria-hidden="true" />
              Content shown · sign-off not gated
            </span>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-amber-900/90">
            OH-222 is process only — no formulas. The engine surfaces the content it governs
            (serving info, ingredients, dosing, nutrient content) and rounds using the 21 CFR tables.
            What's <strong>not</strong> modeled is the approval wrapper: a Band-3 + Regulatory
            sign-off, version metadata, and the Enovia lock. The audit trail is traceability, not a
            formal e-signature gate.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "pctdv",
    icon: Percent,
    eyebrow: "The right-hand column",
    title: "% Daily Value",
    body: (
      <div className="flex flex-col gap-3">
        <p className="text-[13px] leading-relaxed text-ink-600">
          % Daily Value tells a shopper how much one serving contributes to a day's reference
          intake. It is simply the declared amount over the reference value:
        </p>
        <Calc>%DV = declared amount ÷ Daily Value × 100, then rounded</Calc>
        <p className="text-[13px] leading-relaxed text-ink-600">
          Reference values come straight from the FDA tables: DRVs for macros{" "}
          <Cite>101.9(c)(9)</Cite> and RDIs for vitamins &amp; minerals{" "}
          <Cite>101.9(c)(8)(iv)</Cite>. For example, Dietary Fiber's DV is 28 g, Sodium's is
          2,300 mg, Calcium's is 1,300 mg, and Vitamin D's is 20 mcg.
        </p>
      </div>
    ),
  },
  {
    id: "provenance",
    icon: FileSpreadsheet,
    eyebrow: "Trust & traceability",
    title: "The Excel is the moment of truth: here's everything we added, and why",
    body: (
      <div className="flex flex-col gap-3">
        <p className="text-[13px] leading-relaxed text-ink-600">
          Where the source workbook gives a number, we use it verbatim (the declared calorie value,
          every per-ingredient nutrient, the % w/w recipe). The few things the Excel{" "}
          <em>doesn't</em> provide were added only to make the label legal and reproducible, each
          with a reason:
        </p>
        <div className="overflow-hidden rounded-lg border border-ink-100">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-ink-50 text-left text-ink-500">
                <th className="px-3 py-2 font-semibold">What we added / changed</th>
                <th className="px-3 py-2 font-semibold">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 text-ink-700">
              <tr>
                <td className="px-3 py-2 font-medium text-ink-800">
                  Total Fat, Saturated Fat, Trans Fat, Cholesterol = 0
                </td>
                <td className="px-3 py-2 leading-relaxed">
                  The Excel's ingredient sheet has no columns for these, but 101.9(c)(2)–(3) makes
                  them mandatory. Psyllium powder genuinely contains ~0, so we declare a confirmed 0
                  rather than leaving the label incomplete.
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium text-ink-800">Vitamin D DV: 0.2 → 20 mcg</td>
                <td className="px-3 py-2 leading-relaxed">
                  The workbook carried a stale reference value; the current RDI is 20 mcg{" "}
                  <Cite>101.9(c)(8)(iv)</Cite>. We corrected it and logged the change in the audit
                  trail.
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium text-ink-800">Calorie cross-checks (C, B)</td>
                <td className="px-3 py-2 leading-relaxed">
                  The workbook declares C+ (soluble-fiber method). We also show C and B{" "}
                  <Cite>101.9(c)(1)(i)(B)/(C)</Cite> beside it as permitted cross-checks, so a
                  formulator can compare all three at once.
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium text-ink-800">Deterministic rounding tiers</td>
                <td className="px-3 py-2 leading-relaxed">
                  Replaces the Excel's manual "Reco." judgment column with the exact CFR increments,
                  so the same inputs always produce the same label.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
];

function TopicItem({
  topic,
  open,
  onToggle,
}: {
  topic: Topic;
  open: boolean;
  onToggle: () => void;
}) {
  const Icon = topic.icon;
  return (
    <div className="overflow-hidden rounded-xl border border-ink-100 bg-white/60">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-100 bg-ink-50 text-pg-blue-600">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="eyebrow">{topic.eyebrow}</p>
            <h3 className="mt-0.5 text-[15px] font-bold text-ink-900">{topic.title}</h3>
          </div>
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-5 w-5 flex-shrink-0 text-ink-400" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-ink-100 px-4 py-4">{topic.body}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function NutritionTutorial() {
  // Calories open by default — it answers the most common "what is B or C?" question.
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(["calories"]));

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section
      className="surface animate-fade-up p-6 [animation-delay:360ms]"
      aria-labelledby="tutorial-heading"
    >
      <header className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-100 bg-ink-50 text-pg-cyan-600">
          <GraduationCap className="h-4 w-4" />
        </span>
        <div>
          <p className="eyebrow">Learn · background</p>
          <h2 id="tutorial-heading" className="mt-1 text-lg font-bold text-ink-900">
            How this calculator works
          </h2>
        </div>
      </header>

      <p className="mb-4 max-w-2xl text-[13px] leading-relaxed text-ink-500">
        Expand any section for the full story behind the numbers above: what each calorie method
        means, how a recipe becomes a rounded FDA panel, and exactly where the Excel ends and our
        additions begin.
      </p>

      <div className="flex flex-col gap-2.5">
        {TOPICS.map((t) => (
          <TopicItem key={t.id} topic={t} open={openIds.has(t.id)} onToggle={() => toggle(t.id)} />
        ))}
      </div>
    </section>
  );
}
