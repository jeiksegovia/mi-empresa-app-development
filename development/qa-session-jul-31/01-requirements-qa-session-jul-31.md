# Requirements: qa-session-jul-31

## Functional Requirements

| ID | Requirement | Acceptance Criterion | Research? |
|----|-------------|----------------------|-----------|
| R1 | Rename medio de pago label `Nequi` → `Nequi/Bre-B` in all UI surfaces | In empleados/nuevo, empleados/[id]/index, empleados/[id]/editar, and nomina/index, the payment option/label reads "Nequi/Bre-B". Stored enum value stays `NEQUI`. No backend change. | No |
| R2 | Nómina Registrar dialog adapts to contract type (Valor Mensual) | For a contract of tipo TERMINO_FIJO / TERMINO_INDEFINIDO / OBRA_O_LABOR, the registrar/editar dialog hides Medias jornadas + Valor media jornada inputs and the "valor media jornada (contrato)" info/warning; shows **Valor Mensual** (from contract) as subtotal base. FIJO/INDEF keep editable Aportes sociales; OBRA has no aportes. Total a pagar = valorMensual (+ aportes for FIJO/INDEF), still manually adjustable. OPS unchanged (medias × valor jornada). | No |
| R2b | Backend nómina suggestion returns valorMensual base for non-OPS | GET /nomina row `sugerencia`/`entrada` for non-OPS contracts provides `subtotalCalculado`/base derived from `Contrato.valorMensual` so the FE can prefill without reading jornada. Persisted calc respects jul-24 resolveCalcFields branch. | No |
| R3 | Add optional EPS, Fondo de pensiones, ARL to crear empleado | New nullable fields `eps`, `fondoPensiones`, `arl` on Empleado; present in datos personales of empleados/nuevo (optional, no validation block); shown in empleado details; editable in editar. Backend create/update accepts + persists them. | No |

## Non-Functional Requirements
- No regression to jul-24 items (EFECTIVO, Nequi llave validation, cargos, asistencia RBAC, valorMensual contract creation).
- New backend + frontend tests per CLAUDE.md testing rules (Playwright specs in respective tests/ dirs).
- Migration must be idempotent/re-runnable on staging (additive nullable columns).

## Out of Scope
- Centros de costos / cajas (ingresos/egresos) — deferred to a separate cycle (developer decision 2026-08-02).
- Google Drive / Excel sync mismatch — not an app issue.
- Any enum/catalog for EPS/Fondo/ARL (free-text for now).
- Staging deploy — gated, separate step after implementation + local QA.
