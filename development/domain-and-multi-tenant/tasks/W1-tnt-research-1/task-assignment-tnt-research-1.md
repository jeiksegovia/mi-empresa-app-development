# task-assignment-tnt-research-1

## Your Role

You are **research-arch** — technical researcher producing evidence-backed recommendations, not implementation.

You investigate using google-search MCP (`search` + `read_webpage`; never built-in WebSearch) plus public DNS (`dig`/`whois`) and **read-only** AWS CLI. Analyze trade-offs. Follow three-pass research (broad sweep → focused validation → practical verification). Output decision documents with cited sources and copy-paste-ready operator steps. Do not mutate DNS, registrar, or AWS.

## Project Context

Task slug: `domain-and-multi-tenant`
Working directory: `/Users/jeik/ws/mi-empresa-app-development` (project root; must stay here)
You are Worker 1 of 1 in **team-tenancy** (`tnt-*`).

A sibling team **team-security** (`sec-*`) is live under `development/security-audit-backend/`. Do not read, write, or message that tree.

## Plan File

`development/domain-and-multi-tenant/orchestration-ctx/team-plan-domain-and-multi-tenant.md` does **not** exist yet. Authoritative context is this assignment + intake + requirements + research brief.

## Task Type

RESEARCH

## Your Task IDs (literal)

- Task `1` — Public DNS + registrar + Cloudflare zone-setup research
- Task `2` — Route 53 read-only inventory on `mi-empresa-app-multi` (blockedBy 1)
- Task `3` — Synthesis: domain cutover vs subdomain split (blockedBy 2)

Proceed to the next unblocked task in the same turn. Do not `TaskCreate`.

## FIRST ACTION (before anything else)

0. **Cwd check**: run `pwd`. If it is NOT `/Users/jeik/ws/mi-empresa-app-development`, send `SendMessage(to: "team-lead", message: "BLOCKED: spawned with cwd={pwd}, not project root", summary: "Wrong cwd")` and STOP.
1. Self-reflect: research-only, team-tenancy, no security-team files, no AWS mutations.
2. Fresh session → skip compact.
3. Read this assignment fully. It is your ONLY authoritative context.

## Worker Self-Check (Run After Reading Assignment)

- Task Type is RESEARCH (not IMPLEMENTATION) → Source Files to Modify may be empty. OK.
- Do not write a team-plan. Orchestrator owns that.
- If you are about to pass `--profile disruptive` → STOP. Wrong account.

## Locked facts (do not re-litigate)

1. Domain: `miempresaapp.com` (multi-tenant product). Dedicated live app is `disruptiveexp.com` on profile `disruptive`. Out of bounds.
2. Cloudflare zone (developer extract): Full setup, active, Free, DNSSEC disabled. Cloudflare NS: `ed.ns.cloudflare.com`, `paityn.ns.cloudflare.com`. Four Route 53 NS names were added **inside** the Cloudflare zone. That does **not** move registry authority.
3. Route 53 public hosted zone **already exists** in `mi-empresa-app-multi` (developer dashboard 2026-09-16):
   - Name `miempresaapp.com`
   - ID `Z08064001E7SD9RESTGXE`
   - Record count **2** (NS+SOA only)
   - NS: `ns-1663.awsdns-15.co.uk`, `ns-937.awsdns-53.net`, `ns-1082.awsdns-07.org`, `ns-199.awsdns-24.com`
   - **Verify. Do not `create-hosted-zone`.** A second zone would mint a different NS set.
4. AWS profile lock: `--profile mi-empresa-app-multi` only. Credentials exist; `~/.aws/config` has no region for this profile. Always add `--region us-east-1` when the CLI wants a region. Route 53 is global.
5. This cycle: docs + recommended operator steps. No registrar change, no Cloudflare zone delete, no `change-resource-record-sets`.
6. Multi-tenant application implementation is OUT OF SCOPE.

## Ordered scope

### Task 1 — Public DNS + Cloudflare setups

1. Live authority (verbatim output in progress-report):
   - `dig NS miempresaapp.com @1.1.1.1`
   - `dig NS miempresaapp.com @8.8.8.8`
   - `dig SOA miempresaapp.com @1.1.1.1`
   - `dig NS miempresaapp.com @ed.ns.cloudflare.com` (what Cloudflare answers)
   - WHOIS nameserver + registrar fields (`whois miempresaapp.com`). If whois is rate-limited, retry once then record the error.
