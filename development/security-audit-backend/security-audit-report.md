# Security Audit Report — mi-empresa backend (Cycle 2026-09)

> Cycle: `security-audit-backend` · Staging read-only (2026-09-16) · Report finalized by
> orchestrator (`team-lead`) Wave-2 verdicts + W3 consolidation.
> **Scope**: backend app (`backend/src/**`), frontend SPA (`frontend/app/**`), Lightsail
> staging host, AWS account `540657241795` profile `disruptive` region `us-east-1`,
> CloudFront/S3/SSM/IAM/KMS for the `miempresa` project.
> **Out of scope this cycle**: prod probing (no `miempresa-backend-prod` reads).
> **Method**: static read of source (W2), live read-only staging evidence + 77-day log
> window (W1), orchestrator adjudication (Wave-2 decisions).

## 1. Executive summary

**Posture**: Staging↔prod isolation is broken. The staging instance role can read PROD
secrets and PROD S3 objects via cross-environment wildcard ARNs. A staging-host compromise
therefore reaches PROD data. This is the headline risk (CH-1, HIGH — escalate to CRITICAL
until prod IAM/secret parity is confirmed and scoped). Independently, three other IAM/secrets
issues compound it (F-02, F-03, F-05 — all HIGH). Multiple MEDIUM findings (S2/S3/S4) point
to weak presign-key validation in the upload path. Multiple LOW findings are defense-in-depth
hardening opportunities. Application-layer code (RBAC, token storage, XSS surface) is clean.

**Counts by final_severity**: 4 HIGH · 7 MEDIUM · 8 LOW (+1 LOW PLAUSIBLE) · 6 INFO.

### Top 3 risks (one line each)
1. **CH-1** — staging-host compromise reaches prod data: `CodeDeployInstanceRole` S3/SSM/KMS
   wildcards span prod, and the staging host is internet-exposed (22 + :3001 open to
   `0.0.0.0/0`, active scanner + SSH brute-force).
2. **F-02** — `JWT_SECRET` / `SESSION_SECRET` / `ORIGIN_VERIFY_SECRET` are stored as SSM
   `Type: String` (plaintext at rest). Combined with F-05, anyone who reads those params
   (any code/identity on the staging role) can forge prod JWTs.
3. **S2** — `GET /uploads/download-url?key=...` presigns an S3 download for ANY key. Any
   authenticated user (any role) can fetch arbitrary upload prefixes. PII risk (cédulas,
   hojas de vida, contratos, certificados).

## 2. Scope + method

| Layer | Method | Evidence location |
|---|---|---|
| Backend code (13 route groups + middleware + services) | Static read | `evidence/code-map/01..10-*.md` |
| Frontend SPA (Vue 3 / Nuxt 4 / PrimeVue) | Static read | `evidence/code-map/10-frontend-xss-token-csp.md` |
| Deps (npm audit) | `npm audit --omit=dev` (read-only) | `evidence/code-map/09-npm-audit.md` |
| Lightsail instance + firewall | AWS CLI describe + Lightsail API | `evidence/infra/01..06-*.json\|txt` |
| Postgres exposure | SSH `ss / cat pg_hba.conf / cat postgresql.conf` | `evidence/infra/05,09..12-*.txt` |
| S3 buckets + PAB + SSE + CORS | `s3api get-bucket-*` | `evidence/infra/26..27-*.txt` |
| IAM role + bootstrap user | `iam get-role / get-user / list-access-keys` | `evidence/infra/13..21-*.json` |
| STS refresh + cron | on-instance `crontab + cat refresh-credentials.sh` | `evidence/infra/22..23-*.txt` |
| SSM parameters (42) | `ssm get-parameters-by-path /miempresa/staging/` (no `--with-decryption`) | `evidence/infra/24..25-*.json` |
| CloudFront / TLS / x-origin-verify | `curl -sI` from local + direct origin | `evidence/infra/28..36-*.txt` |
| Logs (77-day window: 2026-07-01 → 2026-09-16) | `journalctl`, `cat`, `grep`, `utmpdump` | `evidence/logs/01..11-*.txt` |

**Not collected** (and why): prod IAM role / prod SSM / prod `*.disruptiveexp.com`
response headers (out-of-scope this round; staging == prod copy means the same fixes port,
but a prod read-only pass is recommended in a later cycle).

## 3. Findings (ranked by final_severity, contract format)

> Schema: `id, domain, final_severity, location, summary, exploit_scenario, evidence, verify_status, remediation, prod_parity`.
> `final_severity` and `verify_status` are orchestrator-assigned (`02-infra-integrated-verdicts.md`).

