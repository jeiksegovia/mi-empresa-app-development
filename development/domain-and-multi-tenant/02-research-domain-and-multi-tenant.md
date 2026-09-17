# Research: domain-and-multi-tenant
**Full research**: `research/domain-and-multi-tenant/`
**Synthesis**: `research/domain-and-multi-tenant/04-synthesis.md`

## Key Findings

1. **Registrar / registry authority**: Cloudflare, Inc. (IANA 1910). Parent `.com` and WHOIS Name Server = `ed.ns.cloudflare.com`, `paityn.ns.cloudflare.com` only. Created 2026-09-11. DNSSEC unsigned. `clientTransferProhibited`.
2. **Why in-zone Route 53 NS failed**: Apex delegation is set at the registrar/registry, not by NS rows inside the Cloudflare zone file. Cloudflare aa still serves the polluted 6-NS set; recursive resolvers mirror that; parent does not.
3. **Cloudflare Registrar + third-party NS**: Official FAQ: **No**. Must transfer to another registrar to point apex at Route 53. Custom/vanity NS are still Cloudflare-operated (Business+).
4. **Free plan setups**: Full only. Partial/CNAME = Business/Enterprise and **not supported on Cloudflare Registrar**. Outgoing subdomain NS delegation = Free Yes. Cloudflare "Subdomain setup" (child CF zone) = Enterprise only (different product).
5. **Route 53 inventory** (`--profile mi-empresa-app-multi` only): Account `613538400064`, zone `Z08064001E7SD9RESTGXE` / `miempresaapp.com.`, public, ResourceRecordSetCount **2**, NS `ns-1663.awsdns-15.co.uk`, `ns-937.awsdns-53.net`, `ns-1082.awsdns-07.org`, `ns-199.awsdns-24.com`. Only hosted zone in account. No `app.` zone. Profile `disruptive` unused. No mutations.
6. **Transfer lock**: ICANN/Cloudflare 60 days from registration => earliest transfer-out **2026-11-10**.

## Technical Decisions

**Recommend Option B** now: keep Cloudflare Registrar + Full apex; later NS-delegate `app.miempresaapp.com` to a **new** Route 53 hosted zone; optional Free Single Redirect apex/`www` -> `app`. Keep `Z08064001E7SD9RESTGXE` parked for a possible **A-transfer** after 2026-11-10 if naked domain must live on Route 53.

Reject A-strict (not offered by Cloudflare Registrar). Reject Partial/vanity/CF-for-SaaS as apex-authority solutions on Free.

## Confidence

HIGH — live dig/whois/parent, official CF/AWS/ICANN docs, and matching Route 53 CLI inventory.

## Impact on Requirements

- R2–R6 research items answered.
- R5 verified after IAM admin group attached to `jakeadmin`.
- R6 recommendation is B, with A-transfer documented as later path.
- Intake open question "pick A/B/C" -> **B** (confirm-with-user for naked-domain timeline).
- No requirement change to out-of-scope multi-tenant app code.

## Operator steps (not executed)

1. Leave Cloudflare Registrar + Full zone Active.
2. Do not create another apex hosted zone.
3. Optional: delete four Route 53 **apex** NS records from Cloudflare DNS Records (cleanup only).
4. Later (approval): `aws route53 create-hosted-zone --name app.miempresaapp.com ... --profile mi-empresa-app-multi --region us-east-1`.
5. Add four NS records name `app` in Cloudflare **DNS** pointing at the new zone's NS.
6. Optional: proxied `192.0.2.1` on `@`/`www` + Single Redirect to `https://app.miempresaapp.com`.
7. After 2026-11-10 only if needed: Registrar Unlock > transfer out > set apex NS to the four names of `Z08064001E7SD9RESTGXE`.
