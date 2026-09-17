# Progress Report — jul4-improvements

**Worker**: Task #7
**Stack**: backend http://localhost:3101 (200), frontend http://localhost:3100 (200), postgres docker :15432
**Plan**: `development/jul4-improvements/orchestration-ctx/team-plan-jul4-improvements.md`

## Phase P0: Genero OTRO custom input ✅ Done
- **Files touched**
  - frontend `app/pages/pacientes/crear.vue` — refactored genero form to `generoSelect` + `generoCustom` with inline InputText when OTRO.
  - frontend `app/pages/pacientes/[id]/editar.vue` — hydration logic (`isGeneroKnown`) + same OTRO custom pattern.
- **Backend**: untouched (`patients.routes.ts:20` already `genero: z.string().min(1).max(20)`).
- **Spec**: `tests/local-qa/p5-clientes-selects.spec.ts` extended with P0-1 + P0-2 (5/5 green).

## Phase P1: Empresa certificados recurrentes ✅ Done
- **Migration** `prisma/migrations/20260705000000_jul4_cert_empresa_recurrencia/migration.sql`
  - `CREATE TYPE PeriodicidadCertificado` + 3 new columns (periodicidad default UNICA, periodo, comprobante_pago_url) + DRIFT-1 `tipo_certificado SET NOT NULL` (0 nulls verified).
  - Note: existing `f2_cert_empleado_generic` is "modified after applied" (predecessor's benign duplicate) → authored SQL manually + `prisma migrate deploy` (no TTY needed).
- **Backend**:
  - `services/certificateService.ts`: extended `CreateCertificateInput`, added `duplicateCertificate()`, `getMissingMonthlyAlerts()` (UTC YYYY-MM compare, TZ-robust), wired into `/stats` as `alertasMesFaltante`.
  - `routes/certificates.routes.ts`: refactored to `baseCertificateFields` shared object so `createCertificateSchema` (with `.refine` for duplicateFromId-or-required) + `updateCertificateSchema` (partial) both compile.
- **Frontend**:
  - `certificados/crear.vue`: periodicidad Select; periodo `<input type="month">` when != UNICA; second upload UI "Comprobante de pago" reusing presigned flow.
  - `certificados/index.vue`: `<Message>` alert banner; new "Periodicidad"/"Periodo" columns; "Duplicar para este mes" icon-button (MENSUAL only).
  - `certificados/[id].vue`: read-only display of periodicidad/periodo + comprobante download.
- **Spec** `tests/local-qa/jul4-p1-cert-recurrente.spec.ts` (3/3 green):
  - P1-1: create MENSUAL cert via API + persist comprobante+periodo.
  - P1-2: missing-month alert appears for MENSUAL name w/o current-month row, AND that specific name disappears after `duplicateForCurrentMonth`.
  - P1-3: DRIFT-1 fixed — POST without `tipoCertificado` returns 400 (Zod validates type NOT NULL).
- **Decisions / lessons**:
  - Original `Message` component is PrimeVue auto-imported; use a wrapping `<div data-testid>` so test selectors are stable.
  - `apiFetch()` returns the parsed body wrapper `{ success, data, ... }` — always assign `res.data` to refs (caught a bug where `stats.value = res` made cards render `undefined`).
  - Postgres DATE columns serialize as UTC midnight → must compare by UTC YYYY-MM not local TZ.

## Revision 1 (2026-07-05, post-review feedback)
- **Trigger**: team-lead flagged the Contrato card UI in `empleados/[id]/editar.vue` Info Laboral tab as explicit P6 scope that was missing (initial hand-off wrongly claimed it was deferred).
- **Changes**:
  - `frontend/app/pages/empleados/[id]/editar.vue`: added full Contrato card (list + Dialog form with tipo Select, fechas, `v-if` fechaFin hide on TERMINO_INDEFINIDO, archivo upload folder `'contratos'`, activo toggle, admin-only gates). Inserted right after Hoja de Vida card on Tab 3.
  - Added `formatDate()` helper inside the same file (it was missing — caused a `formatDate is not a function` runtime error initially caught by P6-7).
  - `frontend/tests/local-qa/jul4-p6-nomina.spec.ts`: added **P6-7 REVISION-1** — UI happy path: open empleado → Info Laboral → Crear OPS contrato via the new card → list shows it → `/nomina` month view reflects `contratoActivo` for the same empleado; second iteration also verifies TERMINO_INDEFINIDO hides fechaFin.
- **Tests**: full suite is **36/36 green** (was 35/35; +1 from P6-7).
- **Docs**: `result.md`, `completion-report.md` updated; this Revision 1 section appended to progress-report.md.

