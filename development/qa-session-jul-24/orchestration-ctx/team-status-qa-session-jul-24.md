# Team Status: qa-session-jul-24

Updated: 2026-07-31 (session start)

## Worker Roster
| Worker | Role | State | Current task |
|--------|------|-------|--------------|
| worker-1 | pt-data-schema | SHUTDOWN (task 1 done, verified) | 1 |
| worker-2 | pt-backend-eng | SHUTDOWN (2,3,4 done, verified: 6 src + 3 new specs, 67 pass) | 2,3,4 |
| worker-3 | pt-frontend-eng | SHUTDOWN (5,6 done, verified: 4 pages + 3 specs) | 5,6 |
| worker-rel1 | pt-devops-infra | SHUTDOWN (task 7 done — staging LIVE, verified) | 7 |

## Tasks
| ID | Owner | Title | State | blockedBy |
|----|-------|-------|-------|-----------|
| 1 | worker-1 | Schema + cargos migration + contract doc | pending | — |
| 2 | worker-2 | Employee partial-edit + RBAC + Nequi | pending | 1 |
| 3 | worker-2 | Asistencia RBAC + note | pending | 2 |
| 4 | worker-2 | Contract valorMensual + nómina branch | pending | 3 |
| 5 | worker-3 | Payment UI + remove cargos + preview | pending | 1 |
| 6 | worker-3 | Contract field + asistencia UI | pending | 5 |

## Decisions
- D1 cargos: delete+recreate. D2 salary: add valorMensual + branch. D3 Cargo model: hide UI only.
  D4 env: local now, staging deploy gated.

## Staging release (W4, task 7)
- User chose staging deploy (gated). qa_jul24 migration is DESTRUCTIVE on staging (delete+recreate
  cargos, repoint all contratos→Temporal). Plan: pt-devops-infra R0–R5, STOP after read-only R0
  (row counts) for go/no-go before the migration. Migrations gitignored → ship in CodeDeploy artifact.
- Anomaly resolved: HEAD moved f6503d7→d2e21ad = USER committed jul-22 backlog out-of-band (not a worker).
- W4 spawn FAILED (tmux pty exhaustion: 87 panes/85 claude procs, mostly stale other-session workers).
  Shut down parked W1/W2/W3; respawned release worker under fresh name **worker-rel1** (collision guard) — RUNNING R0.

## Log
- Session start: plan approved, 6 tasks created, wave-1 W1 spawning.
- Wave 2 complete + validated. W1/W2/W3 shutdown_request sent (free resources for W4).
- W1 TURNING-POINT-BREAKING: local DB QA-fixture — 1 cargo 'Auxiliar QA' (id 42), all 24 contratos ref it.
  Decision (decisions/cargos-fk-reassignment.md): full delete+recreate, reassign ALL contratos to
  fallback 'Temporal'. W1 unblocked via NEW-APPROACH. Working enum+valorMensual+cargos migration.
