import { useState } from "react";
import { ChevronDown, Trash2, Save, Check, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Ingredient, NutrientId } from "../index";
import { NUTRIENTS } from "../config/nutrients";
import { TRACKED_NUTRIENT_IDS } from "../data/exampleProduct";

// One editable recipe line. Collapsed: name · %w/w · remove. Expanded: rename,
// per-100 g supplier calories (US Rules column, reference only), and the per-100 g nutrient grid the engine
// declares. All edits flow up to the CalcRequest; this row owns only the
// open/closed UI state.

type Props = {
  ingredient: Ingredient;
  /** Stored as a fraction 0..1; displayed as a percent. */
  percentWW: number;
  canRemove: boolean;
  onPercentChange: (fraction: number) => void;
  onRename: (name: string) => void;
  onNutrientChange: (nutrientId: NutrientId, per100g: number) => void;
  onCaloriesChange: (kcal: number) => void;
  onRemove: () => void;
  /** Persists this ingredient's current fields to the shared ingredient library (server-backed). */
  onSaveToLibrary: () => Promise<void>;
};

/** Select-all on focus so typing replaces the controlled value instead of fighting the 0. */
const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select();

export default function IngredientRow({
  ingredient,
  percentWW,
  canRemove,
  onPercentChange,
  onRename,
  onNutrientChange,
  onCaloriesChange,
  onRemove,
  onSaveToLibrary,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Display the percent rounded for readability; the exact stored fraction is preserved
  // unless the user actually edits (keeps Excel parity for untouched lines).
  const displayPercent = Number((percentWW * 100).toFixed(4));

  const handlePercent = (raw: string) => {
    const next = Number(raw);
    if (Number.isFinite(next)) onPercentChange(next / 100);
  };

  const handleSave = async () => {
    setSaveState("saving");
    setSaveError(null);
    try {
      await onSaveToLibrary();
      setSaveState("saved");
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 2500);
    } catch (err) {
      setSaveState("error");
      setSaveError(err instanceof Error ? err.message : "Failed to save.");
    }
  };

  // Current per-100 g value for a nutrient (0 if the ingredient doesn't list it).
  const valueOf = (id: NutrientId): number =>
    ingredient.nutrients.find((n) => n.nutrientId === id)?.per100g ?? 0;


  return (
    <div className="rounded-lg border border-ink-100 bg-white">
      {/* Collapsed header */}
      <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 px-2.5 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${ingredient.name} details`}
          className="flex h-6 w-6 items-center justify-center rounded text-ink-400 hover:bg-ink-50 hover:text-ink-600"
        >
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          title={ingredient.name}
          className="block w-full min-w-0 text-left"
        >
          <span className="block truncate text-[13px] font-medium text-ink-700 hover:text-ink-900">
            {ingredient.name}
          </span>
          {(ingredient.cas || ingredient.gcas) && (
            <span className="block truncate font-mono text-[10px] text-ink-400">
              {ingredient.cas && <>CAS {ingredient.cas}</>}
              {ingredient.cas && ingredient.gcas && " · "}
              {ingredient.gcas && <>GCAS {ingredient.gcas}</>}
            </span>
          )}
        </button>
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="decimal"
            step={0.0001}
            min={0}
            max={100}
            value={displayPercent}
            onFocus={selectOnFocus}
            onChange={(e) => handlePercent(e.target.value)}
            aria-label={`${ingredient.name} percent by weight`}
            className="number-input w-[72px] py-1.5 text-right text-xs"
          />
          <span className="font-mono text-[10px] text-ink-400">%</span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Remove ${ingredient.name}`}
          title={canRemove ? "Remove this ingredient" : "A formula needs at least one ingredient"}
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Expanded editor */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-ink-100 px-2.5 py-3">
              {/* Name */}
              <label className="field-label" htmlFor={`name-${ingredient.id}`}>
                Ingredient name
              </label>
              <input
                id={`name-${ingredient.id}`}
                type="text"
                value={ingredient.name}
                onChange={(e) => onRename(e.target.value)}
                className="number-input w-full py-1.5 text-left text-[13px]"
              />

              {/* Save this ingredient (name + calories + per-100 g nutrients below) to the
                  shared ingredient library, so it shows up in "Add from library" next time. */}
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveState === "saving" || !ingredient.name.trim()}
                  className="btn-ghost flex-shrink-0 justify-center py-1.5 text-[12px]"
                >
                  {saveState === "saved" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Save to library"}
                </button>
                {saveState === "error" && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-rose-600">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {saveError}
                  </span>
                )}
              </div>

              {/* Supplier identity (read-only, from the Ingredients library / Excel tab) */}
              {(ingredient.tradeName || ingredient.cas || ingredient.gcas) && (
                <dl className="mt-2 space-y-0.5 rounded-md bg-ink-50 px-2 py-1.5">
                  {ingredient.tradeName && (
                    <div className="flex gap-2 text-[11px]">
                      <dt className="shrink-0 text-ink-400">Trade name</dt>
                      <dd className="truncate text-ink-600" title={ingredient.tradeName}>
                        {ingredient.tradeName}
                      </dd>
                    </div>
                  )}
                  {ingredient.cas && (
                    <div className="flex gap-2 text-[11px]">
                      <dt className="shrink-0 text-ink-400">CAS</dt>
                      <dd className="font-mono text-ink-600">{ingredient.cas}</dd>
                    </div>
                  )}
                  {ingredient.gcas && (
                    <div className="flex gap-2 text-[11px]">
                      <dt className="shrink-0 text-ink-400">GCAS</dt>
                      <dd className="font-mono text-ink-600">{ingredient.gcas}</dd>
                    </div>
                  )}
                </dl>
              )}

              {/* Supplier calories (US Rules column, reference only) */}
              <div className="mt-3 flex items-center justify-between gap-2">
                <label className="field-label mb-0" htmlFor={`kcal-${ingredient.id}`}>
                  Calories / 100 g
                  <span className="ml-1 font-normal text-ink-400">(US Rules)</span>
                </label>
                <input
                  id={`kcal-${ingredient.id}`}
                  type="number"
                  inputMode="decimal"
                  step={0.01}
                  min={0}
                  value={ingredient.caloriesPer100g ?? 0}
                  onFocus={selectOnFocus}
                  onChange={(e) => onCaloriesChange(Number(e.target.value) || 0)}
                  className="number-input w-[88px] py-1.5 text-right text-xs"
                />
              </div>

              {/* Per-100 g nutrient grid */}
              <p className="field-label mt-3">Per 100 g nutrient content</p>
              <div className="grid grid-cols-1 gap-1">
                {TRACKED_NUTRIENT_IDS.map((id) => {
                  const meta = NUTRIENTS[id];
                  return (
                    <label
                      key={id}
                      htmlFor={`nut-${ingredient.id}-${id}`}
                      className="grid grid-cols-[1fr_auto] items-center gap-2 rounded px-1.5 py-0.5 hover:bg-ink-50"
                    >
                      <span className="truncate text-[12px] text-ink-600" title={meta.displayName}>
                        {meta.displayName}
                      </span>
                      <span className="flex items-center gap-1">
                        <input
                          id={`nut-${ingredient.id}-${id}`}
                          type="number"
                          inputMode="decimal"
                          step={0.01}
                          min={0}
                          value={valueOf(id)}
                          onFocus={selectOnFocus}
                          onChange={(e) => onNutrientChange(id, Number(e.target.value) || 0)}
                          className="number-input w-[84px] py-1 text-right text-xs"
                        />
                        <span className="w-14 font-mono text-[10px] text-ink-400">{meta.unit}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
