import type { CalorieMethod } from "../../types/inputs";

// Methods A, D, E, F are recognized but not implemented in v1. They are surfaced as
// explicit "not implemented" rather than silently producing a wrong number.

export interface StubResult {
  method: CalorieMethod;
  notImplemented: true;
}

export function caloriesStub(method: CalorieMethod): StubResult {
  return { method, notImplemented: true };
}
