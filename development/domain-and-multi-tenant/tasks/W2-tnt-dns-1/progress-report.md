# Progress: W2-tnt-dns-1

**Worker**: tnt-dns-2 (replacement for tnt-dns-1)
**Profile**: `mi-empresa-app-multi` / `us-east-1` / account `613538400064`
**Status**: Tasks 4, 5, 6 done. Verify PASS=9 FAIL=0.

## Gate — pre-plan evidence (read-only)

Cwd: `/Users/jeik/ws/mi-empresa-app-development`. Task 4 marked `in_progress`.

### AWS identity

Command:

```
aws sts get-caller-identity --profile mi-empresa-app-multi --region us-east-1
```

Output:

```json
{
    "UserId": "AIDAY5WN5A5AEO3JOKRPF",
    "Account": "613538400064",
    "Arn": "arn:aws:iam::613538400064:user/jakeadmin"
}
```

### Hosted zones (before create)

Command:

```
aws route53 list-hosted-zones --profile mi-empresa-app-multi --region us-east-1
```

Output: one public zone.

| Id | Name | Private | Record count |
|---|---|---|---|
| `Z08064001E7SD9RESTGXE` | `miempresaapp.com.` | false | 2 |

Apex DelegationSet:

```
ns-1663.awsdns-15.co.uk
ns-937.awsdns-53.net
ns-1082.awsdns-07.org
ns-199.awsdns-24.com
```

No `app.miempresaapp.com.` or `www.miempresaapp.com.` zone existed.

### Cloudflare (GET, token not logged)

`.env` sourced; token present (len 53); Authorization header not printed.

Zone GET `?name=miempresaapp.com`:

- zone id: `e8a626195cf0027bc5293b1173383b44`
- status: `active`, type: `full`, plan: Free
- CF nameservers: `ed.ns.cloudflare.com`, `paityn.ns.cloudflare.com`
- permissions: `#dns_records:edit`, `#dns_records:read`, `#zone:read`

Registry parent:

```
dig NS miempresaapp.com @a.gtld-servers.net +norecurse
miempresaapp.com.  172800  IN  NS  ed.ns.cloudflare.com.
miempresaapp.com.  172800  IN  NS  paityn.ns.cloudflare.com.
```

Recursive `dig NS miempresaapp.com +short` still shows the six-NS mix (Cloudflare pair + four parked R53 apex NS). That is the known in-zone pollution. Left untouched.

CF DNS inventory (`per_page=100`): 4 records, all type NS at apex pointing at the parked R53 set. `name=app.miempresaapp.com` count=0. `name=www.miempresaapp.com` count=0.

Gate CLEARED 2026-09-16 via `orchestration-ctx/decisions/06-approve-app-www-dns-plan.md`. tnt-dns-2 did not re-send PLAN-APPROVAL.

## Task 4 — create child zones

Idempotent check (`list-hosted-zones`) still showed only the apex. Created both public child zones.

### app.miempresaapp.com

Command:

```
aws route53 create-hosted-zone \
  --name app.miempresaapp.com \
  --caller-reference "app-miempresaapp-$(date +%s)" \
  --hosted-zone-config Comment="multi-tenant platform subdomain",PrivateZone=false \
  --profile mi-empresa-app-multi --region us-east-1
```

Result:

- HostedZone Id: `Z04792861CQBYDQH6TXG9`
- CallerReference: `app-miempresaapp-1789603720`
- ChangeInfo: `C079109812YRYC7TTL0F4` PENDING
- DelegationSet:

```
ns-1600.awsdns-08.co.uk
ns-868.awsdns-44.net
ns-1140.awsdns-14.org
ns-147.awsdns-18.com
```

Not equal to apex NS set. Pass.

### www.miempresaapp.com

Command:

```
aws route53 create-hosted-zone \
  --name www.miempresaapp.com \
  --caller-reference "www-miempresaapp-$(date +%s)" \
  --hosted-zone-config Comment="marketing www subdomain",PrivateZone=false \
  --profile mi-empresa-app-multi --region us-east-1
```

Result:

- HostedZone Id: `Z04792813FUVIP6WX8WTN`
- CallerReference: `www-miempresaapp-1789603721`
- ChangeInfo: `C07912933L35I1B0BPCYG` PENDING
- DelegationSet:

```
ns-1259.awsdns-29.org
ns-922.awsdns-51.net
ns-477.awsdns-59.com
ns-1595.awsdns-07.co.uk
```

Not equal to apex NS set. Pass.

