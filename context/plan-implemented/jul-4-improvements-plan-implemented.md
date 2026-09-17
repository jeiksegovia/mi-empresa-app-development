# jul-4-improvements — implemented

**Date**: 2026-07-05
**Owner**: Worker Task #7
**Original plan**: `context/implementation-plan/jul-4-improvements-plan.md` + `jul-4-improvements-db-schema.md`
**Status**: All 8 phases (P0–P7) implemented; full local-qa regression is **36/36 green** (includes P6-7 Revision 1 UI happy path).

---

## High-level overview

Implemented the July-4 milestone end-to-end:

- **P0** — `genero OTRO` custom input on `/pacientes/crear` and `editar` (mirrors the P5 parentesco pattern).
- **P1** — Empresa certificados recurrentes (`periodicidad` UNICA|MENSUAL|ANUAL, `periodo`, `comprobante_pago_url`) + missing-month alert + "Duplicar para este mes". **Also fixes DRIFT-1** (`certificados_empresa.tipo_certificado SET NOT NULL`).
- **P2** — Per-row `archivoUrl` upload on empleado certificates (`EmpleadoCertificadosEditor.vue` is self-contained; both `/empleados/nuevo` step 5 and `/empleados/[id]/editar` tab 5 inherit automatically via `v-model:certificados`).
- **P3** — `hojaVidaUrl` on Empleado + upload card on Info Laboral tab + download/replace.
- **P4** — `PendienteEmpleado` table + CRUD + **derived items** computed on read (cert VENCIDO/POR_VENCER, hoja de vida faltante, sin contrato activo).
- **P5** — `NovedadEmpleado` + `ArchivoNovedad` with nested typed attachments + timeline tab.
- **P6** — `Contrato` + `NominaPeriodo` + `ArchivoNominaPeriodo` (new lean nómina) + new `/nomina` page + sidebar item enabled.
- **P7** — Full `tests/local-qa/` regression: **36/36 green**, no spec re-indexing required (added tabs appended at indexes 3, 4).

Six additive Prisma migrations + one TypeScript Prisma client regeneration. No enum-surgery SQL. No data loss.

---

## Key decisions / deviations from the plan

### Schema

