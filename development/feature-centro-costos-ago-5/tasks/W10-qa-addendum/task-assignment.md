# Task Assignment — W10 · QA addendum (test files only)

**Worker**: `worker-10` · `pt-test-quality`  
**CWD**: `/Users/jeik/ws/mi-empresa-app-development`  
**Address `team-lead`, never `main`.**  
**TaskList ID**: `5` (reopened T13)

W6 finished T12 coverage then marked T13 done **without** the addendum. You finish that addendum. **No product source.**

Spec: `development/feature-centro-costos-ago-5/tasks/W6-qa/revision-request-t13-addendum.md`

---

## FIRST ACTION

```bash
pwd
grep -n "1999-01 (empty)" backend/tests/centro-costos/centro-costos-smoke.spec.ts
```

`TaskUpdate` task `5` → `in_progress` (already is).

---

## Do

1. Smoke empty-month: `1999-01` → `2099-12` (`GET /balance?periodo=…`).
2. `afterAll` historical cleanup: no `.catch(() => {})` — assert delete 204.
3. Delete DB row `item_id=46` (`QG hist D14`).
4. New test: `fs.readFileSync` both
   - `backend/src/middleware/domainAccess.ts`
   - `frontend/app/composables/useDomainAccess.ts`  
   assert `centro-costos` is `false` for GERONTOLOGA and `true` for CONTRATOS in **both**.
5. Run:

```bash
cd backend && TEST_API_URL=http://localhost:3101 \
  npx playwright test tests/centro-costos --reporter=list
```

Pass bar: **all** tests in that folder run; empty-month green.

6. Update `tasks/W6-qa/gap-report.md` (Gap #1 fixed) and write `tasks/W10-qa-addendum/completion-report.md` with verbatim totals.

`COMPLETE:` to team-lead. Do **not** send PLAN-APPROVAL or WAITING.