### HIGH

#### CH-1 — Cross-env escalation chain (F-05 + F-01/F-07 + F-02/F-03)
- **id**: CH-1
- **domain**: iam-least-priv (composite)
- **final_severity**: HIGH (→CRITICAL if prod IAM/secret parity is unscoped)
- **location**: `evidence/infra/16-iam-role-inline-policy-doc.json:14-19,33,52-61` + `evidence/infra/04-lightsail-port-states-staging.json` + `evidence/logs/04-pm2-suspicious-burst-analysis.txt`
- **summary**: The staging instance role `CodeDeployInstanceRole` grants S3, SSM, and KMS on
  cross-environment wildcards (`miempresa-{uploads,artifacts,backups}-540657241795-*` matches
  `-prod`; `parameter/miempresa/*` matches `/miempresa/prod/*`; `key/*` matches all KMS keys).
  Combined with the staging host being internet-exposed (SSH 22 + origin :3001 open to
  `0.0.0.0/0`, active scanner + SSH brute-force observed), a staging-host compromise reaches
  prod data (DB creds, JWT secret, PII uploads) and can decrypt SSM SecureStrings.
- **exploit_scenario**: Attacker probes `54.144.25.72` (currently ongoing — see F-09), lands
  a shell via SSH brute-force or web RCE on :3001 (mitigated only by x-origin-verify). With
  the assumed role, calls `ssm:GetParametersByPath /miempresa/prod/*` → reads prod JWT_SECRET,
  `s3:GetObject miempresa-uploads-...-prod/*` → exfils prod PII, `kms:Decrypt key/*` →
  decrypts prod SecureStrings (DB password). Forges ADMIN JWTs if prod also stores
  JWT_SECRET as `String`.
- **evidence**: `evidence/infra/04,16,25,26`, `evidence/logs/04,05`
- **verify_status**: CONFIRMED (orchestrator-verified inline of policy doc)
- **remediation**: Scope role ARNs to `-staging` / `/miempresa/staging/*`; scope KMS to the
  specific SSM key ARN; give staging and prod distinct roles with no cross-env reach. Add a
  deny `s3:GetObject miempresa-...-prod/*` and `ssm:GetParametersByPath /miempresa/prod/*`
  in a boundary SCP if multi-env isolation must be guaranteed even if role policy slips.
- **prod_parity**: yes (staging == prod copy per locked decision). Apply the same scoping to
  prod. The prod instance role MUST NOT reach `/miempresa/staging/*` either.

#### F-05 — IAM S3 + SSM ARNs span prod/staging/dev via `*`
- **id**: F-05
- **domain**: iam-least-priv
- **final_severity**: HIGH
- **location**: `evidence/infra/16-iam-role-inline-policy-doc.json:14-19` (S3), `:33` (SSM)
- **summary**: The instance role's S3 + SSM resource ARNs use `*` wildcards that match
  prod, staging, and dev buckets/parameters.
- **exploit_scenario**: See CH-1.
- **evidence**: `evidence/infra/16`
- **verify_status**: CONFIRMED
- **remediation**: Replace `miempresa-{uploads,artifacts,backups}-540657241795-*` with
  `miempresa-{uploads,artifacts,backups}-540657241795-staging`. Replace
  `parameter/miempresa/*` with `arn:aws:ssm:us-east-1:540657241795:parameter/miempresa/staging/*`.
- **prod_parity**: yes — same scoping must apply to the prod instance role.

#### F-02 — `JWT_SECRET` / `SESSION_SECRET` / `ORIGIN_VERIFY_SECRET` stored as SSM `String` (plaintext at rest)
- **id**: F-02
- **domain**: secrets
- **final_severity**: HIGH
- **location**: `evidence/infra/25-ssm-list-by-path-staging.json:49-73` (parameter names + `Type: "String"`)
- **summary**: Three security-critical secrets are stored as SSM `Type: String`, which means
  they are returned as plaintext on any `GetParameter` / `GetParameters` call and are NOT
  wrapped by KMS at the SSM level. Anyone with `ssm:GetParameter` on the path can read them.
- **exploit_scenario**: An attacker with the instance role (already implied by F-05) calls
  `ssm:GetParameter /miempresa/staging/JWT_SECRET` and forges JWTs for any user — including
  ADMIN. If prod parity holds (`String` instead of `SecureString`), the same attacker forges
  prod ADMIN JWTs.
- **evidence**: `evidence/infra/25`
- **verify_status**: CONFIRMED
- **remediation**: Convert all three to `Type: SecureString` with the same KMS key. Rotate the
  values after the type change. Verify both staging AND prod are `SecureString`.
