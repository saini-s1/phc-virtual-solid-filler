# Step 3 — UI Design Specification (Nutrition Calculator)

**Module:** `MODULE_02 · PHC Nutrition Calculator`
**Goal:** A three-panel dashboard whose **center focal point is a large, FDA-faithful, live-updating Nutrition Facts label**, built **entirely from the packaging module's existing design language** — no new fonts, colors, or component patterns.
**Status:** Design only. No components are built yet. Open questions are listed in §10 for one-pass clearing before the Step 5 build.

> **Prototype disclaimer (always visible):** every label rendered is a *prototype surrogate panel*, not a validated FDA label.

---

## 1. Design-language contract (reuse, do not invent)

Everything below is already defined in the packaging module and **must be reused verbatim**:

| Token / pattern | Source | Use in nutrition module |
|---|---|---|
| Fonts: `Plus Jakarta Sans` (sans/display), `JetBrains Mono` (mono) | `tailwind.config.js` | All text, incl. the FDA label (see §4.1) |
| Palette: `ink.50–950`, `pg.blue.*`, `pg.cyan.*`, `pg.lime.*` | `tailwind.config.js` | Same roles as packaging |
| `.surface`, `.surface-inset`, `.surface-quiet` | `index.css` | All panels/cards |
| `.eyebrow`, `.field-label`, `.pill` | `index.css` | Section kickers, labels, chips |
| `.btn-primary`, `.btn-ghost` | `index.css` | Run / reset actions |
| `.select-input`, `.number-input`, range slider | `index.css` | All form controls |
| `shadow-card / -elevated / -glow`, `rounded-2xl/xl` | `tailwind.config.js` | Same elevation system |
| `animate-fade-up` staggered `[animation-delay]` | `tailwind.config.js` | Panel entrance |
| `Header` (moduleTag/title/subtitle/onBack/icon) | `Header.tsx` | Reused as-is (`MODULE_02`, `Apple` icon) |
| `MetricCard` + tones (`success/warning/danger/muted`) | `MetricCard.tsx` | Right-panel metrics |
| Status panel pattern (tone wrap + chip + icon + text) | `OutputPanel.tsx` | Compliance status |
| Icons: `lucide-react` | existing | All iconography |

**Status-color semantics (kept identical):** emerald = good/compliant, amber = watch-out, rose = fail/over-limit, violet = out-of-model/blocked. **Never color-alone** — always pair with a lucide icon + text label.

---

## 2. Page layout (mirrors `PackagingApp.tsx` exactly)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Header  ·  MODULE_02  ·  PHC Nutrition Calculator        [v0.1][Prototype]  │  ← reused <Header>
├───────────────────────────────────────────────────────────────────────────┤
│ DisclaimerBanner — "Prototype surrogate panel · not a validated label"      │  ← amber, reused style
├──────────────────┬──────────────────────────────────┬─────────────────────┤
│  LEFT  340px     │        CENTER  1fr               │   RIGHT  360px       │
│  RecipeInputPanel│   NutritionFactsLabel (FOCAL)    │  NutritionOutputPanel│
│                  │   + CalorieMethodToggle (B|C)    │  (metrics+compliance)│
│  .surface        │   .surface (elevated focal)      │  .surface            │
├──────────────────┴──────────────────────────────────┴─────────────────────┤
│  PipelineDiagram   — raw → formulated → declared → end-of-shelf-life        │  ← below-fold, optional
│  CalorieMethodCompare — B vs C bar (mirrors ComparisonChart)                │
│  AuditTrailPanel  — OH-222 audit log + structural findings (accordion)      │
├───────────────────────────────────────────────────────────────────────────┤
│ Footer · © 2026 P&G Internal Prototype · not for technical use              │  ← reused style
└───────────────────────────────────────────────────────────────────────────┘
```

Container + grid are identical to packaging:
```tsx
<div className="flex min-h-screen flex-col">
  <Header moduleTag="MODULE_02" title="PHC Nutrition Calculator"
          subtitle="Formulation → FDA nutrition panel" icon={<Apple/>} onBack={onBack} />
  <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-6">
    <DisclaimerBanner />
    <div className="grid gap-5 lg:grid-cols-[340px_1fr_360px]">
      … left · center · right (each animate-fade-up, staggered 40/120/200ms) …
    </div>
    <div className="mt-5 grid gap-5"> … below-fold sections 280/340/400ms … </div>
  </main>
  <footer> … reused … </footer>
