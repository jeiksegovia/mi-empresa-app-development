# Handoff: domain-and-multi-tenant DNS (2026-09-16)

## Live DNS (verified)

Account `613538400064` / `--profile mi-empresa-app-multi` / `us-east-1`.

| Name | HostedZone Id | Role | Public NS |
|---|---|---|---|
| `miempresaapp.com.` | `Z08064001E7SD9RESTGXE` | apex parked (Cloudflare still parent) | CF `ed` / `paityn` at registry |
| `app.miempresaapp.com.` | `Z04792861CQBYDQH6TXG9` | platform | `ns-1600` `ns-868` `ns-1140` `ns-147` |
| `www.miempresaapp.com.` | `Z04792813FUVIP6WX8WTN` | marketing | `ns-1259` `ns-922` `ns-477` `ns-1595` |

Lead re-ran `scripts/miempresaapp-dns/verify.sh`: **PASS=9 FAIL=0**. Parent still Cloudflare only. `app.` / `www.` match child DelegationSets at Cloudflare aa, 1.1.1.1, and Route 53 aa.

## Deliverables

| Path | What |
|---|---|
| `orchestration-ctx/decisions/05-child-zone-ids.md` | IDs + NS |
| `scripts/miempresaapp-dns/verify.sh` | re-runnable proof |
| `scripts/miempresaapp-dns/README.md` | how to run |
| `tasks/W2-tnt-dns-1/completion-report.md` | W2 evidence |
| `research/domain-and-multi-tenant/04-synthesis.md` | why A-strict is impossible |

## Deferred

- Amplify custom domain on `www` (no app created this cycle)
- Platform records in the `app.` zone (A/alias later)
- Apex/`www` HTTP redirect (www is marketing, not a redirect to app)
- Delete in-zone apex R53 NS pollution in Cloudflare (recursive 6-NS lie; parent ignores it)
- Domain transfer / A-transfer after **2026-11-10**
- Multi-tenant application implementation

## NOT validated

- Cloudflare dashboard UI (API + public dig only)
- Amplify / CloudFront / ACM never created
- Dedicated `disruptive` account never queried
- No registrar unlock
