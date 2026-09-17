# Security audit + implementation plan — 2026-07-12 (rev 2026-07-12b)

**Scope**: backend (Express + Prisma + JWT + S3 presign), frontend (Nuxt 4 SPA, Amplify), deploy surface (CloudFront + Lightsail + Amplify). **Prod does not exist yet** — staging is the reference.
**Deliverable**: this plan only. No code changes.
**Reference commit**: HEAD `a169460` + uncommitted jul-11 QA fixes.

## Rev 2 — deltas from initial audit

Second pass caught findings the initial audit missed. **Two new CRITICALs** and one architectural HIGH-P0. Changes:

- **NEW C3 — `POST /instruments/records` fully open**: client-controlled `responsable` (userId spoof) + `archivoCompletado` (arbitrary S3 key), no `requireRole`. Any authenticated user creates records for any patient attributed to any user. Same for `PUT /instruments/records/:id`.
- **NEW C4 — Upload folder is client-controlled with no allowlist**: `key = \`${folder}/${uuid}.${ext}\`` — attacker chooses folder freely, can pollute any prefix (including future privileged ones like `admin/`) or use path-traversal-like values.
- **NEW H7 — Multi-tenancy schema gap** (was Section 6 "out of scope"): `Empleado`, `Cliente`, `Instrumento` have **no `empresaId` column**. Only `CertificadoEmpresa` and `CargoEmpresa` are empresa-scoped. Second empresa = every user reads every empresa's data. Must be a prod gate, not a future item.
- **H6 (RBAC gaps) expanded**: added specific inventory of every unguarded write route from the full matrix, not just examples. Notable additions: instrument records (see C3), patient PATCH `.../fichas/:id/status`, employee full-CRUD main routes.
- **NEW M10 — Session cookie has no session-count cap and no IP/UA re-verify**: stolen cookie replays from anywhere; user accumulates unbounded sessions.
- **H1 (ghost `auth.routes.ts`)** — verified truly dead via Node ESM resolution (`./auth.js` → `auth.ts` because `auth.routes.js` also exists as a distinct compiled file), so severity is "latent footgun", not "live". Kept as HIGH because deletion is trivial and the trap (identical `authRoutes` export) is real.

Ranking updates flow through Sections 1, 2, 3. Wave S1 is rewritten. All other waves stand.

---

## 1. Findings — ranked by severity

### CRITICAL

