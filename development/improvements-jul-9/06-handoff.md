# Handoff: improvements-jul-9 — Sprint 1+2 complete

**Delivered:** 2026-07-10 · **Baseline:** HEAD `48029ef` + 4 new migrations (22 total in DB… 18 at last count + these were the 4)
**Team:** W1 pt-backend-eng (3 waves, reused ×2) · W2 pt-frontend-eng (2 waves, reused ×1, shutdown) · W3 pt-frontend-eng (fresh) · W4 pt-test-quality (fresh)
**Runtime:** backend :3101 + frontend :3100 live with all changes (HMR). **Not committed.**
**Source of truth consumed:** `context/user-feedback/improvements-jul-9-insights.md` (17 items, decisions L1–L6)

---

## What shipped (17/17 items MET, QA-verified)

### Backend (W1 — 3 waves)
- **4 migrations**: `jul9_additive_fields` (7 columns + TipoSangre enum), `jul9_nota_fecha_incidente` (nullable→backfill→NOT NULL), `jul9_educacion_empleado` (new table), `jul9_cargo_empresa` (new table + Contrato.cargoId FK + idempotent 7+Otro seed)
- **New files**: `middleware/forbidLegacy.ts`, `services/cargoEmpresaService.ts`, `services/educacionEmpleadoService.ts`, `utils/businessDays.ts` (weekday-only, TODO(holidays) per L6)
- **Endpoints**: cert updates accept `comprobantePagoUrl`; notas require `fechaIncidente` with 2-business-day hard 400 (L3, TZ-safe local-noon parser); cliente `fechaCumpleanos/tipoSangre/eps`; empleado `documentoIdentificacionUrl`; educación full CRUD; cargos CRUD (409 dedupe, soft-archive, 204 DELETEs); contrato `archivoFirmadoUrl` + `cargoId` (pre-flight 400 on bad FK; legacy `cargo:string` rejected via forbidLegacy)
- **Contract**: `orchestration-ctx/decisions/schema-contract-jul9.md` — authoritative API spec

### Frontend certificados + empresa (W2 — 2 waves)
- Create form reduced to 4 metadata fields + Primera actualización (A1–A3)
- **Empresa save bug fixed** (A6 — silent null-empresaId return + sync role check)
- Dropzones clickable/pointer/hover everywhere (D4); Contrato relocated to own "Contrato laboral" tab (D5)
- NEW shared `components/certificate/CertificateUpdateForm.vue` — consumed by crear + Agregar dialog, comprobante slot, caller-scoped stash keys (A4-UI + A5)

### Frontend pacientes + empleados + config (W3)
- Notes: required fechaIncidente DatePicker + inline 400 error + fecha column (B1/B2/B6)
- Datos personales: cumpleaños + tipoSangre (8-value Select) + EPS (B3–B5)
- Empleados: educación repeatable rows with diploma upload, documento identificación upload, nivelEscritura removed (D1–D3)
- Contrato tab: archivo firmado + cargo Select with "➕ agregar otro" inline create (D6/D7-UI)
- Empresa config: cargos manager — list/add/duplicate-error/archive (D8)

### QA (W4) + fix-ups (W1 wave 3)
- **6 backend spec files (32 tests) + 8 playwright jul9-* specs — all green** (final count 18/18 on the 3 updated files after fix-ups)
- 3 gaps found → all fixed same-session: cargoId FK 500→400, educación embedded on GET employee, DELETEs → 204
- QA report: `tasks/W4-test-quality/qa-report.md`

## Known follow-ups (not regressions — logged in qa-report §6)
1. `documentoIdentificacionUrl` has no dedicated spec (~30 lines, low risk)
2. jul4 suite: 22 pre-existing TEST-ENV failures (hardcoded `localhost:3101` vs sameSite=strict) — 1h fix migrating to `getApiOrigin()` helper; predates this work
3. `tests/dashboard/*` + `auth-empleado-link` hardcode port 3001 — same fix
4. Colombian holiday table for businessDays (L6 deferral)
5. Deferred by design: Section C (fichas single-step flow, VENCIDO cron, GERONTOLOGA sub-role), E1 auto-uppercase

## Run / verify
- Backend specs: `cd backend && npx playwright test tests/{patients,employees,empresa,certificates}/`
- Frontend: `TEST_FRONTEND_URL=http://100.85.193.33:3100 TEST_API_URL=http://100.85.193.33:3101/api/v1 npx playwright test tests/local-qa/jul9-*.spec.ts` (matching hosts required — sameSite=strict)
- Contract: `orchestration-ctx/decisions/schema-contract-jul9.md` · D7 decision: `decisions/d7-cargo-migration-approval.md`

## Key orchestration decisions
- D7 deviation approved: `Contrato.cargo` never existed (insights doc assumed it) → cargoId nullable, no backfill, NOT NULL deferred until UI guarantees selection
- Worker reuse: W1 ×3 waves (schema→API→fix-ups: context was the contract), W2 ×2 (same files); W3/W4 fresh (no overlap / unbiased QA)
