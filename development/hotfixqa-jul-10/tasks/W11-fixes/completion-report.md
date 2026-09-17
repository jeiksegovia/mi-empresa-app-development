# W11 Fixes — completion-report

**Worker**: pt-fullstack-impl
**Tasks**: #9 (wave A), #10 (wave B)
**Date**: 2026-07-10 (UTC)

---

## Acceptance criteria — evidence

### Wave A (#9)

| Criterion | Evidence |
|---|---|
| **A1** Durable credential fix uses env-aware logic (local dev unchanged) | `backend/src/config/awsCredentials.ts` returns `undefined` unless rotated creds detected. Local presign at `:3101` returns URL with `X-Amz-Credential=AKIA_REDACTED/...` (long-lived `disruptive` profile, NOT a `ASIA...` session token). Verbatim: see "Verification" below. |
| **A2** Synthesized `expiration` makes the SDK auto-invalidate | `makeRotatedCredentialsProvider()` returns `{ accessKeyId, secretAccessKey, sessionToken, expiration: new Date(mtime + 55*60*1000) }`. SDK's `memoizeChain` invariant: *"expire creds 5 min before declared `expiration`"*. |
| **A3** Unit-tested | `backend/tests/s3/awsCredentials.spec.ts` — **14/14 pass** (see Verification). |
| **A4** No new deps | No `package.json` change — uses already-installed `@aws-sdk/types`, `@aws-sdk/client-s3`. |
| **A5** S7 empleado-certificates: `archivoUrl` included in PUT | `empleados/[id]/editar.vue:759-763` + `empleados/nuevo.vue:343-348`. Local-QA spec `jul10-w11-empleado-cert-persistence.spec.ts:PERSIST` proves PUT→reload→key. |
| **A6** S7 download affordance | `EmpleadoCertificadosEditor.vue:189-200` (`cert-descargar-N` testid + tooltip). Spec `…UI-PARITY/PERSIST` confirms visibility after reload. |

### Wave B (#10)

| Criterion | Evidence |
|---|---|
| **B1** C3 — cert save auto-refreshes page | Already wired at `certificados/[id].vue:280-320`. Spec `jul10-w11-ui-parity.spec.ts:C3` asserts the response + a follow-up GET on `/certificates/.../updates`. |
| **B2** C4 — contrato "descargar firmado" button | `empleados/[id]/editar.vue:1537-1548` (existing list), `empleados/[id]/index.vue` (detail tab). Spec `…UI-PARITY:C4` proves visibility. |
| **B3** C5 — pause tooltip | `empleados/[id]/editar.vue:1525` (existing `v-tooltip.top="'Desactivar'"`). Spec `…UI-PARITY:C5` asserts hover surfaces the tooltip text. |
| **B4** C6 — empleado detail Contrato tab | `empleados/[id]/index.vue:81-85` + the new panel block (fetchContratos on mount, render row, download buttons). Spec `…UI-PARITY:C4/C6` proves the rows + firmado button render. |
| **B5** C1 + C7 — silent-failure specs | `jul10-w11-silent-failure.spec.ts` (3 tests) — all green. |
| **B6** Verify the full vertical path works | 9/9 local-QA W11 specs pass; 14/14 backend unit tests pass; 9/9 backend regression (uploads) pass. |

---

## Verification (verbatim command + output)

### 1) Backend TypeScript still compiles
```bash
$ cd backend && timeout 60 npx tsc --noEmit ; echo "exit=$?"
exit=0
```

### 2) Backend unit tests — `awsCredentials` (P0)
```bash
$ TEST_API_URL=http://100.85.193.33:3101/api/v1 timeout 90 npx playwright test tests/s3/ --reporter=list
Running 14 tests using 1 worker
  ✓ parseDefaultBlock › parses access keys + secret                              (4ms)
  ✓ parseDefaultBlock › parses session token when present                        (1ms)
  ✓ parseDefaultBlock › returns null when [default] is absent                    (0ms)
  ✓ resolveS3Credentials › no session token anywhere → undefined (default chain) (0ms)
  ✓ resolveS3Credentials › AWS_CREDS_ROTATED=1 → provider (env flag overrides)   (1ms)
  ✓ resolveS3Credentials › AWS_SESSION_TOKEN env → provider                      (1ms)
  ✓ resolveS3Credentials › session token in file + no env vars + no profile → …  (0ms)
  ✓ resolveS3Credentials › session token in file BUT AWS_PROFILE set → …        (0ms)
  ✓ resolveS3Credentials › AWS_ACCESS_KEY_ID without AWS_SESSION_TOKEN … → …    (0ms)
  ✓ makeRotatedCredentialsProvider › yields expiration derived from file mtime+55m(1ms)
  ✓ makeRotatedCredentialsProvider › re-reads the file across calls              (1ms)
  ✓ makeRotatedCredentialsProvider › expires gracefully when file missing        (2ms)
  ✓ makeRotatedCredentialsProvider › falls back to Date.now() when mtime=0       (0ms)
  ✓ rotation boundary (W8 bug) › after expiration, next call sees fresh creds   (0ms)
  14 passed (534ms)
```

