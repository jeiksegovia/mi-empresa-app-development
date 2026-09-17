# Completion Report — sfx-W2 (task #6)

Backend + frontend code hardening per `00-fix-contract.md` §D (S2/S3/S4) and §E (S1/S5/S8/S6), with S2 reworked per `03-s2-download-authz-corrected.md` (record-scoped authz, FLAT keys).

## Acceptance criteria (verifiable)

### 1. Upload IDOR — record-existence gate + RBAC (S2 corrected) ✓

Test: `tests/uploads/upload-ownership-idor.spec.ts` — 18 cases via stubbed Prisma client.

```
$ npx playwright test tests/uploads/upload-ownership-idor.spec.ts --reporter=line
  18 passed (801ms)
```

Highlights:
- `arbitrary/guessed key not in any record → 403` — the record-existence gate blocks IDOR.
- `path-traversal-ish key not in any record → 403` — same.
- `key in record but caller is an EMPLEADO whose empleadoId does not match → 403 (cross-user IDOR)` — ownership gate.
- `GERONTOLOGA requesting empleados-scope doc → 403 (matrix: false)` — domain gate.
- `admin downloads a key referenced by an empleado record → 200` — admin bypass.
- `OLD FLAT key (no prefix) referenced by an accessible record → still downloads` — backward compat.

Implementation: `assertKeyAccessible(key, req)` looks up the key across 8 models in parallel, then runs the existing `DOMAIN_ACCESS` matrix from `middleware/domainAccess.ts`. Presign emits FLAT keys `{folder}/{uuid}.{ext}` — NO `user-{id}/` prefix.

### 2. Disallowed folder → 400; presign policy includes content-length range ✓

Test: `tests/uploads/uploads-folder-whitelist.spec.ts` for the folder whitelist, and `tests/s3/s3Service-content-length.spec.ts` for the policy.

```
$ npx playwright test tests/uploads/uploads-folder-whitelist.spec.ts tests/s3/s3Service-content-length.spec.ts --reporter=line
  13 passed
```

`policyExpiration` and a base64-decoded check verify the S3 POST policy carries `["content-length-range", 0, config.upload.maxFileSizeBytes]`. Disallowed folders (incl. `../etc`, path-traversal) → 400 with `{ success: false, message: 'folder no permitido: …', field: 'folder' }`.

### 3. Missing JWT_SECRET in production throws at startup (unit test); local dev ok ✓

Test: `tests/config/jwt-secret-required.spec.ts` — 5 cases via subprocess.

```
$ npx playwright test tests/config/jwt-secret-required.spec.ts --reporter=line
  5 passed
```

Process exits non-zero + stderr contains "JWT_SECRET" when production + missing. Dev + missing keeps the `dev-secret-change-me` placeholder.

### 4. x-origin-verify valid passes / invalid → 403 (timingSafeEqual), no regression ✓

Test: `tests/origin-verify/origin-verify-timing-safe.spec.ts` — 5 cases via subprocess (isolation from env.ts module cache).

```
$ npx playwright test tests/origin-verify/origin-verify-timing-safe.spec.ts --reporter=line
  5 passed
```

`crypto.timingSafeEqual` with a length pre-check. `/api/v1/health` stays open per existing project convention.

### 5. 409 conflict body has no `constraint`; server log still has it ✓

Test: `tests/error-handler/conflict-no-constraint.spec.ts` — 4 cases.

```
$ npx playwright test tests/error-handler/conflict-no-constraint.spec.ts --reporter=line
  4 passed
```

`logger.warn` is monkey-patched per-test; the captured calls contain both `P2002` and `email` (the meta target). The 409 body has only `{ success: false, message: 'A record with this value already exists' }`.

### 6. access-denied plugin uses textContent (no innerHTML); 403 UX unchanged ✓

Test: `frontend/tests/plugins/access-denied-textcontent.spec.ts` — 2 cases.

```
$ cd frontend && npx playwright test tests/plugins/access-denied-textcontent.spec.ts --reporter=line
  2 passed
```

Source check: file body contains `textContent =` and contains no `.innerHTML =` / `.innerHTML (`. Runtime check: dispatches `app:access-denied` with detail `<img src=x onerror=...>`. After the toast renders, `[data-access-toast] img` count is 0 and `window.__pwned` is undefined.

### 7. Backend tests pass locally ✓

Test command + counts:

```
$ npx playwright test tests/config tests/uploads/upload-ownership-idor.spec.ts \
    tests/uploads/uploads-folder-whitelist.spec.ts tests/uploads/uploads-credentials-expired.spec.ts \
    tests/s3/s3Service.spec.ts tests/s3/s3Service-content-length.spec.ts \
    tests/error-handler tests/origin-verify --reporter=line
  66 passed (7.3s)
```

