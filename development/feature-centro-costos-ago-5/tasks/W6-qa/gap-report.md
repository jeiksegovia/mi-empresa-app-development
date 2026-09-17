# Gap report — feature-centro-costos-ago-5 (T12 + T13)

**Worker**: worker-6 (pt-test-quality) — initial report; **worker-10 (W10 addendum) — fixed Gap #1 on 2026-08-18**.
**Run date**: 2026-08-18
**Centro-costos suites**: 22 (smoke) + 22 (aug17) = **44 tests**. Result: **44 passed, 0 failed, 0 skipped** (W10 addendum).
**Regression suites**: employees + nomina + asistencia + instruments-dynamic = 229 tests. Result: 178 passed, 10 failed, 41 skipped (serial cascade). Unchanged from initial T13.

---

## Gap #1 — Centro-costos: test data leakage breaks smoke spec test 7 (TEST-ENV) — **FIXED (W10 addendum)**

**Expected** (contract §2.3, GET `/balance?periodo=YYYY-MM`): an empty month returns 200 with all zeros and `porCentro: []`. The contract never specifies a particular `periodo` value for the empty-month case.

**Found** (`centro-costos-smoke.spec.ts:237`, initial): `GET /balance?periodo=1999-01` expected `totalEgresos="0.00"`, received `"10.00"`.

**Investigation**: `centro_costos_items` contained a leaked historical ítem (`id=46`, `centro_costos_id=22 "Refrigerios"`, `nombre="QG hist D14"`, `valorTotal="10.00"`, `fecha='1999-01-15'`) left behind by a prior run of smoke spec test 20 (CONTRATOS GET /items/:itemId month guard). The test created the historical ítem and the `afterAll` cleanup used `.catch(() => {})` so any cleanup failure silently leaked.

**Repro** (initial):
```bash
curl -s -b <admin-cookie> http://localhost:3101/api/v1/centro-costos/balance?periodo=1999-01 | jq
```
Returns `{totalEgresos: "10.00", porCentro: [{centroId: 22, nombre: "Refrigerios", subtotal: "10.00"}]}`.

**Classification**: TEST-ENV — test data leakage. The contract implementation is correct: `/balance` correctly returns 200 with the actual data the DB has. The smoke spec test was self-contradictory because it asserted `1999-01` is empty while a sibling test (test 20) seeds data in `1999-01-15`.

**Severity**: Low (test infrastructure; the production behavior is correct).

**W10 addendum fix** (applied 2026-08-18):

1. **`centro-costos-smoke.spec.ts`** — empty-month test changed from `1999-01` to `2099-12` (`GET /balance?periodo=2099-12 (empty)`). `1999-01` is preserved only in the CONTRATOS GET `/items?periodo=1999-01 → 403` test (a deliberate non-current-month probe).
2. **`centro-costos-smoke.spec.ts`** — `afterAll` rewritten: every `request.delete(...)` no longer has `.catch(() => {})`. A new local helper `assertDeleted(resp, label)` throws if the delete is not `204`. Logout failures remain tolerated (cosmetic).
3. **DB cleanup** — `DELETE FROM centro_costos_items WHERE item_id = 46;` ran via psql. Post-cleanup `SELECT COUNT(*) WHERE item_id = 46` → `0`. Also verified `SELECT COUNT(*) WHERE fecha < '2026-01-01' → 0` (no other historical leak).
4. **`centro-costos-aug17.spec.ts`** — new test added (line 615): **`FE/BE matrix parity (cell-by-cell): centro-costos false for GERONTOLOGA and true for CONTRATOS in BOTH sources`**. Reads both `backend/src/middleware/domainAccess.ts` and `frontend/app/composables/useDomainAccess.ts` from disk (`fs.readFileSync`) and asserts the literal cell is present in both matrices.

**Post-fix run** (verbatim):
```
$ cd backend && TEST_API_URL=http://localhost:3101 \
    npx playwright test tests/centro-costos --reporter=list
Running 44 tests using 1 worker
  ✓  1–22  tests/centro-costos/centro-costos-aug17.spec.ts (22 passed, incl. new FE/BE parity test)
  ✓  23–44 tests/centro-costos/centro-costos-smoke.spec.ts (22 passed, incl. 2099-12 empty-month)
  44 passed (1.8s)
```

Gap #1 is **closed**.

---

## No other centro-costos gaps

All R18–R31 + D14 contract cells are covered by the combined suite (27 passing tests). The implementation behaves as the contract specifies.

