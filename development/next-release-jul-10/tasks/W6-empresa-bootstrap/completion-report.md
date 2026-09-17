# Completion report — W6 Empresa Bootstrap (task #33)

**Worker**: pt-fullstack-impl · **Date**: 2026-07-10
**Task**: Empresa bootstrap from empty DB — backend create path + frontend create mode + regression specs
**Status**: ✅ COMPLETE — local work done; hotfix DEPLOY decision belongs to orchestrator.

---

## Acceptance Criteria Verification (verbatim commands + outputs)

### AC1: Diagnosis section proves the exact failing call chain

**Evidence** in `progress-report.md` §D1–D11. Each step has a verbatim command + observed output.
Key findings:
- D1: `grep -n "^router\." backend/src/routes/empresa.routes.ts` confirms only GET / + PUT /:id, no POST
- D5: `auth.ts fetchEmpresa` swallows 404 silently → auth.empresa = null
- D6: `empresa/editar.vue` form reads auth.empresa → empresaId stays null → submit shows "No se pudo identificar la empresa"
- D9-D11: LIVE staging curls with QA creds (read-only) — GET /empresa → 404, /empresa/cargos → empty array, empresas=0

### AC2: Local: with `page.route`-simulated empty state, admin sees create form, saves, no console errors

**Command**:
```bash
cd frontend && TEST_API_URL=http://100.85.193.33:3101/api/v1 \
  TEST_FRONTEND_URL=http://100.85.193.33:3100 \
  npx playwright test tests/local-qa/jul10-empresa-bootstrap.spec.ts
```
**Output**:
```
Running 2 tests using 1 worker
  ✓  jul-10 empresa bootstrap (W6 regression) › empty-state UI: GET /empresa → data:null renders Crear Empresa form without console errors (1.2s)
  ✓  jul-10 empresa bootstrap (W6 regression) › empty-state CTA on /empresa index page when no empresa exists (1.2s)
  2 passed (3.5s)
```
Both tests verify: `getByRole('heading', { name: 'Crear Empresa' })` visible, `data-testid="empresa-create-banner"` visible, `data-testid="empresa-guardar"` text matches `/Crear Empresa/i`, `data-testid="cargos-manager-card"` NOT visible, POST → 201, **zero console errors** during the load.

### AC3: Local curl: POST /empresa on existing → 409; GET normalized contract

**Command**:
```bash
curl -s -c /tmp/w6-local-jar -X POST http://localhost:3101/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@miempresa.com","password":"<redacted>"}' -o /dev/null
curl -s -b /tmp/w6-local-jar http://localhost:3101/api/v1/empresa -w "\nHTTP=%{http_code}\n"
curl -s -b /tmp/w6-local-jar -X POST http://localhost:3101/api/v1/empresa \
  -H 'Content-Type: application/json' \
  -d '{"nombre":"EMPRESA DUPLICADA","nit":"999999999-9"}' \
  -w "\nHTTP=%{http_code}\n"
```
**Output**:
```
{"success":true,"data":{"id":6,"nombre":"MI EMPRESA S.A.S.","nit":"900123456-1",...}}
HTTP=200
{"success":false,"message":"La empresa ya existe","field":"empresa"}
HTTP=409
```
GET normalized to 200 (was 404), POST enforces single-empresa invariant with 409 + `field: 'empresa'`.

### AC4: Cargo seed on create verified

**Code** (in `backend/src/services/empresaService.ts:49-79`):
```typescript
export const DEFAULT_CARGOS = [
  'Fisioterapeuta',
  'Terapeuta Ocupacional',
  'Educador Físico',
  'Manualidades',
  'Auxiliar de Enfermería',
  'Auxiliar de Servicios Generales',
  'Otro',
] as const

// Inside createEmpresa():
const result = await prisma.$transaction(async (tx) => {
  const empresa = await tx.empresa.create({ ... })
  await tx.cargoEmpresa.createMany({
    data: DEFAULT_CARGOS.map((nombre) => ({ empresaId: empresa.id, nombre, activo: true })),
    skipDuplicates: true,
  })
  return empresa
})
```
**Verified**: 7 cargo names match `backend/prisma/migrations/20260710024928_jul9_cargo_empresa/migration.sql` lines 96-104. The `createMany skipDuplicates` is defensive against the unique constraint `cargos_empresa_empresa_id_nombre_key`. Atomicity via `$transaction` — either both empresa + cargos land, or neither does.