- **prod_parity**: yes — same conversion must apply to prod.

#### F-03 — KMS `Decrypt` / `DescribeKey` allowed on `key/*`
- **id**: F-03
- **domain**: iam-least-priv
- **final_severity**: HIGH
- **location**: `evidence/infra/16-iam-role-inline-policy-doc.json:52-61`
- **summary**: The instance role can decrypt ANY KMS key in the account, not just the SSM
  KMS key used for SecureString wrapping.
- **exploit_scenario**: An attacker uses the role to decrypt prod SecureStrings even if F-05
  is fixed (they still need to call SSM but the broad KMS scope means they can decrypt
  anything encrypted under any key in the account, including future keys added for other
  workloads).
- **evidence**: `evidence/infra/16`
- **verify_status**: CONFIRMED
- **remediation**: Scope KMS to the specific SSM alias ARN (e.g.
  `arn:aws:kms:us-east-1:540657241795:key/<specific-key-id>`). Add a `kms:ViaService`
  condition for `ssm.us-east-1.amazonaws.com` if available.
- **prod_parity**: yes — same scoping must apply to the prod role.

### MEDIUM

#### F-01 — SSH (22) open to `0.0.0.0/0`, no IP allow-list
- **id**: F-01
- **domain**: ssh-firewall
- **final_severity**: MEDIUM (worker LOW; orchestrator upgraded per user request)
- **location**: `evidence/infra/04-lightsail-port-states-staging.json` (port 22 + 3001 open to `0.0.0.0/0`)
- **summary**: Lightsail firewall allows SSH from any source IP.
- **exploit_scenario**: Combined with active SSH brute-force (`evidence/logs/05`) — 31,244
  kex errors since July, 2,586 btmp records, top attacker IP `120.203.161.200` ×127 — a
  successful guess lands a shell with the role's credentials. Entry point of CH-1.
- **evidence**: `evidence/infra/04`, `evidence/logs/05`, `evidence/logs/07`
- **verify_status**: CONFIRMED
- **remediation**: Restrict 22 to admin IP(s) (or Tailscale/VPN CIDR); switch to SSM Session
  Manager (which does not need port 22 at all). Add `fail2ban` if SSH stays open.
- **prod_parity**: yes — apply the same restriction to prod.

#### S2 — `GET /uploads/download-url?key=...` presigns ANY key
- **id**: S2
- **domain**: file-upload
- **final_severity**: MEDIUM
- **location**: `backend/src/routes/uploads.routes.ts:64-86` (key = `req.query.key as string`, no Zod, no prefix check, passed to `generateDownloadUrl(key)`)
- **summary**: Any authenticated user can presign an S3 download URL for any key. Bucket
  prefix is not enforced server-side.
- **exploit_scenario**: Authenticated user (any role) calls
  `GET /api/v1/uploads/download-url?key=uploads/<other-tenant>/cedula-XYZ.pdf` and receives a
  signed URL that downloads the file. With S3 keys being `<folder>/<uuid>.<ext>`, guessing is
  hard, but if any key prefix is enumerable (timestamps, user-id based, predictable), an
  attacker can enumerate and exfil.
- **evidence**: `evidence/code-map/04-injection-inventory.md`, `evidence/code-map/02-authn-gaps.md`
- **verify_status**: CONFIRMED (orchestrator spot-checked `uploads.routes.ts:64-86`)
- **remediation**: (a) Enforce a prefix allowlist in the route (e.g. only allow
  `uploads/<callerUserId-or-callerEmpresaId>/...`); (b) scope the role's `s3:GetObject` to
  the same prefix; (c) log every signed-URL key + userId for audit.
- **prod_parity**: yes — same code path.

#### S4 — `MAX_FILE_SIZE_MB` env never enforced; presign has no `ContentLengthRange`
- **id**: S4
- **domain**: file-upload
- **final_severity**: MEDIUM
- **location**: `backend/src/config/env.ts:36-39` (env var), `backend/src/services/s3Service.ts:171-187` (presign call without `Conditions: [['content-length-range', 0, maxBytes]]`)
- **summary**: `MAX_FILE_SIZE_MB` exists in env (default 100) but is NOT referenced anywhere
  in code (grep returned zero matches). The presigned PUT URL has no `ContentLengthRange`
  condition, so a client can PUT arbitrary-sized bytes to S3.
- **exploit_scenario**: Attacker uses the presigned URL to PUT a multi-GB file, running up
  S3 storage costs and possibly exhausting the bucket.
