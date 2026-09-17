# Task Assignment — W1 `pt-backend-eng` · Centro de Costos backend

**Task type**: IMPLEMENTATION (source code + schema + migration)
**Your task IDs**: `1` → `2` → `3` → `4` (sequential; the harness unblocks each as you complete the prior one)
**Your worker name**: `worker-1`
**Working directory**: `/Users/jeik/ws/mi-empresa-app-development` (project root — all paths below are relative to it)

You own the shared interface for this whole feature. Two other workers will build against the
contract you write in task `2`. Get the names right the first time.

---

## Worker Self-Check (run BEFORE any work)

```bash
pwd                                    # MUST print the project root above. If not → BLOCKED immediately.
git status --short | head -5           # working tree is intentionally dirty; that is expected
docker ps --format '{{.Names}}' | grep miempresa-postgres   # MUST print miempresa-postgres
```
If `pwd` is a subdirectory, send `BLOCKED: spawned with cwd=<path>` and STOP — your permissions will
not load and every file write will hang.

---

## Background (one paragraph)

The user described a Centro de Costos module in a recorded session: cost centers typed INGRESOS or
EGRESOS, each holding monthly ítems with `nombre / notas / cantidad / valorUnitario / valorTotal /
periodo`. The repo already contains a **dead** "FINANCE MODULE" in `schema.prisma` (lines ~720–804)
that was scaffolded for a different concept (product catalog + invoicing) and has **zero** code
references. You are replacing it.

Read these two, in order, before starting:
1. `development/feature-centro-costos-ago-5/feature-centro-costos-ago-5-plan.md` — §Technical Approach has the exact Prisma models and the endpoint table. **This is your spec.**
2. `development/feature-centro-costos-ago-5/01-requirements-centro-costos.md` — R1–R17 / N1–N6 acceptance criteria.

Do NOT read the raw transcript; it is noisy and already distilled.

---

## Locked decisions — do NOT re-litigate

| ID | Decision |
|---|---|
| D1 | Drop unused finance tables, replace with the new schema. **Never touch nómina/empleado tables.** |
| D3 | Nómina is just a manual EGRESOS centro. Do not import anything from `nominaService`. |
| D4 | RBAC = ADMIN + CONTRATOS via the existing `DOMAIN_ACCESS` matrix; GERONTOLOGA denied. |
| D5 | `cantidad` is a positive **Int**, default 1. **Not Decimal** — the developer changed this explicitly. |
| D6 | `valorTotal` is persisted and **server-computed**; a client-sent `valorTotal` is ignored, never trusted. |
| D7 | `periodo` is a DATE normalized to **day 1** of its month. No `(anio, mes)` columns. |
| D8 | Centro delete is `Restrict` → **409** when it has ítems. Retire via `activo=false`. |

---

