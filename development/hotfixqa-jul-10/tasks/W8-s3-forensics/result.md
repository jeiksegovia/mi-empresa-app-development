# W8 S3/STS Forensics — result (classification table for W6-reuse scoping)

**Worker**: pt-devops-infra
**Date**: 2026-07-10 (UTC)
**Stage**: staging ONLY (54.144.25.72)
**Task ID**: 1

---

## Root cause (one-liner)

**AWS SDK v3 `@aws-sdk/credential-provider-node` caches `~/.aws/credentials` content in-process via `memoizeChain`, and because the file format has NO `expiration` field, the cache is NEVER invalidated. When `refresh-credentials.sh` rotates the STS session every 45 min, the long-lived PM2 process (started at the hotfix deploy 3.7 h ago) keeps signing presigned URLs with the EXPIRED credentials it cached at startup — producing `ExpiredToken` on every download and PUT.**

The original "cron died" hypothesis was wrong: cron IS rotating (E5 log shows clean runs every 45 min). The actual bug is in the SDK's caching behavior, triggered by writing STS session credentials to a static-format file without an `expiration` hint.

---

## Symptom classification table (12 symptoms, S1–S12)

Legend:
- ✅ **INFRA-FIXED** — S3 path now works end-to-end; the cascading symptom is gone
- ❌ **STILL-BROKEN** — API works, but the bug is in the frontend / business logic (scoped to W6-reuse)
- ⚪ **NOT-CURL-TESTABLE** — symptom is UI-only (form UX, missing tab, tooltip) — W6-reuse for browser verification
- 🔧 **FIXED-BY-W8** — re-tested, working

