# Progress report: tnt-research-1

Worker: tnt-W1 (research-arch)
Started: 2026-09-16
Cwd: `/Users/jeik/ws/mi-empresa-app-development` (verified)

Internal steps: Pass A, Pass B, Pass C, Synthesis

AWS profile used: none yet (Task 1 is public DNS + docs only). Profile `disruptive` unused.

---

## Task 1 — Live public DNS (verbatim)

Commands run 2026-09-16 ~18:45 -05. `timeout 30` on each. Recursive queries (default `dig`) used for 1.1.1.1 / 8.8.8.8 after a `+norecurse` probe at 1.1.1.1 returned SERVFAIL (resolver has no cache to fulfill RD=0). Parent-zone query used `+norecurse` against a.gtld-servers.net.

### 1. `dig NS miempresaapp.com @1.1.1.1`

```
; <<>> DiG 9.10.6 <<>> NS miempresaapp.com @1.1.1.1
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 8743
;; flags: qr rd ra; QUERY: 1, ANSWER: 6, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 1232
;; QUESTION SECTION:
;miempresaapp.com.		IN	NS

;; ANSWER SECTION:
miempresaapp.com.	86400	IN	NS	ed.ns.cloudflare.com.
miempresaapp.com.	86400	IN	NS	paityn.ns.cloudflare.com.
miempresaapp.com.	86400	IN	NS	ns-1663.awsdns-15.co.uk.
miempresaapp.com.	86400	IN	NS	ns-937.awsdns-53.net.
miempresaapp.com.	86400	IN	NS	ns-1082.awsdns-07.org.
miempresaapp.com.	86400	IN	NS	ns-199.awsdns-24.com.

;; Query time: 153 msec
;; SERVER: 1.1.1.1#53(1.1.1.1)
;; WHEN: Wed Sep 16 18:45:12 -05 2026
;; MSG SIZE  rcvd: 234
```

### 2. `dig NS miempresaapp.com @8.8.8.8`

```
; <<>> DiG 9.10.6 <<>> NS miempresaapp.com @8.8.8.8
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 12579
;; flags: qr rd ra; QUERY: 1, ANSWER: 6, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 512
;; QUESTION SECTION:
;miempresaapp.com.		IN	NS

;; ANSWER SECTION:
miempresaapp.com.	21600	IN	NS	ns-199.awsdns-24.com.
miempresaapp.com.	21600	IN	NS	paityn.ns.cloudflare.com.
miempresaapp.com.	21600	IN	NS	ns-1663.awsdns-15.co.uk.
miempresaapp.com.	21600	IN	NS	ns-1082.awsdns-07.org.
miempresaapp.com.	21600	IN	NS	ns-937.awsdns-53.net.
miempresaapp.com.	21600	IN	NS	ed.ns.cloudflare.com.

;; Query time: 111 msec
;; SERVER: 8.8.8.8#53(8.8.8.8)
;; WHEN: Wed Sep 16 18:45:12 -05 2026
;; MSG SIZE  rcvd: 234
```

### 3. `dig SOA miempresaapp.com @1.1.1.1`

```
; <<>> DiG 9.10.6 <<>> SOA miempresaapp.com @1.1.1.1
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 30094
;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 1232
;; QUESTION SECTION:
;miempresaapp.com.		IN	SOA

;; ANSWER SECTION:
miempresaapp.com.	1800	IN	SOA	ed.ns.cloudflare.com. dns.cloudflare.com. 2414800649 10000 2400 604800 1800

;; Query time: 29 msec
;; SERVER: 1.1.1.1#53(1.1.1.1)
;; WHEN: Wed Sep 16 18:45:12 -05 2026
;; MSG SIZE  rcvd: 102
```

SOA MNAME is Cloudflare (`ed.ns.cloudflare.com.`). Recursive NS answers mix Cloudflare + Route 53 because Cloudflare is serving the in-zone NS set. Parent authority is a different query (below).

### 4. `dig NS miempresaapp.com @ed.ns.cloudflare.com`

