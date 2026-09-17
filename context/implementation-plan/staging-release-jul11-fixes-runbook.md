# Staging Release Runbook — July 12, 2026 (jul-11 QA fixes)

**Reference**: [staging-release-jul10-runbook.md](staging-release-jul10-runbook.md) (pattern) + `development/fixes-jul-8/tasks/W10-staging-release-jul9/worker-deploy-learning.md` (trap list)
**Account**: 540657241795 · Profile `disruptive` · Region `us-east-1` (always explicit)
**Targets**: `miempresa-backend-staging` @ 54.144.25.72 · Amplify app `d1nsxjyualdzdu` · CodeDeploy `miempresa-app`/`miempresa-staging`
**NOT in scope**: anything `prod`.
**Execution model**: lead session ran read-only gates (R0); `deploy-worker` (pt-devops-infra) executed R2–R4 long commands; lead ran R5 QA.

## Release scope — delta since `d-HH2LFJIIK` (I1-I3 presign hardening, jul-11)

| Area | Change |
|---|---|
| **DB** | **ZERO new migrations** (staging stays at 20/20). R1 (IaC) skipped — no infra delta. |
| **Backend** | QA jul-11 fixes: `dateYMD` Zod preprocess in patients.routes (accepts ISO-timestamp dates from DatePicker — fixes silent 400 on fichas single-step + notas); `addCertificateUpdate` now propagates `comprobantePagoUrl` to parent snapshot; `getPatient` returns `archivoCompletado` per registro; instruments `rolesPermitidos` refine relaxed to cargo-name shape rules (≤100/item, ≤255 total). |
| **Frontend** | Global `<Toast/>` in default layout (10 per-page duplicates removed); `toYMD()` date normalization on 3 pacientes submit handlers; **cert v-model-on-const-reactive fix** (`:model-value` + `Object.assign` — UI-attached cert files were silently dropped since jul-9); `CertificateUpdateForm.reset()` + re-upload-on-restore (IDB stash hygiene); cargos catalog read-only on `/empresa`; instrumentos roles from `/empresa/cargos` (ADMIN default); plantilla filename `_YYYY-MM-DD`; fichas historial download; empleados tabs h-scroll; novedades detail dialog + truncation; nómina slot spinners + saving state + "Ver detalles" dialog. |
| **Scripts** | `reset-staging-db.sh` ships in the artifact (staging-only guards, interactive confirmation; developer-run only, never automated). |
| **Reference** | Implementation report: `context/plan-implemented/qa-jul-11-fixes-implemented.md` |

## Phase R0 — Preflight (read-only) — ✅ ALL GREEN (executed by lead)

| Check | Result |
|---|---|
| `git rev-parse HEAD` | ✅ `a169460b5d468d7b973a82f6ed8b5fc76ac38392` ("jul 8 jul 9 jul 10 changed with agent teams"; jul-11 fixes uncommitted in working tree — deployments build from working tree per established pattern) |
| Snapshot tag | ✅ `staging-jul11-fixes-snapshot` created at WIP stash commit |
| Local `tsc --noEmit` (backend) | ✅ clean |
| Local `/api/v1/health` | ✅ 200 |
| Staging `/api/v1/health` (CloudFront) | ✅ 200 |
| On-instance `prisma migrate status` | ✅ 20 migrations found, "Database schema is up to date!" — matches local 20; **no pending migrations** |
| PM2 `miempresa-api` | ✅ online, pid 531590. `restarts: 18` investigated before proceeding: matches stopgap-B guarded pm2 reloads from the credential-rotation cron (`/var/log/credential-refresh.log` has reload entries); error log clean (no non-ZodError matches in last 100 lines); instance load 0.00 |
| Migration-risk gate | N/A — zero new migrations this release |
| R1 (IaC) | **SKIPPED** — no CloudFormation/CORS/SSM delta in this release (jul-10 R1 already confirmed no drift) |

## Phase R2 — DB backup ✋ — ✅ COMPLETE (deploy-worker, 2026-07-12)

- `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul11-fixes.sql.gz` — **24,066 bytes**, SHA256 `9bd8441dd59e2b9a809ec4427da169666cc571f62b51c5731028b84597ad8bfa`
- Prior backups retained: pre-jul9, pre-jul10, pre-i123, pre-hotfixqa, pre-w6-hotfix
- Benign postgres chdir warning present (L17, non-blocking)
- 📚 Dump growth 16.5 KiB (jul-10) → 23.5 KiB: staging QA data accumulated across hotfixqa/I1-I3 cycles.