- **evidence**: `evidence/code-map/04-injection-inventory.md` (grep `MAX_FILE_SIZE`)
- **verify_status**: CONFIRMED
- **remediation**: Pass `Conditions: [['content-length-range', 0, config.upload.maxFileSizeBytes]]`
  to `getSignedUrl`. Confirm the bucket itself enforces a max-object-size quota.
- **prod_parity**: yes — same code path.

#### F-04 — Bootstrap IAM access key 75 days old, no rotation evidence
- **id**: F-04
- **domain**: iam-least-priv
- **final_severity**: MEDIUM
- **location**: `evidence/infra/20-iam-bootstrap-access-keys.json` (key created 2026-07-02, 1 active)
- **summary**: The `miempresa-bootstrap` IAM user holds a static access key that has not been
  rotated since creation (75 days).
- **exploit_scenario**: Long-lived static keys are a frequent compromise vector. If the
  bootstrap user is needed at all (the instance already uses assumed role + STS refresh
  per `evidence/infra/22`), the static key may be unused or redundant — and any compromise
  has no automatic expiry.
- **evidence**: `evidence/infra/17..21`, `evidence/infra/22`
- **verify_status**: CONFIRMED
- **remediation**: Rotate the access key; add an IAM policy with a key-rotation cadence
  alert (e.g. > 90d → Slack). Consider removing the user entirely once confirmed unused
  (the instance already uses the assumed role).
- **prod_parity**: yes — same user is shared across envs.

#### F-09 — Active external scanner probing staging API
- **id**: F-09
- **domain**: logs-intrusion
- **final_severity**: MEDIUM
- **location**: `evidence/logs/04-pm2-suspicious-burst-analysis.txt` (top 250 paths on 2026-09-06), `evidence/logs/10-pm2-status-codes.txt` (404 ×4200, 200 ×2541, 304 ×1719, 401 ×182, 403 ×154)
- **summary**: Sustained reconnaissance from external IPs probing `/`, `/admin`, `/.env`,
  `/wp-admin`, `/phpmyadmin`, etc. Status distribution shows mostly 404s but 403s and 401s
  confirm the attacker is hitting protected paths too.
- **exploit_scenario**: Scanner is currently failing (no 5xx, mostly 404), but the volume of
  probes confirms the host is internet-visible and the attacker is looking for any foothold.
  Pairs with F-01/F-07 (exposed SSH and :3001).
- **evidence**: `evidence/logs/04,07,10`
- **verify_status**: CONFIRMED
- **remediation**: Add a WAF (CloudFront or Lightsail) with a managed rule set blocking
  common scanners. Rate-limit by source IP. Restrict :3001 to CloudFront origins (F-07).
- **prod_parity**: yes — same exposure pattern expected.

#### S3 — `presignedUrlSchema` does not validate `folder`/`filename`
- **id**: S3
- **domain**: file-upload
- **final_severity**: MEDIUM
- **location**: `backend/src/routes/uploads.routes.ts:8-12` (Zod schema: `folder: z.string().optional()`, `filename: z.string().optional()`); key composition at `:45` (`${folder || 'uploads'}/${crypto.randomUUID()}.${ext}`)
- **summary**: `folder` accepts arbitrary strings. Although the final key has a UUID suffix,
  the prefix is fully user-controlled.
- **exploit_scenario**: Attacker passes `folder=../config` (or any other prefix) and stores
  an object under that prefix. Combined with S2 (download-url accepts any key), the data is
  retrievable. Bucket policy is the only gate.
- **evidence**: `evidence/code-map/04-injection-inventory.md`, `evidence/code-map/05-input-validation.md`
- **verify_status**: CONFIRMED (orchestrator spot-checked `:8-12,45`)
- **remediation**: Whitelist `folder` to a small set (e.g. `uploads`, `cargos`, `empleados`,
  `contratos`, `certificados`, `pacientes`); drop `filename` if unused.
- **prod_parity**: yes.

#### S11 — `npm audit`: 8 high-severity transitive vulnerabilities
- **id**: S11
- **domain**: deps
- **final_severity**: MEDIUM
- **location**: `evidence/code-map/09-npm-audit.md` (12 = 0 critical / 8 high / 3 moderate / 1 low)
- **summary**: 8 high transitive advisories. Most relevant: `path-to-regexp` ReDoS (Express 4
  chain), `defu` prototype pollution, `fast-xml-parser`/`@aws-sdk/xml-builder` (S3 chain),
  `deepmerge-ts`/`effect` (Prisma chain).
