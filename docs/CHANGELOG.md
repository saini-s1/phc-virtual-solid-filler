# Changelog

All notable changes to the PHC Modeling Suite prototype are recorded here.
This project uses [semantic versioning](https://semver.org): `MAJOR.MINOR.PATCH`.

While the suite is a prototype we stay on `0.x` — anything can still move.

## [Unreleased]

### Added
- **Delete from the shared ingredient library.** In the Nutrition Calculator's
  "Your saved ingredients" list (`RecipeInputPanel.tsx`), any previously-saved
  custom ingredient can be permanently deleted, guarded by an explicit two-step
  confirm (trash icon → "Yes, delete" / "Cancel"). The built-in 16 template
  ingredients are never deletable this way.
  - New `DELETE /api/ingredients/:id` route (`server/index.js`), validated as a
    UUID before touching the store, rate-limited alongside `POST`.
  - New `remove(id)` method on both store backends (`server/store.js`); see
    `server/__tests__/store.test.js`.
  - New `deleteCustomIngredient()` client (`src/nutrition/data/ingredientApi.ts`)
    and `handleDeleteFromLibrary()` wiring in `NutritionApp.tsx`.
- **Shared ingredient library + Azure deployment.** Nutrition Calculator ingredients can now
  be saved to a server-backed shared library ("Save to library" button in each ingredient's
  expanded editor), so custom ingredients persist and show up in "Add from library" for
  everyone, not just the current browser tab.
  - New `server/` — a small Express app (`server/index.js`) that serves the built SPA and
    exposes `GET/POST /api/ingredients` (+ `DELETE /api/ingredients/:id`), backed by Azure
    Table Storage in production (`server/store.js`) with a local JSON-file fallback for
    zero-setup local dev.
  - New `src/nutrition/data/ingredientApi.ts` fetch client; `NutritionApp.tsx` fetches the
    shared library on mount and merges it with the built-in `INGREDIENT_LIBRARY` catalog.
  - Strict server-side allow-list validation (`server/validate.js`) + rate limiting on the
    save/delete endpoints; see `server/__tests__/validate.test.js`.
  - New `.github/workflows/azure-webapp-deploy.yml` (Azure App Service, Node 20 Linux) and
    `docs/DEPLOYMENT.md` documenting the Azure setup + every environment variable. The
    workflow authenticates to Azure via OpenID Connect (`azure/login@v2` + federated
    credentials) rather than a publish-profile secret, per Microsoft's current guidance.
  - `.gitignore` grew a `.env`/secrets block and a local ingredient-library fallback-file
    exclusion; the reference PDFs/Excel/images/graphics in this repo are not confidential
    and stay tracked in git as before.
- **New DEM surrogate model process write-up.**
  [`src/packaging/model/SURROGATE_CREATION_PROCESS.md`](../src/packaging/model/SURROGATE_CREATION_PROCESS.md)
  documents, step-by-step and with rationale, how the packing-fraction surrogate was built —
  from the Aspherix DEM setup through the Gaussian Process fits to the TypeScript port that
  now runs live in the app. Written for a DEM-side reviewer handing this off, not a software
  engineer (see `HANDOFF_PACKAGING.md` for that side).

## [0.2.0] — 2026-07-07

### Changed
- **Reorganised the source tree into clear modules** so the two apps no longer
  share one flat `components/` folder:
  - `src/packaging/` — the DEM / Virtual Solid Filler module (app shell,
    `components/`, `data/`, and the `model/` surrogate).
  - `src/nutrition/` — the Nutrition Calculator module (app shell,
    `components/`, and the existing calculation `engine/` + tests).
  - `src/shared/` — pieces used by both modules (Header, MetricCard, HomePage,
    DisclaimerBanner, icons).
- Moved `src/utils/surrogateModel.ts` → `src/packaging/model/surrogateModel.ts`.
- Moved `src/data/*` → `src/packaging/data/*`.
- Rewrote code comments in a plainer, lower-key style and added "edit this file
  to change X" pointers throughout the packaging module.

### Added
- `CHANGELOG.md` (this file) and `HANDOFF.md` (developer handoff guide).
- Version-control scaffolding: expanded `.gitignore`, `.gitattributes`.

### Notes
- No behaviour changed — this release is a refactor + documentation pass.
  `npm run typecheck` and `npm run test` (98 tests) both pass.

## [0.1.0] — 2026-06

### Added
- Initial prototype: module-picker landing page, Virtual Solid Filler
  (packaging) dashboard with placeholder surrogate model, live 3D gummy fill
  visualization, and the Nutrition Calculator concept module.
