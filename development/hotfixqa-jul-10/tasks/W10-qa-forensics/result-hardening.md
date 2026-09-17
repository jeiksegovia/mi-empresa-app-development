# W10 Hardening — FINAL report (task #13, staging-verified)

Implements + validates the ranked hardening proposal from `result.md`. Changes are confined to `frontend/tests/**` (no app source, no git commit). **Ran against staging** after the hotfixqa deploy landed (Amplify Job 6 + CodeDeploy `d-VGKFFBAIK`, which includes the `useFileUpload` PUT-status fix).

## Spec inventory

| # | File | Type | Closes | Assertion core |
|---|---|---|---|---|
| 1 | `tests/helpers/upload-persistence.ts` | NEW helper | BS-1/BS-2 | presignRoundtrip · assertPresignRoundtripFresh · assertUploadPersisted · recentBusinessDay |
| 2 | `tests/staging/staging-s3-canary.spec.ts` | NEW | BS-1 (S3/S5/S6/S9) | presign→PUT→download→GET through the app's own endpoints; PUT200+GET200+byte round-trip = freshness proof |
| 3 | `tests/staging/staging-empleado-cert-roundtrip.spec.ts` | NEW | S5+S7 | upload→persist key→reload→non-null archivoUrl→download GET200 |
| 4 | `tests/staging/staging-fichas-update.spec.ts` | NEW | S1 | single-step COMPLETADO→reload persists→uploaded object downloads |
| 5 | `tests/staging/staging-notas-create.spec.ts` | NEW | S2 | happy path persists + out-of-window fecha → surfaced 400 field:fechaIncidente |
| 6 | `tests/staging/staging-upload.spec.ts` | MODIFIED | BS-2 on upload surface | adopts assertPresignRoundtripFresh (adds the missing download/GET assertion) |
| 7 | `tests/local-qa/jul10-w13-silent-failure-extra.spec.ts` | NEW | BS-3 (cert-empresa + diploma) | page.route abort presign → HARD assert `.p-toast-message-error` |

## Staging pass/fail matrix (run 2026-07-11, `https://miempresa-api-stg.disruptiveexp.com` + `https://miempresa-stg.disruptiveexp.com`, QA user)

| Spec | Result | Evidence |
|---|---|---|
| staging-s3-canary | ✅ PASS | `put=200 get=200 stsToken=true accessKeyId=ASIA…` — STS temp creds, fresh, full round-trip |
| staging-notas-create | ✅ PASS | valid nota persists after reload; stale fecha → 400 `field:fechaIncidente` |
| staging-fichas-update | ✅ PASS | single-step COMPLETADO persists after reload; eval object downloads (GET 200) |
| staging-empleado-cert-roundtrip | ✅ PASS | archivoUrl non-null after reload + downloads (S7 guard holds) |
| staging-upload (helper-adopted) | ✅ PASS | UI PUT 200 **and** the new download/GET round-trip |
| w13 silent-failure: educación diploma | ✅ PASS | presign abort → error toast rendered (HARD assert; staging is cookie-based, no skip) |
| w13 silent-failure: cert-empresa | ✅ PASS | presign abort → error toast rendered (HARD assert) |

**Total: 7/7 PASS. 0 BUG · 0 TEST-ENV · 0 FLAKE.**

### Failure classification
None. For completeness, the two silent-failure specs that **skipped locally** were classified TEST-ENV (local dev SPA holds auth in memory → `page.goto` drops it → detail pages redirect to `/login`; same limitation that breaks `jul9-empleado-educacion`/`jul9-cert-update-comprobante` locally). On staging (cookie-based auth) they render and **hard-assert green** — confirming the skip was purely a local-env artifact, not a spec defect.

### Notable positive signal
The canary reports `stsToken=true` with an **`ASIA…`** access key (STS assumed-role temp creds), versus the local `AKIA…` (long-lived IAM user). This proves staging now signs with STS creds that were **non-expired at run time** and round-trip 200 — i.e. the deployed provider/PUT-status fix is working and the canary is exercising the real credential path. (Meaningfulness at the ≤1h boundary still requires the `deploy+65min` re-run or the durable on-instance cron canary — see below.)

## Cleanup status
- **Certificados**: hard-deleted → **0 residual**.
- **Educación rows**: hard-deleted (DELETE /educacion/:id).
- **Empleados & Pacientes**: staging `DELETE /employees|/patients` are **soft-deletes** — my `finally` ran; all W13 throwaways are left `INACTIVO` (deactivated, excluded from default active lists). No hard-delete exists via API; this matches the runbook's documented test-residue pattern. Residual (all INACTIVO): 2 `W13-CERT-*` empleados, 4 `W13-FICHA-*/W13-NOTA-*` pacientes (one pair also from the deploy's own QA run of these specs).
- **S3 canary objects** (`qa-canary/`, `qa-upload-roundtrip/`, `fichas/`, `certificados-empleado/`): small text/pdf probes left in the staging uploads bucket — harmless, unreferenced.
- **No ACTIVE test entity remains.**

## Local-green (regression baseline)
`TEST_API_URL=http://localhost:3101/api/v1` — 4 API-level staging specs PASS; the 2 UI silent-failure specs SKIP honestly (documented). Same specs, unchanged, pass on staging (bucket-host regex matches `-dev` and `-staging`).

## How to re-run on staging
```
export TEST_API_URL=https://miempresa-api-stg.disruptiveexp.com/api/v1
export TEST_FRONTEND_URL=$(aws ssm get-parameter --name /miempresa/staging/frontend/APP_URL --region us-east-1 --profile disruptive --query Parameter.Value --output text)
export QA_USER_EMAIL=$(aws ssm get-parameter --name /miempresa/staging/qa/QA_USER_EMAIL --with-decryption --region us-east-1 --profile disruptive --query Parameter.Value --output text)
export QA_USER_PASSWORD=$(aws ssm get-parameter --name /miempresa/staging/qa/QA_USER_PASSWORD --with-decryption --region us-east-1 --profile disruptive --query Parameter.Value --output text)
cd frontend && npx playwright test tests/staging/ tests/local-qa/jul10-w13-silent-failure-extra.spec.ts --reporter=list
# Cred-boundary stopgap: re-run the canary at deploy_time + 65min:
npx playwright test tests/staging/staging-s3-canary.spec.ts
```

## Follow-ups (out of this test-only wave)
- **Durable canary**: on-instance cron every 5–10 min hitting the app's presign endpoints, alerting on non-200 — the only variant that catches the pinned-creds expiry continuously (needs infra work).
- **`useFileUpload` PUT-status fix** shipped in this deploy (`d-VGKFFBAIK`); the specs' PUT/GET assertions now backstop it against regression.

## Grep hooks
W13-hardening-final staging-7of7-pass s3-canary stsToken-true ASIA-temp-creds assertUploadPersisted reload-persistence silent-failure-hard-assert soft-delete-residue deploy+65min cron-canary d-VGKFFBAIK amplify-job-6 useFileUpload-put-status-fix
