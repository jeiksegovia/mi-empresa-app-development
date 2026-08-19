# W2-backend progress report

## Status
- T4 (CONTRATOS GET `/empresa/cargos` exception): **completed** (6/6 passed)
- T5 (nomina bonos + periodos): **completed**
- T6 (actividades API + ACL spec): **completed** (7/7 passed)

## T5 — pre-change capture (FIJO POST without valorJornada)

**Assignment said capture real 400 body.** Actual result was **HTTP 201**, not 400.

```
POST /api/v1/nomina/periodos
{ empleadoId:397, periodo:"2026-08", tipoContrato:"TERMINO_FIJO", valorMensual:2000000, aportesSociales:100000 }
→ HTTP 201
{ success:true, data:{ ..., aportesSociales:"100000", bonos:null, totalPagado:"2100000", subtotalCalculado:null } }
```

**Deviation (non-breaking):** FIJO already does NOT require `valorJornada`/`mediasJornadas` on create. The defect to fix is formula: current `totalPagado = valorMensual + aportes` (2100000). Contract D3 wants `totalPagado = valorMensual + bonos` with aportes stored but **not** added. Documented per Turning Point Rules R4 ("if 400 is something other than jornada validation — document and still fix required-fields-by-tipo").

OPS without cuenta cobro still 400 `{ field:'archivos.CUENTA_COBRO' }` (unchanged this cycle).

## T4 done
1. Route-level exception `requireEmpresaOrContratosGetCargos` on `GET /empresa/cargos`
2. Moved `requireDomain('empresa')` from `router.use` to per-route (writes + other empresa endpoints)
3. `DOMAIN_ACCESS.CONTRATOS.empresa` remains `false`
4. Spec: `backend/tests/empresa/contratos-get-cargos.spec.ts` — **6 passed**
   - matrix cell false
   - CONTRATOS GET 200
   - CONTRATOS POST/PATCH/DELETE 403 DOMAIN_FORBIDDEN
   - GERONTOLOGA GET 403

### Evidence
```
npx playwright test tests/empresa/contratos-get-cargos.spec.ts --reporter=line
→ 6 passed (952ms)
```

## T6 done — Actividades API + ACL spec (qa-session-aug-17 R6)

1. Existing `backend/src/routes/actividades.routes.ts` + `backend/src/services/actividadService.ts` already implement contract §4.3 to the letter: own-item filter, today-only, EMPLEADO_REQUIRED, DUPLICATE_DAY, ADMIN-only PUT/DELETE. No contract gaps to fix.
2. `backend/src/middleware/domainAccess.ts` already carries the `actividades` cells per §1.2 (GERONTOLOGA/CONTRATOS=read-only, PROFESORES/AUXILIARES=create-only); `domainAccess` union already includes `actividades`.
3. `backend/src/routes/index.ts` already mounts `/actividades` at api/v1.
4. Playwright spec **created**: `backend/tests/actividades/registro-actividades-acl.spec.ts` — 7 tests, all passing.
   - ADMIN full CRUD (POST→201, PUT→200, DELETE→204)
   - PROFESORES own GET + POST today 201; foreign empleadoId 403; past 403; PUT/DELETE 403; duplicate 409 DUPLICATE_DAY
   - AUXILIARES own GET + POST today 201; PUT/DELETE 403
   - GERONTOLOGA + CONTRATOS: GET 200 (all); POST 403 DOMAIN_FORBIDDEN
   - PROFESORES with no empleadoId: POST → 400 EMPLEADO_REQUIRED
   - GERONTOLOGA GET sees both seeded empleado rows (no own-item filter)
5. Spec is idempotent: prisma in `beforeAll` wipes `registro_actividades` rows for empleadoIds 395 (Pedro) / 396 (Ana) and upserts a throw-away `qa-profesor-no-empleado@miempresa.local` (PROFESORES, empleadoId=null) for the EMPLEADO_REQUIRED case.
6. `tests/rbac/matrix-parity.spec.ts` already includes `actividades` in the DOMAINS list and verbatim match (lines 207/221/235/248). Re-ran: 4/4 passed. No edits needed.

### Evidence
```
npx playwright test tests/actividades/registro-actividades-acl.spec.ts --reporter=line
→ 7 passed (1.6s)

npx playwright test tests/rbac/matrix-parity.spec.ts --reporter=line
→ 4 passed (590ms)
```

## Notes
- Working directory verified: `/Users/jeik/ws/mi-empresa-app-development`
- Contract SSOT: `orchestration-ctx/decisions/contract-schema-qa-aug-17.md`
- `actividades` Domain cell already in DOMAIN_ACCESS (W1-W2 prior commits)
- Restarted :3101 via `lsof -ti :3101` + `npx tsx src/server.ts` (was non-watch)
