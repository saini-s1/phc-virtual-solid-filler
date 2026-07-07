---
name: pg-professional-ui
description: Use this skill when building or modifying the PHC Virtual Solid Filler user interface, dashboard layout, visual design, animations, accessibility, or component styling. Covers React + TypeScript + Vite + Tailwind enterprise dashboard conventions, P&G-inspired visual language, mock surrogate-model UX patterns, and prototype disclaimers. USE FOR: creating new UI components, refining layout/spacing/typography, adding Framer Motion transitions, wiring up the bottle fill visualization, comparison charts, metric cards, input panels, or workflow explainers. DO NOT USE FOR: real DEM physics implementation, backend integration, or non-PHC projects.
---

# P&G Professional UI Skill — PHC Virtual Solid Filler

This skill governs UI work for a professional internal P&G-style prototype called **PHC Virtual Solid Filler**. The product demonstrates how DEM simulation outputs could be converted into a fast surrogate model for predicting bottle fill height and slack fill/headspace for PHC solid product forms, starting with gummies.

## Product goal

Build a polished UI mockup that shows how DEM-derived surrogate predictions would feel in a real enterprise tool. The interface must look credible to internal P&G stakeholders while making clear that the underlying math is a placeholder.

## Coding standards

- Use **React, TypeScript, Vite, Tailwind CSS**.
- Use modular components — one responsibility per file.
- Keep logic clear and readable; no clever one-liners in JSX.
- Do **not** hardcode complex logic inside JSX. Extract to helpers/hooks.
- Put mock product/bottle data in `src/data/`.
- Put prediction logic in `src/utils/surrogateModel.ts`.
- Add comments where real DEM surrogate coefficients would later replace placeholder math (e.g. `// TODO: replace with DEM-trained coefficient`).

## UI standards

- Professional enterprise dashboard — **not playful**, no cartoon visuals.
- P&G-inspired palette:
  - Deep blue primary
  - Slate gray neutrals
  - White and light gray surfaces
  - Subtle cyan/blue accents
- Clean layout, generous spacing, rounded cards, readable labels.
- Responsive design; usable from laptop down to tablet width.
- Accessible contrast on all text and status indicators.
- Always show a clear disclaimer when predictions are mock/prototype values.

## Required components

Use (and reuse) these building blocks:

- `Header` — product name + environment/prototype badge
- `InputPanel` — product, bottle, fill parameters
- `MetricCards` — fill height, slack fill, headspace, confidence
- `BottleVisualization` — animated SVG bottle fill
- `ComparisonChart` — predicted vs target / vs spec
- `WorkflowExplainer` — DEM → surrogate → prediction flow
- `NotesDisclaimerPanel` — prototype/validation caveats

## Accessibility

- Use semantic HTML (`<header>`, `<main>`, `<section>`, `<label>`, `<button>`).
- Label every form control; associate with `htmlFor` / `aria-label`.
- Ensure sufficient color contrast (WCAG AA minimum).
- Provide visible focus states on all interactive elements.
- Never rely on color alone to convey status — pair with icon or text.

## Animation

Use **Framer Motion** sparingly and only where it aids understanding:

- Bottle fill rise on prediction update
- Smooth metric card value transitions
- Chart series transitions

Keep motion restrained and professional — short durations (150–400ms), easing curves, no bounce.

## Scientific & modeling standards

- **Never** imply the placeholder formula is validated.
- Label all outputs as **"prototype surrogate prediction"**.
- Show **model-boundary warnings** when inputs fall outside preset ranges defined in the mock data.
- Structure code so a real DEM-trained model can be dropped into `src/utils/surrogateModel.ts` without UI changes.

## When invoked

1. Confirm the change is UI/UX scoped (layout, component, styling, animation, accessibility, disclaimer copy).
2. Reuse existing components in `src/components/` before creating new ones.
3. Pull mock data from `src/data/` — do not inline product/bottle constants.
4. Route any prediction math through `src/utils/surrogateModel.ts`.
5. Verify the result still looks like an enterprise dashboard, includes prototype disclaimers, and meets the accessibility checklist above.
