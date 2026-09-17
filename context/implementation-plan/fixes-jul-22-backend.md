# fixes-jul-22 backend implementation

## Task definition

Implement the Jul-22 backend contract and APIs for patient estado authorization, versioned TINETTI/MNA definitions, the new VALORACION_INTEGRAL template, upgrade/seed activation, and backend smoke coverage.

## Plan

1. Lock the patient/instrument schema contract and implement server-side estado authorization.
2. Publish immutable TINETTI/MNA v2 definitions and extend group-info validation for text cells.
3. Model VALORACION_INTEGRAL from the first workbook sheet and expose its template/upgrade path.
4. Add file, database, scoring, and live API smokes; run build and regression checks.

## Output summary

- Contract: `development/fixes-jul-22/orchestration-ctx/decisions/schema-contract-fixes-jul-22.md`.
- Patient create by CONTRATOS always persists ACTIVO; only ADMIN and GERONTOLOGA can update estado.
- Added `TINETTI.v2.json` (max 27), `MNA_CUADRO.v2.json` (`cellInput: "text"`), and `VALORACION_INTEGRAL.v1.json` (11 sections, 47 informational items).
- Seed chooses highest template versions; upgrade creates missing template instruments and activates highest definitions while preserving VERSION_LOCKED checks.
- Added Jul-22 patient/API/template smokes and updated v2 regressions.
- Final verification: backend typecheck/build passed; upgrade was idempotent; 60 scoped Playwright tests passed. Full command output: `development/fixes-jul-22/tasks/W1-backend/tmp/final-verification.log`.

No Prisma migration, frontend source change, production action, or git commit was performed by W1.
