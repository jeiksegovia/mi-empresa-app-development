# Proposed Plan — sec-devops-1 read-only evidence collection

**Worker**: sec-devops-1 (W1) · **Team**: team-security
**Live target**: STAGING ONLY (`54.144.25.72` / `miempresa-backend-staging`)
**AWS profile**: `disruptive` · **region**: `us-east-1`
**SSH key**: `~/.ssh/miempresa-lightsail-key.pem` (Lightsail default key already downloaded per repo conventions)
**Read-only**: every command below is `describe`/`get`/`list`/`head`/`tail`/`ss`/`ls`/`cat` (no writes, no restarts, no kills). All output is captured to `development/security-audit-backend/evidence/`.

I will **not** run anything until I receive a plain-string `APPROVED:` from `team-lead`.

---

## Conventions
- All AWS CLI: `aws <svc> <cmd> --profile disruptive --region us-east-1`
- All SSH: `timeout 600 ssh -i ~/.ssh/miempresa-lightsail-key.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ec2-user@54.144.25.72 '<remote cmd>'`
- All on-instance reads prefixed with `sudo` where needed for `/root/.aws/`, `/etc/codedeploy-agent/`, `/opt/miempresa/scripts/`, `/var/log/*`.
- Every command is captured verbatim in `tasks/W1-sec-devops-1/progress-report.md` and the raw output saved to `evidence/infra/<step>.txt` or `evidence/logs/<step>.txt`.

---

## Task #1 — Infra + comms evidence (R11-R15)

### Step 1.1 — Sanity / identity (read-only, no side effects)
| # | Command | Proves |
|---|---|---|
| 1.1.a | `aws sts get-caller-identity --profile disruptive --region us-east-1 --output json` | Confirms the `disruptive` profile resolves to account `540657241795` (per prod-release summary §1). |
| 1.1.b | `aws lightsail get-instance --instance-name miempresa-backend-staging --profile disruptive --region us-east-1 --output json` | Instance exists, state `running`, public IP matches `54.144.25.72`. |
| 1.1.c | `aws lightsail get-static-ip --static-ip-name miempresa-ip-staging --profile disruptive --region us-east-1 --output json` | Static IP attached to staging instance. |

### Step 1.2 — R12 Firewall / port state
| # | Command | Proves |
|---|---|---|
| 1.2.a | `aws lightsail get-instance-port-states --instance-name miempresa-backend-staging --profile disruptive --region us-east-1 --output json` | Which TCP/UDP ports the Lightsail firewall exposes publicly (expected: `22`, `3001`). Whether `5432` (Postgres) is exposed (expected: **NO** per `create-instance.sh:262-269`). |

### Step 1.3 — R11 DB exposure (on-instance, read-only)
| # | Command | Proves |
|---|---|---|
| 1.3.a | `sudo ss -tlnp` | Listening sockets + bind address. Specifically whether `*:5432` or `127.0.0.1:5432`. |
| 1.3.b | `sudo systemctl is-active postgresql` + `sudo systemctl is-active pm2-ec2-user` (or `pm2-init`, exact name probed by `systemctl list-units --type=service --no-pager`) | Service running state. |
| 1.3.c | `sudo cat /etc/postgresql/*/main/postgresql.conf 2>/dev/null \| grep -E '^(listen_addresses|port\|unix_socket_directories)'` | Postgres bind config. Expected `listen_addresses = 'localhost'`. |
| 1.3.d | `sudo cat /etc/postgresql/*/main/pg_hba.conf 2>/dev/null \| grep -vE '^#\|^$'` | Auth method + allowed hosts. Expected: `local`/`host` for `127.0.0.1/32` only. |
| 1.3.e | `timeout 5 bash -c 'cat </dev/tcp/127.0.0.1/5432' 2>&1 \| head -c 200; echo'` | Local TCP reachability test (read-only, no auth attempt). |
| 1.3.f | `timeout 5 bash -c 'cat </dev/tcp/0.0.0.0/5432' 2>&1 \| head -c 200; echo` | If 5432 is bound to 0.0.0.0 it would respond locally; complements 1.3.a. |
| 1.3.g | `timeout 5 bash -c 'cat </dev/tcp/<staging-public-ip>/5432' 2>&1 \| head -c 200; echo` (from local laptop, NOT inside SSH) | External reachability probe from a non-Amazon IP (would be refused by Lightsail firewall if 5432 is closed). |

