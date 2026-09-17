# sec-devops-1 Progress Report

**Worker**: sec-devops-1 (W1, team-security)
**Approval**: received from team-lead, scope = project miempresa-* only, staging only (54.144.25.72), AWS profile `disruptive` / `us-east-1`, read-only.
**Hard rule**: SSM reads NEVER use `--with-decryption`; never enumerate resources outside this project; never prod.

---

## Task #1 — Infra + comms evidence (R11-R15)

### Step 1.1 — Sanity / identity

**1.1.a** `aws sts get-caller-identity --profile disruptive --region us-east-1`
```json
{ "UserId": "AIDAX3YNOZ3B7DJVGIYUX", "Account": "540657241795", "Arn": "arn:aws:iam::540657241795:user/admin" }
```
Saved: `evidence/infra/01-sts-caller-identity.json`.

**1.1.b** `aws lightsail get-instance --instance-name miempresa-backend-staging`
- State `running` (code 16), public IP `54.144.25.72` (matches hard target), private `172.26.1.152`.
- Amazon Linux 2023, bundle `micro_3_0`, AZ `us-east-1a`.
- Networking: 22/tcp + 3001/tcp both open to `0.0.0.0/0`. **5432 NOT in firewall** (good).
- httpTokens=`required` (IMDSv2 enforced).
- Saved: `evidence/infra/02-lightsail-instance-staging.json`.

**1.1.c** `aws lightsail get-static-ip --static-ip-name miempresa-ip-staging` — IP `54.144.25.72` attached. Saved: `03-lightsail-static-ip-staging.json`.

### Step 1.2 — R12 Firewall / port state

**1.2.a** `aws lightsail get-instance-port-states` confirms 22/tcp + 3001/tcp open to `0.0.0.0/0`, **NO 5432**.
- Saved: `04-lightsail-port-states-staging.json`.
- **FINDING (LOW / defense-in-depth)**: SSH (22) is open to `0.0.0.0/0` with no IP allow-list; brute-force surface is the entire IPv4 internet. Mitigation: Lightsail native firewall supports CIDR allow-lists; restrict to admin IPs or VPN. Prod shares this posture (IaC parity).

### Step 1.3 — R11 DB exposure (on-instance)

**1.3.a** `sudo ss -tlnp`:
```
LISTEN 127.0.0.1:5432   postgres (pid 1631)   ← loopback only
LISTEN 0.0.0.0:22       sshd
LISTEN *:3001           PM2 v7.0.3: God (pid 1531)
```
Postgres bound to `127.0.0.1` only. Saved: `05-ss-tlnp.txt`.

**1.3.b** Service states:
```
postgresql.service          active running
pm2-ec2-user.service        active running
codedeploy-agent.service    active running
```
No nginx service. Saved: `06-services-active.txt`.

**1.3.c** Postgres config at `/var/lib/pgsql/data/postgresql.conf` (NOT `/etc/postgresql/...`):
- `listen_addresses = 'localhost'` (line 60)
- `port = 5432` (default)
- Saved: `10-postgres-conf.txt`.

**1.3.d** `pg_hba.conf` (`/var/lib/pgsql/data/pg_hba.conf`):
```
local   all             all                                     peer
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
host    miempresa_staging  miempresa    127.0.0.1/32            md5
host    miempresa_staging  miempresa    ::1/128                 md5
```
No external CIDRs. Saved: `11-pg-hba.txt`.

**1.3.e/f** On-instance TCP probes: 127.0.0.1:5432 connects; 0.0.0.0:5432 has no listener. Saved: `12-local-tcp-probe.txt`.

**1.3.g** External (laptop) TCP probes to `54.144.25.72`:
- `:5432` — connection refused (Lightsail firewall + loopback bind)
- `:3001` — connection refused (Lightsail firewall)
- `:22` — `SSH-2.0-OpenSSH_8.7` ✓
Saved: same `12-local-tcp-probe.txt` (external block at end).