### 3) Backend regression — uploads (no behavioral change for dev)
```bash
$ TEST_API_URL=http://100.85.193.33:3101 timeout 60 npx playwright test tests/uploads/ --reporter=list
Running 9 tests using 1 worker
  ✓ POST /api/v1/uploads/presigned-url › should return 401 without authentication (5ms)
  ✓ POST /api/v1/uploads/presigned-url › should return 400 with missing contentType(5ms)
  ✓ POST /api/v1/uploads/presigned-url › should return 400 with empty body        (5ms)
  ✓ POST /api/v1/uploads/presigned-url › should return presigned upload URL …    (8ms)
  ✓ POST /api/v1/uploads/presigned-url › should include folder prefix in key     (5ms)
  ✓ POST /api/v1/uploads/presigned-url › should use default uploads folder       (4ms)
  ✓ GET  /api/v1/uploads/download-url › should return 401 without authentication (2ms)
  ✓ GET  /api/v1/uploads/download-url › should return 400 when key param missing(5ms)
  ✓ GET  /api/v1/uploads/download-url › should return download URL for a given key(7ms)
  9 passed (668ms)
```

### 4) Frontend local-QA — all W11 specs (S7 / C1+C7 / C3+C4+C5+C6)
```bash
$ TEST_API_URL=http://100.85.193.33:3101/api/v1 \
  TEST_FRONTEND_URL=http://100.85.193.33:3100 \
  timeout 180 npx playwright test \
    tests/local-qa/jul10-w11-empleado-cert-persistence.spec.ts \
    tests/local-qa/jul10-w11-silent-failure.spec.ts \
    tests/local-qa/jul10-w11-ui-parity.spec.ts \
  --reporter=list
Running 9 tests using 1 worker
  ✓ S7 › PUT → reload → key persists (the actual S7 invariant)                  (1.9s)
  ✓ S7 › download-url presign for the persisted key (W10 BS-1 host-pinned)     (175ms)
  ✓ C7 › ficha PATCH 400 — backend surfaces a non-200 (no fake 200 + spin)     (1.2s)
  ✓ C7 › ficha file presign abort → useFileUpload surfaces the error            (1.3s)
  ✓ C1 › nueva nota — forced 400 surfaces fechaIncidente-error AND toast        (1.2s)
  ✓ C3 › cert updates POST returns the updated certificate + history refetched (1.6s)
  ✓ C4/C6 › detail page Contrato tab renders rows + descargado firmado button   (1.8s)
  ✓ C4 › editar.vue contrato row exposes the firmado download button            (1.7s)
  ✓ C5 › pause icon button has the "Desactivar" tooltip                         (1.8s)
  9 passed (13.7s)
```

### 5) Local-dev presign still signs with the disruptive profile key (P0 env-aware)
```bash
$ COOKIE=$(curl -s -i -X POST http://localhost:3101/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@miempresa.com","password":"<redacted>"}' \
    | grep -i "set-cookie:" | head -1 | sed 's/.*session=\([^;]*\).*/\1/')
$ curl -s -X POST http://localhost:3101/api/v1/uploads/presigned-url \
    -H "Content-Type: application/json" \
    -H "Cookie: session=$COOKIE" \
    -d '{"contentType":"application/pdf","folder":"test/w11"}' | head -1
{"success":true,"data":{"uploadUrl":"...X-Amz-Credential=AKIA_REDACTED%2F20260711%2Fus-east-1%2Fs3%2Faws4_request&...",
 "key":"test/w11/<uuid>.pdf"}}
```
The presigned URL is signed with `AKIA_REDACTED` (the long-lived
`disruptive` profile key, **not** an `ASIA...` STS session token) — confirming
W11 P0's env-aware logic correctly returns `undefined` from the resolver when
`AWS_PROFILE=disruptive` is set, so the SDK falls back to its default provider
chain (unchanged dev behavior).

---

## Deviations from the assignment (recorded, none breaking)

1. **W8's `fromTemporaryCredentials` import was invalid** — the export doesn't
   exist in the installed package (`grep` confirmed only `defaultProvider`).
   W11 took the assignment's permitted alternative: synthesize `expiration`
   from the file mtime. Documented in result.md §Design Decision.

2. **W8's C2 (no download affordance for certificado)** — fixed in
   `EmpleadoCertificadosEditor.vue` alongside P1.

3. **Used Python (`str.replace`) for an `Edit` tool indirection** — the
   `empleados/[id]/index.vue` tabs block had invisible trailing whitespace on
   blank lines that `Edit` could not match. The Bash+Python path produced a
   byte-identical edit; no semantic difference.

4. **Local-QA specs run against `100.85.193.33` (the developer's IP)** —
   frontend's `.env` ships `NUXT_PUBLIC_API_BASE=http://100.85.193.33:3101/api/v1`,
   so the SPA only auth-flows correctly when the test pins both URLs to that
   IP (otherwise the SameSite=Strict cookie doesn't transfer). Documented
   in the spec headers.

---

## Constraints honored

- ✅ Did not modify `useFileUpload.ts`, `useFileStash.ts`, `nuxt.config.ts`
- ✅ Did not deploy / restart staging
- ✅ Did not git-commit (no `git commit` invoked in this session)
- ✅ Did not run the staging-only stopgap task `#11` (already marked
  completed by another worker)
- ✅ Preserved data-testids; added a few new ones (`cert-descargar-N`,
  `contrato-firmado-download-${cid}`, `contrato-detail-*`)
- ✅ UI text Spanish; code/variable English
- ✅ E1 uppercase preserved on all enum / option labels

---

## Parked status
Worker is PARKED per the task assignment; nothing further to ship.
Next signal from the orchestrator will re-task if W12 introduces changes.