### Step 1.4 — R13 IAM least-privilege
| # | Command | Proves |
|---|---|---|
| 1.4.a | `aws iam get-role --role-name CodeDeployInstanceRole --profile disruptive --region us-east-1 --output json` | `MaxSessionDuration`, `AssumeRolePolicyDocument`. Expected `MaxSessionDuration=3600`. |
| 1.4.b | `aws iam list-attached-role-policies --role-name CodeDeployInstanceRole --profile disruptive --region us-east-1 --output json` | Whether the role is over-permissioned with managed policies. Expected: only inline `CodeDeployInstancePolicy`. |
| 1.4.c | `aws iam list-role-policies --role-name CodeDeployInstanceRole --profile disruptive --region us-east-1 --output json` | Inline policy names. Expected: `CodeDeployInstancePolicy`. |
| 1.4.d | `aws iam get-role-policy --role-name CodeDeployInstanceRole --policy-name CodeDeployInstancePolicy --profile disruptive --region us-east-1 --output json` | Full inline policy document. The **authoritative least-privilege source** — cross-check vs `iam-stack.yml`. |
| 1.4.e | `aws iam get-user --user-name miempresa-bootstrap --profile disruptive --region us-east-1 --output json` | Bootstrap user metadata (creation date, no secrets). |
| 1.4.f | `aws iam list-attached-user-policies --user-name miempresa-bootstrap --profile disruptive --region us-east-1 --output json` | Bootstrap user attached policies. Expected: only `AssumeCodeDeployInstanceRole` inline. |
| 1.4.g | `aws iam list-access-keys --user-name miempresa-bootstrap --profile disruptive --region us-east-1 --output json` | Bootstrap user access-key metadata: how many, when created, when last used. **Long-lived keys are a finding** — checks age. |
| 1.4.h | (via SSH) `sudo cat /opt/miempresa/scripts/refresh-credentials.sh \| head -90` | Verifies the on-instance script's `--duration-seconds`, `--profile bootstrap`, role ARN. Confirms **no privilege escalation** beyond assume-role. |
| 1.4.i | (via SSH) `sudo crontab -l` | Cron schedule for credential refresh. Expected `*/45 * * * * /opt/miempresa/scripts/refresh-credentials.sh`. |
| 1.4.j | (via SSH) `sudo aws sts get-caller-identity --output json` | Confirms the live instance is using an assumed role (`miempresa-backend-staging`) — not a static access key. |
| 1.4.k | (via SSH) `sudo tail -200 /var/log/credential-refresh.log` | Last refresh cycles — proves cadence + no errors (read-only). |

### Step 1.5 — R14 SSM path scope + S3 public access
| # | Command | Proves |
|---|---|---|
| 1.5.a | `aws ssm describe-parameters --profile disruptive --region us-east-1 --parameter-filters "Key=Name,Option=StartsWith,Values=/miempresa/staging/" --output json` | List of `/miempresa/staging/*` SSM parameters. |
| 1.5.b | `aws ssm get-parameters-by-path --path /miempresa/staging/ --recursive --profile disruptive --region us-east-1 --output json` | Names + types (String vs SecureString) — no `--with-decryption` so secrets stay masked. |
| 1.5.c | (per bucket) `aws s3api get-bucket-policy --bucket miempresa-uploads-540657241795-staging --profile disruptive --region us-east-1` | Whether a public/non-existent policy is attached. |
| 1.5.d | (per bucket) `aws s3api get-public-access-block --bucket miempresa-uploads-540657241795-staging --profile disruptive --region us-east-1` | Public-access-block flags (must all be `true` per `s3-stack.yml:112-116`). |
| 1.5.e | (repeat 1.5.c/1.5.d) for `miempresa-artifacts-540657241795-staging` and `miempresa-backups-540657241795-staging` | Same checks for the other two buckets. |
| 1.5.f | (per bucket) `aws s3api get-bucket-cors --bucket miempresa-uploads-540657241795-staging --profile disruptive --region us-east-1` | Verify CORS allows only staging domain + localhost (per `s3-stack.yml:121-126`); no wildcard `*`. |

### Step 1.6 — R15 FE-origin comms / `x-origin-verify`
The CloudFront distribution injects `x-origin-verify` only on requests routed through the public CloudFront URL. Direct hits to the origin (port `3001`) MUST be 403 on protected routes.
| # | Command | Proves |
|---|---|---|
| 1.6.a | `curl -sI https://miempresa-api-stg.disruptiveexp.com/api/v1/health` | Health endpoint via CloudFront → 200 (health is whitelisted). |
| 1.6.b | `curl -sI -H 'x-origin-verify: invalid' https://miempresa-api-stg.disruptiveexp.com/api/v1/auth/login` | A wrong value on a protected route through CloudFront → 403 (server enforces the secret on non-health routes). |
| 1.6.c | `curl -sI http://54.144.25.72:3001/api/v1/health` | Direct origin → expected 403 (origin hardening — only CloudFront holds the secret). |
| 1.6.d | `curl -sI http://54.144.25.72:3001/api/v1/auth/login` | Direct origin on a protected route → expected 403. |
| 1.6.e | `curl -sIv https://miempresa-api-stg.disruptiveexp.com/api/v1/health 2>&1 \| grep -E '^\*\|^\<'` | TLS chain + protocol (expected TLSv1.3 via CloudFront ACM). |
| 1.6.f | (via SSH) `sudo grep -RE 'x-origin-verify\|originVerify\|ORIGIN_VERIFY_SECRET' /opt/miempresa/dist /opt/miempresa/src 2>/dev/null \| head -40` (or wherever the app code is installed — verify path first) | Where the app reads/validates the header. Confirms enforcement exists in code. |

### Step 1.7 — Findings record
After all evidence is captured, write candidate findings in `evidence/findings-task1.md` using the contract in `orchestration-ctx/decisions/00-findings-contract.md`. Each finding cites the exact evidence file + line.

