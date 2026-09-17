# Intake: staging-release-jul22-fixes

## Objective
Ship fixes-jul-22 to staging end-to-end: BE CodeDeploy + instruments:upgrade + FE Amplify + canary. No DB wipe.

## Decisions
- Additive deploy (no clean reset)
- Auto-chain R0→R6
- AWS disruptive / us-east-1 / miempresa-staging only

## Source
- fixes-jul-22 handoff + contract
- jul18 staging runbook patterns
