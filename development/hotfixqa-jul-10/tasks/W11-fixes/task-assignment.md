# task-assignment — fix waves A + B (W11, pt-fullstack-impl)

## Task Type
IMPLEMENTATION

## Task IDs
- `9` — Wave A: durable S3 credential fix (P0) + S7 persistence bug (P1)
- `10` — Wave B: UI items C1/C3–C7
Work in order; `TaskUpdate` each.

## Context (read in order)
1. `context/user-feedback/qa-session-jul-10-hotfixqa-reinterpreted.md` — the 12 symptoms + C1–C7
2. `development/hotfixqa-jul-10/tasks/W8-s3-forensics/result.md` — root cause + classification table + §Durable-fix options (A/B/C, A recommended)
3. `development/hotfixqa-jul-10/tasks/W10-qa-forensics/result.md` — assertion standards your specs must follow (`assertUploadPersisted`, silent-failure pattern)

## WAVE A (#9)

### P0 — Durable credential fix (`backend/src/services/s3Service.ts`)
Root cause: module-level `S3Client` caches file-based creds forever (no `expiration` in the ini format). W8's Option A: a credentials provider that re-resolves and yields creds WITH `expiration` so the SDK cache self-invalidates.

**Hard requirements**:
- **Env-aware**: local dev uses `AWS_PROFILE=disruptive` long-lived keys (no session token, no rotation) — the default chain MUST remain the local behavior. Only apply the re-resolving provider when running with rotated session creds (detect: no `config.aws.profile` AND creds file/env has `aws_session_token`, or an explicit env flag like `AWS_CREDS_ROTATED=1` set via SSM/env.sh — pick the cleanest, document it).
- Validate W8's snippet before trusting it: `fromTemporaryCredentials` lives in `@aws-sdk/credential-providers` (W8 cited `credential-provider-node` — verify import + installed packages; if adding a dep, prefer what's already in node_modules).
- **Simplest robust alternative you may choose instead** (justify in result.md): a custom async `credentials` function that re-reads `~/.aws/credentials` and returns `{accessKeyId, secretAccessKey, sessionToken, expiration: <file mtime + 55min>}` — synthesizing the expiration restores SDK cache invalidation without an extra STS call. Evaluate both; implement ONE.
- Local verification: presign still works locally (curl upload round-trip). On-instance verification happens at deploy (not yours).
- Unit-testable: extract the provider into a small module (e.g. `backend/src/config/awsCredentials.ts`) with a spec covering: creds-without-token → default chain; creds-with-token → provider yields expiration.

### P1 — S7: empleado certificados file gone after save/reload
STILL-BROKEN per W8's curl re-test (so NOT an S3 cascade). Compare against the diploma path (S6) which persists correctly:
- `frontend/app/components/EmpleadoCertificadosEditor.vue` + the employees certificados save endpoint — trace whether the uploaded key is included in the PUT payload, whether the backend persists it, or whether the response mapping drops it.
- Also add the missing download affordance (diploma shows one; certificado doesn't — S7 second half).
- Spec: `assertUploadPersisted` pattern — upload → save → reload → key non-null → download URL 200 (backend spec + extend the relevant local-qa spec).

## WAVE B (#10)
- **C3**: `certificados` save → page doesn't refresh (S4). Re-fetch/refresh after save (follow the Agregar-dialog refresh pattern).
- **C4**: contrato tab — add "descargar firmado" button (currently only the blank contract downloads, S10).
- **C5**: the "pausa" icon button on contratos → tooltip (`v-tooltip`) naming the real action (deactivate/archive) (S8).
- **C6**: `empleados/[id]/index.vue` — add read-only "Contrato" tab for parity with editar (S11). Reuse display components; no edit controls.
- **C7+C1**: fichas actualizar-estado + notas nueva: with S3 healthy these were INFRA-FIXED (S1/S2), but the silent-spinner UX remains — ensure every failure path surfaces a toast/inline error and the spinner always stops (`finally`). Verify by forcing failure via `page.route` abort in the spec (W10's silent-failure pattern).
- Specs per fix in `frontend/tests/local-qa/jul10-hotfixqa-*.spec.ts` naming.

## Constraints
- Local :3100/:3101 live — don't restart; kill exact PIDs only if HMR breaks
- Do NOT modify `useFileUpload.ts`/`useFileStash.ts`/`nuxt.config.ts`; no migrations expected
- Do NOT deploy — staging deploy is a separate user-gated wave
- No git commit; UI text Spanish; preserve data-testids; E1 uppercase + stash-key conventions apply
- STAGING is read-only for you (and re-breaks hourly until your P0 ships — don't rely on it for verification)

## Deliverables
1. Source changes waves A+B
2. Specs (backend + local-qa) — green locally
3. `tasks/W11-fixes/{result.md,progress-report.md,completion-report.md}` — result.md includes the P0 design decision + how to verify on-instance post-deploy

## Reporting
Standard protocol. Wave A done → brief CHECKPOINT (P0 design decision summary) then continue to Wave B without waiting. All done → `SendMessage(to: "main", "COMPLETE: Fix waves A+B done. P0: {approach}. See tasks/W11-fixes/result.md", summary: "W11 complete")`. Stay PARKED after.
