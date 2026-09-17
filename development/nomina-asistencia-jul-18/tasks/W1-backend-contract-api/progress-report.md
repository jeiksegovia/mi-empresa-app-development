# Progress: W1-backend-contract-api

**Worker**: W1 — backend-eng  
**Started**: 2026-07-18  
**Finished**: 2026-07-18

---

## Subtask 1: Schema + contract — ✅ Done
- Migration `20260718100000_nomina_asistencia` applied via `npx prisma migrate deploy` (no shadow DB).
- Prisma client regenerated.
- Living contract: `development/nomina-asistencia-jul-18/orchestration-ctx/decisions/schema-contract-nomina-asistencia-jul-18.md`
- Domain `asistencia` added to `domainAccess.ts` (GERONTOLOGA false, CONTRATOS true).
- Pure additive nullable columns + new table — no PLAN-APPROVAL needed.

## Subtask 2: Medio pago — ✅ Done
- Empleado fields + Zod conditional validation + `syncMedioPagoPendiente`.
- POST/PUT pass `userId` for pendiente create/resolve.
- Constant: `Falta medio de pago de nómina`.

## Subtask 3: valorJornada — ✅ Done
- Contrato.valorJornada in schema + create path requires it (400 field `valorJornada`).
- Update optional.

## Subtask 4: Asistencia API — ✅ Done
- `asistenciaService.ts` + `asistencia.routes.ts` mounted at `/asistencia`.
- GET day, PUT /dia, GET /resumen.

## Subtask 5: Nómina calc — ✅ Done
- Period calc fields + defaults from asistencia/contrato.
- Aportes only FIJO/INDEFINIDO.
- Dual-write salario = totalPagado.
- GET /nomina enrichment: medio, asistenciaMes, sugerido.

## Subtask 6: Smoke specs — ✅ Done
```
npx playwright test tests/employees/medio-pago.spec.ts \
  tests/employees/contrato-valor-jornada.spec.ts \
  tests/asistencia/asistencia-dia.spec.ts \
  tests/nomina/nomina-calc-asistencia.spec.ts
→ 12 passed
```

---

## Issues / Blockers Encountered
- Local seed had empty cargos / no contratos → smoke specs self-seed cargo + employees + contratos.
- Zod `.partial()` fails after `.superRefine` → split base object + shared refine helper.

## Deviations (non-breaking)
See contract §9.
