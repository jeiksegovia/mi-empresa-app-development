# Decision Record — Intake Questions (2026-07-16)

Answered by developer via AskUserQuestion before architecture/plan creation.

| # | Question | Decision | Implications |
|---|----------|----------|--------------|
| D1 | Instrument definition management | **Seed-only, versioned** + a code utility script that upgrades JSON instrument definitions programmatically from base JSON templates in the repo. Unit tests MUST confirm the JSON schema matches the rendered elements. | No admin builder UI. Base JSON templates live in repo; script imports/upgrades them into DB (new version rows). Schema↔render unit tests are a hard requirement. |
| D2 | Legacy file-based fichas | **Hard reset.** | Migration drops/ignores legacy `RegistroFichaCompletada` file data and `plantillaArchivo`. Staging ficha history is intentionally lost. No read-only legacy path. |
| D3 | Scoring model richness | **Sections + subtotals + conditional logic.** | Schema supports sections with subtotals, total = sum, classification ranges (`result-evaluation`), and conditional section-skip rules (MNA screening ≥ 12 → full assessment skippable). Yesavage direction-scoring handled via per-option score values. |
| D4 | Non-scored items | **Yes — score-less item types.** | Informational item types (text, number, select, table-like groups) with no score contribution. Required for MNA + Cuadro de Alimentos merge and Ficha Nutricional. |
