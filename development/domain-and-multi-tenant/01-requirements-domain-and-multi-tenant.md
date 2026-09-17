# Requirements: domain-and-multi-tenant

**This cycle**: domain validation + DNS authority recommendation only.

## Functional Requirements

| ID | Requirement | Acceptance Criterion | Research? |
|----|-------------|----------------------|-----------|
| R1 | Isolate team-tenancy artifacts from team-security | All tenancy files live under `development/domain-and-multi-tenant/` and `research/domain-and-multi-tenant/`. Worker names `tnt-*`. No writes under `development/security-audit-backend/`. | no |
| R2 | Determine live registry authority for `miempresaapp.com` | Public `dig NS`/`SOA` against 1.1.1.1 and 8.8.8.8 plus WHOIS nameserver fields captured verbatim. | [needs-research] |
| R3 | Explain Cloudflare Full vs Partial vs Subdomain setups | Cite Cloudflare official docs. State Free-plan limits (Partial/CNAME = Business/Enterprise). | [needs-research] |
| R4 | Explain Cloudflare Registrar vs Cloudflare DNS | Document whether the domain can keep Cloudflare as registrar while using Route 53 as DNS, and the exact nameserver-change location (registrar, not DNS zone). | [needs-research] |
| R5 | Verify existing Route 53 zone in `mi-empresa-app-multi` | Read-only: caller identity; hosted zone `Z08064001E7SD9RESTGXE` for `miempresaapp.com`; NS set matches `ns-199.awsdns-24.com` / `ns-1082.awsdns-07.org` / `ns-937.awsdns-53.net` / `ns-1663.awsdns-15.co.uk`; record count 2 (NS+SOA). Do **not** `create-hosted-zone`. Profile `disruptive` never used. | [needs-research] |
| R6 | Recommend a DNS end-state with ordered operator steps | Options A (apex to Route 53), B (subdomain NS delegation + apex/www at Cloudflare), C (other documented). One recommended option with risks, rollback, and "do not do" list (in-zone NS). | [needs-research] |
| R7 | No mutations this cycle | No `change-resource-record-sets`, no `create-hosted-zone`, no Cloudflare zone delete, no registrar NS change executed. | no |

## Non-Functional Requirements

| ID | Requirement | Acceptance Criterion |
|----|-------------|----------------------|
| N1 | AWS blast-radius | Only `--profile mi-empresa-app-multi`. Dedicated live app (`disruptive`, `disruptiveexp.com`) is out of bounds. |
| N2 | Evidence discipline | Every claim has verbatim command + output or a cited URL. Confidence HIGH/MED/LOW with justification. |
| N3 | Two-team safety | `tnt-*` names; subjects prefixed `[tnt-`; status file namespaced `team-status-domain-and-multi-tenant.md`. |

## Out of Scope

- Multi-tenant application code (tenancy model, auth, routing, schema).
- Dedicated running product on profile `disruptive` (emkasa / `disruptiveexp.com`).
- Executing registrar nameserver change, deleting the Cloudflare zone, creating Route 53 records.
- Security-audit-backend work (`sec-*`).
- Amplify/CloudFront/app deploy for `miempresaapp.com`.
