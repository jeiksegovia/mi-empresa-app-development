# Completion Report — W9 · FE revision (CONTRATOS ítem CRUD + Bogotá dates)

**Worker**: `worker-9` · `pt-frontend-eng`  
**Task**: TaskList `#7` (W5 Revision — CONTRATOS ítem CRUD + Bogotá dates)  
**Branch**: `main` (working tree, not committed per CLAUDE.md git rule)  
**Date**: 2026-08-18

## Scope (only these changes)

1. `frontend/app/pages/centro-costos/index.vue` — ítem CRUD buttons (add / edit / delete) no longer guarded by `v-if="isAdmin"`. Visible to anyone who can open the page (ADMIN + CONTRATOS). Centro create/edit/delete **still** `isAdmin`.
2. `frontend/app/pages/centro-costos/index.vue` — `currentPeriodYYYYMM()` and `todayYYYYMMDD()` rewritten to use `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })` instead of `getUTC*` (D14).
3. `frontend/tests/centro-costos/centro-costos-smoke.spec.ts` — new test "AC#3 CONTRATOS sees add-ítem button after expanding a centro (revision D14/R21-R22)".

Backend untouched. Recibo layout untouched. No backend migration, no `new Date("YYYY-MM")` usage.

---

## Proof — Fail 1: ítem CRUD no longer gated on `isAdmin`

```bash
$ grep -n 'v-if="isAdmin"' frontend/app/pages/centro-costos/index.vue
728:          v-if="isAdmin"
863:                  v-if="isAdmin"
```

Only two `v-if="isAdmin"` remain — both on **centro** CRUD (line 728 = create-centro button, line 863 = edit-centro button). Line 874 (`v-if="isAdmin && g.items.length === 0"`) keeps the `isAdmin` half for delete-centro and adds the items-must-be-empty guard.

The previous file had five `v-if="isAdmin"` matches (728, 863, 983, 994, 1010). After the revision, the three ítem-button guards (983 edit-ítem, 994 delete-ítem, 1010 add-ítem) are removed; the three centro guards are unchanged.

Verification of the three unguarded ítem buttons:

```bash
$ sed -n '981,1014p' frontend/app/pages/centro-costos/index.vue
                <Column header="Acciones" style="min-width: 110px">
                  <template #body="{ data }">
                    <Button
                      icon="pi pi-pencil"
                      ...
                      :data-testid="`centro-costos-edit-item-${data.id}`"
                      @click="openItemDialog(g.centro, data)"
                    />
                    <Button
                      icon="pi pi-trash"
                      ...
                      :data-testid="`centro-costos-delete-item-${data.id}`"
                      @click="deleteItem(data)"
                    />
                  </template>
                </Column>
              </DataTable>

              <div class="mt-3 flex justify-end">
                <Button
                  label="Añadir ítem"
                  ...
                  :data-testid="`centro-costos-add-item-${g.centro.id}`"
                  @click="openItemDialog(g.centro, null)"
                />
```

No `v-if` precedes any of the three ítem buttons — they're visible to every role with page access.

---

## Proof — Fail 2: Bogotá timezone instead of UTC

```bash
$ sed -n '135,147p' frontend/app/pages/centro-costos/index.vue
// ─── Helpers ──────────────────────────────────────────────────────────────────
// D14: locked-period and default `fecha` MUST use America/Bogota (not UTC) so
// that after 19:00 Colombia on the last day of a month, UTC isn't already the
// next month and CONTRATOS doesn't hit the month guard with 403.
function todayBogotaYYYYMMDD(): string {
  return Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}
function currentPeriodYYYYMM(): string {
  return todayBogotaYYYYMMDD().slice(0, 7)
}
function todayYYYYMMDD(): string {
  return todayBogotaYYYYMMDD()
}
```

`Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })` returns the ISO-format `YYYY-MM-DD` in the Bogotá wall clock. `slice(0,7)` gives `YYYY-MM`. No `new Date("YYYY-MM")` is used. No `getUTC*` remains in the page (verified by `grep getUTC` returning zero hits).

