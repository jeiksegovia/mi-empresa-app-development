# QA sep-2 — implementation plan

**Source**: `context/user-feedback/qa-session-sep-2-cleaned.md`  
**Date**: 2026-09-02  
**Deploy**: staging only (`disruptive`, group `miempresa-staging`). Never prod.

## F1 GERONTOLOGA certificados create-only

- Matrix `GERONTOLOGA.certificados`: `'read-only'` → `'create-only'` (BE + FE).
- POST `/certificates` drops `requireRole('ADMIN')`; domain middleware allows GERONTOLOGA POST.
- PUT/DELETE/POST updates stay ADMIN.
- FE: `Nuevo Certificado` for ADMIN **or** `canCreateOnly('certificados')`. Edit/delete stay ADMIN.
- CONTRATOS stays read-only.

## F2 Valoración integral v2

- New template `VALORACION_INTEGRAL.v2.json`: drop `tipo_documento` … `sexo` from `datos_generales`. Keep `fecha_ingreso` onward.
- Activate via `npm run instruments:upgrade` (local + staging `FORCE_UPGRADE=true`). Does not mutate existing fichas on v1.

## F3 Typed valorUnitario on every ítem

- `createItem` / `updateItem`: INGRESOS uses client `valorUnitario` (400 if missing/≤0). No copy from `centro.precioUnitario`.
- FE dialog: InputNumber for ingresos and egresos. Empty on create.

## F4 Valoraciones same ingreso form

- Seed + startup UPDATE: `ocultarBeneficiario=false` for Valoraciones. Beneficiario required again.

## F5 Recibo letterhead En Casa

- Recibo already reads `GET /empresa.nombre`. Staging PUT ADMIN `{ nombre: "En Casa" }` (uppercased). No code change.

## Tests

- `backend/tests/certificates/certificados-read-only.spec.ts` GERONTOLOGA POST 201
- `backend/tests/centro-costos/*` F3/F4
- `backend/tests/instruments-dynamic/seed-definitions.spec.ts` v2
- `frontend/tests/centro-costos/centro-costos-smoke.spec.ts`
- `backend/tests/rbac/matrix-parity.spec.ts`