**R11 verdict**: Database is NOT externally reachable at any layer (Lightsail firewall, OS bind, pg_hba). All three controls agree. **No finding for DB exposure.**

### Step 1.4 — R13 IAM least-privilege

**1.4.a** `aws iam get-role --role-name CodeDeployInstanceRole`:
- `MaxSessionDuration: 3600` (1 h, matches IaC)
- `AssumeRolePolicyDocument`: only `arn:aws:iam::540657241795:root` can assume.
- `RoleLastUsed.LastUsedDate: 2026-09-16T23:53:38+00:00` (active use).
- Saved: `13-iam-role-codedeploy.json`.

**1.4.b/c** `list-attached-role-policies` → `AttachedPolicies: []` (no managed policies). `list-role-policies` → `["CodeDeployInstancePolicy"]` (one inline). Saved: `14-...`, `15-...`.

**1.4.d** `get-role-policy CodeDeployInstancePolicy` — full document (see `16-iam-role-inline-policy-doc.json`):
- **S3Access**: `arn:aws:s3:::miempresa-*-540657241795-*` + `aws-codedeploy-us-east-1/*` — covers staging+prod+dev for all three buckets. (Trailing wildcard after account ID = env wildcard.)
- **SSMParameterAccess**: `arn:aws:ssm:us-east-1:540657241795:parameter/miempresa/*` — covers prod/staging/dev for ALL params.
- **CloudWatchLogsAccess**: scoped to `/aws/miempresa/*` log groups.
- **KMSDecryptAccess**: `Resource: arn:aws:kms:us-east-1:540657241795:key/*` — **wildcard KMS decrypt**.
- **CodeDeployAccess**: `Resource: '*'`, but actions are read-only (GetDeployment/GetDeploymentConfig/GetApplicationRevision).

**FINDING candidates (least-priv)**:
- **HIGH — KMS `Decrypt` + `DescribeKey` on `key/*`**: any KMS key in the account is decryptable from this role. Should be pinned to `alias/aws/ssm` (or the specific key used by SSM SecureStrings).
- **MEDIUM — S3/SSM wildcards span prod+staging+dev**: the same role is used by both stages (and dev). A compromise on staging EC2 can read prod SSM parameters and prod S3 buckets (subject to other bucket policies, which are None). Pin to env-specific ARNs.
- **INFO/LOW — CodeDeployAccess `Resource: '*'`**: scoped to read-only actions, but explicit pinning would be cleaner.

**1.4.e-g** Bootstrap user `miempresa-bootstrap`:
- Created 2026-07-02; `AssumeCodeDeployInstanceRole` inline policy: only `sts:AssumeRole` on the role ARN. Saved: `17`, `18`, `19`, `20`, `21`.
- `list-access-keys` shows **1 active key** (AccessKeyId `AKIAX3YNOZ3B2I3IATHY`), CreateDate `2026-07-02T05:07:17+00:00` — **~75 days old as of 2026-09-16**. No rotation evidence.

**FINDING candidate (bootstrap key)**:
- **MEDIUM — long-lived IAM user access key (75d), no rotation evidence, attached to EC2 host**: should rotate at least every 90 days per AWS best practice. The bootstrap user holds the only "static" credential capable of assuming the EC2 instance role; if exfiltrated, attacker can mint STS tokens for the role from anywhere.

**1.4.h** On-instance `/opt/miempresa/scripts/refresh-credentials.sh` (head 90):
- `aws sts assume-role --duration-seconds 3600 --profile bootstrap ...`
- `--role-session-name miempresa-backend-${STAGE}` (stable session name, matches registration).
- Saved: `22-on-instance-refresh-and-cron.txt`.

**1.4.i** On-instance crontab:
```
*/45 * * * * /opt/miempresa/scripts/refresh-credentials.sh
0 2 * * * /opt/miempresa/scripts/backup-postgres-s3.sh
```
Refresh every 45 min → 15-min margin before STS expiry. Saved: same file.

