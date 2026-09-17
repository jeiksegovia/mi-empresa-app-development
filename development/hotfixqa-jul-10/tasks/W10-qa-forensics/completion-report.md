# W10 QA-forensics — completion report

**Task ID**: 2 · **Type**: RESEARCH (read-only) · **Verdict**: ✅ COMPLETE · **Blind spots**: 4 systemic (mapped across S1–S11)

## The answer, in one paragraph
The QA passed 33/33 (incl. a real S3 upload) because it always runs within ~1–3 min of deploy — the freshest-possible credential instant — while the failure is time-dependent. `s3Service.ts` creates a **module-level `S3Client` once at process start**; `refresh-credentials.sh` writes STS creds **with no expiration field**, so the SDK pins them as static for the life of the PM2 process. The cron rewrites the file at `:00/:45`, but the process never re-reads it, so ~1 h after each deploy every presign is **born expired** (`ExpiredToken`) on every surface — until the next deploy restarts the process. Automated QA tests inside the green hour; the human tested after it. jul-9 did not regress: an ever-present, time-dependent **infra** bug simply became visible when the human tested later in the credential lifecycle than any automated probe ever does.

## The 4 systemic blind spots
- **BS-1 Time-dependence probe gap** — no probe re-runs after the ≤1 h cred boundary (S3, S4, S5, S6, S9).
- **BS-2 Reload-persistence not asserted** — specs assert PUT 200, never the persisted key / download after reload; **HIGH-1 applied only to its PUT half** (S1, S4, S6, S7, S9).
- **BS-3 Silent-failure UX not asserted** — no spec forces a failure and asserts visible feedback + stopped spinner (S1, S2, S5).
- **BS-4 Staging coverage gap** — staging tier = login/SPA ×5 + one PUT; no notas / fichas-update / cert round-trip / download-presign / UI-parity (S2, S3, S7, S8, S10, S11).

## Prior-lesson recurrence
- **HIGH-1** recurred (S7): the jul-5 fix implemented the PUT-200 assertion but **not** the "persisted `*_url` non-null after upload" half the lesson named.
- **MED-2** recurred and was under-scoped: deferred as "low frequency" on a per-URL risk model; the real failure is per-**process** credential pinning → ~100 % of presigns expired after the boundary, not a rare edge.

## Hardening proposal (ranked)
1. **S3 canary at the cred boundary** — on-instance cron canary flowing through the app's own presign process (a fresh CLI misses the pinned-process bug); + zero-code runbook stopgap ("wait deploy+65 min, re-run upload + new download spec").
2. **Reload-persistence assertion standard** — `assertUploadPersisted`: PUT 200 → reload → non-null key → download GET 200, on every upload spec.
3. **Silent-failure specs** — `page.route` abort/400 → assert visible error + spinner stops.
4. **Staging suite additions** — notas, fichas-update round-trip, empleado-cert round-trip, download-presign, cert-empresa auto-refresh, S10/S11 UI parity.

## Constraints
Read-only satisfied: no source/test/staging mutation, no git commit. Live infra confirmation of the cred-pinning mechanism is **W8's** deliverable; this report is the QA-process forensics.

## Deliverables
- `result.md` — timeline diagram, S1–S11 assertion-gap audit, HIGH-1/MED-2 recurrence, ranked P1–P4 hardening, evidence index.
- `progress-report.md`, `completion-report.md`.

**Next**: PARKED. Implementation of the hardening proposal arrives as a separate NEW-ASSIGNMENT after the fix wave.
