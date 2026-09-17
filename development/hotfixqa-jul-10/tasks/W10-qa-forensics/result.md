# W10 — QA Forensics: why the release QA missed the S3 + persistence failures

**Task**: RESEARCH / read-only. No source, test, or staging mutation. No git commit.
**Question (verbatim intent)**: *"Identify why the QA did not catch the issues and regression tests failed to prevent issues that damaged things that were working before."*
**Baseline**: staging jul-10 release + W6 hotfix both reported **33/33 green including a real S3 browser upload**; a human QA hours later found S3 broken on every surface plus persistence bugs, and reported that *"these failures were not in the jul-9 version."*

---

## 0. Executive summary — 4 systemic blind spots (mapped across S1–S11)

| # | Blind spot | What it is | Symptoms it let through |
|---|---|---|---|
| **BS-1** | **Time-dependence probe gap** | Every automated QA runs within ~1–3 min of deploy, i.e. at the *freshest-possible* credential instant. No probe ever re-runs after the ≤1 h STS-session boundary, which is exactly when S3 breaks. | S3, S4, S5, S6, S9 (the whole "expired token" cascade) |
| **BS-2** | **Reload-persistence not asserted** | Upload specs assert the **PUT returns 200** but never reload and assert the entity **retains the key** (non-null `*_url`) and that the key **downloads (GET 200)**. This is HIGH-1 (jul-5) applied only to its PUT half. | S1, S4, S6, S7, S9 |
| **BS-3** | **Silent-failure UX not asserted** | Specs assert happy paths only. No spec forces a failure (aborted presign/PUT or a 400 submit) and asserts a **visible error + stopped spinner**. Forms that fail silently pass QA. | S1, S2, S5 |
| **BS-4** | **Staging suite coverage gap** | The staging tier is **login/SPA ×5 + one upload PUT**. Zero staging coverage of notas, fichas-update, empleado-certificados round-trip, download-presign, or edit/detail UI parity. | S2, S3, S7, S8, S10, S11 |

**Headline root cause of the green→red flip**: `s3Service.ts` creates a **module-level `S3Client` once at process start** (line 5). The STS credentials file written by `refresh-credentials.sh` carries **no expiration field**, so the AWS SDK treats the 1-hour session-token credentials as **static/non-expiring** and pins them for the life of the PM2 process. The cron rewrites the *file* at `:00`/`:45`, but the long-lived Node process **never re-reads it**. Result: presigns work for ≤1 h after each deploy/restart, then every presigned URL is **born already-expired** (`ExpiredToken`) on every surface — until the next deploy restarts the process. The QA always tests inside that first green hour; the human always tested after it.

> Live confirmation of this infra mechanism (cron mtime, on-instance `sts get-caller-identity`, process-cred age) is **W8's** deliverable. This report treats it as the leading, code-grounded hypothesis and focuses on the **QA-process** failure it exposes.

---

## 1. Timeline diagram — the time-dependence blind spot

All times UTC, 2026-07-10. Cron `*/45 * * * *` mints STS creds at **:00 and :45** (1 h / 3600 s sessions).
(Evidence: `refresh-credentials.sh:75-81` duration 3600; `validate-instance.sh:114` / `check-credentials.sh:163` schedule `*/45`.)

```
              cred mint          cred mint                     cred mint
                 :00               :45                            :00
   ───────────────┼─────────────────┼──────────────────────────────┼─────────────▶ time
 jul-10 main deploy R3                                    W6 hotfix deploy
  ~15:50 PM2 restart                                       ~23:50 PM2 restart
  pid 454011                                               pid 473002
  reads creds (fresh)                                      reads creds minted 23:45
        │                                                        │   valid until 00:45
        ▼                                                        ▼
  R5 QA ~15:50–15:53                                    H.R5 QA ~23:51–23:55
  33/33 GREEN                                            33/33 GREEN
  (staging-upload PUT 200)                               (staging-upload PUT 200)
  creds age ~1–3 min                                     creds age ~6–10 min
                                                                 │
                                                                 │  in-process creds
                                                                 │  pinned at startup
                                                                 ▼
                                                       ┌──────── 00:45 UTC ────────┐
                                                       │  CRED-EXPIRY BOUNDARY     │
                                                       │  in-memory session token  │
                                                       │  dies; process keeps      │
                                                       │  using it (no re-read)    │
                                                       └───────────────────────────┘
                                                                 │
                                                                 ▼
                                                       Human QA "hours later" (≈01:00–03:00)
                                                       every presign born EXPIRED
                                                       S3 RED on every surface
```