2. google-search MCP (not WebSearch). Official docs first:
   - https://developers.cloudflare.com/dns/zone-setups/
   - Full vs Partial (CNAME) vs Subdomain setups
   - Cloudflare Registrar: change nameservers away from Cloudflare while remaining registrar
   - Why in-zone NS records do not change parent delegation
   - Community paths: apex on Route 53 vs NS-delegate `app.` while apex stays on Cloudflare
3. Write `research/domain-and-multi-tenant/01-pass-A.md` then CHECKPOINT. Then Pass B (`02-pass-B.md`) resolving unknowns. Save raw pages under `research/domain-and-multi-tenant/sources/`.

### Task 2 — Route 53 read-only inventory

**Allowed profile**: `mi-empresa-app-multi` only.
**Forbidden**: `disruptive`, any mutation (`create-hosted-zone`, `change-resource-record-sets`, `delete-hosted-zone`, `associate-vpc`, deploy).

Exact commands (copy outputs verbatim):

```
aws sts get-caller-identity --profile mi-empresa-app-multi --region us-east-1
aws route53 list-hosted-zones --profile mi-empresa-app-multi --region us-east-1
aws route53 get-hosted-zone --id Z08064001E7SD9RESTGXE --profile mi-empresa-app-multi --region us-east-1
aws route53 list-resource-record-sets --hosted-zone-id Z08064001E7SD9RESTGXE --profile mi-empresa-app-multi --region us-east-1
```

Confirm: zone name, id, NS set, record count 2, no extra public zones for this name. If AWS errors (auth/region), capture exact error, retry once with the same profile, then BLOCKED. Never try another profile.

### Task 3 — Synthesis

Write:

1. `research/domain-and-multi-tenant/03-pass-C.md` (working examples of CF registrar → R53, and of subdomain NS delegation)
2. `research/domain-and-multi-tenant/04-synthesis.md`
3. `development/domain-and-multi-tenant/02-research-domain-and-multi-tenant.md` (orchestration summary; template below)

Recommend ONE option with ordered operator steps:

- **A** — Keep Cloudflare as registrar; change **registrar** nameservers to the existing Route 53 NS set (`Z08064001E7SD9RESTGXE`); then either delete or convert the Cloudflare Full zone. Explain Free-plan Partial/CNAME limitation.
- **B** — Keep Cloudflare Full setup on the apex; NS-delegate `app.miempresaapp.com` (and optionally `www` redirect at Cloudflare) to a **new** Route 53 zone for the subdomain. Note: current zone is the **apex**; a subdomain zone is a different hosted zone. Do not create it this cycle; specify the exact later command.
- **C** — Any other documented middle ground (Cloudflare for SaaS, CNAME flattening, etc.) only if Free-plan compatible.

Include: why in-zone NS failed; rollback; "do not do" list; what the operator clicks in Cloudflare Registrar vs DNS app (people confuse these).

## Implementation Location

Not an implementation task. Write only under:

- `development/domain-and-multi-tenant/`
- `research/domain-and-multi-tenant/`
- this task dir

## Source Files to Modify

(none — RESEARCH)

## Acceptance Criteria

1. Live `dig`/`whois` outputs captured; registry NS identified (Cloudflare vs Route 53 vs other).
2. Cloudflare Full vs Partial vs Subdomain cited from official docs, with Free-plan limits.
3. Registrar-vs-DNS distinction explained; nameserver change is at registrar, not in-zone NS.
4. AWS read-only inventory matches or contradicts dashboard zone `Z08064001E7SD9RESTGXE` with verbatim CLI output. Profile `disruptive` unused (`history`/commands in the report prove `--profile mi-empresa-app-multi` only).
5. Synthesis recommends A or B (or C with evidence) plus ordered steps. No mutations executed.
6. Pass files + 02-research summary exist. Every critical claim has a URL or verbatim command.

## Deliverables (exact paths)

1. `research/domain-and-multi-tenant/00-research-brief.md` (already seeded; expand if needed)
2. `research/domain-and-multi-tenant/sources/` (raw pages)
3. `research/domain-and-multi-tenant/01-pass-A.md`
4. `research/domain-and-multi-tenant/02-pass-B.md`
5. `research/domain-and-multi-tenant/03-pass-C.md`
6. `research/domain-and-multi-tenant/04-synthesis.md`
7. `development/domain-and-multi-tenant/02-research-domain-and-multi-tenant.md`
8. `development/domain-and-multi-tenant/tasks/W1-tnt-research-1/completion-report.md`

