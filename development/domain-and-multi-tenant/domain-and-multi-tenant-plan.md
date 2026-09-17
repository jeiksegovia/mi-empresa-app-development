# Feature Plan: domain-and-multi-tenant (DNS cycle)

**Date**: 2026-09-16
**Status**: research complete. Awaiting developer pick before any mutation.
**Team**: team-tenancy (`tnt-*`)

## Objective

Give the multi-tenant product a Route 53-controlled hostname on `miempresaapp.com` without mixing the dedicated live app (`disruptive` / `disruptiveexp.com`).

## Assumptions & Constraints

- Cloudflare Registrar owns the apex and **cannot** use Route 53 nameservers (official FAQ Aug 3 2026).
- Transfer-out blocked until ~2026-11-10 (registered 2026-09-11, ICANN 60-day).
- Apex Route 53 zone already exists: `Z08064001E7SD9RESTGXE` in account `613538400064` (`mi-empresa-app-multi`), NS+SOA only. Do not recreate.
- AWS profile lock: `mi-empresa-app-multi` only. Never `disruptive`.
- Multi-tenant application code is out of scope this cycle.
- Cloudflare `edit-dns-zone` token exists in gitignored `.env`. Unused until mutation approval.

## Existing Patterns Used

None in app code. This cycle is DNS/registrar operator work, not backend/frontend.

## Requirements

R1 isolation, R2 live authority, R3 CF setups, R4 registrar vs DNS, R5 R53 inventory, R6 recommended steps, R7 no mutations this research cycle. All met.

## Technical Approach

**Recommend Option B** as v1 DNS:

1. Keep Cloudflare Registrar + Full Free zone on the apex.
2. Later (explicit go): create a **new** Route 53 hosted zone for `app.miempresaapp.com` in `mi-empresa-app-multi`.
3. In Cloudflare **DNS** (not Registrar), add four NS records name `app` pointing at that new zone.
4. Optional: Cloudflare Single Redirect `miempresaapp.com` / `www` -> `https://app.miempresaapp.com`.
5. Keep empty apex zone `Z08064001E7SD9RESTGXE` parked for optional **A-transfer** after 2026-11-10 if the naked domain must live on Route 53.

A-strict (keep CF Registrar, point apex NS at R53) is **not offered**. Partial/CNAME is Business/Enterprise and not supported on Cloudflare Registrar.

## Risk & Unknowns

- Product hostname: is `app.miempresaapp.com` acceptable until/unless A-transfer?
- Optional cleanup of four in-zone apex R53 NS rows in Cloudflare (stops recursive 6-NS lie; parent already ignores them).
- If A-transfer happens later, `app.` parentage may move from Cloudflare to the apex R53 zone. Design that then, not now.

## Implementation Scope

No source code. Operator steps only, gated.

## New Artifacts Proposed

None in app/IaC this cycle.

Later (if B approved): one new Route 53 hosted zone `app.miempresaapp.com` (mutation). Consumer = future Amplify/CloudFront custom domain on that zone. Spike until that stack exists.

## Open Items

Developer pick: B now (recommended) vs wait for A-transfer vs B now + A-transfer later.

## References

- `00-intake-domain-and-multi-tenant.md`
- `01-requirements-domain-and-multi-tenant.md`
- `02-research-domain-and-multi-tenant.md`
- `research/domain-and-multi-tenant/04-synthesis.md`
- `orchestration-ctx/decisions/01-pass-a-cf-registrar-ns-lock.md`
- `orchestration-ctx/decisions/02-r53-zone-verified.md`