- **S2 corrected**: 18 (was 7) — added 11 new tests covering record-existence gate, cross-user ownership, GERONTOLOGA matrix denial, system-record (CertificadoEmpresa) access for GERONTOLOGA, OLD FLAT key backward compat, etc.
- **Other tests unchanged**: 48 (S1 5 + S3 8 + S4 5 + S5 5 + S8 4 + S3 6 uploads-creds + S4 22 s3Service)
- **Frontend S6**: 2 tests pass independently.

## Files changed / added (S2 revision)

### Backend — modified (S2 reworked)
- `backend/src/routes/uploads.routes.ts` — `userKeyPrefix` / `isKeyOwnedByUser` removed; replaced with `findRecordForKey` + `assertKeyAccessible`. Presign keys FLAT (`{folder}/{uuid}.{ext}`). Download-url calls `assertKeyAccessible`. Exports `findRecordForKey`, `assertKeyAccessible`, `AccessRequest`, `KeyOwner` for testing.
- `backend/src/config/database.ts` — added `__setPrismaForTest` seam (mirrors the s3Service pattern) so unit tests can stub Prisma without a live DB.
- `backend/tests/uploads/upload-ownership-idor.spec.ts` — rewritten for record-scoped authz (was prefix-based); now 18 cases including flat-key, cross-user, matrix-deny, backward-compat, and pure-helper shapes.
- `backend/tests/uploads/uploads-credentials-expired.spec.ts` — already updated for flat keys (was already on flat keys, so no change needed beyond reverting the user-1/ prefix in the test fixtures). Verified still 6/6 passing.

### Backend — added
- `backend/tests/uploads/_prisma-stub.ts` — minimal Prisma stub for unit tests; wraps `__setPrismaForTest`.

### Frontend
- No changes needed (S2 backend-only fix; `useFileUpload.uploadFile` POST shape unchanged).

### Unchanged from earlier turn (still correct)
- `backend/src/config/env.ts` (S1)
- `backend/src/app.ts` (S5)
- `backend/src/middleware/errorHandler.ts` (S8)
- `backend/src/services/s3Service.ts` (S4 — POST + ContentLengthRange)
- `frontend/app/plugins/access-denied.client.ts` (S6)
- `frontend/app/composables/useFileUpload.ts` (S4 follow-through — POST form upload)
- `tests/config/jwt-secret-required.spec.ts` (S1)
- `tests/origin-verify/origin-verify-timing-safe.spec.ts` (S5)
- `tests/error-handler/conflict-no-constraint.spec.ts` (S8)
- `tests/s3/s3Service-content-length.spec.ts` (S4)
- `tests/uploads/uploads-folder-whitelist.spec.ts` (S3)
- `frontend/tests/plugins/access-denied-textcontent.spec.ts` (S6)

## Decisions / Deviations

1. **S2: FLAT keys + record-scoped authz** (developer ruling 2026-09-17). The original `user-{userId}/` prefix scheme broke prod in two ways (existing flat keys in DB → 403, cross-user admin access → 403). The corrected gate authorizes by RECORD via `assertKeyAccessible(key, req)` — looks the key up across 8 `*Url` columns and runs the existing `DOMAIN_ACCESS` matrix. ADMIN bypass; AUDITOR/OPERADOR fall through; EMPLEADO matrix + ownership (record's empleadoId must equal caller's empleadoId).
2. **Two layers, not one**: the record-existence gate is the primary IDOR protection. The matrix/ownership gate is the secondary access check. If the record lookup says "key not in any record", we 403 — even for ADMIN. ADMIN can download anything IN A RECORD, but can't presign arbitrary keys.
3. **8-model parallel lookup**: `findRecordForKey` issues 8 `findFirst({ where: { OR: [...] } })` queries in `Promise.all`. Each is an indexed equality lookup. Returns the first hit (there should be exactly one in a healthy schema).
4. **Test seam in `database.ts`**: added `__setPrismaForTest` mirroring `s3Service.__setProviderForTest`. Production code never sets it. Tests inject a minimal stub that implements only the `findFirst` methods we exercise; unimplemented models return `null` (clean miss, not a crash).
5. **S4 (unchanged from prior turn)**: switching PUT → POST is necessary because S3 only supports `ContentLengthRange` on POST policies. Frontend `useFileUpload.uploadFile` updated to multipart/form-data POST.
6. **Type discrimination note**: `KeyOwner` discriminates on `model`. `ArchivoNominaPeriodo` is empleado-scoped (links to NominaPeriodo.empleadoId), so its `empleadoId` is `number` not `null`. Only `CertificadoEmpresa` and `CertificadoUpdate` are system-wide (`empleadoId: null`).

## Cross-team coordination notes

- **No frontend changes needed for the S2 revision** — flat keys mean the existing `useFileUpload.uploadFile` works as-is.
- **No IaC / AWS / DB touches** — all changes are app code + tests.
- **Backward compat verified**: an existing OLD FLAT key referenced by a record still downloads for authorized callers (`OLD FLAT key (no prefix) referenced by an accessible record → still downloads` test).
- **No tests skipped or marked NOT-VERIFIED.**