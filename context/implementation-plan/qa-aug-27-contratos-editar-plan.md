# Plan: qa-contratos Contrato Laboral + unlocked editar (3rd pass)

**Date**: 2026-08-27  
**Status**: IMPLEMENTED 2026-08-27 (local tests 17/17). Not committed. Not deployed.  
**Why 3rd time**: each prior fix opened one layer and left the next 403/400 in the same UI flow.

## Root-cause chain (step by step)

1. **Pass 1 (aug-6)**: POST/PUT/DELETE `/nomina/employees/:id/contratos*` used `requireRole('ADMIN')`. Fixed to `requireEmployeeUnlocked`. Domain `nomina` already allows CONTRATOS.
2. **Pass 2 (aug-17)**: dialog needs `GET /empresa/cargos`. Matrix `CONTRATOS.empresa = false` 403'd every empresa route. Fixed GET-only exception. Staging QA: GET 200, POST cargos still 403.
3. **Pass 3 (this)**: dialog still fails for CONTRATOS because:
   - **POST `/empresa/cargos`** ("Agregar otro cargo…") is still `requireDomain('empresa')` + `requireRole('ADMIN')`.
   - **UI sends no `cargoId`** if user leaves "Sin cargo" — Zod requires `cargoId` → 400 (looks like permission).
   - **All other editar tabs** except Datos personales still `requireRole('ADMIN')` on nested employee PUTs (núcleo, laboral, educación, certificados, …).
   - JWT has `rol` not `tipoEmpleado`; GET cargos exception already loads tipo from DB. Must keep that pattern on POST cargos.

Uploads (`POST /uploads/presigned-url`) are auth-only — not the 403.

Lock: `PUT /employees/:id` already `requireEmployeeUnlocked`. Nested tabs do **not**. User: locked → CONTRATOS cannot mutate any tab.

## Locked product decisions (2026-08-27)

| Q | Decision |
|---|---|
| Cargos catalog | CONTRATOS **GET + POST** cargos. No PATCH/DELETE. `empresa` matrix stays **false**. |
| cargoId | **Required**. UI must not save without a real cargo. Remove "Sin cargo" on create. |
| Editar tabs | CONTRATOS mutate **every** editar tab when **unlocked**. Locked → no mutate any attr. Lock/unlock stays ADMIN. |

## Implementation

### BE — `empresa.routes.ts`
Rename/extend GET exception to **GET + POST** for `EMPLEADO+CONTRATOS` on `/empresa/cargos` only. PATCH/DELETE stay ADMIN + `requireDomain('empresa')`.

### BE — `employees.routes.ts`
Replace `requireRole('ADMIN')` with `requireEmployeeUnlocked('id')` on nested employee mutations used by editar:

- PUT nucleo-familiar, contactos-emergencia, experiencias-laborales, educacion-idiomas, vehiculos, datos-migracion, certificados
- POST/PATCH/DELETE educacion
- PUT `/:id/cargos` (legacy collection — same lock rule)

Keep ADMIN-only: `PUT /:id/lock`, `PUT /:id/unlock`.

Pendientes/novedades: same lock rule (employee attrs, even if not on editar tabs).

`requireDomain('empleados')` already allows CONTRATOS.

### FE — `empleados/[id]/editar.vue`
- Require `cargoId` before save (toast Spanish). Drop "Sin cargo" from create options.
- Keep "Agregar otro cargo…" (POST now allowed).
- `lockedForMe` on **every** save (today only `savePersonal` + one button). Disable all Guardar when locked.

### Tests
- Extend `contratos-get-cargos.spec.ts`: CONTRATOS POST cargo **201**; PATCH/DELETE still **403**; GERONTOLOGA GET still 403.
- New/extend editar flow spec: unlocked CONTRATOS PUT nucleo-familiar **200**; locked **403 EMPLOYEE_LOCKED**; POST contrato without cargoId **400**; with cargoId **201**.
- FE mocked: no "Sin cargo" on new contrato; save blocked without cargoId.

No schema/migration. No `empresa` matrix flip.

## Out of scope
- Permanent qa-profesor/auxiliar SSM users
- Centro-costos QA
- Commit unless asked
