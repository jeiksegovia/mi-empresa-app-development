# Task Assignment — W4 `pt-backend-eng` · Aug-17 centro-costos feedback (schema + API)

**Task type**: IMPLEMENTATION
**Your TaskList IDs**: `1` (T9 schema+seed+contract) → `2` (T10 API + smoke)
**Your worker name**: `worker-4`
**Working directory**: `/Users/jeik/ws/mi-empresa-app-development`
**Address the orchestrator as `team-lead`, never `main`.**

---

## FIRST ACTION

```bash
pwd   # MUST be the project root above. Else BLOCKED: spawned with cwd=<path> and STOP.
```
Then `TaskUpdate` task `1` → `in_progress`. Then read, in order:
1. `development/feature-centro-costos-ago-5/orchestration-ctx/decisions/aug17-qa-feedback-decisions.md` — **your spec**
2. `development/feature-centro-costos-ago-5/01-requirements-aug17-feedback.md` — R18–R31
3. Existing contract: `development/feature-centro-costos-ago-5/orchestration-ctx/decisions/contract-schema-centro-costos-ago-5.md` — you will **update** this in T9, not replace the filename

---

## Locked decisions — do NOT re-litigate

D9–D14 in the decisions file. Short form:
- Additive migration only. **Never edit** `20260805000000_centro_costos_ago5`.
- `fecha` required; `periodo = first-of-month(fecha)`.
- Ingreso columns on `CentroCostosItem`; `precioUnitario` + `habilitarRecibo` on `CentroCostos`.
- Seed: rename `Transporte` → `Transporte completo`; add Mensualidad 3/4 días + Transporte por 3 días; EGRESOS orden 9–14.
- CONTRATOS: ítems of **current Bogotá month** only; no balance; no centro mutations.
- Recibo is this cycle (`habilitarRecibo` + GET item).

---

