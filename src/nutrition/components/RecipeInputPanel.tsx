import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, FlaskConical, Plus, Sigma, Info, ChevronDown } from "lucide-react";
import type {
  CalcRequest,
  CalorieMethod,
  Completeness,
  Ingredient,
  NutrientId,
  NutritionPanel,
} from "../index";
import { NUTRIENTS } from "../config/nutrients";
import { INGREDIENT_LIBRARY } from "../data/ingredientLibrary";
import type { PresetId } from "../NutritionApp";
import IngredientRow from "./IngredientRow";
import CalorieMethodToggle from "./CalorieMethodToggle";

// Concise calorie-method reference shown in the "What's this?" popover — what each method
// is and when to reach for it. The engine's citations remain the source of truth.
const CALORIE_METHODS: { id: CalorieMethod; name: string; desc: string; when: string }[] = [
  {
    id: "C+",
    name: "Fiber-adjusted (soluble split)",
    desc: "Removes non-digestible fiber from the carb base and credits soluble fiber at 2 kcal/g.",
    when: "Default. The value the source workbook declares; needs a soluble/insoluble split.",
  },
  {
    id: "C",
    name: "Fiber-adjusted (total fiber)",
    desc: "Removes non-digestible fiber from the carb base and credits total dietary fiber at 2 kcal/g.",
    when: "Use when no soluble/insoluble split is available.",
  },
  {
    id: "B",
    name: "Legacy Atwater 4/4/9",
    desc: "4 kcal/g protein and carb, 9 kcal/g fat. Fiber counts as carb.",
    when: "A quick, general-purpose cross-check.",
  },
];

// LEFT panel — formulation inputs that feed the calc engine. No nutrient math here;
// it only edits the CalcRequest and hands changes up to the orchestrator. The "Formulation
// totals" strip echoes the engine's summed amounts (Excel Formulation row 8) — read-only.

type Props = {
  request: CalcRequest;
  /** Engine response (null while the formulation is blocked) — used for the read-only totals. */
  panel: NutritionPanel | null;
  preset: PresetId;
  onLoadPreset: (id: PresetId) => void;
  onServingChange: (g: number) => void;
  onServingsPerContainerChange: (count: number | undefined) => void;
  onMethodChange: (m: CalorieMethod) => void;
  onPercentChange: (ingredientId: string, fraction: number) => void;
  onCycleCompleteness: (ingredientId: string) => void;
  onAddIngredient: () => void;
  onAddFromLibrary: (libId: string) => void;
  onRemoveIngredient: (ingredientId: string) => void;
  onRenameIngredient: (ingredientId: string, name: string) => void;
  onNutrientChange: (ingredientId: string, nutrientId: NutrientId, per100g: number) => void;
  onCaloriesChange: (ingredientId: string, kcal: number) => void;
  onRun: () => void;
  /** Optional second dose column controls. */
  secondDoseEnabled: boolean;
  secondDoseWeightG: number;
  onToggleSecondDose: (on: boolean) => void;
  onSecondDoseWeightChange: (g: number) => void;
};

