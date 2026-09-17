# W2-sec-code-1 progress report

## Step 0 — Workspace bootstrap
- `pwd` → `/Users/jeik/ws/mi-empresa-app-development` (project root, OK).
- Read `development/security-audit-backend/tasks/W2-sec-code-1/task-assignment-static-map.md`.
- Read `development/security-audit-backend/orchestration-ctx/decisions/00-findings-contract.md`.
- Read `development/security-audit-backend/orchestration-ctx/team-plan-security-audit-backend.md`.
- `mkdir -p development/security-audit-backend/evidence/code-map/sources`.

## Step 1 — Read every route + middleware + service file

### Middleware (`backend/src/middleware/`)
- `auth.ts` — `auth`, `authMiddleware`, `requireRole`, `requireInstrumentWriter`.
- `domainAccess.ts` — `DOMAIN_ACCESS` (4 tipos × 11 domains) + `requireDomain` factory + `requireEmployeeUnlocked`.
- `validate.ts` — Zod wrapper (body/query/params).
- `errorHandler.ts` — Prisma P2002/P2025 + Zod + generic 500 (`err.message` if non-prod).
- `forbidLegacy.ts` — rejects legacy `cargo: string` payload.

### Routes (`backend/src/routes/`) — 13 groups
- `auth.ts`, `dashboard.routes.ts`, `employees.routes.ts`, `patients.routes.ts`,
  `nomina.routes.ts`, `instruments.routes.ts`, `empresa.routes.ts`, `uploads.routes.ts`,
  `certificates.routes.ts`, `users.routes.ts`, `asistencia.routes.ts`, `centroCostos.routes.ts`,
  `actividades.routes.ts`, `index.ts` (mounts all 13).

### Config (`backend/src/config/`)
- `env.ts` — env reader + JWT_SECRET fallback `'dev-secret-change-me'` + CORS_ORIGIN parse.
- `database.ts`, `awsCredentials.ts` (STS rotated-credentials provider), `logger.ts`.

### Services (`backend/src/services/`)
- `authService.ts` (bcrypt + JWT), `s3Service.ts` (presign with expiry clamp), `patientService.ts`,
  `employeeService.ts`, `nominaService.ts`, `asistenciaService.ts`, `centroCostosService.ts`,
  `instrumentService.ts`, `certificateService.ts`, `actividadService.ts`,
  `dashboardService.ts`, `educacionEmpleadoService.ts`, `empresaService.ts`,
  `cargoEmpresaService.ts`, `instrumentScoringService.ts`.

### Frontend (`frontend/app/`)
- `composables/useApi.ts`, `stores/auth.ts`, `middleware/{auth.ts, domain-access.global.ts}`,
  `plugins/{access-denied.client.ts, session-expired.client.ts}`, `components/...`,
  `pages/...`, `utils/...`.
- `nuxt.config.ts` — `ssr: false`, no CSP, no security meta, `vite.server.allowedHosts: true`.

## Step 2 — Greps performed
- `grep -rn -E '(\$queryRaw|\$executeRaw|child_process|require\(.*child_process.*\)|fs|path|exec\(|spawn\()' backend/src/` — confirms no `$queryRaw`/`$executeRaw` use in app code (only Prisma generated `.d.ts` types).
- `grep -rEn '(password\s*[:=]\s*["'"'"']|secret\s*[:=]\s*["'"'"']|api[_-]?key\s*[:=]\s*["'"'"']|access[_-]?key\s*[:=]\s*["'"'"']|token\s*[:=]\s*["'"'"'])' backend/src/` — no hardcoded credentials/tokens.
- `grep -rEn '(v-html|innerHTML|outerHTML|document\.write|eval\(|new Function|localStorage|sessionStorage|document\.cookie)' frontend/app/` — only 2 `innerHTML` sinks (both in fallback toast renderers).
- `grep -rEn '(MAX_FILE_SIZE)' backend/src/` — UNUSED (no source references).
- `grep -rEn '(bcryptjs|jsonwebtoken)' backend/src/` — confirmed in users.routes.ts, authService.ts, utils/jwt.ts.

## Step 3 — npm audit (allowed command)
- `npm audit --omit=dev` (read-only, no `--fix`).
- Result: **12 vulnerabilities (0 critical / 8 high / 3 moderate / 1 low)**.

## Step 4 — Evidence files written
- `evidence/code-map/01-routes-middleware-map.md` — full route inventory (~80 rows).
- `evidence/code-map/02-authn-gaps.md` — public routes + `/uploads/download-url` analysis.
- `evidence/code-map/03-authz-rbac-matrix.md` — matrix verbatim + per-route alignment.
- `evidence/code-map/04-injection-inventory.md` — SQL/cmd/path-traversal + uploads pre-flight.
- `evidence/code-map/05-input-validation.md` — Zod vs raw body inventory.
- `evidence/code-map/06-secrets-env.md` — JWT_SECRET fallback risk.
- `evidence/code-map/07-cors-headers.md` — CORS regex + x-origin-verify + helmet analysis.
- `evidence/code-map/08-error-leak.md` — errorHandler analysis.
- `evidence/code-map/09-npm-audit.md` — verbatim npm audit counts + per-advisory table.
- `evidence/code-map/10-frontend-xss-token-csp.md` — XSS surface, token storage, CSP.
- `evidence/code-map/delicate-shortlist.md` — S1–S11 ranked items for orchestrator.
- `evidence/index.md` — one-line-per-file index.

## Key findings (worker -> orchestrator; orchestrator assigns final_severity)
- **S1** JWT_SECRET `'dev-secret-change-me'` fallback at env.ts:16 (HIGH if prod env unset).
- **S2** `/uploads/download-url` accepts arbitrary `key` (MEDIUM; bucket policy dependent).
- **S3** presignedUrlSchema doesn't validate `folder`/`filename` (LOW–MEDIUM; bucket dependent).
- **S4** `MAX_FILE_SIZE_MB` env var appears UNUSED (MEDIUM if intended as guardrail).
- **S5** x-origin-verify uses `===` not `timingSafeEqual` (LOW).
- **S6** innerHTML sink fed by CustomEvent detail (LOW as-is).
- **S7** Helmet CSP disabled + no FE CSP meta (LOW).
- **S8** errorHandler leaks Prisma `meta.target` (LOW).
- **S9** errorHandler leaks `err.message` in non-prod (INFO/LOW).
- **S10** `requireDomain` falls through for AUDITOR/OPERADOR (INFO).
- **S11** npm audit: 8 high transitive (MEDIUM cumulative).