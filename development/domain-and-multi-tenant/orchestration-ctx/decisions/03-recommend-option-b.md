# Decision: recommend Option B (developer gate still open)

**Date**: 2026-09-16
**Status**: recommended, not executed. Developer must pick.

tnt-research-1 COMPLETE. Confidence HIGH. Lead spot-checked parent NS, WHOIS, FAQ, and Route 53 CLI. MATCH.

Pick:

- **B (recommended v1)**: CF stays registrar+apex DNS. New R53 zone for `app.miempresaapp.com`. CF DNS NS-delegates `app`. Optional CF redirect apex/www.
- **A-transfer (later)**: after 2026-11-10, leave CF Registrar, set apex NS to `Z08064001E7SD9RESTGXE`.
- **A-strict**: rejected (CF Registrar FAQ).

Do not execute B until developer go. Do not recreate apex zone. Do not use profile `disruptive`.

Note: worker report said "IAM admin group attached"; lead found the group already had AdministratorAccess. Cause was IAM eventual consistency. No extra policy was attached.