### Inventory gate after create

```
aws route53 list-hosted-zones --profile mi-empresa-app-multi --region us-east-1
```

Exactly three public zones. Apex Id unchanged. No fourth apex.

| Id | Name | Private | Records |
|---|---|---|---|
| `Z08064001E7SD9RESTGXE` | `miempresaapp.com.` | false | 2 |
| `Z04792861CQBYDQH6TXG9` | `app.miempresaapp.com.` | false | 2 |
| `Z04792813FUVIP6WX8WTN` | `www.miempresaapp.com.` | false | 2 |

IDs saved to `orchestration-ctx/decisions/05-child-zone-ids.md`.

## Task 5 — Cloudflare NS records

Zone id: `e8a626195cf0027bc5293b1173383b44`. Token sourced from gitignored `.env` (`token_len=53`). Authorization header not logged.

### GET before POST

```
GET .../dns_records?type=NS&name=app.miempresaapp.com
{"result":[],"success":true,"result_info":{"count":0,"total_count":0}}

GET .../dns_records?type=NS&name=www.miempresaapp.com
{"result":[],"success":true,"result_info":{"count":0,"total_count":0}}
```

No existing `app`/`www` NS. No delete/replace. Posted eight NS (`proxied: false`, ttl 86400) from the NEW DelegationSets. Apex R53 NS (`ns-199` / `ns-1082` / `ns-937` / `ns-1663`) were not used.

### POST results (ids only)

app:

```
success=True name=app.miempresaapp.com type=NS content=ns-1600.awsdns-08.co.uk ttl=86400 proxied=False id=fa38f53725fd775caad3156d7c5160ea
success=True name=app.miempresaapp.com type=NS content=ns-868.awsdns-44.net ttl=86400 proxied=False id=28e36c73e253fd7c973d7aa2ed119c80
success=True name=app.miempresaapp.com type=NS content=ns-1140.awsdns-14.org ttl=86400 proxied=False id=9dc1672b251c58386d6b07c7d474c449
success=True name=app.miempresaapp.com type=NS content=ns-147.awsdns-18.com ttl=86400 proxied=False id=aa6e8de3f0603e309aa822486ecf2ab9
```

www:

```
success=True name=www.miempresaapp.com type=NS content=ns-1259.awsdns-29.org ttl=86400 proxied=False id=1f9e5d5afd6298eca239055856ef7578
success=True name=www.miempresaapp.com type=NS content=ns-922.awsdns-51.net ttl=86400 proxied=False id=a3e00dcd16bc686ae80384bbb75c1400
success=True name=www.miempresaapp.com type=NS content=ns-477.awsdns-59.com ttl=86400 proxied=False id=167f424e5e8a2f2b76f6db9fc79bc423
success=True name=www.miempresaapp.com type=NS content=ns-1595.awsdns-07.co.uk ttl=86400 proxied=False id=fa3b1b2db1a6eae6756e97d39f71a7ee
```

### GET after POST

```
success=True count=4
  NS app.miempresaapp.com ns-147.awsdns-18.com ttl=86400 proxied=False
  NS app.miempresaapp.com ns-1140.awsdns-14.org ttl=86400 proxied=False
  NS app.miempresaapp.com ns-868.awsdns-44.net ttl=86400 proxied=False
  NS app.miempresaapp.com ns-1600.awsdns-08.co.uk ttl=86400 proxied=False
success=True count=4
  NS www.miempresaapp.com ns-1595.awsdns-07.co.uk ttl=86400 proxied=False
  NS www.miempresaapp.com ns-477.awsdns-59.com ttl=86400 proxied=False
  NS www.miempresaapp.com ns-922.awsdns-51.net ttl=86400 proxied=False
  NS www.miempresaapp.com ns-1259.awsdns-29.org ttl=86400 proxied=False
```

Registrar parent unchanged:

```
dig NS miempresaapp.com @a.gtld-servers.net +norecurse
miempresaapp.com.	172800	IN	NS	ed.ns.cloudflare.com.
miempresaapp.com.	172800	IN	NS	paityn.ns.cloudflare.com.
```

Apex in-zone pollution (six-NS mix at CF aa) left untouched.

## Task 6 — verify

Wrote `scripts/miempresaapp-dns/verify.sh` (executable) and `scripts/miempresaapp-dns/README.md`. NS loaded from `05-child-zone-ids.md` (`APP_NS` / `WWW_NS` lines).

Command:

```
bash scripts/miempresaapp-dns/verify.sh
```

Output (verbatim):

