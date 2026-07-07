# SOP Reference — Nutrition Calculator Module

> Reverse-reading of the two governing SOPs (Step A). This file is a durable
> reference for how OH-234 and OH-222 constrain the nutrition calculator.
> **OH-234 affects math. OH-222 affects output format / process. Do not conflate.**

---

## OH-222 — Determination of Technical Content for Product Labeling
- Doc #: **VV-QUAL-569949**, v3.0, effective 12 Sep 2025. Owner: Amanda Thornton.
- Scope: North America (US + CA). Personal Health Care. Dietary Supplements, NHPs,
  Foods, Drugs, Cosmetics, Medical Devices, Consumer Goods.
- **Process/governance only — contains NO formulas, rounding tables, or thresholds.**
- Governs the *non-discretionary, formulation-inherent* technical content on labels:
  serving info, ingredient listings, dosing, cation content, nutrient content data.
- **Excludes** discretionary content: product name, claims, certifications, net
  weight, manufacturer details, usage instructions (Scope).

### Key points
- **Rounding ownership:** Regulatory "owns the final decision on the appropriate
  rounding of cations, supplement and nutrition facts" (Responsibilities → Regulatory).
  The *rules* themselves live in 21 CFR 101 / FDA guidance, NOT in OH-222.
- Formatting (capitalization, italics, footnotes, USAN nomenclature): Regulatory owns.
- §2.1.1 technical assessments may use raw-material nutrition/composition data.
- §2.1.2 comparator-formulation assessments allowed for Supp/Food/NHP if comparator
  has data or prior approved assessment (framework: VV-QUAL-2080291).
- §2.2 serving size & label-claim inputs from Products Research.
- §2.3 ingredient listing from raw-material/formula data (PASS Ingredient List Report).
- §3 approved by **P&F/MPD Band 3 (or delegate)**.
- §5 change-management triggers re-review (dosing/composition/spec/RM/regulation changes).
- §6 store summary in **Enovia IRM** with the **FOP** standard.

### Impact on our build (Step C — output schema/audit)
- Output object should carry: serving info, ingredient list, dosing, cation content,
  declared values, approver fields (P&F/MPD Band 3 + Regulatory), version metadata,
  FOP linkage, Enovia IRM storage stamp.
- **No export format is specified** by OH-222 — PDF vs structured data is OUR choice.
- Hash / e-signature mechanics are OUR good-practice addition, not literal OH-222 text.
- Exact field templates (VV-QUAL-2080291/2080292) NOT uploaded — fields derived from
  SOP body and flagged as such.

---

## OH-234 — Determination of Dietary Ingredient Overages
- Doc #: **VV-QUAL-2019440**, v2.0, effective 31 Aug 2025. Owner: Brian Laster.
- Scope: North America (US + CA). Dietary Supplements & Natural Health Products only.
  NOT drugs, foods, cosmetics, devices, or non-dietary ingredients/excipients.
- **This SOP affects MATH.** Keep overage logic in its own module (separate from FDA
  rounding and region config).

### US nutrient classes & compliance limits (Purpose §1–3)
- **Class I** (added, synthetic fortification, e.g. Vit C from ascorbic acid):
  **≥ 100%** of label claim throughout expiry. Overages may apply.
- **Class II** (added but naturally occurring/indigenous, e.g. Vit C from acerola):
  **≥ 80%** of label claim throughout expiry. Overages may apply.
- **Third Group** (mandatory-label, present but not intentionally added, e.g. calories):
  **≤ 120%** of label claim. NO formulated overage required.
- Statutory basis: 21 CFR 101.9(g)(4); reasonable-excess basis 101.9(g)(6),
  101.36(f)(1).

### Canada limits (Purpose, CA §1–4; QNHPG §2.3)
- Vitamins & minerals: 80–120%.
- Isolates / synthetic duplicates: 80–120%.
- Probiotics (live microorganisms): ≥ 80% of labeled CFU.
- Enzymes: 80–150% of labeled activity.
- Above-ceiling allowed only with scientific justification (Section 2).

### Overage formula (Procedure §1.5)
```
% overage = ΔX + ΔY + CI * sqrt(σ1² + σ2² + σ3² + ...)
```
- **ΔX** = anticipated shelf-life degradation loss, from stability data (§1.1; Defs).
- **ΔY** = processing loss = observed loss / initial quantity (§1.2; Defs).
- **σ** = each independent variance source (RM strength, batch addition, within/between
  batch, dosing/weight, interactions, analytical/micro method) (§1.3).
  - §1.3.1: %RSD ≡ σ.
  - §1.3.2: one-sided tolerance ±Z% → divide by 3 (Z/3) to become a σ.
- **CI** = confidence interval multiplier **2–3** (95–99.7%) on the RSS of variances (§1.4).
- If variance sources unknown, still compute from available ΔX, ΔY, σ, CI (§1.6–1.7).

### Three distinct nutrient values (for Step B calc core)
- **As-formulated** = raw %w/w input (Enovia/CDL) including overage.
- **As-declared** = label claim value.
- **End-of-shelf-life** = as-formulated minus expected loss; must still meet target %DV.
- Overage basis target: ingredient stays ≥ Class floor (100%/80%) through expiry.

### Process/governance (Procedure §2–5) — NOT math
- §2 document basis + rationale in Attachment 1 (VV-QUAL-2019451), file with FOP, QA-approved.
- §3 record in master manufacturing record; set upper-limit spec per OH-229.
- §4 Product Safety + Regulatory review; documented in GPS clearance.
- §5 contract-manufacturer rules.

### Open items / gaps flagged
- CI default undefined (range 2–3) — proposed default **CI = 3** (most conservative), editable.
- OH-234 gives a **method, not numeric overage constants** — default overage should be
  **formula-computed** when ΔX/ΔY/σ supplied, else 0% with a "no overage basis" flag.
  Do NOT invent per-nutrient overage constants.
- `nutrientClass` must be a per-ingredient input (source-dependent; cannot be inferred).
- Compendia/upper-limit caps live in **OH-229 (VV-QUAL-1592906) — NOT uploaded**, so
  upper-limit checks only enforce Class ceilings + CA bands, not OH-229 caps.

### Document cross-reference note
- OH-234's reference list mislabels OH-222 as "Determination of Nutrition of Foods and
  Supplements" — stale title for the same doc number (VV-QUAL-569949). Not a third doc.
