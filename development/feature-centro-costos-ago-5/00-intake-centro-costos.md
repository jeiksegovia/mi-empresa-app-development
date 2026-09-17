# Intake — Centro de Costos (ago-5)

**Source raw transcript**: `context/user-feedback/featured-ago-4-centro-costos-raw.md`
**Prior cycle**: `development/qa-session-jul-31/followup-aug-04-completion.md` (shipped to staging 2026-08-04, CodeDeploy `d-EDEN0GJYK`, Amplify job 13, 26 migrations)
**Resume anchor**: `context/resume-session/summary-2026-07-31.md`

---

## 1. Objective

Build the **Centro de Costos** module — sibling of Reportes and Nómina — to organize the
company's **ingresos** and **egresos** into cost centers so a monthly
`total ingresos − total egresos = balance` can be produced.

---

## 2. Requirements extracted from the transcript

### 2.1 Domain model (stated almost verbatim by the user)

> "La estructura en el esquema sería centros de costos que pueden ser de ingresos o egresos.
> Esos centros de costos tienen ítems. Cada ítem tiene nombre, notas, cantidad, valor unitario,
> valor total y el periodo que es una fecha y estos se agrupan por mes."

- A **centro de costos** is typed: `INGRESOS` or `EGRESOS`.
- A centro de costos is *"un arreglo de entradas"* — it holds **ítems**.
- Every ítem, income or expense, has the **same** structure:
  `nombre`, `notas`, `cantidad`, `valorUnitario`, `valorTotal (= cantidad × valorUnitario)`, `periodo`.
- **Periodo is monthly for everything**: *"sí, mensual. Todos son mensual. Todo este informe se saca mensual."*
- Sum of ítem totals within a centro → centro total. Sum of centros → total ingresos / total egresos.

### 2.2 Resolved ambiguity — unit value on egresos

The transcript contains a live debate: the user's existing egresos spreadsheet shows consolidated
monthly values with no `valor unitario`, and they ask *"ahí cómo es la mejor organización?"*.
The exchange resolves explicitly:

> "eso grande, cantidad dos, valor unitario y el valor. Sí. Okay. La idea es hacerlo así por
> valor unitario. — **Exacto.**"

→ **Decision**: one uniform ítem shape for both types. `cantidad` + `valorUnitario` always present
(consolidated entries are simply `cantidad = 1`).

### 2.3 Egreso-only optional fields

> "como adición en los ítems … de egreso … número de factura, proveedor y fecha."

→ `numeroFactura`, `proveedor`, `fechaFactura` — **optional**, meaningful for EGRESOS ítems.

### 2.4 Default centros de costos to seed

**INGRESOS** (5)
| # | Centro | Transcript note |
|---|---|---|
| 1 | Mensualidades completas | — |
| 2 | Mensualidades por día | *"la jornada dos, que son tres días a la semana"* |
| 3 | Transporte | *"los ingresos que tenemos por transporte"* |
| 4 | Ingresos adicionales | — |
| 5 | Valoraciones | *"porque aquí me las tienen mezcladas, pero no es la idea … yo ya sé cuánto entró por valoraciones"* — must be its own centro, not mixed in |

**EGRESOS** (6)
| # | Centro |
|---|---|
| 1 | Refrigerios |
| 2 | Aseo |
| 3 | Papelería |
| 4 | Eventos |
| 5 | Nómina |
| 6 | Mantenimiento |

### 2.5 Explicitly OUT of scope (user's words)

> "Luego ya tiene el tema de la visualización, cómo visualizar cada uno de esos centros de costos
> independientemente, tener reportes independientes, **pero eso está fuera del scope por el momento**.
> Ahora es crear la estructura del esquema en la base de datos."

→ No independent per-centro report views, no month-over-month comparison, no export this cycle.

### 2.6 Noise filtered out

Lines 7–8, 12–17 and 28–30 of the raw transcript are screen-sharing chatter
("¿cuál es Inés?", "Berta, Ligia, Yolanda Tobar", "ya empezaron a entrar los pagos de agosto")
— these are **sample data being read aloud from an existing spreadsheet**, not requirements.
`Inés / Berta / Ligia / Yolanda Tobar` are example ítem *notas* for a Valoraciones income ítem,
confirming that `notas` is free text listing detail behind a consolidated entry.

---

## 3. Developer decisions (confirmed 2026-08-05)

