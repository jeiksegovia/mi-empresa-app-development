# task-assignment-tnt-dns-1

## Your Role

You are **devops-infra** — infrastructure specialist. Reproducible AWS + Cloudflare DNS only. Principle of least privilege. Never mutate dedicated/prod (`disruptive`). Flag any command that is not on the allowed list and wait.

You are **not** deploying Amplify, a webpage, or any service. Pure DNS: two child hosted zones + Cloudflare NS delegation + `dig` proof.

## Project Context

Task slug: `domain-and-multi-tenant`
Working directory: `/Users/jeik/ws/mi-empresa-app-development`
You are Worker 2 of team-tenancy (`tnt-*`). Sibling **team-security** (`sec-*`) is out of bounds.

`tnt-research-1` is PARKED after research COMPLETE. Do not message them. Do not reuse their name.

## Plan File

`development/domain-and-multi-tenant/orchestration-ctx/team-plan-domain-and-multi-tenant.md`

## Task Type

IMPLEMENTATION (infra DNS only)

## Your Task IDs (literal)

- Task `4` — Create Route 53 child zones `app.` and `www.`
- Task `5` — Cloudflare NS-delegate `app.` and `www.` (blockedBy 4)
- Task `6` — Verify with `dig` + `scripts/miempresaapp-dns/verify.sh` (blockedBy 5)

Proceed to the next unblocked task in the same turn. Do not `TaskCreate`.

## FIRST ACTION

0. `pwd` must be `/Users/jeik/ws/mi-empresa-app-development`. Else BLOCKED.
1. Self-reflect: team-tenancy DNS only. Profile `mi-empresa-app-multi` only.
2. Fresh for this assignment. Skip compact unless you somehow have unrelated context.
3. Read this file fully, then the Key Files list.

## Worker Self-Check

- Source Files to Modify is non-empty (reports + verify.sh). OK.
- If about to `--profile disruptive` → STOP.
- If about to `create-hosted-zone --name miempresaapp.com` (apex) → STOP. That zone exists.

## Locked facts

1. Developer go 2026-09-16: Option B with **two** child names:
   - `app.miempresaapp.com` = platform / all app flow
   - `www.miempresaapp.com` = marketing / main website (NOT a redirect to app)
2. Apex stays Cloudflare Registrar + Full DNS. A-strict is not offered.
3. Apex R53 zone **exists**: `Z08064001E7SD9RESTGXE` / NS `ns-1663`, `ns-937`, `ns-1082`, `ns-199` / records=2. **Do not recreate. Do not delete. Do not put app/www records in it.**
4. AWS: `--profile mi-empresa-app-multi --region us-east-1` only. Account `613538400064`.
5. Cloudflare token: `CLOUDFLARE_API_TOKEN` in gitignored `development/domain-and-multi-tenant/.env`. Purpose `edit-dns-zone`. **Never print the token.** Source the file; use `${CLOUDFLARE_API_TOKEN}`.
6. No Amplify, no demo page, no CloudFront, no ACM request, no registrar transfer.
7. No apex/`www` HTTP redirect to `app`.

## Ordered scope

### Gate (CLEARED 2026-09-16 — do not wait)

`proposed-plan.md` was reviewed and **APPROVED / PROCEED** by team-lead (`orchestration-ctx/decisions/06-approve-app-www-dns-plan.md`).

If you are `tnt-dns-2` (replacement): **do not re-send PLAN-APPROVAL**. Skip the wait. Execute Task 4 now (idempotent: if a child zone already exists, reuse it). Then 5, then 6.

Original gate text kept for history only. Do not recreate it.

Pre-plan evidence to include (read-only, allowed immediately):

```
aws sts get-caller-identity --profile mi-empresa-app-multi --region us-east-1
aws route53 list-hosted-zones --profile mi-empresa-app-multi --region us-east-1
```

Cloudflare zone id lookup (read-only GET, allowed immediately after sourcing .env):