```
verify.sh  cwd=/Users/jeik/ws/mi-empresa-app-development
ids file: /Users/jeik/ws/mi-empresa-app-development/development/domain-and-multi-tenant/orchestration-ctx/decisions/05-child-zone-ids.md
APP_NS=ns-1140.awsdns-14.org ns-147.awsdns-18.com ns-1600.awsdns-08.co.uk ns-868.awsdns-44.net 
WWW_NS=ns-1259.awsdns-29.org ns-1595.awsdns-07.co.uk ns-477.awsdns-59.com ns-922.awsdns-51.net 

== parent NS miempresaapp.com @a.gtld-servers.net +norecurse
miempresaapp.com.	172800	IN	NS	ed.ns.cloudflare.com.
miempresaapp.com.	172800	IN	NS	paityn.ns.cloudflare.com.
PASS  parent NS miempresaapp.com @a.gtld-servers.net +norecurse

== app NS @1.1.1.1
app.miempresaapp.com.	172800	IN	NS	ns-1140.awsdns-14.org.
app.miempresaapp.com.	172800	IN	NS	ns-147.awsdns-18.com.
app.miempresaapp.com.	172800	IN	NS	ns-1600.awsdns-08.co.uk.
app.miempresaapp.com.	172800	IN	NS	ns-868.awsdns-44.net.

== app NS @ed.ns.cloudflare.com +norecurse
app.miempresaapp.com.	86400	IN	NS	ns-1140.awsdns-14.org.
app.miempresaapp.com.	86400	IN	NS	ns-147.awsdns-18.com.
app.miempresaapp.com.	86400	IN	NS	ns-1600.awsdns-08.co.uk.
app.miempresaapp.com.	86400	IN	NS	ns-868.awsdns-44.net.
PASS  app NS @ed.ns.cloudflare.com matches child DelegationSet
PASS  app NS @1.1.1.1 matches child DelegationSet

== www NS @1.1.1.1
www.miempresaapp.com.	172800	IN	NS	ns-1259.awsdns-29.org.
www.miempresaapp.com.	172800	IN	NS	ns-1595.awsdns-07.co.uk.
www.miempresaapp.com.	172800	IN	NS	ns-477.awsdns-59.com.
www.miempresaapp.com.	172800	IN	NS	ns-922.awsdns-51.net.

== www NS @ed.ns.cloudflare.com +norecurse
www.miempresaapp.com.	86400	IN	NS	ns-1259.awsdns-29.org.
www.miempresaapp.com.	86400	IN	NS	ns-1595.awsdns-07.co.uk.
www.miempresaapp.com.	86400	IN	NS	ns-477.awsdns-59.com.
www.miempresaapp.com.	86400	IN	NS	ns-922.awsdns-51.net.
PASS  www NS @ed.ns.cloudflare.com matches child DelegationSet
PASS  www NS @1.1.1.1 matches child DelegationSet

== app NS @ns-1140.awsdns-14.org +norecurse (expect aa)
app.miempresaapp.com.	172800	IN	NS	ns-1140.awsdns-14.org.
app.miempresaapp.com.	172800	IN	NS	ns-147.awsdns-18.com.
app.miempresaapp.com.	172800	IN	NS	ns-1600.awsdns-08.co.uk.
app.miempresaapp.com.	172800	IN	NS	ns-868.awsdns-44.net.
;; flags: qr aa; QUERY: 1, ANSWER: 4, AUTHORITY: 0, ADDITIONAL: 1
PASS  app @ns-1140.awsdns-14.org has aa
PASS  app @ns-1140.awsdns-14.org NS matches DelegationSet

== www NS @ns-1259.awsdns-29.org +norecurse (expect aa)
www.miempresaapp.com.	172800	IN	NS	ns-1259.awsdns-29.org.
www.miempresaapp.com.	172800	IN	NS	ns-1595.awsdns-07.co.uk.
www.miempresaapp.com.	172800	IN	NS	ns-477.awsdns-59.com.
www.miempresaapp.com.	172800	IN	NS	ns-922.awsdns-51.net.
;; flags: qr aa; QUERY: 1, ANSWER: 4, AUTHORITY: 0, ADDITIONAL: 1
PASS  www @ns-1259.awsdns-29.org has aa
PASS  www @ns-1259.awsdns-29.org NS matches DelegationSet

---- summary ----
PASS=9 FAIL=0
```

1.1.1.1 was not stale. No MED waiver used.

## Done

All three tasks complete. See `completion-report.md`.
