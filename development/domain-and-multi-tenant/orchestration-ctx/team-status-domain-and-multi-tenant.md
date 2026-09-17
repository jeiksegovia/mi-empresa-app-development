# Team Status: domain-and-multi-tenant

**Team**: team-tenancy (`tnt-*`) · **Phase**: 4 Converged (DNS v1 live) ·
**Next**: later Amplify on `www` / platform records on `app` in a new cycle. Coexists with team-security (`sec-*`).

_Updated: 2026-09-16 19:25_

## Workers

| Worker | Role | Current Task | Status | Last Report |
|--------|------|-------------|--------|-------------|
| W1 | research-arch | tnt-research-1 (#1-#3) | PARKED | COMPLETE Option B HIGH |
| W2 | devops-infra | tnt-dns-2 (#4-#6) | SHUTDOWN (pane gone after COMPLETE) | completion-report.md |

## Worker Roster (source of truth — orchestrator re-reads on every wake)

| Name | Role | State | Started | Last active | Prior tasks | Reuse eligible |
|------|------|-------|---------|-------------|-------------|----------------|
| tnt-research-1 | pt-research-arch | PARKED | 2026-09-16 18:45 | COMPLETE | #1,#2,#3 | yes (research only) |
| tnt-dns-1 | pt-devops-infra | SHUTDOWN | 2026-09-16 19:12 | PLAN-APPROVAL then died | proposed-plan.md | no |
| tnt-dns-2 | pt-devops-infra | SHUTDOWN | 2026-09-16 19:20 | COMPLETE then dummy shutdown; pane gone | #4,#5,#6 | no (dead) |

## Tasks (authoritative ledger)

| ID | Title | Owner | Status | Blocked By | Points |
|----|-------|--------|--------|------------|--------|
| 1 | [tnt-W1] Public DNS + registrar + Cloudflare zone-setup research | tnt-research-1 | completed | - | 5 |
| 2 | [tnt-W1] Route 53 read-only inventory on mi-empresa-app-multi | tnt-research-1 | completed | 1 | 3 |
| 3 | [tnt-W1] Synthesis: domain cutover vs subdomain split | tnt-research-1 | completed | 2 | 5 |
| 4 | [tnt-W2] Create Route 53 child zones app. and www. | tnt-dns-2 | completed | - | 5 |
| 5 | [tnt-W2] Cloudflare NS-delegate app. and www. | tnt-dns-2 | completed | 4 | 5 |
| 6 | [tnt-W2] Verify child-zone delegation with dig | tnt-dns-2 | completed | 5 | 3 |

TaskList namespace may be empty. Durable key = this table + task dirs.

## Decisions Made

- Isolation: `tnt-*` / `mi-empresa-app-multi` only.
- A-strict not offered (CF Registrar). Transfer-out ~2026-11-10.
- Keep apex `Z08064001E7SD9RESTGXE`.
- v1: `app.` platform + `www.` marketing as **separate** child zones.
- `06-approve-app-www-dns-plan.md` PROCEED executed by tnt-dns-2.
- Child IDs: `05-child-zone-ids.md`.

## Watch items

- (none open). Lead re-ran verify.sh PASS=9 FAIL=0.

## Active Issues

- (none)

## Phase

Converged. DNS v1 live. No further mutations this cycle.

## Log

- 2026-09-16: research COMPLETE Option B. Developer picked app=platform, www=marketing, DNS-only.
- 2026-09-16 19:12: tnt-dns-1 PLAN-APPROVAL then LOST. Respawned tnt-dns-2 with gate cleared.
- 2026-09-16 19:12–19:25: tnt-dns-2 created `Z04792861CQBYDQH6TXG9` (app) and `Z04792813FUVIP6WX8WTN` (www), eight CF NS records, verify.sh 9/9. Dummy shutdown after COMPLETE; pane gone. Lead independently verified. Cycle done.
