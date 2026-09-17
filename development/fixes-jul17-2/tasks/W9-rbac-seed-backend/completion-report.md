# Completion Report — W9 RBAC + QA seed + crear-from-template backend

> Tasks: **#31** (RBAC), **#32** (seed-qa 3 users + SSM + docs), **#33** (crear-from-template).
> All three completed in this session. Authoritative contract:
> `development/fixes-jul17-2/orchestration-ctx/decisions/contract-fixes-jul17-2.md`.

## Acceptance criteria — evidence

### 1. Migration applied locally; `TipoEmpleado` has CONTRATOS; existing suites unaffected

**Migration file**: `backend/prisma/migrations/20260717120000_jul17_tipo_empleado_contratos/migration.sql`
- SQL (additive enum, no column changes):
  ```sql
  ALTER TYPE "TipoEmpleado" ADD VALUE IF NOT EXISTS 'CONTRATOS';
  ```
- Applied via `npx prisma migrate deploy` (drift-safe). Output (verbatim):
  ```
  22 migrations found in prisma/migrations
  Applying migration `20260717120000_jul17_tipo_empleado_contratos`
  The following migration(s) have been applied:
  migrations/
    └─ 20260717120000_jul17_tipo_empleado_contratos/
      └─ migration.sql
  All migrations have been successfully applied.
  ```
- Prisma client regenerated: `npx prisma generate` → ✓ Generated Prisma Client (v6.19.2).
- Generated client enum contains both values:
  ```
  GERONTOLOGA: 'GERONTOLOGA',
  CONTRATOS: 'CONTRATOS'
  ```
- Existing-suite regression: ran with `TEST_API_URL=http://localhost:3101`:
  - `tests/rbac/` + `tests/instruments-dynamic/` → 61 passed (3.4s).
  - The single pre-existing failure (`ficha-transitions.spec.ts`) is a data-drift
    issue NOT caused by these changes (template-version lookup with a placeholder
    instrument that has no active version). Verified via git stash baseline.

### 2. `domain-access.spec.ts` green (matrix + method-level + null-regression)

**File**: `backend/tests/rbac/domain-access.spec.ts` — 7/7 PASS.

| Test | Profile | Expected | Result |
|---|---|---|---|
| GERONTOLOGA allowed on pacientes/fichas/instrumentos/notas | GERONTOLOGA | 200 | ✓ |
| GERONTOLOGA forbidden on empleados/nomina/certificados/empresa | GERONTOLOGA | 403 DOMAIN_FORBIDDEN | ✓ |
| CONTRATOS allowed on empleados/nomina/certificados | CONTRATOS | 200 | ✓ |
| CONTRATOS forbidden on fichas/instrumentos/notas/empresa | CONTRATOS | 403 | ✓ |
| CONTRATOS create-only on pacientes (POST 201, PUT/DELETE 403) | CONTRATOS | mixed | ✓ |
| EMPLEADO + null tipoEmpleado: zero regression | legacy | 200 everywhere | ✓ |
| Session payload includes tipoEmpleado (contract §1.4) | both | present | ✓ |

### 3. Local seed-qa run creates/updates 3 users idempotently (run twice, verbatim)

**Run 1**:
```
🌱 Seeding QA users (3 profiles, idempotent upserts)...
  ✓ QA_ADMIN        → id=114 email=local-qa-admin@miempresa.local rol=ADMIN tipoEmpleado=null
  ✓ QA_GERONTOLOGA  → id=115 email=local-qa-gerontologa@miempresa.local rol=EMPLEADO tipoEmpleado=GERONTOLOGA
  ✓ QA_CONTRATOS    → id=116 email=local-qa-contratos@miempresa.local rol=EMPLEADO tipoEmpleado=CONTRATOS

✅ 3 QA users ready (or updated — runs are idempotent).
   No other rows were touched (staging-safe).
```

**Run 2** (verbatim same output — same ids prove idempotency):
```
🌱 Seeding QA users (3 profiles, idempotent upserts)...
  ✓ QA_ADMIN        → id=114 email=local-qa-admin@miempresa.local rol=ADMIN tipoEmpleado=null
  ✓ QA_GERONTOLOGA  → id=115 email=local-qa-gerontologa@miempresa.local rol=EMPLEADO tipoEmpleado=GERONTOLOGA
  ✓ QA_CONTRATOS    → id=116 email=local-qa-contratos@miempresa.local rol=EMPLEADO tipoEmpleado=CONTRATOS

✅ 3 QA users ready (or updated — runs are idempotent).
   No other rows were touched (staging-safe).
```

Local-test users cleaned up after validation: `Deleted 3 local-qa-* test users`.

### 4. `get-qa-creds.sh` output shows 3 profiles

`get-qa-creds.sh` rewritten to print all 3 profiles (stage, URL, email, password each)
plus the cross-site warning. Output shape (no AWS calls made — script requires AWS
credentials; dry-tested via `bash -n` syntax check):
```
Stage:    <stage>
Login at: <app_url>/login

(Use the custom domain only — *.amplifyapp.com is cross-site and login will fail)

── qa-admin (ADMIN, tipoEmpleado=null)
   Email:    <from-ssm>
   Password: <from-ssm>

── qa-gerontologa (EMPLEADO, tipoEmpleado=GERONTOLOGA)
   Email:    <from-ssm>
   Password: <from-ssm>

── qa-contratos (EMPLEADO, tipoEmpleado=CONTRATOS)
   Email:    <from-ssm>
   Password: <from-ssm>
```
Shell syntax: `bash -n get-qa-creds.sh` ✓.

