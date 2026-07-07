# Copilot Instructions — PHC Virtual Solid Filler

## Project overview

This repository builds a professional internal P&G-style prototype called **PHC Virtual Solid Filler**. The goal is to demonstrate how DEM simulation outputs could be converted into a fast surrogate model for predicting bottle fill height and slack fill/headspace for PHC solid product forms, starting with gummies.

The prototype is **not a validated tool** — all predictions are placeholder math. Every output must include a clear disclaimer that this is a prototype surrogate model.

## Project structure

```
.github/
  copilot-instructions.md        ← Project-wide Copilot instructions
  skills/
    pg-professional-ui/          ← UI/component/styling skill
      SKILL.md
    surrogate-model-dashboard/   ← Prediction logic/presets skill
      SKILL.md
src/
  components/                     ← React components (header, cards, charts, bottle viz, etc.)
  data/                           ← Mock presets (gummies, bottles, suppliers)
  utils/
    surrogateModel.ts             ← All prediction math
    [other helpers]
  styles/                         ← Global or shared Tailwind styles
  App.tsx
  main.tsx
```

## Copilot skills

This project uses two domain-specific skills:

1. **`pg-professional-ui`** — UI, layout, styling, components, Framer Motion animation, accessibility
   - Invoke when: building/refining UI components, dashboards, visual design, responsive layout, motion
   - Do NOT invoke for: prediction math, model logic, backend integration

2. **`surrogate-model-dashboard`** — Prediction engine, presets, model boundaries, comparison logic, output rules
   - Invoke when: adding/updating prediction functions, defining presets, boundary checks, status rules
   - Do NOT invoke for: component rendering, styling, animation (use pg-professional-ui instead)

## Coding standards

### React & TypeScript
- Use **React 18+, TypeScript, Vite, Tailwind CSS**.
- Modular components — one responsibility per file.
- Extract logic from JSX; no complex expressions inside render.
- Use hooks (`useState`, `useEffect`, `useContext`) for state and side effects.
- Type all props and state; avoid `any`.

### File organization
- `src/components/` — React functional components (one per file, e.g., `Header.tsx`, `InputPanel.tsx`)
- `src/data/` — Mock presets as JSON or `.ts` files (e.g., `gummyPresets.ts`, `bottlePresets.ts`)
- `src/utils/surrogateModel.ts` — All prediction logic; export pure functions
- `src/styles/` — Global Tailwind config, shared classes, or utility styles

### Comments & documentation
- Add comments where real DEM coefficients would replace placeholder math.
- Use clear function names and parameter names (e.g., `calculateFillHeight()`, `gummyVolumeInMm3`).
- Document input/output units (e.g., mm, mL, g, %).
- Never omit disclaimers in UI; always label predictions as "prototype surrogate."

## UI standards

### Visual design
- Professional enterprise dashboard — no playful or cartoon visuals.
- **P&G-inspired palette:**
  - Deep blue primary (e.g., `#1e3a8a`, `#2563eb`)
  - Slate gray neutrals (e.g., `#64748b`, `#475569`)
  - White and light gray surfaces (e.g., `#f1f5f9`, `#f8fafc`)
  - Subtle cyan/blue accents (e.g., `#06b6d4`, `#0ea5e9`)
- Rounded corners on cards, clean spacing, readable labels, sufficient color contrast (WCAG AA).
- Responsive design (desktop → tablet).

### Required components
- `Header` — product name, environment badge, navigation
- `InputPanel` — gummy, bottle, fill parameters
- `MetricCards` — fill height, slack fill, status
- `BottleVisualization` — animated SVG bottle with fill level
- `ComparisonChart` — Current vs Dory vs Emerald City
- `WorkflowExplainer` — DEM → surrogate → prediction flow
- `NotesDisclaimerPanel` — prototype & model-range disclaimers

### Animation & accessibility
- Use Framer Motion for smooth transitions (bottle fill, card updates, chart transitions).
- Keep motion professional and restrained (150–400ms durations).
- Use semantic HTML (`<header>`, `<main>`, `<section>`, `<label>`, `<button>`).
- Label all form controls; provide visible focus states.
- Never rely on color alone to convey status.

## Modeling & scientific standards

### Prototype disclaimers
- **Always** label outputs as **"prototype surrogate prediction."**
- Include a disclaimer that all math is placeholder and not validated.
- Show model-boundary warnings when inputs exceed preset ranges.

### Prediction logic
- Put all math in `src/utils/surrogateModel.ts`.
- Use pure functions: `calculateFillHeight(gummyVolume, bottleVolume, packingEfficiency) → fillHeightMm`
- Mark every placeholder calculation with a comment: `// TODO: replace with DEM-trained coefficient`
- Return predictions with a status flag: `{ fillHeight: 42.5, status: "Good", ... }`
- Implement boundary checks; return `"Outside model range"` when inputs exceed presets.

### Comparison scenarios
- Support Current, Dory, and Emerald City predictions in parallel.
- Each scenario has its own gummy, bottle, and packing presets.
- Display side-by-side results with clear differences highlighted.

## When asking Copilot for changes

1. Be specific about the scope:
   - UI/component change → invoke **pg-professional-ui** skill
   - Prediction/preset change → invoke **surrogate-model-dashboard** skill
   - Both → reference both skills in context

2. Provide clear requirements:
   - What is the input/output?
   - What does it look like (screenshot, design)?
   - What is the interaction flow?

3. Let Copilot plan:
   - Copilot will suggest which components to create/modify, which presets to add, which functions to implement.
   - Copilot will edit files across the project, run linters/tests, and self-correct if needed.

## Development workflow

1. **Setup:** `npm install`, then `npm run dev`
2. **Dev server:** Vite hot-reload on file changes
3. **Build:** `npm run build` → production bundle
4. **Linting:** Use ESLint + Prettier (configure in `.eslintrc` / `.prettierrc`)
5. **Git:** Commit with clear messages referencing the feature or bug (e.g., "feat: add Dory comparison" or "fix: model boundary warnings")

---

**Remember:** This is a prototype. Every interaction should reinforce that predictions are mock values, not validated DEM outputs. Always include disclaimers and invite users to consider real DEM-trained models for production use.