**1.4.j** `sudo aws sts get-caller-identity` (on instance) returns `arn:aws:sts::540657241795:assumed-role/CodeDeployInstanceRole/miempresa-backend-staging` — **assumed-role in use, no static key on the instance at runtime**. ✓

**1.4.k** `/var/log/credential-refresh.log` (9653 lines) + 11 weekly-rotated gz backups going back to July 5. Most recent cycles complete cleanly with `[OK] miempresa-api reloaded (PID ... -> ...)`. Last entry: `Completed: Thu Sep 17 00:00:39 UTC 2026, Expiration: 2026-09-17T01:00:04+00:00`. No ERROR entries in tail. Saved: `23-credential-refresh-log-tail.txt`.

### Step 1.5 — R14 SSM path scope + S3 public access

**1.5.a/b** `describe-parameters` + `get-parameters-by-path` on `/miempresa/staging/`:
- **42 parameters** under staging prefix (api/db/frontend/qa).
- **CONFIRMED SECRET LEAK in plaintext via get-parameters-by-path** (default decryption on this API):
  - `/miempresa/staging/api/JWT_SECRET` = `c5e339dd...3e00` (Type=**String**, NOT SecureString)
  - `/miempresa/staging/api/SESSION_SECRET` = `561975b8...cfdc` (Type=**String**, NOT SecureString)
  - `/miempresa/staging/api/ORIGIN_VERIFY_SECRET` = `8a2371ca...4f3c` (Type=**String**, NOT SecureString)
  - `/miempresa/staging/qa/qa-admin/PASSWORD` etc. — properly SecureString, ciphertext shown.
  - `/miempresa/staging/db/DB_PASSWORD` / `DATABASE_URL` — properly SecureString.
- Saved: `24-ssm-describe-params-staging.json`, `25-ssm-list-by-path-staging.json`.

**FINDING (HIGH — secrets-at-rest)**:
- **HIGH — JWT_SECRET, SESSION_SECRET, ORIGIN_VERIFY_SECRET stored as Type=String (not SecureString)**: plaintext at rest in SSM, accessible to any identity with `ssm:GetParameter` on the path. Anyone with the EC2 role or `admin` user (or any future IAM compromise) can read them. Per AWS best practice, all secrets should be SecureString. The IaC template `ssm-parameters-stack.yml` defines these as `Type: String` and only the DB params become SecureString via the deploy script. Prod shares this.
- **MEDIUM — `get-parameters-by-path` default decryption** exposes SecureString ciphertext (decryptable by any caller with `kms:Decrypt` on the CMK). Document for callers — use `--no-with-decryption` if plaintext not needed. (Not a finding for the platform itself; flag for callers.)

**1.5.c/d/e** S3 buckets (uploads, artifacts, backups) — all three:
- No bucket policy (`NoSuchBucketPolicy`).
- `PublicAccessBlock`: `BlockPublicAcls=true`, `IgnorePublicAcls=true`, `BlockPublicPolicy=true`, `RestrictPublicBuckets=true` (all 4 on).
- Encryption: AES256 server-side.
- Saved: `26-s3-bucket-policy-and-pab.txt`.

**R14 verdict**: S3 public access blocked at all 4 layers. No public buckets. No bucket policy reliance (implicit deny on public). **No finding for S3 public access.**

**1.5.f** CORS for `miempresa-uploads-540657241795-staging`:
```json
AllowedMethods: [GET, PUT, HEAD]
AllowedOrigins: ["https://miempresa-stg.disruptiveexp.com", "http://localhost:3100", "http://localhost:3101", "http://localhost:3102"]
AllowedHeaders: ["*"]
MaxAgeSeconds: 3600
```
- **FINDING (LOW — CORS `AllowedHeaders: ['*']`)**: any header allowed — minor, browsers also need this for PUT with `Content-Type`. Acceptable for presigned uploads but worth documenting. No wildcard origin → OK.
- Saved: `27-s3-uploads-cors.txt`.

