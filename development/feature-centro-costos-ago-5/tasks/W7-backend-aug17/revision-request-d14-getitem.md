# REVISION-REQUEST — D14 hole on GET /items/:itemId

**From**: team-lead quality gate 2026-08-18  
**Owner**: worker-7  
**Failed AC**: D14 / R22 — CONTRATOS must not see histórico.

## Expected
`GET /api/v1/centro-costos/items/:itemId` as CONTRATOS, when the ítem’s `fecha` is **not** the current Bogotá `YYYY-MM`, returns **403** `{ success:false, message: '…mes actual…', field:'fecha' }` — same rule as PUT/DELETE on that path.

## Found
`backend/src/routes/centroCostos.routes.ts` lines 257–276: GET handler has **no** `isContratosRequest` month check. Independent review of the file after T10 COMPLETE.

Everything else in T9/T10 independently verified (migration, 14 centros, fecha→periodo, pagador 400, CONTRATOS 403 on balance / 1999 items / POST centro, GET item 36 + beneficiario, GERONTO 403).

## Do
1. Add the same month guard as PUT/DELETE.
2. Add one smoke spec for it.
3. Do not change other routes.
4. Write a short note in `progress-report.md` + reply `COMPLETE:` with curl + spec output.
