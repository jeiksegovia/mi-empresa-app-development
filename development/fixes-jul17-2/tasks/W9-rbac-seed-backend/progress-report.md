# W9 Progress Report — RBAC + QA seeding + crear-from-template

> Tasks: #31 (RBAC backend) → #32 (seed-qa 3 users + SSM + creds + docs) → #33 (crear-from-template).
> Authoritative contract: `development/fixes-jul17-2/orchestration-ctx/decisions/contract-fixes-jul17-2.md`.

## Task #31 — RBAC backend [completed]

### G-A note — migration safety

Migration: `npx prisma migrate deploy --name jul17_tipo_empleado_contratos`
(`migrate dev` refused due to pre-existing drift on `20260717045038_instrumentos_dynamic_fichas`;
`migrate deploy` succeeded — replay-only, no schema columns changed).
SQL plan (additive):
```sql
ALTER TYPE "TipoEmpleado" ADD VALUE IF NOT EXISTS 'CONTRATOS';
```

### §Domain mapping (route inventory vs contract §1.2 table)

| Mount path | Methods | Domain |
|---|---|---|
| `/patients/` CRUD | GET/POST/PUT/DELETE | pacientes (CONTRATOS create-only) |
| `/patients/:id/notes` | POST | notas |
| `/patients/:id/fichas*` + `/patients/fichas/vencimientos` | all | fichas |
| `/instruments/records*` + `/instruments/:codigo/definition` (read) | all | fichas |
| `/instruments*` (CRUD) | all | instrumentos |
| `/employees*` (incl. educacion, contrato, etc.) | all | empleados |
| `/nomina*` | all | nomina |
| `/certificates*` | all | certificados |
| `/empresa*` | all | empresa (CONTRATOS false) |

AUDITOR/OPERADOR + ADMIN: never touched by `requireDomain` (contract §1.3 step 3).

### Evidence
- Migration applied: `npx prisma migrate deploy` succeeded (22 migrations applied).
- Prisma client regenerated: `npx prisma generate` ✓.
- Typecheck: `npx tsc --noEmit` clean.
- Smoke spec: `tests/rbac/domain-access.spec.ts` — 7/7 PASS:
  - GERONTOLOGA: allowed on pacientes/fichas/instrumentos/notas ✓
  - GERONTOLOGA: forbidden on empleados/nomina/certificados/empresa (with code DOMAIN_FORBIDDEN) ✓
  - CONTRATOS: allowed on empleados/nomina/certificados ✓
  - CONTRATOS: forbidden on fichas/instrumentos/notas/empresa ✓
  - CONTRATOS: create-only on pacientes (POST 201, PUT 403, DELETE 403, all with DOMAIN_FORBIDDEN code) ✓
  - EMPLEADO + null tipoEmpleado: zero regression ✓
  - Session includes `tipoEmpleado` in /auth/me response ✓

---

## Task #32 — seed-qa 3 users + SSM + creds + docs [completed]

### Evidence
- `backend/prisma/test-db/seed-qa.ts` rewritten for 3 profiles (qa-admin, qa-gerontologa, qa-contratos).
- `seed-qa-staging.sh` now writes 3 SSM pairs + mirrors legacy /qa/QA_USER_* alias.
- `get-qa-creds.sh` prints all 3 profiles (stage, URL, email, password each) + warning.
- `reset-staging-db.sh` has UNMISSABLE reminder block appended.
- `staging-release-jul17-runbook.md` has OP-7 appended.
- `staging-deploy-checklist.md` created (reusable checklist).
- Local validation: ran seed-qa.ts twice against local DB with dummy env values:
  - Run 1: ✓ 3 users created (ids 114, 115, 116)
  - Run 2: ✓ same 3 ids returned — idempotent verified
  - 3 test users cleaned up after validation.
- Shell syntax: `bash -n` clean on both shell scripts.

---

## Task #33 — Crear-from-template backend [completed]

### Evidence
- Zod: `createInstrumentSchema` extended with `templateCodigo: z.enum(TEMPLATE_CODIGOS).optional()`.
- `instrumentService.createInstrument`:
  - When `templateCodigo` present: `$transaction` resolves template + active version →
    deep-copies definition (JSON round-trip) → rewrites `codigo`/`nombre`/`version`=1 →
    creates Instrumento + InstrumentoVersion activo=true.
  - Source template rows NEVER mutated (verified by checksum before/after).
  - Response adds `activeVersion: {id, version, activo, createdAt}`.
  - Without `templateCodigo`: legacy metadata-only creation still works (no activeVersion).
  - Structured error: `CreateInstrumentError` with code `TEMPLATE_NOT_FOUND` / `NO_ACTIVE_VERSION`,
    mapped to 404 in route layer.
- Smoke spec: `tests/instruments-dynamic/create-from-template.spec.ts` — 6/6 PASS:
  - TEMPLATE_NOT_FOUND 404 (transient BARTHEL rename + restore) ✓
  - Create from BARTHEL → active v1 with 10 items + rewritten codigo/nombre/version ✓
  - POST ficha against NEW instrument → scored 100/100 + clasificacion "Dependencia ligera" ✓
  - Source BARTHEL v1 definition byte-identical (checksum unchanged) ✓
  - Legacy metadata-only creation (no templateCodigo) works ✓
  - Cleanup ✓

### Manual smoke (curl) confirmed
- POST /api/v1/instruments with templateCodigo=BARTHEL returned `activeVersion.{id:38, version:1, activo:true}`.
- GET /api/v1/instruments/TEST_BARTHEL_COPY_1/definition: codigo rewritten, all 10 items present.
- GET /api/v1/instruments/BARTHEL/definition: codigo still "BARTHEL", source untouched.

---

## Combined run

```
TEST_API_URL=http://localhost:3101 npx playwright test tests/rbac/ tests/instruments-dynamic/
  → 61 passed (3.4s)
```

Includes 7 RBAC + 6 create-from-template + 50 scoring-engine + 4 seed-definitions (existing).