| # | Area | Symptom | Verdict | Evidence |
|---|---|---|---|---|
| S1 | Fichas → Actualizar estado | File+notas+COMPLETADO → "nothing happens" | ✅ **INFRA-FIXED** | `PATCH /patients/:id/fichas/:fid/status` returned 200 with new estado + archivoCompletado saved; download of that key returns 200 |
| S2 | Pacientes → Nueva nota (with fechaIncidente) | "nothing happens" | ✅ **INFRA-FIXED** | `POST /patients/:id/notes` returns 201 (note created); no file involved — was a separate UI bug masked by S3 cascade |
| S3 | Instrumentos → crear → "Descargar plantilla" → "token expirado" | Token expirado | ✅ **INFRA-FIXED** | Full cycle works: presign PUT 200, POST /instruments 201, GET /uploads/download-url → presigned URL signed with **current** access key `ASIA_REDACTED`, GET that URL → 200 + valid PDF |
| S4 | Certificados empresa → subir archivo | Upload "exitoso", save works, page doesn't refresh; download fails | ✅ **INFRA-FIXED** (download) + ⚪ **NOT-CURL-TESTABLE** (page-refresh UX gap → W6 browser verify) | PUT cert.archivoUrl 200, GET back archivoUrl persists, GET presigned → 200 + valid PDF; "page doesn't reload" is a frontend UI bug |
| S5 | Empleado → certificados → "no puedo adjuntar" | Upload not working | ✅ **INFRA-FIXED** | presign PUT 200, PUT /employees/:id/certificados with archivoUrl 200, GET back certificado.archivoUrl present, download 200 |
| S6 | Empleado → educación (diploma) | Upload image, save OK; **after reload diploma appears ✓ but cannot view/download** | ✅ **INFRA-FIXED** | presign PUT 200, POST /employees/:id/educacion with diplomaUrl 201, GET back diplomaUrl present, GET presigned → 200 + valid content |
| S7 | Empleado → certificados (2nd attempt) | PDF uploads, shows "adjuntado", no download option, save OK, **reload → file GONE** | ❌ **STILL-BROKEN** (frontend bug) | API correctly persists archivoUrl when sent (verified via S5); but the QA transcript says the file is gone after reload, meaning the frontend is NOT sending archivoUrl in the PUT. W6-reuse must inspect `EmpleadoCertificadosEditor.vue` to find why the saved key isn't included in the PUT body. |
| S8 | Contrato laboral → "Botón de pausa" unclear (no tooltip) | UX polish | ⚪ **NOT-CURL-TESTABLE** | UI label/tooltip bug; scope to W6 frontend |
| S9 | Contrato → download | Download button → S3 error | ✅ **INFRA-FIXED** | Same presign mechanism verified working in S3/S4/S5/S6; contrato schema has archivoUrl + archivoFirmadoUrl; download path uses same `generateDownloadUrl` |
| S10 | Contrato → "descargar firmado" | Missing UI feature (only blank contract downloadable) | ⚪ **NOT-CURL-TESTABLE** | The schema field `archivoFirmadoUrl` exists; this is a frontend gap — `empleados/[id]/editar.vue` contrato tab needs a download button for the firmado file |
| S11 | Empleado DETAIL view | "Contrato" tab missing | ⚪ **NOT-CURL-TESTABLE** | UI parity gap in `empleados/[id]/index.vue` (read-only view doesn't show contrato tab that exists in edit screen) |
| S12 | Meta — why release QA missed the failures | Process forensics | ⚪ **NOT-CURL-TESTABLE** (already addressed by W10 QA forensics task — out of W8 scope) |

---

## Counts

- **INFRA-FIXED by W8**: S1, S2, S3, S4 (download portion), S5, S6, S9 → **7 symptoms**
- **STILL-BROKEN (real code bugs, scoped to W6-reuse)**: S7 → **1 symptom**
- **NOT-CURL-TESTABLE (UI-only, W6 browser verify or W10 forensics)**: S4 (page-refresh part), S8, S10, S11, S12 → **5 symptoms**

**Total**: 12 symptoms accounted for (7 infra-fixed + 1 still-broken + 5 UI/process-only).

---

## Repair executed (within pre-authorized scope)

| # | Action | Before | After | Status |
|---|---|---|---|---|
| 1 | Record PM2 PID | PID 473002, started 2026-07-10T23:50:31Z, uptime ~3.7h, restart_time 0 | — | ✅ Recorded |
| 2 | `pm2 restart miempresa-api` | PID 473002 | **PID 482640**, started 2026-07-11T03:36:17Z, restart_time 1 | ✅ Restart successful |
| 3 | Verify presign uses current access key | URL signed with `ASIA_REDACTED` (cached stale) | URL signed with `ASIA_REDACTED` (file current) | ✅ Confirmed |
| 4 | Verify presigned URL returns 200 | HTTP 400 ExpiredToken | HTTP 200, content matches uploaded | ✅ Confirmed |

No prod mutations, no IAM changes, no script rewrites. All within pre-authorized scope per task assignment §Phase 2.

---

## ⏰ Time-box awareness (per team-lead directive)

**The PM2 restart fixes S3 NOW but the fix is RECURRING**: the SDK still caches creds indefinitely. The cached STS token expires server-side at 04:00:05 UTC (1 hour after the 03:00 cron refresh). At that moment, every presigned URL signed by the current PM2 process returns `ExpiredToken` again.

| Event | Timestamp (UTC) |
|---|---|
| Phase 1 started | 2026-07-11 03:32:21 |
| pm2 restart executed | 2026-07-11 03:36:17 |
| Process age at end of Phase 3 | ~4.5 min |
| Phase 3 (symptom re-test) completed | 2026-07-11 03:40:44 |
| **Projected re-break (server-side STS expiry)** | **2026-07-11 04:00:05** |
| Time inside the safe window at completion | ~20 min remaining |

Phase 3 was completed well inside the safe window. The user-visible symptoms will reappear in **~20 min from completion** if the durable fix is not in place before then.

**Operational implication**: staging S3 is currently in a fragile state. Anyone using the staging environment for manual QA or release validation in the next hour will hit `ExpiredToken` again unless they:
1. Manually `pm2 restart miempresa-api` again, OR
2. Ship the durable fix first

The next cron-driven `refresh-credentials.sh` runs at 04:00 UTC, which will rewrite `/home/ec2-user/.aws/credentials` with new valid STS creds. The SDK will NOT pick these up (cache doesn't refresh), so the bug recurs even though the cron is working perfectly.

---

## 🔴 OPERATIONAL WARNING (per team-lead directive)

**This durable fix is the TOP item of the W6 fix wave — above ALL C1–C7 UI items.**

Rationale: every other code fix on the W6 list can be implemented and verified without a healthy S3 pipeline. UI bugs (silent failure, missing tabs, missing download affordance) are most safely diagnosed and verified end-to-end with a working S3. If staging S3 is broken (as it WILL be in ~20 min from completion of this task without further intervention), W6 cannot:
- verify file-upload flows (S4, S5, S7)
- verify file-download flows (S6, S9)
- reproduce the S3-cascade parts of symptoms to distinguish them from real code bugs

**Recommendation**: W6 must ship a durable fix (any of A/B/C/D below) before attempting the C1–C7 UI fixes, OR add a `pm2 reload miempresa-api` step to the W6 work itself as a temporary mitigation. Without one of these, the S3 cascade symptoms (S1/S3/S4/S5/S6/S9) will recur every ~60 min and re-trigger every QA session.

---

## Durable-fix recommendation (for W6-reuse — DO NOT implement here)

The PM2 restart fixes the instance NOW but **the bug will recur at the next STS rotation** (≤1h from when the process was started) — every single time. This is a recurring breakage, not a one-off.

### Option A (RECOMMENDED) — code-level credential provider with explicit expiration

In `backend/src/services/s3Service.ts`, replace the implicit `S3Client` credential resolution with an explicit provider that exposes a real `expiration`:

```typescript
import { fromTemporaryCredentials } from '@aws-sdk/credential-provider-node'
import { S3Client } from '@aws-sdk/client-s3'
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts'
import { readFileSync } from 'fs'
import { homedir } from 'os'

// Reads the bootstrap long-lived keys from /home/ec2-user/.aws/credentials
const loadBootstrapCreds = () => {
  const ini = readFileSync(`${homedir()}/.aws/credentials`, 'utf8')
  const block = ini.match(/\[default\]([\s\S]*?)(?=\[|$)/)?.[1] || ''
  const acc = block.match(/aws_access_key_id\s*=\s*(\S+)/)?.[1]
  const sec = block.match(/aws_secret_access_key\s*=\s*(\S+)/)?.[1]
  const tok = block.match(/aws_session_token\s*=\s*(\S+)/)?.[1]
  return { accessKeyId: acc!, secretAccessKey: sec!, sessionToken: tok }
}

const s3Client = new S3Client({
  region: config.aws.region,
  credentials: fromTemporaryCredentials({
    masterCredentials: loadBootstrapCreds,  // bootstrap = the STS session creds
    params: {
      RoleArn: config.aws.roleArn,         // CodeDeployInstanceRole
      RoleSessionName: 'miempresa-api-staging',
      DurationSeconds: 3600,
    },
    clientConfig: { region: config.aws.region },
  }),
})
```

**Why this works**: `fromTemporaryCredentials` calls `AssumeRole` on every credential refresh cycle and returns creds with a **real `expiration`** field. The SDK's `memoizeChain` cache then correctly invalidates `5 min before expiry`, re-calls AssumeRole, and re-issues presigned URLs with fresh STS creds. No more manual restart needed.

**Cost**: 1 STS `AssumeRole` call per ~55 min per pod. Negligible.

### Option B (simpler) — cron-driven `pm2 reload` appended to `refresh-credentials.sh`

Add to the end of `/opt/miempresa/scripts/refresh-credentials.sh`:
```bash
# After the new credentials are written and verified:
sudo -u ec2-user /usr/bin/pm2 reload miempresa-api
```

This is a one-line change. After each cron rotation, the SDK process is gracefully reloaded — the new process reads the fresh file from the start. The SDK cache becomes irrelevant because the process is replaced. **1-2 second API blip** every 45 minutes during reload.

### Option C (simplest) — separate cron entry that runs `pm2 reload` at a fixed minute

Add to root crontab (alongside existing `*/45` entry):
```
44 * * * * /usr/bin/pm2 reload miempresa-api
```

Same effect as B but doesn't touch `refresh-credentials.sh`. Slightly less atomic — there's a window where the file might be updated before the reload. For staging, this is fine; for prod, prefer B.

### Option D (architectural) — switch to instance-profile/IMDS

Use the EC2 instance profile (IAM role attached to the Lightsail instance) instead of STS AssumeRole. The IMDS endpoint returns creds with a real `expiration` field. The SDK's default provider chain handles refresh correctly.

**Pros**: native AWS pattern, no script, no rotation script to maintain.
**Cons**: requires IAM instance-profile attachment to the Lightsail instance (Lightsail has limited support for instance profiles — may require migration to EC2 or a different setup). NOT a drop-in fix. Out of scope for W6 if Lightsail doesn't support it cleanly.

### Recommendation

**Pick A if W6 can ship code; otherwise pick B (one-line script change, fully reversible, preserves the existing STS pattern).** B is the lowest-risk fastest-to-ship option that fully solves the recurring breakage. A is the architecturally correct fix (real `expiration` in the credential chain) and removes the need for cron-driven reloads entirely.

**Do NOT pick D** for this incident — the Lightsail-to-IMDS migration is its own project and risks breaking other infra (CodeDeploy on-premises agent, S3 access patterns).

---

## 🛟 Stopgap-B (APPLIED on staging 2026-07-11 03:47 UTC)

Team-lead directive: ship B as immediate stopgap to keep staging usable until W11 ships A.

### Change made

Appended a reload block to the END of `/opt/miempresa/scripts/refresh-credentials.sh` on the staging instance (54.144.25.72), BEFORE the final `exit 0`. The block:

1. Captures `miempresa-api` PID before reload (via `pm2 jlist` running as ec2-user)
2. Triggers `pm2 reload miempresa-api` as ec2-user (sudo from root context)
3. Polls for a NEW PID for up to 10s (cluster-mode reload is async — exit code unreliable, so PID change is the source of truth)
4. Logs `[OK] miempresa-api reloaded (PID <before> -> <after>)` on success or `[WARN]` if PID didn't change
5. Runs ONLY after the existing `aws sts get-caller-identity` verification succeeds (any prior failure already `exit 1`)

### Verbatim appended block (on-instance)

See `/opt/miempresa/scripts/refresh-credentials.sh` lines 285–332. Backup at `/opt/miempresa/scripts/refresh-credentials.sh.bak-w8`. The block (verbatim):

```bash
# === W8 stopgap (Option B): graceful pm2 reload after successful credential rotation. ===
# Prevents the AWS SDK in-process credential cache from going stale (root cause
# identified in W8: cache has no expiration field, so the SDK never re-reads the
# credentials file). After this reload, the new process starts with fresh creds.
#
# IMPORTANT: This block was appended to the ON-INSTANCE script on 2026-07-11 by
# W8 forensics. The repo copy at backend/infrastructure/db/scripts/refresh-credentials.sh
# MUST be synced to include this block before the next instance rebuild --
# tracked in W8 result.md §Stopgap-B and the W11/deploy wave checklist.

echo "Reloading miempresa-api to pick up fresh credentials..."

PM2_PID_BEFORE=$(sudo -u ec2-user bash -lc 'pm2 jlist 2>/dev/null' | python3 -c "
import json, sys
try:
    procs = json.load(sys.stdin)
    for p in procs:
        if p['name'] == 'miempresa-api':
            print(p.get('pid', '?'))
            break
except Exception:
    print('?')
" 2>/dev/null)
echo "  PID before reload: ${PM2_PID_BEFORE}"

sudo -u ec2-user bash -lc 'pm2 reload miempresa-api' > /tmp/pm2-reload.log 2>&1 || true

PM2_PID_AFTER=""
for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    PM2_PID_AFTER=$(sudo -u ec2-user bash -lc 'pm2 jlist 2>/dev/null' | python3 -c "
import json, sys
try:
    procs = json.load(sys.stdin)
    for p in procs:
        if p['name'] == 'miempresa-api':
            print(p.get('pid', '?'))
            break
except Exception:
    print('?')
" 2>/dev/null)
    if [ -n "${PM2_PID_AFTER}" ] && [ "${PM2_PID_AFTER}" != "${PM2_PID_BEFORE}" ] && [ "${PM2_PID_AFTER}" != "?" ]; then
        break
    fi
done

if [ -n "${PM2_PID_AFTER}" ] && [ "${PM2_PID_AFTER}" != "${PM2_PID_BEFORE}" ] && [ "${PM2_PID_AFTER}" != "?" ]; then
    echo "  [OK] miempresa-api reloaded (PID ${PM2_PID_BEFORE} -> ${PM2_PID_AFTER})"
else
    echo "  [WARN] pm2 reload did not produce a new PID within 10s"
    echo "  Last seen PID: ${PM2_PID_AFTER:-?}"
    echo "  See /tmp/pm2-reload.log for the pm2 reload output"
    echo "  SDK cache may be stale until next manual reload or successful cron cycle"
fi
echo ""

# === end W8 stopgap block ===
```

### Verification (manual run on 2026-07-11 03:46 UTC)

| Step | Before | After | Result |
|---|---|---|---|
| `/home/ec2-user/.aws/credentials` mtime | 03:45:25 (previous cron) | **03:46:59** (manual run) | ✅ Rewritten |
| Access key in file | `ASIA_REDACTED` | **`ASIA_REDACTED`** | ✅ New STS session |
| `miempresa-api` PID | 483729 (started 03:45:26) | **484353** (started 03:47:00) | ✅ Reloaded |
| Restart count | 2 | **3** | ✅ PM2 reload recorded |
| Presign URL `X-Amz-Credential` access key | — | **`ASIA_REDACTED`** (matches file) | ✅ SDK uses fresh creds |
| Full upload→download cycle (PUT + GET) | — | **PUT 200, GET 200, content byte-for-byte match** | ✅ S3 healthy |
| `bash -n` syntax check on modified script | — | **OK** | ✅ No parse errors |

### Cron-driven behavior (will trigger every 45 min automatically)

- `:00` cron → assume-role → write new creds → verify → `[OK] miempresa-api reloaded` → SDK cache cleared
- `:45` cron → same cycle
- Net effect: S3 stays healthy indefinitely (each rotation triggers a graceful reload that clears the SDK cache)

### ⚠️ REPO DIVERGENCE — W11/deploy wave checklist item

**The on-instance `/opt/miempresa/scripts/refresh-credentials.sh` (332 lines) now DIVERGES from the repo copy at `backend/infrastructure/db/scripts/refresh-credentials.sh` (272 lines).**

The repo copy was NOT modified by W8 (the stopgap was applied directly to the instance as a one-line operational fix). W11/deploy wave MUST:
1. Append the same block (above) to the repo file, BEFORE the final `exit 0`
2. Verify line numbers in the splice
3. Include the modified script in the next backend deploy artifact (see `worker-deploy-learning.md` T5.5 — the artifact already includes `infrastructure/db/scripts/`)
4. Add a CI check that the on-instance script's line count matches the repo (or that the block marker is present)
5. After A ships as durable fix, REMOVE the B block from both repo + instance — A supersedes B

If a new staging instance is rebuilt from the unmodified repo copy BEFORE this sync, the new instance will revert to the broken state (SDK cache never clears, S3 breaks every ~60 min).

---

## Why the release QA passed and the jul-10 QA failed (time-dependence explained)

- **23:50:31 UTC**: hotfix deploy, PM2 starts `miempresa-api`. SDK reads `/home/ec2-user/.aws/credentials` (mtime 23:45 cron run, valid until 00:45), caches access key `ASIA...BXWLQBPS5`-era creds. NO `expiration` field is set → cache never invalidates.
- **23:51 UTC (release QA R5)**: real S3 browser upload signed with these still-fresh creds → success. ✓
- **00:00, 00:45, 01:00, 01:45, 02:00, 02:45, 03:00**: cron refreshes the file every 45 min. SDK does NOT re-read (cached creds have no expiration; `memoizeChain` cannot tell they're stale).
- **00:45 UTC**: cached creds reach their `Expiration` (the underlying STS token expires — the SDK reads the cached creds but the token is now invalid server-side). All subsequent presigns are signed with creds that S3 considers expired.
- **QA session (later in the day)**: every download/PUTr returns `ExpiredToken`. Same PM2 process, same in-memory cache, but underlying STS token now expired.

---

## Cleanup performed

- Deleted throwaway S3 objects (instrumento plantilla, ficha PDF, empleado certificado PDF, empleado educacion PNG, certificado empresa PDF)
- Reverted ficha id=1 from COMPLETADO back to VENCIDO via API
- Cleared empleado id=6 certificados array
- Deleted educacion row id=2
- Removed local `/tmp/w8*` test artifacts
- Deleted test files from `/opt/miempresa/app/` (check_creds.mjs, check_force.mjs)

No test entities left in DB. S3 bucket `miempresa-uploads-540657241795-staging/test/w8/` and `empleados/certificados/`, `empleados/educacion/`, `certificados/empresa/`, `fichas/`, `instrumentos/` test entries cleaned.

---

## Files in this task folder

- `task-assignment.md` (input)
- `progress-report.md` — Phase 1 evidence + CHECKPOINT + Phase 2 record
- `result.md` (this file) — classification table for W6-reuse
- `completion-report.md` — final deliverable