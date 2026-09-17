# W2-sec-code-1 — completion report

> Static-only security map of `backend/src/` (13 route groups + middleware + services) and
> `frontend/app/` (SPA). Precision-first; every claim is a file:line reference. Worker scope
> was strictly read-only — only `npm audit` was executed (read-only, no `--fix`).

## Acceptance criteria mapping

| # | Criterion (assignment §Acceptance Criteria) | Status | Evidence |
|---|---|---|---|
| 1 | `evidence/code-map/` has the route × middleware table covering all 13 route groups | ✓ | `evidence/code-map/01-routes-middleware-map.md` (13 routers, ~80 routes) |
| 2 | Every injection/XSS candidate cites file:line and a parameterized/interpolated (or trusted/user-controlled) classification | ✓ | `evidence/code-map/04-injection-inventory.md`, `evidence/code-map/10-frontend-xss-token-csp.md` |
| 3 | `delicate-shortlist.md` ranks items needing orchestrator adjudication with exact refs | ✓ | `evidence/code-map/delicate-shortlist.md` (S1–S11, ranked by severity) |
| 4 | `npm audit` high/critical counts recorded verbatim | ✓ | `evidence/code-map/09-npm-audit.md` (0 critical / 8 high / 3 moderate / 1 low) |
| 5 | Candidate findings in contract format with evidence paths | ✓ | All evidence files in `evidence/code-map/` + this report |

## Deliverables

1. `development/security-audit-backend/tasks/W2-sec-code-1/completion-report.md` — THIS FILE
2. `development/security-audit-backend/evidence/code-map/`
   - `01-routes-middleware-map.md`
   - `02-authn-gaps.md`
   - `03-authz-rbac-matrix.md`
   - `04-injection-inventory.md`
   - `05-input-validation.md`
   - `06-secrets-env.md`
   - `07-cors-headers.md`
   - `08-error-leak.md`
   - `09-npm-audit.md`
   - `10-frontend-xss-token-csp.md`
   - `delicate-shortlist.md`
   - `sources/` (empty — no external sources cited for static-only work)
3. `development/security-audit-backend/evidence/index.md`
4. `development/security-audit-backend/tasks/W2-sec-code-1/progress-report.md`

## Task IDs

- **#3 Backend static map** — completed.
- **#4 Frontend XSS / token / CSP map** — completed (TaskUpdate in same turn after #3 closed).

## Top recommendations (one sentence each, see shortlist for refs)

1. **Add a startup-time crash if `JWT_SECRET` is unset in any prod-like env** (env.ts:16) — closes an attacker-known-fallback risk.
2. **Whitelist the S3 key prefix accepted by `/uploads/download-url`** (uploads.routes.ts:64) — closes arbitrary-bucket-key read presigning.
3. **Constrain `folder` in `presignedUrlSchema`** (uploads.routes.ts:8-12) — closes arbitrary-prefix object key injection.
4. **Add the `__Host-` cookie prefix** to `session` cookie (auth.ts:44-49) — defense-in-depth.
5. **Render access-denied toasts via `textContent`** (access-denied.client.ts:25) — defense-in-depth XSS sink.
6. **Add CSP `<meta>` to `nuxt.config.ts`** (or rely on Amplify response headers) — closes XSS-injection gap for SPA shell.
7. **Strip `prismaError.meta?.target`** from production error responses (errorHandler.ts:14) — schema-leak close.
8. **Confirm `MAX_FILE_SIZE_MB` is enforced bucket-side** (env.ts:36-39) — closes unbounded-upload DoS.
9. **Drive `npm audit fix --force`** on a branch with regression test on the S3 presign path (9 transitive packages) — closes 8 high-severity advisories.

## Boundaries observed
- STATIC ONLY. `npm audit` was the only command executed (read-only).
- No mutations to any file or environment.
- No AWS or DB connection attempted.
- Did not run the backend/frontend.

## Notable observations (not findings, just context)
- The route inventory found 0 exploitable RBAC bypasses. All `requireDomain` cells align with
  per-route behaviour; the apparent mismatches (CONTRATOS denied more strictly than matrix at
  centro-costos) are documented intentional tightenings.
- No `v-html`, `eval`, `new Function`, `document.write` anywhere in `frontend/app/`.
- Token storage is httpOnly cookie + in-memory Pinia state — no JS-readable token surface.
- `prod-db/` directory is gitignored — confirmed.