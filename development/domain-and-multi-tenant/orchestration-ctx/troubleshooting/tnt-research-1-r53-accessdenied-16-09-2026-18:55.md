# Troubleshooting: Route 53 AccessDenied on jakeadmin

**When**: 2026-09-16 ~18:53–18:56
**Worker**: tnt-research-1
**Task**: #2 Route 53 read-only inventory

## Symptom

`aws route53 list-hosted-zones|get-hosted-zone|list-resource-record-sets --profile mi-empresa-app-multi` returned AccessDenied:

> User: arn:aws:iam::613538400064:user/jakeadmin is not authorized to perform: route53:* because no identity-based policy allows the action

STS succeeded: Account `613538400064`, user `jakeadmin`. Profile `disruptive` unused. No mutations.

## What was NOT the cause

- Missing policy: group `admin` already has AWS managed `AdministratorAccess`.
- Permissions boundary: none on the user.
- Organization SCP: account is not in an org (`AWSOrganizationsNotInUseException`).
- Wrong profile / wrong account: STS ARN matches.

## Actual cause

IAM eventual consistency on a brand-new user/group/key (created 2026-09-16T23:27Z). `iam simulate-principal-policy` already returned `allowed` while Route 53 still denied. ~30 minutes after user creation, `list-hosted-zones` succeeded without any policy change.

## Resolution

No extra IAM attach. Retry Task 2 with the same four read-only commands.

Lead verify (18:56): one public zone `Z08064001E7SD9RESTGXE` / `miempresaapp.com.` / `ResourceRecordSetCount: 2`.