| # | Question | Decision |
|---|---|---|
| D1 | Disposition of the pre-existing unused FINANCE MODULE | **Audit exactly, then remove unused finance and replace with the new schema.** Must not touch any table/enum related to nómina or empleados. |
| D2 | Cycle scope | **Schema + API + minimal CRUD UI.** Month selector, ítems table per centro, totals, ingresos-vs-egresos balance. Backend + frontend Playwright specs. No reporting module. |
| D3 | Nómina egresos centro | **Manual ítems.** Nómina keeps its own system (it accounts for tipo de contrato and working hours) — the two modules stay **independent**. Future ingestion of the closed monthly nómina spend into centro-de-costos is acknowledged but **out of scope**. |
| D4 | RBAC | **ADMIN + CONTRATOS**, following the existing `DOMAIN_ACCESS` matrix pattern. |

---

## 4. Pre-existing FINANCE MODULE audit (completed — read-only)

Located at `backend/prisma/schema.prisma` lines **720–804** under the `// FINANCE MODULE` banner,
originating from migration `20260218003359_initial_schema`.

### 4.1 Code references
`grep` across `backend/src`, `backend/tests`, `frontend/app`, `frontend/tests`, `backend/prisma/seed.ts`
→ **zero application references**. The only hits are in `backend/src/generated/prisma/` (auto-generated
client, regenerates from schema). The module is dead scaffolding for a product-catalog/invoicing
concept that was never built and does not match §2.1.

### 4.2 Live local DB state (`miempresa-postgres` :15432, `miempresa_dev`)

| Table | Exact row count |
|---|---|
| `centros_costos` | **0** |
| `productos_servicios` | **0** |
| `egresos` | **0** |
| `prefacturas` | **0** |

### 4.3 Foreign-key graph (complete)

```
egresos.centro_costos_id             → centros_costos      (internal)
productos_servicios.centro_costos_id → centros_costos      (internal)
prefacturas.producto_servicio_id     → productos_servicios (internal)
prefacturas.cliente_id               → clientes            ← ONLY outbound edge
```

**No FK from or to any nómina or empleado table.** Verified via `pg_constraint`: nothing outside
these 4 tables references them. The subgraph is self-contained apart from `prefacturas → clientes`.

### 4.4 Enums

| Enum | Labels | Disposition |
|---|---|---|
| `TipoCentroCostos` | `INGRESOS, EGRESOS` | **KEEP** — already exactly what §2.1 needs |
| `EstadoPrefactura` | `BORRADOR, ENVIADO, PAGADO` | **DROP** — invoicing only |

### 4.5 Prisma back-relation that must also be removed
`Cliente.prefacturas Prefactura[]` — `schema.prisma:593`. Dropping `Prefactura` without removing this
line fails `prisma validate`.

### 4.6 Confirmed NOT to touch
`Nomina`, `NominaPeriodo`, `Contrato`, `CargoEmpresa`, `AsistenciaEmpleado`, `DeduccionSalario`,
`Beneficio`, `ComprobantePago`, `ArchivoNominaPeriodo`, `Empleado` and all their enums
(`TipoContrato`, `PeriodoPago`, `TipoDeduccion`, `MedioPagoNomina`, `TipoCuentaBanco`,
`TipoArchivoNomina`, `EstadoEmpleado`, `TipoEmpleado`). None are reachable from the finance subgraph.

---

## 5. Assumptions

- A1 — `periodo` is stored as a `DATE` normalized to the **first day of the month**; month grouping
  is derived, no separate year/month integer columns. Simplest shape that satisfies §2.1.
- A2 — `valorTotal` is **persisted** (not computed on read) so historical rows stay stable if a
  rounding rule ever changes; backend recomputes and writes it on every create/update.
- A3 — Money uses `Decimal(15,2)`, matching every existing monetary column in the schema.
- A4 — Default centros from §2.4 are seeded as data (following the `DEFAULT_CARGOS` precedent in
  `empresaService.ts`), and remain editable — the user said *"ellos puedan crear unos centros de costos"*,
  so the seed is a starting point, not a fixed enum.
- A5 — Balance is computed per month across all centros: `Σ ítems(INGRESOS) − Σ ítems(EGRESOS)`.

## 6. Open questions for the workers (non-blocking)

- Q1 — Should deleting a centro that still has ítems be blocked (`Restrict`) or cascade? Lean
  `Restrict` + soft-`activo` flag to avoid silent data loss.
- Q2 — Staging row counts for the 4 dropped tables must be re-verified in the release **R0 preflight**
  before the destructive migration runs there. Local is 0; staging is unverified at intake time.