Regression spec `backend/tests/empresa/empresa-bootstrap.spec.ts:116-132` asserts the 7 names exist locally, locking the seed list from accidental drift.

### AC5: Both specs green; existing suites not regressed

**Command**:
```bash
cd backend && TEST_API_URL=http://localhost:3101 npx playwright test tests/empresa/
```
**Output**:
```
Running 16 tests using 1 worker
  ✓  cargos-crud.spec.ts:54  GET /empresa/cargos returns seeded cargos (≥ 7 entries, ordered by nombre)
  ✓  cargos-crud.spec.ts:72  POST /empresa/cargos creates a cargo → 201 with the new id
  ✓  cargos-crud.spec.ts:86  POST /empresa/cargos duplicate nombre → 409 with field=nombre
  ✓  cargos-crud.spec.ts:97  PATCH /empresa/cargos/:id activo=false archives the cargo
  ✓  cargos-crud.spec.ts:109 Archived cargo is EXCLUDED from ?activo=true list
  ✓  cargos-crud.spec.ts:121 Archived cargo REMAINS in full list (no filtro)
  ✓  cargos-crud.spec.ts:134 DELETE /empresa/cargos/:id soft-archives (activo becomes false)
  ✓  empresa-bootstrap.spec.ts:52  GET /empresa returns the existing row (normalized contract — never 404)
  ✓  empresa-bootstrap.spec.ts:68  POST /empresa when empresa already exists returns 409 with field
  ✓  empresa-bootstrap.spec.ts:84  POST /empresa unauthenticated returns 401
  ✓  empresa-bootstrap.spec.ts:91  POST /empresa missing required fields returns 400 with Zod errors
  ✓  empresa-bootstrap.spec.ts:105 POST /empresa with invalid email returns 400
  ✓  empresa-bootstrap.spec.ts:116 GET /empresa/cargos returns the 7 default cargos seeded by jul9_cargo_empresa
  ✓  empresa.spec.ts:32  GET /empresa should return 401 without authentication
  ✓  empresa.spec.ts:37  GET /empresa should return empresa data
  ✓  empresa.spec.ts:50  PUT /empresa/:id should update empresa fields
  16 passed (1.1s)
```
**Frontend regression**:
```bash
cd frontend && TEST_API_URL=http://100.85.193.33:3101/api/v1 \
  TEST_FRONTEND_URL=http://100.85.193.33:3100 \
  npx playwright test tests/local-qa/jul9-empresa-save.spec.ts tests/local-qa/jul9-cargos-manager.spec.ts
# → 2 passed (4.8s)
```

### AC6: Staging BEFORE evidence captured

**Command** (read-only, AWS creds via SSM):
```bash
QA_EMAIL=$(aws ssm get-parameter --name /miempresa/staging/qa/QA_USER_EMAIL --with-decryption --region us-east-1 --profile disruptive --query Parameter.Value --output text)
QA_PASS=$(aws ssm get-parameter --name /miempresa/staging/qa/QA_USER_PASSWORD --with-decryption --region us-east-1 --profile disruptive --query Parameter.Value --output text)
API=https://miempresa-api-stg.disruptiveexp.com/api/v1
curl -s -c /tmp/w6-stg-jar -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$QA_EMAIL\",\"password\":\"$QA_PASS\"}" -o /dev/null -w "login: %{http_code}\n"
curl -s -b /tmp/w6-stg-jar "$API/empresa" -w "\nGET /empresa: HTTP=%{http_code}\n"
curl -s -b /tmp/w6-stg-jar "$API/empresa/cargos" -w "\nGET /empresa/cargos: HTTP=%{http_code}\n"
ssh -i ~/.ssh/miempresa-lightsail-key.pem ... ec2-user@54.144.25.72 \
  "sudo -u postgres psql -d miempresa_staging -c \
   \"SELECT (SELECT count(*) FROM empresas) AS empresas, (SELECT count(*) FROM cargos_empresa) AS cargos, (SELECT count(*) FROM contratos) AS contratos;\""
```
**Output**:
```
login: 200
{"success":false,"message":"Empresa not found"}
GET /empresa: HTTP=404

{"success":true,"data":[]}
GET /empresa/cargos: HTTP=200

 empresas | cargos | contratos
----------+--------+-----------
        0 |      0 |         0
(1 row)
```
Bug + environment confirmed live on staging (READ-ONLY, no mutation).