```
; <<>> DiG 9.10.6 <<>> NS miempresaapp.com @ed.ns.cloudflare.com
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 59520
;; flags: qr aa rd; QUERY: 1, ANSWER: 6, AUTHORITY: 0, ADDITIONAL: 1
;; WARNING: recursion requested but not available

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 1232
;; QUESTION SECTION:
;miempresaapp.com.		IN	NS

;; ANSWER SECTION:
miempresaapp.com.	86400	IN	NS	ed.ns.cloudflare.com.
miempresaapp.com.	86400	IN	NS	paityn.ns.cloudflare.com.
miempresaapp.com.	86400	IN	NS	ns-1663.awsdns-15.co.uk.
miempresaapp.com.	86400	IN	NS	ns-937.awsdns-53.net.
miempresaapp.com.	86400	IN	NS	ns-1082.awsdns-07.org.
miempresaapp.com.	86400	IN	NS	ns-199.awsdns-24.com.

;; Query time: 27 msec
;; SERVER: 173.245.59.111#53(173.245.59.111)
;; WHEN: Wed Sep 16 18:45:13 -05 2026
;; MSG SIZE  rcvd: 234
```

`aa` (authoritative answer) from Cloudflare. Cloudflare is serving the six-NS set from the Full-setup zone file.

### 5. `whois miempresaapp.com` (nameserver + registrar fields)

`whois` first hit IANA then Verisign then Cloudflare WHOIS. Relevant fields:

Verisign registry WHOIS (`whois.verisign-grs.com`):

```
   Domain Name: MIEMPRESAAPP.COM
   Registry Domain ID: 3141458738_DOMAIN_COM-VRSN
   Registrar WHOIS Server: whois.cloudflare.com
   Registrar URL: http://www.cloudflare.com
   Updated Date: 2026-09-11T16:29:31Z
   Creation Date: 2026-09-11T16:29:30Z
   Registry Expiry Date: 2028-09-11T16:29:30Z
   Registrar: Cloudflare, Inc.
   Registrar IANA ID: 1910
   Registrar Abuse Contact Email: registrar-abuse@cloudflare.com
   Registrar Abuse Contact Phone: +1.6503198930
   Domain Status: clientTransferProhibited https://icann.org/epp#clientTransferProhibited
   Name Server: ED.NS.CLOUDFLARE.COM
   Name Server: PAITYN.NS.CLOUDFLARE.COM
   DNSSEC: unsigned
```

Cloudflare registrar WHOIS (`whois.cloudflare.com`):

```
Domain Name: MIEMPRESAAPP.COM
Registrar: Cloudflare, Inc.
Registrar IANA ID: 1910
Domain Status: clienttransferprohibited https://icann.org/epp#clientTransferProhibited
Name Server: ed.ns.cloudflare.com
Name Server: paityn.ns.cloudflare.com
DNSSEC: unsigned
Creation Date: 2026-09-11T16:29:30Z
Registrar Registration Expiration Date: 2028-09-11T16:29:30Z
Registrant State/Province: Valle del Cauca
Registrant Country: CO
```

WHOIS nameservers: **Cloudflare only**. Route 53 NS names do **not** appear at the registry.

### Extra (non-breaking): parent TLD referral

`timeout 30 dig NS miempresaapp.com @a.gtld-servers.net +norecurse`

```
;; flags: qr; QUERY: 1, ANSWER: 0, AUTHORITY: 2, ADDITIONAL: 13
;; AUTHORITY SECTION:
miempresaapp.com.	172800	IN	NS	ed.ns.cloudflare.com.
miempresaapp.com.	172800	IN	NS	paityn.ns.cloudflare.com.
```

**Registry authority = Cloudflare NS only.** This is the load-bearing fact.

### Extra (non-breaking): Route 53 NS queried directly

`timeout 30 dig NS miempresaapp.com @ns-199.awsdns-24.com` (aa):

```
miempresaapp.com.	172800	IN	NS	ns-1082.awsdns-07.org.
miempresaapp.com.	172800	IN	NS	ns-1663.awsdns-15.co.uk.
miempresaapp.com.	172800	IN	NS	ns-199.awsdns-24.com.
miempresaapp.com.	172800	IN	NS	ns-937.awsdns-53.net.
```

SOA at Route 53: `ns-1663.awsdns-15.co.uk. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400`

The existing Route 53 zone is live and answers, but the `.com` parent does not send queries there.

### Extra (non-breaking): A/AAAA/TXT/www @1.1.1.1

- Apex A: NOERROR, empty answer, SOA Cloudflare (no A record).
- Apex AAAA: same.
- Apex TXT: same.
- `www.miempresaapp.com` A: NXDOMAIN.

Domain has no application records yet.

### Live-authority summary

