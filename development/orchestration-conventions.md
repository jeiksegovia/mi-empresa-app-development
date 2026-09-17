# Orchestration ↔ context/ wiring conventions

> Standing project convention. How planify-team orchestration (`development/{slug}/`) integrates
> with the existing plain-form `context/` structure. Read this before starting or resuming any
> orchestration cycle in this repo. Portable orchestration lessons live in
> `development/orchestration-learnings/`; this file is the project-specific glue.

## Active teams (concurrent orchestration)

Two orchestration teams run against this repo at the same time. To keep task namespaces and
tmux worker panes from colliding, each team owns a distinct slug and a worker-name prefix. Never
address or shut down a worker outside your own prefix.

| Team | Slug | Worker prefix | Charter |
|---|---|---|---|
| **team-security** | `security-audit-backend` | `sec-*` | Backend + infra + comms + frontend security audit (this cycle) |
| **team-tenancy** | `domain-and-multi-tenant` | `tnt-*` | Domain model + multi-tenant work (separate orchestrator) |

Rules for coexistence:
- Spawn workers only under your team's prefix (`sec-devops-1`, `sec-code-1`, ...). Do not reuse a
  bare `worker-N` name that the other team might also pick.
- `TaskList` may show both teams' tasks. Filter by your `[W..]`/prefix; never `TaskUpdate` or
  `TaskStop` a row you do not own.
- Both orchestrators address themselves as `team-lead` in their own worker prompts; a worker only
  ever messages its own `team-lead`.
- Shared source files: if both teams must touch the same file (e.g. middleware, prisma schema),
  route it through a decision record and sequence it — do not edit concurrently.

## Principle

Orchestration format is the **working** surface (intake, requirements, plan, worker tasks,
decisions). The `context/` tree is the **canonical, human-readable** surface the developer already
uses. Every orchestration cycle produces its working artifacts under `development/{slug}/` AND
leaves a thin pointer / distilled record in the matching `context/` location so nothing the
developer relies on moves or breaks.

## Mapping table

| Concern | Orchestration (working) | context/ (canonical) | Direction |
|---|---|---|---|
| Feature / cycle plan | `development/{slug}/{slug}-plan.md` | `context/implementation-plan/{slug}-plan.md` (pointer) | orchestrator writes plan → drops pointer |
| Raw user feedback | (input only) | `context/user-feedback/{qa-session}-raw.md` | developer writes raw → orchestrator reads |
| Distilled feedback | `development/{slug}/00-intake-{slug}.md` (Objective/Constraints) | `context/user-feedback/{...}-cleaned.md` (optional) | orchestrator extracts raw → intake |
| Implemented summary | `development/{slug}/06-handoff.md` | `context/plan-implemented/{slug}-implemented.md` | orchestrator writes handoff → distills to context |
| Prod release runbook | (referenced) | `context/implementation-plan/prod-release/YYYY-MM-DD-{slug}.md` | ONE dated file per prod drop (existing rule) |
| Session re-anchor | `development/{slug}/resume/session-*-reanchor.md` (full fidelity) | `context/resume-session/summary-YYYY-MM-DD-{slug}.md` (pointer) | reanchor → pointer in resume-session/ |
| Context index for a cycle | `development/{slug}/orchestration-ctx/context-map.md` | — | lists the context/ files this cycle depends on |

## Rules

1. **Plan pointer**: after writing `development/{slug}/{slug}-plan.md`, create
   `context/implementation-plan/{slug}-plan.md` as a short pointer (one paragraph + link). The
   detailed plan does not get duplicated into context/ — the pointer references it.

2. **Feedback flow**: the developer keeps adding raw feedback under `context/user-feedback/`
   (unchanged habit). The orchestrator READS raw feedback and EXTRACTS only what a cycle needs into
   `development/{slug}/00-intake-{slug}.md`. Never edit the developer's raw feedback files.

3. **Prod releases**: unchanged from the established rule — every prod app drop is exactly ONE
   dated file in `context/implementation-plan/prod-release/`, with commands, actuals, learnings,
   stack state. Orchestration never creates a new `pN-*.md` per drop. See
   `context/implementation-plan/prod-release/00-overview.md`.

4. **Re-anchor / resume**: full-fidelity handoff for a resumed orchestration session lives at
   `development/{slug}/resume/session-{n}-reanchor.md` (written by `/planify-reanchor`). A thin
   pointer for the whole-project resume habit goes to
   `context/resume-session/summary-YYYY-MM-DD-{slug}.md`, and the newest such file is what the
   memory index (`resume-session-summaries`) points at. Prod-specific re-anchors stay under
   `context/implementation-plan/prod-release/` as they do today.

5. **orchestration-ctx references context/**: each cycle's
   `orchestration-ctx/context-map.md` enumerates the `context/` files that cycle reads or updates,
   so a resumed session finds the canonical sources without re-deriving them.

6. **Reporting style**: cycle-level summaries follow the plain, scannable style proven in
   `context/implementation-plan/prod-release/summary-2026-09-16-resume.md` and
   `context/resume-session/summary-2026-09-16-prod-release.md` — bootstrap, hard rules, live
   IDs/endpoints, learnings, grep hooks. Optimize summaries for `grep`.

## Do-not

- Do not move or rename existing `context/` files.
- Do not duplicate a full plan into both trees — `development/` holds detail, `context/` holds the pointer.
- Do not put project-deliverable plans inside `orchestration-ctx/` (that dir is coordination-only).
