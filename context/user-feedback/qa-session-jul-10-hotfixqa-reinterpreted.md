# QA Session — jul-10 hotfix QA (reinterpreted)

**Source**: `qa-session-jul-10-hotfixqa.md` (raw ASR, single speaker — developer QA'ing STAGING after the W6 hotfix deploy of 2026-07-10 ~23:51 UTC)
**Method**: cleaned repetitions/ASR errors; every symptom mapped to code + infra. Cross-referenced against `staging-release-jul10-runbook.md`, `s3Service.ts`, `refresh-credentials.sh`, jul-5 storage report (MED-2), and the jul-9/jul-10 frontend changes.

**Critical context**: W7's post-hotfix QA ran **33/33 green including a real S3 browser upload** minutes after deploy. This QA session, run later, found S3 broken everywhere. That delta is itself diagnostic (see §Root-cause hypothesis).

---

## Symptom log (in transcript order)

| # | Area | Symptom (cleaned) | Suspected layer |
|---|---|---|---|
| S1 | Fichas → "Actualizar estado" (instrumento "dieta") | Select file + notas + COMPLETADO → guardar → spinner runs, **nothing happens, no change persisted** | Cascade of S3 failure (upload returns null → submit aborts) + error not surfaced |
| S2 | Pacientes → Nueva nota (with fecha incidente) | Fill + guardar → **nothing happens** | Silent failure — either S3-unrelated bug or unsurfaced 400 (business-day rule?) — needs repro |
| S3 | Instrumentos → crear | Create works ✓. **"Descargar plantilla" → error: "el token que ha generado está expirado"** | **S3 presign — ROOT CAUSE CANDIDATE**. QA's own hypothesis: token generation broken → explains all upload/download failures |
| S4 | Certificados empresa → subir archivo | Upload "exitoso", save works, **but page does not reload/refresh**; then in Documentos y Certificados **cannot download** the file just uploaded | UI refresh bug + S3 download (S3 cascade) |
| S5 | Empleado → certificados | **Cannot attach file** ("no puedo adjuntar") — upload not working | S3 cascade (PUT with expired sig) |
| S6 | Empleado → educación (diploma) | Upload image works, save OK, **after reload diploma appears ✓ but cannot view/download** ("token está mal") | Persistence OK — download S3 cascade |
| S7 | Empleado → certificados (2nd attempt) | PDF uploads, shows "adjuntado", **no download option shown** (inconsistent with diploma UI), save says OK, **reload → file GONE** — "hay un bug ahí segurísimo" | **Real persistence bug candidate**: key not sent/saved on submit (or upload silently failed → null key saved). Also UI inconsistency (no download affordance) |
| S8 | Contrato laboral → crear | Create with cargo + PDF works ✓. **"Botón de pausa" unclear** (no tooltip/label) | UX polish |
| S9 | Contrato → download | Download button → S3 error (cascade). After reload, edit shows contract ✓, firmado upload + replace ✓, both persist ✓ | S3 cascade; persistence OK here |
| S10 | Contrato → descargar firmado | Download button **only downloads the original contract — no option to download the FIRMADO** | Missing UI feature |
| S11 | Empleado DETAIL view (`empleados/[id]/index.vue`) | **"Contrato" tab missing on the view screen** — inconsistent with the edit screen | UI parity gap |
| S12 | Meta | "**Estos fallos no estaban en la versión del 9 de julio** — han habido procesos que están fallando en la parte de QA" | QA/regression process forensics required |

---

## Root-cause hypothesis (step-by-step)

1. `backend/src/services/s3Service.ts` signs uploads (300s) and downloads (3600s) with the instance's AWS creds.
2. Staging creds are **1-hour STS session tokens** minted by `refresh-credentials.sh` via cron (`:00/:45`), written to `/root/.aws` + `/home/ec2-user/.aws` (PM2 runs as ec2-user).
3. **If the cron stops refreshing** (dead cron, IAM bootstrap failure, clock issue), the STS session expires within ≤1h. Every presigned URL generated after that carries an expired token → S3 rejects with `ExpiredToken` — the QA's exact error, on EVERY surface (plantilla download, diploma view, cert download, contrato download) AND browser PUTs (uploads "not working").
4. **This is time-dependent**: W7's R5 QA (incl. real S3 upload) passed right after deploy — creds were fresh. The failure window opened later. That's why the release QA was green and this session is red.
5. Related deferred risk: jul-5 storage report **MED-2** ("download URLs can outlive the STS session") was accepted-as-is — but this failure mode is bigger: not URL-outliving-session, but **signing with already-expired creds**.
6. **Cascades**: with S3 broken, `useFileUpload().uploadFile` returns null → forms either abort silently (S1 fichas, S5 cert attach) or save without the key (S7 file-gone-after-reload). Most "persistence bugs" in this log are plausibly S3-cascade — EXCEPT the ones proven to persist (S6 diploma, S9 contrato) vs not (S7 empleado certificado), which suggests S7 has a REAL save-path bug independent of S3, and S2 (notas — no file involved) is a separate bug.

**Verification order matters**: fix/confirm infra first, then re-test every symptom; only what still fails is a code bug.

## Genuinely-code items (independent of S3)

| ID | Item | Where |
|---|---|---|
| C1 | Notas nueva: guardar does nothing — no file involved, S3-independent. Repro + fix + surface errors | `pacientes/[id]/index.vue` notes dialog + notas route |
| C2 | Empleado certificados: no download affordance + file gone after save/reload (diploma UI persists fine — compare paths) | `EmpleadoCertificadosEditor.vue` + employees certificados save path |
| C3 | Certificado empresa: page doesn't refresh after save | `certificados/[id].vue` or crear flow |
| C4 | Contrato: "descargar firmado" missing (only blank contract downloadable) | contrato tab in `empleados/[id]/editar.vue` |
| C5 | Contrato "pausa" button unclear — add tooltip/label (it's the archive/deactivate action) | same |
| C6 | Empleado DETAIL view: add "Contrato" tab for parity with edit screen | `empleados/[id]/index.vue` |
| C7 | Fichas actualizar estado: after S3 fix, verify save works and errors are SURFACED (no silent spinner) | `pacientes/[id]/index.vue` |

## QA-forensics questions (S12 — why wasn't this caught)

1. **Time-dependence blind spot**: staging QA runs once, immediately post-deploy, when STS creds are freshest. No probe exists that validates S3 presigns AFTER a cred-refresh boundary. → need a monitoring/canary or a QA step that tests presign validity + cron health (`aws sts get-caller-identity` on-instance, creds file mtime).
2. **Persistence-after-reload not asserted**: `staging-upload.spec.ts` asserts the S3 PUT returns 200 but NOT that the entity retains the key after save + reload (HIGH-1 lesson from jul-5, only partially applied). S7 would have been caught by a reload-assertion.
3. **Silent-failure UX**: multiple forms fail without surfacing errors (S1, S2, S5) — specs assert happy paths; no spec asserts "failure shows feedback".
4. **Coverage gap on staging suite**: 6 browser tests cover login/upload/SPA — none cover notas, fichas update, empleado certificados on staging.
