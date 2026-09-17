# Storage Validation Report — S3 upload architecture (2026-07-05)

**Scope**: validate S3 is the main storage, the certificado-empresa upload issue is solved, Lightsail Node.js config works anywhere, bucket CORS/policies cover localhost:310* + staging URL.
**Method**: static trace (routes/service/env/infra) + live e2e test (login → presign → PUT → download) + read-only AWS inspection (`disruptive` profile).

> **STATUS 2026-07-05 (EOD): ALL FIXES EXECUTED AND VERIFIED — see §Resolution at the bottom.**
> Local uploads now work end-to-end in a real browser (S3 PUT 200 asserted by spec P2-5); full local-qa suite 40/40 green.
> Item 5 (real upload e2e against staging) CLOSED same day: staging release executed (`staging-release-jul5-runbook.md`),
> new `frontend/tests/staging/staging-upload.spec.ts` passed against the live stage — browser PUT direct to
> `miempresa-uploads-*-staging` → 200. **Nothing remains open** (MED-2/MED-3 deferred by decision).

---

## Verdict summary

| Check | Result |
|---|---|
| S3 is the only storage (no filesystem anywhere) | ✅ Confirmed — presigned URLs, browser→S3 direct; no multer/fs/express.static in backend |
| Certificado-empresa upload issue solved | ❌ **NOT SOLVED locally — CRITICAL-1** (metadata-creation BUG-1 is fixed; the file upload itself fails) |
| Lightsail Node.js credential config | ✅ Correct (bootstrap IAM user → STS assume-role cron → creds for root AND ec2-user/PM2) |
| Bucket CORS for localhost:310* + staging | ⚠ Works but wildcard `*` (MED-2); staging bucket only — local bucket missing |
| Additional issues | 3 found (CRITICAL-1, HIGH-1 QA gap, MED-1..3) |

## CRITICAL-1 — Local uploads are 100% broken: bucket `mi-empresa-uploads` does not exist

Live e2e evidence (2026-07-05):
```
POST /api/v1/uploads/presigned-url → 200 { key: "certificados/ebe1f95f-….plain" }   ← presign OK (local signing)
PUT {uploadUrl}                    → 404 <Code>NoSuchBucket</Code><BucketName>mi-empresa-uploads</BucketName>
GET {downloadUrl}                  → NoSuchBucket
```
- `backend/.env` → `AWS_S3_BUCKET=mi-empresa-uploads` and `backend/src/config/env.ts:22` defaults to the same name.
- Buckets that actually exist (account 540657241795): `miempresa-uploads-540657241795-staging`, `miempresa-artifacts-…-staging`, `miempresa-backups-…-staging`, `miempresa-frontend-artifacts-…-staging`.
- Therefore **every local upload since day one has silently failed** — this is the real root of the reported "issue with uploads on certificado empresa". BUG-1 (empresaId 400 on create) was fixed on 2026-07-04, but that only fixed metadata creation; the archivo/comprobante PUT still dies.
- Staging is likely fine (bucket + SSM + CORS + creds all check out) but **unverified end-to-end** — no staging deploy/QA has run since the jul4 work.

**Fix options** (pick one):
1. Create a dev bucket `miempresa-uploads-540657241795-dev` (same CORS as staging) + point `backend/.env` at it. Clean separation. **Recommended.**
2. Point local `.env` at the staging bucket — zero infra work, but local tests pollute staging objects.
Also: remove the misleading default in `env.ts:22` (`|| 'mi-empresa-uploads'`) — fail fast or default to the account-suffixed convention.

## HIGH-1 — QA gap: all 39 specs pass while uploads are broken

The upload-flow specs (jul4-p1 comprobante, jul4-p2 archivo, jul4-p3 hoja de vida, jul4-p6 nomina files) go green because `useFileUpload().uploadFile` returns `null` on failure (error toast only) and forms submit without the key. No spec asserts the S3 PUT succeeded or that the stored `*_url` column is non-null after an upload.
**Fix**: in at least one spec per upload surface, assert the PUT response 200 (via `page.waitForResponse` on the presigned host) or assert the persisted entity has a non-null key. This is the same "happy-path must be asserted" lesson as BUG-1.

## MED-1 — S3 CORS is wildcard

`miempresa-uploads-540657241795-staging` CORS: `AllowedOrigins: ["*"]`, methods GET/PUT/HEAD. It works from localhost:310* and the staging URL **because it allows everything**. Presigned URLs already gate authorization, so risk is contained, but scope it anyway:
```json
{"CORSRules":[{"AllowedHeaders":["*"],"AllowedMethods":["GET","PUT","HEAD"],
  "AllowedOrigins":["https://miempresa-stg.disruptiveexp.com","http://localhost:3100","http://localhost:3101","http://localhost:3102"],
  "MaxAgeSeconds":3600}]}
```
Apply the same config to the dev bucket when created. (API-level CORS_ORIGIN in SSM is already correctly scoped: `https://miempresa-stg.disruptiveexp.com,http://localhost:3100`.)

## MED-2 — Download URLs can outlive the STS session

`generateDownloadUrl` signs for 3600 s using STS session creds that the cron renews at :00/:45 (1 h sessions, stable session name). A URL minted near session end dies when the session expires (S3 presigned links are invalid once the signing temp-creds expire) — sporadic "expired token" on downloads. Low frequency; fix = reduce download expiry to ≤ 900 s, or accept.

## MED-3 — `filename` accepted but ignored

`uploads.routes.ts:12-16` Zod accepts `filename` but the key is always `{folder}/{uuid}.{ext-from-contentType}`; the original filename is lost unless the consumer stores it (only novedades/nomina attachment tables store `nombre`). Certificados/hoja-vida/contrato downloads therefore open as `uuid.pdf`. Either drop `filename` from the schema or use it (sanitized) in the key/Content-Disposition.