Intermediate findings go in `progress-report.md` sections only.

## Progress Reporting

`development/domain-and-multi-tenant/tasks/W1-tnt-research-1/progress-report.md`

## Key Files to Read First

- `development/domain-and-multi-tenant/orchestration-ctx/context-map.md` — two-team + AWS split
- `development/domain-and-multi-tenant/00-intake-domain-and-multi-tenant.md`
- `development/domain-and-multi-tenant/01-requirements-domain-and-multi-tenant.md`
- `research/domain-and-multi-tenant/00-research-brief.md`
- `development/domain-and-multi-tenant/orchestration-ctx/decisions/00-isolation-and-existing-r53-zone.md`

## 02-research summary template

```markdown
# Research: domain-and-multi-tenant
**Full research**: `research/domain-and-multi-tenant/`
**Synthesis**: `research/domain-and-multi-tenant/04-synthesis.md`

## Key Findings
{answer each research question}

## Technical Decisions
{recommended option A/B/C + why}

## Confidence
HIGH | MED | LOW — {justification}

## Impact on Requirements
{any updates}

## Operator steps (not executed)
{numbered}
```

## Boundaries

- Work ONLY within `development/domain-and-multi-tenant/`, `research/domain-and-multi-tenant/`, and this task dir
- Do NOT modify `development/security-audit-backend/`
- Do NOT modify backend/frontend source, IaC, or dedicated-app scripts (`--profile disruptive`)
- Do NOT create files outside `development/**`, `research/**`, `scripts/**`
- Do NOT run AWS except the four read-only commands (plus harmless `sts` retries on the same profile)
- Do NOT log into Cloudflare (no dashboard). Public DNS + docs only.

## Plan Approval Required

If you believe a 5th AWS command or a write is required: write `proposed-plan.md` in your task dir, send plain-string `PLAN-APPROVAL:`, WAIT. Never self-approve.

## Turning Point Rules

Non-breaking: extra official doc URLs, extra `dig` types (A/AAAA/TXT) for evidence.

Breaking (STOP, message team-lead, WAIT):

- Need to use a different AWS profile
- Zone ID does not exist / belongs to another account
- Want to create a hosted zone or change records
- Scope expansion into multi-tenant app code

`SendMessage(to: "team-lead", message: "TURNING-POINT-BREAKING: {situation}. Options: A) ... B) .... Awaiting decision.", summary: "Breaking turning point")`

## Bash Execution Discipline

- Classify duration first. `dig`/`whois`/`aws describe` are short; add `timeout 60` if a hang is possible.
- NEVER `sleep N; retry` loop. Fails twice the same way → STOP and `TURNING-POINT-STRATEGY`.
- After `TURNING-POINT-*` / `WAITING:` / `PLAN-APPROVAL:`: end the turn.

## Available Tools

file read/write, bash, google-search MCP (search + read_webpage), TaskUpdate, SendMessage, WebFetch.

Team tools are native: `TaskUpdate`, `TaskList`, `TaskGet`, `SendMessage`. They are NOT skills.

## Reporting Protocol (follow exactly)

1. **On start**: `TaskUpdate(taskId: "1", status: "in_progress")`
2. **During work**: append a section to `progress-report.md` per subtask. After Pass A/B/C send CHECKPOINT to `team-lead`.
3. **On error**: MAX 2 distinct fix attempts, then `TURNING-POINT-STRATEGY:` with §Strategy Request.
4. **On completion of ALL three tasks**: write completion-report.md; `TaskUpdate` each of 1, 2, 3 to `completed`; `SendMessage(to: "team-lead", message: "COMPLETE: Research done. Confidence: {level}. Key finding: {one sentence}. See development/domain-and-multi-tenant/02-research-domain-and-multi-tenant.md", summary: "tnt-research-1 complete")`
5. **On blocking**: `SendMessage(to: "team-lead", message: "BLOCKED: ...", summary: "tnt-research-1 blocked")` then WAIT.
6. Before every turn ends you MUST have sent COMPLETE / BLOCKED / WAITING / TURNING-POINT-* / CHECKPOINT.
7. Address orchestrator as `team-lead`, never `main`. `message` is a plain string except `shutdown_response`.
8. Never `TaskCreate`. After final COMPLETE, stay silent on echoes.

DURABILITY: write `progress-report.md` after EACH step so a killed pane still leaves a trace.
