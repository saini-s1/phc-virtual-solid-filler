import { Sparkles, FlaskConical, Plus, Sigma } from "lucide-react";
import type {
  CalcRequest,
  CalorieMethod,
  Completeness,
  Ingredient,
  NutrientId,
  NutritionPanel,
} from "../index";
import { NUTRIENTS } from "../config/nutrients";
import type { PresetId } from "../NutritionApp";
import IngredientRow from "./IngredientRow";
import CalorieMethodToggle from "./CalorieMethodToggle";

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
  onRemoveIngredient: (ingredientId: string) => void;
  onRenameIngredient: (ingredientId: string, name: string) => void;
  onNutrientChange: (ingredientId: string, nutrientId: NutrientId, per100g: number) => void;
  onCaloriesChange: (ingredientId: string, kcal: number) => void;
  onRun: () => void;
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
  onRemoveIngredient,
  onRenameIngredient,
  onNutrientChange,
  onCaloriesChange,
  onRun,
}: Props) {
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

      {/* Starting point */}
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
            <option value="irovy-orange">Irovy Orange · Psyllium Fiber Powder (example)</option>
            <option value="blank">Start blank · build your own</option>
          </select>
          <FlaskConical className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
        </div>
        <p className="mt-1.5 text-[12px] text-ink-400">
          Load the Excel-derived example, or start blank and enter your own ingredients.
        </p>
      </div>

      {/* Serving size — typeable, with a slider for quick changes */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <label htmlFor="serving-size" className="field-label mb-0">
            Serving / dose weight
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
              className="number-input w-24 text-right"
              aria-describedby="serving-hint"
            />
            <span className="font-mono text-xs font-semibold text-ink-400">g</span>
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
          aria-label="Serving size quick slider, 1 to 30 grams"
        />
        <p id="serving-hint" className="mt-1 text-[12px] text-ink-400">
          Type any dose weight, or drag for quick changes (1–30 g). Scales every per-serving amount.
        </p>
      </div>

      {/* Servings per container — optional; blank shows "X" on the label */}
      <div>
        <label htmlFor="servings-per-container" className="field-label">
          Servings per container
        </label>
        <input
          id="servings-per-container"
          type="number"
          min={1}
          step={1}
          value={request.servingsPerContainer ?? ""}
          placeholder="X (optional)"
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
          aria-describedby="servings-hint"
        />
        <p id="servings-hint" className="mt-1.5 text-[12px] text-ink-400">
          Optional placeholder. The label shows “X” until you enter a count.
        </p>
      </div>

      {/* Calorie method */}
      <div>
        <span className="field-label">Calorie method</span>
        <CalorieMethodToggle method={request.calorieMethod} onChange={onMethodChange} layoutGroup="input" />
        <p className="mt-1.5 text-[12px] text-ink-400">
          Method D (US Rules) is the Excel-faithful default; B (legacy 4/4/9) and C (fiber-adjusted)
          are cited cross-checks.
        </p>
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
        <div className="flex max-h-[460px] flex-col gap-1.5 overflow-y-auto pr-1">
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
        <button
          type="button"
          onClick={onAddIngredient}
          className="btn-ghost mt-2 w-full justify-center"
        >
          <Plus className="h-4 w-4" />
          Add ingredient
        </button>
        {!sumBalanced && (
          <p className="mt-2 text-[12px] leading-relaxed text-amber-700">
            %w/w does not sum to 100%. The engine flags this; it never silently normalizes.
          </p>
        )}
      </div>

      {/* Formulation totals — the engine's summed amounts (Excel Formulation row 8), read-only */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <Sigma className="h-3.5 w-3.5 text-pg-cyan-600" aria-hidden="true" />
          <span className="field-label mb-0">Formulation totals · per serving</span>
        </div>
        {panel ? (
          <div className="max-h-[260px] divide-y divide-ink-100 overflow-y-auto rounded-lg border border-ink-100 bg-white">
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
          <p className="rounded-lg border border-ink-100 bg-white px-3 py-2.5 text-[13px] text-ink-500">
            Totals appear once the formulation resolves. Clear the blocking issue above.
          </p>
        )}
        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-400">
          Sum of every ingredient (% w/w × dose), straight from the engine. Each value shows in its
          native unit (g or mg) and feeds the label.
        </p>
      </div>

      <button type="button" className="btn-primary" onClick={onRun}>
        <Sparkles className="h-4 w-4" />
        Recalculate panel
      </button>
    </section>
  );
}