| Layer | What it shows |
|---|---|
| `.com` parent (`a.gtld-servers.net`) | NS = `ed.ns.cloudflare.com`, `paityn.ns.cloudflare.com` only |
| WHOIS Name Server | same two Cloudflare names |
| Cloudflare authoritative (`ed.ns.cloudflare.com`, aa) | 6 NS (2 CF + 4 R53) from in-zone records |
| Recursive 1.1.1.1 / 8.8.8.8 | same 6 NS (they queried Cloudflare) |
| SOA MNAME via 1.1.1.1 | `ed.ns.cloudflare.com` |
| Route 53 `ns-199.awsdns-24.com` (aa) | 4 R53 NS, SOA serial 1 |

Adding Route 53 NS **inside** the Cloudflare zone did not move registry authority.

---

## Task 1 — Pass A docs (started)

Official pages fetched via google-search MCP `read_webpage` (not WebSearch). Raw notes under `research/domain-and-multi-tenant/sources/`.

Key official findings (expanded in `01-pass-A.md`):

1. Free/Pro: Full setup only. Partial/CNAME = Business/Enterprise. Partial **not supported on Cloudflare Registrar domains**.
2. Cloudflare Registrar FAQ: "Can I use my own (third-party) nameservers? **No.**" Transfer out required for third-party NS.
3. Outgoing subdomain NS delegation is Free-plan compatible (DNS app, not registrar).
4. Cloudflare "Subdomain setup" (child zone on Cloudflare) is Enterprise-only. That is a different product from NS-delegating `app.` to Route 53.

Pass A file: `research/domain-and-multi-tenant/01-pass-A.md`.

Confidence after Pass A: **HIGH** on live authority and registrar lock-in. **MED** on exact Cloudflare Registrar UI click path (docs describe Manage domains / transfer-out; no dashboard login this cycle).

---

## Task 1 — Pass B

Pass B file: `research/domain-and-multi-tenant/02-pass-B.md`.

Resolved:

- A-strict (keep CF Registrar + apex NS = Route 53) is **not offered**. Official FAQ Aug 3 2026.
- Partial/CNAME blocked twice: Free plan + Cloudflare Registrar.
- Transfer-out earliest **2026-11-10** (registered 2026-09-11 + ICANN 60 days).
- Outgoing NS for `app.` is Free-compatible (DNS Records, not Registrar).
- Apex/`www` -> `app` via proxied `192.0.2.1` + Single Redirects (Free: 10).
- Custom/vanity NS is Business+ and still Cloudflare-operated.
- Existing apex R53 zone must not be reused as the `app.` zone.

Lean: **Option B** this cycle. A-transfer after 2026-11-10 if naked domain on AWS is required.

CHECKPOINT sent after Pass A. Pass B complete; starting Task 2.

---

## Task 2 — Route 53 read-only inventory (pre-flight)

**About to run** (profile `mi-empresa-app-multi` only, `--region us-east-1`, no mutations). Profile `disruptive` will not be used.

```
aws sts get-caller-identity --profile mi-empresa-app-multi --region us-east-1
aws route53 list-hosted-zones --profile mi-empresa-app-multi --region us-east-1
aws route53 get-hosted-zone --id Z08064001E7SD9RESTGXE --profile mi-empresa-app-multi --region us-east-1
aws route53 list-resource-record-sets --hosted-zone-id Z08064001E7SD9RESTGXE --profile mi-empresa-app-multi --region us-east-1
```

Each wrapped in `timeout 60`. Outputs pasted verbatim below after execution.

### Attempt 1 — `aws sts get-caller-identity --profile mi-empresa-app-multi --region us-east-1`

```
{
    "UserId": "AIDAY5WN5A5AEO3JOKRPF",
    "Account": "613538400064",
    "Arn": "arn:aws:iam::613538400064:user/jakeadmin"
}
```

STS OK. Account `613538400064`, IAM user `jakeadmin`. Profile `disruptive` unused.

### Attempt 1 — `aws route53 list-hosted-zones --profile mi-empresa-app-multi --region us-east-1`

```
Exit code 254

An error occurred (AccessDenied) when calling the ListHostedZones operation: User: arn:aws:iam::613538400064:user/jakeadmin is not authorized to perform: route53:ListHostedZones because no identity-based policy allows the route53:ListHostedZones action
```

### Attempt 1 — `aws route53 get-hosted-zone --id Z08064001E7SD9RESTGXE --profile mi-empresa-app-multi --region us-east-1`

