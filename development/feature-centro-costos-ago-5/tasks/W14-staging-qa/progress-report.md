# W14 Staging QA — progress report (worker-14, pt-test-quality)

**CWD**: `/Users/jeik/ws/mi-empresa-app-development`  
**Date**: 2026-08-19  
**API**: `https://miempresa-api-stg.disruptiveexp.com/api/v1`  
**FE**: `https://miempresa-stg.disruptiveexp.com` (custom domain only)

## Preconditions
- CodeDeploy `d-IUQUHA58L` (R4+R5) ✅
- Amplify job 17 ✅
- 30 migrations ✅
- Catalog 8 INGRESOS / 6 EGRESOS ✅

## QA credentials (from SSM, via disruptive profile)
- `qa-admin@miempresa.com` (ADMIN)
- `qa-gerontologa@miempresa.com` (EMPLEADO/GERONTOLOGA)
- `qa-contratos@miempresa.com` (EMPLEADO/CONTRATOS)

## Plan vs actual

| ID | Check | Status |
|---|---|---|
| R18 | 8 INGRESOS D12 names; no exact Transporte; EGRESOS 6 | ✅ |
| R21 | CONTRATOS POST/PUT/DELETE centro 403 | ✅ |
| R22 | CONTRATOS /balance 403; /items?periodo=non-current 403 field=periodo | ✅ |
| R24 | ADMIN POST EGRESOS fecha=today → periodo YYYY-MM-01; then DELETE | ✅ |
| R25 | INGRESOS missing pagador → 400 field=pagador | ✅ |
| R26 | Unpriced INGRESOS centro → 400 field=precioUnitario | ✅ |
| R31 | GET /items/:id 200 shape (centro.id, beneficiario); CONTRATOS historical 403 field=fecha | ✅ |
| D14 | CONTRATOS GET item current month 200; PUT current 200; historical 403 | ✅ |
| FE | /centro-costos 200; /login 200; regression /empleados /nomina /asistencia /pacientes / 200 | ✅ |
| RBAC | GERONTOLOGA → 403 DOMAIN_FORBIDDEN on every endpoint | ✅ |
| RBAC | CONTRATOS matrix:true root GET → 200 | ✅ |
| Envelope | /balance 200 shape (porCentro/totalIngresos/totalEgresos/balance); invariant ti-te=b; empty-month zeros | ✅ |
| Envelope | /balance missing periodo → 400 field=periodo | ✅ |
| Envelope | POST /:id/items missing fecha → 400 field=fecha | ✅ |

## Total: 46 PASS / 0 FAIL / 0 SKIP

## Notes / corrections to prior coverage
- **R5 row #9 was misclassified.** The previous worker-13 R5 row #9 (`qa-contratos GET /centro-costos/items?periodo=1999-01 → 403 DOMAIN_FORBIDDEN`) is **incorrect**: the matrix cell `CONTRATOS.centro-costos = true` so requireDomain passes; the route-level D14 check returns 403 `field: 'periodo'` (not DOMAIN_FORBIDDEN). This run confirms the D14 route-level check is in effect on staging.

## Artifacts
- `smoke.sh` + `results.log` — 32 checks (primary cover table)
- `supplement.sh` + `supplement.log` — 14 checks (RBAC + envelope + classification)
- `completion-report.md` — pass/fail counts + evidence
- `gap-report.md` — empty (none — clean run)