```
set -a && source development/domain-and-multi-tenant/.env && set +a
curl -sS "https://api.cloudflare.com/client/v4/zones?name=miempresaapp.com" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json"
```

Do not log the Authorization header. Redact token in all files.

### Task 4 — create child zones (after PROCEED)

Idempotent: if a public zone named `app.miempresaapp.com.` or `www.miempresaapp.com.` already exists, **do not create a second**. Use the existing Id.

```
aws route53 create-hosted-zone \
  --name app.miempresaapp.com \
  --caller-reference "app-miempresaapp-<unique>" \
  --hosted-zone-config Comment="multi-tenant platform subdomain",PrivateZone=false \
  --profile mi-empresa-app-multi --region us-east-1

aws route53 create-hosted-zone \
  --name www.miempresaapp.com \
  --caller-reference "www-miempresaapp-<unique>" \
  --hosted-zone-config Comment="marketing www subdomain",PrivateZone=false \
  --profile mi-empresa-app-multi --region us-east-1
```

Save each HostedZone Id + DelegationSet NameServers to progress-report.md **and** `development/domain-and-multi-tenant/orchestration-ctx/decisions/05-child-zone-ids.md` (ids + NS only, no secrets).

Confirm `list-hosted-zones` shows exactly three public zones: apex + app + www. If a fourth apex appears, BLOCKED immediately (do not continue Task 5).

### Task 5 — Cloudflare NS records (after 4)

For each of `app` and `www`, upsert **four** DNS records:

- type: `NS`
- name: `app` or `www` (relative to `miempresaapp.com`)
- content: one Route 53 nameserver **without** confusing proxied flag (NS cannot be proxied; `proxied: false`)
- ttl: 86400 or Cloudflare minimum for NS

Use Cloudflare API (zone DNS records). Before POST: GET existing NS for `app`/`www`. If four correct NS already exist, skip. If wrong NS exist, PLAN-APPROVAL before delete/replace.

Do **not**:
- change registrar nameservers
- delete the Cloudflare zone
- add A/AAAA/CNAME for apex or www to dummy IPs
- add Page Rules / Redirects
- put Route 53 apex NS (`ns-199` etc.) as the child NS

### Task 6 — verify

Write `scripts/miempresaapp-dns/verify.sh` (bash, executable) that:

1. Queries `dig NS miempresaapp.com @a.gtld-servers.net +norecurse` and asserts only Cloudflare NS
2. Queries `dig NS app.miempresaapp.com @1.1.1.1` and `@ed.ns.cloudflare.com` and asserts the four **app** R53 NS
3. Same for `www.miempresaapp.com` vs **www** R53 NS
4. Queries one nameserver from each child DelegationSet with `+norecurse` and asserts `aa` + matching NS
5. Exits 0 on pass, non-zero on fail; prints expected vs got
6. Reads zone NS from `development/domain-and-multi-tenant/orchestration-ctx/decisions/05-child-zone-ids.md` or env vars `APP_NS` / `WWW_NS` — do not hardcode wrong apex NS

DNS can lag. Retry a failed dig **once** with a short timeout, then record actual TTL/answer. If CF aa already has the NS but 1.1.1.1 is stale, document that as MED confidence + still pass if authoritative CF + R53 aa match.

Also run the script yourself; paste output in progress-report.md.

## Source Files to Modify

- `development/domain-and-multi-tenant/tasks/W2-tnt-dns-1/proposed-plan.md` — create
- `development/domain-and-multi-tenant/tasks/W2-tnt-dns-1/progress-report.md` — create/append
- `development/domain-and-multi-tenant/tasks/W2-tnt-dns-1/completion-report.md` — create
- `development/domain-and-multi-tenant/orchestration-ctx/decisions/05-child-zone-ids.md` — create
- `scripts/miempresaapp-dns/verify.sh` — create
- `scripts/miempresaapp-dns/README.md` — 10-line how to run verify (no secrets)

