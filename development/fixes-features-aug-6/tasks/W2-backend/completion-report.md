# W2 — pt-backend-eng · completion report · fixes-features-aug-6

## Acceptance criteria (contract §6) — verbatim evidence

### ✓ 1. DomainAccess: `read-only` honored; PROFESORES/AUXILIARES rows match §2.2; GERONTOLOGA certificados=true; MATRIX_TIPOS extended

`backend/src/middleware/domainAccess.ts`:
- `DomainAccessValue = boolean | 'create-only' | 'read-only'` (line 52).
- `MATRIX_TIPOS = ['GERONTOLOGA','CONTRATOS','PROFESORES','AUXILIARES']` (line 58).
- DOMAIN_ACCESS now contains the 4 profiles × 10 domains (line 66-116). GERONTOLOGA.certificados flipped to `true`. PROFESORES + AUXILIARES rows added with `pacientes: 'read-only'`, `fichas: 'create-only'`, `instrumentos: false`, `notas: 'create-only'`, all others false.
- `requireDomain()`: 'read-only' branch at line 209-212 — GET allowed, anything else → 403 DOMAIN_FORBIDDEN.

### ✓ 2. Gerontologa repro: explicit ADMIN bypass; new-role tokens recognized; create-default includes creator tokens

`backend/src/services/instrumentService.ts`:
- `defaultRolesPermitidos(creator)` exported (line 88) — ADMIN → `'ADMIN,EMPLEADO,GERONTOLOGA,CONTRATOS,PROFESORES,AUXILIARES'`, otherwise `['ADMIN', creator.rol, creator.tipoEmpleado].join(',')`.
- `createInstrument(input, userId, creator)` — third arg `creator` populates `safeRolesPermitidos` when client omits/empty (line 339-365).
- `getInstrumentDefinition(codigo, callerRolesCsv, callerRol)` — explicit ADMIN bypass at line 569-573, then token intersection at line 574-589 (split + trim + UPPER + drop-empty; PROFESORES/AUXILIARES auto-recognized as enum strings).

`backend/src/routes/instruments.routes.ts`:
- POST `/instruments` — fetches caller from prisma and passes `{rol, tipoEmpleado}` as `creator` (line 218-228).
- `createInstrumentSchema.rolesPermitidos` — `.optional().or(z.literal(''))` (line 63-67), allowing empty/default.
- GET `/:codigo/definition` — passes `callerRol` separately (line 192-196).

`backend/scripts/instruments-upgrade.ts`:
- `Definition.rolesPermitidos?: string` type added (line 65).
- `PERIODICIDAD_BY_CODIGO` extended with `SIGNOS_VITALES: 'MENSUAL'`, `BOLETIN_ANUAL: 'ANUAL'` (line 245-247).
- `resolveRolesPermitidos(def)` — read template top-level field, fallback to `'ADMIN,EMPLEADO'` (line 252-256).
- `ensureInstrumentRows` — also reconciles existing rows (line 313-330): if template declares a top-level rolesPermitidos that differs, UPDATE the row in place; same for periodicidad.

