# Decision: infra + integrated verdicts (Wave 2, part 2 — final)

Orchestrator adjudication of sec-devops-1 findings F-01..F-12 + resolution of the PENDING-W1 static
items (S1-S9). This is the `final_severity` source of truth for the report. Spot-checks verified
directly against evidence files by the orchestrator.

**Secret-handling note**: `evidence/infra/25-ssm-list-by-path-staging.json` contains three staging
secrets in cleartext because `JWT_SECRET` / `SESSION_SECRET` / `ORIGIN_VERIFY_SECRET` are stored as
SSM `Type: String` (that IS finding F-02). DB/QA creds are SecureString and stayed ciphertext (no
`--with-decryption` was used — rule honored). The evidence dir is now gitignored. The report MUST
reference secrets by name only, never value.

## Orchestrator spot-checks (CONFIRMED against evidence)

- F-03 KMS `key/*` wildcard — CONFIRMED `evidence/infra/16-iam-role-inline-policy-doc.json:52-61`.
- F-05 cross-env wildcards — CONFIRMED same file: S3 `miempresa-{uploads,artifacts,backups}-540657241795-*` (`*` matches `-prod`) lines 14-19; SSM `parameter/miempresa/*` (matches `/miempresa/prod/*`) line 33.
- F-02 String-typed secrets — CONFIRMED `evidence/infra/25:49-73` (JWT_SECRET, ORIGIN_VERIFY_SECRET, SESSION_SECRET all `"Type": "String"`).
- S9 NODE_ENV — RESOLVED: `evidence/infra/25:130-136` `NODE_ENV = production` on staging.
- New: `DEV_USERS_ENABLED = true` on staging (`evidence/infra/25:274-280`); `LOG_LEVEL = debug` (line 112-118).

## HEADLINE — cross-environment escalation chain (CH-1, HIGH)

The staging instance role `CodeDeployInstanceRole` grants S3/SSM/KMS on cross-environment wildcards,
AND the staging host is internet-exposed (SSH 22 + origin 3001 open to `0.0.0.0/0`, active scanners
+ SSH brute-force observed). A staging-host compromise therefore reaches PROD data:
`ssm:GetParametersByPath /miempresa/prod/*` (prod DB creds, prod JWT_SECRET) + `s3:GetObject
miempresa-uploads-...-prod/*` (prod PII: cédulas, hojas de vida, contratos, certificados) +
`kms:Decrypt key/*` (decrypt prod SecureString). If prod stores JWT_SECRET as String (parity
likely), an attacker forges prod ADMIN JWTs. **This breaks staging↔prod isolation and is the most
important finding.** final_severity: **HIGH** (treat as CRITICAL until prod IAM/secret parity is
confirmed and scoped).

Remediation: scope the role's ARNs to `-staging` / `/miempresa/staging/*`; scope KMS to the specific
aws/ssm key ARN; give staging and prod distinct roles with no cross-env reach.

## Final verdicts