## Acceptance Criteria

1. Exactly one apex zone `Z08064001E7SD9RESTGXE` remains; plus new `app.` and `www.` zones. Three public zones total.
2. `app.` DelegationSet NS ≠ apex NS set. `www.` DelegationSet NS ≠ apex NS set. (They may differ from each other; that is expected.)
3. Cloudflare DNS has four NS for `app` matching the app zone, four NS for `www` matching the www zone. Apex registrar NS unchanged (WHOIS still Cloudflare).
4. `scripts/miempresaapp-dns/verify.sh` exists and was run; output in progress-report.
5. Token never appears in any written file. Profile `disruptive` unused.
6. No Amplify/app/CloudFront/ACM created.

## Deliverables

1. `development/domain-and-multi-tenant/orchestration-ctx/decisions/05-child-zone-ids.md`
2. `scripts/miempresaapp-dns/verify.sh`
3. `scripts/miempresaapp-dns/README.md`
4. `development/domain-and-multi-tenant/tasks/W2-tnt-dns-1/completion-report.md`

## Progress Reporting

`development/domain-and-multi-tenant/tasks/W2-tnt-dns-1/progress-report.md`

## Key Files to Read First

- `development/domain-and-multi-tenant/orchestration-ctx/decisions/04-v1-app-and-www-child-zones.md`
- `development/domain-and-multi-tenant/orchestration-ctx/decisions/02-r53-zone-verified.md`
- `development/domain-and-multi-tenant/orchestration-ctx/team-plan-domain-and-multi-tenant.md`
- `research/domain-and-multi-tenant/04-synthesis.md` (Option B steps; ignore "one app zone only" — developer added www as a second child)
- `development/domain-and-multi-tenant/orchestration-ctx/context-map.md`

## Boundaries

- Work ONLY within `development/domain-and-multi-tenant/`, `research/domain-and-multi-tenant/`, `scripts/miempresaapp-dns/`
- Do NOT modify `development/security-audit-backend/`
- Do NOT modify backend/frontend source or dedicated IaC
- Do NOT use `--profile disruptive`
- Do NOT transfer the domain or change registrar NS
- After PLAN-APPROVAL: end the turn. After TURNING-POINT: end the turn.

## Bash Execution Discipline

- Classify duration. AWS/CF API: `timeout 60`.
- NEVER `sleep N; retry` loop. Fails twice same way → TURNING-POINT-STRATEGY.
- Do not print `CLOUDFLARE_API_TOKEN`. `set +x` before curl with Authorization.

## Plan Approval Required

See Gate above. Never self-approve. Plain-string `PLAN-APPROVAL:` only.

## Turning Point Rules

Breaking: extra AWS profile, second apex zone, CF zone delete, Amplify create, token leak, AccessDenied after 2 tries.

`SendMessage(to: "team-lead", message: "TURNING-POINT-BREAKING: ...", summary: "Breaking turning point")`

## Reporting Protocol

1. On start: `TaskUpdate(taskId: "4", status: "in_progress")`
2. After each subtask: append progress-report.md section.
3. MAX 2 self-repairs then TURNING-POINT-STRATEGY.
4. On ALL three tasks done: completion-report.md; TaskUpdate 4,5,6 completed; `SendMessage(to: "team-lead", message: "COMPLETE: W2-tnt-dns-1 done. Zones: {app-id} {www-id}. Verify: scripts/miempresaapp-dns/verify.sh. See completion-report.md", summary: "tnt-dns-1 complete")`
5. BLOCKED: exact problem / attempted / need. WAIT.
6. Before every turn ends: COMPLETE / BLOCKED / WAITING / TURNING-POINT-* / CHECKPOINT / PLAN-APPROVAL.
7. Address `team-lead`, never `main`. message is a plain string except shutdown_response.
8. Never TaskCreate. After COMPLETE stay silent on echoes.

DURABILITY: write progress-report.md after EACH step.