</div>
```

---

## 3. LEFT — `RecipeInputPanel.tsx`

Same shell as `InputPanel`: `<section className="surface flex flex-col gap-6 p-6">` with the eyebrow/title + icon-chip header (`Sparkles` in a cyan chip).

**Controls (top → bottom):**

1. **Product preset** — `.select-input` (ships the Excel's example "Irovy Orange" + room for gummy presets). Mirrors packaging's preset dropdown.
2. **Serving size** — range slider (reusing the brand-gradient slider) + mono readout `g`, exactly like packaging's count slider.
3. **Calorie method** — segmented control **B | C** (default **C**). Small, restrained; selecting **A/D/E/F** shows a disabled "not implemented" state. This is the input twin of the center toggle (they stay in sync).
4. **Ingredient table** — the recipe engine input. A compact, scrollable list of `IngredientRow`s:
   - columns: **name** · **%w/w** (`.number-input`, tabular-nums) · **completeness badge**
   - a `CompletenessBadge`: `known` (cyan pill) / `zeroConfirmed` (ink pill) / `unknown` (amber pill, with an inline "Confirm 0 / Enter value" affordance)
   - `%w/w` sum chip (`.pill`): green when ≈ 1.00, amber otherwise (normalization warning, never silent-fixed)
5. **Nutrient policy (collapsible, advanced)** — per-nutrient `source` (added/naturally_occurring → Class I/II), `processLoss%`, **`overage%` (required, no default)**, `decay%`. Defaults: all vitamins/minerals `added`/Class I (surfaced, overridable).
6. **`Run panel`** — `.btn-primary` full-width with `Sparkles`, identical to packaging's "Run prediction".

Live-updating: like packaging, the panel recomputes via `useMemo` on every change; **Run** re-stamps a `runId` to retrigger label motion.

---

## 4. CENTER — `NutritionFactsLabel.tsx` (the focal point)

The visual anchor. Rendered inside a `.surface` with extra elevation, centered, **large** (target ≈ 380–420px wide label, comfortably dominating the column).

### 4.1 Typography decision (respects "no new fonts")
The real FDA label is traditionally Helvetica. To honor *"do not invent new fonts,"* the label is rendered in the app's existing **`Plus Jakarta Sans`**, reproducing the FDA **hierarchy and rules** (heavy black bars, weight contrast, indentation, right-aligned %DV) rather than importing Helvetica. The "black" is `ink-900`. → *This is open question §10-A: keep app font, or load Helvetica for literal realism?*

### 4.2 Structure (2016+ format, top → bottom)
- Outer **2px `ink-900` border** around the whole label.
- **"Nutrition Facts"** — `font-extrabold`, ~28px, tight tracking; **thick rule** under.
- `X servings per container` · **`Serving size  …`** (bold), **thick rule**.
- `Amount per serving` (small) → **`Calories`** (bold) + **very large bold number** right. **Thick rule.**
  - **`CalorieMethodToggle`** sits immediately beside/under Calories: shows the active value big (e.g. **25**, method C) and the alternate inline-muted (**40** via B) with a small toggle — per FLAG 1 "see at a glance" requirement. Toggling animates the number (Framer Motion crossfade, ~200ms).
- Right-aligned **`% Daily Value*`** header (hairline rule under).
- Mandatory rows, FDA indentation + bold conventions:
  - **Total Fat** g · %DV → *Saturated Fat* (indent) · *Trans Fat* (indent)
  - **Cholesterol** mg · %DV
  - **Sodium** mg · %DV
  - **Total Carbohydrate** g · %DV → *Dietary Fiber* (indent) · *Total Sugars* (indent) → `Includes Xg Added Sugars` (double indent) · %DV
  - **Protein** g
- **Thick rule**, then **Vitamin D · Calcium · Iron · Potassium** (mandatory micros) + any **fortified actives** (voluntary).
- **Thick rule**, footnote: *"The % Daily Value (DV) tells you how much a nutrient in a serving of food contributes to a daily diet. 2,000 calories a day is used for general nutrition advice."*
- **Prototype ribbon** — a small `pill`/corner tag "PROTOTYPE — not a validated label" so the disclaimer rides with the artifact.

### 4.3 Blocked-label states (replace the label body when inputs are incomplete)
A `.surface-inset` card with a violet/amber tone, icon + heading + exact remediation list:
- **Method C needs fiber split** (FLAG 1): "Method C requires a soluble/insoluble fiber split. Provide it for: *Psyllium, …*" + a "Switch to method B" shortcut.
- **Incomplete ingredient rows** (FLAG 2): "Resolve unknown nutrient values before the panel can emit: *<rows>*."
- **Overage missing** (FLAG 3): "OH-234 default not specified — enter overage % for: *<nutrients>*." (Label shows as-formulated values muted, declared/EOSL blocked.)

Live values change as inputs change; rounding is applied **only here, at render** (per spec §4.2).

---

## 5. RIGHT — `NutritionOutputPanel.tsx`

Same shell/header as `OutputPanel` (`Beaker` chip). Contents:

1. **Metric grid** (reuse `MetricCard`, 2-col): **Calories** (active method) · **Key %DV** (e.g. Dietary Fiber) · **# nutrients ≥20% DV** ("excellent source" count) · **Serving size**.
2. **Compliance status** — the `OutputPanel` status pattern: emerald "Compliant" / amber "Review" / rose "Out of tolerance" / violet "Blocked". Sublabel cites the rule: end-of-shelf-life ≥ class floor (Class I 100% / Class II 80%), Third-group ≤120% (101.9(g)(4)/(5)).
3. **Flags & assumptions** — `.surface-inset` list of `validationFlags` (process-loss assumed, overage missing, %w/w ≠ 1, Vit D corrected, structural Excel-gap finding), each with an `Info`/`AlertTriangle` icon.

---

## 6. Below-fold sections (optional — confirm scope, §10-D)

Mirror packaging's stacked extras:
- **`PipelineDiagram.tsx`** — horizontal 4-stage flow **raw → as-formulated → as-declared → end-of-shelf-life** with the transform on each arrow (×(1−loss), ÷(1+overage), ×(1−decay)); analog of `WorkflowDiagram`.
- **`CalorieMethodCompare.tsx`** — small B-vs-C bar (40 vs 25) making the FLAG 1 delta legible; analog of `ComparisonChart`.
- **`AuditTrailPanel.tsx`** — OH-222 audit log accordion (each transform, the Vit D correction, the structural finding, completeness resolutions, blocking states).

---

## 7. Motion (restrained, 150–400ms — matches existing)

- Panels: `animate-fade-up` staggered (existing).
- Calorie number + %DV values: Framer Motion crossfade/`tabular-nums` tween on input change and B/C toggle (~200ms). No bouncing.
- Blocked ↔ live label: short fade between states.
- Reuse the header's cyan "ping" prototype dot; no new keyframes needed.

---

## 8. Accessibility

- Semantic `<header>/<main>/<section>` with `aria-labelledby`; the label is a `<section aria-label="Prototype Nutrition Facts panel">` with a real `<table>` for nutrient rows (screen-reader friendly; %DV in a `<th scope>` column).
- Every control has a `<label htmlFor>`; global `focus-visible` cyan ring already applies.
- Status uses `role="status"`; compliance conveyed by icon+text+color (never color alone).
- `tabular-nums` on all numeric readouts; sufficient contrast (ink-900 on white = AA+).

---

## 9. Component inventory (for Step 5)

| File | Role | Reuses |
|---|---|---|
| `NutritionApp.tsx` (**rewrite**) | layout + state + engine wiring | `Header`, layout, footer |
| `components/nutrition/RecipeInputPanel.tsx` | left inputs | `.surface`, `.select-input`, slider, `.btn-primary` |
| `components/nutrition/IngredientRow.tsx` | one recipe line | `.number-input`, `CompletenessBadge` |
| `components/nutrition/CompletenessBadge.tsx` | known/zero/unknown pill | `.pill` |
| `components/nutrition/CalorieMethodToggle.tsx` | B \| C segmented + values | `.pill`, Framer Motion |
| `components/nutrition/NutritionFactsLabel.tsx` | **center FDA label** | fonts/ink only |
| `components/nutrition/NutritionOutputPanel.tsx` | right metrics + compliance | `MetricCard`, status pattern |
| `components/nutrition/PipelineDiagram.tsx` | 4-stage flow (opt) | `.surface`, mirrors `WorkflowDiagram` |
| `components/nutrition/CalorieMethodCompare.tsx` | B vs C bar (opt) | mirrors `ComparisonChart` |
| `components/nutrition/AuditTrailPanel.tsx` | OH-222 audit accordion | `.surface-inset` |

The existing placeholder `NutritionApp.tsx` (formula→goal mock math) is **replaced** by the spec engine + these components.

---

## 10. Open questions — ✅ all resolved (locked for build)

- **A. FDA label font — ✅ app `Plus Jakarta Sans`.** No new font. FDA *hierarchy* (bold title, thick rules, indentation, %DV alignment) carries the panel read; platform typography parity wins over Helvetica realism. Artwork-grade rendering is a downstream OH-222 label-artwork export, not a UI concern.
- **B. Soluble fiber — ✅ computed 4.66 g.** Heuristic dropped entirely; audit logs value as computed-from-breakdown; missing split → FLAG 1 hard block (no fallback).
- **C. Serving display — ✅ single column v1.** Renderer architected for a later per-container column without refactor; not exposed in v1.
- **D. Below-fold scope — ✅ hero + AuditTrailPanel first.** PipelineDiagram and CalorieMethodCompare deferred to v1.1 (B-vs-C delta already shown via the center toggle). **Structural hooks held** for both.
- **E. Ingredient editing depth — ✅ edit + complete only.** Edit %w/w + resolve completeness on shipped ingredients; **no add/remove authoring** (belongs in a separate Enovia/CDL-backed ingredient module).
- **F. Compliance scope — ✅ both.** Show Class I (≥100%), Class II (≥80%), and Third group (≤120%: calories, sugars, added sugars, sodium). Third group **read-only** in v1.

---

*Step 3 design complete and all questions cleared. Step 4 architecture in `SPEC_Architecture.md`.*