## Phase R3 — Backend CodeDeploy ✋ — ✅ SUCCEEDED first attempt (deploy-worker, 2026-07-12)

- Artifact: `deployments/jul11-fixes-20260712-060453.zip` (284 KiB; appspec at root; zip verified CLEAN of generated/node_modules/.env)
- **Deployment `d-1VCEYX4JK`** — Succeeded, 06:04:56Z → 06:06:05Z (~70 s)
- AfterInstall: `AfterInstall completed successfully`; `prisma migrate status` → 20 found, **No pending migrations**, up to date (as expected — 0 new)
- PM2: online, pid 563696, error log clean (no non-ZodError matches)
- `GET /api/v1/health` → 200 post-deploy
- 🐛 Anomalies logged: (1) first `npm run build` piped exit-1 with empty output — re-run clean, `tsc` exit 0, not a real failure; (2) pm2 `restart_time` 18 → **0**: appspec does hard `pm2 start` which resets the counter on fresh PID (same as jul-10 post-deploy `restarts: 0`) — counter reset, not crash.

## Phase R4 — Frontend Amplify ✋ — ✅ SUCCEEDED (deploy-worker, 2026-07-12)

- SSM API_BASE verified: `https://miempresa-api-stg.disruptiveexp.com/api/v1` (baked by script)
- Build: 810 modules, 16 routes prerendered, 12M output, 2.0M zip → `releases/20260712-060657.zip`
- **Amplify Job 7** — SUCCEED. Verify: root 200 · apiBase grep = `miempresa-api-stg...api/v1` · `/certificados` SPA fallback 200
- Worker progress log: `backend/tasks/devops-deploy-jul11/progress-report.md`

## Phase R5 — Post-deploy QA — ✅ ALL GREEN (lead, 2026-07-12)

**3-tier suite** (`./scripts/qa-staging.sh --stage staging --profile disruptive`): **37/37** — 18 DB + 9 Backend API + 10 Frontend browser (FE tier grew 6→10 since jul-10 via hotfixqa staging hardening).

**jul-11-specific authed smoke** (QA creds from SSM, cookie jar):
```
POST /patients/8/notes  fechaIncidente="2026-07-12T12:00:00.000Z" (ISO — the exact shape that used to 400)
  → 201, fechaIncidente persisted 2026-07-12                                    ✓ B2 live
POST /patients/2/fichas  archivoCompletado + fechaVencimiento="2026-08-12T12:00:00.000Z" (ISO)
  → estado COMPLETADO, fechaVencimiento 2026-08-12                              ✓ B1 live
POST /certificates (id 5, no files) → POST /updates {archivoUrl, comprobantePagoUrl, fechaVencimiento}
  → parent snapshot: archivoUrl ✓, comprobantePagoUrl ✓, estado VIGENTE
  → GET /certificates/5 persists both keys → DELETE 200 (cleanup)               ✓ B4b live
POST /instruments  rolesPermitidos="ADMIN,GERONTÓLOGA" (cargo-name, was 400 pre-jul-11)
  → 201, roles echoed verbatim → DELETE 200 (cleanup)                           ✓ I2 live
GET /patients/2 → registrosFichas[].archivoCompletado key present (2 rows)      ✓ I4 live
```
Data residue (harmless, per jul-10 precedent): 1 smoke note on patient 8, 1 COMPLETADO smoke ficha on patient 2 (COMPLETADO fichas are not deletable by design).

---

## Release result — ✅ COMPLETE (2026-07-12)

```
Deployed:   backend  d-1VCEYX4JK   (deployments/jul11-fixes-20260712-060453.zip, 284 KiB, ~70 s)
            frontend Amplify Job 7 (releases/20260712-060657.zip, 2.0 MiB, first attempt)

DB:         unchanged — 20/20 migrations, 0 new (app-code + frontend release)
Backup:     s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul11-fixes.sql.gz
            (24,066 bytes, SHA256 9bd8441dd59e..., prior backups retained)

Baseline:   HEAD a169460 + uncommitted jul-11 fixes working tree
            (tag staging-jul11-fixes-snapshot at WIP stash commit)

QA:         • 3-tier staging suite 37/37 (18 DB + 9 API + 10 FE browser)
            • B1/B2 ISO-date acceptance live (fichas single-step 201 + nota 201)
            • B4b cert file propagation live (archivo + comprobante on parent, persisted)
            • I2 cargo-name roles live · I4 archivoCompletado in patient payload live
            • PM2 online pid 563696, error log clean

Not touched: prod (no prod resource enumerated or mutated)
Execution:  lead = R0 gates + R5 QA · deploy-worker (pt-devops-infra) = R2/R3/R4
```
