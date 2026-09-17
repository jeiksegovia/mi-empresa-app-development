# REVISION-REQUEST — CONTRATOS must add/edit/delete ítems + Bogotá dates

**From**: team-lead quality gate 2026-08-18  
**Owner**: worker-5  
**Do not reopen accordion / create-centro / recibo / INGRESOS field layout** — those passed review.

---

## Fail 1 (blocking) — D14 / R21–R22 / transcript L77–80

**Expected:** CONTRATOS (Carolina) **adds, edits, and deletes ítems** of the **current Bogotá month**. She cannot create/edit/delete **centros**, cannot see **balance**, cannot change **month**.

> “ella, Carolina, solamente va a poder … añadir, añadir, añadir. Y el histórico no lo va a poder ver.”

**Found** in `frontend/app/pages/centro-costos/index.vue`:

| Control | Guard | Effect |
|---|---|---|
| Add ítem | `v-if="isAdmin"` ~1010 | CONTRATOS cannot add |
| Edit ítem | `v-if="isAdmin"` ~983 | CONTRATOS cannot edit |
| Delete ítem | `v-if="isAdmin"` ~994 | CONTRATOS cannot delete |

Create-centro / edit-centro / delete-centro staying `isAdmin` is **correct**. Ítem CRUD must **not** use `isAdmin`.

**Do:**
- Show add / edit / delete ítem for ADMIN **and** CONTRATOS (and anyone else who can open the page, i.e. not GERONTOLOGA).
- Keep centro create/edit/delete `isAdmin` only.
- Update smoke: AC#3 still asserts no balance / no month / no create-**centro**. Add a test that CONTRATOS **does** see the add-ítem button after expanding a centro.

---

## Fail 2 (blocking near month boundary) — D14 Bogotá month

**Expected:** locked period and default `fecha` use **America/Bogota**, same as `serverTodayBogota()` (`Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })`).

**Found:** `currentPeriodYYYYMM()` and `todayYYYYMMDD()` use `getUTC*`. After 19:00 Colombia on the last day of a month, UTC is already the next month → CONTRATOS GET `/items?periodo=` **403** and POST fecha **403**.

**Do:** replace both helpers with Bogotá string math. Do **not** use `new Date("YYYY-MM")`. Add a one-line comment citing D14.

---

## Pass (do not regress)

Accordion default collapsed · ADMIN create-centro with precio + recibo · CONTRATOS no balance/month/create-centro · INGRESOS pagador/beneficiario/readonly price · EGRESOS typed price · recibo page rows · no `periodo` / `valorTotal` on POST.

## Acceptance

1. CONTRATOS session: expand a centro → add-ítem button visible; save an ítem with fecha = Bogotá today → 201 and list updates.
2. CONTRATOS: no create-centro / balance / month input (existing AC#3 still green).
3. `currentPeriodYYYYMM()` equals `Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota'}).format(new Date()).slice(0,7)`.
4. Smoke still green, plus the new CONTRATOS add-ítem case.

Write a short addendum in `completion-report.md`. Reply `COMPLETE:` with evidence.
