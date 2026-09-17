# Completion Report — W2c-nomina-dialog (Task 10)

**Worker**: frontend-eng  
**Slug**: nomina-asistencia-jul-18  
**Date**: 2026-07-18  
**Status**: COMPLETE

## Deliverables
| Path | Change |
|---|---|
| `frontend/app/pages/nomina/index.vue` | Registrar dialog enrichment (interfaces, summary, calc fields, save payload) |
| `frontend/tests/nomina/registrar-dialog-enrichment.spec.ts` | Mocked UI smoke (FIJO + OPS) |
| `frontend/tests/nomina/dialog-enrichment.spec.ts` | Alias stub (prefer registrar-dialog-enrichment) |

## Acceptance criteria

### 1. Interfaces extended
**VERIFIED** (source)

```
rg -n "medioPagoTipo|valorJornada|asistenciaMes|sugerido|mediasJornadas|aportesSociales|totalPagado" frontend/app/pages/nomina/index.vue | head
```

EmpleadoNomina has medio fields; Contrato has `valorJornada`; NominaEntrada has calc fields; NominaRow has `asistenciaMes` + `sugerido`.

### 2. Dialog read-only info
**VERIFIED** (template + smoke)

- Nombre completo / documento (`nomina-info-nombre`, `nomina-info-documento`)
- Medio display or **Sin medio de pago** (`nomina-medio-warning`)
- Tipo contrato + valor contrato or warn (`nomina-info-valor-contrato` / `nomina-valor-jornada-warning`)
- Asistencia del mes medias · horas + link `/asistencia`

### 3. Editable fields + prefill
**VERIFIED** (openDialog + smoke)

- Prefill: entrada → sugerido → asistenciaMes / contrato
- Medias jornadas, Valor media jornada editable
- Subtotal read-only computed (`recomputeSubtotal`)
- Aportes only when `TERMINO_FIJO` | `TERMINO_INDEFINIDO` (`aportesAllowed`)
- Total a pagar override; default subtotal+aportes
- Notas + archivo slots retained

### 4. Save body dual-write
**VERIFIED** (source)

```ts
// saveEntrada calcBody includes:
mediasJornadas, valorJornada, subtotalCalculado,
aportesSociales (0 if not allowed), totalPagado,
salario: dialogForm.totalPagado ?? dialogForm.salario,
notas, archivos
```

### 5. Cuenta-cobro unchanged
**VERIFIED**

```
rg -n "nomina-cuenta-cobro-error|archivos.CUENTA_COBRO" frontend/app/pages/nomina/index.vue
```

Inline Message + catch on `e?.data?.field === 'archivos.CUENTA_COBRO'` preserved.

### 6. data-testid (assignment)
**VERIFIED**

| testid | present |
|---|---|
| `nomina-medias` | yes |
| `nomina-valor-jornada` | yes |
| `nomina-aportes` | yes (v-if aportesAllowed) |
| `nomina-total` | yes |
| `nomina-guardar` | yes |

### 7. Spanish labels
**VERIFIED**: Medias jornadas, Valor media jornada, Subtotal, Aportes sociales, Total a pagar, Sin medio de pago.

### Smoke
**VERIFIED** — command + output:

```
$ TEST_FRONTEND_URL=http://localhost:3100 npx playwright test tests/nomina/registrar-dialog-enrichment.spec.ts --reporter=line
Running 2 tests using 1 worker
  2 passed (2.9s)
```

## Boundaries respected
- Did **not** modify `frontend/app/pages/asistencia/**`
- Did **not** modify `frontend/app/pages/empleados/**`
- Did **not** modify `backend/**`

## Deviations
| # | Assignment | Found | Decision |
|---|---|---|---|
| D1 | testid `nomina-medias` | Prior draft used `nomina-medias-jornadas` | Aligned to assignment |
| D2 | testid `nomina-guardar` | Prior draft used `nomina-save` | Renamed to `nomina-guardar` |
| D3 | File input visibility in smoke | `class="hidden"` on inputs | Smoke uses `toBeAttached()` for slots |

## Out of scope / NOT-VERIFIED
- Live unmocked UI against real admin session — NOT-VERIFIED (mocked route smoke only; FE :3100 was up)
- Backend calc persistence — owned by W1, not re-tested here
