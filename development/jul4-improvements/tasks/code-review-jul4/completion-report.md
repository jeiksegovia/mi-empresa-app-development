# Completion Report — code-review-jul4

## Task
Static quality review of all code delivered in the two recent milestones (cert-mejoras 2026-07-04 + jul4-improvements 2026-07-05). Find pattern violations, inconsistencies, comment noise, and cleanup opportunities. **Findings only — no source modifications.**

## Deliverables
| File | Description | Status |
|------|-------------|--------|
| `development/jul4-improvements/tasks/code-review-jul4/result.md` | Full findings report (files reviewed, 6 category tables with file:line + suggested fix, 14-item prioritized cleanup summary) | ✅ |
| `development/jul4-improvements/tasks/code-review-jul4/completion-report.md` | This file — counts + top cleanups | ✅ |
| `development/jul4-improvements/tasks/code-review-jul4/progress-report.md` | Progress log (backend review + frontend review sections appended) | ✅ |

## Counts per category / severity

### Severity totals
| Severity | Count |
|---|---|
| HIGH | **3** |
| MED | **11** |
| LOW | **~25** (comment-noise markers are bucketed; precise count via `grep -rn "// jul4 P"` ≈ 70 across schema, routes, services, pages, components) |

### Finding breakdown
| Category | Count | Severity mix |
|---|---|---|
| A — Stale types & dead code | 5 | 2 HIGH, 3 MED |
| B — Cross-file duplication | 7 | 7 MED |
| C — Comment noise | 14 | 14 LOW |
| D — Cross-cutting inconsistencies | 8 | 2 MED, 6 LOW |
| E — Migration SQL hygiene | 2 | 2 LOW |
| F — Other patterns | 4 | 4 LOW |
| **Total reportable findings** | **40** | 3 HIGH, 11 MED, 26 LOW |

(LOW-severity line counts above split comment-noise markers (C-codes) — actual `// jul4 PX` lines in source ≈ 70 across schema.prisma, services, routes, frontend pages/components. See result.md C-codes for the exact lines.)

### Files reviewed (27 source + 6 specs = 33 total)
- **Backend schema & migrations (10):** schema.prisma, 3× F-series migrations, 6× jul4 migrations
- **Backend routes (5):** certificates, employees, nomina (new), uploads (new), index
- **Backend services (5):** certificate, employee, nomina (new), dashboard, s3 (new)
- **Frontend pages (10):** pacientes/crear, pacientes/[id]/editar, certificados/crear, certificados/index, certificados/[id], empleados/nuevo, empleados/[id]/editar, empleados/[id]/index, nomina/index (new)
- **Frontend components (1):** EmpleadoCertificadosEditor (new)
- **Frontend config (1):** app.config.ts
- **Frontend specs (6 jul4-local-qa specs):** P1 cert-recurrente, P2 cert-empleado-archivo, P3 hoja-vida, P4 pendientes, P5 novedades, P6 nomina

## Top-3 highest-value cleanups

1. **`useFileUpload` + `useFileDownload` composables** — eliminates 13 hand-rolled copies of presigned-URL/PUT/S3-download code across 7 files. Largest MED consolidation. Result: ~250 LOC reduction, single source of truth for upload progress + error toast + DRIFT prevention (folder names + error formatting were already drifting across 3 implementations).

2. **Remove `@ts-expect-error` Contrato workaround in `employeeService.ts:504-521`** — HIGH because the silent `try/catch` swallows real DB errors in production. ~18 lines removed; converts the `SIN_CONTRATO_ACTIVO` pendiente derivation to a clean Prisma call. Also lifts the `// pre-P6 — silently skip` comment noise.

3. **Rebuild `empleados/[id]/index.vue` TAB 2 Certificates (HIGH BUG)** — the page's TAB 2 (lines 649-751) renders cards for `certificadoAlturas` and `certificadoRiesgoElectrico`, but the F2.3 migration replaced those 1:1 tables with a generic 1:N `certificados[]`. The fields don't exist on the `GET /employees/:id` response — both cards permanently show "No tiene certificado de alturas/riesgo eléctrico registrado". Needs: replace the two cards with one iterating `employee.certificados`, reusing the existing `EmpleadoCertificadosEditor` in read-only mode.

## Notable secondary findings

- **A4 — stale enum values in `certificados/[id].vue`** (MED): the detail-page `tipoLabels` map and `tipoOptions` still list `RUT / CAMARA_COMERCIO / PERMISO_SANITARIO / PAGO_SEGURIDAD_SOCIAL` from before F1; any edit will fail Zod validation silently.
- **Comment noise volume:** the `// jul4 PX` pattern (pointing back at orchestrator plan phases) accounts for ~70 narrative comments across schema.prisma + services + routes + 11 frontend files. It is by far the cheapest cleanup — bulk-strip via `sed` after grep-verification.
- **Test dedup:** 6 identical 8-line `login()` helpers across the jul4-* specs. Trivial extraction to `frontend/tests/helpers/auth.ts`.
- **`getContratoActivo` is dead code** — exported in `nominaService.ts:34` but never imported. 4 lines, but symptomatic of unverified delivery.
- **Idempotency convention drift across migrations** — `20260705*` migrations use `DO $$ ... EXCEPTION WHEN duplicate_object` while F-series migrations don't. Worth documenting in `backend/prisma/README.md`.

## Key Decisions Made (non-breaking)

- **Scope interpretation.** The task brief listed "6 jul4 migrations" but the working tree contains 9 in `202607*`. I treated the 6 with `jul4_*` name as in-scope and the 3 `20260704*` F-series as adjacent/reference. Note in the result file.
- **Specs scope.** Per the brief, "consistency/duplication only — no test-style nitpicks." I flagged the cross-spec `login()` duplication once per spec but did not nitpick assertions or selectors.
- **No code changes made.** The brief explicitly constrained this to a report. All findings are prescriptive only.

## Issues Encountered

None blocking. One self-correction mid-task: I first scoped `console.error` to all of `backend/src/services backend/src/routes backend/src/middleware`, the output was the 452KB dump dominated by generated Prisma client — narrowed the grep to source-only and ignored `backend/src/generated/`.

## Notes for orchestrator

- The HIGH #A1 finding (TAB 2 of `empleados/[id]/index.vue`) means the delivered "F2.3 / P3 / P4 / P5" feature bundle is **user-visible broken**: an employee detail page will always say "no certificate" for any employee after F2.3 — not just employees without certificates, but ALL employees. Recommend prioritising this over any of the cleanups.
- The HIGH #A2 (`@ts-expect-error` silent catch) is technically stable on staging today but is a latent production hazard. Any DB blip on the Contrato access would create a spurious "Sin contrato activo" pendiente without surfacing in logs.
- The MED #A4 stale enum values in `certificados/[id].vue` makes the existing certificate edit form broken too — editing will not save `tipoCertificado` cleanly.
- All other findings are quality improvements with no user-facing impact.

