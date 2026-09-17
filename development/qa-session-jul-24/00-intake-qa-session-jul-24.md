# Intake: qa-session-jul-24

## Objective
Implement the 7 QA items from `context/user-feedback/qa-session-jul-24-cleaned.md`
across Empleados, Cargos, Asistencia, and Contratos+Nómina.

## Input Source
- `context/user-feedback/qa-session-jul-24-cleaned.md` (structured requirements)
- `context/user-feedback/qa-session-jul-24-raw.md` (original)

## Decisions (from developer, this session)
1. **Cargo catalog reconciliation** → **Delete + recreate** the `cargos_empresa` seed to
   the new target list. Migration must verify no `Contrato` FK-blocks on staging before the
   deploy gate (Restrict FK). Local: safe.
2. **Contract salary model** → add `Contrato.valorMensual`; nómina branches on `tipoContrato`
   (OPS=jornada; OBRA_O_LABOR/TERMINO_FIJO/TERMINO_INDEFINIDO=monthly).
3. **Per-employee `Cargo` model** → hide UI in Información Laboral tab only; keep model/data/endpoints.
4. **Env** → implement locally (code + migration + tests) now; staging deploy is a separate
   gated step after local validation (explicit go-ahead required).

## Known Constraints
- Fast-track: cleaned feedback serves as the requirements doc.
- Local backend :3101, frontend :3100, db :15432. Never touch prod / port 4142.
- `cargos_empresa` unique (empresa_id, nombre); `Contrato.cargoId` onDelete: Restrict.

## Open Questions — RESOLVED (see Decisions above)
