import type { NutrientId } from "./nutrients";
import type { CalorieMethod } from "./inputs";

// Append-only audit trail. Written by the orchestrator as it runs, then attached to
// CalcResponse so a reviewer can trace every number back to an input or a regulation.
// Shape only — AuditBuilder (audit/audit.ts) is the implementation.
//
// OH-222 expectation: every transform, rounding step, compliance decision, and correction
// must produce at least one AuditEntry so nothing is silent.

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
