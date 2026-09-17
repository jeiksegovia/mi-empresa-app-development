# T2/T3 Wave-2 Result — W1 wave 2, tasks #26 + #27

**Worker**: pt-backend-eng (W1, REUSE)
**Date**: 2026-07-10
**Status**: ✅ Complete — all 5 acceptance criteria satisfied

---

## T2 (#26) — C1 + C4 + C7

### C1: atomic single-step ficha create

`POST /api/v1/patients/:id/fichas` extended (kept same path; branching on `archivoCompletado` presence):

```bash
# Legacy PENDIENTE flow (no archivoCompletado)
POST /patients/52/fichas  {instrumentoId:42, versionRegistro:"v1.0"}
  → 201, estado=PENDIENTE, singleStepCompleted=false

# C1 single-step (with archivoCompletado) — atomic
POST /patients/52/fichas  {instrumentoId:42, versionRegistro:"v1.0", archivoCompletado:"https://...", notasObservaciones:"..."}
  → 201, estado=COMPLETADO, fechaCompletado=2026-07-10T12:25:22.656Z, singleStepCompleted=true
```

Implementation: `patientService.createFichaAtomic(patientId, responsableId, input)` — wraps `prisma.$transaction(async tx => {...})` so a single-step ficha and its `archivoCompletado` are written atomically.

### C4: lazy PENDIENTE → VENCIDO flip

`patientService.flipExpiredFichas(prisma, clienteId?, now)` — single `updateMany` (NOT per-row).

Triggered inside:
1. `getPatient(id)` — before the relation read.
2. `listFichasVencimientos(days)` — before the report.

Verified:
```bash
# Manually insert a past-due ficha
INSERT INTO registros_fichas_completadas (...) VALUES (52, 42, 'PENDIENTE', 'v0.9', 38, '2026-06-01');
# registro_id=159, estado=PENDIENTE

# Then GET the patient (triggers flip)
GET /patients/52
  → data.registrosFichas[*].estado = ['PENDIENTE', 'COMPLETADO', 'VENCIDO', 'VENCIDO']
    (registro_id=159 was flipped → VENCIDO automatically)
```

### C7: weekly vencimientos report

`GET /api/v1/patients/fichas/vencimientos?days=N` (default 7).

```json
{
  "success": true,
  "generatedAt": "2026-07-10T12:25:22.744Z",
  "windowDays": 7,
  "total": 2,
  "data": [
    { "id": 40, "clienteId": 52, "clienteNombre": "Ana Gómez Ruiz",
      "instrumentoId": 43, "instrumentoNombre": "Plan Nutricional",
      "instrumentoTipo": "NUTRICION", "estado": "VENCIDO",
      "fechaVencimiento": "2024-06-30T00:00:00.000Z",
      "fechaCompletado": null, "diasHastaVencimiento": -741 },
    ...
  ]
}
```

Ordering: `fechaVencimiento` asc (most overdue first). `estado ∈ {PENDIENTE, VENCIDO}` only.

---

## T3 (#27) — C6 gating + usuario tipoEmpleado

### C6: /instruments/* writes gated

Middleware `requireInstrumentWriter()` in `src/middleware/auth.ts`:

```ts
// Look up usuario (rol + tipoEmpleado) — one SELECT per request.
// ADMIN → next
// EMPLEADO + tipoEmpleado='GERONTOLOGA' → next
// else → 403
```

Applied to: `POST /instruments`, `PUT /instruments/:id`, `DELETE /instruments/:id`.
GETs remain open.

### Allow/deny matrix (verified)

| Role | POST /instruments | PUT /instruments/:id | DELETE /instruments/:id | GET /instruments |
|---|---|---|---|---|
| ADMIN | **201** ✓ | n/a tested | n/a | **200** ✓ |
| EMPLEADO + GERONTOLOGA | **201** ✓ | n/a tested | n/a | **200** ✓ |
| plain EMPLEADO | **403** ✗ | n/a | n/a | **200** ✓ |
| AUDITOR | **403** ✗ | n/a | n/a | **200** ✓ |