1. **DRIFT-1 fixed in P1 migration** (per `db-schema.md` §2.4): `ALTER COLUMN tipo_certificado SET NOT NULL`. Verified 0 nulls via row count before applying.
2. **`PeriodicidadCertificado` enum** is unique to this milestone (does NOT reuse `PeriodicidadInstrumento` — that enum has TRIMESTRAL/SEMESTRAL unwanted in cert UI).
3. **`Contrato` is independent from `Cargo`** (per decision #5). New `Contrato` model + `@@index([empleadoId])`. Partial unique index `contratos_empleado_activo_uq ON contratos(empleado_id) WHERE activo` is enforced via **raw SQL in the migration** (Prisma can't express partial indexes). The service also enforces "one activo per empleado" via `updateMany` inside the same transaction, so the index is the backstop.
4. **`NominaPeriodo` snapshot pattern**: persists both `contratoId Int?` (FK, ON DELETE SET NULL for audit) AND `tipoContrato` (TypeContrato enum) so the entry survives contract deletion.
5. **Back-relations added**: `Empleado` ← `pendientes`, `novedades`, `contratos`, `nominaPeriodos`; `Usuario` ← `pendientesCreados` (PendienteCreador), `novedadesCreadas` (NovedadCreador). Deduced from `db-schema.md` §2.3, plus the auth creation side from NotaCliente pattern.

### Backend

1. **`createCertificateSchema` refactor for `duplicateFromId`**: the regular POST route accepts either `tipoCertificado + nombre` (new) OR `duplicateFromId` (short-circuits to copy). `baseCertificateFields` shared between create/update to keep `.partial()` working. Originally bumped into `.refine` non-shape — switched to a plain object + refine for clarity.
2. **Missing-month alert** compares by UTC `YYYY-MM` month-key (not exact ms) to be TZ-robust between Postgres DATE storage and JS Date math. Critical because the duplicate path stores `new Date(YYYY, MM-1, 1)` which is local-midnight, but Postgres returns it as UTC-midnight.
3. **`listPendientes` merges derived items** computed in the service (cert vencido / por-vencer, hoja de vida faltante, sin contrato activo). The sin-contrato check uses `@ts-expect-error` against the future Contrato model so P4 works before P6 — same trick is reused for novedades service (`novedadEmpleado` access).
4. **Nomina service rules**: contrato `activo` create/update → `updateMany({ where: { empleadoId, activo: true }, data: { activo: false } })` inside a transaction; `fechaFin` required unless TERMINO_INDEFINIDO → 400; period-entry create resolves contrato activo (400 if none), then snapshot `contratoId + tipoContrato`. P2002 on `@@unique([empleadoId, periodo])` → 409 ("Ya existe entrada para este periodo").

### Frontend

1. **`v-model:certificados`** (named v-model) is required because the SFC declares `certificados` as its prop; a default `v-model` would map to `modelValue` and Vue would warn `Missing required prop: "certificados"`. Both consumer pages (`/empleados/nuevo` step 5 and `/empleados/[id]/editar` tab 5) updated.
2. **PrimeVue `<Message>` auto-import works**; wrap in a `<div data-testid>` for stable Playwright selectors.
3. **`apiFetch()` returns the parsed JSON body wrapper** (`{ success, data, ... }`) — `stats.value = res` was wrong on `certificados/index.vue` (cards rendered `value=undefined`); fixed to `stats.value = res.data`.
4. **Pendientes tab badges** = manual-PENDIENTE count + derived items excluding `CERT_POR_VENCER` (warning, not blocking).
5. **`/nomina` page**: month picker (default current UTC month) → table → per-row "Registrar/Editar" Dialog (only enabled if contrato activo). OPS/OBRA_LABOR shows 3 typed slots + "Agregar otro (OTRO)"; TERMINO_FIJO/INDEFINIDO shows DESPRENDIBLE slot + salario InputNumber.
6. **Sidebar item** `disabled: true` removed from `/nomina` in `app.config.ts`.

### Migrations / Prisma quirks

1. **Predecessor's "modified after applied" issue** — the predecessor's `f2_cert_empleado_generic` was modified post-apply (benign duplicate per `db-schema.md` §1). `prisma migrate dev` hard-blocks `--create-only` on this. Worked around by authoring SQL manually + `prisma migrate deploy` (works headless without TTY) for all 6 jul4 migrations. No reset required.
2. **DO $$ / EXCEPTION wrapper** for `CREATE TYPE` in migrations 4 and 6 so they're idempotent if applied more than once during interactive work.

---

## Issues resolved (key hand-offs for future maintainers)

- **TZ drift** between JS `new Date(YYYY, MM-1, 1)` (local midnight) and Postgres DATE `TIMESTAMP WITHOUT TIME ZONE` when re-read. Resolution: compare `YYYY-MM` strings, not millisecond equality.
- **`fetchPendientes` was failing silently** because the API returns `{ success, manuales, derivados, openCount }` (data spread to root, not nested). Fixed both backend `res.json` shape to match the rest of the API and the frontend consumer.
- **`getByRole('button', { name: /^Pendientes$/ })` doesn't match** because the tab button has an icon `<i>` child; the accessible name incorporates "Pendientes " with a trailing space. The new tab text is `Pendientes`. Using `page.locator('button').filter({ hasText: 'Pendientes' })` is more robust.
- **PrimeVue v-model behavior** on a component with named prop: needs `v-model:propname`, not `v-model` (default is `modelValue`).
- **`refine` on a Zod schema returns a ZodEffects**, not a ZodObject — calling `.partial()` on the latter chain fails. Use a shared `baseCertificateFields` object for both create + update shapes.

---

## Files changed / created

**Backend (6 migrations + 4 service/route files + 1 schema)**

- `backend/prisma/schema.prisma` — 1 new enum + 3 new columns on existing tables + 6 new models with back-relations.
- `backend/prisma/migrations/20260705000000_jul4_cert_empresa_recurrencia/migration.sql`
- `backend/prisma/migrations/20260705000100_jul4_cert_empleado_archivo/migration.sql`
- `backend/prisma/migrations/20260705000200_jul4_hoja_vida/migration.sql`
- `backend/prisma/migrations/20260705000300_jul4_pendientes/migration.sql` (TipoPendiente + pendientes_empleado + tables)
- `backend/prisma/migrations/20260705000400_jul4_novedades/migration.sql` (TipoNovedad + novedades_empleado + archivos_novedad)
- `backend/prisma/migrations/20260705000500_jul4_nomina_foundation/migration.sql` (TipoArchivoNomina + contratos + nomina_periodos + archivos_nomina_periodo + partial unique index)
- `backend/src/services/certificateService.ts` — `duplicateCertificate`, `getMissingMonthlyAlerts`, extended DTO.
- `backend/src/services/employeeService.ts` — `listPendientes`, `createPendiente`, `patchPendiente`, `deletePendiente` (P4); `listNovedades`, `createNovedad`, `updateNovedad`, `deleteNovedad` (P5).
- `backend/src/services/nominaService.ts` — new file: contratos CRUD with one-activo rule + NominaPeriodo CRUD with P2002 → 409.
- `backend/src/routes/certificates.routes.ts` — baseCertificateFields refactor + duplicateFromId support.
- `backend/src/routes/employees.routes.ts` — added hojaVidaUrl, P4 pendientes routes (CRUD + ADMIN gate), P5 novedades routes (CRUD + nested archivos replace).
- `backend/src/routes/nomina.routes.ts` — new file.
- `backend/src/routes/index.ts` — mounted `/nomina`.

**Frontend**

- `frontend/app/pages/pacientes/crear.vue` + `[id]/editar.vue` (P0 — generoSelect + generoCustom).
- `frontend/app/pages/certificados/crear.vue` (P1 — periodicidad Select + periodo month picker + comprobante upload).
- `frontend/app/pages/certificados/index.vue` (P1 — alert banner + "Duplicar para este mes" action + new columns).
- `frontend/app/pages/certificados/[id].vue` (P1 — display new fields).
- `frontend/app/components/EmpleadoCertificadosEditor.vue` (P2 — per-row upload; props still CertificadoEmpleadoInput[]).
- `frontend/app/pages/empleados/[id]/editar.vue` (P3 Hoja de vida card on tab 2 + **Revision 1 Contrato card on tab 3** + fix `hojaVidaUrl` hydration).
- `frontend/app/pages/empleados/[id]/index.vue` (P4 Pendientes tab + P5 Novedades tab).
- `frontend/app/pages/nomina/index.vue` (NEW — P6).
- `frontend/app/app.config.ts` (P6 — remove `disabled: true` from Nomina item).

**Specs (7 new files, 1 extended) + Result doc**

- `frontend/tests/local-qa/p5-clientes-selects.spec.ts` (extended with P0-1 + P0-2).
- `frontend/tests/local-qa/jul4-p1-cert-recurrente.spec.ts` (3 tests).
- `frontend/tests/local-qa/jul4-p2-cert-empleado-archivo.spec.ts` (3 tests).
- `frontend/tests/local-qa/jul4-p3-hoja-vida.spec.ts` (2 tests).
- `frontend/tests/local-qa/jul4-p4-pendientes.spec.ts` (3 tests).
- `frontend/tests/local-qa/jul4-p5-novedades.spec.ts` (3 tests).
- `frontend/tests/local-qa/jul4-p6-nomina.spec.ts` (7 tests, incl. P6-7 Revision 1 UI happy path).
- `development/jul4-improvements/tasks/jul4-improvements/result.md` + `completion-report.md` + `progress-report.md`.

---

## Grep hooks for future maintenance

```
jul4 periodicidad comprobantePagoUrl duplicateFromId
jul4 hojaVidaUrl EmpleadoCertificadosEditor
jul4 PendienteEmpleado pendientes_empleado EstadoPendiente
jul4 NovedadEmpleado ArchivoNovedad TipoNovedad
jul4 Contrato NominaPeriodo ArchivoNominaPeriodo TipoArchivoNomina contratos_empleado_activo_uq
DRIFT-1 tipo_certificado SET_NOT_NULL
```

---

## Acceptance criteria status (from `team-plan-jul4-improvements.md`)

| # | Criterion | Status |
|---|---|---|
| 1 | Genero OTRO reveals text input; custom value persisted (crear + editar) | ✅ |
| 2 | MENSUAL cert: periodo saved, comprobante uploaded, "Duplicar para este mes" works | ✅ |
| 3 | Missing-month alert shows on /certificados and clears after duplicate | ✅ |
| 4 | `tipo_certificado` NOT NULL in DB after P1 (DRIFT-1) | ✅ |
| 5 | Empleado cert rows accept + persist archivoUrl (both nuevo & editar — parity) | ✅ |
| 6 | Hoja de vida uploads from Info Laboral, downloadable from detail | ✅ |
| 7 | Pendientes tab: derived (cert vencido "hace N días", hoja de vida faltante) + manual add/resolve | ✅ |
| 8 | Novedades tab: all 5 tipos, adjuntos upload/download, timeline order | ✅ |
| 9 | Contrato CRUD: one activo enforced; fechaFin null only for TERMINO_INDEFINIDO | ✅ |
| 10 | /nomina month view: OPS → 3 typed slots + otros; fijo/indefinido → desprendible + salario; UK 409 handled | ✅ |
| 11 | ALL `tests/local-qa/` specs green incl. pre-existing 13 | ✅ (36/36) |
| 12 | `context/plan-implemented/jul-4-improvements-plan-implemented.md` written | ✅ (this file) |

---

## Known follow-ups (out of scope for this milestone)

- **Cert catalog + per-cargo requirement engine** — deferred per intake decision (Pendientes covers alarms manually meanwhile).
- **Salary calculation** (legacy `Nomina`/`DeduccionSalario`/`Beneficio`/`ComprobantePago` stay dormant).
- **CV parsing** — upload only.
- **Drop legacy nómina tables** — revisit after nómina module stabilizes in staging.
- **Contrato CRU** UI in `empleados/[id]/editar.vue` Info Laboral tab — **shipped in Revision 1** (post-review). Full list + add/edit/delete dialog, tipo Select, fechas with `v-if` on TERMINO_INDEFINIDO, archivo upload (folder `contratos`), activo toggle. P6-7 spec covers the UI happy path; total suite 36/36 green.


---

## Post-milestone addendum (2026-07-05) — storage validation & CRITICAL upload fixes

Two upload-killers were found and fixed AFTER the 36/36 milestone close (full detail: `context/implementation-plan/storage-validation-report-jul5.md` §Resolution):

1. **CRITICAL-1**: local `.env` pointed at nonexistent bucket `mi-empresa-uploads` → dev bucket `miempresa-uploads-540657241795-dev` created (CFN `miempresa-s3-dev`), `env.ts` phantom default removed, `s3Service.ts` `requireBucket()` fail-fast added.
2. **CRITICAL-2**: `useFileUpload.ts` (created in the post-review cleanup) read `res.uploadUrl`/`res.key` instead of `res.data.*` — the browser PUT went to `.../undefined` (Nuxt answered 200, masking it). **All jul4 upload surfaces (P1 comprobante, P2 archivo, P3 hoja de vida, P5 adjuntos, P6 nomina files) were affected.** Fixed by destructuring `res.data`; guarded forever by new spec **P2-5** which asserts the real S3 PUT returns 200.

Suite is now **40/40 green** (36 milestone + BUG-1/2 + P2-5 + revision specs). Staging release of this milestone: `context/implementation-plan/staging-release-jul5-runbook.md`.
