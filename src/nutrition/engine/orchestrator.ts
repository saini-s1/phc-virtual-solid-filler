import type { CalcRequest } from "../types/inputs";
import type { RegionConfig } from "../types/config";
import type {
  CalcResponse,
  NutrientResult,
  NutritionPanel,
} from "../types/results";
import type { NutrientId } from "../types/nutrients";

import { NUTRIENTS, NUTRIENT_ORDER, defaultSourceFor } from "../config/nutrients";
import { stableHash } from "../util/hash";
import { AuditBuilder } from "../audit/audit";
import { STALE_CONSTANT_CORRECTIONS } from "../corrections/staleConstants";
import { preflight } from "./preflight";
import { sumRecipe } from "./recipe";
import { computeCalories } from "./calories";
import { runStages } from "./pipeline";
import { dailyValueFor, percentDV } from "./percentDV";
import { classify, assessCompliance } from "../compliance/compliance";
import { roundByGroup } from "../rounding/rounding";

// What 21 CFR 101.36 explicitly cross-references from 101.9 (per live eCFR 7/01/2026):
//   • Rounding increments for all declared amounts: 101.36(b)(2)(ii)(A) → 101.9(c)(1)–(7)
//   • Zero-declaration threshold:                   101.36(b)(2)(i)    → 101.9(c)
//   • RDI / DRV values:                             101.36(b)(2)(iii)(B)→ 101.9(c)(8)(iv),(c)(9)
//   • Class I / II compliance floors:               101.36(f)(1)       → 101.9(g)(3),(g)(4)
// Calorie CALCULATION methods (A–F in 101.9(c)(1)(i)) are NOT explicitly named in 101.36.
// 101.36 governs rounding of the result; it does not define its own calculation formula.
// The engine uses Methods D/B/C from 101.9(c)(1)(i) as the only FDA-recognised calorie
// approaches for these ingredients — applied to supplements by regulatory implication and
// consistent with FDA guidance, since 101.36 provides no alternative calculation method.
export const PROTOTYPE_DISCLAIMER =
  "PROTOTYPE: surrogate calculation for evaluation only. " +
  "Panel framing: 21 CFR 101.36 (Supplement Facts). " +
  "Rounding increments, Daily Values, and Class I/II compliance: 101.9(c)(1)-(7), (c)(8)(iv), (c)(9), (g)(3)-(4) " +
  "as incorporated by reference in 101.36(b)(2)(ii)(A), (b)(2)(iii)(B), and (f)(1). " +
  "Calorie calculation methods D/B/C: 101.9(c)(1)(i)(D/B/C) applied to supplements by regulatory implication " +
  "(101.36 does not define its own calculation method; no FDA alternative exists). " +
  "NOT a validated regulatory label. Confirm against the controlled labeling system before any external use.";

// Supplement-panel disclosure note (replaces the old "Excel omitted mandatory nutrients"
// divergence). Under 21 CFR 101.36(b)(2)(i) a (b)(2)-dietary ingredient is declared only when
// present above the amount that rounds to zero. Total Fat / Saturated Fat / Trans Fat /
// Cholesterol are absent from the formulation, so the source Excel CORRECTLY omits them on a
// Supplement Facts panel — this confirms Excel-as-truth rather than diverging from it. The engine
// still carries them as confirmed zeros so the data contract stays stable (and a 101.9 food panel
// could be produced from the same request).
const SUPPLEMENT_PANEL_NOTE =
  "Total Fat, Saturated Fat, Trans Fat, and Cholesterol are absent from the formulation. Under " +
  "21 CFR 101.36(b)(2)(i) they are not declared on a Supplement Facts panel (declared only when " +
  "present above the zero-rounding threshold); the source Excel omission is consistent with 101.36.";

function buildCitations(
  id: NutrientId,
  region: RegionConfig,
  roundingCitation: string,
  pctDvCitation: string | null,
  complianceCitation: string,
): string[] {
  const out = new Set<string>();
  const dv = region.dailyValues.find((d) => d.nutrientId === id);
  if (dv) out.add(dv.citation);
  if (roundingCitation) out.add(roundingCitation);
  if (pctDvCitation) out.add(pctDvCitation);
  if (complianceCitation) out.add(complianceCitation);
  return [...out];
}

