# W2 Backend — Completion Report

**Task ID:** `2`
**Worker:** Backend engineer (pt-backend-eng)
**Spawned:** 2026-07-08
**Completed:** 2026-07-09
**Status:** ✅ COMPLETE
**Backend PID after restart:** 290 (port 3101)

---

## Deliverables

| File | Description |
|---|---|
| `backend/prisma/schema.prisma` | Edited — added `CertificadoUpdate` model + relations |
| `backend/prisma/migrations/20260709025844_add_certificado_update/migration.sql` | Created — defines the new table, 2 FKs, 2 indexes |
| `backend/src/services/certificateService.ts` | Edited — `addCertificateUpdate`, `listCertificateUpdates`, `CertificateError` class |
| `backend/src/routes/certificates.routes.ts` | Edited — POST/GET `/certificates/:id/updates` + Zod |
| `backend/src/routes/instruments.routes.ts` | Edited — `rolesPermitidos` `.refine()` against `RolUsuario` enum |
| `backend/src/routes/patients.routes.ts` | Edited — Zod on PATCH fichas, `validTransitions[VENCIDO]=['COMPLETADO']` (D3) |
| `backend/src/services/nominaService.ts` | Edited — OPS/OBRA_O_LABOR cuenta-de-cobro validation (D4) + `tipoContrato` filter (D5) |
| `backend/src/routes/nomina.routes.ts` | Edited — pass `tipoContrato` query, surface `field` on 400 |
| `development/fixes-jul-8/tasks/W2-backend/result.md` | Per-curl-verification results + change summary |
| `development/fixes-jul-8/orchestration-ctx/decisions/schema-contract.md` | Interface contract for W4 (RolUsuario enum, request/response shapes, exact DB column names) |

## Maps of W2 scope items to implementation

| Scope item | Status | Evidence |
|---|---|---|
| (1) Add `CertificadoUpdate` model + migration | ✅ | `schema.prisma`, `migration.sql`, `migrate status` clean |
| (2) `addCertificateUpdate` + `listCertificateUpdates` + parent snapshot + estado recompute | ✅ | `certificateService.ts`, V1 + V2 |
| (3) POST + GET `/certificates/:id/updates` with Zod | ✅ | `certificates.routes.ts`, V1 + V2 |
| (4) Instrumentos `rolesPermitidos` Zod `.refine()` vs `RolUsuario` | ✅ | `instruments.routes.ts`, V3 + V3b |
| (5) Fichas Zod + VENCIDO → COMPLETADO transition | ✅ | `patients.routes.ts`, V4 |
| (6) Nomina cuenta-de-cobro validation in service + structured 400 response | ✅ | `nominaService.ts`, V5 |
| (7) Nomina `tipoContrato` query filter | ✅ | `nominaService.ts` + `nomina.routes.ts`, V6 + V6b/c/d |
| (8) `schema-contract.md` for W4 | ✅ | see `orchestration-ctx/decisions/schema-contract.md` |

## Acceptance criteria

1. ✅ Migration created and applied (`migrate status` clean)
2. ✅ Backend restarted on :3101 with no errors (log: `Server running on port 3101 in development mode`)
3. ✅ All endpoints verified (V1–V6 plus happy-path variants)
4. ✅ `schema-contract.md` written with exact field names of new model, full request/response shapes for new endpoints, and `RolUsuario` enum values

## Constraints respected

- ✓ Only PID 48013 (the dev backend on :3101) was killed via `lsof -i :3101 -t | xargs kill`. No `pkill -f node`.
- ✓ Did NOT run `prisma migrate diff --shadow-database-url`.
- ✓ Existing behavior preserved for non-touched endpoints.
- ✓ `rolesPermitidos` kept as `String` (D6).
- ✓ Service→route pattern preserved (routes remain thin).
- ✓ Zod schemas at top of route files.
- ✓ Did NOT git-commit.

## Known issues / handoff notes

- **Prisma migration-lock cleanup.** Before applying the new migration, I had to delete one stuck "failed" row from the existing `_prisma_migrations` table (`migration_name='20260704173358_f2_cert_empleado_generic'`, `finished_at IS NULL`, `applied_steps_count=0`). The duplicate row predated W2 — it blocked `prisma migrate dev` from proceeding with a misleading "We need to reset the schema" message. If W3/W4 hits the same warning, the same single-statement cleanup fixes it.
- **Default `/nomina` behaviour is intentionally narrower than before.** Per D5, `GET /nomina?periodo=...` (no `tipoContrato`) now returns *only* empleados with an active contract. Previously it returned every `ACTIVO` empleado regardless of contract. This is by design — the user explicitly requested this default — but it is a backwards-incompatible change. If the frontend relies on the old behaviour, it must pass `tipoContrato=NONE,OPS,OBRA_O_LABOR,TERMINO_FIJO,TERMINO_INDEFINIDO` explicitly until W3 ships its filter UI.
- **`CertificadoEmpresa` snapshot semantics.** `addCertificateUpdate` writes history rows AND mutates the parent snapshot. The parent thus always reflects the *latest* update. Treat `CertificadoUpdate[]` as audit-trail rows; treat the parent's `archivoUrl`/`fechaEmision`/`fechaVencimiento` as the "current" view. W4 should be aware that re-fetching the cert after a POST `/updates` already shows the new `estado` and dates.
- **`CertificateError` exported.** Routes import it from `services/certificateService.js` only via the error handler check (`e.status === 404`). If W4 wants a new error type from the cert service, expose it via the same `CertificateError` class.

## Ready for W4

`schema-contract.md` is in place. W4 can start any frontend work that depends on these backend changes (CertificadoUpdate history UI on `certificados/[id].vue`, instrumento MultiSelect, ficha-status recovery on `pacientes/[id]/index.vue`, nomina filter UI).
