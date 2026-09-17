# task-assignment-fix-review-findings

(Archived copy of the spawn brief sent to worker-fix on 2026-07-05 — TaskList #9.
Source of truth for fix details: `../../orchestration-ctx/team-plan-fix-review-findings.md`.)

## Task Type
IMPLEMENTATION

## Scope
All accepted findings from tasks/code-review-jul4/result.md + Fable verification:
- GROUP 1 (HIGH): FIX-1 N1 novedad attachment wipe · FIX-2 A1 detail TAB 2 stale cert fields · FIX-3 A2+N3 seven stale @ts-expect-error + silent catch
- GROUP 2 (MED): FIX-4 A4 stale tipo enums · FIX-5 N2 salario dropped on create · FIX-6 N4 nomina prefill + Decimal cast · FIX-7 A5 P2002 target mapping · FIX-8 N5 ADMIN guards on sub-PUTs · FIX-9 N6 UTC dates · FIX-10 N7 clear semantics · FIX-11 N9 snapshot transaction + fechaFin refine · FIX-12 N8 empty-string dates
- GROUP 3 (cleanups): CL-1 useFileUpload composable (13 copies) · CL-2 date utils + 30d threshold · CL-3 spec auth helper · CL-4 dead getContratoActivo · CL-5 strip ~70 phase markers · CL-6 console.error→toast · CL-7 toast life · CL-8 MIGRATIONS.md

## Gates
tsc --noEmit (backend, 0 delivered-code errors) · full local-qa suite green + new regression asserts (FIX-1/2/5) · acceptance greps · prisma/migrations/ untouched

## Excluded (deferred)
E1/D7 (migration file edits — FORBIDDEN), D2 periodo typing, D6 REGISTRO_CIVIL spec, Zod for 7 legacy sub-PUTs, OpenAPI type generation