export function runPipeline(req: CalcRequest, region: RegionConfig): CalcResponse {
  const inputsHash = stableHash(req);
  const audit = new AuditBuilder(inputsHash, req.calorieMethod, region.id);
  const validationFlags: string[] = [];

  audit.add(
    "input",
    "request",
    `serving ${req.servingWeightG} g, method ${req.calorieMethod}, ` +
      `${req.recipe.length} recipe lines, ${req.ingredients.length} ingredients, region ${region.id}.`,
  );

  // Log every stale-constant correction (e.g. Vitamin D 0.2 → 20 mcg).
  for (const c of STALE_CONSTANT_CORRECTIONS) {
    audit.add(
      "correction",
      "staleConstant",
      `${c.field} ${c.staleValue} → ${c.correctedValue} ${c.unit}. ${c.note}`,
      { nutrientId: c.nutrientId, citation: c.citation },
    );
  }
  audit.add("finding", "supplementPanel", SUPPLEMENT_PANEL_NOTE, { citation: "101.36(b)(2)(i)" });

  // ── Blocking gates ──
  const blocking = preflight(req, region);
  if (blocking.length > 0) {
    for (const b of blocking) {
      audit.add("block", "preflight", `${b.code}: ${b.message} [${b.offenders.join(", ")}]`);
    }
    return {
      status: "blocked",
      panel: null,
      blockingIssues: blocking,
      validationFlags,
      auditTrail: audit.build(),
      prototypeDisclaimer: PROTOTYPE_DISCLAIMER,
    };
  }

  // ── Recipe sum (Excel-parity) ──
  const { totals, usRulesCalories, usRulesComplete, flags: recipeFlags } = sumRecipe(req);
  validationFlags.push(...recipeFlags);
  audit.add("transform", "recipe.sum", `Summed ${totals.size} nutrients across recipe lines.`);

  // ── Calories ──
  if (req.calorieMethod === "D" && !usRulesComplete) {
    validationFlags.push(
      "Method D (US Rules): one or more ingredients lack a per-100 g calorie factor, treated as 0.",
    );
  }
  const { result: calories, flags: calorieFlags } = computeCalories(
    req.calorieMethod,
    totals,
    region,
    usRulesCalories,
  );
  validationFlags.push(...calorieFlags);
  const altText = calories.alternate
    ? `; alternate Method ${calories.alternate.method} = ${calories.alternate.value} cal (unrounded ${calories.alternate.unrounded})`
    : "";
  audit.add(
    "transform",
    "calories",
    `Method ${calories.method} = ${calories.value} cal (unrounded ${calories.unrounded})${altText}.`,
    { citation: calories.citation },
  );

  // ── Per-nutrient pipeline ──
  const policyById = new Map(req.nutrientPolicies.map((p) => [p.nutrientId, p]));
  const universe = new Set<NutrientId>(region.mandatoryNutrients);
  for (const id of totals.keys()) universe.add(id);

  const ordered: NutrientId[] = NUTRIENT_ORDER.filter((id) => universe.has(id));
  for (const id of universe) {
    if (!ordered.includes(id)) ordered.push(id);
  }

  const nutrients: NutrientResult[] = [];
  for (const id of ordered) {
    const entry = NUTRIENTS[id];
    const policy = policyById.get(id);
    const flags: string[] = [];

    // Source (catalog default unless policy overrides).
    const source = policy?.source ?? defaultSourceFor(id);
    if (policy?.sourceOverridden) {
      audit.add("override", "source", `Source overridden to "${source}".`, { nutrientId: id });
    }

    // Pipeline fractions. Loss/decay default to 0 (flagged); overage default 0 only for
    // third-group nutrients (floor nutrients were required by preflight).
    const raw = totals.get(id) ?? 0;
    const processLossFrac = policy?.processLossFrac ?? 0;
    if (policy?.processLossFrac === undefined) flags.push("Process loss assumed 0% (not specified).");
    const shelfLifeDecayFrac = policy?.shelfLifeDecayFrac ?? 0;
    if (policy?.shelfLifeDecayFrac === undefined) flags.push("Shelf-life decay assumed 0% (not specified).");
    const overageFrac = policy?.overageFrac ?? 0;

    const stages = runStages({ raw, processLossFrac, overageFrac, shelfLifeDecayFrac });
    audit.add(
      "transform",
      "pipeline",
      `raw ${stages.raw} → asFormulated ${stages.asFormulated} → asDeclared ${stages.asDeclared} → EOSL ${stages.endOfShelfLife}.`,
      { nutrientId: id },
    );

    // %DV on unrounded as-declared.
    const dv = dailyValueFor(id, region);
    const pctDV = percentDV(stages.asDeclared, dv);

    // Compliance class + assessment.
    const klass = classify(entry.isThirdGroup, source);
    const compliance = assessCompliance(klass, stages, region);
    audit.add("class", "compliance", `Class ${klass}: ${compliance.detail}`, {
      nutrientId: id,
      citation: compliance.citation,
    });

    // ── ROUNDING LAST ──
    const amountRound = roundByGroup(stages.asDeclared, entry.amountRoundingGroup, region);
    audit.add("rounding", "amount", `${amountRound.detail} [${entry.amountRoundingGroup}]`, {
      nutrientId: id,
      citation: amountRound.citation,
    });

    let pctDVRounded: number | null = null;
    let pctDvCitation: string | null = null;
    if (pctDV !== null) {
      const pctRound = roundByGroup(pctDV, region.pctDvRoundingGroup, region);
      pctDVRounded = typeof pctRound.rounded === "number" ? pctRound.rounded : null;
      pctDvCitation = pctRound.citation;
      audit.add("rounding", "pctDV", `${pctRound.detail} [${region.pctDvRoundingGroup}]`, {
        nutrientId: id,
        citation: pctRound.citation,
      });
    }

    nutrients.push({
      nutrientId: id,
      unit: entry.unit,
      stages,
      declaredAmountRounded: amountRound.rounded,
      pctDV,
      pctDVRounded,
      source,
      complianceClass: compliance.complianceClass,
      complianceFloorPct: compliance.floorPct,
      complianceCeilingPct: compliance.ceilingPct,
      meetsCompliance: compliance.meets,
      mandatory: entry.mandatory || region.mandatoryNutrients.includes(id),
      citations: buildCitations(id, region, amountRound.citation, pctDvCitation, compliance.citation),
      flags,
    });
  }

  const panel: NutritionPanel = {
    servingWeightG: req.servingWeightG,
    servingsPerContainer: req.servingsPerContainer ?? null,
    columnCount: 1,
    title: region.panelTitle,
    regulation: region.regulation,
    calories,
    nutrients,
    footnotes: ["Percent Daily Values are based on a 2,000 calorie diet."],
  };

  return {
    status: "ok",
    panel,
    blockingIssues: [],
    validationFlags,
    auditTrail: audit.build(),
    prototypeDisclaimer: PROTOTYPE_DISCLAIMER,
  };
}