---

## Task #2 — Log intrusion triage (uses same SSH session, NO new connections)

I will reuse the SSH session established in Step 1.3-1.4-1.6 (one persistent SSH connection per step is acceptable; read-only file ops). **All commands are read-only (`cat`, `ls`, `tail`, `zcat`, `head`)** — no truncation, no rotation, no restarts.

### Window declaration
After step 2.1 below I will record the actual `from`/`to` timestamps present in each log file (from first to last entry). For the report I'll state the window explicitly.

### Step 2.1 — Discover what logs exist
| # | Command | Proves |
|---|---|---|
| 2.1.a | `sudo ls -la /var/log/ 2>/dev/null` | Catalog of available log files. |
| 2.1.b | `sudo ls -la /home/ec2-user/.pm2/logs/ 2>/dev/null` | pm2 log files (api out/err). |
| 2.1.c | `sudo ls -la /var/log/nginx/ 2>/dev/null` | nginx access/error logs (may not exist → record as GAP). |
| 2.1.d | `sudo ls -la /var/log/aws/codedeploy-agent/ 2>/dev/null` | CodeDeploy agent logs. |
| 2.1.e | `sudo ls -la /opt/miempresa/logs/ 2>/dev/null` (or wherever the app writes — verify by `sudo find /opt/miempresa -maxdepth 3 -name '*.log' 2>/dev/null`) | Application-level logs. |

### Step 2.2 — pm2 (api stdout/stderr) + nginx + CodeDeploy
| # | Command | Proves |
|---|---|---|
| 2.2.a | `sudo tail -10000 /home/ec2-user/.pm2/logs/miempresa-api-out.log 2>/dev/null` | Last 10k lines of api stdout. Triage: SQLi probes (`' OR 1=1`, `UNION SELECT`), path-traversal (`../etc/passwd`), command-injection (`;`, `\|`, `$()`), RCE patterns, repeated 401/403/500. |
| 2.2.b | `sudo tail -10000 /home/ec2-user/.pm2/logs/miempresa-api-error.log 2>/dev/null` | Last 10k lines of api stderr. Stack traces, secrets leaked in errors, auth-bypass attempts. |
| 2.2.c | `sudo ls /var/log/nginx/*.log 2>/dev/null && sudo tail -5000 /var/log/nginx/access.log 2>/dev/null` | If present: HTTP request patterns, anomalous IPs/paths, scanning. |
| 2.2.d | `sudo tail -2000 /var/log/aws/codedeploy-agent/codedeploy-agent.log 2>/dev/null` | Deploy attempts (RCE vectors?). |
| 2.2.e | `sudo find /var/log -maxdepth 2 -name '*.gz' 2>/dev/null` | Whether rotated logs exist (extend window if so). |

### Step 2.3 — SSH / OS auth + cron
| # | Command | Proves |
|---|---|---|
| 2.3.a | `sudo cat /var/log/secure 2>/dev/null \| tail -3000` (Amazon Linux 2023 stores sshd here) | SSH auth events: brute-force (repeated `Failed password` from same IP), successful logins from unexpected IPs, `Invalid user`. |
| 2.3.b | `sudo cat /var/log/messages 2>/dev/null \| tail -3000` | Kernel + sudo events; failed sudo attempts. |
| 2.3.c | `sudo cat /var/log/cron 2>/dev/null \| tail -500` | Confirms refresh cron fired on schedule; flags any unexpected cron jobs. |
| 2.3.d | `sudo grep -RE 'Invalid user|Failed password|Accepted publickey|Accepted password' /var/log 2>/dev/null \| tail -2000` | Consolidated SSH auth signal across all logs. |
| 2.3.e | `sudo last -F 2>/dev/null \| head -100` | Successful logins (utmp). |
| 2.3.f | `sudo lastb -F 2>/dev/null \| head -100` | Failed login attempts (btmp). |

### Step 2.4 — Triage + findings record
- Compute per-source top-10 suspicious IPs / paths / payloads.
- Document the **exact window** (`first_seen → last_seen`) for every log source.
- Any unreadable/absent log → record as a **GAP** in `evidence/logs/gaps.md`, not a failure.
- Write candidate findings in `evidence/findings-task2.md` using the same contract schema.

---

## Deliverables on completion
- `tasks/W1-sec-devops-1/completion-report.md` — proofs for every acceptance criterion.
- `evidence/infra/*` — verbatim AWS/SSH outputs (R11-R15).
- `evidence/logs/*` — pulled logs + triage notes (window + signals).
- `evidence/index.md` — one line per evidence file.
- `evidence/findings-task1.md`, `evidence/findings-task2.md` — candidate findings (contract format, never `final_severity`).

## Boundaries reiterated
- NO prod probing (`44.195.227.44`, `miempresa-backend-prod`). NO AWS prod resource mutations.
- NO `pkill`, NO `kill`, NO service restarts, NO `prisma migrate`, NO file writes on the instance.
- All output inside `development/security-audit-backend/**`.
- If a command would mutate state I will STOP and ask via `BLOCKED:`.

---

**Awaiting APPROVED before any live command.**