Exact denial message:
```json
{ "success": false, "message": "Insufficient permissions: instrument writes require ADMIN or EMPLEADO+GERONTOLOGA" }
```

### Usuario tipoEmpleado write API (new)

`src/routes/users.routes.ts` (mounted at `/api/v1/users`):

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| `GET` | `/users` | — | `{success, data:[Usuario...], total}` | ADMIN only |
| `POST` | `/users` | `{email, password, rol, nombre, apellido, empleadoId?, tipoEmpleado?}` | `Usuario` | ADMIN only; 400 if tipoEmpleado set without rol=EMPLEADO |
| `PATCH` | `/users/:id` | partial of POST + `activo` + `tipoEmpleado: null` (clear) | `Usuario` | ADMIN only; tipoEmpleado auto-nulled if rol changes |

Verified curls:
```bash
POST /users  {rol:'ADMIN', tipoEmpleado:'GERONTOLOGA'}
  → 400 {message:'tipoEmpleado is only valid when rol="EMPLEADO"', field:'tipoEmpleado'}

POST /users  {rol:'EMPLEADO', tipoEmpleado:'GERONTOLOGA', nombre:'Maria', apellido:'Gerontologa'}
  → 201 {rol:'EMPLEADO', tipoEmpleado:'GERONTOLOGA', nombre:'MARIA', apellido:'GERONTOLOGA'}
    (E1 upper-case transform applied)

GET /users  (plain EMPLEADO session)
  → 403 {message:'Insufficient permissions'}
```

---

## Verification snapshot

```text
✓ npx tsc --noEmit  → clean
✓ /api/v1/health → 200 ok (every code change absorbed by tsx-watch)
✓ C1: legacy PENDIENTE flow preserved (ficha 157)
✓ C1: single-step COMPLETADO flow atomic (ficha 158)
✓ C4: inserted PENDIENTE+futuro-vencido row flipped to VENCIDO on GET /patients/52
✓ C7: returns due/overdue fichas with paciente+instrumento names, ordered asc
✓ C6: 4-row allow/deny matrix verified
✓ Users endpoints (GET/POST/PATCH) work; ADMIN-only enforced; tipoEmpleado pairing rule enforced
✓ E1 uppercase transform applied to usuario nombre/apellido on create (verified via /users response)
✓ Test rows cleaned: 3 fichas + 2 instruments + 1 user (cascade sessions)
```

---

## Files changed (wave-2)

**Created:**
- `backend/src/routes/users.routes.ts`
- `development/next-release-jul-10/tasks/W1-backend/result-wave2.md` (this file)

**Modified:**
- `backend/src/services/patientService.ts` — added `flipExpiredFichas`, `listFichasVencimientos`, `createFichaAtomic`
- `backend/src/services/nominaService.ts` — `ContratoInput.cargoId: number` (was `number | null`); both create/update paths use direct assignment
- `backend/src/routes/patients.routes.ts` — new `vencimientosQuerySchema`, `createFichaSchema`; C7 endpoint; C1-aware `POST /:id/fichas`
- `backend/src/routes/instruments.routes.ts` — `requireInstrumentWriter()` on POST/PUT/DELETE
- `backend/src/middleware/auth.ts` — added `requireInstrumentWriter()` composable middleware
- `backend/src/routes/index.ts` — mounted `userRoutes` at `/api/v1/users`
- `development/next-release-jul-10/orchestration-ctx/decisions/schema-contract-jul10.md` — §5.A/B/C filled with C1/C4/C7 + C6 spec, Zod schemas, response shapes, verified curls

---

## Test cleanup

```text
DELETE FROM instrumentos WHERE UPPER(nombre_instrumento) IN ('ADMIN WRITE','GERO WRITE');
DELETE FROM sesiones WHERE usuario_id IN (SELECT id FROM usuarios WHERE email='gerontologa@miempresa.com');
DELETE FROM usuarios WHERE email='gerontologa@miempresa.com';
-- All test artifacts purged. Dev DB returned to jul-9 seed + the 18 contratos.
```