- **exploit_scenario**: Crafted HTTP paths can trigger ReDoS in Express routing. Defu prototype
  pollution could affect request processing.
- **evidence**: `evidence/code-map/09-npm-audit.md`
- **verify_status**: CONFIRMED
- **remediation**: `npm audit fix` (safe non-breaking) on a branch; `npm audit fix --force`
  for the prisma@6.12.0 upgrade (semver-major). Regression-test the S3 presign path (because
  `@aws-sdk/xml-builder` is in the hit list).
- **prod_parity**: yes.

### LOW

#### F-07 — Direct origin `:3001` open to `0.0.0.0/0`
- **id**: F-07
- **domain**: ssh-firewall
- **final_severity**: LOW
- **location**: `evidence/infra/04-lightsail-port-states-staging.json` (3001 open)
- **summary**: Lightsail firewall exposes :3001 to the world. Mitigated by x-origin-verify
  403, but defense-in-depth prefers a narrower source range.
- **exploit_scenario**: Attacker bypasses CloudFront and hits the origin directly. x-origin-verify
  catches them with 403, but adds an attack surface and increases coupling to a shared secret.
- **evidence**: `evidence/infra/04`, `evidence/infra/31..34-*.txt`
- **verify_status**: CONFIRMED (x-origin-verify 403 verified at `evidence/infra/31,34`)
- **remediation**: Restrict :3001 to CloudFront prefix-list ranges (or use a private
  origin with VPC origin in CloudFront).
- **prod_parity**: yes.

#### F-06 — S3 uploads CORS `AllowedHeaders: ['*']`
- **id**: F-06
- **domain**: cors-headers
- **final_severity**: LOW
- **location**: `evidence/infra/27-s3-uploads-cors.txt`
- **summary**: CORS allows ANY header from the listed origins.
- **exploit_scenario**: Wider header allowance than necessary; a future bug that emits a
  custom header from a malicious origin could be exploited.
- **evidence**: `evidence/infra/27`
- **verify_status**: CONFIRMED
- **remediation**: Narrow to needed headers (e.g. `['Content-Type', 'x-amz-*']`).
- **prod_parity**: yes.

#### F-10 — SSH brute-force noise (no compromise)
- **id**: F-10
- **domain**: ssh-firewall
- **final_severity**: LOW
- **location**: `evidence/logs/05-ssh-auth-journald-and-btmp.txt`
- **summary**: Constant SSH brute-force noise; only the dev IP succeeds (per
  `evidence/logs/05` analysis). No compromise.
- **exploit_scenario**: None observed.
- **evidence**: `evidence/logs/05,07`
- **verify_status**: CONFIRMED
- **remediation**: Resolved by F-01 fix (allow-list) or `fail2ban`.
- **prod_parity**: yes.

#### F-11 — Access logs do not capture client source IP
- **id**: F-11
- **domain**: logs-intrusion
- **final_severity**: LOW
- **location**: `backend/src/app.ts:49` (`morgan('dev', ...)` — does not include
  `req.ip` or `X-Forwarded-For`); `evidence/logs/01-log-inventory.txt`
- **summary**: PM2 access logs do not capture the client IP, only the connection peer (which
  is CloudFront for valid traffic).
- **exploit_scenario**: Incident response cannot trace attacker IPs from logs.
- **evidence**: `evidence/logs/01,03,10`
- **verify_status**: CONFIRMED
- **remediation**: Add a morgan token (`'req[X-Forwarded-For]'` or `req.ip` with
  `app.set('trust proxy', 'cloudfront')`) and a structured logger entry per request.
- **prod_parity**: yes.

#### S1 — `JWT_SECRET` code fallback `'dev-secret-change-me'`
- **id**: S1
- **domain**: secrets
- **final_severity**: LOW
- **location**: `backend/src/config/env.ts:16` (`secret: process.env.JWT_SECRET || 'dev-secret-change-me'`)
- **summary**: If `JWT_SECRET` env is unset, the JWT signing key defaults to an attacker-known
  string. **Resolved for staging**: `evidence/infra/25` confirms a strong `JWT_SECRET` is set.
  **Latent**: the fallback should be removed so a future deploy cannot accidentally lose it.
- **exploit_scenario**: A future deploy that omits `JWT_SECRET` forges JWTs.
- **evidence**: `evidence/code-map/06-secrets-env.md`, `evidence/infra/25`
- **verify_status**: CONFIRMED
- **remediation**: Remove the `||` fallback. Crash on startup if `JWT_SECRET` is unset.
- **prod_parity**: yes.

