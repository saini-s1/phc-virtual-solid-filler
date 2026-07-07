import type { CalorieMethod } from "../types/inputs";
import type { NutrientId } from "../types/nutrients";
import type { AuditEntry, AuditKind, AuditTrail } from "../types/audit";

// Append-only audit builder. Entries get a monotonic seq and are never reordered or
// mutated after `add`. `build()` returns a defensive copy so the trail can't be edited
// in place downstream.

export interface AuditAddOptions {
  nutrientId?: NutrientId;
  citation?: string;
}

export class AuditBuilder {
  private entries: AuditEntry[] = [];
  private seq = 0;

  constructor(
    private readonly inputsHash: string,
    private readonly calorieMethod: CalorieMethod,
    private readonly region: string,
  ) {}

  add(kind: AuditKind, step: string, detail: string, opts: AuditAddOptions = {}): void {
    this.entries.push({
      seq: this.seq++,
      kind,
      step,
      detail,
      nutrientId: opts.nutrientId,
      citation: opts.citation,
    });
  }

  build(): AuditTrail {
    return {
      inputsHash: this.inputsHash,
      calorieMethod: this.calorieMethod,
      region: this.region,
      entries: this.entries.map((e) => ({ ...e })),
    };
  }
}
