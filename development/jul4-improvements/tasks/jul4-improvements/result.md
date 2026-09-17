# Result — jul4-improvements (Task #7)

**Status**: Complete — all 8 phases P0–P7 implemented; full local-qa regression passes **36/36** (post-Revision 1).

## Phases completed

| Phase | Description | Files | Spec | Status |
|---|---|---|---|---|
| P0 | Genero OTRO inline custom input | pacientes/crear.vue, pacientes/[id]/editar.vue | p5-clientes-selects.spec.ts (extended) | ✅ 2/2 |
| P1 | Empresa certificados recurrentes (periodicidad + comprobante + duplicate) | certificates.routes.ts + service, certificados/{crear,index,[id]}.vue; migration `jul4_cert_empresa_recurrencia` (also DRIFT-1 fix `tipo_certificado SET NOT NULL`) | jul4-p1-cert-recurrente.spec.ts | ✅ 3/3 |
| P2 | Per-row archivo upload on empleado certificates | EmpleadoCertificadosEditor.vue; empleados/{nuevo,[id]/editar}.vue (v-model:certificados); employees.routes.ts; migration `jul4_cert_empleado_archivo` | jul4-p2-cert-empleado-archivo.spec.ts | ✅ 3/3 |
| P3 | Hoja de vida | empleados/[id]/editar.vue (Info Laboral tab); employees.routes.ts; migration `jul4_hoja_vida` | jul4-p3-hoja-vida.spec.ts | ✅ 2/2 |
| P4 | Sección Pendientes (manual + derived) | pendientes_empleado model; empleados/[id]/index.vue (tab 3); employeeService.ts; employees.routes.ts; migration `jul4_pendientes` | jul4-p4-pendientes.spec.ts | ✅ 3/3 |
| P5 | Módulo Novedades (5 tipos + adjuntos) | novedades_empleado + archivos_novedad models; empleados/[id]/index.vue (tab 4); employeeService.ts; employees.routes.ts; migration `jul4_novedades` | jul4-p5-novedades.spec.ts | ✅ 3/3 |
| P6 | Nómina foundation (Contrato + NominaPeriodo + archivos tipados) | nomina.routes.ts (new); nominaService.ts (new); nomina/index.vue (new); empleados/[id]/editar.vue (Contrato card with list + form + file upload + activo toggle); app.config.ts; migration `jul4_nomina_foundation` + partial unique index | jul4-p6-nomina.spec.ts (7 tests, incl. **P6-7 REVISION-1** UI happy path from editar Info Laboral) | ✅ 7/7 |
| P7 | Full regression | 36/36 spec pass (incl. P6-7 Revision 1) | all suites | ✅ |

## Local QA pass output summary

```
Running 36 tests using 1 worker
✓ All 36 tests passed (1.2m total)
```

No regressions. New tabs are APPENDED (indexes 3, 4) so existing index-based selectors in bug-validation.spec.ts and p4-cert-editor.spec.ts stayed green.

## Key files (touchpoints) — by phase

- **Migrations** (all additive, idempotent where possible):
  - `backend/prisma/migrations/20260705000000_jul4_cert_empresa_recurrencia/`
  - `backend/prisma/migrations/20260705000100_jul4_cert_empleado_archivo/`
  - `backend/prisma/migrations/20260705000200_jul4_hoja_vida/`
  - `backend/prisma/migrations/20260705000300_jul4_pendientes/`
  - `backend/prisma/migrations/20260705000400_jul4_novedades/`
  - `backend/prisma/migrations/20260705000500_jul4_nomina_foundation/`

- **Backend services + routes**:
  - `backend/src/services/certificateService.ts` (extended)
  - `backend/src/services/employeeService.ts` (extended for P4 + P5)
  - `backend/src/services/nominaService.ts` (new)
  - `backend/src/routes/certificates.routes.ts` (extended)
  - `backend/src/routes/employees.routes.ts` (extended)
  - `backend/src/routes/nomina.routes.ts` (new)
  - `backend/src/routes/index.ts` (mounted /nomina)
  - `backend/prisma/schema.prisma` (final model declarations)

