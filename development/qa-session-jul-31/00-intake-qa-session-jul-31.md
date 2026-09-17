# Intake: qa-session-jul-31

## Objective
Implement the 3 app requirements extracted from the Jul-31 QA session, continuing the qa-session-jul-24 cycle:
- **R1** — Rename medio de pago label `Nequi` → `Nequi/Bre-B` (UI display only).
- **R2** [MAIN] — Nómina "Registrar" dialog must adapt to contract type: for TERMINO_FIJO / TERMINO_INDEFINIDO / OBRA_O_LABOR, show **Valor Mensual** as the base (hide jornada inputs); OPS keeps jornada calc.
- **R3** — Add optional **EPS**, **Fondo de pensiones**, **ARL** fields to crear empleado (datos personales).

## Assumptions
- Backend already stores `Contrato.valorMensual` and `nominaService.resolveCalcFields` branches OPS→valorJornada / others→valorMensual (jul-24 R7). R2 is primarily a **frontend** dialog gap + a backend suggestion-payload check.
- Enum stored value `NEQUI` stays; R1 is a display-string change only (no schema/enum change).
- R3 requires a new migration adding 3 nullable text columns to `Empleado`.

## Open Questions
- (RESOLVED with developer 2026-08-02) Scope = R1+R2+R3, no centros de costos.
- (RESOLVED) OBRA_O_LABOR in nómina dialog → Valor Mensual like FIJO/INDEF, but no aportes.
- [confirm-with-user] Field type for EPS/Fondo/ARL → free-text VARCHAR vs enum/catalog. Default: free-text VARCHAR(100), matching `bancoNombre` pattern.

## Known Constraints
- No prod AWS. Migrations gitignored (ship in CodeDeploy artifact).
- Follow jul-24 contract-first pattern; extend existing services (no new routes/services).
- Local: backend :3101, frontend :3100, postgres docker :15432.

## Input Source
- Raw: `context/user-feedback/qa-session-jul-31-raw.md`
- Cleaned: `context/user-feedback/qa-session-jul-31-cleaned.md`
- Prior cycle contract (template): `development/qa-session-jul-24/orchestration-ctx/decisions/contract-schema-qa-jul-24.md`

**Fast-track**: requirements already cleaned + developer-confirmed → intake and requirements are effectively done; proceed to Feature Plan.
