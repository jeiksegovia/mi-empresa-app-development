# Implemented Fixes Report — all 16 improvements applied (2026-07-10)

> Companion to [04-skill-improvement-suggestions.md](04-skill-improvement-suggestions.md).
> Purpose: loadable record of WHAT was changed, WHERE, and the EXACT anchor text used — so any
> future session can verify these fixes are still present (grep the "verify" strings) or
> replicate them onto a fresh copy of the skill/agents (re-apply at the listed anchors).

## Verification one-liner

```bash
cd .claude && \
grep -c "never a plain-text acknowledgment" agents/pt-*.md | grep -vc ":1" ; \
grep -c "literal prose composed before the call" agents/pt-*.md | grep -vc ":1" ; \
grep -c "NOT-VERIFIED with a reason" agents/pt-*.md | grep -vc ":1" ; \
grep -l "Deviation-with-evidence duty" agents/pt-*.md | wc -l ; \
grep -c "Test-integrity rules" agents/pt-test-quality.md ; \
grep -c "orchestration-learnings/00-index.md" skills/planify-team/SKILL.md ; \
grep -c "Name-collision guard" skills/planify-team/SKILL.md skills/planify-team/worker-reuse.md ; \
grep -c "Classify by artifacts" skills/planify-team/SKILL.md ; \
grep -c "Watch items" skills/planify-team/progress-tracking.md ; \
grep -c "Contract-first" skills/planify-team/SKILL.md ; \
grep -c "smoke spec" skills/planify-team/worker-template.md ; \
grep -c "Known Issues NOT Fixed" skills/planify-team/worker-template.md ; \
grep -c "Fix-up routing" skills/planify-team/SKILL.md ; \
grep -c "Task not found" skills/planify-team/SKILL.md ; \
ls skills/planify-team/release-protocol.md ; \
grep -c "release-protocol.md" skills/planify-team/worker-catalog.md ; \
grep -c "retry transient failures ONCE" skills/planify-team/worker-template.md
```
Expected: first three lines output `0` (meaning: no file lacks the string), rest non-zero/exists.

---

## A. planify-team skill files (11 changes)

| ID | File | Anchor (where) | What was added | Verify grep |
|----|------|----------------|----------------|-------------|
| S1 | `SKILL.md` §Phase 0 | After resume-reading step 2 | New step 3: load `development/orchestration-learnings/00-index.md` if present + themed files per phase | `orchestration-learnings/00-index.md` |
| S2a | `worker-reuse.md` §Structured shutdown | Before "Use the Anthropic structured protocol" | Name-collision guard paragraph: never spawn under a name with unresolved shutdown_request; recovery = artifacts → PING → respawn under NEW name | `Name-collision guard (incident 2026-07-10)` |
| S2b | `SKILL.md` Phase 2 step 2 | After the `subagent_type` REQUIRED paragraph | 3-line name-collision guard cross-referencing worker-reuse.md | `Name-collision guard` |
| S3 | `SKILL.md` Phase 3 §Idle Notification Monitor | Appended to the dedupe paragraph (before the classification table) | "Classify by artifacts, not message text" — mangled summaries (`$1`), check task-dir/progress/TaskList first | `Classify by artifacts` |
| S4 | `progress-tracking.md` §Status Dashboard Template | New section between "Decisions Made" and "Active Issues" | `## Watch items` — claim / verify-at / exact command / expected | `## Watch items` |
| S5 | `SKILL.md` §Task Decomposition Strategy | New item 0 before "Natural boundaries" | Contract-first: wave-1 single owner produces interface + contract doc; downstream forbidden from reading source; QA tests the contract | `Contract-first (when work spans layers)` |
| S6 | `worker-template.md` §Deliverables orchestrator-note | Appended to the note | IMPLEMENTATION tasks always include ≥1 smoke spec following project test patterns | `smoke spec exercising the new` |
| S7 | `worker-template.md` §Completion Report Format | New section after "Issues Encountered" | `## Known Issues NOT Fixed (out of scope)` with repro; orchestrator pre-loads into QA wave | `Known Issues NOT Fixed` |
| S8 | `SKILL.md` Phase 4 | New step 2a after integration validation | Fix-up routing: QA gaps → original author NEW-ASSIGNMENT with exact repro; fixer tightens provisional assertions | `Fix-up routing` |
| S9 | `SKILL.md` Phase 3 step 6 | Appended to task-lag mitigation | Inverse case: TaskList before marking on worker's behalf ("Task not found" on already-closed) | `Task not found` |
| S10 | NEW `release-protocol.md` + `worker-catalog.md` Role 6 | New satellite file; pointer added under devops-infra "Best for" | R0–R5 checkpoint-gated release template: ungated R0 risk gate, verbatim-output CHECKPOINTs, point-of-no-return surfaced, pre-staged never-auto rollback, replayable runbook | file exists + `release-protocol.md` in catalog |
| S11 | `worker-template.md` §Boundaries | Conditional bullet at the end | Parallel-migration advisory: retry transient failures once, classify residuals | `retry transient failures ONCE` |

