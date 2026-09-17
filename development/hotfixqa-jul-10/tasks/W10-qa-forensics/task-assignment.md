# task-assignment — QA forensics: why the release QA missed the failures (W10)

## Task Type
RESEARCH (read-only audit; hardening implementation comes in a later wave)

## Task ID
`2`. `TaskUpdate(taskId: "2", status: "in_progress")` on start.

## The question (user's, verbatim intent)
"Identify why the QA did not catch the issues and regression tests failed to prevent issues that damaged things that were working before." The jul-10 release + W6-hotfix QA showed **33/33 green including a real S3 browser upload** — hours later a human QA found S3 broken on every surface plus persistence bugs. Things that worked on jul-9 broke.

## Inputs (read all)
1. `context/user-feedback/qa-session-jul-10-hotfixqa-reinterpreted.md` — symptoms + the 4 forensics questions (§QA-forensics)
2. `context/implementation-plan/staging-release-jul10-runbook.md` — what R5 QA actually ran (incl. the Hotfix W6 section)
3. `frontend/tests/staging/*.spec.ts` + the staging QA scripts — what the 33/33 covers
4. `frontend/tests/local-qa/jul10-*.spec.ts`, `jul9-*.spec.ts`, `jul8-fichas-*.spec.ts` — what regression asserts (and what it does NOT: reload-persistence, failure-surfacing)
5. `context/implementation-plan/storage-validation-report-jul5.md` — HIGH-1 ("all specs pass while uploads broken") and MED-2 (STS/URL expiry) — both prior lessons directly relevant
6. Timeline reconstruction: jul-10 runbook timestamps vs the STS cred refresh design (`refresh-credentials.sh` header) — show WHY the QA window was green

## Deliverables (analysis only — no test-writing yet)
`tasks/W10-qa-forensics/result.md` with:
1. **Timeline diagram** (text): deploy → R5 QA (creds age ~N min) → cred expiry boundary → human QA — proving the time-dependence blind spot
2. **Assertion-gap audit table**: for each symptom S1–S11, which existing spec SHOULD have caught it and the exact missing assertion (e.g., staging-upload asserts PUT 200 but never reload+key-present; no spec asserts error-toast-on-failure)
3. **Prior-lesson recurrence analysis**: HIGH-1 and MED-2 were documented jul-5 — why did they recur? (MED-2 explicitly deferred; HIGH-1 fix applied only to PUT-assertion, not persistence)
4. **Hardening proposal** (ranked, concrete):
   - S3 canary: design a staging probe that validates presign+PUT+GET at a cred-refresh boundary (e.g., runbook step "wait until next :00/:45 + re-run upload spec", or an on-instance cron canary that alerts)
   - Reload-persistence assertion standard for every upload spec
   - Silent-failure specs (assert visible feedback on forced-fail via page.route abort)
   - Staging suite coverage additions: notas create, fichas update, empleado-certificados round-trip
5. `tasks/W10-qa-forensics/{progress-report.md,completion-report.md}`

## Constraints
READ-ONLY: no source or test modification, no staging mutation (read-only curls allowed if needed for evidence). No git commit. This wave is analysis; implementation of your proposal is your NEXT assignment after the fix wave.

On done: `SendMessage(to: "main", "COMPLETE: QA forensics done. Blind spots: {count}. See tasks/W10-qa-forensics/result.md", summary: "W10 forensics complete")`. Then stay PARKED — hardening implementation arrives as NEW-ASSIGNMENT.
