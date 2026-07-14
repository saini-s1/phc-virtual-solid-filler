import type { LibraryIngredient } from "./ingredientLibrary";

// Thin client for the custom ingredient library API (server/index.js). Same-origin
// fetches only — in Azure App Service the Express server serves both the SPA and
// /api/*; locally the Vite dev-server proxy (vite.config.ts) forwards /api to the
// Express process started by `npm run server` / `npm run dev:full`.

export interface SaveIngredientPayload {
  name: string;
  tradeName?: string;
  cas?: string;
  gcas?: string;
  caloriesPer100g: number;
  per100g: Partial<Record<string, number>>;
}

export class IngredientApiError extends Error {
  details?: string[];
  constructor(message: string, details?: string[]) {
    super(message);
    this.name = "IngredientApiError";
    this.details = details;
  }
}

/** Fetches every custom ingredient other users/sessions have saved to the shared library. */
export async function fetchCustomIngredients(): Promise<LibraryIngredient[]> {
  const res = await fetch("/api/ingredients");
  if (!res.ok) throw new IngredientApiError("Failed to load the saved ingredient library.");
  return res.json();
}

/** Saves a new ingredient to the shared library. Throws IngredientApiError on failure. */
export async function saveIngredientToLibrary(
  payload: SaveIngredientPayload,
): Promise<LibraryIngredient> {
  const res = await fetch("/api/ingredients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new IngredientApiError(body.error || "Failed to save the ingredient.", body.details);
  }
  return res.json();
}

/**
 * Permanently deletes a custom ingredient from the shared library. Only ever call this with
 * the id of something previously returned by saveIngredientToLibrary/fetchCustomIngredients —
 * there is no way (and no need) to delete the 16 built-in template ingredients this way.
 */
export async function deleteCustomIngredient(id: string): Promise<void> {
  const res = await fetch(`/api/ingredients/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    const body = await res.json().catch(() => ({}));
    throw new IngredientApiError(body.error || "Failed to delete the ingredient.");
  }
}

