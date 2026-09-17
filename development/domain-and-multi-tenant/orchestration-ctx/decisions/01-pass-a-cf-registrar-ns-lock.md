# Decision: Option A-strict is not offered (Cloudflare Registrar NS lock)

**Date**: 2026-09-16
**Status**: locked (mechanics). Product pick A-transfer vs B waits for synthesis + developer go.
**Source**: tnt-research-1 Pass A + orchestrator independent verify.

## What is true on the wire

| Probe | Result |
|---|---|
| `.com` parent `dig +norecurse NS @a.gtld-servers.net` | `ed.ns.cloudflare.com`, `paityn.ns.cloudflare.com` only |
| WHOIS Name Server | same two names |
| WHOIS Registrar | Cloudflare, Inc. (IANA 1910) |
| WHOIS status | `clientTransferProhibited` |
| Creation | 2026-09-11T16:29:30Z |
| Recursive `dig NS @1.1.1.1` | **6** NS (2 Cloudflare + 4 Route 53) |
| SOA MNAME | `ed.ns.cloudflare.com` |

Recursive 6-NS is Cloudflare **serving** in-zone Route 53 NS records. Parent delegation did not move. In-zone NS cannot transfer apex authority.

## Why "update nameservers at the registrar" felt blocked

Official FAQ last-updated **Aug 3, 2026** (https://developers.cloudflare.com/registrar/faq/):

> Can I use my own (third-party) nameservers? **No, all domains on Cloudflare Registrar use Cloudflare nameservers** ... If you only need a subdomain to be on a different service provider, you can **delegate a subdomain**. ... Business/Enterprise custom nameservers are **Cloudflare NS with branded names**. If you still need to use different nameservers, **you will have to move your domain to another Registrar**.

Buying the domain on Cloudflare makes them registrar **and** forces Cloudflare nameservers. There is no other registrar behind Cloudflare for this domain. The DNS app (in-zone NS) is the wrong surface. The Registrar app will not accept Route 53 NS.

## Locked implications

1. **A-strict** (keep Cloudflare Registrar + point apex NS at existing Route 53 zone `Z08064001E7SD9RESTGXE`) = **not offered**. Do not tell the operator to "just change nameservers in Cloudflare."
2. **A-transfer** (leave Cloudflare Registrar after ICANN 60-day lock, then set Route 53 NS at the new registrar) is the only apex-on-R53 path. Earliest transfer-out ~**2026-11-10** (registered 2026-09-11).
3. **B** (keep Cloudflare Full apex; NS-delegate `app.miempresaapp.com` to a **new** Route 53 hosted zone) is Free-plan compatible and works now. Do **not** reuse the apex zone for the child.
4. Partial/CNAME setup is Business/Enterprise and **not supported on Cloudflare Registrar**.
5. No mutations this cycle. Final A-transfer vs B is a developer gate after synthesis.

## Orchestrator verify (2026-09-16 18:51)

Parent NS, WHOIS registrar/NS/lock/creation, recursive 6-NS, SOA MNAME, and the FAQ quote were re-run / re-fetched by the lead. All CONFIRMED.
