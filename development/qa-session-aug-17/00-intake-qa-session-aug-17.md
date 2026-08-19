# Intake: qa-session-aug-17

## Objective
Implement the next QA cycle from the 2026-08-17 walkthrough: empleados default-activos, CONTRATOS GET cargos, nómina bonos + total-without-aportes, periodos 400 for FIJO, and (if approved) a simple activity log for PROFESORES/AUXILIARES. Do **not** re-implement SIGNOS/BOLETIN v2.

## Assumptions
- Input source is `context/user-feedback/qa-feedbacl-aug-17.md`, **not** the Pendo `initial-ask.md` path passed to `/planify-team`.
- Existing patterns: `requireDomain` / `requireEmployeeUnlocked`, `usaValorMensual`, `NominaPeriodo` decimals, instrument templates via `instruments:upgrade`.
- Orchestrator does not implement; workers do after developer confirms this cleaned list + answers Qs.
- Commit only on explicit instruction. Deploy is a later gated task.
- Working tree is already dirty (~119 files); this cycle adds more — do not "clean up" unrelated files.

## Open Questions — LOCKED 2026-08-18

| Q | Decision |
|---|---|
| Q1 source | `qa-feedbacl-aug-17.md` (Pendo path discarded) |
| Q2 filter UI | Two tabs **Activos \| Inactivos**. Default Activos. No Todos. |
| Q3 cargos | GET `/empresa/cargos` only for CONTRATOS. `empresa` matrix stays `false`. |
| Q4 bonos | **FIJO + INDEFINIDO only**. Never OPS/OBRA. |
| Q5 periodos write | CONTRATOS can registrar (drop ADMIN-only on POST/PUT). Lock still applies. |
| Q6 consistency | No asistencia↔log warning in v1. |
| Q7 domain | New domain `actividades`. Nav **below Asistencia**. |
| Q8 scope | **R1 + R2 + R3 + R4 + R6**. R5 skip. |
| R6 ACL (user addendum) | ADMIN full CRUD. PROFESORES/AUXILIARES view+create **own** only. GERONTOLOGA/CONTRATOS **view all**, no mutate. |

## Known Constraints
- Staging current: `d-13RWC0Q4L` / Amplify job 15, 28 migrations.
- No staging QA users for PROFESORES/AUXILIARES yet (needed if R6 is in).
- `CONTRATOS.empresa = false` is intentional for catalog writes; R2 is a **read** hole.
- `resolveCalcFields` currently `total = valorMensual + aportes` — R3 **changes money math**. Tests that assert old total must be updated, not loosened.
- Migrations gitignored; ship only via CodeDeploy artifact.
- Filename casing: kebab-case under `development/`.

## Input Source
- Raw: `context/user-feedback/qa-feedbacl-aug-17.md`
- Cleaned: `context/user-feedback/qa-session-aug-17-cleaned.md`
- Prior contracts: jul-31 (valorMensual), aug-6 (roles + lock + instrumentos), aug-6 followup (CONTRATOS contratos + v2 templates)
- Resume: `context/resume-session/summary-2026-08-17.md`

## Existing components (mapped)

| Item | Layer | Files |
|---|---|---|
| R1 | FE | `frontend/app/pages/empleados/index.vue` (`estadoFilter`) |
| R2 | BE | `domainAccess.ts` `DOMAIN_ACCESS.CONTRATOS.empresa`; `empresa.routes.ts` `router.use(requireDomain('empresa'))` + GET `/cargos` |
| R3 | FE+BE+DB | `nomina/index.vue`; `nomina.routes.ts` `nominaPeriodoSchema`; `nominaService.resolveCalcFields`; `schema.prisma` `NominaPeriodo` |
| R4 | BE | `POST /nomina/periodos` + `resolveCalcFields` + possible ADMIN-only guard |
| R5 | — | SIGNOS/BOLETIN **v2 already active** |
| R6 | NEW | no `actividad` module today; closest pattern = `asistencia` today-only PUT |
