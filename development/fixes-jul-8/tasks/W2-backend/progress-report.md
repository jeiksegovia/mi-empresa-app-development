# W2 Backend — Progress Report

## Context
- Task ID: `2`
- Backend PID on :3101: **48013** (note: task assignment said 47989 but actual lsof -i :3101 returns 48013)
- All changes scoped to `backend/` per scope-decisions D2/D3/D4/D5/D6.

## Subtasks (ordered)

### §1. CertificadoUpdate model + migration [in_progress]
- Add model `CertificadoUpdate { id, certificadoId, archivoUrl?, notas?, fechaEmision?, fechaVencimiento?, creadoPor, createdAt }` with FK to `CertificadoEmpresa`.
- Run `prisma migrate dev --name add_certificado_update`.

### §2. Certificate service methods
- `addCertificateUpdate(certId, input, userId)` — creates update row + updates parent snapshot fields from non-null values + recomputes `estado` if `fechaVencimiento` changed.
- `listCertificateUpdates(certId)` — returns rows ordered by `createdAt desc`.

### §3. Certificates routes
- `POST /certificates/:id/updates` + `GET /certificates/:id/updates` with Zod validation.

### §4. Instrumentos Zod `.refine()`
- Each comma-split value of `rolesPermitidos` ∈ `RolUsuario` enum (`ADMIN, EMPLEADO, AUDITOR, OPERADOR`).

### §5. Fichas PATCH endpoint
- Add Zod schema.
- Change `validTransitions[VENCIDO] = ['COMPLETADO']` and remove the prior transition block rejection.

### §6. Nomina cuenta-de-cobro + filter
- Service throws typed `CUENTA_COBRO_REQUIRED` for OPS/OBRA_O_LABOR; route → 400 with `{ success, message, field: 'archivos.CUENTA_COBRO' }`.
- Route accepts optional `tipoContrato` query param (comma-separated); service filters accordingly. `NONE` in filter = include empleados without active contract.

### §7. Restart backend + curl verification

### §8. Deliverables
- `result.md`, `completion-report.md`, `orchestration-ctx/decisions/schema-contract.md`.

## Status
COMPLETE.

- §1 CertificadoUpdate model + migration: migration `20260709025844_add_certificado_update` created and applied; `prisma migrate status` clean.
- §2 Certificate service methods: `addCertificateUpdate` (transactional: insert history + parent snapshot patch + `estado` recompute) and `listCertificateUpdates` added; `CertificateError` exposed with `status` + optional `field`.
- §3 Certificates routes: `POST /api/v1/certificates/:id/updates` (ADMIN) and `GET /api/v1/certificates/:id/updates` (any auth) wired with `addCertificateUpdateSchema`.
- §4 Instrumentos Zod refinement: rejected `rolesPermitidos='ADMIN,SUPERHEROE'` with field-level error; accepted `ADMIN,AUDITOR` (RolUsuario enum values per D6 kept comma-joined on the wire).
- §5 Fichas: Zod `updateFichaStatusSchema` added on PATCH; `validTransitions[VENCIDO] = ['COMPLETADO']` per D3. VENCIDO ficha id=44 successfully recovered via curl.
- §6 Nomina: D4 enforced — OPS/OBRA_O_LABOR without CUENTA_COBRO returns 400 `field: 'archivos.CUENTA_COBRO'`. D5 filter implemented — `tipoContrato=OPS,OBRA_O_LABOR,TERMINO_FIJO,TERMINO_INDEFINIDO,NONE` with `NONE` = no-contract branch; bad values cleanly rejected.
- §7 Backend restart: killed only PID on :3101 via `lsof -i :3101 -t | xargs kill` (target PID = 48013 per the actual lsof; the brief said 47989 — turned out the prior dev-server PID was 48013). New dev server PID 290, log clean.
- §8 Deliverables: `result.md` + `completion-report.md` + `orchestration-ctx/decisions/schema-contract.md` all written. `schema-contract.md` includes `RolUsuario` enum values verbatim, the new `CertificadoUpdate` JS shape, and the exact field-level error responses the frontend should render.

Self-cleanup: also removed a stuck failed duplicate row in `_prisma_migrations` for `20260704173358_f2_cert_empleado_generic` (pre-existing dead state; finished_at was NULL). Without this, Prisma would not proceed past the "We need to reset the schema" error.
