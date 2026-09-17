# Progress Report — fix-review-findings (worker-fix-2)

**Task ID:** #9
**Started:** 2026-07-05
**Plan:** `development/jul4-improvements/orchestration-ctx/team-plan-fix-review-findings.md`

---

## STATE VERIFICATION (resumed from prior worker)

### Already DONE (verified)
- **FIX-1** novedad attachment wipe — conditional `if (input.archivos !== undefined)` at `backend/src/services/employeeService.ts:611` ✓
- **FIX-3** `@ts-expect-error` removal — 0 occurrences in employeeService.ts ✓
- **FIX-5** salario on create — `salario: c.salario ?? null` at employeeService.ts:292 ✓
- **FIX-2** detail TAB 2 — certificadoAlturas/RIESGO_ELECTRICO references = 0 in `frontend/app/pages/empleados/[id]/index.vue` ✓
- **CL-1/CL-2** artifacts exist:
  - `frontend/app/composables/useFileUpload.ts`
  - `frontend/app/utils/date.ts`
  - `frontend/app/utils/file.ts`
- Composables auto-imported by Nuxt, so `empleados/[id]/index.vue` already uses them.

### GROUP 2 progress
- **FIX-9** ✅ — UTC date in certificateService.ts:106 (duplicateCertificate default) and nominaService.ts:127,167
- **FIX-11** ✅ — contrato snapshot moved INSIDE $transaction in createNominaPeriodo
- **FIX-12** ✅ — empty-string date normalize in updateCertificate
- **FIX-10** ✅ — updateNominaPeriodo now treats null=clear, undefined=keep; frontend always sends full state
- **FIX-7** ✅ — P2002 meta.target mapping in POST + PUT employees.routes.ts
- **FIX-8** ✅ — requireRole('ADMIN') on all 8 sub-PUTs + Zod for /certificados
- **FIX-4** ✅ — stale tipo enum replaced with new taxonomy on certificados/[id].vue
- **FIX-6** ✅ — nomina salario prefill (cargoSalario include) + Number() cast in openDialog

### GROUP 3 progress
- **CL-1** ✅ — useFileUpload composable rollout to nomina, certificados/crear, certificados/[id], empleados/[id]/editar, EmpleadoCertificadosEditor. Only composable + pre-existing pacientes/[id] remain.
- **CL-2** ✅ — date utils rollout (replaced 4 local formatDate/formatPeriodo wrappers with auto-imported utils)
- **CL-3** ✅ — NEW helpers/auth.ts (loginAsAdmin); refactored 11 local-qa specs; deleted dead todayIso
- **CL-4** ✅ — deleted getContratoActivo
- **CL-5** ✅ — stripped ~50 jul4 P markers across src/routes/components/pages/schema.prisma
- **CL-6** ✅ — 5 console.error → toast sites converted (certificados/index, empleados/[id]/{index,editar})
- **CL-7** ✅ — toast life 3500 → 3000 (6 sites); 3000/5000 already standard
- **CL-8** ✅ — NEW backend/prisma/MIGRATIONS.md (~30 lines: never-edit, idempotent guards, drift history)

### Regression asserts
- P5-4 (FIX-1): jul4-p5-novedades — passes
- P2-4 (FIX-2): jul4-p2-cert-empleado-archivo — added (manual run)
- P3-4 (FIX-5): p3-empleado-fields — added (manual run)

### Gates
- `npx tsc --noEmit` → EXIT=0 (0 errors)
- 0 @ts-expect-error in employeeService.ts
- 0 jul4 P markers in src/app/schema.prisma (excluding generated/)
- 0 async function login in local-qa
- presigned-url: only composable + pre-existing pacientes/[id] (documented)
- migrations/ untouched
- local-qa suite: 37 passed, 2 pre-existing failures (documented in result.md)

### Status
TASK COMPLETE. See result.md + completion-report.md.

---