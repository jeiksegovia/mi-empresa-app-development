# Progress: W2c-nomina-dialog

**Worker**: frontend-eng (W2c)  
**Task ID**: 10  
**Status**: completed

## Subtasks
1. ✅ Extend NominaRow / local interfaces (medio, valorJornada, asistenciaMes, sugerido, calc on entrada)
2. ✅ Dialog read-only summary (nombre, doc, medio/warn, contrato+valor/warn, asistencia + link)
3. ✅ Editable calc fields prefill entrada||sugerido; aportes only FIJO/INDEFINIDO; subtotal read-only
4. ✅ Save body: medias, valor, subtotal, aportes, totalPagado, salario=totalPagado dual-write, notas, archivos
5. ✅ Keep cuenta-cobro slots/errors unchanged
6. ✅ Spanish labels + assignment data-testids
7. ✅ Smoke: `frontend/tests/nomina/registrar-dialog-enrichment.spec.ts` (2 passed)

## Notes
- Script-side calc/open/save was already partially present; completed template alignment to assignment testids/labels.
- Subtotal is disabled/readonly client-side (`medias × valor`).
- Aportes hidden for OPS/OBRA_O_LABOR; forced 0 on save.
