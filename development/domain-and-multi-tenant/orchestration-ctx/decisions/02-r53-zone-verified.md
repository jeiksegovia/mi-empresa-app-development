# Decision: Route 53 apex zone verified (do not recreate)

**Date**: 2026-09-16
**Status**: locked
**Account**: `613538400064` (`--profile mi-empresa-app-multi`, user `jakeadmin`)

Lead re-ran `get-hosted-zone` + `list-resource-record-sets` after tnt-research-1 CHECKPOINT Task 2. MATCHES dashboard.

| Field | Value |
|---|---|
| Id | `Z08064001E7SD9RESTGXE` |
| Name | `miempresaapp.com.` |
| Type | Public (`PrivateZone: false`) |
| Record count | **2** (NS + SOA only) |
| NS | `ns-1663.awsdns-15.co.uk`, `ns-937.awsdns-53.net`, `ns-1082.awsdns-07.org`, `ns-199.awsdns-24.com` |
| SOA serial | 1 |
| Other zones in account | none (no `app.miempresaapp.com` zone) |

## Locked implications

1. Do **not** `create-hosted-zone` for the apex. A second zone would mint a different NS set.
2. Option B later needs a **new** hosted zone for `app.miempresaapp.com` (or another child). Do not reuse `Z08064001E7SD9RESTGXE` as the child zone.
3. Keep this empty apex zone. It is the NS set for A-transfer after ~2026-11-10.
4. No record writes this cycle.
