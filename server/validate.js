// Strict allow-list validation for a user-submitted custom ingredient. Nothing here is
// trusted from the client: every field is type/range checked and unknown keys are
// dropped rather than stored (avoids prototype pollution + keeps the Table Storage
// entity schema predictable). Mirrors the shape of LibraryIngredient
// (src/nutrition/data/ingredientLibrary.ts) but stays plain JS on the server.
import { NUTRIENT_IDS } from "./nutrientIds.js";

const NAME_MAX = 120;
const IDENTITY_MAX = 200;
const MAX_CALORIES = 2000; // per 100 g — generous ceiling, catches garbage input
const MAX_NUTRIENT_AMOUNT = 100000; // per 100 g, in the nutrient's native unit

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function cleanString(v, maxLen) {
  if (typeof v !== "string") return { ok: false };
  const trimmed = v.trim();
  if (trimmed.length === 0 || trimmed.length > maxLen) return { ok: false };
  return { ok: true, value: trimmed };
}

function cleanNumber(v, max) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) return { ok: false };
  return { ok: true, value: n };
}

/**
 * Validates an incoming POST /api/ingredients body.
 * Returns { ok: true, value: <sanitized ingredient> } or { ok: false, errors: string[] }.
 */
export function validateIngredientPayload(body) {
  const errors = [];
  if (!isPlainObject(body)) return { ok: false, errors: ["Request body must be a JSON object."] };

  const name = cleanString(body.name, NAME_MAX);
  if (!name.ok) errors.push(`"name" is required (1-${NAME_MAX} characters).`);

  const optionalIdentity = {};
  for (const key of ["tradeName", "cas", "gcas"]) {
    if (body[key] === undefined || body[key] === null || body[key] === "") continue;
    const cleaned = cleanString(body[key], IDENTITY_MAX);
    if (!cleaned.ok) {
      errors.push(`"${key}" must be a string up to ${IDENTITY_MAX} characters.`);
    } else {
      optionalIdentity[key] = cleaned.value;
    }
  }

  let caloriesPer100g = 0;
  if (body.caloriesPer100g !== undefined) {
    const cleaned = cleanNumber(body.caloriesPer100g, MAX_CALORIES);
    if (!cleaned.ok) errors.push(`"caloriesPer100g" must be a number between 0 and ${MAX_CALORIES}.`);
    else caloriesPer100g = cleaned.value;
  }

  const per100g = {};
  if (body.per100g !== undefined) {
    if (!isPlainObject(body.per100g)) {
      errors.push('"per100g" must be an object keyed by nutrient id.');
    } else {
      for (const [key, val] of Object.entries(body.per100g)) {
        if (!NUTRIENT_IDS.includes(key)) continue; // silently drop unknown nutrient ids
        const cleaned = cleanNumber(val, MAX_NUTRIENT_AMOUNT);
        if (!cleaned.ok) {
          errors.push(`"per100g.${key}" must be a number between 0 and ${MAX_NUTRIENT_AMOUNT}.`);
        } else {
          per100g[key] = cleaned.value;
        }
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name: name.value,
      ...optionalIdentity,
      caloriesPer100g,
      per100g,
    },
  };
}
