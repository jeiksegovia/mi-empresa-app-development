# Task Assignment — W9 · FE revision (CONTRATOS ítem CRUD + Bogotá dates)

**Worker name**: `worker-9` · **subagent**: `pt-frontend-eng`  
**CWD**: `/Users/jeik/ws/mi-empresa-app-development`  
**Address `team-lead`, never `main`.**  
**TaskList ID**: `7`

W5 shipped T11. Quality gate found two blockers. You fix **only** those. Do not wait. Do not send PLAN-APPROVAL.

Full spec: `development/feature-centro-costos-ago-5/tasks/W5-frontend-aug17/revision-request-contratos-items.md`

---

## FIRST ACTION

```bash
pwd
grep -n "v-if=\"isAdmin\"" frontend/app/pages/centro-costos/index.vue
```

Then `TaskUpdate` task `7` → `in_progress`.

---

## Changes (only these)

1. **Ítem** add / edit / delete buttons: remove `v-if="isAdmin"`. Visible to anyone who can open the page (ADMIN + CONTRATOS).  
   **Centro** create / edit / delete stay `v-if="isAdmin"`.
2. Replace `currentPeriodYYYYMM` and `todayYYYYMMDD` with:

```ts
function todayBogotaYYYYMMDD(): string {
  return Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}
function currentPeriodYYYYMM(): string {
  return todayBogotaYYYYMMDD().slice(0, 7)
}
```

3. Smoke: CONTRATOS expands a centro and **sees** add-ítem (`data-testid` for add button). Keep AC#3 (no balance / month / create-centro).

Do not touch backend. Do not restyle recibo.

Write `tasks/W9-fe-revision/completion-report.md` with grep proof of the v-if change + smoke output. `COMPLETE:` to team-lead.