/** Compact number formatting for the read-only totals strip. */
function fmtTotal(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

/** Aggregate one ingredient's per-nutrient completeness into a single row status. */
function aggregateCompleteness(ing: Ingredient): Completeness {
  if (ing.nutrients.some((n) => n.completeness === "unknown")) return "unknown";
  if (ing.nutrients.length > 0 && ing.nutrients.every((n) => n.completeness === "zeroConfirmed")) {
    return "zeroConfirmed";
  }
  return "known";
}

export default function RecipeInputPanel({
  request,
  panel,
  preset,
  onLoadPreset,
  onServingChange,
  onServingsPerContainerChange,
  onMethodChange,
  onPercentChange,
  onCycleCompleteness,
  onAddIngredient,
  onAddFromLibrary,
  onRemoveIngredient,
  onRenameIngredient,
  onNutrientChange,
  onCaloriesChange,
  onRun,
  secondDoseEnabled,
  secondDoseWeightG,
  onToggleSecondDose,
  onSecondDoseWeightChange,
}: Props) {
  const [methodInfoOpen, setMethodInfoOpen] = useState(false);
  const [totalsOpen, setTotalsOpen] = useState(false);
  const byId = new Map(request.ingredients.map((i) => [i.id, i]));
  const percentSum = request.recipe.reduce((acc, line) => acc + line.percentWW, 0);
  const sumBalanced = Math.abs(percentSum - 1) <= 0.01;

  return (
    <section
      className="surface flex animate-fade-up flex-col gap-6 p-6 [animation-delay:40ms]"
      aria-labelledby="recipe-inputs"
    >
      <header className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Inputs</p>
          <h2 id="recipe-inputs" className="mt-1 text-lg font-bold text-ink-900">
            Formulation
          </h2>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-100 bg-ink-50 text-pg-cyan-600">
          <Sparkles className="h-4 w-4" />
        </span>
      </header>

      {/* Setup — starting point, dose, servings, calorie method, second dose (compact) */}
      <div className="surface-inset flex flex-col gap-3 rounded-xl border border-ink-100 p-3.5">
        <div>
          <label htmlFor="product-preset" className="field-label">
            Starting point
          </label>
          <div className="relative">
            <select
              id="product-preset"
              className="select-input pr-9"
              value={preset}
              onChange={(e) => onLoadPreset(e.target.value as PresetId)}
            >
              <option value="irovy-orange">Irovy Orange · example</option>
              <option value="blank">Blank · build your own</option>
            </select>
            <FlaskConical className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="serving-size" className="field-label">
              Dose weight
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="serving-size"
                type="number"
                min={0.01}
                step={0.01}
                value={request.servingWeightG}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v > 0) onServingChange(v);
                }}
                onFocus={(e) => e.currentTarget.select()}
                className="number-input w-full text-right"
              />
              <span className="font-mono text-xs font-semibold text-ink-400">g</span>
            </div>
          </div>
          <div>
            <label htmlFor="servings-per-container" className="field-label">
              Servings / container
            </label>
            <input
              id="servings-per-container"
              type="number"
              min={1}
              step={1}
              value={request.servingsPerContainer ?? ""}
              placeholder="Optional"
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") {
                  onServingsPerContainerChange(undefined);
                  return;
                }
                const n = Math.floor(Number(v));
                if (Number.isFinite(n) && n >= 1) onServingsPerContainerChange(n);
              }}
              onFocus={(e) => e.currentTarget.select()}
              className="number-input w-full"
            />
          </div>
        </div>
        <input
          type="range"
          min={1}
          max={30}
          step={0.01}
          value={Math.min(request.servingWeightG, 30)}
          onChange={(e) => onServingChange(Number(e.target.value))}
          className="w-full"
          aria-label="Dose weight quick slider, 1 to 30 grams"
        />

        {/* Calorie method + info popover */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="field-label mb-0">Calorie method</span>
            <button
              type="button"
              onClick={() => setMethodInfoOpen((o) => !o)}
              aria-expanded={methodInfoOpen}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-pg-blue-600 hover:text-pg-blue-700"
            >
              <Info className="h-3.5 w-3.5" />
              {methodInfoOpen ? "Hide" : "What's this?"}
            </button>
          </div>
          <CalorieMethodToggle
            method={request.calorieMethod}
            onChange={onMethodChange}
            layoutGroup="input"
          />
          <AnimatePresence initial={false}>
            {methodInfoOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <ul className="mt-2 space-y-1 rounded-lg border border-ink-100 bg-white p-2">
                  {CALORIE_METHODS.map((m) => (
                    <li
                      key={m.id}
                      className={`rounded-md px-2 py-1.5 text-[12px] leading-snug ${
                        request.calorieMethod === m.id ? "bg-pg-blue-50" : ""
                      }`}
                    >
                      <span className="font-mono font-bold text-pg-blue-700">{m.id}</span>{" "}
                      <span className="font-semibold text-ink-800">{m.name}</span>
                      <span className="mt-0.5 block text-ink-500">{m.desc}</span>
                      <span className="block text-ink-400">
                        <span className="font-medium">When:</span> {m.when}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Second dose column — a second engine run at another serving weight */}
        <div className="border-t border-ink-100 pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="field-label mb-0">Second dose column</span>
            <button
              type="button"
              role="switch"
              aria-checked={secondDoseEnabled}
              aria-label="Show a second dose column on the label"
              onClick={() => onToggleSecondDose(!secondDoseEnabled)}
              className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                secondDoseEnabled ? "bg-pg-blue-600" : "bg-ink-200"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                  secondDoseEnabled ? "left-4" : "left-0.5"
                }`}
              />
            </button>
          </div>
          <AnimatePresence initial={false}>
            {secondDoseEnabled && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-2 flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={secondDoseWeightG}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v > 0) onSecondDoseWeightChange(v);
                    }}
                    onFocus={(e) => e.currentTarget.select()}
                    className="number-input w-24 text-right"
                    aria-label="Second dose weight in grams"
                  />
                  <span className="font-mono text-xs font-semibold text-ink-400">g</span>
                  <span className="ml-1 text-[12px] text-ink-400">second label column</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Ingredient table */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="field-label mb-0">Recipe · {request.recipe.length} ingredients</span>
          <span
            className={`pill border ${
              sumBalanced
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-300 bg-amber-50 text-amber-700"
            }`}
            title="Sum of %w/w across the formula"
          >
            Σ {(percentSum * 100).toFixed(2)}%
          </span>
        </div>
        <div className="flex max-h-[360px] flex-col gap-1.5 overflow-y-auto pr-1">
          {request.recipe.map((line) => {
            const ing = byId.get(line.ingredientId);
            if (!ing) return null;
            return (
              <IngredientRow
                key={line.ingredientId}
                ingredient={ing}
                percentWW={line.percentWW}
                completeness={aggregateCompleteness(ing)}
                canRemove={request.recipe.length > 1}
                onPercentChange={(frac) => onPercentChange(line.ingredientId, frac)}
                onCycleCompleteness={() => onCycleCompleteness(line.ingredientId)}
                onRename={(name) => onRenameIngredient(line.ingredientId, name)}
                onNutrientChange={(nid, v) => onNutrientChange(line.ingredientId, nid, v)}
                onCaloriesChange={(kcal) => onCaloriesChange(line.ingredientId, kcal)}
                onRemove={() => onRemoveIngredient(line.ingredientId)}
              />
            );
          })}
        </div>

        {/* Add ingredient — blank line, or pick a saved supplier ingredient */}
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={onAddIngredient}
            className="btn-ghost flex-shrink-0 justify-center"
          >
            <Plus className="h-4 w-4" />
            Add blank
          </button>
          <select
            aria-label="Add from ingredient library"
            className="select-input flex-1"
            value=""
            onChange={(e) => {
              if (e.target.value) onAddFromLibrary(e.target.value);
            }}
          >
            <option value="">Add from library ({INGREDIENT_LIBRARY.length} saved)…</option>
            {INGREDIENT_LIBRARY.map((lib) => (
              <option key={lib.id} value={lib.id}>
                {lib.name}
                {lib.gcas ? ` · GCAS ${lib.gcas}` : ""}
              </option>
            ))}
          </select>
        </div>
        {!sumBalanced && (
          <p className="mt-2 text-[12px] leading-relaxed text-amber-700">
            %w/w does not sum to 100%. The engine flags this; it never silently normalizes.
          </p>
        )}
      </div>

      {/* Formulation totals — collapsible; the engine's summed amounts (Excel row 8), read-only */}
      <div>
        <button
          type="button"
          onClick={() => setTotalsOpen((o) => !o)}
          aria-expanded={totalsOpen}
          className="flex w-full items-center justify-between rounded-lg border border-ink-100 bg-white px-3 py-2 text-left hover:bg-ink-50"
        >
          <span className="flex items-center gap-1.5">
            <Sigma className="h-3.5 w-3.5 text-pg-cyan-600" aria-hidden="true" />
            <span className="field-label mb-0">Formulation totals · per serving</span>
          </span>
          <motion.span animate={{ rotate: totalsOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="h-4 w-4 text-ink-400" />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {totalsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              {panel ? (
                <div className="mt-2 max-h-[260px] divide-y divide-ink-100 overflow-y-auto rounded-lg border border-ink-100 bg-white">
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-[13px] font-semibold text-ink-800">Calories</span>
                    <span className="font-mono text-[13px] tabular-nums text-ink-800">
                      {fmtTotal(panel.calories.unrounded)} <span className="text-ink-400">kcal</span>
                    </span>
                  </div>
                  {panel.nutrients.map((n) => (
                    <div key={n.nutrientId} className="flex items-center justify-between px-3 py-1.5">
                      <span className="text-[13px] text-ink-600">
                        {NUTRIENTS[n.nutrientId].displayName}
                      </span>
                      <span className="font-mono text-[13px] tabular-nums text-ink-700">
                        {fmtTotal(n.stages.raw)} <span className="text-ink-400">{n.unit}</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 rounded-lg border border-ink-100 bg-white px-3 py-2.5 text-[13px] text-ink-500">
                  Totals appear once the formulation resolves. Clear the blocking issue above.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button type="button" className="btn-primary" onClick={onRun}>
        <Sparkles className="h-4 w-4" />
        Recalculate panel
      </button>
    </section>
  );
}