## Validated-correct details (no action)

- **Endpoints**: `POST /api/v1/uploads/presigned-url` (auth + Zod; key `{folder|'uploads'}/{uuid}.{ext}`; PUT URL 300 s) · `GET /api/v1/uploads/download-url?key=` (auth; GET URL 3600 s). `backend/src/services/s3Service.ts` uses SDK default credential chain — no hardcoded creds.
- **Lightsail credential chain (works "anywhere", no EC2 metadata dependency)**: user-data seeds `/root/.aws` + `[bootstrap]` profile → `refresh-credentials.sh` (cron :00/:45) assumes `CodeDeployInstanceRole` (1 h, stable session name for CodeDeploy) and writes refreshed creds to **both** `/root/.aws/credentials` and `/home/ec2-user/.aws/credentials` (`refresh-credentials.sh:119-161`) → PM2 runs `miempresa-api` as **ec2-user** (`start-service.sh:70-77`) → Node SDK picks up `~ec2-user/.aws`. ✓
- **IAM**: `CodeDeployInstancePolicy` grants `s3:GetObject/PutObject/ListBucket` on `miempresa-uploads-{account}-*` (`iam-stack.yml:43-56`) — presigned URLs inherit exactly these perms. Bootstrap secret kept in SSM only, not stack outputs. ✓
- **SSM**: `/miempresa/staging/api/AWS_S3_BUCKET` = `miempresa-uploads-540657241795-staging` ✓ · `env.sh:79` default aligns.
- **Bucket hardening**: PublicAccessBlock fully enabled; no bucket policy (not needed — presigned = principal's IAM). ✓
- **Frontend**: single pipeline `app/composables/useFileUpload.ts`; consumers/folders: certificados (`certificados` ×2), EmpleadoCertificadosEditor (`certificados-empleado`), editar (`hojas-vida`, `contratos`), novedades (`novedades`), nomina (`nomina`), pacientes fichas (pre-existing inline, `fichas`).

## Action list (priority order)

1. Create dev uploads bucket + fix `backend/.env` + `env.ts` default (CRITICAL-1)
2. Add upload-success assertions to one spec per surface (HIGH-1)
3. Scope bucket CORS origins on staging + dev (MED-1)
4. Optional: shorten download-url expiry to 900 s (MED-2); resolve `filename` param (MED-3)
5. After staging deploy: run one real upload e2e against staging to close the "unverified" gap

---

## Resolution (2026-07-05, executed same day)

| # | Action item | Status | How |
|---|---|---|---|
| 1 | CRITICAL-1: dev bucket + config | ✅ Done | CFN stack `miempresa-s3-dev` created → bucket `miempresa-uploads-540657241795-dev`; `backend/.env` points at it; `env.ts` phantom default `\|\| 'mi-empresa-uploads'` removed (now `\|\| ''`); `s3Service.ts` `requireBucket()` fail-fast guard added; `.env.example` documents the architecture + naming convention |
| 2 | HIGH-1: upload-success assertion | ✅ Done | New spec **P2-5** (`jul4-p2-cert-empleado-archivo.spec.ts`) drives a real browser upload and asserts the actual S3 PUT returns 200 (`page.waitForResponse` on `/s3\./`) — broken bucket/CORS/composable can never silently pass again |
| 3 | MED-1: scope bucket CORS | ✅ Done | `put-bucket-cors` applied to **staging** and **dev** buckets: origins = staging domain + localhost:3100/3101/3102 (verified live via `get-bucket-cors`); `s3-stack.yml` parameterized (`UploadsCorsAllowedOrigins`, `Environment=dev` support, `IsServerEnvironment` condition) so the template matches live state |
| 4 | MED-2/MED-3 (optional) | ⏸ Deferred | Download expiry stays 3600 s; `filename` param still ignored — acceptable, revisit if reported |
| 5 | Staging upload e2e | ✅ Done | jul-5 staging release R5: `tests/staging/staging-upload.spec.ts` passed live — real browser PUT to the staging bucket → 200 (spec pins the destination host per CRITICAL-2 lesson) |

### CRITICAL-2 (found while fixing HIGH-1) — frontend response-wrapper bug in `useFileUpload`

Writing the P2-5 assertion exposed a **second, independent upload-killer**: `useFileUpload.ts` read `res.uploadUrl` / `res.key` / `res.downloadUrl` directly, but the backend wraps every response as `{ success, data: {...} }`. So `uploadUrl` was `undefined` and the browser PUT went to `http://localhost:3100/empleados/<id>/undefined` — which the Nuxt dev server answered with 200, masking the failure. **Even with the bucket fixed, no browser upload ever reached S3.**
Fix: destructure from `res.data` in both `uploadFile` and `downloadFile` (`frontend/app/composables/useFileUpload.ts`). Diagnostic proof after fix: `PUT https://miempresa-uploads-540657241795-dev.s3.us-east-1.amazonaws.com/certificados-empleado/… → 200`.
Also fixed en route: `playwright.config.ts` default `baseURL` was `localhost:3000` (frontend runs on 3100).

**Lesson (same family as BUG-1/HIGH-1)**: a 200 on the wrong URL is worse than an error — always assert the *destination host* of side-effect requests, not just "a request succeeded".

Final verification: full `tests/local-qa/` suite **40/40 green** (includes P2-5).

## Grep hooks
storage-validation NoSuchBucket mi-empresa-uploads miempresa-uploads-540657241795 dev-bucket CORS AllowedOrigins refresh-credentials CodeDeployInstanceRole ec2-user presigned-url download-url CRITICAL-1 CRITICAL-2 upload-assert-gap useFileUpload res.data wrapper undefined-put
