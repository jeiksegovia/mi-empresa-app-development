# T13 addendum — team-lead quality gate on T12

Fold these into task 5. Still **no product source** edits.

## 1. TEST-ENV leak — confirmed independently

`centro_costos_items` id **46** (`QG hist D14`, `1999-01-15`, $10, centro 22) exists. Orchestrator created it during the W8 curl gate; smoke `afterAll` `.catch(() => {})` also cannot be trusted.

**Do (tests + DB only):**
- Change smoke `GET /balance?periodo=1999-01 (empty)` to **`2099-12`** (same as your new spec).
- Remove silent `.catch(() => {})` on that historical-item cleanup; fail if delete is not 204.
- `DELETE FROM centro_costos_items WHERE item_id = 46;` (or admin DELETE if 204).
- Re-run **both** files together:

```bash
cd backend && TEST_API_URL=http://localhost:3101 \
  npx playwright test tests/centro-costos --reporter=list
```

T12 reported **27 pass / 1 fail / 15 did not run**. T13 must show **all** centro-costos BE tests ran (target 43/43 after the 1999→2099 fix). Serial + one fail is not “suite green.”

## 2. FE/BE matrix is not cell-by-cell yet

`centro-costos-aug17.spec.ts` tests named “RBAC matrix parity” only hit BE (`GERONTOLOGA GET /` 403, `CONTRATOS GET` 200 / `POST` 403). They do **not** read `frontend/app/composables/useDomainAccess.ts` vs `backend/src/middleware/domainAccess.ts`.

**Do:** add a test that **reads both files** (fs) and asserts the `centro-costos` cell for GERONTOLOGA (`false`) and CONTRATOS (`true`) match. Prior cycles in this repo did exactly that. Behavioral 403s stay; they are not a substitute for file parity.

## 3. T13 remainder (unchanged)

FE 17+ smoke, regression suites, tsc, gap-report update, completion-report with verbatim totals.