**Why the QA window was green (proof)**:
- The `staging-upload` spec ran **~6–10 minutes** after the W6 PM2 restart (health 200 at `23:51:23`, runbook L924; QA block L999–L1010). The pinned creds (minted `23:45`) do not expire until `00:45` → **35+ min of head-room** at QA time.
- The spec only exercises a **PUT** (300 s presign) executed *immediately* — the shortest-lived, freshest artifact in the system. It is structurally incapable of observing the ≤1 h boundary.
- Nothing in `qa-staging.sh` (the 3-tier runner) waits, re-runs, or probes cred age. QA is a single point-in-time sample taken at the one moment the system is guaranteed healthy.

**Why jul-9 "worked" and jul-10 "regressed" (the false regression)**:
The bug is **latent and always present** since the STS design (it is MED-2's family, deeper). It surfaces only when a user crosses the ≤1 h-post-restart boundary. On jul-9 the app was likely exercised within its post-deploy green hour; the jul-10 W6 hotfix added a fresh `23:50` restart, and the human QA happened to test **>1 h** into that process's life. The jul-9 **feature code did not regress** — an ever-present, time-dependent **infra** bug became visible because the human tested later in the credential lifecycle than any automated QA ever does. (Genuine code regressions/gaps also exist — S7, S2, S10, S11 — see §2; those were missed for BS-2/BS-3/BS-4 reasons, not timing.)

---

## 2. Assertion-gap audit — per symptom S1–S11

For each symptom: the spec that *should* have caught it, what it actually asserts, and the **exact missing assertion**.

| Symptom | Nearest existing spec | What it asserts today | Missing assertion (exact) | Blind spot |
|---|---|---|---|---|
| **S1** Ficha "actualizar estado": save spins, nothing persists, no error | `jul10-ficha-single-step.spec.ts` | LOCAL only; row count `+1` + a `COMPLETADO` row is visible (in-memory, post-submit) | (a) after `page.reload()`, GET the ficha and assert `archivoCompletado` non-null; (b) on forced upload failure assert a visible error + spinner stops; (c) run it on **staging** | BS-2, BS-3, BS-4 |
| **S2** Nueva nota: guardar does nothing (no file) | `jul9-nota-fecha-incidente.spec.ts` | Happy-path create via **API**, then asserts the row renders | Drive the **UI form submit** and, on a 400 (business-day rule), assert the inline `nota-fecha-incidente-error` is **visible** (currently the 400 is only asserted at the backend layer, never that the UI surfaces it) | BS-3, BS-4 |
| **S3** "Descargar plantilla" → *"el token que ha generado está expirado"* | *(none)* — **no spec anywhere exercises a download/GET presign** (grep for `download-url`/GET-200 in `frontend/tests/` = empty) | — | A spec that requests a **download presign and executes GET → 200** against the real object host; ideally at/after the cred boundary (BS-1) | BS-1, BS-4 |
| **S4** Cert empresa: upload OK but page doesn't refresh; then cannot download | `jul9-cert-update-comprobante.spec.ts` | Reloads, asserts the download **button testid renders** (from a fake `example.com` URL set via API) | (a) after real upload, assert the page **auto-refreshes** without manual reload; (b) **click** the download and assert GET **200** (button *presence* ≠ working download) | BS-1, BS-2 |
| **S5** Empleado cert: "no puedo adjuntar" (PUT with expired sig) | `staging-upload.spec.ts` | Real browser PUT → asserts **200** — immediately post-deploy | Re-run the same PUT **after the cred boundary**; a fresh-creds PUT can never catch the pinned-process expiry | BS-1 |
| **S6** Diploma: upload+persist OK, cannot view/download ("token está mal") | `jul9-empleado-educacion.spec.ts` | Creates educacion via API with **no file**; asserts it renders | Attach a **real file**, reload, then **download it (GET 200)** — the persist half works, the download presign is what fails | BS-1, BS-2 |
| **S7** Empleado cert (2nd): "adjuntado" then **reload → file GONE** | `staging-upload.spec.ts` (PUT) + `jul9-empleado-educacion` (render) | PUT 200; render of an API-created row | After upload+save, **reload** and assert the persisted `*_url` is **non-null** (key actually saved). This is the **HIGH-1 recurrence** — the fix asserted the PUT, never the persisted key | BS-2 |
| **S8** Contrato "pausa" button unclear (no label/tooltip) | *(none)* | — | Static UI assertion: the archive/deactivate control has an accessible label/tooltip | BS-4 |
| **S9** Contrato download → S3 error (edit/replace persist OK) | *(none for download)* | `jul9-contrato-cargo.spec.ts` covers cargo, not the file download | Download presign **GET 200** for the contrato file (same download-path gap as S3/S6) | BS-1, BS-2 |
| **S10** "Descargar firmado" missing (only blank contract downloadable) | *(none)* | — | Assert both a *blank* and a *firmado* download affordance exist when `archivoFirmadoUrl` is set | BS-4 |
| **S11** Empleado **detail** view missing "Contrato" tab (edit has it) | *(none)* | — | Parity assertion: tabs present on `empleados/[id]/editar.vue` also present on `empleados/[id]/index.vue` | BS-4 |

**Cross-cutting facts**:
- The entire `local-qa/` suite signs against the **dev** bucket with the backend's local (long-lived) credentials — it **cannot** exercise the staging STS-expiry mode by construction.
- The **only** staging upload artifact is `staging-upload.spec.ts`, and it tests **PUT-only, once, immediately**. There is **no** download-presign test on any surface, local or staging.
- `jul8-fichas-persistence.spec.ts` is named "persistence" but only tests **client-side `sessionStorage` draft** restore — not server persistence after reload. The name creates false confidence that a reload-persistence gap is covered when it is not.

---

## 3. Prior-lesson recurrence analysis (jul-5 storage report)

### HIGH-1 — "all specs pass while uploads broken" — **recurred as S7**
- **jul-5 lesson (full)**: *"No spec asserts the S3 PUT succeeded **or that the stored `*_url` column is non-null after an upload**."* Fix should cover **both** the PUT and the persisted key.
- **What was actually implemented**: only the **PUT-200 half** — spec P2-5 (`jul4-p2-cert-empleado-archivo.spec.ts`) and `staging-upload.spec.ts` both assert `waitForResponse(PUT).status()===200`. **Neither asserts the persisted key after reload.**
- **Why it recurred**: S7 (file gone after reload) is precisely the *un-implemented half* — a null/missing key saved to the entity. The PUT can succeed (or, at the cred boundary, appear to) while the key never lands in the row. The fix closed the symptom that was visible in jul-5 (broken bucket → PUT fails) but not the invariant the lesson actually named (persisted non-null key). **Half-applied lesson.**

### MED-2 — "download URLs can outlive the STS session" — **recurred, and under-scoped**
- **jul-5 decision**: explicitly **deferred** — *"Download expiry stays 3600 s … acceptable, revisit if reported."* Risk rated *"Low frequency."*
- **Why it recurred and is worse than documented**: MED-2 framed the risk as a *URL* minted near session-end outliving the session (rare, edge-of-hour). The jul-10 reality is a strict superset: the **signing process** outlives the session, so URLs are **born expired** for the entire second half of every process's life — not a rare edge, but ~**100 %** of presigns after the ≤1 h boundary. The deferral's frequency estimate ("low") was wrong because it assumed per-URL timing, not per-process credential pinning. **MED-2 was deferred on a risk model that understated the blast radius.**
- **Note**: it is now *"reported"* (the human QA is the trigger MED-2 said would justify revisiting), so the deferral's own condition to reopen is met.

**Pattern across both**: jul-5 correctly diagnosed *"a 200 on the wrong URL is worse than an error — assert the destination host of side-effect requests."* The same family (assert the **effect**, not the **request**) was needed for downloads and for post-reload persistence, but was applied only to the upload PUT.

---

## 4. Hardening proposal (ranked, concrete)

Ranked by defect-catching value per unit effort. Items 1–2 close the majority of symptoms; 3–4 close the rest.

### P1 — S3 canary at the cred-refresh boundary *(closes BS-1 → S3, S5, S6, S9; the whole cascade)*
The canary **must use the app's own long-lived signing process**, not a fresh CLI — a `aws s3 presign` from a new process uses fresh creds and would **never reproduce the pinned-process expiry**. Two layers:

- **P1a — on-instance cron canary (primary, continuous)**: every 5–10 min, call the **application's** endpoints in sequence against a fixed key:
  `POST /api/v1/uploads/presigned-url` → PUT the returned URL → `GET /api/v1/uploads/download-url?key=…` → GET the returned URL. Assert **PUT 200 and GET 200**. On non-200, alert (SNS/CloudWatch + write a red marker `qa-staging.sh` can read). Because it flows through the same module-level `s3Client`, it observes the expiry within minutes of `00:45`. *(The true fix behind this canary — write an expiration into the creds file so the SDK auto-refreshes, or reconstruct/refresh the client per request — is an implementation task; flagged for the fix wave, not this report.)*
- **P1b — runbook step (immediate stopgap for the next release)**: add a post-deploy gate: *"wait until `deploy_time + 65 min` (guaranteed past the first cred boundary), then re-run `staging-upload.spec.ts` **plus** a new download-presign spec."* No infra work; catches the bug on the very next release manually.

### P2 — Reload-persistence assertion standard *(closes BS-2 → S1, S4, S6, S7, S9)*
Mandate for **every** upload spec, a shared helper `assertUploadPersisted(entityUrl, keyField)`:
1. perform the real upload (PUT 200, host-pinned — keep the CRITICAL-2 rule);
2. `page.reload()`;
3. `GET` the entity via API and assert `keyField` is **non-null**;
4. request a **download presign for that key and GET → 200**.
This single template turns S7 from invisible to a hard failure and covers the download half universally.

### P3 — Silent-failure specs *(closes BS-3 → S1, S2, S5)*
For each mutating form (ficha update, nota create, cert attach, empleado cert), add a negative spec using `page.route` to **abort** the presign/PUT (or force a 400 on submit) and assert: (a) a visible error toast / `*-error` testid appears, **and** (b) the submit spinner **stops** (no infinite spin). This directly encodes "failure must surface feedback."

### P4 — Staging suite coverage additions *(closes BS-4 → S2, S3, S7, S8, S10, S11)*
Grow the staging tier beyond login+PUT:
- `staging-notas-create` (S2) — UI submit + surfaced validation error.
- `staging-ficha-update-roundtrip` (S1) — single-step create → reload → key persisted.
- `staging-empleado-cert-roundtrip` (S5/S7) — upload → reload → non-null key → GET 200.
- `staging-download-presign` (S3/S6/S9) — presign + GET 200 for an existing object (pair with P1b timing).
- `staging-empresa-cert-refresh` (S4) — upload → assert auto-refresh (no manual reload) → download 200.
- Static UI-parity checks (S10 firmado-download affordance; S11 contrato tab present on `empleados/[id]/index.vue`).

**Sequencing recommendation**: P1b (runbook step) is a zero-code stopgap to ship immediately; P1a + P2 are the highest-value durable fixes; P3 + P4 broaden the net. All implementation is deferred to the follow-on NEW-ASSIGNMENT per this wave's read-only constraint.

---

## Appendix — evidence index (file:line)

- `backend/src/services/s3Service.ts:5` — **module-level `new S3Client(...)`** created once at import (pins startup creds).
- `backend/src/services/s3Service.ts:19,28` — upload presign 300 s, download presign 3600 s.
- `backend/infrastructure/db/scripts/refresh-credentials.sh:75-81` — STS `assume-role` duration **3600 s**.
- `refresh-credentials.sh:135-159` — writes creds file with **no expiration field** (only key/secret/token) → SDK treats as static.
- `backend/infrastructure/db/utilities/validate-instance.sh:114`, `check-credentials.sh:163` — cron `*/45 * * * *` (fires :00/:45).
- `frontend/tests/staging/staging-upload.spec.ts:63-76` — asserts **PUT 200 only**; deletes empleado; no reload, no download.
- `scripts/qa-staging.sh` — 3-tier runner; no wait/re-run/cred-age probe.
- `frontend/tests/local-qa/jul10-ficha-single-step.spec.ts:67-72` — row `+1` + `COMPLETADO` visible; **no reload**, local-only.
- `frontend/tests/local-qa/jul9-empleado-educacion.spec.ts` — educacion via API, **no file**.
- `frontend/tests/local-qa/jul9-cert-update-comprobante.spec.ts:79-82` — reload asserts download **button renders** (fake URL), never a GET.
- `frontend/tests/local-qa/jul9-nota-fecha-incidente.spec.ts:57-77` — happy-path API create; 400/surfacing not UI-asserted.
- `frontend/tests/local-qa/jul8-fichas-persistence.spec.ts` — **sessionStorage** draft only, not server persistence.
- `context/implementation-plan/storage-validation-report-jul5.md:42-45` (HIGH-1), `:57-59` (MED-2), `:91` (MED-2 deferred).
- `context/implementation-plan/staging-release-jul10-runbook.md:622-720` (R5 33/33), `:999-1024` (W6 H.R5 33/33), `:924` (health 23:51:23).

## Grep hooks
W10-qa-forensics time-dependence-blind-spot STS-cred-pinning module-level-S3Client born-expired ExpiredToken cred-refresh-boundary reload-persistence-gap silent-failure-gap staging-coverage-gap HIGH-1-recurrence MED-2-underscoped S3-canary presign-GET-200 assertUploadPersisted BS-1 BS-2 BS-3 BS-4 false-regression jul-9-worked jul-10-broke refresh-credentials */45 staging-upload-spec PUT-only-no-download
