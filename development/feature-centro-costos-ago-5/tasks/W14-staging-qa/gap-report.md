# Gap report — W14 Staging QA (worker-14)

**Date**: 2026-08-19  
**Run**: deeper live smoke after R4+R5 deploy (`d-IUQUHA58L` / Amplify job 17 / 30 migrations).

## Result: **no gaps**

All 46 live checks passed against the contract. See `results.log` (32 primary) + `supplement.log` (14 supplementary).

## Coverage evidence

| Contract ID | Evidence | Command / log line |
|---|---|---|
| R18 8 INGRESOS D12 names | `[OK] INGRESOS D12 names` | `smoke.log` line "R18 CATALOG" |
| R18 no exact Transporte | `[OK] no exact Transporte` | `smoke.log` |
| R18 EGRESOS 6 orden 9-14 | `[OK] EGRESOS count=6` + `[OK] EGRESOS orden=9..14` | `smoke.log` |
| R21 CONTRATOS POST/PUT/DELETE centro 403 | 3 OK lines | `smoke.log` "R21 CONTRATOS CENTRO MUTATIONS" |
| R22 CONTRATOS /balance 403 | `[OK] CONTRATOS /balance?periodo=current → 403` | `smoke.log` |
| R22 CONTRATOS /items?periodo=1999-01 403 field=periodo | `[OK] CONTRATOS /items?periodo=1999-01 → 403 field=periodo (D14 route-level)` | `smoke.log` |
| R24 ADMIN EGRESOS create+delete | 3 OK lines | `smoke.log` "R24 ADMIN EGRESOS CREATE+DELETE" |
| R25 missing pagador → 400 field=pagador | `[OK] missing pagador → 400 field=pagador` | `smoke.log` |
| R26 unpriced centro → 400 field=precioUnitario | `[OK] unpriced centro → 400 field=precioUnitario` | `smoke.log` |
| R31 GET /items/:id shape | `[OK] GET /items/:id has centro.id` + `[OK] GET /items/:id has beneficiario` | `smoke.log` |
| R31 CONTRATOS historical 403 field=fecha | `[OK] CONTRATOS historical /items/:id → 403 field=fecha` | `smoke.log` |
| D14 CONTRATOS current month GET 200 | `[OK] CONTRATOS GET current-month item → 200` | `smoke.log` |
| D14 CONTRATOS current month PUT 200 | `[OK] CONTRATOS PUT current-month item → 200` | `smoke.log` |
| FE /centro-costos 200 | `[OK] FE /centro-costos → 200` | `smoke.log` |
| FE /login 200 | `[OK] FE /login → 200` | `smoke.log` |
| FE regression pages | 5 OK lines (/empleados /nomina /asistencia /pacientes /) | `smoke.log` |
| RBAC GERONTOLOGA → 403 DOMAIN_FORBIDDEN | 4 OK lines (root + ?tipo + /balance + /items) | `supplement.log` |
| RBAC CONTRATOS matrix:true root GET → 200 | 2 OK lines | `supplement.log` |
| D14 vs DOMAIN_FORBIDDEN classification | 2 OK lines (route-level 403 has no `code`) | `supplement.log` |
| Envelope /balance shape | `[OK] ADMIN /balance has all expected fields` + `[OK] balance = totalIngresos - totalEgresos` | `supplement.log` |
| Envelope empty-month zeros (never 404) | 2 OK lines | `supplement.log` |
| Envelope /balance missing periodo | `[OK] missing periodo on /balance → 400 field=periodo` | `supplement.log` |
| Envelope POST /:id/items missing fecha | `[OK] POST /:id/items missing fecha → 400 field=fecha` | `supplement.log` |

## Minor corrections to prior coverage (informational only — not bugs)

- **worker-13 R5 row #9 mislabeled**: `qa-contratos GET /centro-costos/items?periodo=1999-01 → 403 DOMAIN_FORBIDDEN`. The matrix cell is `CONTRATOS.centro-costos = true`, so requireDomain passes; the D14 route-level check returns `field: 'periodo'`. This run confirmed the D14 route-level check is in effect — not DOMAIN_FORBIDDEN. The earlier note should be read as `403 field=periodo`.
