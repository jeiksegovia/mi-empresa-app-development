# Feature Plan: fixes-jul17-2

## Objective
Three follow-ups to the shipped dynamic-fichas release: (1) role-aware QA users + RBAC domain
gating (qa-admin / qa-gerontologa / qa-contratos), (2) mandatory documented QA-seeding step for
staging deploys/resets, (3) instrumentos UX: crear-from-template + audit view + dry-run.

## Assumptions & Constraints
Intake + requirements R1–R12 + access matrix are authoritative. Fresh workers only (user
directive), ≤2 concurrent. D1 (no builder) stays locked. Local-first; staging release later.

## Existing Patterns Used
- Auth middleware: `backend/src/middleware/auth.ts` (`requireRole`, `requireInstrumentWriter` with
  ADMIN bypass + tipoEmpleado check) → new `requireDomain(...)` guard extends this file/pattern.
- Enum migrations: `TipoEmpleado` added jul-10 (additive enum) → same pattern for `CONTRATOS`.
- QA seeding: `backend/prisma/test-db/{seed-qa.ts, seed-qa-staging.sh, get-qa-creds.sh}` (SSM
  SecureString, tunnel, idempotent upsert) → extended, not replaced.
- Instrument service/routes + dynamic-fichas contract (post G2-12): `instrumentService.ts`,
  `instruments.routes.ts`, `InstrumentoVersion` versioning + `instruments:upgrade` VERSION_LOCKED
  semantics → crear-from-template reuses the version-creation path.
- Frontend: Nuxt nav/layout `frontend/app/layouts/default.vue` (sidebar), route middleware pattern
  (`session-expired.client.ts` plugin precedent), `DynamicInstrumentForm` + `scoring.ts` +
  `/dev/instrument-preview` (renderer + optimistic engine → audit/dry-run reuse), `InstrumentResultView`.
- Tests: `backend/tests/{instruments-dynamic,instruments,patients}/`, `frontend/tests/instruments-dynamic/`,
  origin-aware auth helper.

## Requirements
R1–R12 (01-requirements) + Access Matrix (verify-against-routes with deviations).

## Technical Approach
1. **RBAC**: additive `TipoEmpleado.CONTRATOS`; backend `requireDomain('<domain>')` middleware
   using a single access-matrix map (one source of truth exported for tests); applied per router
   mount; `tipoEmpleado=null` → legacy behavior; 403 `DOMAIN_FORBIDDEN`. Frontend: same matrix
   mirrored in a composable (`useDomainAccess`) driving sidebar filtering + route middleware +
   fichas-tab visibility; user's tipoEmpleado already in session payload (verify; else extend /me).
2. **QA seeding**: `seed-qa.ts` → three upserts driven by env pairs; `seed-qa-staging.sh` ensures 3
   SSM pairs (+ legacy alias); `get-qa-creds.sh` prints all three.
3. **Docs**: reset-staging-db.sh end-of-run reminder block + runbook/checklist REQUIRED step (R6).
4. **Crear-from-template**: `POST /instruments` optional `templateCodigo`; service copies the
   source ACTIVE definition (deep copy, rewrite codigo/nombre), creates instrument + v1 activo in
   a transaction. Contract addendum §4.7 written by orchestrator before spawn.
5. **Audit view**: read-only component fed by the SAME definition JSON (no new backend); tables for
   options+scores, ranges, skip rules. **Dry-run**: renderer in a "prueba" dialog fed by the
   definition + client-side `scoring.ts` optimistic engine (no server writes; banner "Vista previa —
   resultado no oficial"). No new endpoints.

## Risk & Unknowns
- Access matrix vs real route inventory — workers verify and file deviations (e.g., sub-resources
  under /patients used by contratos flows). Watch: `POST /patients/:id/fichas` must be blocked for
  CONTRATOS while patient create stays allowed.
- Session payload may lack tipoEmpleado → small /me or login-response extension (allowed, note in contract).
- Enum migration on staging later: additive = safe.
- Template copy must NOT mutate source template rows (VERSION_LOCKED untouched).

## Implementation Scope (3 waves, fresh workers, ≤2 concurrent)
- **W9 pt-backend-eng (8–13 pts)**: R1 enum migration (gated, additive) → R2 requireDomain +
  matrix module → R4/R5 seed-qa multi-user + SSM + get-qa-creds → R6 docs → R7 crear-from-template
  backend → smoke specs. Owns `backend/**` (+ contract addendum deviations).
- **W10 pt-frontend-eng (8–13 pts, parallel)**: R3 nav/route gating + fichas-tab hiding →
  R8 crear selector + sin-definición states → R9 audit view → R10 dry-run → smoke specs. Owns
  `frontend/**`; builds against contract addendum + access-matrix module shape.
- **W11 pt-test-quality (5–8 pts, fresh)**: R11 RBAC matrix specs (3 profiles × domains),
  crear-from-template e2e, audit/dry-run specs, legacy regression, gap report.

## New Artifacts Proposed (require approval)
1. `TipoEmpleado.CONTRATOS` enum value + migration.
2. `backend/src/middleware/domainAccess.ts` (matrix + requireDomain) — or extension inside auth.ts.
3. `frontend/app/composables/useDomainAccess.ts` + route middleware + 403 handling.
4. `POST /instruments` `templateCodigo` param + service copy logic (contract addendum §4.7).
5. `frontend/app/components/instrument/InstrumentAuditView.vue` + dry-run dialog wiring.
6. Extended seed-qa trio (3 users, 3 SSM pairs, creds listing).
All else extends existing patterns.

## Open Items
- Matrix cells for EMPLEADO-null verified as "today's behavior" by W9 (no tightening this cycle).

## References
00-intake / 01-requirements / dynamic-fichas contract (`development/instrumentos-dynamic-fichas/
orchestration-ctx/decisions/schema-contract-instrumentos-dynamic-fichas.md`) / jul-17 runbook OP notes.
