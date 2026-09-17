# Decision: child hosted zone IDs (app. + www.)

**Date**: 2026-09-16
**Status**: created
**Profile**: `mi-empresa-app-multi` / `us-east-1` / account `613538400064`

Do not recreate these zones. Do not recreate apex `Z08064001E7SD9RESTGXE`.

## Apex (parked, unchanged)

- Name: `miempresaapp.com.`
- HostedZone Id: `Z08064001E7SD9RESTGXE`
- DelegationSet NS (do **not** use as child NS):

```
ns-1663.awsdns-15.co.uk
ns-937.awsdns-53.net
ns-1082.awsdns-07.org
ns-199.awsdns-24.com
```

## app.miempresaapp.com (platform)

- Name: `app.miempresaapp.com.`
- HostedZone Id: `Z04792861CQBYDQH6TXG9`
- CallerReference: `app-miempresaapp-1789603720`
- Comment: `multi-tenant platform subdomain`
- PrivateZone: false
- Record count at create: 2 (SOA+NS)
- ChangeInfo: `C079109812YRYC7TTL0F4` (PENDING at create)
- DelegationSet NS:

```
ns-1600.awsdns-08.co.uk
ns-868.awsdns-44.net
ns-1140.awsdns-14.org
ns-147.awsdns-18.com
```

Env form for verify.sh:

```
APP_NS="ns-1600.awsdns-08.co.uk ns-868.awsdns-44.net ns-1140.awsdns-14.org ns-147.awsdns-18.com"
```

## www.miempresaapp.com (marketing)

- Name: `www.miempresaapp.com.`
- HostedZone Id: `Z04792813FUVIP6WX8WTN`
- CallerReference: `www-miempresaapp-1789603721`
- Comment: `marketing www subdomain`
- PrivateZone: false
- Record count at create: 2 (SOA+NS)
- ChangeInfo: `C07912933L35I1B0BPCYG` (PENDING at create)
- DelegationSet NS:

```
ns-1259.awsdns-29.org
ns-922.awsdns-51.net
ns-477.awsdns-59.com
ns-1595.awsdns-07.co.uk
```

Env form for verify.sh:

```
WWW_NS="ns-1259.awsdns-29.org ns-922.awsdns-51.net ns-477.awsdns-59.com ns-1595.awsdns-07.co.uk"
```

## Inventory gate

`list-hosted-zones` after create: exactly three public zones.

| Id | Name | Private | Records |
|---|---|---|---|
| `Z08064001E7SD9RESTGXE` | `miempresaapp.com.` | false | 2 |
| `Z04792861CQBYDQH6TXG9` | `app.miempresaapp.com.` | false | 2 |
| `Z04792813FUVIP6WX8WTN` | `www.miempresaapp.com.` | false | 2 |

Child DelegationSets are not equal to the apex NS set.