- **C1 — S3 download IDOR** (`backend/src/routes/uploads.routes.ts:64-72`). `GET /uploads/download-url?key=<any>` returns a presigned URL for **any** S3 object as long as the caller is authenticated. There is no ownership check: keys are UUIDs so brute-forcing individual objects is impractical, but every DB row (certificates, empleado docs, nómina archives, fichas, novedades) exposes the key in its JSON response, and there is no cross-check that "this user is allowed to see key X". An AUDITOR of one empresa (once multi-tenant) can enumerate the app for any key it sees and download it. Fix requires per-key ACL derived from the entity that owns it.
- **C2 — Unlimited login brute-force** (`backend/src/routes/auth.ts:29`, `backend/src/services/authService.ts:47-60`). No rate-limit, no lockout, no incremental delay, no login-attempt audit trail. The response is a plain 401 with distinguishable messages ("Credenciales inválidas" vs. "Usuario inactivo") — the second confirms the email exists (user enumeration). Bcrypt cost 10 is fast on modern GPUs; combined with unbounded attempts this is a takeover primitive.
- **C3 — Instrument records: unrestricted create/update + `responsable` spoof + arbitrary S3 key** (`backend/src/routes/instruments.routes.ts:199-243`, service `services/instrumentService.ts:createRecord/updateRecord`). `POST /instruments/records` and `PUT /instruments/records/:id` have **only `authMiddleware()`** — no role gate. Zod schema accepts `responsable: number` (clientId's userId) and `archivoCompletado: string` (S3 key), and the service does **not** override `responsable` with `req.user.id` nor validate the S3 key belongs to any prior upload the user made. Impact: any authenticated user (AUDITOR "read-only", OPERADOR "read-only on instrumentos", plain EMPLEADO) can (a) forge a `RegistroFichaCompletada` on any patient attributed to any user, and (b) reference an arbitrary S3 key (in combination with H4, an SVG payload) so that downstream views render attacker content as a "completed evaluation". Note: the `POST /:id/fichas` route on `patients` is atomic and safer (see H6), but this parallel path bypasses it.
- **C4 — Upload folder is client-controlled** (`backend/src/routes/uploads.routes.ts:41-46`). `folder: z.string().optional()` is used verbatim in the S3 key: `\`${folder || 'uploads'}/${crypto.randomUUID()}.${ext}\``. There is no allowlist (`certificados|empleados|fichas|nomina|novedades|contratos|instrumentos`), no length cap, no path-traversal filter. An attacker can (a) pollute any prefix — e.g. plant a fake "certificate" under `certificados/` so a downstream operator sees an unowned file listed as legitimate; (b) supply `folder: "admin"` or `folder: "system/backups"` to seed a shadow tree; (c) supply `folder: "..%2F..%2Fetc"` (S3 doesn't traverse but downstream parsers might). Combined with H4 (no MIME allowlist) this is the second half of the stored-XSS chain.

### HIGH

- **H1 — Ghost duplicate auth router with weaker cookie policy** (`backend/src/routes/auth.routes.ts`, 99 lines). This file is NOT mounted in `routes/index.ts` (the mounted one is `routes/auth.ts`), but it:
  - Sets a cookie named `sessionToken` (mounted router uses `session`) with `sameSite: 'lax'` (mounted uses `'strict'`).
  - **Returns the JWT in the JSON response body** (`sessionToken: result.sessionToken // Also return in response for client-side storage`) — defeats the httpOnly protection the same handler is trying to give.
  - `POST /logout` reads the token from the `Authorization` header instead of the cookie — never invalidates the cookie-borne session.
  A single accidental import re-exposes all three regressions. Root cause is the same for the middleware layer: `middleware/auth.ts:15` accepts `Bearer <token>` from the `Authorization` header, so any XSS payload can send the token it steals. In an SPA that only uses cookies, the Bearer path is a footgun with no upside.
- **H2 — CSP explicitly disabled** (`backend/src/app.ts:16` — `helmet({ contentSecurityPolicy: false })`) and **no custom headers on Amplify** (no `customHttp.yml` in `frontend/`). Neither the API responses nor the static SPA send CSP, HSTS on the app origin (CloudFront handles the API's HSTS but Amplify's default may or may not include it), Referrer-Policy, X-Content-Type-Options overrides on error pages, or Permissions-Policy. An XSS in the SPA has no runtime containment.
- **H3 — JWT secret has a permissive dev fallback** (`backend/src/config/env.ts:16` — `process.env.JWT_SECRET || 'dev-secret-change-me'`). If a future deploy forgets to inject `JWT_SECRET` via SSM the app starts and signs tokens with a known constant. There is no boot-time assertion that the value differs from the default (or that it is at least ≥32 bytes of entropy).
- **H4 — Presigned upload has no content-type allowlist, no size cap** (`backend/src/routes/uploads.routes.ts:9-46`, `backend/src/services/s3Service.ts:173-184`). The client sends `contentType`, the backend echoes it verbatim into the `PutObject` presign. Any MIME (including `text/html`, `application/xhtml+xml`, `image/svg+xml`) is accepted; the S3 bucket then serves it. `config.upload.maxFileSizeBytes` exists but is never wired into the presign (no `ContentLengthRange` condition on a POST policy, and the current PUT presign can't enforce it). Result: authenticated user can host arbitrary HTML/JS/SVG on the app's S3 domain and (through the download-url endpoint) get a presigned URL that browsers will render as content. Combined with C1 this is a stored-XSS + hosted-payload primitive.
- **H7 — Multi-tenancy is not schema-enforceable today** (`backend/prisma/schema.prisma` — models `Empleado`, `Cliente`, `Instrumento` have NO `empresa_id` column; only `Empresa`-typed models like `CertificadoEmpresa`, `CargoEmpresa`, `Contrato → cargo → empresa` are indirectly scoped). The service layer relies on `getDefaultEmpresaId()` — which does `prisma.empresa.findFirst()` — as the empresa selector, which is correct only because there is exactly one empresa in the DB. The moment a second empresa is inserted:
  - Every `prisma.empleado.findMany()`, `.cliente.findMany()`, `.instrumento.findMany()` returns rows from BOTH empresas, mixed.
  - Every certificate `findFirst` for "the sole empresa" silently picks the older row.
  - The `Instrumento.rolesPermitidos` string is cross-empresa (a role name from empresa A becomes a valid selector for empresa B's instruments).
  - The `Sesion → Usuario` chain has no `empresaId` scope on the JWT either.
  This is a structural gate: **before prod launches with more than one empresa**, every scoped model needs `empresaId` FK + composite unique indexes + `where: { empresaId }` in every service query + `empresaId` claim in the JWT + a middleware `assertSameEmpresa(req, entity)` for `:id`-scoped writes. Effort is 2-3 waves on its own; treating it as a Section-6 out-of-scope item (as rev 1 did) is wrong.
- **H8 — Instrument-record `responsable` is not derived from the authenticated user** (see also C3; keeping H8 as a "class of bug" note). This is the general "attribution spoof" pattern: any field on a Zod schema that names a user, empresa, or resource ID must be server-derived, not client-supplied. Audit sweep for other instances: `certificados.creadoPor` (server-set), `empleados.creadoPor` — verify, `sesion.usuarioId` — server-set, `patients.autor` on notes — server-set. The only leak found today is `RegistroFichaCompletada.responsable`, but future development should follow this rule.
- **H5 — Dependency vulnerabilities**:
  - **Backend**: 12 vulns (5 moderate, 7 high) — express 4.21.0 → 4.22.1 (via qs), and downstream.
  - **Frontend**: 29 vulns (2 critical, 14 high, 9 moderate, 4 low). Notables: `shell-quote` (RCE via newline escape), `simple-git` (RCE via option parsing / protocol.allow), `h3` (path traversal + SSE injection), `devalue` (prototype pollution + DoS), `serialize-javascript` (RCE via RegExp.flags), `rollup` (arbitrary file write), `node-forge`, `nuxt`. Most are transitive from Nuxt itself and require a Nuxt bump.
- **H6 — Role gating is inconsistent and never actually enforces `permisos`** (`backend/src/services/authService.ts:220-228`, `backend/src/middleware/auth.ts:53-72`). `getRolePermissions()` embeds a `permisos` array in the JWT, but **no code path checks it**. Access control is `rol` string only, with `ADMIN` bypass baked into `requireRole`. Full inventory of routes gated only by `authMiddleware()` (i.e., open to EVERY role — ADMIN/EMPLEADO/AUDITOR/OPERADOR alike):
  - **Writes** (any role can): `POST /patients`, `PUT /patients/:id`, `DELETE /patients/:id`, `POST /patients/:id/notes`, `POST /patients/:id/fichas`, `DELETE /patients/:id/fichas/:fichaId`, `PATCH /patients/:id/fichas/:fichaId/status`, `POST /employees`, `PUT /employees/:id`, `DELETE /employees/:id`, `POST /instruments/records` (see C3), `PUT /instruments/records/:id` (see C3).
  - **Reads** (any role sees): `GET /patients` and `:id` (full patient PHI: fecha_nacimiento, tipo_sangre, EPS, notas, contactos, fichas history), `GET /employees` and `:id` (empleado PII: documento, dirección, núcleo familiar, contratos, salarios via nomina relation), `GET /nomina*` (salaries + payment archives), `GET /dashboard/stats|/activity`, `GET /certificates*`, `GET /empresa/cargos`, `GET /instruments*` and `GET /instruments/records/by-instrument/:id`, `GET /employees/:id/pendientes`, `GET /employees/:id/educacion`, `GET /employees/:id/novedades`.
  - This means today's staging user seeded as `OPERADOR` would still see complete empleado + patient + salary data despite the docstring naming them "instrument-scoped operator". The mismatch between designed roles (`getRolePermissions`) and enforced roles (nothing) is the root.

### MEDIUM

- **M1 — Bcrypt cost 10** (`backend/src/services/authService.ts:57`, `backend/src/routes/users.routes.ts:83,156`). OWASP 2025 recommends ≥12 for bcrypt on modern hardware. Login latency budget can accommodate 12 easily.
- **M2 — Weak password policy** (`backend/src/routes/users.routes.ts:16,28`, `backend/src/routes/auth.ts:18`). `z.string().min(6)` — accepts `123456`. No complexity, no breach-list check, no length ≥ 12 recommendation.
- **M3 — Session token stored plaintext in DB** (`backend/src/services/authService.ts:69-98`, `refreshSession` line 206-212). The full JWT is written to `Sesion.token`. A DB dump equals immediate impersonation of every active user until each token's `exp`. The DB doesn't need the raw token — a SHA-256 of it suffices for the lookup done in `middleware/auth.ts:25-31` (which currently doesn't even use `token` — it queries by `id + usuarioId + activa + expiraEn`).
- **M4 — Sliding 7-day session with no absolute cap and no revoke on password change**. `refreshSession` extends expiration to now+7d on every call; a compromised token can be renewed forever. `users.routes.ts` PATCH with `password` field re-hashes but does not invalidate outstanding sessions for that user.
- **M5 — `x-forwarded-for` accepted without `app.set('trust proxy', …)`** (`backend/src/routes/auth.ts:37`). Because Express default is `trust proxy = false`, `req.ip` returns the socket IP (CloudFront's edge), and the code hand-parses the header instead. An attacker can spoof the IP recorded in `Sesion.ip` by sending their own XFF header, since CloudFront forwards custom headers. This poisons the audit trail and defeats any future IP-based rate-limit.
- **M6 — Login response confirms email existence** (`backend/src/services/authService.ts:47-60`). "Credenciales inválidas" vs. "Usuario inactivo" are separately catchable, enabling account enumeration on a corporate email list. Fix: unify to a single opaque 401 message.
- **M7 — CORS allows `!origin` requests** (`backend/src/app.ts:31-32`). "Allow requests with no origin (server-to-server, curl)" bypasses the allowlist entirely. Since the endpoint is CloudFront-fronted, all legitimate browser traffic sends an Origin. Legit server-to-server should be authenticated separately, not by absence of Origin.
- **M8 — Password change and email change endpoints lack re-authentication** (`backend/src/routes/users.routes.ts:119` PATCH). An ADMIN can change any user's password without re-entering their own password. If an ADMIN session is hijacked, mass password-reset is one request.
- **M9 — No CSRF token; single-origin defense via SameSite only** (`backend/src/routes/auth.ts:47`). SameSite=strict is set, which is generally sufficient for a same-site SPA, BUT the mounted `POST /auth/logout` (line 78) is NOT auth-middleware-protected — a same-site GET-triggered form-post can force logouts. Similarly, `POST /auth/refresh` uses `authMiddleware()` which only reads the cookie, so an attacker page that pulls the cookie via same-site can extend the session. Consider a double-submit CSRF token for state-changing endpoints even under SameSite=strict, especially given the intent to eventually add public-domain integrations.
- **M10 — Session cookie has no per-user session cap and no IP/UA re-verification** (`backend/prisma/schema.prisma:model Sesion`, `backend/src/services/authService.ts:65-98`). The `Sesion` model captures `ip` + `userAgent` at login (good for audit), but no code path verifies subsequent requests come from the same IP/UA — a stolen cookie is fully valid from a different device. Additionally, there is no unique constraint / max-count on active sessions per user; a user can accumulate hundreds of `activa=true` rows, each a valid replay vector. Fix: (a) enforce a soft cap (e.g. max 5 active sessions per user; oldest auto-expires), and (b) on high-value operations (password change, empresa creation), require a `Sesion.ip` match or step-up re-auth.
- **M11 — TypeScript ESM footgun: `./auth.js` resolves against two source files with identical exports** (`backend/src/routes/index.ts:2` imports `authRoutes` from `./auth.js`; `backend/src/routes/auth.ts` and `backend/src/routes/auth.routes.ts` both export `authRoutes`). Today Node's ESM resolver picks `auth.ts → auth.js` deterministically (the file with exact stem match wins over `auth.routes.js`), so `auth.ts` is what actually runs. But rename or IDE-auto-import could silently swap them — the ghost file (H1) then becomes live with weaker cookies. Beyond deleting `auth.routes.ts` (H1 fix), add a CI grep guard.

### LOW

- **L1 — `window.open(url, '_blank')` without `'noopener,noreferrer'`** (`frontend/app/composables/useFileUpload.ts:49`, `frontend/app/pages/pacientes/[id]/index.vue:466`). Downloaded S3 URLs open in a new tab that can `window.opener.location = phishing`. Tabnabbing.
- **L2 — Morgan `dev` format logs full URL** (`backend/src/app.ts:46-48`) — captures query strings including `?key=<S3 key>`. If logs aggregate to a central store the S3 keys leak in log data.
- **L3 — No absolute session cap**. Even fixing M4, add an absolute max lifetime (e.g. 30 days from creation) beyond which no refresh is allowed.
- **L4 — Login endpoint distinguishable timing** for existing vs. non-existing accounts. `bcrypt.compare` runs only if the user exists → measurable timing side-channel for enumeration on top of M6.
- **L5 — `refresh-credentials.sh` logs full STS response** — verify by inspection; if `AccessKeyId`/`SecretAccessKey` end up in `/var/log/credential-refresh.log`, that log is a credential store.
- **L6 — No integrity check on presigned uploads**. The client PUTs to S3; there is no post-upload signature verification (SHA-256 in the presign) so a MITM (or a compromised client) can substitute file bytes without any downstream detection. S3 supports `Content-MD5` in the signed policy.
- **L7 — Same S3 bucket for public-ish and sensitive files**. `certificados/`, `empleados/`, `fichas/`, `nomina/` all share the uploads bucket. A path-traversal or key-guess (see C1) crosses trust boundaries. Object-level policy prefixes + separate buckets per sensitivity tier is cleaner.
- **L8 — Prisma error messages leak schema hints in prod path** (`backend/src/middleware/errorHandler.ts:8-25`). `errors: { constraint: prismaError.meta?.target }` returns the DB column list on P2002. Minor info-leak.
- **L9 — No security headers on `/api/*` responses**. `helmet()` (with CSP off) sets some but Amplify's static origin sets others; error responses go through the SPA fallback. Consolidate.
- **L10 — Cookie `secure: process.env.NODE_ENV === 'production'`** — reliable but implicit. Cleaner: `secure: !isDev` from `config` (which is what everything else uses). Also `path: '/'` (default) is fine but explicit is better; `domain` should be pinned in prod so nothing leaks across subdomains.

### INFO / existing good practices worth keeping

- `x-origin-verify` CloudFront-secret gate (`backend/src/app.ts:21-27`) blocks direct hits on the Lightsail port.
- HTTP-only session cookie + `sameSite: 'strict'` on the mounted auth router.
- All Prisma queries go through the client (no `queryRaw`/`executeRaw` in the codebase) — SQL-injection surface is zero.
- Presign-hardening (I1-I3): `CREDS_EXPIRED` 503 + 900s download default + expiry clamp already shipped.
- `reset-staging-db.sh` (jul-11) is staging-only, guarded, developer-run only.
- Middleware for legacy fields (`forbidLegacy`) prevents field-injection on schema evolution.

---

## 2. Threat model summary

| Actor | Assumed capability | What today's code lets them do | What the plan addresses |
|---|---|---|---|
| Unauthenticated attacker | HTTPS to CloudFront | Unlimited credential-stuffing on `/auth/login`; enumerate emails via M6 | C2 rate-limit + lockout, M6 unified message, L4 constant-time |
| Legitimate low-role user (AUDITOR, OPERADOR) | Valid session | Full write on patients + employees + instrument records (via H6, C3); attribute records to another user (C3); write arbitrary content to any S3 prefix incl. impersonating admin folders (C4); download ANY S3 key they can guess/scrape (C1); host arbitrary HTML on S3 (H4) | S1.4/S1.6/S1.7/S1.8 gates + folder allowlist + server-derived attribution + C1 per-key ACL + H4 MIME allowlist |
| Second empresa (future prod) | Valid session in empresa A | Read/write ALL of empresa B's employees/patients/instruments (no `empresaId` on schema) | S1.5 wave: schema empresaId + Prisma extension + JWT claim + spec matrix |
| Compromised session cookie (device theft, malware) | Valid cookie | Full account until 7-day exp, self-renewing forever (M4); no revoke on password change | M3 hashed session tokens, M4 absolute cap + revoke-on-password-change, L3 |
| DB dump / backup exfiltration | Read of `Sesion` + `Usuario` | Impersonate every active user (M3); offline bcrypt crack at cost 10 (M1) | M1 raise cost, M3 hash stored token |
| Frontend XSS (dependency or new component) | Execute JS in SPA context | Exfiltrate session cookie? — httpOnly protects; but can call any API as the user | H2 CSP with `default-src 'self'`, no `unsafe-inline`; no Bearer path |
| Direct instance access (bypass CloudFront) | Network to :3101 | Blocked by `x-origin-verify` today | Keep; add ALB/security-group in prod |

---

## 3. Implementation plan — waves

Each wave is scoped to be independently deployable and testable. Waves are ordered by risk-reduction per unit effort. **CRITICAL and HIGH must ship before any prod launch.**

### Wave S1 — Access control hardening (C1, C3, C4, H1, H6, H8, M11)

**Goal**: no authenticated user can download an object they don't own; no low-role user can write privileged data; no client-controlled folder/attribution; kill the ghost auth router.

- **S1.1 (C1)** Per-object download authorization. Introduce `downloadAccessCheck(userId, rol, key) → boolean` that resolves the owning entity from the key (reverse-lookup: `certificados/<uuid>.pdf` → find `CertificadoEmpresa | CertificadoUpdate` with matching `archivoUrl`/`comprobantePagoUrl`; similar for `empleados/`, `fichas/`, `nomina/`, `novedades/`). Deny if no owning row is found (blocks arbitrary keys). Keys the user is entitled to are exactly those referenced by rows they'd be allowed to GET; reuse existing role checks.
- **S1.2 (C1 continued)** Migration strategy: index each url column that stores S3 keys (`archivoUrl`, `comprobantePagoUrl`, `documentoIdentificacionUrl`, `archivoFirmadoUrl`, `archivoCompletado`, `archivos[].url` on nómina, `archivos[].url` on novedades) for O(1) lookup. Emit a spec that seeds a canary key, tries to download it as a different role, expects 403.
- **S1.3 (H1 + M11)** Delete `backend/src/routes/auth.routes.ts` (unmounted, unsafe cookie + token echo). Delete the `Bearer` fallback in `middleware/auth.ts:15`. Add a CI grep guard: any `Authorization.*Bearer` outside the SDK path fails; any two files exporting an identical route symbol (`authRoutes`, `patientRoutes`, etc.) fails.
- **S1.4 (H6)** Explicitly gate the currently-open routes. Concretely:
  - `POST /employees`, `PUT /employees/:id`, `DELETE /employees/:id` → `requireRole('ADMIN')`.
  - `patients` write endpoints (`POST`, `PUT`, `DELETE`, `POST /:id/notes`, `POST /:id/fichas`, `DELETE .../fichas/:fichaId`, `PATCH .../fichas/:fichaId/status`) → `requireRole('ADMIN', 'EMPLEADO')` (or `requireInstrumentWriter` where appropriate for fichas).
  - `dashboard/stats`, `dashboard/activity` → `requireRole('ADMIN', 'AUDITOR')` per the permission map's intent.
  - `nomina GET /`, `GET /employees/:id/contratos` → `requireRole('ADMIN', 'AUDITOR')`.
- **S1.5 (H6)** Delete the dead `getRolePermissions` machinery + `permisos` claim in the JWT (currently unused). Simpler surface, one fewer thing to keep in sync.
- **S1.6 (C3)** Gate `POST /instruments/records` and `PUT /instruments/records/:id` with `requireInstrumentWriter()` (mirrors the parent `POST /instruments`). Server-side, override `responsable = req.user.id` in the service — the schema field stays as an audit column, but the client's value is ignored (H8 general rule).
- **S1.7 (C4)** Server-side folder allowlist in `POST /uploads/presigned-url`. Replace `folder: z.string().optional()` with `folder: z.enum(['certificados','contratos','empleados','educacion','fichas','instrumentos','nomina','novedades','plantillas']).default('uploads')`. The `uploads` fallback is removed. Add a spec that asserts non-allowlisted folders 400.
- **S1.8 (H8)** Sweep every Zod schema for client-controlled IDs that should be server-derived: `creadoPor`, `modificadoPor`, `responsable`, `usuarioId`, `autor`, `empresaId` (once H7 lands). Ban these in schemas; enforce with a shared `serverOnlyFields` Zod refine. Document the rule in `backend/AGENTS.md` or CLAUDE.md.
- **S1.9** Regression specs: a matrix test that logs in as each role and asserts allowed/denied for every route. New file `backend/tests/security/rbac-matrix.spec.ts`. Blocks merge if new route lacks a matrix entry (via a linter rule matching `router.(get|post|put|patch|delete)` without one of `requireRole|requireInstrumentWriter` on the same line).

### Wave S1.5 — Multi-tenancy architectural gate (H7) — **P0 before prod**

**Goal**: Empleado/Cliente/Instrumento are queryable ONLY within the caller's empresa. Must land before the first prod launch that adds a second empresa.

- **S1.5.1** Schema: add `empresa_id INT NOT NULL` to `empleados`, `clientes`, `instrumentos`. FK → `empresas(id) ON DELETE RESTRICT`. Composite unique indexes on `(empresa_id, numero_documento)`. Backfill = the sole empresa id.
- **S1.5.2** JWT: add `empresaId` to the token payload (from `usuario.empresaId` — add that column on `Usuario` first). Middleware reads it into `req.user.empresaId`.
- **S1.5.3** Prisma extension (recommended over per-service): use Prisma's `$extends` client extension to inject `where: { empresaId: req.user.empresaId }` into every `findMany|findFirst|findUnique|update|delete` on the scoped models. Per-request client via `AsyncLocalStorage`. Blocks the "forget to scope" class of bug entirely.
- **S1.5.4** New `assertSameEmpresa(req, entityEmpresaId)` middleware for `:id`-scoped writes as belt-and-suspenders.
- **S1.5.5** Spec: seed two empresas + two users; assert user A cannot list, GET, PATCH, or delete user B's employees/patients/instruments (404 not 403 — no leakage that the ID exists).
- **S1.5.6** Rewrite `getDefaultEmpresaId()` to `getEmpresaIdForUser(userId)`; delete every `findFirst()` empresa lookup.

### Wave S2 — Auth flow hardening (C2 + M1 + M2 + M6 + L4 + M8 + M9)

**Goal**: brute-force + enumeration + credential change abuse are all closed.

- **S2.1 (C2)** `express-rate-limit` on `POST /auth/login` — 5 attempts per 15 minutes per IP + per email (whichever is stricter). Store counters in an in-memory LRU for now (single instance), migrate to Redis when prod scales.
- **S2.2 (C2 continued)** `LoginAttempt` audit-log table: `{ id, email, ip, userAgent, success, createdAt, reason }`. After 10 failed in 1h for the same email, block that email for 1h and email the ADMIN.
- **S2.3 (M1)** Raise bcrypt cost to 12. Re-hash on next successful login (compare-and-rehash pattern) so migration is transparent. Add config knob `BCRYPT_COST` (default 12) so it can grow with hardware.
- **S2.4 (M2)** Password policy: length ≥ 12, must contain 3 of {lower, upper, digit, symbol}, must not match the user's email local-part. Zod schema in one place (`backend/src/utils/validation.ts`), reused by both `POST /users` and `PATCH /users/:id`.
- **S2.5 (M6 + L4)** Unify login failure: always `401 { message: 'Credenciales inválidas' }` regardless of whether the user exists or is inactive. Add a `bcrypt.compare(password, DUMMY_HASH)` on the "user not found" branch so both paths take the same time.
- **S2.6 (M8)** Require re-authentication (send current password) on the user's own password change; do NOT allow ADMIN blanket password-set — instead issue a one-time reset link (short-lived signed token, email out-of-band). Same for email change.
- **S2.7 (M9)** CSRF: even under `SameSite=strict`, add a double-submit CSRF token for state-changing requests (`POST/PUT/PATCH/DELETE`). Cookie `csrf_token` (readable JS, per-request) + `X-CSRF-Token` header required. Reject on mismatch. Migration: enforce warn-only for one release, then enforce.
- **S2.8** Fix `POST /auth/logout` (`backend/src/routes/auth.ts:78`) — currently NOT auth-protected. Add `authMiddleware()`.

### Wave S3 — Uploads hardening (H4 + L6 + L7)

**Goal**: presigned uploads can only produce safe, size-bounded objects in the correct prefix, and downloads carry integrity.

- **S3.1 (H4)** MIME allowlist per `folder` value. Map:
  - `certificados`, `contratos`, `empleados`, `fichas`, `nomina`, `novedades` → `application/pdf`, `image/png`, `image/jpeg`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
  - Reject `text/*`, `image/svg+xml`, `application/xhtml+xml`, `application/javascript`, `text/html`.
- **S3.2 (H4)** Size cap via presigned POST policy (not PUT) with `content-length-range: [1, MAX_FILE_SIZE_BYTES]`. Migrate the frontend `useFileUpload` PUT flow to POST-with-policy; refuse presign if `Content-Length` header on the client request is > cap.
- **S3.3 (H4 continued)** On download presign, set `ResponseContentDisposition: attachment; filename="<sanitized>"` and `ResponseContentType` derived from the STORED metadata (not the URL) so a mis-tagged upload can't be served as HTML. Already scoped as I4 in the resume-summary — carry over.
- **S3.4 (L6)** Include a `Content-MD5` (or `x-amz-content-sha256`) requirement in the upload policy so the byte stream can be verified server-side after upload. Store the hash on the owning entity; a background job scans a sample of objects periodically.
- **S3.5 (L7)** Separate S3 buckets per sensitivity tier: `miempresa-uploads-public-<stage>` for future public assets (empty today), `miempresa-uploads-employee-<stage>`, `miempresa-uploads-patient-<stage>`. Bucket policies deny cross-prefix access. Migrating existing keys is out of scope — new writes route to the right bucket, reads federate.

### Wave S4 — Session + secret hygiene (M3 + M4 + M5 + H3 + L3 + L5)

**Goal**: sessions and secrets are not usable if the DB or an instance is dumped.

- **S4.1 (M3)** Store `sha256(jwt)` in `Sesion.token`. The middleware already does not use `token` for the lookup, so this is a write-only change. Add `sesion.tokenHash` column, backfill, drop `sesion.token`. A DB dump no longer yields usable tokens.
- **S4.2 (M4)** Absolute session cap: `Sesion.createdAt + 30d` — `refreshSession` refuses beyond this. Emit a new session on password change and INVALIDATE all previous sessions (`updateMany({ where: { usuarioId }, data: { activa: false } })`).
- **S4.3 (H3)** Startup assertion: if `NODE_ENV=production` and `JWT_SECRET` equals `dev-secret-change-me` OR its length is < 32 bytes, throw at boot. Same for `ORIGIN_VERIFY_SECRET`, `DATABASE_URL`, `AWS_S3_BUCKET`.
- **S4.4 (M5)** Set `app.set('trust proxy', 1)` (single hop = CloudFront) so `req.ip` is the trustworthy client IP. Remove the manual `x-forwarded-for` parse in `auth.ts:37`.
- **S4.5 (L3)** Rotate JWT secret support: sign new tokens with `JWT_SECRET`, verify with `JWT_SECRET` + optional `JWT_SECRET_PREVIOUS`. Rotation becomes a two-deploy operation instead of a session-wipe.
- **S4.6 (L5)** Audit `refresh-credentials.sh` output: ensure no `AccessKeyId`/`SecretAccessKey`/`SessionToken` value is written to `/var/log/credential-refresh.log`. If so, redact.

### Wave S5 — Response headers + XSS defense-in-depth (H2 + L1 + L9)

**Goal**: an XSS payload has no reachable network exit and no way to open new attack tabs.

- **S5.1 (H2)** Re-enable helmet CSP with a policy tuned to the app. Baseline:
  ```
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';   // PrimeVue inlines styles
  img-src 'self' data: https://miempresa-uploads-*.s3.amazonaws.com;
  connect-src 'self' https://miempresa-api-*.disruptiveexp.com https://*.s3.amazonaws.com;
  frame-ancestors 'none';
  form-action 'self';
  object-src 'none';
  base-uri 'self';
  ```
  Roll out in `Content-Security-Policy-Report-Only` for one release, then enforce.
- **S5.2 (H2)** Add Amplify `customHttp.yml` at `frontend/customHttp.yml`:
  ```
  customHeaders:
    - pattern: '**/*'
      headers:
        - key: Strict-Transport-Security
          value: 'max-age=63072000; includeSubDomains; preload'
        - key: X-Content-Type-Options
          value: nosniff
        - key: X-Frame-Options
          value: DENY
        - key: Referrer-Policy
          value: 'strict-origin-when-cross-origin'
        - key: Permissions-Policy
          value: 'geolocation=(), microphone=(), camera=()'
        - key: Content-Security-Policy
          value: <same as S5.1>
  ```
- **S5.3 (L1)** Replace `window.open(url, '_blank')` with `window.open(url, '_blank', 'noopener,noreferrer')` in both call sites. Add a lint rule.
- **S5.4** Nuxt: audit for `v-html` (currently zero — keep it that way; add a repo linter rule to fail on `v-html` unless the string is prefixed with `/* sanitized */`).

### Wave S6 — Dependency + supply-chain (H5)

- **S6.1 (H5)** Backend: `npm audit fix` (compatible), then plan the express 5 or express 4.x-patched upgrade. Add `--audit-level=high` to CI so new highs block merge.
- **S6.2 (H5)** Frontend: upgrade Nuxt to a version that clears the h3/nitro/rollup/simple-git chain. Verify `npm run build` still passes on a branch; run staging smoke before merging.
- **S6.3** Add Dependabot / Renovate (GitHub-side) so security advisories open PRs automatically.
- **S6.4** Enable `npm ci --ignore-scripts` in CodeDeploy `after-install.sh` where feasible (blocks postinstall script RCE from a compromised dep).

### Wave S7 — Logging, monitoring, incident response

- **S7.1 (L2)** Replace Morgan `dev` in prod with a redacted formatter: strip `?key=`, `?password=`, `token`, `Authorization` from log lines. Ship JSON-lines instead of ANSI-colored strings.
- **S7.2** CloudWatch alarms:
  - `LoginAttempt` failures > 20/min → page.
  - `CREDS_EXPIRED` code > 5 in 1h → page (already have the 503 code from I1).
  - `x-origin-verify` mismatch > 10/min → page (someone is scanning the Lightsail port).
- **S7.3** Publish a `context/security-incident-runbook.md`: revoke a session (SQL), rotate `JWT_SECRET`, rotate `ORIGIN_VERIFY_SECRET`, invalidate all bucket signed URLs (delete + rewrite policy), rotate the bootstrap IAM user.
- **S7.4** Backup encryption assertion: verify `pre-releases/*.sql.gz` are AES256 at rest (deploy-worker's spot-check confirms this today; codify it as a policy audit).

### Wave S8 — Optional / lower-priority polish

- **S8.1 (L8)** `errorHandler` in production drops `errors.constraint` on P2002 (returns just "already exists").
- **S8.2 (M7)** Tighten CORS: reject `!origin` requests except on `/api/v1/health` and `/api/v1/webhooks/*` (none exist yet).
- **S8.3** Adopt `helmet-csp` reporting endpoint (`report-to`) and log violations for CSP tuning.
- **S8.4** Prisma soft-delete audit: confirm all "delete" paths go through `estado=INACTIVO` and no hard delete leaks a live constraint (already looks intentional across employees/patients).
- **S8.5** Add `AWS_MAX_ATTEMPTS=3` on the S3 client — reduces credential-expiry churn during retries.

---

## 4. Test / verification plan

For each wave, the acceptance evidence is a set of specs living under `backend/tests/security/` and `frontend/tests/security/`:

- **RBAC matrix** (`rbac-matrix.spec.ts`): for each route × each role, assert allowed/denied. This is the anti-regression backbone.
- **Auth flow** (`login-brute-force.spec.ts`, `session-revoke.spec.ts`): rate-limit + lockout + password change → session invalidation.
- **Uploads** (`uploads-content-type-allowlist.spec.ts`, `uploads-download-idor.spec.ts`): user A cannot download user B's key; MIME allowlist enforced.
- **Headers** (`headers.spec.ts`): assert every `/api/*` and every Amplify path returns the expected security headers.
- **Boot assertions** (`boot-secrets.spec.ts`): mount the app with `JWT_SECRET='dev-secret-change-me'` and NODE_ENV=production → boot fails.
- **Dependency**: CI job `npm audit --audit-level=high` on both packages, no exceptions on `main`.

---

## 5. Rollout sequencing

| Order | Wave | Reason |
|---|---|---|
| 1 | S1 (access control) | Highest-impact production risk; single-tenant staging masks it today. Absorbs C1, C3, C4, H1, H6, H8, M11. |
| 2 | S2 (auth) | Prevents the primary account-takeover primitive (C2 + M1/M2/M6/M8/M9). |
| 3 | S3 (uploads) | Closes the XSS-hosting primitive on the S3 origin (H4). |
| 4 | S4 (secrets/sessions) | Reduces blast radius of an ops-side compromise (M3/M4/M5/M10/H3). |
| 5 | S5 (headers) | Defense-in-depth; no functional risk if rolled out `Report-Only` first (H2). |
| 6 | S6 (deps) | Requires Nuxt upgrade — separate branch, more disruptive (H5). |
| 7 | S1.5 (multi-tenancy) | **P0 GATE before first prod launch with >1 empresa.** May be skippable for a "one tenant forever" prod, but that must be an explicit decision. |
| 8 | S7 (obs) + S8 (polish) | Continuous. |

All waves land through the same staging release runbook pattern used for jul-11 fixes. Each wave gets its own runbook + implementation report.

---

## 6. Out of scope for this plan

- ~~Full multi-tenancy (empresa isolation at the query level).~~ **Moved in-scope as H7 / Wave S1.5** after rev 2 — the current schema has no `empresaId` on `Empleado`/`Cliente`/`Instrumento`, so the "second empresa" case is a data-crossover bug, not a graceful degradation. Must be resolved before prod goes multi-tenant.
- Migration to Postgres RLS. Recommended as a follow-on to S1.5 for defense in depth (Prisma extension provides application-layer isolation; RLS provides DB-layer isolation).
- WAF (AWS WAF in front of CloudFront) — recommend but priced separately.
- Prod IaC (this plan assumes prod stacks will be provisioned; the P0 provider + stopgap block + origin-verify pattern from the resume-summary must be there from day one).
- End-to-end encryption of uploads (client-side envelope encryption) — future work if PHI classification demands it.

---

## 7. Grep hooks

security-audit-jul-12 IDOR-C1 brute-force-C2 instrument-records-open-C3 upload-folder-open-C4 ghost-auth-router-H1 CSP-H2 JWT-secret-fallback-H3 upload-content-type-H4 dep-audit-H5 RBAC-gaps-H6 multi-tenancy-schema-H7 attribution-spoof-H8 bcrypt-cost-M1 password-policy-M2 session-token-hash-M3 absolute-session-cap-M4 trust-proxy-M5 user-enumeration-M6 password-change-M8 CSRF-M9 session-count-cap-M10 esm-footgun-M11 window-open-noopener-L1 morgan-redact-L2 rbac-matrix-spec headers-spec boot-secrets-spec responsable-spoof folder-allowlist prisma-extension-scoped
