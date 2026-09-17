# Completion report: tnt-research-1

Worker: tnt-W1 (research-arch)
Finished: 2026-09-16
Recommendation: **Option B** (Cloudflare Full apex + NS-delegate `app.` to a new Route 53 zone)
Confidence: **HIGH**

## Deliverables

| Path | Status |
|---|---|
| `research/domain-and-multi-tenant/00-research-brief.md` | present (seeded + used) |
| `research/domain-and-multi-tenant/sources/` | present (official page extracts) |
| `research/domain-and-multi-tenant/01-pass-A.md` | written |
| `research/domain-and-multi-tenant/02-pass-B.md` | written |
| `research/domain-and-multi-tenant/03-pass-C.md` | written |
| `research/domain-and-multi-tenant/04-synthesis.md` | written |
| `development/domain-and-multi-tenant/02-research-domain-and-multi-tenant.md` | written |
| `development/domain-and-multi-tenant/tasks/W1-tnt-research-1/progress-report.md` | durable log |

No mutations executed. Profile `disruptive` unused. No writes under `development/security-audit-backend/`.

## Acceptance criteria

### 1. Live dig/whois; registry NS identified

**PASS — Cloudflare registry NS.**

Verbatim parent referral:

```
timeout 30 dig NS miempresaapp.com @a.gtld-servers.net +norecurse
;; AUTHORITY SECTION:
miempresaapp.com.	172800	IN	NS	ed.ns.cloudflare.com.
miempresaapp.com.	172800	IN	NS	paityn.ns.cloudflare.com.
```

WHOIS (Verisign):

```
   Registrar: Cloudflare, Inc.
   Name Server: ED.NS.CLOUDFLARE.COM
   Name Server: PAITYN.NS.CLOUDFLARE.COM
   DNSSEC: unsigned
   Creation Date: 2026-09-11T16:29:30Z
```

Full outputs: `progress-report.md` Task 1 section.

### 2. Full vs Partial vs Subdomain + Free limits

**PASS.** Cited:

- https://developers.cloudflare.com/dns/zone-setups/ (Free/Pro: Full only)
- https://developers.cloudflare.com/dns/zone-setups/partial-setup/ (Business/Enterprise; not on CF Registrar)
- https://developers.cloudflare.com/dns/zone-setups/subdomain-setup/ (Enterprise CF child zone)
- https://developers.cloudflare.com/dns/manage-dns-records/how-to/subdomains-outside-cloudflare/ (outgoing NS Free Yes)

### 3. Registrar vs DNS; nameserver change at registrar

**PASS.** Cloudflare Registrar FAQ: cannot use third-party NS; transfer required.
https://developers.cloudflare.com/registrar/faq/
https://developers.cloudflare.com/dns/nameservers/update-nameservers/
In-zone apex NS explained as non-delegation (DNSimple + live dig mismatch).

### 4. AWS read-only inventory matches dashboard

**PASS** (after IAM admin group). Profile only `mi-empresa-app-multi`.

```
aws sts get-caller-identity --profile mi-empresa-app-multi --region us-east-1
# Account 613538400064, user jakeadmin

aws route53 list-hosted-zones --profile mi-empresa-app-multi --region us-east-1
# only Z08064001E7SD9RESTGXE miempresaapp.com. count 2

aws route53 get-hosted-zone --id Z08064001E7SD9RESTGXE --profile mi-empresa-app-multi --region us-east-1
# NS: ns-1663.awsdns-15.co.uk, ns-937.awsdns-53.net, ns-1082.awsdns-07.org, ns-199.awsdns-24.com

aws route53 list-resource-record-sets --hosted-zone-id Z08064001E7SD9RESTGXE --profile mi-empresa-app-multi --region us-east-1
# NS + SOA only
```

Full JSON: `progress-report.md` Task 2 Attempt 3.

### 5. Synthesis recommends A or B (or C) + steps; no mutations

**PASS — Option B.** Ordered steps, rollback, do-not-do, Registrar vs DNS click map in `04-synthesis.md`. A-strict rejected; A-transfer documented for after 2026-11-10.

### 6. Pass files + 02-research summary; claims cited

**PASS.** Paths above. Critical claims have URL or verbatim command.

## One-sentence key finding

Cloudflare Registrar owns apex authority today and will not point NS at Route 53; use Free outgoing NS delegation of `app.miempresaapp.com` to a new Route 53 zone (Option B), keeping empty apex zone `Z08064001E7SD9RESTGXE` for a possible post-2026-11-10 transfer.
