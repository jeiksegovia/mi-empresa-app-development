# Decision: isolation + existing Route 53 zone

**Date**: 2026-09-16
**Status**: locked

## Isolation

- This orchestration is **team-tenancy** (`tnt-*`, slug `domain-and-multi-tenant`).
- Sibling **team-security** (`sec-*`, `development/security-audit-backend/`) is out of bounds.
- AWS profile lock: `mi-empresa-app-multi` only. Profile `disruptive` is the dedicated live app. Never mix.

## Existing Route 53 zone (developer dashboard, 2026-09-16)

Do not create another hosted zone.

- Name: `miempresaapp.com`
- ID: `Z08064001E7SD9RESTGXE`
- Type: Public
- Record count: 2 (NS + SOA only)
- NS: `ns-1663.awsdns-15.co.uk`, `ns-937.awsdns-53.net`, `ns-1082.awsdns-07.org`, `ns-199.awsdns-24.com`

Worker verifies this read-only. Creating a second public zone for the same name would mint a **different** NS set and split-brain the cutover.

## This cycle

Research + recommended operator steps only. No registrar NS change, no Cloudflare zone delete, no `change-resource-record-sets`.
