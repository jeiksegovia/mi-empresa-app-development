# Completion: W2-tnt-dns-1

**Worker**: tnt-dns-2 (replacement for tnt-dns-1)
**Date**: 2026-09-16
**Profile**: `--profile mi-empresa-app-multi --region us-east-1` only
**Account**: `613538400064`
**Status**: COMPLETE. Tasks 4, 5, 6 done.

No Amplify, no webpage, no CloudFront, no ACM, no registrar NS change, no `--profile disruptive`, no token printed.

## Resources

| Name | HostedZone Id | Role |
|---|---|---|
| `miempresaapp.com.` | `Z08064001E7SD9RESTGXE` | apex parked (unchanged) |
| `app.miempresaapp.com.` | `Z04792861CQBYDQH6TXG9` | platform child |
| `www.miempresaapp.com.` | `Z04792813FUVIP6WX8WTN` | marketing child |

### app DelegationSet

```
ns-1600.awsdns-08.co.uk
ns-868.awsdns-44.net
ns-1140.awsdns-14.org
ns-147.awsdns-18.com
```

### www DelegationSet

```
ns-1259.awsdns-29.org
ns-922.awsdns-51.net
ns-477.awsdns-59.com
ns-1595.awsdns-07.co.uk
```

Cloudflare zone: `e8a626195cf0027bc5293b1173383b44`. Eight NS records (`proxied: false`, ttl 86400): four named `app`, four named `www`.

IDs file: `development/domain-and-multi-tenant/orchestration-ctx/decisions/05-child-zone-ids.md`

## Acceptance criteria (verbatim evidence)

### 1. Exactly three public zones; apex Id unchanged

Command:

```
aws route53 list-hosted-zones --profile mi-empresa-app-multi --region us-east-1 --query 'HostedZones[].{Id:Id,Name:Name,Private:Config.PrivateZone}' --output table
```

Output:

```
---------------------------------------------------------------------------
|                             ListHostedZones                             |
+------------------------------------+-------------------------+----------+
|                 Id                 |          Name           | Private  |
+------------------------------------+-------------------------+----------+
|  /hostedzone/Z08064001E7SD9RESTGXE |  miempresaapp.com.      |  False   |
|  /hostedzone/Z04792861CQBYDQH6TXG9 |  app.miempresaapp.com.  |  False   |
|  /hostedzone/Z04792813FUVIP6WX8WTN |  www.miempresaapp.com.  |  False   |
+------------------------------------+-------------------------+----------+
```

VERIFIED. One apex `Z08064001E7SD9RESTGXE` plus two children. No fourth apex.

### 2. Child DelegationSets ≠ apex NS set

Apex NS (parked, not reused):

```
ns-1663.awsdns-15.co.uk
ns-937.awsdns-53.net
ns-1082.awsdns-07.org
ns-199.awsdns-24.com
```

app NS (from create-hosted-zone): `ns-1600`, `ns-868`, `ns-1140`, `ns-147`. No overlap with apex.

www NS (from create-hosted-zone): `ns-1259`, `ns-922`, `ns-477`, `ns-1595`. No overlap with apex.

VERIFIED.

### 3. Cloudflare NS for app/www match child zones; registrar NS unchanged

GET after POST (token redacted; `success=True count=4` each):

```
NS app.miempresaapp.com ns-147.awsdns-18.com ttl=86400 proxied=False
NS app.miempresaapp.com ns-1140.awsdns-14.org ttl=86400 proxied=False
NS app.miempresaapp.com ns-868.awsdns-44.net ttl=86400 proxied=False
NS app.miempresaapp.com ns-1600.awsdns-08.co.uk ttl=86400 proxied=False
NS www.miempresaapp.com ns-1595.awsdns-07.co.uk ttl=86400 proxied=False
NS www.miempresaapp.com ns-477.awsdns-59.com ttl=86400 proxied=False
NS www.miempresaapp.com ns-922.awsdns-51.net ttl=86400 proxied=False
NS www.miempresaapp.com ns-1259.awsdns-29.org ttl=86400 proxied=False
```

Registrar parent (WHOIS-equivalent gTLD):

```
dig NS miempresaapp.com @a.gtld-servers.net +norecurse
miempresaapp.com.	172800	IN	NS	ed.ns.cloudflare.com.
miempresaapp.com.	172800	IN	NS	paityn.ns.cloudflare.com.
```

VERIFIED. Registrar still Cloudflare. Child NS are the new DelegationSets, not apex `ns-199` etc.

### 4. verify.sh exists, executable, and was run

Command:

```
test -x scripts/miempresaapp-dns/verify.sh && echo "verify.sh executable=yes"
bash scripts/miempresaapp-dns/verify.sh
```

Output (summary; full paste in progress-report.md Task 6):

```
verify.sh executable=yes
PASS  parent NS miempresaapp.com @a.gtld-servers.net +norecurse
PASS  app NS @ed.ns.cloudflare.com matches child DelegationSet
PASS  app NS @1.1.1.1 matches child DelegationSet
PASS  www NS @ed.ns.cloudflare.com matches child DelegationSet
PASS  www NS @1.1.1.1 matches child DelegationSet
PASS  app @ns-1140.awsdns-14.org has aa
PASS  app @ns-1140.awsdns-14.org NS matches DelegationSet
PASS  www @ns-1259.awsdns-29.org has aa
PASS  www @ns-1259.awsdns-29.org NS matches DelegationSet
---- summary ----
PASS=9 FAIL=0
```

VERIFIED. README: `scripts/miempresaapp-dns/README.md`.

### 5. Token never written; profile `disruptive` unused

Scan of worker-written files (`05-child-zone-ids.md`, `progress-report.md`, `verify.sh`, `README.md`): `hits=none` for `CLOUDFLARE_API_TOKEN=`, `Bearer ey`, `disruptive`.

All AWS calls used `--profile mi-empresa-app-multi --region us-east-1`.

VERIFIED.

### 6. No Amplify / CloudFront / ACM created

No Amplify, CloudFront, ACM, Page Rule, or A/AAAA/CNAME commands were run. Scope was `create-hosted-zone` x2, Cloudflare NS POST x8, `dig` / `verify.sh`.

VERIFIED by command inventory (no such CLI invoked).

## Verification commands (re-run)

```
aws route53 list-hosted-zones --profile mi-empresa-app-multi --region us-east-1
bash scripts/miempresaapp-dns/verify.sh
dig NS miempresaapp.com @a.gtld-servers.net +norecurse
dig NS app.miempresaapp.com @ed.ns.cloudflare.com +norecurse
dig NS www.miempresaapp.com @ed.ns.cloudflare.com +norecurse
```

## Deliverables

1. `development/domain-and-multi-tenant/orchestration-ctx/decisions/05-child-zone-ids.md`
2. `scripts/miempresaapp-dns/verify.sh`
3. `scripts/miempresaapp-dns/README.md`
4. `development/domain-and-multi-tenant/tasks/W2-tnt-dns-1/completion-report.md`
5. `development/domain-and-multi-tenant/tasks/W2-tnt-dns-1/progress-report.md`
