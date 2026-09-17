# Requirements — Centro de Costos (ago-5)

Derived from `00-intake-centro-costos.md`. Every row is atomic and testable.
Traceability: `T§x` = transcript section, `D{n}` = developer decision from intake §3.

---

## Functional Requirements

| ID | Requirement | Acceptance Criterion | Source |
|----|-------------|----------------------|--------|
| **R1** | Remove the dead FINANCE MODULE: drop `productos_servicios`, `prefacturas`, `egresos`; drop enum `EstadoPrefactura`; remove `Cliente.prefacturas` back-relation | `prisma validate` passes; the 3 tables + enum no longer exist in DB; `clientes` table and all nómina/empleado tables are byte-identical (verified by pre/post `\d` diff + row counts) | D1 |
| **R2** | `CentroCostos` is retained and extended: `nombre`, `tipo (INGRESOS\|EGRESOS)`, `descripcion?`, `activo`, `orden` | Model exists; `@@unique([tipo, nombre])` prevents duplicate centro names within a type | T§2.1 |
| **R3** | New `CentroCostosItem` holds ítems for BOTH types with one uniform shape: `nombre`, `notas?`, `cantidad`, `valorUnitario`, `valorTotal`, `periodo` | Row created via API round-trips all 6 fields intact | T§2.1, T§2.2 |
| **R4** | `valorTotal` is server-computed as `cantidad × valorUnitario` and persisted; a client-sent `valorTotal` is ignored | POST `{cantidad:2, valorUnitario:1500, valorTotal:999999}` → stored `valorTotal = 3000` | T§2.1, A2 |
| **R4b** | `cantidad` is a positive **integer**, default 1; non-integer input is rejected | POST `{cantidad: 2.5}` → 400 `field: 'cantidad'`; omitting `cantidad` → stored `1` | D5 |
| **R5** | `periodo` is a DATE normalized server-side to the **first day of its month**; all grouping is monthly | POST with `periodo: "2026-08-17"` → stored `2026-08-01`; item appears under `periodo=2026-08` | T§2.1 ("todos son mensual"), A1 |
| **R6** | EGRESOS ítems accept optional `numeroFactura`, `proveedor`, `fechaFactura` | All three round-trip when sent; all three null when omitted | T§2.3 |
| **R7** | Seed the 5 INGRESOS centros: Mensualidades completas, Mensualidades por día, Transporte, Ingresos adicionales, Valoraciones | After seed, `GET /centro-costos?tipo=INGRESOS` returns exactly these 5, in `orden` | T§2.4 |
| **R8** | Seed the 6 EGRESOS centros: Refrigerios, Aseo, Papelería, Eventos, Nómina, Mantenimiento | After seed, `GET /centro-costos?tipo=EGRESOS` returns exactly these 6, in `orden` | T§2.4 |
| **R9** | Seeding is idempotent (re-running does not duplicate or wipe user-created centros) | Running the seed twice leaves 11 centros and preserves any extra centro created in between | A4, DEFAULT_CARGOS precedent |
| **R10** | Centros are user-manageable: create, rename, deactivate | `POST/PUT` succeed; a deactivated centro is excluded from default listings but its historical ítems still count in past-month totals | T§2.1 ("ellos puedan crear unos centros de costos"), A4 |
| **R11** | Ítem CRUD: create, update, delete, list-by-month | Each verb returns the documented shape; delete removes only the target ítem | T§2.1 |
| **R12** | Monthly rollup endpoint returns per-centro totals, `totalIngresos`, `totalEgresos`, and `balance = totalIngresos − totalEgresos` | For a month with ingresos 5000 and egresos 1800 → `balance: 3200`; empty month → all zeros, not 404 | T§2.1, A5 |
| **R13** | Deleting a centro that still has ítems is refused with a clear error (no silent data loss) | `DELETE` on a centro with ≥1 ítem → 409 with `field: 'centroCostosId'`; ítems remain | Q1 → resolved `Restrict` |
| **R14** | RBAC: new `centro-costos` domain wired into the existing `DOMAIN_ACCESS` matrix — ADMIN full, CONTRATOS `true`, GERONTOLOGA `false` | GERONTOLOGA on any centro-costos route → 403 `DOMAIN_FORBIDDEN`; CONTRATOS create/read/update → 200; ADMIN → 200 | D4 |
| **R15** | Frontend matrix mirror stays cell-for-cell in parity with the backend, including the new domain, plus `DOMAIN_PREFIX_MAP` + sidebar entry | `useDomainAccess.ts` and `domainAccess.ts` agree for all 3 profiles × all domains; sidebar hides "Centro de Costos" for GERONTOLOGA | R14, existing parity contract |
| **R16** | `/centro-costos` page: month selector, ítems grouped under their centro, per-centro subtotal, and an ingresos-vs-egresos balance summary | Page loads for the seeded month, shows both sections, and the displayed balance equals the API's `balance` | D2 |
| **R17** | Page supports adding, editing and deleting an ítem inline, with the egreso-only fields shown only for EGRESOS centros | Creating an ítem in the UI persists it and updates the subtotal + balance without a manual reload | D2, T§2.3 |

## Non-Functional Requirements

| ID | Requirement | Acceptance Criterion |
|----|-------------|----------------------|
| **N1** | All monetary columns use `Decimal(15,2)`, matching every existing money column | Schema review; no `Float` anywhere in the module |
| **N2** | The migration is reviewed against **real row counts** before it runs; it must be additive for everything outside the 3 dropped finance tables | Worker posts counts + `PLAN-APPROVAL` and waits (P3 gate) |
| **N3** | New code extends existing patterns only — `requireDomain` for RBAC, Zod + `validate` middleware, `{success, data}` / `{success, message, field}` envelopes, service-layer separation, `.js` import suffixes | Code review against `asistencia.routes.ts` as exemplar |
| **N4** | Backend tests are Playwright specs in `backend/tests/centro-costos/`; frontend specs in `frontend/tests/centro-costos/` | Suites run green via the project's existing playwright configs |
| **N5** | No regression in existing suites | `backend/tests/{employees,nomina,asistencia,instruments-dynamic}` and the jul-24/jul-31 FE specs still pass |
| **N6** | `tsc --noEmit` clean on backend; frontend typecheck clean | Both commands exit 0 |

## Out of Scope (explicit)

| Item | Reason |
|------|--------|
| Per-centro independent report views, month-over-month comparison, export/print | T§2.5 — user deferred visualization explicitly |
| Auto-ingesting nómina spend into the Nómina egresos centro | D3 — modules stay independent; acknowledged as future work |
| Prefacturas / invoicing / product-service catalog | Dropped in R1; not part of the described model |
| Multi-currency, tax breakdown, accounting-code mapping | Never mentioned in the transcript |
| Staging deployment | Separate gated release cycle after this one lands locally |