```
Exit code 254

An error occurred (AccessDenied) when calling the GetHostedZone operation: User: arn:aws:iam::613538400064:user/jakeadmin is not authorized to perform: route53:GetHostedZone on resource: arn:aws:route53:::hostedzone/Z08064001E7SD9RESTGXE because no identity-based policy allows the route53:GetHostedZone action
```

### Attempt 1 — `aws route53 list-resource-record-sets --hosted-zone-id Z08064001E7SD9RESTGXE --profile mi-empresa-app-multi --region us-east-1`

```
Exit code 254

An error occurred (AccessDenied) when calling the ListResourceRecordSets operation: User: arn:aws:iam::613538400064:user/jakeadmin is not authorized to perform: route53:ListResourceRecordSets on resource: arn:aws:route53:::hostedzone/Z08064001E7SD9RESTGXE because no identity-based policy allows the route53:ListResourceRecordSets action
```

### Attempt 2 (same profile only) — all three Route 53 commands

Same AccessDenied / exit 254 for `ListHostedZones`, `GetHostedZone`, and `ListResourceRecordSets`. No other profile tried. No mutations tried.

### Task 2 status

**BLOCKED.** Acceptance criterion R5 (CLI inventory of `Z08064001E7SD9RESTGXE`) cannot complete until IAM on `arn:aws:iam::613538400064:user/jakeadmin` allows at least:

- `route53:ListHostedZones`
- `route53:GetHostedZone`
- `route53:ListResourceRecordSets`

Public DNS already shows the four dashboard NS answering authoritatively at `ns-199.awsdns-24.com` (Pass A). That corroborates the zone exists somewhere, but does not prove account ownership or record count via CLI.

Need from orchestrator / developer: attach a read-only Route 53 policy to `jakeadmin` (or an assumed role usable via the same profile), then tell this worker to retry Task 2. Do not authorize profile `disruptive`.

### How to resolve (operator steps — for developer / account admin)

**What is already fine**

- Profile `mi-empresa-app-multi` credentials work.
- STS is already enabled and succeeding:
  - Account `613538400064`
  - User `arn:aws:iam::613538400064:user/jakeadmin`
- Do **not** switch to profile `disruptive`.
- Do **not** create another hosted zone while fixing IAM.

**What is broken**

IAM user `jakeadmin` has **no** identity-based policy allowing:

- `route53:ListHostedZones`
- `route53:GetHostedZone`
- `route53:ListResourceRecordSets`

Route 53 is global; `--region us-east-1` is only for CLI signing. The failure is permission, not region.

**Fix option 1 (recommended): AWS managed read-only policy**

In account `613538400064` (Console signed in as an admin, or CLI with an admin principal — **not** this worker):

1. IAM > Users > `jakeadmin` > Add permissions > Attach policies directly.
2. Attach `AmazonRoute53ReadOnlyAccess`.
3. Save.

CLI equivalent (run by an admin principal that already has `iam:AttachUserPolicy`):

```bash
aws iam attach-user-policy \
  --user-name jakeadmin \
  --policy-arn arn:aws:iam::aws:policy/AmazonRoute53ReadOnlyAccess \
  --profile <ADMIN_PROFILE_FOR_ACCOUNT_613538400064> \
  --region us-east-1
```

**Fix option 2: minimal custom policy (least privilege for this research)**

