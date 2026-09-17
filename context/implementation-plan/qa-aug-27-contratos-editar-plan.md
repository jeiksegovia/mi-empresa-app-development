# Plan: qa-contratos Contrato Laboral + unlocked editar (3rd pass)

**Path**: `context/implementation-plan/qa-aug-27-contratos-editar-plan.md`  
**Date**: 2026-08-27  
**Status**: IMPLEMENTED + committed + staged. F4 centro-costos is **out of this file** (other session).

| Commit | What |
|---|---|
| `745242c` | F2 API + F3 GET+POST cargos + nested editar tabs unlocked + cargo required UI |
| `cca4dd7` | Leftover F2 UI (`Agregar contrato` / row actions) + F1 certificados read-only |

Staging: CodeDeploy **`d-C9QWA4NDL`** (F2/F3) then **`d-1G7ST2PDL`** (F1 + leftover F2 UI) · Amplify **job 18** then **job 19**.

---

## Root-cause chain (why 3rd time)

1. **Pass 1 (aug-6)**: POST/PUT/DELETE `/nomina/employees/:id/contratos*` used `requireRole('ADMIN')`. Fixed to `requireEmployeeUnlocked`.
2. **Pass 2 (aug-17)**: dialog needs `GET /empresa/cargos`. Matrix `CONTRATOS.empresa = false` 403'd GET. GET-only exception shipped. POST cargos still 403.
3. **Pass 3 (`745242c`)**: POST `/empresa/cargos` still ADMIN; UI omitted `cargoId` ("Sin cargo") → 400; nested editar tabs still `requireRole('ADMIN')`.
4. **Pass 3 leftover (`cca4dd7`)**: **Agregar contrato** and row edit/activate were still `v-if="authStore.isAdmin"` so Carolina never saw the add button even after the API was open. That is the live “no add-contract UI” bug.

JWT has `rol` not `tipoEmpleado`. Cargos exception loads tipo from DB. Uploads are auth-only (not the 403).

---

## Locked product decisions (2026-08-27)

| Q | Decision |
|---|---|
| Cargos catalog (F3) | CONTRATOS **GET + POST**. No PATCH/DELETE. `empresa` matrix stays **false**. |
| cargoId | **Required**. No "Sin cargo" on create. |
| Editar tabs (F2+) | CONTRATOS mutate **every** editar tab when **unlocked**. Locked → no mutate. Lock/unlock stays ADMIN. |
| F1 certificados | CONTRATOS + GERONTOLOGA **read-only** (view/print/download). ADMIN writes. |
| F4 | **Not this plan.** |

---

## Implementation (all edits)

### BE — `backend/src/routes/empresa.routes.ts` (`745242c`)
- Exception **GET + POST** for `EMPLEADO+CONTRATOS` on `/empresa/cargos` only.
- PATCH/DELETE stay `requireDomain('empresa')` + `requireRole('ADMIN')`.
- Matrix `CONTRATOS.empresa` stays **false**.

### BE — `backend/src/routes/employees.routes.ts` (`745242c`)
`requireRole('ADMIN')` → `requireEmployeeUnlocked('id')` on:
- PUT nucleo-familiar, contactos-emergencia, experiencias-laborales, educacion-idiomas, vehiculos, datos-migracion, certificados
- POST/PATCH/DELETE educacion
- PUT `/:id/cargos` (legacy)
- POST/PATCH/DELETE pendientes, POST/PUT/DELETE novedades

Keep ADMIN: `PUT /:id/lock`, `PUT /:id/unlock`.

### FE — `frontend/app/pages/empleados/[id]/editar.vue`
**In `745242c`:**
- Require `cargoId` before `saveContrato`; always send `cargoId` in payload.
- Drop "Sin cargo" from cargo options.
- `lockedForMe` early-return on saveNucleo, saveHojaVida, saveLaboral, saveEducacion, saveCertificados, saveContrato, saveNewCargo.
- `:disabled="lockedForMe"` on Guardar buttons (núcleo, laboral, educación, certificados, contrato, nuevo cargo).
- Hoja de vida: later merged `:disabled="hojaVidaUploading || lockedForMe"` (duplicate attr broke `nuxt generate`; shipped Amplify job 18, landed in working tree then `cca4dd7` file).

**In `cca4dd7` (leftover F2 UI):**
- **Agregar contrato**: `v-if="authStore.isAdmin"` → `v-if="!lockedForMe"`.
- Row actions (activate/edit/download): same `isAdmin` → `!lockedForMe`.

### F1 (same `cca4dd7`, not F2/F3 but same commit)
- `domainAccess.ts` + `useDomainAccess.ts`: GERONTOLOGA + CONTRATOS `certificados: 'read-only'`.
- `certificados/crear.vue`: redirect if `isReadOnly('certificados')`.
- API POST/PUT/DELETE already `requireRole('ADMIN')`; matrix now 403 `DOMAIN_FORBIDDEN` before that.

### Tests
- `backend/tests/empresa/contratos-get-cargos.spec.ts` — POST cargos **201**; PATCH/DELETE 403; GERONTO GET/POST 403.
- `backend/tests/employees/contratos-editar-tabs-unlocked.spec.ts` — nucleo 200/locked 403; contrato no cargoId 400; with cargoId 201.
- `backend/tests/certificates/certificados-read-only.spec.ts` — F1 GET 200, writes 403.
- `backend/tests/rbac/matrix-parity.spec.ts` — certificados `'read-only'`.

No schema/migration for F2/F3/F1.

---

## What this plan file originally missed

The first version of this file stopped at `745242c` and still said “Not committed. Not deployed.” It did **not** list:
1. `Agregar contrato` / row actions still `isAdmin` (the live UI hole).
2. Duplicate `:disabled` FE build fix.
3. Deploys `d-C9QWA4NDL` / job 18 then `d-1G7ST2PDL` / job 19.
4. F1 matrix (separate cleaned item, same later commit).

That gap is why Carolina could still miss the add button after the first staging ship.

---

## Out of scope
- F4 centro-costos date toggle (other session)
- F5 auto-lock (unsettled)
- F6 slim create form (no field list)
- Permanent qa-profesor / qa-auxiliar SSM users
