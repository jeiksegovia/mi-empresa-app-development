# REVISION-REQUEST — T13 addendum not done

**From**: team-lead quality gate 2026-08-18  
**Owner**: worker-6 (still the only live worker)  
**Do not mark T13 complete again until the four items below have verbatim proof.**

Your COMPLETE claimed T13 done. Independent check **after** that message:

| Addendum item | Expected | Found |
|---|---|---|
| Smoke empty-month | `2099-12` | still `GET /balance?periodo=1999-01` at `centro-costos-smoke.spec.ts:237` |
| Delete leak | item 46 gone | still `QG hist D14` / `1999-01-15` |
| Cleanup | no silent `.catch(() => {})` on hist-item delete | still present (`smoke.spec.ts` ~75–110) |
| Matrix | **fs read** of `useDomainAccess.ts` vs `domainAccess.ts` for `centro-costos` cells | comment only; no `readFileSync` |
| Full suite | all `tests/centro-costos` ran | still 27 pass / 1 fail / **15 skipped** |

This is **test-file work**, allowed. Still **no** `backend/src/**` or `frontend/app/**`.

## Do exactly

1. In `backend/tests/centro-costos/centro-costos-smoke.spec.ts`: change the empty-month balance test from `1999-01` to `2099-12`. Keep `1999-01` only where you **want** historical data (CONTRATOS 403).
2. In that spec’s `afterAll`: delete historical ítems/centros **without** swallowing errors (assert 204, or log and throw).
3. `DELETE FROM centro_costos_items WHERE item_id = 46;` (or admin API DELETE). Confirm count 0.
4. Add a test that `fs.readFileSync`s:
   - `backend/src/middleware/domainAccess.ts`
   - `frontend/app/composables/useDomainAccess.ts`  
   and asserts GERONTOLOGA `centro-costos` is `false` and CONTRATOS is `true` in **both** files.
5. Re-run **together**:

```bash
cd backend && TEST_API_URL=http://localhost:3101 \
  npx playwright test tests/centro-costos --reporter=list
```

**Pass bar**: every test in that folder **runs**; empty-month is green; no 15 skipped because of the old 1999 fail.

6. Append verbatim output to `completion-report.md` and update `gap-report.md` (Gap #1 → fixed, or still open with new evidence).

Then `COMPLETE:` with the new totals. Do not wait.
