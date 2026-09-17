# Task Assignment — W8 · D14 GET /items/:itemId month guard

**Task type**: IMPLEMENTATION (tiny)  
**Your worker name**: `worker-8`  
**CWD**: `/Users/jeik/ws/mi-empresa-app-development`  
**Address `team-lead`, never `main`.**

W7 shipped T10 but left one hole. You fix **only** that hole.

---

## FIRST ACTION

```bash
pwd
sed -n '257,276p' backend/src/routes/centroCostos.routes.ts
```

If those lines already contain `isContratosRequest`, verify with curl and send `COMPLETE: already present` + evidence. Otherwise implement.

---

## Expected vs found

**Expected:** CONTRATOS `GET /api/v1/centro-costos/items/:itemId` when the ítem `fecha` is not current Bogotá `YYYY-MM` → **403** `{ success:false, message includes mes actual, field:'fecha' }`. Same rule as PUT/DELETE on that path.

**Found:** GET handler (routes file ~257–276) has **no** month check. Historical items leak.

Copy the PUT/DELETE guard pattern already in the same file (lines ~180–200 and ~223–243). Use `serverTodayBogota()` + `item.fecha`. 404 if missing. ADMIN/AUDITOR/OPERADOR unrestricted.

Add **one** case to `backend/tests/centro-costos/centro-costos-smoke.spec.ts`.

Also add one sentence to the contract RBAC row for GET `/items/:itemId` (currently ✅ for CONTRATOS with no month limit) — change to “only current month”.

---

## Do NOT

- Touch frontend
- Touch schema/migrations
- Change other routes
- Send PLAN-APPROVAL or WAITING
- `pkill` anything

---

## Acceptance

1. Independent curl as `qa-contratos@miempresa.com` on an item whose fecha is **not** this Bogotá month → HTTP 403, `field=fecha`.
2. Same curl as admin → 200.
3. CONTRATOS GET on a **current-month** item → 200.
4. `TEST_API_URL=http://localhost:3101 npx playwright test tests/centro-costos --reporter=list` still green (22 if you added one).
5. Restart the :3101 process only via `lsof -i :3101` PID if needed so the route is live.

Write `tasks/W8-d14-getitem/completion-report.md` with verbatim curls. Then `COMPLETE:` to team-lead.
