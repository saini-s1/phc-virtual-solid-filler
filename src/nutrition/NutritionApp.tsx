import { useMemo, useRef, useState } from "react";
import { Apple } from "lucide-react";
import Header from "../shared/Header";
import RecipeInputPanel from "./components/RecipeInputPanel";
import NutritionFactsLabel from "./components/NutritionFactsLabel";
import NutritionOutputPanel from "./components/NutritionOutputPanel";
import NutritionWorksheet from "./components/NutritionWorksheet";
import NutritionTutorial from "./components/NutritionTutorial";
import { calcNutritionPanel } from "./index";
import type { CalcRequest, CalorieMethod, Completeness, Ingredient, NutrientId } from "./index";
import { exampleProduct, blankProduct, makeBlankIngredient } from "./data/exampleProduct";

type Props = {
  onBack: () => void;
};

/** Which starting formulation is loaded into the editor. */
export type PresetId = "irovy-orange" | "blank";

/** Insert or update one nutrient's per-100 g value on an ingredient (preserves completeness). */
function upsertNutrient(ing: Ingredient, nutrientId: NutrientId, per100g: number): Ingredient {
  const existing = ing.nutrients.find((n) => n.nutrientId === nutrientId);
  const nutrients = existing
    ? ing.nutrients.map((n) => (n.nutrientId === nutrientId ? { ...n, per100g } : n))
    : [...ing.nutrients, { nutrientId, per100g, completeness: "known" as const }];
  return { ...ing, nutrients };
}

// MODULE_02 — PHC Nutrition Calculator. This shell holds the editable CalcRequest and
// hands the structured CalcResponse to pure-render panels. ALL nutrient math lives in
// the engine (src/nutrition); nothing here computes amounts, rounds, or formats values.

/** Completeness cycle for the demo: known → zero confirmed → unknown → back. */
const NEXT_COMPLETENESS: Record<Completeness, Completeness> = {
  known: "zeroConfirmed",
  zeroConfirmed: "unknown",
  unknown: "known",
};

/** Collapse one ingredient's per-nutrient completeness to a single row status. */
function aggregateCompleteness(ing: Ingredient): Completeness {
  if (ing.nutrients.some((n) => n.completeness === "unknown")) return "unknown";
  if (ing.nutrients.length > 0 && ing.nutrients.every((n) => n.completeness === "zeroConfirmed")) {
    return "zeroConfirmed";
  }
  return "known";
}

export default function NutritionApp({ onBack }: Props) {
  const [preset, setPreset] = useState<PresetId>("irovy-orange");
  const [request, setRequest] = useState<CalcRequest>(() => structuredClone(exampleProduct));
  const [runId, setRunId] = useState(0);
  const newIdSeq = useRef(0);

  // Single source of truth: the engine recomputes whenever the request changes.
  const response = useMemo(() => calcNutritionPanel(request), [request]);

  const handleLoadPreset = (id: PresetId) => {
    setPreset(id);
    setRequest(structuredClone(id === "blank" ? blankProduct : exampleProduct));
    setRunId((n) => n + 1);
  };

  const handleServingChange = (g: number) =>
    setRequest((prev) => ({ ...prev, servingWeightG: g }));

  // Optional label-only field: undefined leaves the "X" placeholder on the label.
  const handleServingsPerContainerChange = (count: number | undefined) =>
    setRequest((prev) => ({ ...prev, servingsPerContainer: count }));

  const handleMethodChange = (m: CalorieMethod) =>
    setRequest((prev) => ({ ...prev, calorieMethod: m }));

  const handlePercentChange = (ingredientId: string, fraction: number) =>
    setRequest((prev) => ({
      ...prev,
      recipe: prev.recipe.map((line) =>
        line.ingredientId === ingredientId ? { ...line, percentWW: fraction } : line,
      ),
    }));

  // Cycle every nutrient of the ingredient to one uniform state — driving the
  // INGREDIENT_INCOMPLETE block on/off reversibly without touching the underlying
  // per-100g values (so parity is preserved when cycled back to a known state).
  const handleCycleCompleteness = (ingredientId: string) =>
    setRequest((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing) => {
        if (ing.id !== ingredientId) return ing;
        const next = NEXT_COMPLETENESS[aggregateCompleteness(ing)];
        return { ...ing, nutrients: ing.nutrients.map((n) => ({ ...n, completeness: next })) };
      }),
    }));

  const handleAddIngredient = () =>
    setRequest((prev) => {
      const id = `custom-${Date.now()}-${(newIdSeq.current += 1)}`;
      return {
        ...prev,
        ingredients: [...prev.ingredients, makeBlankIngredient(id, "New ingredient")],
        recipe: [...prev.recipe, { ingredientId: id, percentWW: 0 }],
      };
    });

  const handleRemoveIngredient = (ingredientId: string) =>
    setRequest((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((ing) => ing.id !== ingredientId),
      recipe: prev.recipe.filter((line) => line.ingredientId !== ingredientId),
    }));

  const handleRenameIngredient = (ingredientId: string, name: string) =>
    setRequest((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing) =>
        ing.id === ingredientId ? { ...ing, name } : ing,
      ),
    }));

  const handleNutrientChange = (ingredientId: string, nutrientId: NutrientId, per100g: number) =>
    setRequest((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing) =>
        ing.id === ingredientId ? upsertNutrient(ing, nutrientId, per100g) : ing,
      ),
    }));

  const handleCaloriesChange = (ingredientId: string, kcal: number) =>
    setRequest((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing) =>
        ing.id === ingredientId ? { ...ing, caloriesPer100g: kcal } : ing,
      ),
    }));

  const handleRun = () => setRunId((n) => n + 1);

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        moduleTag="MODULE_02"
        title="PHC Nutrition Calculator"
        subtitle="Formulation → FDA Supplement Facts panel"
        icon={<Apple className="h-[18px] w-[18px]" />}
        onBack={onBack}
      />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-6">
        {/* Hero: formulation inputs (left) · Nutrition Facts label + compliance summary (center) */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-center">
          <div className="w-full lg:w-[460px] lg:flex-shrink-0">
            <RecipeInputPanel
              request={request}
              panel={response.panel}
              preset={preset}
              onLoadPreset={handleLoadPreset}
              onServingChange={handleServingChange}
              onServingsPerContainerChange={handleServingsPerContainerChange}
              onMethodChange={handleMethodChange}
              onPercentChange={handlePercentChange}
              onCycleCompleteness={handleCycleCompleteness}
              onAddIngredient={handleAddIngredient}
              onRemoveIngredient={handleRemoveIngredient}
              onRenameIngredient={handleRenameIngredient}
              onNutrientChange={handleNutrientChange}
              onCaloriesChange={handleCaloriesChange}
              onRun={handleRun}
            />
          </div>
          <div className="flex w-full flex-col gap-5 lg:max-w-[600px]">
            <NutritionFactsLabel
              response={response}
              onMethodChange={handleMethodChange}
              runId={runId}
            />
            <NutritionOutputPanel response={response} />
          </div>
        </div>

        {/* Below-fold: the Excel "Nutrition tab" worksheet — totals → DV → %DV → declared by class */}
        <div className="mt-5">
          <NutritionWorksheet response={response} />
        </div>

        {/* Below-fold tutorial — scroll-down background on every number above */}
        <div className="mt-5">
          <NutritionTutorial />
        </div>
      </main>
    </div>
  );
}