## Source Files to Modify

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/<NEW_DIR>/` only
- `backend/src/services/empresaService.ts` (DEFAULT_CENTROS_COSTOS + a **data-fix** function for the Transporte rename — `createMany` cannot rename)
- `backend/src/services/centroCostosService.ts`
- `backend/src/routes/centroCostos.routes.ts`
- `backend/tests/centro-costos/**`
- the contract markdown above

## Non-goals

- ❌ `frontend/` — worker-5
- ❌ nómina / empleado / asistencia services and models
- ❌ original migration SQL
- ❌ Prefactura module, IVA, payment splits
- ❌ AWS / staging

---

## T9 — Schema + seed + contract  ⚠️ GATED

1. Count current rows (verbatim into proposed-plan.md):
   ```bash
   docker exec miempresa-postgres psql -U miempresa -d miempresa_dev -c \
     "SELECT tipo, nombre, orden, id FROM centros_costos ORDER BY tipo, orden; SELECT count(*) AS items FROM centro_costos_items;"
   ```
2. Edit schema exactly as the decisions file §Schema. `fecha` is **required** (`DateTime @db.Date`). Backfill in SQL: `fecha = periodo` for existing items **before** adding NOT NULL (or add with DEFAULT then drop default).
3. `npx prisma validate` + `npx prisma generate`.
4. `npx prisma migrate dev --create-only --name centro_costos_aug17_qa` (create file only).
5. **G4 IS ALREADY APPROVED (2026-08-18).** Developer + orchestrator signed `orchestration-ctx/decisions/g4-aug17-additive-migration-approval.md`. Do **not** wait again. If you already wrote `proposed-plan.md`, skip the gate and apply immediately.
6. After approval: apply (`migrate deploy`), then seed/data-fix:
   - `UPDATE centros_costos SET nombre='Transporte completo' WHERE tipo='INGRESOS' AND nombre='Transporte';`
   - upsert the three new INGRESOS names (skipDuplicates)
   - UPDATE orden to the D12 table (INGRESOS 1–8, EGRESOS 9–14)
   - update `DEFAULT_CENTROS_COSTOS` so **new** environments get the final catalog
   - run the data-fix twice; second run must be a no-op
7. **Update the contract** in place: new fields + wire types, seed table, INGRESOS vs EGRESOS validation rules, CONTRATOS limits, `GET /items/:itemId` shape, `habilitarRecibo`, deviations, RB-1 still present. Fill `## Wave 2 notes` for the frontend worker.

**T9 acceptance** (verbatim commands):
1. `\d centro_costos_items` shows `fecha`, `pagador`, `beneficiario_cliente_id`, `medio_pago`.
2. `\d centros_costos` shows `precio_unitario`, `habilitar_recibo`.
3. `SELECT nombre FROM centros_costos WHERE tipo='INGRESOS' ORDER BY orden;` = the 8 D12 names; no exact `Transporte`.
4. Item count before/after migration is identical.
5. Contract file updated (not a new filename).

---

## T10 — Service + routes + smoke

After G5 (orchestrator will unblock / you continue when task 2 is available):

- `createItem`/`updateItem`: require `fecha`; set `periodo` via existing `normalizePeriodo(fecha)`.
- INGRESOS: require pagador + beneficiarioClienteId (must exist on `clientes`); copy `centro.precioUnitario` (400 `field: precioUnitario` if null); ignore client `valorUnitario`; optional `medioPago`.
- EGRESOS: still take `valorUnitario`; ingreso fields stored null if sent.
- CONTRATOS checks in the **route** (not a new middleware file):
  - POST `/`, PUT `/:id`, DELETE `/:id` → 403 unless ADMIN
  - GET `/balance` → 403 unless ADMIN (AUDITOR/OPERADOR inherit allow — `rol !== EMPLEADO` or ADMIN)
  - GET `/items?periodo=` → if EMPLEADO+CONTRATOS, periodo must equal current Bogotá `YYYY-MM` (`serverTodayBogota().slice(0,7)` from asistencia.routes.ts — copy the helper, do not import across route files)
- `GET /items/:itemId` **before** `/:id`: item + centro + `beneficiario: {id,nombre}|null`.
- Update `centro-costos-smoke.spec.ts` (and add cases) so it still passes and covers R24–R26, R31, CONTRATOS 403 on balance.

**T10 acceptance** (curl, as ADMIN unless noted):
1. POST item `{fecha:"2026-08-17"}` → fecha 2026-08-17, periodo 2026-08-01.
2. POST INGRESOS missing pagador → 400 `field: pagador`.
3. POST INGRESOS with `valorUnitario:1` on a priced centro → stored price, not 1.
4. CONTRATOS GET `/balance` → 403.
5. CONTRATOS GET `/items?periodo=1999-01` → 403.
6. CONTRATOS POST `/` (create centro) → 403.
7. GET `/items/:itemId` 200 with beneficiario object when set.
8. `npx tsc --noEmit` in backend exits 0.
9. `npx playwright test tests/centro-costos --reporter=list` green.

---

## Traps

- Never `prisma migrate diff --shadow-database-url`.
- Never `pkill node/tsx`. Restart :3101 via `lsof -i :3101` PID only.
- Dates: string math + `T00:00:00.000Z`, never `new Date("2026-08")`.
- Decimal still serializes as string. Document it.
- `@@unique([tipo,nombre])`: the Transporte rename must happen **before** inserting `Transporte completo` or the unique key collides if you insert first.
- Address orchestrator `team-lead` only.

## Reporting

- Progress: `tasks/W4-backend-aug17/progress-report.md` (sections, not extra files).
- Final: `tasks/W4-backend-aug17/completion-report.md` with verbatim AC output.
- Messages to `team-lead`: `COMPLETE:` per task, `PLAN-APPROVAL:`, `BLOCKED:`, `TURNING-POINT-*`. Silent after T10 COMPLETE.
- MAX 2 self-repairs then `TURNING-POINT-STRATEGY:`.
- Breaking contract change after G5 → `TURNING-POINT-BREAKING:` and WAIT.
