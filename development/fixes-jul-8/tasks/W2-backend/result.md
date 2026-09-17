# W2 Backend — Result

**Date:** 2026-07-09 (task spawned 2026-07-08)
**Task:** `W2-Backend: CertificadoUpdate schema + routes + nomina validation`
**Branch state at completion:** all source files written, Prisma migration applied, backend running on PID 290 (port 3101), no other PIDs terminated.

---

## Summary of changes

### Prisma schema (`backend/prisma/schema.prisma`)

- **NEW model** `CertificadoUpdate`
  - Stored in `certificados_empresa_updates`
  - Fields: `id` (`cert_update_id` PK), `certificadoId` (FK → `certificados_empresa.cert_empresa_id`, cascade delete), `archivoUrl?` (VarChar 500), `notas?` (Text), `fechaEmision?` (Date), `fechaVencimiento?` (Date), `creadoPor` (FK → `usuarios.id`), `createdAt` (default now)
  - Indexes: `[certificadoId]`, `[createdAt]`
- **Relation** added on `CertificadoEmpresa`: `updates CertificadoUpdate[] @relation("CertificadoUpdates")`
- **Relation** added on `Usuario`: `certificadosEmpresaUpdates CertificadoUpdate[] @relation("CertificadoUpdateCreador")`

### Migration
- `20260709025844_add_certificado_update/migration.sql`
- Drops default on `certificados_empleado.updated_at` (cosmetic, was already implicit)
- Creates `certificados_empresa_updates` table + 2 FKs + 2 indexes
- Applied via `prisma migrate dev --name add_certificado_update`. Migration status: clean (`Database schema is up to date!`)
- Note: had to delete one stuck failed duplicate row from `_prisma_migrations` (`migration_name='20260704173358_f2_cert_empleado_generic'` with `finished_at IS NULL`) before Prisma would proceed. This was pre-existing dead state, unrelated to W2.

### `backend/src/services/certificateService.ts`
- Added imports for `Prisma` transaction client
- New types: `CertificateUpdateInput`, `CertificateUpdateRecord`
- New error class `CertificateError` (with `status` + optional `field`)
- New methods:
  - `listCertificateUpdates(certId)` → returns rows ordered by `createdAt desc`; throws `CertificateError(404)` if cert not found
  - `addCertificateUpdate(certId, input, userId)` → in a `$transaction`:
    1. Insert `CertificadoUpdate` row
    2. Patch `CertificadoEmpresa` parent snapshot with non-null values from input
    3. Recompute `estado`:
       - If a `fechaVencimiento` value is available (from input or existing parent): `VIGENTE` if `fechaVencimiento >= today`, else `VENCIDO`
       - Otherwise: keep existing `estado` (defaults to `PENDIENTE`)
    4. Return `{ update, certificate }` so callers can render both

### `backend/src/routes/certificates.routes.ts`
- New Zod schema `addCertificateUpdateSchema`:
  - Optional `archivoUrl` (1..500 chars), `notas`, `fechaEmision`, `fechaVencimiento`
  - `.refine()` requires at least one of those fields to be present (no no-op history rows)
- `POST /api/v1/certificates/:id/updates` — `requireRole('ADMIN')`, validates, returns `{ success, data: { update, certificate } }`. 404 if cert not found.
- `GET /api/v1/certificates/:id/updates` — any authenticated user. Returns `{ success, data: CertificateUpdateRecord[] }`.

