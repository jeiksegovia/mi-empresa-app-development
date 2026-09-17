# Follow-up (Aug 04) — Completion Report

All three items implemented and tested locally. **Deploy to staging is PENDING developer approval** (final step).

## 1. Report relocation ✓
`fixes-aug-04-test-flake-and-rbac-session.md` moved into this task dir (`development/qa-session-jul-31/`).

## 2. TINETTI gait fix → TINETTI.v3 ✓
- **Root cause**: v2 collapsed the original gait item 11 into two 4-option items whose options named the *opposite* foot ("pie derecho" item referenced "pie izquierdo"), and both were labeled "11." → the gerontóloga read it as "mixed / not the originals".
- **Fix (v3)**: two per-foot items, **4 options each**, worded consistently about the SAME foot named in the header (no cross-foot reference); gait items renumbered 10–17. Scores unchanged (0/1/1/2) → total max unchanged → risk thresholds valid.
- **Versioned** (not patched): new `TINETTI.v3.json`; applied via `npm run instruments:upgrade` (non-destructive — inserts v3, flips active, preserves v2 history for already-scored fichas).
- **Tests**: `tinetti-v3-marcha.spec.ts` 5/5 (file-level scoring); `seed-definitions` expectation bumped 2→3; full instruments suite **42/42**. No FE change (instruments render dynamically from the definition).

## 3. Employee "bloqueador" lock ✓
- **Model**: `empleados.bloqueado BOOL default false` + `bloqueado_por INT?` + `bloqueado_en TIMESTAMP?` (audit). Migration `20260804165919_add_empleado_bloqueado` (additive).
- **Enforcement** (`requireEmployeeUnlocked` in `domainAccess.ts`): ADMIN bypasses before any DB hit; else one `SELECT bloqueado`; if locked → `403 EMPLOYEE_LOCKED`. Applied to `PUT /employees/:id` and `DELETE /employees/:id`.
- **Scope note (decision — "no redundant validation")**: the approved scope was "core + contracts/payment". Medio de pago lives on `PUT /employees/:id` (guarded). The contratos endpoints (`/nomina/employees/:id/contratos`) are **already `requireRole('ADMIN')`**, so non-admins can never edit contracts regardless of lock — guarding them too would be redundant (ADMIN bypasses the lock anyway). Left unguarded intentionally; if contratos ever gains contrato-edit access, add `requireEmployeeUnlocked` there.
- **Admin-only lock/unlock**: `PUT /employees/:id/lock` + `/unlock` (`requireRole('ADMIN')`) → set/clear `bloqueado` + audit.
- **Security**: `bloqueado*` are NOT in the create/update Zod schemas; `validate` writes the stripped parse back to `req.body`, so a non-admin has no request path to flip the lock. Only `setEmployeeLock` (admin endpoints) writes those columns. Lock state read from DB, admin check from JWT — no client-controllable bypass.
- **Frontend**: lock icon on empleados list; badge + admin lock/unlock toggle on detail header; locked banner + disabled "Guardar Datos Personales" on editar for non-admins.
- **Tests**: `empleado-bloqueo.spec.ts` **7/7** (CONTRATOS baseline edit; can't lock; admin lock sets audit; locked → 403 on PUT+DELETE; admin bypass; unlock; payload-injection stripped). `jul31-lock-frontend.spec.ts` **3/3** (toggle+badge, editar banner+disabled, list icon).

## Verification summary
- backend `tsc --noEmit` clean.
- BE: lock 7/7, instruments 42/42, TINETTI file-level 5/5.
- FE: lock UI 3/3; no regression (jul24 contract-monthly 5/5 + jul31 13/13).

## Files
- Schema/migration: `schema.prisma`, `migrations/20260804165919_add_empleado_bloqueado/`
- Backend: `middleware/domainAccess.ts` (requireEmployeeUnlocked), `routes/employees.routes.ts` (guards + lock/unlock), `services/employeeService.ts` (setEmployeeLock, summary/detail fields)
- Instrument: `prisma/instrument-templates/TINETTI.v3.json`
- Frontend: `empleados/index.vue`, `empleados/[id]/index.vue`, `empleados/[id]/editar.vue`
- Tests: `backend/tests/employees/empleado-bloqueo.spec.ts`, `backend/tests/instruments-dynamic/tinetti-v3-marcha.spec.ts`, `frontend/tests/local-qa/jul31-lock-frontend.spec.ts`

## Deployed to staging — 2026-08-04 ✓
Full runbook: `context/implementation-plan/staging-release-qa-jul31-aug04-runbook.md`.
- Backend CodeDeploy **`d-EDEN0GJYK` / Succeeded** (group `miempresa-staging`); migrations **26/26** (25 eps_fondo_arl + 26 bloqueado auto-applied).
- **TINETTI v3 active** on staging (v1/v2 preserved) via `FORCE_UPGRADE=true instruments:upgrade` (tunneled; tsx not on instance).
- Frontend **Amplify job 13 / SUCCEED**.
- Backup net: `pre-jul31-aug04.sql.gz` (33,819 B, sha256 `f67e7488…`).
- Post-deploy smoke PASS (FE 200s; lock end-to-end: admin lock → contratos 403 EMPLOYEE_LOCKED → unlock; TINETTI v3). Net data side-effect: none (lock reverted).
- **This release also shipped the full qa-session-jul-31 R1/R2/R3** (Nequi/Bre-B, nómina valor-mensual, EPS/Fondo/ARL) which had not been deployed before.

### Addendum — TINETTI v4 (same day, later)
Gerontóloga followup on v3 item 11: clinical structure required (two orthogonal binary dimensions per foot). Published **v4**: item 11 split into 11a (pie derecho: sobrepasa + separa) and 11b (pie izquierdo: sobrepasa + separa) — 4 binary sub-items. Simetría=12, then 13–16. Max score preserved (v4=v3=27 → thresholds unchanged). Deployed to staging via tunneled `FORCE_UPGRADE=true instruments:upgrade` (definition-only, no code/migration). Live-verified on staging DB: v4 active, 10 gait items in correct order. Tests: `tinetti-v4-marcha.spec.ts` 5/5, `seed-definitions` bumped 3→4 (4/4).

### Addendum — TINETTI v5 (same day, later²)
User revised spec: item 11 must be **one item per foot with 4 options each** (A/B/C/D scored 0/1/0/1) — the v4 clinical-split shape was rejected. Published **v5** literal spec:
- `ma_pie_derecho`, `ma_pie_izquierdo` restored as single-select-scored with 4 options each.
- Numbering `10 · 11a · 11b · 12 · 13 · 14 · 15 · 16`.
- Max per foot 2→1 → total 27→**25** → thresholds rescaled: bajo 23–25 · mod 17–22 · alto 0–16.
- Latent bug caught & fixed in v3/v4 test files (`.total` → `.puntajeTotal`; prior assertions were vacuously `undefined===undefined`). Thresholds were still correct by construction.
- Deployed v5 to staging (definition-only; v1–v4 preserved inactive). Live-verified on staging DB: `ma_iniciacion(2) | ma_pie_derecho(4) | ma_pie_izquierdo(4) | ma_simetria(2) | ma_fluidez(2) | ma_trayectoria(3) | ma_tronco(3) | ma_postura(2)`.
- Tests: `tinetti-v5-marcha.spec.ts` 6/6, `seed-definitions` bumped 4→5 (4/4), v3/v4 re-verified 5/5+5/5.
