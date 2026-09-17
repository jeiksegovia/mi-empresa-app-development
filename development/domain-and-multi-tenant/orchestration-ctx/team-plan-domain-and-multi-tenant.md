# Team Plan: domain-and-multi-tenant

## Context

- `00-intake-domain-and-multi-tenant.md` — DNS authority vs Cloudflare Full setup
- `01-requirements-domain-and-multi-tenant.md` — R1–R7 research cycle
- `02-research-domain-and-multi-tenant.md` — Option B recommended
- Developer 2026-09-16: v1 = `app.` platform + `www.` marketing, DNS+R53 only

## Objective

Create and NS-delegate two Route 53 child zones (`app.miempresaapp.com`, `www.miempresaapp.com`) from Cloudflare Full apex. Verify with public `dig`. No app/Amplify deploy.

## Implementation Location

- AWS: account `613538400064`, profile `mi-empresa-app-multi`, region `us-east-1`
- Cloudflare DNS API via gitignored `development/domain-and-multi-tenant/.env`
- Helper: `scripts/miempresaapp-dns/verify.sh`
- Reports: `development/domain-and-multi-tenant/tasks/W2-tnt-dns-1/`

## Work Streams

| ID | Stream | Worker | Role | Points | Dependencies |
|----|--------|--------|------|--------|--------------|
| T4 | Create app. + www. hosted zones | W2 tnt-dns-1 | devops-infra | 5 | — |
| T5 | Cloudflare NS records for app + www | W2 tnt-dns-1 | devops-infra | 5 | T4 |
| T6 | Public dig verify + verify.sh | W2 tnt-dns-1 | devops-infra | 3 | T5 |

## Dependency Graph

```
T4: create child zones     (W2) → blocks T5
T5: CF NS delegation       (W2, blocked by T4) → blocks T6
T6: verify dig + script    (W2, blocked by T5)
```

## Prune table (S31)

| Artifact | Kind | v1 consumer | Keep / cut / spike |
|----------|------|-------------|--------------------|
| Hosted zone `app.miempresaapp.com` | svc | NS-delegation + future platform DNS | keep |
| Hosted zone `www.miempresaapp.com` | svc | NS-delegation + future marketing DNS | keep |
| Apex zone `Z08064001E7SD9RESTGXE` | svc | parked A-transfer | keep (do not recreate) |
| `CLOUDFLARE_API_TOKEN` | secret | CF DNS API in this task | keep (gitignored .env) |
| Amplify app / demo site | svc | none this cycle | cut |

## Interface Contracts

- Apex registry NS remain Cloudflare (`ed` / `paityn`).
- `app.` and `www.` public NS must be the **new** zone DelegationSets, not the apex set.
- Cloudflare NS records: type NS, proxied=false, name `app` and `www`.
- Profile: `--profile mi-empresa-app-multi` only.

## Communication Plan

None. Single worker. Escalate to team-lead on AccessDenied, CF API 403, or accidental apex-zone create.