| id | title | final_severity | verify | note / remediation |
|---|---|---|---|---|
| CH-1 | Cross-env escalation chain (F-05+F-01/F-07+F-02/F-03) | HIGH (→CRITICAL if prod parity unscoped) | CONFIRMED | Scope IAM per-env; isolate roles. |
| F-05 | IAM S3+SSM ARNs span prod/staging/dev via `*` | HIGH | CONFIRMED | Restrict to `-staging` + `/miempresa/staging/*`. |
| F-02 | JWT/SESSION/ORIGIN_VERIFY secrets as SSM String (plaintext at rest) | HIGH | CONFIRMED | Convert to SecureString + rotate all 3 (staging AND prod). |
| F-03 | KMS Decrypt/DescribeKey on `key/*` | HIGH | CONFIRMED | Scope to the specific KMS key ARN used for SSM. |
| F-01 | SSH (22) open to 0.0.0.0/0, no IP allow-list | MEDIUM (was LOW) | CONFIRMED | User explicitly wanted an SSH allow-list. Restrict 22 to admin IP(s) or use SSM Session Manager. Entry point of CH-1. |
| S2 | `/uploads/download-url?key=` presigns ANY key (broken object-level authz) | MEDIUM | CONFIRMED | Enforce ownership/prefix check before presign; scope role GetObject. |
| S4 | `MAX_FILE_SIZE_MB` never enforced; presign has no ContentLengthRange | MEDIUM | CONFIRMED | Add `ContentLengthRange` to the presign policy. |
| F-04 | Bootstrap IAM access key 75d, no rotation | MEDIUM | CONFIRMED | Rotate; add rotation policy; consider removing (instance already uses assumed role). |
| F-09 | Active external scanner probing for secrets/config files | MEDIUM | CONFIRMED | Confirms internet exposure is probed; couples with F-01/F-07. WAF / rate-limit / restrict origin. |
| S3 | `folder`/`filename` unvalidated in presign key | MEDIUM | CONFIRMED | Whitelist folder; server-controls prefix. |
| S11 | npm audit 0 crit / 8 high transitive | MEDIUM | CONFIRMED | `audit fix` on a branch; regression-test S3 presign path. |
| F-07 | Direct origin :3001 open to 0.0.0.0/0 | LOW | CONFIRMED | Mitigated by x-origin-verify 403; still restrict to CloudFront ranges. |
| F-06 | S3 uploads CORS `AllowedHeaders: ['*']` | LOW | CONFIRMED | Narrow to needed headers. |
| F-10 | SSH brute-force noise (no compromise) | LOW | CONFIRMED | Resolved by F-01 fix / fail2ban. |
| F-11 | Access logs do not capture client source IP | LOW | CONFIRMED | Log `X-Forwarded-For` from CloudFront for incident response. |
| S1 | JWT_SECRET code fallback `'dev-secret-change-me'` | LOW | CONFIRMED | Staging env IS set (strong). Latent: remove `||` fallback, crash-on-missing. |
| S5 | x-origin-verify `===` not timingSafeEqual | LOW | CONFIRMED | Defense-in-depth. |
| S6 | innerHTML fed by 403 detail (access-denied.client.ts:25) | LOW (latent HIGH) | CONFIRMED | Use textContent; HIGH if a 403 ever echoes user input. |
| S8 | errorHandler leaks P2002 `meta.target` | LOW | CONFIRMED | Omit constraint from client response. |
| S7 | No CSP (backend helmet off + no FE CSP; Amplify headers not probed) | LOW | PLAUSIBLE | Add CSP via Amplify headers / nuxt.config meta. GAP: Amplify response headers not collected. |
| NEW-1 | `DEV_USERS_ENABLED=true` on staging | INFO (MEDIUM if true on prod) | CONFIRMED | Verify prod = false; dev/QA users on prod = auth backdoor. |
| F-08 | S3 CORS includes localhost (dev/staging) | INFO | CONFIRMED | Confirm prod CORS override excludes localhost. |
| F-12 | Stale `ERR_MODULE_NOT_FOUND` in pm2 log | INFO | CONFIRMED | Housekeeping. |
| S9 | errorHandler err.message leak | INFO (resolved) | CONFIRMED | staging NODE_ENV=production → generic message. |
| S10 | AUDITOR/OPERADOR skip requireDomain matrix | INFO | CONFIRMED | Product decision. |
| NEW-2 | `LOG_LEVEL=debug` on staging | INFO | CONFIRMED | Minor; set info/warn for prod. |

## Controls verified CLEAN (state in report)

DB not externally exposed (firewall + `listen_addresses=localhost` + loopback pg_hba); S3 public
access fully blocked (PAB x4 + no bucket policy + AES256); IMDSv2 required; STS temp creds on
instance (no static key on host, 45-min refresh); TLSv1.3 via CloudFront ACM; x-origin-verify
enforced before route matching (403 even on non-existent routes); no RBAC bypass in EMPLEADO matrix;
token storage clean (httpOnly cookie + in-memory Pinia); no `v-html`/`eval`/`new Function`.

## Prod-parity actions (staging == prod copy)

Every HIGH/MEDIUM fix validated on staging then ported to prod. Prod-specific verifications required:
prod IAM role scoping, prod secret types (SecureString?), prod `DEV_USERS_ENABLED=false`, prod CORS
override, prod NODE_ENV=production. These need a prod read-only pass in a later cycle (out of scope now).

## Counts

HIGH: 4 (CH-1, F-05, F-02, F-03) · MEDIUM: 7 (F-01, S2, S4, F-04, F-09, S3, S11) ·
LOW: 8 (F-07, F-06, F-10, F-11, S1, S5, S6, S8) + S7 (PLAUSIBLE) · INFO: 6.
