# aug-28 — Ocultar beneficiario on centro de costos

## Task
Valoraciones (and any INGRESOS centro): ADMIN can hide the beneficiario field so it is not required when creating an ítem.

## Plan
Additive boolean `CentroCostos.ocultarBeneficiario` (default false). Seed + migration set Valoraciones to true. Service skips required check when the flag is on; UI hides the dropdown.

## Output
- Migration `20260828120000_ocultar_beneficiario`
- API: create/update centro accept `ocultarBeneficiario`; INGRESOS create item allows null beneficiario when flag is true
- UI: checkbox "Ocultar campo beneficiario (no requerido)" on centro dialog; item dialog hides Beneficiario when flag is on
- Tests: backend `ocultar-beneficiario.spec.ts`; frontend smoke for Valoraciones
