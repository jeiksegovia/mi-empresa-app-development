# Team Status: instrumentos-dynamic-fichas

## Phase: RELEASE COMPLETE — jul-17 staging SHIPPED (2026-07-17)
All 8 phases R0–R7 checkpoint-clean under developer approval + amendments A-1/A-2. Final:
CodeDeploy d-XIPRCXIMK Succeeded, Amplify job 8 SUCCEED, 21/21 migrations, seed live, uploads
bucket 0/0 (byte backup + manifest in backups bucket), credential architecture intact, R7 QA 6/6.
Orchestrator spot-checks independent: health 200, frontend 200, bucket 0/0. worker-8 SHUTDOWN
(approved 15:54, terminated — jul-17 release roster fully closed). Runbook: staging-release-jul17-runbook.md (1363 lines).
Follow-ups: B32 TTY-guard hardening for reset-staging-db.sh; B31/OP-3 canonical creds after resets.

## (prior phase) RELEASE CYCLE — jul-17 staging (post-convergence, user-requested)
worker-7: STALLED 8h (2 undeclared idles), replaced — but sent a full HANDOFF before shutdown:
A1+A2 complete & guard-proven, regex deviation [a-z0-9-] ACCEPTED (real bucket has account digits),
A2 verifications done (empty-schema replay clean, jul10 migration no-op, templates parse), KEY
constraint: R2 reset runs via local SSH tunnel from release checkout (devDeps pruned on-instance).
Handoff relayed to worker-8 (spot-check, don't re-derive). SHUTDOWN approved 14:42, terminated.
2026-07-17 gate: worker-8 PLAN-APPROVAL received; orchestrator caught FALSE "no backend deploy
needed" premise (feature is uncommitted; HEAD 48029ef predates it) → REVISION-REQUEST A-1 (backend
deploy from working tree). DEVELOPER APPROVED with amendments: A-1 + A-2 (pre-wipe `aws s3 sync` of
the 47 objects to backups, count-verified). Phase C authorized; per-phase CHECKPOINT → orchestrator
PROCEED; destructive typed confirmations authorized under this approval.
`decisions/jul17-staging-release-approval.md`.
worker-8 (pt-devops-infra, replacement) on task #30: Phase A authoring (runbook `staging-release-jul17-runbook.md`
+ `wipe-staging-s3.sh` destructive utility with mandatory typed developer confirmation + reset-staging-db.sh
seed extension) → Phase B HARD GATE (developer approval via orchestrator — DB hard reset + full S3
uploads wipe are DESTRUCTIVE) → Phase C checkpoint-gated execution R1–R6. No mutating step before
the developer approves.

## (prior phase) CONVERGED — FEATURE COMPLETE (2026-07-17)
All 12 tasks done + validated. Fix-up wave closed all 3 QA bugs. Final: backend instruments-dynamic
48/48, frontend 17/17 (incl. real-UI fill flow), 4 legacy suites modernized. Handoff:
`development/instrumentos-dynamic-fichas/06-handoff.md`. Summary:
`context/plan-implemented/instrumentos-dynamic-fichas-implemented.md`. All workers SHUTDOWN
(worker-6 approved 09:30, terminated — roster fully closed). Staging release
deferred to a future gated cycle.
Last updated: 2026-07-17 (final)

