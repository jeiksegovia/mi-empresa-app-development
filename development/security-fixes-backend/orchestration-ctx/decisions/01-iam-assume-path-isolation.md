# Decision: IAM assume-path isolation (refines fix-contract §A)

## Why (gap found in #7 review)

Scoping the per-env role RESOURCES (done in iam-stack.yml) reduces blast radius but does NOT fully
close CH-1 by itself, because the ASSUME PATH is still shared:

- One global `miempresa-bootstrap` user with ONE long-lived access key; that key lives on BOTH the
  staging and prod instances (refresh-credentials.sh uses it every 45 min to assume the role).
- The authored `BootstrapUserPolicy` lets that single user assume BOTH `CodeDeployInstanceRole-staging`
  and `-prod`, and each `ScopedInstanceRole` trust policy allows `:root` (any account principal).

Net: a staging-host compromise still yields the shared bootstrap key → `sts:AssumeRole` the PROD
scoped role → prod data. The resource scoping is necessary but not sufficient.

## Required refinement (still policy/role/user only — no S3/KMS resource changes)

1. **Per-env bootstrap users**: `miempresa-bootstrap-${Environment}`. Each can assume ONLY its own
   env's scoped role. Each instance holds ONLY its env's bootstrap key (staging box = staging
   bootstrap key; prod box = prod bootstrap key). refresh-credentials.sh reads the env-appropriate
   key + role ARN.
2. **Scoped trust policy**: each `ScopedInstanceRole` `AssumeRolePolicyDocument` Principal = its
   env's bootstrap user ARN (NOT `:root`).
3. Keep the legacy wildcard `CodeDeployInstanceRole` + the legacy bootstrap key during the additive
   migration; retire both only after BOTH instances run on their scoped per-env identity.

If per-env bootstrap users make the credential-refresh migration too risky to do safely without prod
impact (this touches the B16 STS-refresh path), STOP and `TURNING-POINT-BREAKING:` with the specific
blocker + options (fallback option: single bootstrap user but per-env `sts:ExternalId` — each env's
refresh uses its own ExternalId secret stored under `/miempresa/<env>/`, and each role's trust
policy requires the matching ExternalId; a staging compromise gets only staging's ExternalId).

## Validation (extends the tmp tests — developer-mandated)

`tmp/iam-validate/` must now ALSO prove the assume path, using the STAGING instance's actual
credential chain (the bootstrap identity the box uses), not just the assumed role:
- staging identity CAN assume `CodeDeployInstanceRole-staging` and read `/miempresa/staging/*`.
- staging identity CANNOT `sts:AssumeRole CodeDeployInstanceRole-prod` (expect AccessDenied).
- staging scoped role CANNOT read `/miempresa/prod/*` or prod uploads (existing test).
Capture verbatim allow + AccessDenied. This is the gate the orchestrator confirms at the staging
CHECKPOINT before the app deploy and before prod.

## Scope note

This is squarely "narrow via policies/roles/users, no resource changes" (developer constraint Q1).
No S3 bucket / KMS key resource is modified.