Create and attach a policy like:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Route53ReadInventory",
      "Effect": "Allow",
      "Action": [
        "route53:ListHostedZones",
        "route53:ListHostedZonesByName",
        "route53:GetHostedZone",
        "route53:ListResourceRecordSets",
        "route53:GetChange"
      ],
      "Resource": "*"
    }
  ]
}
```

Note: `ListHostedZones` / `GetHostedZone` require `Resource: "*"` in typical IAM docs for Route 53 (hosted-zone ARNs are not always enforceable the same way for list APIs).

**Verify after attach (developer can run; or tell this worker to retry Task 2)**

```bash
aws sts get-caller-identity --profile mi-empresa-app-multi --region us-east-1
aws route53 list-hosted-zones --profile mi-empresa-app-multi --region us-east-1
aws route53 get-hosted-zone --id Z08064001E7SD9RESTGXE --profile mi-empresa-app-multi --region us-east-1
aws route53 list-resource-record-sets --hosted-zone-id Z08064001E7SD9RESTGXE --profile mi-empresa-app-multi --region us-east-1
```

Expect: zone name `miempresaapp.com.`, id `Z08064001E7SD9RESTGXE`, four NS matching dashboard, ResourceRecordSetCount `2` (NS+SOA), no extra public zone for the same name unless already created.

**If the zone is missing or in another account**

Then the dashboard zone is not owned by `613538400064`. That is a **breaking turning point** (do not create a second apex zone; escalate). Public dig already shows those NS answering; ownership still must match the account behind `mi-empresa-app-multi`.

**STS note**

No STS "enable" step is required for this profile. `get-caller-identity` already works. If a future design uses assume-role, add `sts:AssumeRole` on the source user and a trust policy on the target role; that is optional and not needed for the current access-key profile path.

### Attempt 3 — after developer attached admin group (SUCCESS)

Same four commands, profile `mi-empresa-app-multi` only. Profile `disruptive` unused.

#### `aws sts get-caller-identity --profile mi-empresa-app-multi --region us-east-1`

```
{
    "UserId": "AIDAY5WN5A5AEO3JOKRPF",
    "Account": "613538400064",
    "Arn": "arn:aws:iam::613538400064:user/jakeadmin"
}
```

#### `aws route53 list-hosted-zones --profile mi-empresa-app-multi --region us-east-1`

```
{
    "HostedZones": [
        {
            "Id": "/hostedzone/Z08064001E7SD9RESTGXE",
            "Name": "miempresaapp.com.",
            "CallerReference": "0d5cb593-da62-4a09-bbaf-e323c04c9472",
            "Config": {
                "Comment": "",
                "PrivateZone": false
            },
            "ResourceRecordSetCount": 2
        }
    ]
}
```

#### `aws route53 get-hosted-zone --id Z08064001E7SD9RESTGXE --profile mi-empresa-app-multi --region us-east-1`

```
{
    "HostedZone": {
        "Id": "/hostedzone/Z08064001E7SD9RESTGXE",
        "Name": "miempresaapp.com.",
        "CallerReference": "0d5cb593-da62-4a09-bbaf-e323c04c9472",
        "Config": {
            "Comment": "",
            "PrivateZone": false
        },
        "ResourceRecordSetCount": 2
    },
    "DelegationSet": {
        "NameServers": [
            "ns-1663.awsdns-15.co.uk",
            "ns-937.awsdns-53.net",
            "ns-1082.awsdns-07.org",
            "ns-199.awsdns-24.com"
        ]
    }
}
```

#### `aws route53 list-resource-record-sets --hosted-zone-id Z08064001E7SD9RESTGXE --profile mi-empresa-app-multi --region us-east-1`

```
{
    "ResourceRecordSets": [
        {
            "Name": "miempresaapp.com.",
            "Type": "NS",
            "TTL": 172800,
            "ResourceRecords": [
                { "Value": "ns-1663.awsdns-15.co.uk." },
                { "Value": "ns-937.awsdns-53.net." },
                { "Value": "ns-1082.awsdns-07.org." },
                { "Value": "ns-199.awsdns-24.com." }
            ]
        },
        {
            "Name": "miempresaapp.com.",
            "Type": "SOA",
            "TTL": 900,
            "ResourceRecords": [
                {
                    "Value": "ns-1663.awsdns-15.co.uk. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"
                }
            ]
        }
    ]
}
```

### Task 2 confirmation vs dashboard

| Check | Expected | CLI result |
|---|---|---|
| Account | mi-empresa-app-multi | `613538400064` jakeadmin |
| Zone name | `miempresaapp.com` | `miempresaapp.com.` |
| Zone ID | `Z08064001E7SD9RESTGXE` | match |
| Public | yes | `PrivateZone: false` |
| Record count | 2 | 2 (NS + SOA only) |
| NS set | ns-1663 / ns-937 / ns-1082 / ns-199 | exact match |
| Extra zones | none for this name / no `app.` | only one hosted zone in account |
| Profile `disruptive` | unused | unused |

**MATCH.** Do not `create-hosted-zone` for the apex. Option B later needs a **different** zone named `app.miempresaapp.com` (not created this cycle).

Task 2 unblocked and complete.

---

## Task 3 — Pass C + Synthesis

- `research/domain-and-multi-tenant/03-pass-C.md` written (A-transfer + B working examples).
- `research/domain-and-multi-tenant/04-synthesis.md` written.
- `development/domain-and-multi-tenant/02-research-domain-and-multi-tenant.md` written.
- `completion-report.md` written.

**Final recommendation: Option B.** Confidence HIGH.

No mutations. Profile `disruptive` unused. All three tasks complete.