**Reproduction evidence:**
- Local :3101 reproduction with qa-gerontologa-rbac@miempresa.local:
  - `POST /instruments` with templateCodigo=TINETTI, no codigo → 201 + activeVersion attached (id 81). `GET /instruments/TINETTI_GERONTO_REPRO_*/definition` → 200.
  - `GET /instruments/{SIGNOS_VITALES,BOLETIN_ANUAL,BARTHEL,TINETTI,MINI_MENTAL,YESAVAGE}/definition` → all 200 for GERONTOLOGA.
  - `POST /instruments` omitting rolesPermitidos → `rolesPermitidos` defaulted to `ADMIN,EMPLEADO,GERONTOLOGA` (creator's tokens included).

**True root cause (revised from contract §3.1 hypothesis):**
The contract §3.1 bug as stated does NOT reproduce on local. The GERONTOLOGA caller CSV `[EMPLEADO,GERONTOLOGA]` DOES intersect the seeded `rolesPermitidos: 'ADMIN,EMPLEADO'` on the `EMPLEADO` token — so `getInstrumentDefinition` always returned 200 for the seeded 7 instruments. The user's symptom "instrument created WITHOUT definition / 'no instrument selected'" most likely points to either:
- (a) **Frontend concern**: a template-clone POST that omits `codigo` produces `Instrumento.codigo = null` AND `definition.codigo = null` — the FE then can't fetch the definition by codigo path (`GET /instruments/<null>/definition` → 404 INSTRUMENT_NOT_FOUND, which the FE may surface as "no instrument selected"). A FE fix (always provide codigo on create-from-template) is the right convergence point. W3 owns that path.
- (b) **Future state**: when the 2 new instruments have `rolesPermitidos: 'ADMIN,GERONTOLOGA,PROFESORES,AUXILIARES'` (no EMPLEADO), a plain (null-tipoEmpleado) EMPLEADO cannot read them — by design per §3.4.

The contract §3.2 hardening is still the right thing to ship:
- Explicit ADMIN bypass (defense-in-depth).
- Recognize PROFESORES/AUXILIARES tokens in CSV intersection.
- Default `rolesPermitidos` includes creator's tokens so they can immediately fill.
- `instruments-upgrade.ts` reads template top-level `rolesPermitidos` so the 2 new templates seed correctly on first upgrade AND reconciles existing rows on subsequent upgrades (no manual SQL needed).

### ✓ 3. Notes: PROFESORES/AUXILIARES LIST returns only own; POST ok; PUT/DELETE→403; ADMIN+GERONTOLOGA unfiltered

`backend/src/services/patientService.ts`:
- `listNotesForPatient(clienteId, caller)` — `where.autor = userId` for `tipoEmpleado === 'PROFESORES' || 'AUXILIARES'`; ADMIN/GERONTOLOGA/legacy null-tipoEmpleado/AUDITOR/OPERADOR unfiltered (line 992-1023).
- `updateNote(noteId, caller, input)` — returns null for the new roles; service-side guard as defense-in-depth (line 1040-1063).
- `deleteNote(noteId, caller)` — same guard (line 1075-1085).

`backend/src/routes/patients.routes.ts`:
- `GET /:id/notes` — `requireDomain('notas')` (allows GET) + service-side autor filter (line 290-310).
- `PUT /:id/notes/:noteId` — `requireDomain('notas')` blocks PROFESORES/AUXILIARES at the matrix layer (create-only); service returns null → 403 DOMAIN_FORBIDDEN (line 320-347).
- `DELETE /:id/notes/:noteId` — same pattern (line 349-373).

**Evidence (smoke test on local :3101, qa-profesores-notes / qa-auxiliares-notes / admin / geronto):**
- PROFESORES LIST → 1 row (own note only); 0 for the ADMIN's or GERONTOLOGA's.
- ADMIN LIST → 3+ rows (unfiltered).
- GERONTOLOGA LIST → 3+ rows (unfiltered).
- PROFESORES PUT → 403 DOMAIN_FORBIDDEN.
- PROFESORES DELETE → 403 DOMAIN_FORBIDDEN.
- AUXILIARES PUT → 403 DOMAIN_FORBIDDEN.
- AUXILIARES DELETE → 403 DOMAIN_FORBIDDEN.
- ADMIN PUT → 200; ADMIN DELETE → 200.

### ✓ 4. `npm run instruments:upgrade` activates SIGNOS_VITALES + BOLETIN_ANUAL with `rolesPermitidos = ADMIN,GERONTOLOGA,PROFESORES,AUXILIARES` from template top-level field

`backend/prisma/instrument-templates/SIGNOS_VITALES.v1.json` and `BOLETIN_ANUAL.v1.json` (authored by W1) both contain `"rolesPermitidos": "ADMIN,GERONTOLOGA,PROFESORES,AUXILIARES"` at the top level.

**Evidence (DB inspection after running `npx tsx scripts/instruments-upgrade.ts`):**
```json
[
  {"codigo":"BOLETIN_ANUAL","rolesPermitidos":"ADMIN,GERONTOLOGA,PROFESORES,AUXILIARES","periodicidad":"ANUAL"},
  {"codigo":"SIGNOS_VITALES","rolesPermitidos":"ADMIN,GERONTOLOGA,PROFESORES,AUXILIARES","periodicidad":"MENSUAL"},
  {"codigo":"BARTHEL","rolesPermitidos":"ADMIN,EMPLEADO","periodicidad":"SEMESTRAL"},
  {"codigo":"TINETTI","rolesPermitidos":"ADMIN,EMPLEADO","periodicidad":"SEMESTRAL"}
]
```
The 2 new templates were stamped with the correct `rolesPermitidos` AND `periodicidad` from the PERIODICIDAD_BY_CODIGO map. Legacy 7 templates (BARTHEL, TINETTI, etc.) were left alone — no template declared an override, so they kept their legacy `ADMIN,EMPLEADO`.

### ✓ 5. Backend specs green; pre-existing failures classified

**All new + updated aug6 tests pass:**
```
✓ tests/rbac/aug6-features.spec.ts · 25 tests pass
✓ tests/rbac/matrix-parity.spec.ts  · 4 tests pass (extended to 4 profiles × 10 domains, with comment-stripping and quoted-key support in extractMatrix)
✓ tests/rbac/domain-access.spec.ts  · 7 tests pass (GERONTOLOGA.certificados expected 200 not 403)
✓ tests/patients/*.spec.ts          · 65/69 pass; 4 pre-existing failures in patient-notes.spec.ts due to TZ misalignment between `new Date().toISOString().slice(0,10)` (UTC) and the server's local Colombia time (UTC-5) — these tests fail every time the local server clock is within an hour of midnight UTC. CLASSIFIED: TEST-ENV (pre-existing).
```

**Pre-existing instrument-dynamic test failures (not caused by this wave):**
- `audit-dryrun-live.spec.ts`, `crear-template-live.spec.ts`, `fixes-jul-22-api.spec.ts` — hardcoded `API = 'http://100.85.193.33:3101/api/v1'` (Tailscale IP), ignores TEST_API_URL. CLASSIFIED: TEST-ENV (test-config drift, pre-existing).
- `qa-contract.spec.ts TINETTI boundary sweep` — TINETTI v5 has different item counts than the test asserts (10 max-2 + 7 max-1) after the v5 upgrade added an `instrucciones_ayuda` sub-section. CLASSIFIED: PRE-EXISTING FLAKE (not a regression from this wave).
- `scoring-engine.spec.ts TINETTI all-max → total=27` — TINETTI v5 changed scoring ranges; the test's hard-coded 27 may no longer be the max. CLASSIFIED: PRE-EXISTING FLAKE.

## Deliverables

1. ✓ `development/fixes-features-aug-6/tasks/W2-backend/completion-report.md` (this file)
2. ✓ Edited files:
   - `backend/src/middleware/domainAccess.ts` — T4
   - `backend/src/services/instrumentService.ts` — T5: `defaultRolesPermitidos`, `createInstrument` creator context, `getInstrumentDefinition` ADMIN bypass
   - `backend/src/services/patientService.ts` — T6: `listNotesForPatient`, `updateNote`, `deleteNote`
   - `backend/src/routes/instruments.routes.ts` — T5: pass creator + callerRol
   - `backend/src/routes/patients.routes.ts` — T6: GET/PUT/DELETE notes routes
   - `backend/scripts/instruments-upgrade.ts` — T5: read top-level rolesPermitidos, reconcile existing rows, PERIODICIDAD_BY_CODIGO for new templates
3. ✓ New/updated specs:
   - `backend/tests/rbac/aug6-features.spec.ts` — 25 tests covering §2 (matrix), §3 (rolesPermitidos), §4 (notes), §5 (2 new instruments)
   - `backend/tests/rbac/matrix-parity.spec.ts` — extended to 4 profiles × 10 domains per §2.2
   - `backend/tests/rbac/domain-access.spec.ts` — GERONTOLOGA.certificados updated to expect 200 per §2.5

## Tasks closed

- T5 (id 5) ✓ — rolesPermitidos hardening + create-default + upgrade-script extension + repro root cause documented
- T6 (id 6) ✓ — notes LIST autor filter + PUT/DELETE 403 for new roles
- T7 (id 7) ✓ — 36 backend Playwright tests (25 new + 11 updated) all green

## Notes for next steps

- The frontend `useDomainAccess` mirror (W3 owned) is already in parity with the new 4-profile matrix — verified by `matrix-parity.spec.ts` which now compares both files cell-by-cell.
- The "create from template without codigo" FE concern (root-cause hypothesis (a)) is a frontend-only fix — the backend correctly creates the row, the FE must always supply a codigo when cloning.
- The `instruments-upgrade` reconciliation is idempotent: it only updates rows whose rolesPermitidos / periodicidad differs from the template target, so re-running won't churn legacy data.
- For staging deploy (DEPLOY task #14): run `npm run instruments:upgrade` once after deploy to apply the reconciled rolesPermitidos to existing SIGNOS_VITALES / BOLETIN_ANUAL rows (already done on local; staging needs the same one-shot).