#### S5 — x-origin-verify uses `===` not `timingSafeEqual`
- **id**: S5
- **domain**: cors-headers
- **final_severity**: LOW
- **location**: `backend/src/app.ts:24`
- **summary**: String equality on the secret header is theoretically timing-attackable.
  Practical risk is low (long secret, CloudFront-only path).
- **exploit_scenario**: Theoretical timing side-channel.
- **evidence**: `evidence/code-map/07-cors-headers.md`
- **verify_status**: CONFIRMED
- **remediation**: Use `crypto.timingSafeEqual` with a length pre-check.
- **prod_parity**: yes.

#### S6 — `host.innerHTML = ...${detail}...` in `access-denied.client.ts:25`
- **id**: S6
- **domain**: xss
- **final_severity**: LOW (latent HIGH)
- **location**: `frontend/app/plugins/access-denied.client.ts:25`
- **summary**: A 403 message string is rendered via `innerHTML`. Today the only string
  flowing in is the hardcoded `'Acceso no permitido para su perfil'` from
  `backend/src/middleware/domainAccess.ts:206`. If a future change ever echoes user input
  in a 403 message, this becomes exploitable.
- **exploit_scenario**: Latent — see summary.
- **evidence**: `evidence/code-map/10-frontend-xss-token-csp.md`
- **verify_status**: CONFIRMED
- **remediation**: Render via `textContent` instead of `innerHTML`. Use PrimeVue `useToast`
  only (the innerHTML is a fallback for pages without a `<Toast />`).
- **prod_parity**: yes.

#### S8 — `errorHandler` leaks Prisma `meta.target` on P2002
- **id**: S8
- **domain**: error-leak
- **final_severity**: LOW
- **location**: `backend/src/middleware/errorHandler.ts:13-15` (`errors: { constraint: prismaError.meta?.target }`)
- **summary**: Response body echoes the unique-constraint column name. Leaks schema info.
- **exploit_scenario**: Repeated probing maps the DB schema.
- **evidence**: `evidence/code-map/08-error-leak.md`
- **verify_status**: CONFIRMED
- **remediation**: Omit `errors.constraint` from the response (still log server-side).
- **prod_parity**: yes.

#### S7 — No CSP (backend helmet CSP disabled + no SPA CSP meta)
- **id**: S7
- **domain**: xss
- **final_severity**: LOW (PLAUSIBLE — Amplify response headers not probed)
- **location**: `backend/src/app.ts:16` (`helmet({ contentSecurityPolicy: false })`),
  `frontend/nuxt.config.ts:62-68` (no CSP meta)
- **summary**: Neither the backend nor the SPA shell sets a CSP. Amplify response headers
  not collected in this cycle.
- **exploit_scenario**: If a future XSS sink (e.g. S6 if it degrades) is reached, CSP would
  have been a defense-in-depth layer.
- **evidence**: `evidence/code-map/07-cors-headers.md`, `evidence/code-map/10-frontend-xss-token-csp.md`
- **verify_status**: PLAUSIBLE (gap: Amplify response headers not collected)
- **remediation**: Add CSP via Amplify response headers OR `<meta http-equiv="Content-Security-Policy">`
  in `nuxt.config.ts`. Re-test with `evidence/infra/28..30` style curl.
- **prod_parity**: yes.

### INFO

#### NEW-1 — `DEV_USERS_ENABLED=true` on staging
- **id**: NEW-1
- **domain**: authz
- **final_severity**: INFO (MEDIUM if true on prod)
- **location**: `evidence/infra/25-ssm-list-by-path-staging.json:274-280`
- **summary**: SSM parameter `DEV_USERS_ENABLED=true` is set on staging. If this is also
  `true` on prod, dev/QA users are active in production — an auth backdoor.
- **evidence**: `evidence/infra/25`
- **verify_status**: CONFIRMED on staging; PROD parity unknown.
- **remediation**: Verify prod = `false`. If true, change to `false` and rotate any dev user
  credentials.
- **prod_parity**: MUST verify — out of scope this round.

#### F-08 — S3 CORS includes localhost (intentional dev/staging)
- **id**: F-08
- **domain**: cors-headers
- **final_severity**: INFO
- **location**: `evidence/infra/27-s3-uploads-cors.txt`
- **summary**: Bucket CORS lists `localhost:3100/3101/3102`. Intentional for dev/staging.
  Must NOT appear in prod CORS.
- **evidence**: `evidence/infra/27`
- **verify_status**: CONFIRMED (dev/staging only)
- **remediation**: Verify prod CORS override excludes localhost (already the convention per
  `.env.example:35-46`).
- **prod_parity**: MUST verify.

