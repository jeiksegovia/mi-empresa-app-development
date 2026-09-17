# W10 QA-forensics — progress report

**Task ID**: 2 · **Type**: RESEARCH (read-only) · **Status**: COMPLETE

## Steps executed
1. Read task-assignment + all 6 required inputs (qa-session reinterpreted, jul-10 runbook incl. W6 hotfix, storage-validation-report-jul5, refresh-credentials.sh, s3Service.ts, and the staging + local-qa spec set).
2. Verified the crux by code inspection (no staging mutation):
   - `s3Service.ts:5` — `S3Client` is **module-level**, created once at import; both presign helpers reuse it.
   - `refresh-credentials.sh:75-81,135-159` — STS session 3600 s, creds file written **without an expiration field**.
   - cron `*/45` confirmed in `validate-instance.sh:114` / `check-credentials.sh:163`.
   - grep of `frontend/tests/` for any download/GET-presign assertion → **empty** (no download-path coverage anywhere).
3. Mapped the jul-10 + W6 hotfix deploy/QA timestamps to the cron `:00/:45` cred boundaries → produced the green→red timeline.
4. Built the S1–S11 assertion-gap table, the HIGH-1/MED-2 recurrence analysis, and the ranked P1–P4 hardening proposal.

## Constraints honoured
Read-only. No source/test edits, no staging curls/mutation (deferred live infra confirmation to W8), no git commit.

## Output
`tasks/W10-qa-forensics/result.md` (timeline, assertion-gap audit, prior-lesson recurrence, hardening proposal, evidence index).