```bash
$ grep -n "getUTC" frontend/app/pages/centro-costos/index.vue
(no output)
```

AC#3 (acceptance criterion from `revision-request-contratos-items.md`):
> `currentPeriodYYYYMM()` equals `Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota'}).format(new Date()).slice(0,7)`.

`currentPeriodYYYYMM()` now equals `todayBogotaYYYYMMDD().slice(0,7)` and `todayBogotaYYYYMMDD()` is exactly `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())`. ✓

---

## Proof — Smoke (frontend Playwright)

All 17 tests pass (16 original + 1 new CONTRATOS add-ítem test). No regression on existing assertions (CONTRATOS still has no balance / no month input / no create-centro; ADMIN still creates centros, runs full AC#1–AC#7).

```
Running 17 tests using 1 worker

  ✓  AC#1 ADMIN sees 8 INGRESOS + 6 EGRESOS centros, all collapsed by default
  ✓  AC#1 expanding one centro does NOT force-expand others
  ✓  AC#1 add-ítem button only visible after expanding a centro
  ✓  AC#2 ADMIN create-centro dialog persists a custom INGRESOS centro with precio + habilitarRecibo
  ✓  AC#3 CONTRATOS: no balance card, no month input, no create-centro button
  ✓  AC#3 CONTRATOS sees add-ítem button after expanding a centro (revision D14/R21-R22)   ← NEW
  ✓  AC#4 INGRESOS dialog: requires fecha + pagador + patient; valorUnitario is read-only
  ✓  AC#5 EGRESOS dialog: typed valorUnitario; no pagador/beneficiario
  ✓  AC#4 INGRESOS dialog blocks save when centro has no precioUnitario (R26)
  ✓  AC#6 After INGRESOS save on habilitarRecibo centro, print CTA appears (R29)
  ✓  AC#6 After INGRESOS save on a NON-habilitarRecibo centro, no print CTA
  ✓  AC#7 Recibo page renders the F6 rows (R30)
  ✓  balance reflects API exactly (string-decimal, AC#4 — trap #2)
  ✓  sidebar shows "Centro de Costos" for ADMIN (AC#6)
  ✓  sidebar hides "Centro de Costos" for GERONTOLOGA (AC#6)
  ✓  create an EGRESOS ítem through the dialog — drives DatePicker, fills optional fields (Task 6)
  ✓  delete centro with ítems → 409 surfaces server message (D8)

  17 passed (19.9s)
```

The new test exercises Fail 1: as `CONTRATOS`, expand `centro 17` and assert `centro-costos-add-item-17`, `centro-costos-edit-item-117`, `centro-costos-delete-item-117` are all visible. Combined with the still-green existing AC#3 (no balance card, no month input, no create-centro for CONTRATOS), the role split is preserved exactly per the contract.

---

## Acceptance criteria (from `revision-request-contratos-items.md`)

| # | Criterion | Status |
|---|-----------|--------|
| 1 | CONTRATOS session: expand a centro → add-ítem button visible | ✓ (new smoke test #6, plus `centro-costos-add-item-17` no longer guarded) |
| 2 | CONTRATOS: no create-centro / balance / month input (AC#3) | ✓ (existing AC#3 smoke test still green) |
| 3 | `currentPeriodYYYYMM()` equals `Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota'}).format(new Date()).slice(0,7)` | ✓ (definition rewritten to compose exactly that expression) |
| 4 | Smoke still green, plus the new CONTRATOS add-ítem case | ✓ (17/17 pass) |

## Notes / non-changes

- Backend untouched (no migrations, no route changes).
- Recibo page layout untouched.
- `periodo` and `valorTotal` are still NOT sent from the FE on POST (trap #6, trap #7 — covered by existing smoke tests).
- `fecha` is still the only date field on the ítem dialog (D10 — covered by existing AC#4).
- INGRESOS still sends `pagador + beneficiarioClienteId` and reads `valorUnitario` from `centro.precioUnitario` (R26 — covered by existing AC#4 + AC#4-no-precio blocks-save).
- No `new Date("YYYY-MM")` anywhere in the page.