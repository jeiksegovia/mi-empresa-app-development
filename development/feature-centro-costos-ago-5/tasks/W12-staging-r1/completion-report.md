# W12-staging-r1 · Completion Report

- Worker: `worker-12` (pt-devops-infra) — replacing stuck W11 for **R1 only**
- Phase: R1 (pre-release backup of staging DB)
- Runbook: `context/implementation-plan/staging-release-centro-costos-aug17-runbook.md` §R1
- Date (UTC): 2026-08-19
- Status: **R1 complete — awaiting PROCEED PHASE R4 from team-lead**

---

## Resource summary (staging only)

| resource | value |
| --- | --- |
| target host | `ec2-user@54.144.25.72` (Lightsail, stage=`staging`) |
| source DB | `miempresa_staging` @ `localhost:5432` |
| local backup | `/opt/miempresa/backups/pre-centro-costos-aug17.sql.gz` |
| S3 URI | `s3://miempresa-backups-540657241795-staging/pre-releases/pre-centro-costos-aug17.sql.gz` |
| bytes | **40943** |
| sha256 | `f28a061c1e25865f21a507cf1ea2c920bfc5aa6446af44a282e49af58586d5dd` |
| ETag (md5) | `e2ae26fb56960f341c06e5fd5a77d141` |
| SSE | `AES256` |
| account | `540657241795`, region `us-east-1`, profile `disruptive` |

> Hard limits respected: no `miempresa-prod` access; no CodeDeploy; no `migrate deploy`; no `pm2 restart`; no CloudFormation; no SSM put; no `prisma migrate diff --shadow-database-url`.

---

## Acceptance criteria — evidence

### 1. SSH to staging instance works

```bash
$ ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -i ~/.ssh/miempresa-lightsail-key.pem ec2-user@54.144.25.72 "echo SSH_OK && whoami && hostname && date -u"
SSH_OK
ec2-user
ip-172-26-1-152.ec2.internal
Wed Aug 19 12:46:13 UTC 2026
```

### 2. `pg_dump` of `miempresa_staging` (gzip) — local verification

```bash
$ ssh -i ~/.ssh/miempresa-lightsail-key.pem ec2-user@54.144.25.72 'set -euo pipefail
  echo "=== [R1] BACKUP START $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  DB_PASSWORD=$(aws ssm get-parameter --name "/miempresa/staging/db/DB_PASSWORD" --with-decryption --query "Parameter.Value" --output text --region us-east-1)
  echo "  SSM DB_PASSWORD retrieved (length=${#DB_PASSWORD})"
  export PGPASSWORD="$DB_PASSWORD"
  BACKUP_PATH="/opt/miempresa/backups/pre-centro-costos-aug17.sql.gz"
  pg_dump -h localhost -p 5432 -U miempresa -d miempresa_staging --no-owner --no-acl --format=plain | gzip > "$BACKUP_PATH"
  unset PGPASSWORD
  SIZE=$(stat -c%s "$BACKUP_PATH")
  SHA=$(sha256sum "$BACKUP_PATH" | awk "{print \$1}")
  echo "BACKUP_PATH=$BACKUP_PATH"
  echo "BYTES=$SIZE"
  echo "SHA256=$SHA"
  echo "=== [R1] BACKUP LOCAL OK ==="'
```

Output (verbatim):

```
=== [R1] BACKUP START 2026-08-19T12:46:46Z ===
  SSM DB_PASSWORD retrieved (length=32)
BACKUP_PATH=/opt/miempresa/backups/pre-centro-costos-aug17.sql.gz
BYTES=40943
SHA256=f28a061c1e25865f21a507cf1ea2c920bfc5aa6446af44a282e49af58586d5dd
=== [R1] BACKUP LOCAL OK ===
```

### 3. S3 upload — instance IAM

```bash
$ ssh -i ~/.ssh/miempresa-lightsail-key.pem ec2-user@54.144.25.72 'set -euo pipefail
  echo "=== [R1] S3 UPLOAD $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  BACKUP_PATH="/opt/miempresa/backups/pre-centro-costos-aug17.sql.gz"
  S3_URI="s3://miempresa-backups-540657241795-staging/pre-releases/pre-centro-costos-aug17.sql.gz"
  aws s3 cp "$BACKUP_PATH" "$S3_URI" --region us-east-1 --sse AES256 --metadata "stage=staging,database=miempresa_staging,release=pre-centro-costos-aug17,timestamp=$(date -u +%Y%m%dT%H%M%SZ)"'
```

Output (verbatim):

```
=== [R1] S3 UPLOAD 2026-08-19T12:46:51Z ===
Completed 40.0 KiB/40.0 KiB (439.9 KiB/s) with 1 file(s) remaining
upload: ../../opt/miempresa/backups/pre-centro-costos-aug17.sql.gz to s3://miempresa-backups-540657241795-staging/pre-releases/pre-centro-costos-aug17.sql.gz
=== [R1] UPLOAD OK ===
```

### 4. Two-path sha256 verification

**Path A — instance local `sha256sum`:**

```
f28a061c1e25865f21a507cf1ea2c920bfc5aa6446af44a282e49af58586d5dd  /opt/miempresa/backups/pre-centro-costos-aug17.sql.gz
```

