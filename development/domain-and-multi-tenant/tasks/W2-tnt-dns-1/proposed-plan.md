# Proposed plan: v1 DNS child zones `app.` + `www.`

**Worker**: tnt-dns-1
**Date**: 2026-09-16
**Status**: AWAITING PROCEED. No mutations until `APPROVED:` / `PROCEED:`.
**Profile**: `--profile mi-empresa-app-multi --region us-east-1` only.
**Account**: `613538400064` (user `jakeadmin`).
**Cloudflare token**: sourced from gitignored `.env`. Never printed. Redacted as `${CLOUDFLARE_API_TOKEN}`.

## Goal

Create two new public Route 53 hosted zones and NS-delegate them from Cloudflare Full DNS:

- `app.miempresaapp.com` = platform
- `www.miempresaapp.com` = marketing (not a redirect to app)

Apex `miempresaapp.com` stays Cloudflare Registrar + Full DNS. Apex R53 zone `Z08064001E7SD9RESTGXE` stays parked.

No Amplify, no webpage, no CloudFront, no ACM, no registrar transfer, no Page Rules.

## Pre-plan evidence (read-only, already run)

### AWS identity

```
aws sts get-caller-identity --profile mi-empresa-app-multi --region us-east-1
```

```json
{
    "UserId": "AIDAY5WN5A5AEO3JOKRPF",
    "Account": "613538400064",
    "Arn": "arn:aws:iam::613538400064:user/jakeadmin"
}
```

### Hosted zones (exactly one: apex)

```
aws route53 list-hosted-zones --profile mi-empresa-app-multi --region us-east-1
```

```json
{
    "HostedZones": [
        {
            "Id": "/hostedzone/Z08064001E7SD9RESTGXE",
            "Name": "miempresaapp.com.",
            "CallerReference": "0d5cb593-da62-4a09-bbaf-e323c04c9472",
            "Config": { "Comment": "", "PrivateZone": false },
            "ResourceRecordSetCount": 2
        }
    ]
}
```

Apex DelegationSet (do **not** reuse as child NS):

```
ns-1663.awsdns-15.co.uk
ns-937.awsdns-53.net
ns-1082.awsdns-07.org
ns-199.awsdns-24.com
```

### Cloudflare zone (GET, token redacted)

Zone `miempresaapp.com`:

- id: `e8a626195cf0027bc5293b1173383b44`
- status: `active`, type: `full`, plan: Free
- registrar NS: `ed.ns.cloudflare.com`, `paityn.ns.cloudflare.com`
- token permissions: `#dns_records:edit`, `#dns_records:read`, `#zone:read`

Parent (registry) NS via `dig NS miempresaapp.com @a.gtld-servers.net +norecurse`:

```
miempresaapp.com.  172800  IN  NS  ed.ns.cloudflare.com.
miempresaapp.com.  172800  IN  NS  paityn.ns.cloudflare.com.
```

Existing CF DNS records: **4 NS at apex** pointing at the parked R53 apex set (in-zone pollution from earlier research). These are **not** `app`/`www` records. This plan **does not delete them**.

Existing CF records for `app.miempresaapp.com`: **none**.
Existing CF records for `www.miempresaapp.com`: **none**.
No `app.` or `www.` hosted zone exists yet.

## Task 4 — create child zones (after PROCEED)

Idempotent: if a public zone named `app.miempresaapp.com.` or `www.miempresaapp.com.` already exists, skip create and reuse its Id.

Caller-reference uses a unique timestamp generated at run time (`$(date +%s)`), not a reused string.

```
aws route53 create-hosted-zone \
  --name app.miempresaapp.com \
  --caller-reference "app-miempresaapp-$(date +%s)" \
  --hosted-zone-config Comment="multi-tenant platform subdomain",PrivateZone=false \
  --profile mi-empresa-app-multi --region us-east-1
```

```
aws route53 create-hosted-zone \
  --name www.miempresaapp.com \
  --caller-reference "www-miempresaapp-$(date +%s)" \
  --hosted-zone-config Comment="marketing www subdomain",PrivateZone=false \
  --profile mi-empresa-app-multi --region us-east-1
```

Then:

```
aws route53 list-hosted-zones --profile mi-empresa-app-multi --region us-east-1
```

