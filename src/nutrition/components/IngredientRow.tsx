import { useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Completeness, Ingredient, NutrientId } from "../index";
import { NUTRIENTS } from "../config/nutrients";
import { TRACKED_NUTRIENT_IDS } from "../data/exampleProduct";
import CompletenessBadge from "./CompletenessBadge";

// One editable recipe line. Collapsed: name · %w/w · completeness badge. Expanded: rename,
// per-100 g supplier calories (Method D input), and the per-100 g nutrient grid the engine
// declares — plus remove. All edits flow up to the CalcRequest; this row owns only the
// open/closed UI state.

type Props = {
  ingredient: Ingredient;
  /** Stored as a fraction 0..1; displayed as a percent. */
  percentWW: number;
  completeness: Completeness;
  canRemove: boolean;
  onPercentChange: (fraction: number) => void;
  onCycleCompleteness: () => void;
  onRename: (name: string) => void;
  onNutrientChange: (nutrientId: NutrientId, per100g: number) => void;
  onCaloriesChange: (kcal: number) => void;
  onRemove: () => void;
};

/** Select-all on focus so typing replaces the controlled value instead of fighting the 0. */
const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select();

export default function IngredientRow({
  ingredient,
  percentWW,
  completeness,
  canRemove,
  onPercentChange,
  onCycleCompleteness,
  onRename,
  onNutrientChange,
  onCaloriesChange,
  onRemove,
}: Props) {
  const [open, setOpen] = useState(false);

  // Display the percent rounded for readability; the exact stored fraction is preserved
  // unless the user actually edits (keeps Excel parity for untouched lines).
  const displayPercent = Number((percentWW * 100).toFixed(4));

  const handlePercent = (raw: string) => {
    const next = Number(raw);
    if (Number.isFinite(next)) onPercentChange(next / 100);
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
          className="block w-full truncate text-left text-[13px] font-medium text-ink-700 hover:text-ink-900"
        >
          {ingredient.name}
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
        <CompletenessBadge completeness={completeness} onCycle={onCycleCompleteness} />
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

              {/* Supplier calories (Method D input) */}
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

              {/* Remove */}
              <button
                type="button"
                onClick={onRemove}
                disabled={!canRemove}
                className="btn-ghost mt-3 w-full justify-center text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                title={canRemove ? "Remove this ingredient" : "A formula needs at least one ingredient"}
              >
                <Trash2 className="h-4 w-4" />
                Remove ingredient
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