#### F-12 — Stale `ERR_MODULE_NOT_FOUND` in pm2 log
- **id**: F-12
- **domain**: logs-intrusion
- **final_severity**: INFO
- **location**: `evidence/logs/02-pm2-error-and-head-tail.txt`
- **summary**: A single `ERR_MODULE_NOT_FOUND` (Prisma client) from initial deploy remains
  in the pm2 error log. No recent occurrences.
- **evidence**: `evidence/logs/02`
- **verify_status**: CONFIRMED
- **remediation**: Clear pm2 logs (`pm2 flush`) or rotate log files. Housekeeping.
- **prod_parity**: yes.

#### S9 — `errorHandler` leaks `err.message` in non-prod
- **id**: S9
- **domain**: error-leak
- **final_severity**: INFO (resolved)
- **location**: `backend/src/middleware/errorHandler.ts:49`
- **summary**: The handler returns raw `err.message` unless `NODE_ENV==='production'`.
  Staging `NODE_ENV` IS set to `production` (`evidence/infra/25:130-136`), so the leak is
  masked in staging. No action needed unless a future deploy changes staging NODE_ENV.
- **evidence**: `evidence/code-map/08-error-leak.md`, `evidence/infra/25`
- **verify_status**: CONFIRMED (staging NODE_ENV=production)
- **remediation**: None currently. Keep NODE_ENV=production enforced.
- **prod_parity**: yes.

#### S10 — `requireDomain` falls through for AUDITOR/OPERADOR
- **id**: S10
- **domain**: authz
- **final_severity**: INFO
- **location**: `backend/src/middleware/domainAccess.ts:160-163`
- **summary**: Non-EMPLEADO roles (AUDITOR/OPERADOR) skip the matrix entirely. This is a
  product decision, not a defect.
- **evidence**: `evidence/code-map/03-authz-rbac-matrix.md`
- **verify_status**: CONFIRMED
- **remediation**: None — product decision. If product wants AUDITOR/OPERADOR matrix-gated,
  extend the middleware.
- **prod_parity**: yes.

#### NEW-2 — `LOG_LEVEL=debug` on staging
- **id**: NEW-2
- **domain**: logs-intrusion
- **final_severity**: INFO
- **location**: `evidence/infra/25-ssm-list-by-path-staging.json:112-118`
- **summary**: Staging logs at debug level. Increases log volume and may surface internal
  state in shared log viewers.
- **evidence**: `evidence/infra/25`
- **verify_status**: CONFIRMED
- **remediation**: Set `info`/`warn` for prod. Staging debug is OK.
- **prod_parity**: MUST verify prod LOG_LEVEL.

## 4. Remediation roadmap (next fix cycle)

> Staging == prod copy per locked decision; every HIGH/MEDIUM fix is validated on staging,
> then ported to prod. Items marked **VERIFY-PROD** require a prod read-only pass before
> applying.

### Quick wins (≤ 1 day each, single-file changes)

| Finding | Action | File |
|---|---|---|
| S8 | Omit `errors.constraint` from P2002 response body | `backend/src/middleware/errorHandler.ts:14` |
| S6 | Replace `host.innerHTML` with `host.textContent` in fallback toast | `frontend/app/plugins/access-denied.client.ts:25` |
| S5 | Use `crypto.timingSafeEqual` with length pre-check | `backend/src/app.ts:24` |
| S1 | Remove `\|\| 'dev-secret-change-me'` fallback; crash on missing | `backend/src/config/env.ts:16` |
| F-12 | `pm2 flush` to clear historical noise | runtime |
| F-06 | Narrow S3 CORS `AllowedHeaders` | IaC `s3-stack.yml` |
| NEW-2 | Lower prod `LOG_LEVEL` to `info` | SSM param |
| F-11 | Add `req.ip` / `X-Forwarded-For` to morgan + structured logger | `backend/src/app.ts:49` |
| S7 | Add `<meta http-equiv="Content-Security-Policy">` to nuxt.config.ts (or Amplify headers) | `frontend/nuxt.config.ts` |

### Same-cycle fixes (1–3 days each, may need IaC or coordination)

