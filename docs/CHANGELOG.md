# Changelog

All notable changes to the PHC Modeling Suite prototype are recorded here.
This project uses [semantic versioning](https://semver.org): `MAJOR.MINOR.PATCH`.

While the suite is a prototype we stay on `0.x` — anything can still move.

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
