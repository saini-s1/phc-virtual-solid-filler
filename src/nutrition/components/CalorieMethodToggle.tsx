import { motion } from "framer-motion";
import type { CalorieMethod } from "../index";

// Segmented C+ | C | B calorie-method control — the three methods the source workbook
// implements (21 CFR 101.9(c)(1)(i)). C+ (soluble fiber @ 2 kcal/g) is the workbook's declared
// value; C (total fiber @ 2 kcal/g) is used when no soluble split exists; B is legacy 4/4/9.
// Used both in the left input panel and beside the center Calories line (they share state).

type Props = {
  method: CalorieMethod;
  onChange: (m: CalorieMethod) => void;
  /** Unique id so multiple instances animate their own highlight pill. */
  layoutGroup: string;
  size?: "sm" | "md";
};

const ENABLED: { id: CalorieMethod; label: string; hint: string }[] = [
  { id: "C+", label: "C+", hint: "Soluble fiber @ 2 kcal/g (workbook declared)" },
  { id: "C", label: "C", hint: "Total fiber @ 2 kcal/g (no split)" },
  { id: "B", label: "B", hint: "Legacy 4/4/9" },
];

export default function CalorieMethodToggle({ method, onChange, layoutGroup, size = "md" }: Props) {
  const pad = size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs";

  return (
    <div className="flex items-center gap-2">
      <div
        role="radiogroup"
        aria-label="Calorie calculation method"
        className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-ink-50/70 p-1"
      >
        {ENABLED.map((m) => {
          const active = method === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(m.id)}
              title={`Method ${m.id} · ${m.hint}`}
              className={`relative rounded-md font-mono font-bold tracking-wide transition ${pad} ${
                active ? "text-white" : "text-ink-500 hover:text-ink-700"
              }`}
            >
              {active && (
                <motion.span
                  layoutId={`calorie-seg-${layoutGroup}`}
                  className="absolute inset-0 rounded-md bg-pg-blue-600 shadow-[0_6px_16px_-10px_rgba(38,73,234,0.8)]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10">{m.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