| Finding | Action | Surface |
|---|---|---|
| S2 | Enforce server-side key prefix allowlist in `/uploads/download-url` | `backend/src/routes/uploads.routes.ts:64-86` |
| S3 | Whitelist `folder` in `presignedUrlSchema` | `backend/src/routes/uploads.routes.ts:8-12` |
| S4 | Add `Conditions: [['content-length-range', 0, maxBytes]]` to presign | `backend/src/services/s3Service.ts:171-187` |
| S11 | `npm audit fix` (non-breaking) + regression-test S3 presign | `backend/package.json` |
| F-04 | Rotate `miempresa-bootstrap` access key + add rotation alert | IAM console / SSM |
| F-01 | Restrict SSH to admin IP(s) OR switch to SSM Session Manager | Lightsail firewall + ASG/instance config |
| F-07 | Restrict :3001 to CloudFront prefix-list (private origin) | Lightsail firewall + CloudFront origin config |

### Larger work (sprint-level, requires planning)

| Finding | Action | Surface |
|---|---|---|
| CH-1 / F-05 / F-03 | Full IAM role re-architecture: per-env roles, scoped ARNs, KMS scope | IaC for both staging and prod instance roles |
| F-02 | Convert 3 secrets to `Type: SecureString`, rotate all three | SSM + env.sh + redeploy (downtime-window) |
| F-09 | WAF (CloudFront or Lightsail) with managed scanner rules + rate-limit | IaC |

### Must-verify before prod

| Finding | Verification |
|---|---|
| NEW-1 | prod `DEV_USERS_ENABLED` = false |
| F-08 | prod CORS override excludes `localhost` |
| F-02 | prod `JWT_SECRET` / `SESSION_SECRET` / `ORIGIN_VERIFY_SECRET` are `SecureString` |
| F-03 | prod role's KMS scope is specific (not `key/*`) |
| F-05 | prod role ARNs are scoped to `-prod` / `/miempresa/prod/*` |
| S7 | Amplify prod response includes CSP (or accept the LOW risk + add meta) |
| S9 | prod `NODE_ENV=production` enforced |
| NEW-2 | prod `LOG_LEVEL` is `info`/`warn` |

## 5. Evidence gaps / not-validated

- **Prod probing was out of scope** this round. The "VERIFY-PROD" items above must be
  answered in a later cycle.
- **Amplify response headers** were not collected (S7 marked PLAUSIBLE).
- **DB secureString rotation** for F-02 requires downtime; staged behind CH-1.
- **x-origin-verify secret value** is in SSM as String (F-02). It is NOT in `evidence/infra/25`
  body verbatim (the listing file lists `Type` only), but the SSM GetParameter output does
  include the value when called with `--with-decryption=false` (which is the default). Per
  the lock-decision and the orchestrator note in `02-infra-integrated-verdicts.md`, the
  report references secrets by NAME only.

## 6. Controls verified CLEAN (no finding)

- DB not externally exposed (Lightsail firewall + `listen_addresses=localhost` + loopback `pg_hba`).
- S3 public access fully blocked (PAB x4 + no bucket policy + AES256 SSE on all 3 staging buckets).
- IMDSv2 enforced (`httpTokens: required`).
- STS temporary credentials on the instance (no static key on host, 45-min refresh cron).
- TLSv1.3 via CloudFront ACM cert (valid 2026-07-02 → 2027-01-15).
- x-origin-verify enforced BEFORE route matching (direct origin → 403 even on non-existent
  routes per `evidence/infra/31,34`).
- No exploitable RBAC bypass in the EMPLEADO matrix (`DOMAIN_ACCESS` in
  `backend/src/middleware/domainAccess.ts`).
- Token storage clean (httpOnly cookie + in-memory Pinia; no `localStorage` token, no `v-html`
  / `eval` / `new Function` in `frontend/app/`).

## 7. Grep hook

```
security-audit-backend-2026-09 CH-1 HIGH F-02 F-03 F-05 S2 S3 S4 F-01 F-04 F-09 S11
```

## 8. Cross-references

- `evidence/index.md` — one-line-per-file evidence index.
- `evidence/code-map/delicate-shortlist.md` — worker-side shortlist (S1–S11).
- `evidence/code-map/09-npm-audit.md` — verbatim `npm audit` counts.
- `evidence/findings/findings-task1.md` — worker candidate findings (R11–R15).
- `evidence/findings/findings-task2.md` — worker candidate findings (R16 log triage).
- `orchestration-ctx/decisions/00-findings-contract.md` — finding schema.
- `orchestration-ctx/decisions/01-static-verdicts-prelim.md` — Wave-2 part 1 (static).
- `orchestration-ctx/decisions/02-infra-integrated-verdicts.md` — Wave-2 part 2 (final).
- `tasks/W1-sec-devops-1/completion-report.md` — W1 (infra + logs).
- `tasks/W2-sec-code-1/completion-report.md` — W2 (static code).
- `tasks/W3-sec-consolidate/completion-report.md` — W3 (this report).