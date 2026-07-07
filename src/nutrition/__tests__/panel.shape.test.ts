import { describe, it, expect } from "vitest";
import { calcNutritionPanel } from "../index";
import { exampleProduct } from "../data/exampleProduct";
import { US_REGION } from "../config/regions";
import type { NutrientResult } from "../types/results";

// CalcResponse must be PURE DATA: a renderer drops it into React / Streamlit / Power BI
// / Veeva unchanged. No formatting hints, no color tokens, no Tailwind classes. The only
// strings beyond regulatory declarations are citations/flags/messages.

// Keys the engine is allowed to expose on a nutrient result.
const ALLOWED_NUTRIENT_KEYS = new Set<keyof NutrientResult>([
  "nutrientId",
  "unit",
  "stages",
  "declaredAmountRounded",
  "pctDV",
  "pctDVRounded",
  "source",
  "complianceClass",
  "complianceFloorPct",
  "complianceCeilingPct",
  "meetsCompliance",
  "mandatory",
  "citations",
  "flags",
]);

// Substrings that would indicate UI/presentation leakage into the data contract.
const FORBIDDEN_KEY_HINTS = ["color", "class", "css", "style", "tailwind", "icon", "label", "display", "render", "theme"];

describe("panel.shape — pure-data contract", () => {
  const res = calcNutritionPanel(exampleProduct);
  const panel = res.panel!;

  it("is a single-column per-serving panel", () => {
    expect(panel.columnCount).toBe(1);
  });

  it("contains all 14 mandatory nutrients", () => {
    const ids = new Set(panel.nutrients.map((n) => n.nutrientId));
    for (const m of US_REGION.mandatoryNutrients) {
      expect(ids.has(m)).toBe(true);
    }
    expect(US_REGION.mandatoryNutrients.length).toBe(14);
  });

  it("exposes a non-empty prototype disclaimer", () => {
    expect(res.prototypeDisclaimer.length).toBeGreaterThan(0);
    expect(res.prototypeDisclaimer).toMatch(/PROTOTYPE/);
  });

  it("compliance is expressed as enum/boolean, never a color", () => {
    for (const n of panel.nutrients) {
      expect(["I", "II", "thirdGroup", "none"]).toContain(n.complianceClass);
      expect([true, false, null]).toContain(n.meetsCompliance);
    }
  });

  it("declaredAmountRounded is a number or a regulatory declaration string only", () => {
    for (const n of panel.nutrients) {
      const v = n.declaredAmountRounded;
      const ok = typeof v === "number" || v === "Less than 1 g" || v === "Less than 5 mg";
      expect(ok).toBe(true);
    }
  });

  it("leaks no UI/presentation fields on nutrient results", () => {
    for (const n of panel.nutrients) {
      for (const key of Object.keys(n)) {
        expect(ALLOWED_NUTRIENT_KEYS.has(key as keyof NutrientResult)).toBe(true);
        const lower = key.toLowerCase();
        for (const hint of FORBIDDEN_KEY_HINTS) {
          // "class" appears legitimately in complianceClass; allow that one.
          if (lower === "complianceclass" || lower === "complianceceilingpct" || lower === "compliancefloorpct") continue;
          expect(lower.includes(hint)).toBe(false);
        }
      }
    }
  });

  it("serializes to JSON without loss (transport-ready)", () => {
    const round = JSON.parse(JSON.stringify(res));
    expect(round.panel.calories.value).toBe(panel.calories.value);
    expect(round.status).toBe("ok");
  });
});
