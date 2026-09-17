# Context map: team-tenancy vs team-security

Two orchestrations share `/Users/jeik/ws/mi-empresa-app-development`. They MUST NOT share folders, worker names, AWS profiles, or TaskList ownership.

| | **team-security** | **team-tenancy** (this session) |
|---|---|---|
| Slug | `security-audit-backend` | `domain-and-multi-tenant` |
| Prefix | `sec-*` | `tnt-*` |
| Folder | `development/security-audit-backend/` | `development/domain-and-multi-tenant/` |
| Research | (none this cycle) | `research/domain-and-multi-tenant/` |
| AWS profile | staging/dedicated as their plan says (not this team) | **`mi-empresa-app-multi` only** |
| Forbidden AWS | their own gates | **`disruptive`** (live dedicated stacks) |
| Domain | N/A | `miempresaapp.com` (multi-tenant product) |
| Dedicated product | out of bounds | `disruptiveexp.com` / emkasa-like dedicated = out of bounds |
| This-cycle goal | backend+infra+frontend security audit | DNS authority validation + recommended cutover steps |
| Later (not now) | remediations | multi-tenant implementation |

## Collision rules

1. Never `Write`/`Edit` under the other team's `development/{slug}/`.
2. Never spawn a worker whose name matches the other prefix.
3. Never reuse TaskList IDs as if they were global across sessions. This session's tasks are tnt-only.
4. Never run AWS against a profile the other team owns.
5. Status files: `team-status-domain-and-multi-tenant.md` vs `team-status-security-audit-backend.md`.

## AWS profile split (load-bearing)

- `disruptive` = dedicated mi-empresa-app already running (Amplify `disruptiveexp.com`, Lightsail staging/prod). Dangerous to mix.
- `mi-empresa-app-multi` = empty/new account for `miempresaapp.com` multi-tenant. Credentials exist in `~/.aws/credentials` as `[mi-empresa-app-multi]`. Not listed in `~/.aws/config` (no region default). Always pass `--profile mi-empresa-app-multi` and `--region us-east-1` when a region is required. Route 53 is global but CLI often wants a region for signing.

## Cloudflare API token (SECRET)

- File (gitignored): `development/domain-and-multi-tenant/.env`
- Variable: `CLOUDFLARE_API_TOKEN`
- Purpose: `edit-dns-zone` for `miempresaapp.com` (developer-created 2026-09-16)
- Template (no secret): `development/domain-and-multi-tenant/.env.example`
- Do **not** put the token in markdown, spawn prompts, git, or team-status.
- Do **not** use it until the developer approves a DNS mutation. This cycle remains research-only.
- Token is Cloudflare, not AWS. Never use against dedicated/`disruptive` stacks.
