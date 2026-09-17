# Intake: domain-and-multi-tenant

**Team**: `team-tenancy` (`tnt-*`)
**Sibling team (DO NOT TOUCH)**: `team-security` (`sec-*`) at `development/security-audit-backend/`
**Date**: 2026-09-16
**This cycle scope**: validate `miempresaapp.com` DNS authority and Route 53 vs Cloudflare Full setup. Multi-tenant app implementation is later, out of scope.

## Objective

Decide how to make AWS Route 53 (account behind AWS profile `mi-empresa-app-multi`) the DNS authority that the multi-tenant product needs, given the domain was purchased on Cloudflare as a Full setup zone that currently does not accept custom nameservers in the way the operator expected.

Deliver: evidence-backed operator steps (not implementation) covering:

1. What is actually authoritative today (registry NS vs in-zone NS records).
2. How Cloudflare Registrar vs Cloudflare DNS relate (purchasing on Cloudflare is not the same as Cloudflare remaining the DNS host forever).
3. Whether the correct fix is (A) registrar nameserver change to Route 53, (B) keep Cloudflare Full setup and NS-delegate a subdomain (`app.` / `www.`), or (C) another documented middle ground.
4. Exact read-only inventory of Route 53 in `mi-empresa-app-multi` (hosted zone present or not).

## Assumptions

- Domain: `miempresaapp.com` (multi-tenant product). Distinct from dedicated running app on profile `disruptive` (`disruptiveexp.com`, emkasa-like dedicated tenants).
- Cloudflare zone is Full setup, active, Free plan, DNSSEC disabled.
- Cloudflare-assigned NS: `ed.ns.cloudflare.com`, `paityn.ns.cloudflare.com`.
- Four Route 53 NS names were added as **in-zone NS records** (does not move authority).
- Developer-confirmed (2026-09-16, dashboard): Route 53 public hosted zone **already exists** in `mi-empresa-app-multi`:
  - Name: `miempresaapp.com`
  - Hosted zone ID: `Z08064001E7SD9RESTGXE`
  - Record count: **2** (NS + SOA only; no app records yet)
  - Name servers: `ns-1663.awsdns-15.co.uk`, `ns-937.awsdns-53.net`, `ns-1082.awsdns-07.org`, `ns-199.awsdns-24.com`
  - Worker must **verify** this read-only; must **not** `create-hosted-zone`.
- AWS profile `mi-empresa-app-multi` is the only allowed AWS target this cycle.
- Profile `disruptive` is forbidden (live dedicated stacks).
- No DNS mutations, no zone deletes, no registrar changes this cycle. Research + recommended steps only.
- Multi-tenant application architecture (tenancy model, auth, routing) is out of scope.

## Open Questions

- [needs-research] Who is the registrar of record for `miempresaapp.com` (Cloudflare Registrar vs another ICANN registrar Cloudflare resells)?
- [needs-research] What does live registry delegation actually show (`dig NS`, WHOIS `Name Server`)?
- [needs-research] Verify (do not recreate) hosted zone `Z08064001E7SD9RESTGXE` in `mi-empresa-app-multi`: caller identity, NS/SOA match the dashboard, record count still 2, no extra zones.
- [needs-research] Why the Cloudflare UI appeared to block custom nameservers: in-zone NS vs registrar NS vs Free-plan Partial/CNAME limitation vs DNSSEC vs Cloudflare Registrar UI path.
- [needs-research] Community-validated path: apex to Route 53 vs subdomain NS delegation (`app.miempresaapp.com`) + Cloudflare redirect for `www` / apex.
- [needs-research] Exact Cloudflare Registrar UI/API path to change nameservers away from Cloudflare, and what happens to the Full setup zone after that.
- [confirm-with-user] After research: pick option A/B/C. No cutover until explicit developer go.

## Known Constraints

- Two teams share this working directory. Tenancy writes only under `development/domain-and-multi-tenant/`, `research/domain-and-multi-tenant/`, and `scripts/` if a helper is required. Never `development/security-audit-backend/`.
- Worker names must be `tnt-*`. Never `sec-*`.
- AWS: profile `mi-empresa-app-multi` only. Read-only. Notify exact command in the progress report before running.
- Never `prisma migrate diff --shadow-database-url`.
- Never `npm` for new scripts; this cycle should not need new runtime scripts.
- Orchestrator does not implement. Research teammate produces docs only.

## Input Source

Developer prompt 2026-09-16: `/planify-team` + `/planify-reanchor` for team-tenancy isolation; Cloudflare Full-setup vs Route 53 duality; Cloudflare docs https://developers.cloudflare.com/dns/zone-setups/; extracted Cloudflare analysis of in-zone NS records vs registry delegation.