**Pass gate**: exactly three public zones (`miempresaapp.com.`, `app.miempresaapp.com.`, `www.miempresaapp.com.`). Apex Id still `Z08064001E7SD9RESTGXE`. If a fourth apex appears, STOP / BLOCKED. Do not continue Task 5.

Save HostedZone Id + DelegationSet NameServers to:

- `development/domain-and-multi-tenant/tasks/W2-tnt-dns-1/progress-report.md`
- `development/domain-and-multi-tenant/orchestration-ctx/decisions/05-child-zone-ids.md`

Assert each child DelegationSet NS set is **not equal** to the apex NS set.

## Task 5 — Cloudflare NS records (after 4)

Zone id: `e8a626195cf0027bc5293b1173383b44`.

Source token (never printed):

```
set +x
set -a && source development/domain-and-multi-tenant/.env && set +a
```

GET first (skip POST if four correct NS already exist):

```
curl -sS "https://api.cloudflare.com/client/v4/zones/e8a626195cf0027bc5293b1173383b44/dns_records?type=NS&name=app.miempresaapp.com" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json"

curl -sS "https://api.cloudflare.com/client/v4/zones/e8a626195cf0027bc5293b1173383b44/dns_records?type=NS&name=www.miempresaapp.com" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json"
```

If wrong NS exist for `app`/`www`: stop and send PLAN-APPROVAL before delete/replace.

POST four NS for `app` (one per child nameserver; `proxied: false`; ttl 86400). Nameserver values come from Task 4 output, **not** from apex `ns-199` / `ns-1082` / `ns-937` / `ns-1663`:

```
curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/e8a626195cf0027bc5293b1173383b44/dns_records" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"type":"NS","name":"app","content":"<APP_NS_N>","ttl":86400,"proxied":false}'
```

Repeat for each of the four `app` NS, then four more POSTs with `"name":"www"` and `<WWW_NS_N>`.

Do **not**:

- change registrar nameservers
- delete the Cloudflare zone
- add A/AAAA/CNAME for apex or www to dummy IPs
- add Page Rules / Redirects
- put Route 53 apex NS as the child NS
- delete the existing four apex-in-zone R53 NS pollution records (out of scope)

## Task 6 — verify

Write and run `scripts/miempresaapp-dns/verify.sh` (executable) that:

1. `dig NS miempresaapp.com @a.gtld-servers.net +norecurse` asserts only Cloudflare NS (`ed` / `paityn`)
2. `dig NS app.miempresaapp.com @1.1.1.1` and `@ed.ns.cloudflare.com` asserts the four **app** R53 NS
3. Same for `www.miempresaapp.com` vs **www** R53 NS
4. Queries one nameserver from each child DelegationSet with `+norecurse` and asserts `aa` + matching NS
5. Exits 0 on pass, non-zero on fail; prints expected vs got
6. Reads NS from `development/domain-and-multi-tenant/orchestration-ctx/decisions/05-child-zone-ids.md` or env `APP_NS` / `WWW_NS`

One retry on failed dig, then record actual TTL/answer. If CF aa already has the NS but 1.1.1.1 is stale: MED confidence + still pass if authoritative CF + R53 aa match.

Also write `scripts/miempresaapp-dns/README.md` (how to run, no secrets).

## Explicitly not in this plan

| Action | Why not |
|---|---|
| `create-hosted-zone --name miempresaapp.com` | Apex exists: `Z08064001E7SD9RESTGXE` |
| `--profile disruptive` | Dedicated live stacks; out of bounds |
| Amplify / CloudFront / ACM / demo page | Developer: DNS + R53 only |
| Registrar unlock / transfer / NS change | CF Registrar lock until 2026-11-10 |
| Apex/`www` HTTP redirect to `app` | www is marketing, not a redirect |
| Delete CF apex-in-zone R53 NS rows | Pollution, but not this cycle's mutation |

## Rollback (if PROCEED then abort)

1. Delete the eight Cloudflare NS records named `app` / `www` (not the apex pollution rows).
2. Leave empty child hosted zones, or `delete-hosted-zone` only after they contain NS+SOA only. Never delete `Z08064001E7SD9RESTGXE`.

## Cost / blast radius

- Two public hosted zones: $0.50/zone/month after the first hosted zone (account already has one). No traffic yet.
- Cloudflare Free: NS records are free.
- No live app traffic on these names today.

Awaiting `APPROVED:` / `PROCEED:` from team-lead.
