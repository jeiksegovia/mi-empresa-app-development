# Decision: v1 DNS = `app.` platform + `www.` marketing (both Route 53 child zones)

**Date**: 2026-09-16
**Status**: locked. Developer go to configure DNS only (no Amplify/app deploy).

## Product split (developer 2026-09-16)

- `app.miempresaapp.com` — all platform / app flow
- `www.miempresaapp.com` — Amplify marketing / main website (no platform)
- Apex `miempresaapp.com` stays on Cloudflare Registrar + Full DNS (A-strict still not offered)
- Existing apex R53 zone `Z08064001E7SD9RESTGXE` stays empty/parked for optional A-transfer after 2026-11-10
- No demo webpage, no Amplify app, no service deploy. Pure DNS + Route 53.

## How (v1)

Create **two new** public hosted zones in `mi-empresa-app-multi` (account `613538400064`):

1. `app.miempresaapp.com`
2. `www.miempresaapp.com`

Then in Cloudflare **DNS** (not Registrar), NS-delegate each name with the four NS of **that** new zone. Do not reuse apex NS set `Z08064001E7SD9RESTGXE`.

Why www is a child hosted zone (not a Cloudflare CNAME yet): there is no Amplify domain to CNAME to. An empty R53 zone is the placeholder later Amplify/CloudFront records go into. Amplify "use Route 53" auto-attach looks for zone `miempresaapp.com`, which is **not** authoritative today, so later Amplify custom domain for `www` will use DNS provider "other" (or records copied into the `www.` zone). Do not pretend Amplify can write into the dormant apex zone.

## Out of bounds

- No second apex `create-hosted-zone`
- No profile `disruptive`
- No registrar unlock/transfer
- No apex/`www` HTTP redirect to `app` (www is marketing, not a redirect to platform)
- No token in git/markdown