---

## Files changed
- `backend/src/services/empresaService.ts` — added createEmpresa + DEFAULT_CARGOS + CreateEmpresaInput
- `backend/src/routes/empresa.routes.ts` — POST / + createEmpresaSchema + normalized GET /
- `frontend/app/stores/auth.ts` — fetchEmpresa tolerates null
- `frontend/app/pages/empresa/editar.vue` — create mode (banner, conditional cargos card, POST branch)
- `frontend/app/pages/empresa/index.vue` — empty-state Card with CTA

## Files added
- `backend/tests/empresa/empresa-bootstrap.spec.ts` (6 tests, 6/6 green)
- `frontend/tests/local-qa/jul10-empresa-bootstrap.spec.ts` (2 tests, 2/2 green)

---

## Hotfix DEPLOY steps for the orchestrator

This is a backend + frontend hotfix. Follow the existing jul-10 staging runbook pattern
(`context/implementation-plan/staging-release-jul10-runbook.md` §R3 + §R4) with the
deltas below. **Do NOT skip the R0/R2 phases** (IaC idempotency + DB backup) — they're
cheaper than a rollback.

### Pre-flight (R0)
```bash
git rev-parse HEAD    # confirm current SHA
cd backend && npx prisma migrate status    # still 20/20 (no new migrations)
npx tsc --noEmit    # clean
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3101/api/v1/health    # 200

# SSH to staging instance — confirm current code is the jul-10 build
ssh -i ~/.ssh/miempresa-lightsail-key.pem ... ec2-user@54.144.25.72 \
  "cd /opt/miempresa/app && npx prisma migrate status 2>&1 | grep -E 'migrations found|Database'"
# expected: 20 migrations found, Database schema is up to date!
```

### Backup (R2) — same as jul-10
```bash
ssh -i ~/.ssh/miempresa-lightsail-key.pem ... ec2-user@54.144.25.72 \
  "sudo -u postgres pg_dump miempresa_staging | gzip > /tmp/pre-w6-hotfix.sql.gz && \
   sha256sum /tmp/pre-w6-hotfix.sql.gz && \
   aws s3 cp /tmp/pre-w6-hotfix.sql.gz s3://miempresa-backups-540657241795-staging/pre-releases/pre-w6-hotfix.sql.gz"
```

### Backend deploy (R3) — same pipeline, new artifact
```bash
cd backend
npm ci && npm run build
ls dist/server.js && ! ls dist/generated
cp infrastructure/db/appspec.yml ./appspec.yml
rm -f /tmp/miempresa-staging-w6-hotfix.zip
zip -r /tmp/miempresa-staging-w6-hotfix.zip \
  appspec.yml dist prisma package.json package-lock.json \
  infrastructure/db/scripts infrastructure/db/utilities \
  -x "*.log"

TS=$(date +%Y%m%d-%H%M%S)
aws s3 cp /tmp/miempresa-staging-w6-hotfix.zip \
  s3://miempresa-artifacts-540657241795-staging/deployments/w6-hotfix-${TS}.zip \
  --region us-east-1 --profile disruptive

DEPLOY_ID=$(aws deploy create-deployment \
  --application-name miempresa-app \
  --deployment-group-name miempresa-staging \
  --s3-location bucket=miempresa-artifacts-540657241795-staging,key=deployments/w6-hotfix-${TS}.zip,bundleType=zip \
  --description "W6 hotfix: POST /empresa + create-mode UI + cargo seed inline" \
  --region us-east-1 --profile disruptive \
  --query deploymentId --output text)

aws deploy wait deployment-successful --deployment-id ${DEPLOY_ID} --region us-east-1 --profile disruptive
```