## Source Files to Modify (your exclusive ownership)

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/**` (new dir)
- `backend/src/services/centroCostosService.ts` (new)
- `backend/src/routes/centroCostos.routes.ts` (new)
- `backend/src/routes/index.ts`
- `backend/src/middleware/domainAccess.ts`
- `backend/src/services/empresaService.ts` — **seed constant only**, nothing else in that file
- `backend/tests/centro-costos/**` (new)

## Explicit non-goals — do NOT touch

- ❌ Anything under `frontend/` — **worker-2 owns it**
- ❌ `nominaService.ts`, `asistenciaService.ts`, `employeeService.ts`, and every nómina/empleado/contrato model
- ❌ Existing tests outside `backend/tests/centro-costos/`
- ❌ Any reporting/export/visualization feature — explicitly out of scope
- ❌ Staging or any AWS resource. Local only.

---

## Key files to read first (ordered, with why)

| File | Why | Focus |
|---|---|---|
| `backend/src/routes/asistencia.routes.ts` | **Your exemplar.** Copy its shape exactly: `authMiddleware()` + `requireDomain()` at router level, Zod + `validate`, `{success,data}` / `{success,message,field}` envelopes, `e?.status` rethrow, `.js` import suffixes | lines 1–80 |
| `backend/src/middleware/domainAccess.ts` | You add one domain key here | `Domain` type + `DOMAIN_ACCESS` const |
| `backend/src/services/empresaService.ts` | `DEFAULT_CARGOS` + `createMany({skipDuplicates:true})` is the idempotent-seed pattern to copy | lines 40–98 |
| `backend/src/routes/index.ts` | Register your router | whole file, it is short |
| `backend/prisma/schema.prisma` | The FINANCE MODULE you are replacing | lines 720–804, plus line ~593 |

---

## Pre-loaded traps (these are instructions, not discoveries)

1. **`Cliente.prefacturas` at `schema.prisma:593`** — dropping `Prefactura` without removing this
   back-relation makes `prisma validate` fail. Remove it. (WI-4)
2. **Route ordering**: register `/items/:itemId` **before** any `/:id` route, or Express shadows it
   and `PUT /centro-costos/items/5` hits the centro handler. (WI-2)
3. **`periodo` normalization must be pure string math**: `"2026-08"` → `"2026-08-01"` by
   concatenation. Never `new Date("2026-08")` — it parses as UTC and drifts a day in Bogotá. The repo
   already learned this; see `serverTodayBogota()` in `asistencia.routes.ts` for the discipline. (WI-3)
4. **Prisma returns `Decimal` as a string over JSON.** Document this in the contract as the wire
   type. Do not "fix" it by casting to Number in the service. (WI-1)
5. **Migrations are gitignored** but must still be created locally — they ship inside the deploy
   artifact. Leave the migration directory in the working tree.
6. **NEVER** run `prisma migrate diff --shadow-database-url` — it silently wipes the database.
7. **Do not** start a backend with `node --import tsx src/start.ts`, and **never** `pkill -f tsx` or
   `pkill node` — a production bun service may be on port 4142. If the local backend on :3101 needs a
   restart, target the specific PID from `lsof -i :3101`.
8. Local DB: `docker exec miempresa-postgres psql -U miempresa -d miempresa_dev`. Backend :3101.
   Test creds: `admin@miempresa.com` / `<redacted>`, and `qa-contratos@miempresa.com`,
   `qa-gerontologa@miempresa.com` (same password).

---

## Task 1 — Schema + migration + seed  ⚠️ GATED

**Simplest thing first**: run the row-count query below before editing anything.

1. Verify the legacy tables are empty:
   ```bash
   docker exec miempresa-postgres psql -U miempresa -d miempresa_dev -c \
     "SELECT 'centros_costos' t, count(*) FROM centros_costos UNION ALL SELECT 'productos_servicios', count(*) FROM productos_servicios UNION ALL SELECT 'egresos', count(*) FROM egresos UNION ALL SELECT 'prefacturas', count(*) FROM prefacturas;"
   ```
2. Edit `schema.prisma`:
   - **DROP** models `ProductoServicio`, `Prefactura`, `Egreso`; **DROP** enum `EstadoPrefactura`;
     **REMOVE** the `prefacturas Prefactura[]` line from `Cliente`.
   - **KEEP** enum `TipoCentroCostos` unchanged — it is already `INGRESOS | EGRESOS`.
   - **KEEP + extend** `CentroCostos`, and **ADD** `CentroCostosItem` — both exactly as written in
     the feature plan §Technical Approach. Copy the field names and `@map` values verbatim.
3. `npx prisma validate` then `npx prisma generate`.
4. **🚦 STOP — GATE G1.** Before running any migration, write
   `development/feature-centro-costos-ago-5/tasks/W1-backend/proposed-plan.md` containing: the
   verbatim row-count output from step 1, the exact SQL the migration will run
   (`npx prisma migrate dev --create-only --name centro_costos_ago5` produces it — creating the file
   is safe, applying it is not), and any deviation you found. Then:
   `SendMessage(to: "main", message: "PLAN-APPROVAL: migration ready. Counts: <...>. Drops: <...>.")`
   and **WAIT**. Do not apply the migration until the orchestrator replies `APPROVED`.
5. After approval: apply the migration, then add `DEFAULT_CENTROS_COSTOS` to `empresaService.ts`
   (11 centros — 5 INGRESOS, 6 EGRESOS, per requirements R7/R8, with `orden` matching the listed
   order) and wire an idempotent seed using `createMany({ skipDuplicates: true })`. Running it twice
   must not duplicate rows or delete user-created centros (R9).

**Acceptance criteria** — each must be demonstrated with a verbatim command + output:
1. `npx prisma validate` exits 0.
2. `\dt` shows `centros_costos` and `centro_costos_items`, and does NOT show `productos_servicios`,
   `prefacturas`, `egresos`.
3. `\d clientes` is unchanged apart from nothing — and a row count of `clientes` before/after is identical.
4. Every nómina/empleado table still exists: `\dt` includes `empleados`, `contratos`,
   `nomina_periodos`, `asistencia_empleados`.
5. Seed run twice → `SELECT tipo, count(*) FROM centros_costos GROUP BY tipo;` returns INGRESOS=5, EGRESOS=6 both times.

---

## Task 2 — Contract document

Write `development/feature-centro-costos-ago-5/orchestration-ctx/decisions/contract-schema-centro-costos-ago-5.md`.

This is the **single source of truth** two other workers will build from without reading your code.
It must contain:
- Exact Prisma model + field names, with the JSON wire type of each (`Decimal` → **string**, `Int` → number, dates → `YYYY-MM-DD`).
- All 9 endpoints: method, path, query params, request body shape, success response shape, error responses with `field` values.
- The exact seed data (11 centro names, their `tipo` and `orden`).
- The RBAC row: which profiles get what.
- `periodo` normalization rule and the `valorTotal` computation rule, stated as behavior.
- Error catalogue: 400 validation (with `field`), 403 `DOMAIN_FORBIDDEN`, 404, 409 centro-has-ítems.
- A **deviations table** (empty for now) — you append to it in tasks 3 and 4 if reality differs.
- Placeholder sections `## Wave 2 notes` and `## Wave 3 notes` for you to fill later.

Then `SendMessage(to: "main", message: "COMPLETE: contract written at <path>. Ready for G2 review.")`
Task 3 is blocked until the orchestrator reviews it — continue only when told, or when the harness
unblocks task 3.

---

## Task 3 — Service + routes + RBAC

> Consider running `/compact` before starting this task — you have been holding schema context.

1. `backend/src/services/centroCostosService.ts` — all data access; routes stay thin.
2. `backend/src/routes/centroCostos.routes.ts` — the 9 endpoints from the contract, in the ordering
   required by trap #2.
3. Register in `routes/index.ts`: `router.use('/centro-costos', centroCostosRoutes)`.
4. `middleware/domainAccess.ts`: add `'centro-costos'` to the `Domain` union and one cell to each
   profile in `DOMAIN_ACCESS` — `GERONTOLOGA: false`, `CONTRATOS: true`. Change nothing else in that file.
5. Zod: `cantidad` = `z.number().int().positive()` (D5); `valorUnitario` positive; `periodo` matches
   `/^\d{4}-\d{2}$/` or `/^\d{4}-\d{2}-\d{2}$/`; egreso-only fields optional+nullable.

**Acceptance criteria** (demonstrate each with a `curl`, verbatim):
1. `POST /api/v1/centro-costos/:id/items` with `{cantidad:2, valorUnitario:1500, valorTotal:999999}` → stored `valorTotal` is `"3000.00"`, not 999999.
2. `POST` with `{cantidad: 2.5}` → 400 with `field: "cantidad"`.
3. `POST` with `periodo: "2026-08-17"` → stored `periodo` is `2026-08-01`.
4. `GET /api/v1/centro-costos/balance?periodo=2026-08` → `balance === totalIngresos - totalEgresos`.
5. `GET .../balance?periodo=1999-01` (empty month) → 200 with zeros, **not** 404.
6. `DELETE /api/v1/centro-costos/:id` on a centro with ≥1 ítem → 409, ítems still present.
7. As `qa-gerontologa@miempresa.com`: any centro-costos route → 403 `DOMAIN_FORBIDDEN`.
8. As `qa-contratos@miempresa.com`: create + read + update → 200.
9. `PUT /api/v1/centro-costos/items/:itemId` reaches the ítem handler (not shadowed by `/:id`).
10. `npx tsc --noEmit` in `backend/` exits 0.

---

## Task 4 — Backend smoke spec

`backend/tests/centro-costos/centro-costos-smoke.spec.ts`, following
`backend/tests/asistencia/asistencia-rbac.spec.ts` for structure (`TEST_API_URL`, cookie login helper).
Cover the happy path: seeded centros list → create ítem → `valorTotal` computed → `periodo`
normalized → balance rollup correct.

Run: `cd backend && npx playwright test tests/centro-costos --reporter=list`
Paste the verbatim output into your completion report. Then fill the contract's deviations table
and `## Wave 2 notes` with anything the UI worker needs to know.

---

## Deviation protocol

If reality contradicts this assignment: state it as **"assignment said X / reality is Y / therefore Z"**,
attach the evidence (query output, file listing), then:
- **Breaking** (changes a name, shape, or behavior another worker depends on) → `TURNING-POINT-BREAKING:` and WAIT.
- **Non-breaking** → proceed and record it in the contract's deviations table.

## Error budget

**MAX 2 distinct self-repair attempts** per error. Then STOP and send
`TURNING-POINT-STRATEGY:` with the exact error, both attempts and their results, and the hypotheses
you ruled out. Do not spin, do not fabricate output.

`BLOCKED:` template — exact problem / what you attempted / what would unblock you. Then WAIT.

## Reporting protocol

- `TaskUpdate → in_progress` when you start each task; `→ completed` when its acceptance criteria pass.
- Keep `tasks/W1-backend/progress-report.md` current — intermediate findings go in **sections of that
  file**, never as extra standalone files.
- Final: `tasks/W1-backend/completion-report.md` with verbatim commands + outputs for every
  acceptance criterion, and a classification (BUG / TEST-ENV / FLAKE) for every failure you observed —
  zero unclassified.
- Message the orchestrator (`to: "main"`) only on: `COMPLETE:` per task, `BLOCKED:`,
  `PLAN-APPROVAL:`, `TURNING-POINT-*`. After sending `COMPLETE:` for task 4, stay silent.
- Never message another worker directly.
