# Decision: IAM stack deploy topology (blocks #8)

## Problem

`deploy-infrastructure.sh` deploys IAM as ONE global stack `miempresa-iam` with
`Environment=${STAGE}`, while iam-stack.yml names scoped resources per-env
(`CodeDeployInstanceRole-${Environment}`, `miempresa-bootstrap-${Environment}`). Deploying
`--stage staging` then later `--stage prod` on the SAME stack makes CFN REPLACE the staging-scoped
role/user with prod ones (RoleName change = delete+create) → **staging bricked after the prod
release**. The additive per-env intent is not achievable this way.

## Decision — Option B: one global stack declares BOTH envs (no Environment param)

Restructure so the single global `miempresa-iam` stack statically declares, in one template deployed
ONCE (no `Environment` parameter driving resource names):
- Legacy wildcard role + legacy bootstrap user (fixed names) — retained during migration.
- `CodeDeployInstanceRole-staging` + `CodeDeployInstancePolicy-staging` + `miempresa-bootstrap-staging`
  (+ key + SSM at `/miempresa/bootstrap/staging/*`), scoped to staging resources.
- `CodeDeployInstanceRole-prod` + `...-prod` + `miempresa-bootstrap-prod` (+ key + SSM at
  `/miempresa/bootstrap/prod/*`), scoped to prod resources.
- `SSMKMSKeyArn` stays a single param (aws/ssm key is one per account/region → same for both envs).

`deploy-infrastructure.sh`: deploy `miempresa-iam` ONCE, env-independent (drop `Environment` from the
IAM deploy; keep it for s3/ssm which ARE per-stage stacks). A second run (during the prod stage) is a
no-op on IAM. Both envs' scoped identities coexist; each INSTANCE migrates to its own identity at its
own time (staging now via #8, prod at #10). Retire legacy resources (remove from template + deploy)
only after BOTH instances are on scoped identities.

Acceptable alternative (Option A) if B is unwieldy: keep legacy in `miempresa-iam` (deployed once, no
scoped resources) and put per-env scoped role+bootstrap in a NEW per-env stack `miempresa-iam-${STAGE}`.
Do NOT duplicate fixed-name legacy resources across stacks.

## Validation before #8 apply

Prove no cross-env clobber: `aws cloudformation deploy --no-execute-changeset` (or `create-change-set`)
for the staging path, then reason that a subsequent prod-path deploy neither deletes nor replaces the
staging-scoped role/user. Confirm both scoped roles + both bootstrap users are present after one
deploy. This is part of the staging CHECKPOINT evidence.