## B. pt-* agent definitions (5 changes across 9 files)

| ID | Files | Anchor | What was added | Verify grep |
|----|-------|--------|----------------|-------------|
| W1 | all 9 `pt-*.md` | The `shutdown_request` bullet ("Reply once with…and terminate.") | Appended: reply ONLY with the structured response, never plain-text ack (leaves worker idle-alive/ambiguous) | `never a plain-text acknowledgment` |
| W2 | all 9 `pt-*.md` | Under `## Communication` (first bullet or heading — wording varies per file) | New bullet: `summary` field must be literal prose composed before the call, never `$1`-style placeholders | `literal prose composed before the call` |
| W3 | all 9 `pt-*.md` | The completion-report write step under "On completion" (numbering/wording varies: step 1 in 3 files, step 2 in 6 files) | Appended: every acceptance criterion proven by verbatim command + output or marked NOT-VERIFIED with reason | `NOT-VERIFIED with a reason` |
| W4 | `pt-backend-eng` `pt-frontend-eng` `pt-data-schema` `pt-fullstack-impl` | After "**Non-breaking turning points**: Document…and continue." | `**Deviation-with-evidence duty**` block: STOP on contradicted assignment, document X/Y/Z with evidence, PLAN-APPROVAL if breaking, deviations-table if not, never silently improvise | `Deviation-with-evidence duty` |
| W5 | `pt-test-quality.md` | After the last Role Mindset bullet | `**Test-integrity rules (non-negotiable):**` — never modify source to pass, never loosen assertions (fix fixtures), classify every failure BUG/TEST-ENV/FLAKE, deterministic inputs + cleanup, test the contract not the implementation | `Test-integrity rules` |

## Replication notes

- Agent-file edits were applied with anchored `perl -pi -e` substitutions because the 9 files
  share a template with minor per-role wording drift — three files needed per-file anchors for
  W3 (`pt-data-schema`, `pt-devops-infra`, `pt-docs-integration`, `pt-research-arch`,
  `pt-test-quality`, `pt-general` each have role-specific completion-step text).
- If regenerating agent files from a template: apply W1–W3 to the template once; W4 only to the
  four implementation roles; W5 only to test-quality.
- All anchors chosen are stable protocol sentences unlikely to be reworded; if an anchor is
  missing after a skill update, re-place the addition at the equivalent protocol point (the
  table's "What was added" column is self-contained).

## C. Bundle sync (`skills/planify-team/bundle/`) — 2026-07-10

The bundle is the skill's installer payload (`bash bundle/install.sh` from a project root installs
agents/, hooks/, commands/, patches settings.json, and copies skill-root `.md` files). After the 16
improvements it was re-synced so fresh installs carry them:

| Bundle component | Action | Detail |
|---|---|---|
| `bundle/agents/pt-*.md` (9 files) | **RE-SYNCED** — copied from installed `.claude/agents/` | All differed pre-sync (W1–W5 lived only in installed copies). Post-sync: `diff -q` clean ×9 AND the W1–W5 verification greps pass against the bundle itself. |
| `bundle/hooks/pt-validate-completion.sh` | UNCHANGED — verified identical | `diff` empty; no improvement touched hooks. |
| `bundle/commands/planify-team-setup.md` | UNCHANGED — verified identical | `diff` empty; no improvement touched the command. |
| `bundle/install.sh` | **ONE PATCH** — line 108 | Copy logic needed NO change (agents copied by `pt-*.md` glob; skill-root files by `find -maxdepth 1 -name "*.md"` glob, which automatically covers the NEW `release-protocol.md`). BUT the post-install verification asserted **exactly 9** skill satellite files — now 10 with release-protocol.md. Patched `-eq 9` → `-eq 10` (and the failure message). Without this, every fresh install would report a false verification failure. |

**Why install.sh copy-logic is change-proof here**: every copy is glob- or directory-based, no
per-file lists. Only its verification section pins counts — re-check that section (lines ~104-115)
whenever a skill-root `.md` file is added or removed.

**Portability note (S1)**: SKILL.md Phase 0 step 3 loads `development/orchestration-learnings/`
**conditionally** ("if it exists"), so installing the bundle into a project without a learnings dir
degrades gracefully. To carry the learnings to another project, copy
`development/orchestration-learnings/` alongside the install — it is intentionally NOT part of the
bundle (project-workspace content, not skill payload).

**Bundle verification one-liner**:
```bash
cd .claude/skills/planify-team/bundle && \
for f in agents/pt-*.md; do diff -q "$f" "../../../agents/$(basename $f)" || echo "DRIFT: $f"; done; \
grep -c "eq 10" install.sh   # expect 1
```

## Applied-status ledger

S1 ✅ (2026-07-10, user-approved wiring) · S2–S11 ✅ (2026-07-10, user instructed "apply all") ·
W1–W5 ✅ (same) · Bundle re-sync + install.sh count patch ✅ (2026-07-10). Zero pending items from
04-skill-improvement-suggestions.md.