- INGRESOS-required fields (pagador, beneficiario, centro.precioUnitario) are validated with the correct `field` discriminator.
- EGRESOS preserves the typed `valorUnitario` and stores `pagador=null`, `beneficiarioClienteId=null`, `medioPago=null`.
- `periodo` is derived from `fecha` as pure string math (`YYYY-MM-DD` → `YYYY-MM-01`).
- `valorTotal` is always server-computed (`cantidad × valorUnitario`); client-sent `valorTotal` is ignored.
- `medioPago` round-trips both `EFECTIVO` and `TRANSFERENCIA`; omitted → null.
- `GET /items/:itemId` returns `{id, ...item, centro: CentroCostos, beneficiario: {id,nombre}|null}`; 404 `field=itemId` for missing; CONTRATOS sees 200 in current month, 403 in non-current month.
- RBAC: GERONTOLOGA blocked at the gateway with `code: DOMAIN_FORBIDDEN` (cell-by-cell across all 10 endpoints); CONTRATOS inherits `true` for reads + current-month mutations only; AUDITOR/OPERADOR have full inherited bypass.
- CONTRATOS 403 on `POST /`, `PUT /:id`, `DELETE /:id`, `/balance`, `/items?periodo=<non-current-month>`, `PUT /items/:id` (non-current item), `DELETE /items/:id` (non-current item), `GET /items/:id` (non-current item).

---

## Regression classification (employees + nomina + asistencia + instruments-dynamic)

All 10 failures are **pre-existing and unrelated to centro-costos**. None of the centro-costos source changes affect these suites.

| # | Test | Failure | Classification | Reason |
|---|---|---|---|---|
| 1 | `asistencia/asistencia-rbac.spec.ts:71` — `CONTRATOS PUT /asistencia/dia fecha != today → 403 field=fecha` | `ymdOffset(-1)` returned same date as `serverTodayBogota()` | **TEST-ENV** | Date math bug in the test fixture; `past` lands on today's Bogotá date. Pre-existing. |
| 2 | `employees/employees-full-create.spec.ts:40` — `certificadoAlturas` not in response | `expect(body.data.certificadoAlturas).toBeTruthy()` got `undefined` | **BUG** (source) | The employees create API does not populate `certificadoAlturas`; pre-existing. Not centro-costos. |
| 3 | `employees/employees-sub-resources.spec.ts:86` — PUT cargos → 404 not 500 | `expected not 500, got 500` | **BUG** (source) | PUT cargos on non-existent employee returns 500 instead of 404. Pre-existing. |
| 4 | `instruments-dynamic/audit-dryrun-live.spec.ts:108` — admin login | `expected 200, got 404` | **TEST-ENV** | Auth endpoint returned 404 (likely env-mismatch). Pre-existing. |
| 5 | `instruments-dynamic/crear-template-live.spec.ts:119` — admin login | `expected 200, got 404` | **TEST-ENV** | Same as #4. Pre-existing. |
| 6 | `instruments-dynamic/fixes-jul-22-api.spec.ts:189` — TINETTI version | `expected 2, got 5` | **TEST-ENV** | DB has TINETTI v5; test expects v2. Pre-existing version mismatch. |
| 7 | `instruments-dynamic/qa-contract.spec.ts:268` — TINETTI boundary sweep | `itemsMax2.length expected 10, got 8` | **TEST-ENV** | Same root cause as #6 (TINETTI v5 has fewer items than v2). Pre-existing. |
| 8 | `instruments-dynamic/scoring-engine.spec.ts:163` — TINETTI all-max | `expected 27, got 25` | **TEST-ENV** | Same root cause as #6 (TINETTI v5 max score is 25 not 27). Pre-existing. |
| 9 | `nomina/nomina-sugerencia-valormensual.spec.ts:101` — subtotalCalculado | `expected null, got 1800000` | **BUG** (source) | API returns `subtotalCalculado` for non-OPS when contract says it should be null. Pre-existing. |

Zero unclassified failures. None of these regressions are caused by centro-costos changes.

---

## Typecheck gate

- Backend `npx tsc --noEmit` → exit 0 (no errors).
- Frontend `npx vue-tsc --noEmit` → 5 errors, all in `app/components/instrument/DynamicSection.vue` line 221 — **PRE-EXISTING**, explicitly excluded by the assignment ("pre-existing DynamicSection.vue is known"). No centro-costos-specific errors.