**Path B — laptop `AWS_PROFILE=disruptive aws s3 cp` + `shasum -a 256`:**

```bash
$ AWS_PROFILE=disruptive aws s3 cp s3://miempresa-backups-540657241795-staging/pre-releases/pre-centro-costos-aug17.sql.gz /tmp/pre-centro-costos-aug17.s3.sql.gz --region us-east-1
Completed 40.0 KiB/40.0 KiB (91.8 KiB/s) with 1 file(s) remaining
download: s3://miempresa-backups-540657241795-staging/pre-releases/pre-centro-costos-aug17.sql.gz to ../../tmp/pre-centro-costos-aug17.s3.sql.gz

$ ls -la /tmp/pre-centro-costos-aug17.s3.sql.gz
-rw-r--r--  1 jeik  wheel  40943 Aug 19 07:46 /tmp/pre-centro-costos-aug17.s3.sql.gz

$ shasum -a 256 /tmp/pre-centro-costos-aug17.s3.sql.gz
f28a061c1e25865f21a507cf1ea2c920bfc5aa6446af44a282e49af58586d5dd  /tmp/pre-centro-costos-aug17.s3.sql.gz
```

**Result: A == B == `f28a061c1e25865f21a507cf1ea2c920bfc5aa6446af44a282e49af58586d5dd` ✓**

### 5. `aws s3api head-object` (size + metadata) — both paths

**Path C1 — instance IAM:**

```bash
$ ssh -i ~/.ssh/miempresa-lightsail-key.pem ec2-user@54.144.25.72 \
    'aws s3api head-object --bucket miempresa-backups-540657241795-staging --key pre-releases/pre-centro-costos-aug17.sql.gz --region us-east-1'
```
```
{
    "AcceptRanges": "bytes",
    "LastModified": "2026-08-19T12:46:53+00:00",
    "ContentLength": 40943,
    "ETag": "\"e2ae26fb56960f341c06e5fd5a77d141\"",
    "ContentType": "binary/octet-stream",
    "ServerSideEncryption": "AES256",
    "Metadata": {
        "release": "pre-centro-costos-aug17",
        "database": "miempresa_staging",
        "stage": "staging",
        "timestamp": "20260819T124651Z"
    }
}
```

**Path C2 — laptop `--profile disruptive`:**

```bash
$ AWS_PROFILE=disruptive aws s3api head-object --bucket miempresa-backups-540657241795-staging --key pre-releases/pre-centro-costos-aug17.sql.gz --region us-east-1
```
```
{
    "AcceptRanges": "bytes",
    "LastModified": "2026-08-19T12:46:53+00:00",
    "ContentLength": 40943,
    "ETag": "\"e2ae26fb56960f341c06e5fd5a77d141\"",
    "ContentType": "binary/octet-stream",
    "ServerSideEncryption": "AES256",
    "Metadata": {
        "release": "pre-centro-costos-aug17",
        "database": "miempresa_staging",
        "stage": "staging",
        "timestamp": "20260819T124651Z"
    }
}
```

**C1 == C2 == ContentLength 40943, ETag `e2ae26fb56960f341c06e5fd5a77d141`, SSE AES256 ✓**

---

## Restore one-liner (write-only, do not run)

Captured into runbook §R1 (`context/implementation-plan/staging-release-centro-costos-aug17-runbook.md`) before R4:

```bash
ssh -i ~/.ssh/miempresa-lightsail-key.pem ec2-user@54.144.25.72 '
  set -euo pipefail
  pm2 stop miempresa-api
  aws s3 cp s3://miempresa-backups-540657241795-staging/pre-releases/pre-centro-costos-aug17.sql.gz /tmp/restore.sql.gz --region us-east-1
  DB_PASSWORD=$(aws ssm get-parameter --name "/miempresa/staging/db/DB_PASSWORD" --with-decryption --query Parameter.Value --output text --region us-east-1)
  gunzip -c /tmp/restore.sql.gz | PGPASSWORD="$DB_PASSWORD" psql -h localhost -p 5432 -U miempresa -d miempresa_staging -v ON_ERROR_STOP=1
  pm2 start miempresa-api
  rm -f /tmp/restore.sql.gz
'
```

---

## Hard limits — verified

- [x] never targeted `miempresa-prod`
- [x] never invoked CodeDeploy
- [x] never invoked `migrate deploy`
- [x] never invoked `pm2 restart`
- [x] never invoked CloudFormation
- [x] never `ssm put-parameter`
- [x] never `prisma migrate diff --shadow-database-url`
- [x] never used blanket `pkill`

## Acceptance criteria — status

| criterion | status | evidence |
| --- | --- | --- |
| local dump exists | ✓ | section 2 |
| uploaded to required S3 key | ✓ | section 3 |
| size match (local == S3) | ✓ | 40943 == 40943 (sections 2, 5) |
| sha256 match (instance == S3-download) | ✓ | section 4 (both `f28a061c…d5dd`) |
| `aws s3api head-object` from laptop `--profile disruptive` | ✓ | section 5 (path C2) |
| restore one-liner written to runbook §R1 | ✓ | runbook updated before R4 |

---

## Next step

Awaiting `PROCEED PHASE R4` from team-lead. **Worker-12 will not start R4 autonomously.**