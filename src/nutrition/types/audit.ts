import type { NutrientId } from "./nutrients";
import type { CalorieMethod } from "./inputs";

// Append-only, structured audit trail (OH-222 expectation).

export type AuditKind =
  | "input"
  | "transform"
  | "rounding"
  | "class"
  | "override"
  | "correction"
  | "finding"
  | "block";

export interface AuditEntry {
  /** Monotonic sequence number; entries are append-only and never reordered. */
  seq: number;
  kind: AuditKind;
  step: string;
  nutrientId?: NutrientId;
  detail: string;
  citation?: string;
}

export interface AuditTrail {
  inputsHash: string;
  calorieMethod: CalorieMethod;
  region: string;
  entries: AuditEntry[];
}