- **Frontend pages**:
  - `frontend/app/pages/pacientes/crear.vue` + `[id]/editar.vue`
  - `frontend/app/pages/certificados/crear.vue` + `index.vue` + `[id].vue`
  - `frontend/app/pages/empleados/[id]/editar.vue` + `[id]/index.vue`
  - `frontend/app/pages/nomina/index.vue` (new)
  - `frontend/app/components/EmpleadoCertificadosEditor.vue`
  - `frontend/app/app.config.ts`

- **Specs**: 7 new files (1 per P1–P6 + 2 new in p5), 1 extended (p5-clientes-selects).

- **Docs**: `context/plan-implemented/jul-4-improvements-plan-implemented.md`.

## Acceptance criteria (from plan) — all met

See `context/plan-implemented/jul-4-improvements-plan-implemented.md` for the full table. 12/12 criteria met.

## Notable deviations / decisions

- DRIFT-1 (`tipo_certificado SET NOT NULL`) rolled into P1 migration (per `db-schema.md` §2.4). Verified 0 NULL rows before applying.
- Predecessor's `f2_cert_empleado_generic` was modified after applied (per `db-schema.md` §1, "benign duplicate"). `prisma migrate dev --create-only` hard-blocks on this; resolved by authoring SQL manually + `prisma migrate deploy` for all 6 jul4 migrations (works headless without TTY).
- `createCertificateSchema` was refactored to a `baseCertificateFields` shared object so `updateCertificateSchema.partial()` keeps compiling after the new `duplicateFromId` shortcut was added (ZodEffects from `.refine()` doesn't have `.partial()`).
- Missing-month alert compares by UTC `YYYY-MM` strings (not exact ms) — Postgres DATE storage returns UTC-midnight, JS `new Date(YYYY, MM-1, 1)` returns local-midnight.
- `EmpleadoCertificadosEditor` requires `v-model:certificados` (named v-model) because the SFC declares `certificados` as its prop; default `v-model` would target `modelValue` and fail with a Vue warning.
- Contrato CRU UI in `empleados/[id]/editar.vue` is **fully shipped** (Revision 1) — list, add/edit/delete dialog, tipo Select, fechas, `v-if` hide fechaFin on TERMINO_INDEFINIDO, archivo upload (`contratos/` folder), activo toggle, admin gates, formatDate helper. Test P6-7 covers the UI happy path end-to-end.

## Revision 1 (post-review)

Reviewer flagged that the Contrato card UI in `empleados/[id]/editar.vue` Info Laboral tab was explicit P6 scope per the plan file (§P6 frontend spec). The initial P6 hand-off had inaccurately claimed the UI was "deferred per developer-confirmed decisions" — that was wrong. Revision 1 delivers:

- **Implementation** — full Contrato card on Tab 3 (Info Laboral), inserted right after the Hoja de Vida card: list + add/edit/delete dialog + tipo Select (4 options) + fechaInicio/fechaFin with fechaFin hidden when TERMINO_INDEFINIDO + archivo upload to `contratos/` folder + activo toggle + `authStore.isAdmin` gates on actions.
- **Runtime bug caught** — the new template referenced a `formatDate()` helper that wasn't in the file; P6-7 caught the runtime error and a minimal helper was added.
- **New test** — P6-7 REVISION-1 in `jul4-p6-nomina.spec.ts` covers the UI happy path (create OPS contrato from editar Info Laboral → row appears in list → `/nomina` month view reflects `contratoActivo`).
- **Full suite still green** — 36/36 (was 35/35; +1 test added by Revision 1, no regressions).

## Open follow-ups (deferred)

- Drop legacy `nominas` / `deducciones_salario` / `beneficios` / `comprobantes_pago` / `ausentismos` / `gestion_tiempo_vacaciones` tables — revisit after nómina module stabilizes in staging.
- CV parsing (current: upload-only).
- Salary calculation.
- Cert catalog + per-cargo requirement engine.

See the plan-implemented doc for grep hooks, full key-decisions list, and details.