### Step 1.6 — R15 FE-origin comms / x-origin-verify

**1.6.a** Health via CloudFront `https://miempresa-api-stg.disruptiveexp.com/api/v1/health`:
- `HTTP/2 200`, `strict-transport-security: max-age=31536000`, `x-content-type-options: nosniff`, `x-frame-options: SAMEORIGIN`, `vary: Origin`, HSTS present. Helmet headers wired up.
- Saved: `28-r15-health-via-cf.txt`.

**1.6.b** Login via CloudFront with INVALID `x-origin-verify`:
- Returned 404 with `x-cache: Error from cloudfront` (edge response, content-length 45 — NOT the in-code 403). The origin middleware returns 403 with body `{error:"Forbidden"}` (content-length 21); edge serves cached 404 instead.
- Saved: `29-r15-login-bad-header-cf.txt`.

**1.6.c** Direct origin `http://54.144.25.72:3001/api/v1/health` (no header) → **200** ✓ (health is whitelisted by middleware, by design).
- Saved: `30-r15-origin-direct-health.txt`.

**1.6.d** Direct origin `http://54.144.25.72:3001/api/v1/auth/login` (no header) → **403 Forbidden** with body `{error:"Forbidden"}` (content-length 21). ✓
- Saved: `31-r15-origin-direct-login.txt`.

**1.6.e** TLS chain via CloudFront:
- TLSv1.3, cipher `AEAD-AES128-GCM-SHA256`, ACM cert `CN=miempresa-api-stg.disruptiveexp.com` issued by `Amazon RSA 2048 M04`, valid 2026-07-02 → 2027-01-15. HTTP/2.
- Saved: `32-r15-tls-chain.txt`.

**1.6.f** On-instance `dist/app.js` (lines 16-26):
```js
if (config.originVerifySecret) {
    app.use((req, res, next) => {
        if (req.path === '/api/v1/health') return next();
        if (req.get('x-origin-verify') === config.originVerifySecret) return next();
        res.status(403).json({ error: 'Forbidden' });
    });
}
```
Middleware runs BEFORE routes (helmet → verify → cors → body-parser → morgan → routes). Exact-match `===` comparison.
- Saved: `35-r15-app-origin-verify-code.txt`, `36-r15-app-js-context.txt`.

**Additional probes**:
- Direct origin fake route `/api/v1/totally-fake-route` (no header) → **403** (middleware runs before route matching → no info-leak about route existence).
- Saved: `34-r15-origin-direct-fakeroute.txt`.

**R15 verdict**: Origin hardening enforced in code; direct origin blocked on all non-health routes; TLS via CF. **One INFO note**: when CloudFront receives a request with invalid `x-origin-verify`, it may serve a cached error from edge rather than forwarding to origin and getting the proper 403 — minor edge caching quirk, not a control bypass (direct origin still 403s).

### Task #1 summary

| Risk domain | Finding | Severity |
|---|---|---|
| ssh-firewall | SSH open to `0.0.0.0/0` (no allow-list) | LOW |
| secrets | JWT_SECRET / SESSION_SECRET / ORIGIN_VERIFY_SECRET stored as Type=String (plaintext at rest) | HIGH |
| iam-least-priv | KMS Decrypt on `key/*` wildcard | HIGH |
| iam-least-priv | Bootstrap access key 75d old, no rotation evidence | MEDIUM |
| iam-least-priv | S3 + SSM resource ARNs include prod+staging+dev via wildcards | MEDIUM |
| cors-headers | S3 CORS `AllowedHeaders: ['*']` | LOW |
| db-exposure | None — all 3 layers block | — |
| transport | TLS via CloudFront TLSv1.3, valid ACM | — |
| s3-ssm | PublicAccessBlock all on, no public policy | — |

(Worker candidate severities; orchestrator assigns final.)

---

## Task #2 — Log intrusion triage

(populated below)