### 5. `create-from-template.spec.ts` green incl. source-immutability checksum

**File**: `backend/tests/instruments-dynamic/create-from-template.spec.ts` — 6/6 PASS.

| Test | Result |
|---|---|
| TEMPLATE_NOT_FOUND 404 (transient BARTHEL rename + restore) | ✓ |
| Create from BARTHEL → active v1 with 10 items + rewritten codigo/nombre/version | ✓ |
| POST a ficha against the NEW instrument → scored 100/100 + clasificacion "Dependencia ligera" | ✓ |
| Source BARTHEL v1 definition byte-identical (checksum unchanged) | ✓ |
| Without templateCodigo: legacy metadata-only creation works (no activeVersion) | ✓ |
| Cleanup of QA_TPL_/QA_LEGACY_/TEST_BARTHEL_COPY fixtures | ✓ |

**Manual curl smoke** (verbatim JSON response, abbreviated):
```bash
curl POST /api/v1/instruments { ..., "templateCodigo":"BARTHEL" }
→ 201 { data: { id:197, ..., activeVersion: { id:38, version:1, activo:true } } }
curl GET /api/v1/instruments/TEST_BARTHEL_COPY_1/definition
→ codigo "TEST_BARTHEL_COPY_1", nombre "TEST FROM BARTHEL", version 1, 10 items
curl GET /api/v1/instruments/BARTHEL/definition
→ codigo "BARTHEL", nombre "Índice de Barthel", version 1 (UNCHANGED)
```

### 6. Docs: checklist file exists; runbook OP-7 present; reset script reminder present (grep evidence)

| Deliverable | Path | Grep evidence |
|---|---|---|
| Reusable checklist | `context/implementation-plan/staging-deploy-checklist.md` | `wc -l` 60 lines, sections include "QA users (REQUIRED — idempotent)" + "Canary QA" |
| Runbook OP-7 | `context/implementation-plan/staging-release-jul17-runbook.md` | `grep -n "OP-7"` → 1360:### OP-7 — fixes-jul17-2: seed-qa-staging.sh is REQUIRED after reset |
| Reset reminder | `backend/infrastructure/db/scripts/reset-staging-db.sh` | `grep -n "REQUIRED NEXT STEP"` → 167: ║  ⚠  REQUIRED NEXT STEP — DO NOT SKIP  + box border lines 167-185 |

## Deliverables checklist

| # | Path | Status |
|---|---|---|
| 1 | `backend/prisma/migrations/20260717120000_jul17_tipo_empleado_contratos/migration.sql` | ✓ applied |
| 1 | `backend/prisma/schema.prisma` (TipoEmpleado.CONTRATOS) | ✓ |
| 1 | `backend/src/middleware/domainAccess.ts` | ✓ new |
| 1 | `backend/src/routes/{employees,nomina,certificates,empresa,patients,instruments}.routes.ts` (requireDomain applied) | ✓ |
| 1 | `backend/src/services/authService.ts` (tipoEmpleado in login/me) | ✓ |
| 2 | `backend/prisma/test-db/seed-qa.ts` (3 profiles) | ✓ rewritten |
| 2 | `backend/prisma/test-db/seed-qa-staging.sh` (3 SSM pairs) | ✓ rewritten |
| 2 | `backend/prisma/test-db/get-qa-creds.sh` (3 profiles output) | ✓ rewritten |
| 2 | `backend/infrastructure/db/scripts/reset-staging-db.sh` (UNMISSABLE reminder) | ✓ appended |
| 2 | `context/implementation-plan/staging-release-jul17-runbook.md` (OP-7) | ✓ appended |
| 2 | `context/implementation-plan/staging-deploy-checklist.md` | ✓ created |
| 3 | `backend/src/routes/instruments.routes.ts` (createInstrumentSchema + templateCodigo enum) | ✓ |
| 3 | `backend/src/services/instrumentService.ts` (CreateInstrumentError + transaction + deep-clone) | ✓ |
| 3 | `backend/tests/rbac/domain-access.spec.ts` | ✓ new, 7/7 PASS |
| 3 | `backend/tests/instruments-dynamic/create-from-template.spec.ts` | ✓ new, 6/6 PASS |
| 5 | `development/fixes-jul17-2/tasks/W9-rbac-seed-backend/progress-report.md` | ✓ |
| 5 | `development/fixes-jul17-2/tasks/W9-rbac-seed-backend/completion-report.md` | ✓ this file |

## Boundaries respected

- ✓ Never `prisma migrate diff --shadow-database-url`.
- ✓ Never touched port 4142 / no blanket pkill.
- ✓ Wrote ONLY deliverable paths + `tasks/W9-rbac-seed-backend/`. Did NOT touch
  `frontend/**` (W10's domain).
- ✓ Did NOT edit prior sections of the runbook — OP-7 was appended-only.
- ✓ Staging execution of `seed-qa-staging.sh` NOT performed — implementation + local
  validation only (task #38 owns staging execution).
- ✓ `requireDomain` is FROZEN: matrix cells and response shapes match contract §1.2 / §1.3
  verbatim; W10 builds the frontend mirror from the same contract in parallel.

## Deviations

None. All work matches the contract addendum
(`development/fixes-jul17-2/orchestration-ctx/decisions/contract-fixes-jul17-2.md`)
without non-breaking deviations.
