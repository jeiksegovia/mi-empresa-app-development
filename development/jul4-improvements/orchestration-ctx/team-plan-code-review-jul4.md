# Plan: code-review-jul4

## Objective
Post-delivery quality review of ALL code delivered in the jul4 milestones (cert-mejoras 2026-07-04 + jul4-improvements 2026-07-05, both uncommitted in working tree). Find: (1) code not following the codebase's established patterns, (2) inconsistencies, (3) unnecessary/verbose comments, (4) cleanup opportunities (dead code, duplication, leftover debug artifacts). REPORT ONLY — no code changes.

## Task type
RESEARCH (findings report; zero source modifications)

## Scope — delivered files to review
Backend: `prisma/schema.prisma` (new models sections) · `prisma/migrations/202607*` (7 dirs: f1/f2 + jul4_*) · `src/routes/{certificates,employees,nomina}.routes.ts` · `src/routes/index.ts` · `src/services/{certificateService,employeeService,nominaService,dashboardService}.ts`
Frontend: `app/pages/pacientes/{crear,[id]/editar}.vue` · `app/pages/certificados/{crear,index,[id]}.vue` · `app/pages/empleados/{nuevo,[id]/editar,[id]/index}.vue` · `app/pages/nomina/index.vue` · `app/components/EmpleadoCertificadosEditor.vue` · `app/app.config.ts`
Specs: `tests/local-qa/*.spec.ts` (consistency/duplication only — don't nitpick test style)

## Established patterns to check against (reference = pre-existing code)
- Routes: Zod schema top-of-file + `validate()` middleware + try/catch with `logger.error` + `{ success, data|message }` envelope + specific Prisma error codes → 4xx (see pre-existing handlers in certificates.routes.ts GET/PUT/DELETE)
- Services: plain exported async functions, `getPrisma()`, no classes
- Vue: `<script setup lang="ts">`, PrimeVue 4 components, `useApi().apiFetch`, reactive `form` + `formErrors`, `— ───` section comment dividers, Spanish UI strings / English identifiers
- Comments policy: code comments only for non-obvious constraints; NO narrative comments ("added for P4", "this fixes...", plan-phase references in code)

## Review checklist
1. Pattern deviations (route error handling, response envelopes, service structure, component API style)
2. Cross-file inconsistencies (duplicate upload helpers with drifted behavior, differing date formatting, mixed toast patterns)
3. Comment noise: phase markers (e.g. "jul4 P6 —"), PR-review-speak, redundant restatements
4. Cleanup: dead code, unused imports/refs, copy-paste blocks that should be a composable/helper, `console.log`, TODO/ts-expect-error left behind (flag the P4 `@ts-expect-error` contrato guard — P6 landed, guard may now be removable)
5. Migration SQL hygiene (naming, idempotency consistency across the 6 jul4 migrations)

## Expected Deliverables
| File | Description |
|---|---|
| development/jul4-improvements/tasks/code-review-jul4/result.md | Findings: table per category with file:line, severity (HIGH/MED/LOW), suggested fix — grep-ready |
| development/jul4-improvements/tasks/code-review-jul4/completion-report.md | Summary + counts |

## Acceptance Criteria
1. Every scoped file actually read (list them in the report)
2. Findings cite file:line + concrete suggested fix
3. Severity-ranked; no vague "consider improving X"
4. Explicit "clean" verdict for files with no findings

## Constraints
- READ-ONLY: no Edit/Write outside development/jul4-improvements/tasks/code-review-jul4/
- Don't review pre-existing untouched code except as pattern reference
- Don't run the app or tests; static review only
