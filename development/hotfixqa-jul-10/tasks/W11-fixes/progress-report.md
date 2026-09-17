# W11 — Fix waves A+B (progress)

**Worker**: pt-fullstack-impl
**Date**: 2026-07-10 (UTC)

## Plan
- Wave A (task #9): P0 durable S3 cred + P1 S7 persistence
- Wave B (task #10): C1/C3–C7

## Step status
- [x] Read W8 result, W10 result, user feedback, env config, current s3Service, EmpleadoCertificadosEditor, empleados/[id]/{editar,index}, certificados/[id], pacientes/[id], useFileUpload, employees.routes, employeeService, uploads.spec
- [x] Validate W8's `fromTemporaryCredentials` import — does NOT exist in installed `@aws-sdk/credential-provider-node`. Custom provider is the chosen approach.
- [x] P0: create `backend/src/config/awsCredentials.ts` with custom env-aware async provider (14/14 unit tests pass)
- [x] P0: update `backend/src/services/s3Service.ts` to use new provider (env-aware: AWS_PROFILE=disruptive defaults to undefined → default chain)
- [x] P0: unit test `backend/tests/s3/awsCredentials.spec.ts` (14 pass)
- [x] Local verification: presign through `localhost:3101` uses long-lived `AKIA...` from `AWS_PROFILE=disruptive` (unchanged dev behavior)
- [x] S7 (P1): fix `empleados/[id]/editar.vue` `saveCertificados` to include `archivoUrl` + hydrate on load + add download button in editor
- [x] Local-QA spec `frontend/tests/local-qa/jul10-w11-empleado-cert-persistence.spec.ts` 2/2 pass against dev
- [→] Wave B starting now
- [ ] C3: certificados/[id].vue — auto refresh after save (follow Agregar-updates pattern; may already be wired)
- [ ] C4: contrato "descargar firmado" button (already has the upload slot, need download affordance)
- [ ] C5: pausa tooltip — verify or add
- [ ] C6: add Contrato tab to empleados/[id]/index.vue (read-only parity)
- [ ] C7+C1: silent-failure specs (force abort presign/PUT, assert visible error + stopped spinner)
- [ ] Final: result.md + completion-report.md

## CHECKPOINT (after Wave A)
**P0 design**: Custom async provider synthesized `expiration = fileMtime + 55min`.
  W8's snippet imported `fromTemporaryCredentials` from `@aws-sdk/credential-provider-node` — that export doesn't exist in the installed version. Rather than add a new dep + STS call, we synthesize expiration from the file's mtime; the SDK's `memoizeChain` self-invalidates 5min before declared expiration (correct per AWS SDK v3 behavior).
  Env-aware: only active when rotated session creds are in play (env `AWS_SESSION_TOKEN`, OR `AWS_CREDS_ROTATED=1`, OR credentials file has `aws_session_token`) AND no `AWS_PROFILE` is set. Local dev with `AWS_PROFILE=disruptive` keeps the default chain — verified via local presign showing `AKIA...` credential.
