# Team Status: fixes-features-aug-6

**Updated**: 2026-08-06 · **Phase**: 4 CONVERGED + DEPLOYED to staging

**Deploy**: CodeDeploy `d-MR1QVXIZK` Succeeded · Amplify job 14 · migrations 28 · SIGNOS_VITALES + BOLETIN_ANUAL active · smoke PASS. Runbook: `context/implementation-plan/staging-release-fixes-features-aug-6-runbook.md`.

## Worker Roster
| Name | Role | State | Current |
|---|---|---|---|
| worker-1 | pt-data-schema | PARKED | T1-T3 done + verified |
| worker-2 | pt-backend-eng | PARKED | T4-T7 done + VERIFIED by orchestrator (aug6 25 + matrix-parity 4 = 29/29 pass) |
| worker-3 (→worker-3-2) | pt-frontend-eng | ACTIVE | T8/T9/T10 done; fix-up T15 (3 test-locator + codigo guard) in progress |

## Convergence run (orchestrator, 2026-08-06)
- BE `aug6-features` + `matrix-parity`: **29/29 pass** ✓ (W2 verified independently).
- FE `roles-aug-6.spec.ts`: 5/8; **3 failures = TEST DEFECT** (strict-mode: heading 'Paciente Prueba' matches h1+h2) — app UI fine. Routed to W3 (T15).
- Gerontologa bug: W3's crear.vue rolesPermitidos-default (creator role) fixes the user's repro (entered id). Latent null-codigo fill hole → T15 requires codigo-with-template.
- Pre-existing (NOT this wave): patient-notes TZ (4), instruments-dynamic Tailscale IP + TINETTI v5 drift (5). TEST-ENV.

## Convergence notes
- W2 diagnosis: gerontologa bug (contract §3.1) does NOT reproduce on local — caller CSV EMPLEADO,GERONTOLOGA intersects ADMIN,EMPLEADO seed. Real symptom likely FE "create-from-template-without-codigo" (definition.codigo=null → can't fetch by codigo). VERIFY W3's T9 handles this FE path before declaring the bug fixed.
- FE specs are MOCKED (typecheck-clean); orchestrator must RUN them (:3100) at convergence.

## Log
- 2026-08-06: user STOPPED all 3 workers mid-flight. Done: T1-T4, T8, T9. Re-spawned W2 (T5/T6/T7) + W3 (T10) per user. Added [DEPLOY] task #14 (blockedBy 7,10) — orchestrator handles staging release after convergence, developer-gated before R4.

## Tasks
| ID | Title | Owner | Status | BlockedBy |
|---|---|---|---|---|
| 1 | [W1] contract | worker-1 | pending | — |
| 2 | [W1] enum migration | worker-1 | pending | 1 |
| 3 | [W1] 2 templates | worker-1 | pending | 1 |
| 4 | [W2] matrix+read-only+certificados | worker-2 | pending | 1 |
| 5 | [W2] rolesPermitidos+geronto bug | worker-2 | pending | 1 |
| 6 | [W2] notes privacy | worker-2 | pending | 1 |
| 7 | [W2] BE tests | worker-2 | pending | 2,3,4,5,6 |
| 8 | [W3] useDomainAccess mirror | worker-3 | pending | 1 |
| 9 | [W3] instrument+notes UI | worker-3 | pending | 1 |
| 10 | [W3] FE tests | worker-3 | pending | 8,9 |

## Log
- 2026-08-06: intake + plan approved (3 workers, read-only pacientes). Tasks 1–10 created. Spawning worker-1.
