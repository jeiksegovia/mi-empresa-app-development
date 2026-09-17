# Decision: S2 download-url authorization — corrected (supersedes contract §D-S2)

## Developer ruling (2026-09-17)

- KEEP a FLAT S3 key structure. Do NOT introduce a `user-{userId}/` prefix — changing the key
  format breaks existing files (their keys are stored flat in DB `*Url` columns) for low benefit.
- The BACKEND is responsible for authorization: confirm the caller is entitled to the requested key
  and prevent a user from swapping the key in the link to fetch a different file. S3 stays private
  (PAB on); the backend reinforces access.
- Do not take unnecessary risks for low benefit.

## Corrected S2 spec

1. **Revert** the per-user prefix work in `uploads.routes.ts`/`s3Service.ts`:
   - `userKeyPrefix` / `isKeyOwnedByUser` prefix scheme → removed.
   - Presign keys stay FLAT: `{folder}/{uuid}.{ext}` (folder still validated by the S3 whitelist — keep S3).
2. **download-url authorization** = the requested `key` must be referenced by a DB record the caller
   is authorized to see. Implement a backend check `assertKeyAccessible(key, user)`:
   - Look the key up across the known document columns (enumerate the (model, column) set):
     `empleado.hojaVidaUrl|documentoIdentificacionUrl|diplomaUrl`, `contrato.archivoUrl|archivoFirmadoUrl`,
     `certificado.archivoUrl|comprobantePagoUrl`, nómina `archivoUrl|comprobantePagoUrl`, the generic
     documents/url table, and any other `*Url` column that stores an S3 key (grep schema to complete the list).
   - If the key is found in NO record → 403 (blocks arbitrary/guessed/swapped keys — the IDOR).
   - If found, enforce the caller's existing domain/RBAC access to that record's domain (reuse
     `domainAccess`/service-layer checks already used to view the record). No access → 403.
   - Backward compatible: existing flat keys already in records resolve normally for authorized callers;
     cross-user access (admin views employee doc) works because authorization is by RECORD access, not uploader.
3. Keep the `validate()` on the query (non-empty key) and the standard 403 envelope.

## Latitude / escalate

If wiring per-record domain checks for every column is disproportionately complex/risky, it is
acceptable to ship the **record-existence** check (key must be referenced by some record) as the
first line, and add the finer per-record domain gate where it is cheap — but flag any gap in the
completion report. Do NOT reintroduce a key-format change. If unsure, TURNING-POINT-STRATEGY.

## Keep as-is (already correct, do not touch)

S1 (env.ts crash-fast), S3 (folder whitelist), S4 (content-length via presigned POST — flat keys,
only affects NEW uploads), S5 (timingSafeEqual), S6 (textContent), S8 (no constraint leak). Their
tests stand. Only S2 (ownership) is reworked.

## Tests (S2 rework)
- Authorized caller downloads a key referenced by a record they can access → 200/presign.
- Caller requests a key NOT in any record → 403.
- Caller requests a key in a record they CANNOT access (domain) → 403.
- An existing OLD flat key (no prefix) referenced by a record → still downloadable by an authorized caller (backward-compat).
