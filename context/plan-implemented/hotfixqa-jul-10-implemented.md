# Hotfix-QA jul-10 (S3 credential incident + QA feedback) — Implemented

**Delivered:** 2026-07-11 · **Input:** `context/user-feedback/qa-session-jul-10-hotfixqa.md` → reinterpreted at `qa-session-jul-10-hotfixqa-reinterpreted.md` (12 symptoms S1–S12)
**Deploys:** backend CodeDeploy `d-VGKFFBAIK` + frontend Amplify Job 6 · runbook section "Hotfix hotfixqa — S3 durable fix + S7 + UI (2026-07-11)" in `staging-release-jul10-runbook.md` · **not committed**

## High-level overview

Developer QA after the jul-10 releases found "token expirado" on every S3 surface plus persistence/UX bugs — hours after a 33/33-green release QA. Forensics (two independent workers converging) proved a **latent, time-dependent infra bug, NOT a feature regression**: AWS SDK v3 memoizes file-based credentials with no `expiration` field → the long-lived PM2 process signs presigned URLs with the STS creds cached at startup while the cron rotates the file underneath. Every deploy resets a ~60-min green window; automated QA always ran inside it.

Fixes shipped in layers: instance pm2 restart (immediate) → stopgap-B (guarded `pm2 reload` appended to the cred-refresh cron script — instance + repo copies) → **P0 durable code fix** (`backend/src/config/awsCredentials.ts`: env-aware provider that re-reads the creds file and synthesizes `expiration = mtime+55min` so the SDK cache self-invalidates; local dev default chain untouched). R3b isolation test proved P0 alone re-syncs in-process across a rotation (PID unchanged, stopgap disabled during the test, restored after).

Real code bugs fixed alongside: S7 (empleado certificados `archivoUrl` dropped from the PUT payload → file gone after reload) + missing download affordance; **useFileUpload never checked the S3 PUT status** (fetch doesn't throw on 4xx/5xx → failed uploads returned keys as success — the mechanism that turned the outage into silent data corruption); cert-save refresh; descargar-firmado button; pausa tooltip; contrato tab on empleado detail; silent-spinner error surfacing on fichas/notas.

QA process hardened: `assertUploadPersisted` standard (PUT-200 → reload → key non-null → download 200), S3 canary spec through the app's own presign path, silent-failure spec standard (forced 403/abort → visible error), staging coverage for notas/fichas/empleado-cert. Final staging run 7/7.

## Key decisions & issues

| # | Item | Resolution |
|---|---|---|
| Root cause | SDK `memoizeChain` never invalidates file-creds (no expiration field) | Proven by access-key mismatch (live presign vs file) + SDK source line |
| False regression | "jul-9 worked, jul-10 broke it" | Bug existed since the STS design; deploys reset the 60-min window — timeline reconstructed in W10 forensics |
| Fix layering | pm2 restart → stopgap-B cron reload → P0 code provider | All three shipped; stopgap stays as defense-in-depth |
| W8's Option-A snippet invalid | `fromTemporaryCredentials` export absent in installed pkg | W11 used permitted alternative: mtime-synthesized expiration, no new deps, 14 unit tests |
| useFileUpload PUT unchecked | W10 hardening finding, caught pre-R4 | 2-line fix rode the deploy (R4 held ~10 min); forced-403 spec added; other PUT sites swept (all apiFetch = safe) |
| S7 | archivoUrl dropped from empleado PUT | Fixed in editar.vue + nuevo.vue; reload-persistence spec |
| MED-2/HIGH-1 recurrence | jul-5 lessons under-applied | MED-2 was mis-scoped (per-URL vs per-process); HIGH-1 fix had only the PUT-200 half — both closed by the new standards |
| Ops lessons | Parked workers don't survive session change; never reuse teammate names with shutdowns pending; on-instance script divergence must be repo-synced same-wave | Recorded in team-status + runbook learnings |

## Files (grep-optimized)

**Backend new**: `src/config/awsCredentials.ts` (resolveS3Credentials, makeRotatedCredentialsProvider, mtime+55min expiration) · `tests/s3/awsCredentials.spec.ts` (14)
**Backend modified**: `s3Service.ts` (provider wiring) · `infrastructure/db/scripts/refresh-credentials.sh` (stopgap block ported, 329 lines)
**Frontend modified**: `useFileUpload.ts` (putRes.ok check) · `EmpleadoCertificadosEditor.vue` (S7 + cert-descargar testids) · `empleados/{[id]/editar,[id]/index,nuevo}.vue` (S7 payload, contrato detail tab, firmado download, tooltip)
**Tests new**: `jul10-w11-{empleado-cert-persistence,silent-failure,ui-parity}.spec.ts` (10) · staging: canary + notas + fichas-update + empleado-cert round-trip + assertUploadPersisted helper adoption
**On-instance**: `/opt/miempresa/scripts/refresh-credentials.sh` (+reload block, backup `.bak-w8`)

## Verification chain
Local: tsc clean · 14/14 cred unit tests · 9/9 uploads regression · 9/9+4/4 W11 specs. Staging: 19/19 deploy QA · R3b isolation PASS · S7 curl round-trip PASS · hardening suite 7/7 (canary fresh-STS TRUE).

## Follow-ups
- On-instance cron canary for continuous ≤1h-boundary S3 coverage (W10 recommendation)
- Soft-deleted staging test entities (empleados/pacientes INACTIVO — no hard-delete API)
- Prod note: when prod ships, the P0 provider + stopgap block must be part of the instance design from day one

## Grep hooks
hotfixqa-jul-10 token-expirado ExpiredToken memoizeChain credential-pinning awsCredentials resolveS3Credentials mtime-expiration stopgap-B pm2-reload refresh-credentials R3b-isolation rotation-boundary S7 archivoUrl-dropped putRes.ok silent-failure assertUploadPersisted canary false-regression MED-2-recurrence HIGH-1-recurrence d-VGKFFBAIK amplify-job-6