## Worker Roster
| Worker | Role | State | Current task | History / notes |
|--------|------|-------|--------------|-----------------|
| worker-1 | pt-research-arch | SHUTDOWN (approved 2026-07-17 04:49, terminated) | — | Wave 1 DONE (#11–#13 validated, G2 passed) |
| worker-2 | pt-data-schema | SHUTDOWN (approved 04:59, terminated) | — | #14+#15 DONE + VALIDATED (no-CASCADE verified, notas 52→52, smoke 4/4 re-run) |
| worker-3 | pt-frontend-eng | SHUTDOWN (approved 05:03, terminated) | — | #16–#18 DONE + VALIDATED (schema-render 7/7 independently re-run; plantilla refs = comments only) |
| worker-4 | pt-backend-eng | SHUTDOWN (approved 08:51, terminated) | — | #19+#20 DONE + VALIDATED (39/39 independently re-run; G2-11 verified in code; 4 legacy TEST-ENV failures classified → folded into W5 step 5) |
| worker-5 | pt-test-quality | SHUTDOWN (approved 09:21) | — | #21 DONE + VALIDATED (qa-contract 8/8 + e2e 6/6 independently re-run; 130/130 W5 surface; gap report: 3 BUGs + 4 TEST-ENV, 0 unclassified; legacy specs modernized) |
| worker-6 | pt-fullstack-impl | SPAWNED 2026-07-17 | #29 fix-up wave | FRESH per user directive; fixes BUG-W5-01 (HIGH, versionRegistro 400), BUG-W5-02 (result dialog), BUG-W5-03 + C2 cleanup; G2-12 (versionRegistro server-derived); removes QA test workarounds |

## Anomaly log
- 2026-07-17: TaskList namespace wiped (returned empty) right after W5 completion — all rows #11–#28
  were already completed, so no rebuild needed (per protocol, completion was concluded from
  artifacts, not the empty list). New fix-up task created as #29.

## Tasks
| ID | Task | Owner | Status | blockedBy |
|----|------|-------|--------|-----------|
| 11 | T1 extract/depurate 6 instruments | W1 | pending | — |
| 12 | T2 item-type matrix + exclusions | W1 | pending | 11 |
| 13 | T3 contract + base templates | W1 | pending | 12 |
| 14 | T4 Prisma redesign + migration (G1 gate) | W2 | pending | 13 |
| 15 | T5 seed + upgrade script | W2 | pending | 14 |
| 16 | T6 renderer | W3 | pending | 13 |
| 17 | T7 schema↔render tests | W3 | pending | 16 |
| 18 | T8 fill flow + results view | W3 | pending | 16 |
| 19 | T9 scoring engine | W4 | pending | 15 |
| 20 | T10 API endpoints | W4 | pending | 19 |
| 21 | T11 QA wave | W5 | pending | 17,18,20 |

## Gates
- G1: RESOLVED 2026-07-17 — approved WITH modification (no TRUNCATE CASCADE; nullify
  notas_clientes.registro_ficha_id first — CASCADE would have wiped ALL patient notes). Evidence:
  81 instrumentos / 126 legacy ficha rows, none on new codigos. `decisions/g1-migration-approval.md`.
  WATCH: W2 completion report must show identical notas_clientes counts before/after.
- G2 (EXPANDED, user directive 2026-07-16): orchestrator deep re-architecture review of contract +
  all 6 templates vs RAW sources, fixes applied directly by orchestrator, before unblocking wave 2.
  Protocol: `decisions/g2-orchestrator-template-rearchitecture.md`. PENDING.

## Watch items (for W5 QA assignment — pre-load these)
- W3 fill-flow.spec.ts ran with `mock=1` (W4 API was in-flight). QA MUST re-run it against the real
  backend (drop mock=1, seed a patient, use loginAsAdmin helper) — verify at W5 completion.
- G2-11: server resolves instrumentoVersionId (client value ignored). QA verifies: POST with bogus
  versionId succeeds + response shows real active version; completed row records correct version.
- PrimeVue RadioButton: Playwright .check()/.click() fails on p-radiobutton-box (input display:none);
  use page.evaluate input.click() — W3 documented pattern.
- Leftover nit: `plantillaArchivo: string | null` dead interface field in
  frontend/app/pages/instrumentos/[id]/index.vue:34 — QA gap report, do NOT fix.
- W4 acceptance #4: existing ficha suites (vencimientos, transitions) re-run + classification.
- Canonical maxima: Barthel 100 | MMSE 30 | Tinetti 16+12=28 | Yesavage GDS-15 15 | MNA 14+16=30 → W5 verifies engine totals; W1 specs must match or document the EMKASA variant deviation explicitly.
- W3 integration against real API may lag W4 — fold final wiring verification into #21 if timing forces it.
- TipoInstrumento enum: W1 proposes handling for merged MNA in contract (open item).

## Key events
- 2026-07-16: Intake Q&A (D1–D4 locked), plan approved "Approve & Execute", tasks #11–#21 created, W1 spawned.
- 2026-07-17: W1 COMPLETE (#11–#13); deliverables verified on disk. G2 EXECUTED: raw sources
  re-verified visually (MNA Nestlé form JPEG, Cuadro PDF, Ficha Nutricional PDF); 10 fixes applied
  by orchestrator (G2-1…G2-10, see decisions/g2-orchestrator-template-rearchitecture.md) — critical:
  MNA skip-classification bug, Float totals, may-skip semantics, PENDIENTE flow restored, type set
  collapsed to 5, roles corrected. Checker updated + all 6 templates re-validated OK.
  Wave 2a spawned: worker-2 (#14–#15), worker-3 (#16–#18).

## G2 verification verdict on W1 extraction quality
Barthel/Tinetti/Yesavage/Mini-Mental/Cuadro: 100% faithful. MNA items faithful; global-only
classification was the one real logic bug. Ficha Nutricional: 1 missed field (observación
importante). W1's "no information loss" claim on Cuadro PDF independently CONFIRMED via visual read.

## Decisions
- `decisions/intake-decisions-2026-07-16.md` — D1 seed-only+upgrade-script+schema↔render tests, D2 hard reset, D3 full scoring model, D4 score-less types.
- 2026-07-17 USER DIRECTIVE — worker lifecycle: NO parked-worker reuse in this cycle. Completed
  workers get structured shutdown after validation; every subsequent wave (W4 backend, W5 QA, any
  fix-up) spawns a FRESH worker with clean context and a self-contained assignment (exact repro +
  contract refs inline). Overrides team-plan P2/P6 reuse notes.
- Observed deviation (no action): worker-3 created internal tracking tasks #22–#28 despite the
  no-TaskCreate rule — harmless duplicates of its subtask list; renderer (#24) + result view (#25)
  already done per those rows. Will validate from artifacts at COMPLETE.