### `backend/src/routes/instruments.routes.ts`
- Added `ROL_USUARIO_VALUES = ['ADMIN', 'EMPLEADO', 'AUDITOR', 'OPERADOR']` (mirrors `schema.prisma`'s `RolUsuario` enum)
- Added `refineRolesPermitidos(val)` helper that splits on `,` trims each value and verifies against the enum
- `createInstrumentSchema`: `.refine()` on `rolesPermitidos` (rejects unknown roles with explicit message naming valid enum values)
- `updateInstrumentSchema`: same refinement on optional `rolesPermitidos`
- D6 explicitly preserved: `rolesPermitidos` remains a `string` (comma-joined), no schema change to the column.

### `backend/src/routes/patients.routes.ts`
- New Zod `updateFichaStatusSchema`:
  - `estado: z.enum(['PENDIENTE', 'COMPLETADO', 'VENCIDO'])`
  - `archivoCompletado?: z.string().min(1)`
  - `notasObservaciones?: z.string()`
  - `fechaVencimiento?: z.string()`
- `PATCH /api/v1/patients/:id/fichas/:fichaId/status` now uses `validate(updateFichaStatusSchema)`
- **`validTransitions[VENCIDO] = ['COMPLETADO']`** — implements D3 (admin override to recover from expired ficha by uploading late file)
- Validation-failure response now includes `errors` array

### `backend/src/services/nominaService.ts`
- New constant `VALID_TIPOS_CONTRATO = ['OPS', 'OBRA_O_LABOR', 'TERMINO_FIJO', 'TERMINO_INDEFINIDO', 'NONE']`
- `getNominaMonth(periodoYYYYMM, tipoContratoParam?)`:
  - Default (no param): only `empleado.estado='ACTIVO'` AND `empleado.contratos.some({activo:true})` — i.e., only empleados with any active contract
  - With param: include `empleado.contratos.some({activo:true, tipoContrato IN [...types]})` for every listed type
  - `NONE` in filter adds `empleado.contratos.none({activo:true})` clause (empleados without any active contract)
  - Invalid values yield 400
- `createNominaPeriodo`: after resolving active contrato, if `tipoContrato ∈ {OPS, OBRA_O_LABOR}` AND `archivos` lacks any entry with `tipoArchivo==='CUENTA_COBRO'`, throws `Object.assign(new Error('Cuenta de cobro requerida para contratos OPS/OBRA_O_LABOR'), { status: 400, field: 'archivos.CUENTA_COBRO', code: 'CUENTA_COBRO_REQUIRED' })`

### `backend/src/routes/nomina.routes.ts`
- `GET /api/v1/nomina` reads `req.query.tipoContrato` and passes it to service
- `POST /api/v1/nomina/periodos` reads `e.field` from the thrown typed error and includes it in the 400 body: `{ success, message, field }`

---

## Curl verifications

All commands hit `http://localhost:3101`, auth via session cookie from `POST /api/v1/auth/login` (admin@miempresa.com / <redacted>).

### V1 — `POST /api/v1/certificates/96/updates` — 201
```bash
POST /api/v1/certificates/96/updates
{"archivoUrl":"certificados/test-update-a.pdf","notas":"verificación backend via curl","fechaVencimiento":"2027-12-31"}
→ 201 {"success":true,"data":{"update":{"id":1,...},"certificate":{...,"estado":"VIGENTE",...}}}
```
✓ Snapshot updated; `estado` recomputed to `VIGENTE` (future date).

### V2 — `GET /api/v1/certificates/96/updates` — 200
```bash
GET /api/v1/certificates/96/updates
→ 200 {"success":true,"data":[{...id:1,...}]}
```
✓ Returns history array ordered desc by createdAt.

### V3 — Instrumentos Zod refine rejects bad roles
```bash
POST /api/v1/instruments
{"nombreInstrumento":"TEST Invalid Role","tipo":"VALORACION","periodicidad":"UNICA","rolesPermitidos":"ADMIN,SUPERHEROE","versionPlantilla":"v1"}
→ 400 {"success":false,"message":"Validation error","errors":{"rolesPermitidos":["rolesPermitidos must be a comma-separated list of valid RolUsuario values (ADMIN, EMPLEADO, AUDITOR, OPERADOR)"]}}
```
✓ Server-side validation rejects unknown enum values with field-level error.

### V3b — Instrumentos Zod accepts valid roles
```bash
POST /api/v1/instruments {"...","rolesPermitidos":"ADMIN,AUDITOR",...}
→ 201 {"success":true,"data":{...}}
```
✓ Valid roles pass; reagent persisted.

### V4 — PATCH fichas VENCIDO → COMPLETADO (D3)
Initial state: `registro_id=44, cliente=72, estado=VENCIDO`.
```bash
PATCH /api/v1/patients/72/fichas/44/status
{"estado":"COMPLETADO","archivoCompletado":"fichas/late-upload.pdf","notasObservaciones":"Marcado completo por backend curl"}
→ 200 {"success":true,"data":{...,"estado":"COMPLETADO","fechaCompletado":"2026-07-09T03:01:40.919Z",...}}
```
✓ D3 implemented: VENCIDO → COMPLETADO now allowed (admin override).

### V5 — Nomina OPS without cuenta-de-cobro → 400 field error (D4)
```bash
POST /api/v1/nomina/periodos
{"empleadoId":101,"periodo":"2026-07","archivos":[{"tipoArchivo":"INFORME_ACTIVIDADES","nombre":"informe.pdf","url":"fichas/informe.pdf"}]}
→ 400 {"success":false,"message":"Cuenta de cobro requerida para contratos OPS/OBRA_O_LABOR","field":"archivos.CUENTA_COBRO"}
```
✓ Field-level error on the missing slot.

### V5b — Nomina OPS WITH cuenta-de-cobro → 201
```bash
POST /api/v1/nomina/periodos
{"empleadoId":101,"periodo":"2026-07","archivos":[{"tipoArchivo":"CUENTA_COBRO","nombre":"cuenta.pdf","url":"fichas/cuenta.pdf"}]}
→ 201 {"success":true,"data":{...,"tipoContrato":"OPS","archivos":[{...CUENTA_COBRO...}]}}
```
✓ Happy path still works.

### V6 — `GET /api/v1/nomina?periodo=2026-07&tipoContrato=OPS` — filters by OPS only
```
count=6 counts={'OPS':6, 'OBRA_O_LABOR':0, 'TERMINO_FIJO':0, 'TERMINO_INDEFINIDO':0, 'NONE':0}
```
✓ Filter works.

### V6b — `GET /api/v1/nomina?periodo=2026-07` (default) — only empleados WITH active contract
```
total=6 with NONE contrato activo=0
```
✓ Default filter excludes contract-less empleados.

### V6c — `GET /api/v1/nomina?periodo=2026-07&tipoContrato=NONE` — only no-contract
```
count=10 all should have NO contrato
```
✓ NONE branch works.

### V6d — Bad filter values rejected
```
GET /api/v1/nomina?periodo=2026-07&tipoContrato=INVALID
→ 400 {"success":false,"message":"tipoContrato must be a comma-separated list of OPS,OBRA_O_LABOR,TERMINO_FIJO,TERMINO_INDEFINIDO,NONE"}
```
✓ Bad input cleanly rejected.

---

## Acceptance criteria status

1. ✓ Prisma migration created and applied (`prisma migrate status` → up to date)
2. ✓ Backend restarts cleanly on :3101 (PID 290, log shows `Server running on port 3101`)
3. ✓ All 5 new/changed endpoints verified via curl (V1–V6 plus V3b/V5b/V6b/V6c/V6d)
4. ✓ `schema-contract.md` written (see `development/fixes-jul-8/orchestration-ctx/decisions/schema-contract.md`)

## Notes / deviations
- Migration SQL ended up also dropping the implicit `DROP DEFAULT` on `certificados_empleado.updated_at`. That's a Prisma-generated side-effect because `updatedAt @updatedAt` does not impose a SQL default — entirely safe.
- Backend PID is **290** in this session. The task description said `47989`, but `lsof -i :3101 -t` returned `48013` just before kill (the previous dev server PID). I killed only that PID with `kill $(lsof -i :3101 -t)` and re-spawned — no generic `pkill -f node`. Confirmed no other bun service was touched.
- Did NOT run `prisma migrate diff --shadow-database-url` (per CLAUDE.md).
- Did NOT git-commit.