### R3 post-deploy verification — STAGING HOTFIX EVIDENCE (NEW)
```bash
# (a) GET /empresa should now return 200 { data: null } (was 404)
curl -s -b /tmp/w6-stg-jar "$API/empresa" -w "\nHTTP=%{http_code}\n"
# expected: {"success":true,"data":null}  HTTP=200

# (b) POST /empresa on empty staging should create + seed 7 cargos in one transaction
curl -s -b /tmp/w6-stg-jar -X POST "$API/empresa" \
  -H 'Content-Type: application/json' \
  -d '{"nombre":"MI EMPRESA STAGING","nit":"900888888-1","email":"admin@miempresa-staging.com"}' \
  -w "\nHTTP=%{http_code}\n"
# expected: {"success":true,"data":{"id":1,"nombre":"MI EMPRESA STAGING","nit":"900888888-1",...}}  HTTP=201

# (c) Verify the 7 cargos were seeded atomically
curl -s -b /tmp/w6-stg-jar "$API/empresa/cargos" | python3 -c "
import json, sys
d = json.load(sys.stdin)
names = sorted([c['nombre'] for c in d['data']])
expected = sorted(['Fisioterapeuta','Terapeuta Ocupacional','Educador Físico','Manualidades','Auxiliar de Enfermería','Auxiliar de Servicios Generales','Otro'])
print('count:', len(d['data']))
print('match:', names == expected)
print('names:', names)
"
# expected: count: 7 / match: True / names: [...7 cargo names...]

# (d) Verify on-instance DB state
ssh ... ec2-user@54.144.25.72 \
  "sudo -u postgres psql -d miempresa_staging -c \
   \"SELECT (SELECT count(*) FROM empresas) AS empresas, \
           (SELECT count(*) FROM cargos_empresa) AS cargos, \
           (SELECT count(*) FROM contratos) AS contratos;\""
# expected: empresas=1 / cargos=7 / contratos=0

# (e) Idempotency: a second POST should now 409 (single-empresa invariant)
curl -s -b /tmp/w6-stg-jar -X POST "$API/empresa" \
  -H 'Content-Type: application/json' \
  -d '{"nombre":"DUPLICADA","nit":"900111111-1"}' \
  -w "\nHTTP=%{http_code}\n"
# expected: {"success":false,"message":"La empresa ya existe","field":"empresa"}  HTTP=409
```

### Frontend deploy (R4) — same as jul-10
```bash
cd frontend && ./infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive
curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-stg.disruptiveexp.com/
curl -s https://miempresa-stg.disruptiveexp.com/ | grep -oE 'miempresa-api-stg[^"]*' | head -1
```

### R5 QA (new) — Playwright against staging
Re-use the staging playwright suite per the runbook pattern. Manual UI check:
1. Login as `qa@miempresa.com` (same QA creds as before)
2. Visit https://miempresa-stg.disruptiveexp.com/empresa — should show the empresa card now (no empty-state CTA)
3. Visit https://miempresa-stg.disruptiveexp.com/empresa/editar — should show "Editar Empresa" (not "Crear Empresa") with the seeded cargos visible in the manager below

### Rollback plan
**If the hotfix breaks anything**:
- Backend: redeploy the jul-10 artifact `deployments/jul10-20260710-104847.zip` from S3
- Frontend: redeploy the jul-10 release artifact from `miempresa-frontend-artifacts-540657241795-staging/releases/`
- DB: restore R2 backup (loses the seeded empresa + cargos — re-run R3 with the hotfix and POST again)
- **Asymmetry risk**: the jul-10 backend does NOT know about POST /empresa. If you roll back to it AFTER running the hotfix that created an empresa, the old GET / still works (returns the row). The only NEW thing the old code can't handle is a SECOND POST (but the hotfix already gated that). So rollback is safe.

---

## What I did NOT do (explicit non-goals)
1. ❌ Did NOT run any deploy commands against staging — orchestrator's decision per task spec §4a
2. ❌ Did NOT git-commit — per task spec
3. ❌ Did NOT mutate staging — read-only curls only for BEFORE evidence
4. ❌ Did NOT modify the Prisma schema — no new columns or migrations; the existing `cargos_empresa` table is sufficient

---

## Open items / recommendations for the next worker
1. **dev seed loop**: After hotfix runs on staging, the new empresa is the staging-test empresa. If you want to preserve staging-as-clean for future tests, add a "stage seed empresa" entry to the staging SSM params (mirroring the dev admin@miempresa.com pattern).
2. **Cargo re-seeding future-proofing**: If anyone deletes `cargos_empresa` rows from staging (e.g. during a carga test), they'll need to either re-run the SQL seed OR delete the empresa + recreate it (which re-runs the createMany inline seed). Not a code issue — just operational.
3. **Frontend typecheck**: `nuxt typecheck` fails with an unrelated `vue-tsc ERR_PACKAGE_PATH_NOT_EXPORTED` error in this dev environment (existing toolchain issue, not caused by W6 changes). The dev server hot-reload confirms the new code compiles. The full local-qa suite passes against the live dev server.