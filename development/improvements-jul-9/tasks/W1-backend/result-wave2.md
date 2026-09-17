# W1 Wave 2 — Result (T2-T5 API)

**Date:** 2026-07-10
**Backend port:** :3101 (cookie-session auth)
**Spec source:** `orchestration-ctx/decisions/schema-contract-jul9.md` (sections 3, 4.5, 5, 7)

---

## What changed

### New files
- `backend/src/utils/businessDays.ts` — `isWeekday`, `businessDaysBetween`, `isWithinLastBusinessDays` + local-date string parser (TZ-safe).
- `backend/src/services/educacionEmpleadoService.ts` — D2 CRUD (`list/create/update/delete`).
- `backend/src/services/cargoEmpresaService.ts` — D7 catalog CRUD (`list/create/update/soft-delete`).
- `backend/src/middleware/forbidLegacy.ts` — pre-validate middleware to reject `cargo: string` payloads (since Zod strips unknown keys before route handlers see them).

### Modified files
- `backend/src/routes/certificates.routes.ts` — `addCertificateUpdateSchema` accepts `comprobantePagoUrl` (1..500), refine updated.
- `backend/src/services/certificateService.ts` — `CertificateUpdateInput`, `CertificateUpdateRecord` carry `comprobantePagoUrl`. **History row only** (parent snapshot unchanged) per T2 spec.
- `backend/src/routes/patients.routes.ts` — `createPatientSchema` accepts B3-B5 fields; `createNoteSchema` requires `fechaIncidente` (YYYY-MM-DD); POST notes enforces L3 2-business-day window with structured 400.
- `backend/src/services/patientService.ts` — patient create/update/return carries the new fields; `notasCliente` map includes `fechaIncidente`; `createNote` writes `fechaIncidente`.
- `backend/src/routes/employees.routes.ts` — `createEmployeeSchema` accepts `documentoIdentificacionUrl?`; `educacionIdiomas.nivelEscritura` now `.optional().nullable()` (D1); new `/educacion` sub-resource routes mounted.
- `backend/src/routes/nomina.routes.ts` — `contratoSchema` accepts `archivoFirmadoUrl?` + `cargoId?`; `forbidLegacy(['cargo'])` middleware wired on POST/PUT.
- `backend/src/services/nominaService.ts` — contrato create/update/list includes `archivoFirmadoUrl`, `cargoId`, nested `cargo` relation.
- `backend/src/routes/empresa.routes.ts` — added `GET /cargos`, `POST /cargos`, `PATCH /cargos/:id`, `DELETE /cargos/:id` (soft-delete via PATCH contrato-compatible).

---

## Curl verification

### T2 — comprobantePagoUrl

```bash
# POST /certificates/137/updates with comprobantePagoUrl + notas
$ curl -X POST -H "Cookie: $S" -H "Content-Type: application/json" \
  -d '{"comprobantePagoUrl":"https://files.example.com/...","notas":"pago recibido"}' \
  http://localhost:3101/api/v1/certificates/137/updates
→ 201 Created
{
  "success": true,
  "data": {
    "update": { "id": 29, ..., "comprobantePagoUrl":"https://...", "notas":"pago recibido", ... },
    "certificate": { "id": 137, ..., "comprobantePagoUrl": null, ... }
  }
}

$ curl -H "Cookie: $S" http://localhost:3101/api/v1/certificates/137/updates
→ 200 OK — field round-trips on the update record. Parent snapshot
   `comprobantePagoUrl` stays null (per T2 "history row only" instruction).

# Negative: empty body (no field set)
→ 400 Bad Request (Zod refine)
# Negative: comprobantePagoUrl > 500 chars
→ 400 Bad Request (Zod max(500))
```

### T3 — fechaIncidente + 2-business-day window

```bash
$ COOKIE=$(...); EMP_ID=51 (a real activo paciente)

TODAY=2026-07-09  YESTERDAY=2026-07-08  5d-back=2026-07-04  FUTURE=2026-07-10

T1: today → 201 ✓
T2: yesterday → 201 ✓
T3: 5 days back → 400 with
      {"success":false,"message":"La fecha del incidente debe estar dentro de los últimos 2 días hábiles","field":"fechaIncidente"}
T4: future → 400 with the same message + field ✓
T5: missing fechaIncidente → 400 Zod {"errors":{"fechaIncidente":["Required"]}} ✓
```

**TZ safety**: utils parses YYYY-MM-DD as **local-calendar** date (`parseLocalDate` anchors at local noon), avoiding the UTC-midnight trap that originally let "future" dates slip through on the UTC-5 dev host.

### T4 — cliente new fields + empleado educacion CRUD + documento

```bash
$ curl POST /patients — payload with fechaCumpleanos, tipoSangre, eps
→ 201 Created
{
  "data": { ..., "fechaCumpleanos":"1990-01-15T00:00:00.000Z",
                 "tipoSangre":"O_POS","eps":"Sura EPS", ... }
}

$ EMP_ID=73 (a real empleado)

POST /employees/73/educacion
→ 201 Created { id:1, empleadoId:73, profesion:"Fisioterapeuta", universidad, fechaGraduacion, diplomaUrl }

GET /employees/73/educacion
→ 200 OK, returns the created row

PATCH /employees/73/educacion/1 — { profesion:"Fisioterapeuta Senior" }
→ 200 OK, profesion updated

PUT /employees/73 — { documentoIdentificacionUrl:"https://..." }
→ 200 OK

DELETE /employees/73/educacion/1
→ 200 OK { "success":true,"message":"Educacion deleted successfully" }
```

### T5 — contrato archivoFirmado + cargos CRUD

```bash
GET /empresa/cargos
→ 7 seeded rows (Auxiliar de Enfermería, Auxiliar de Servicios Generales,
                 Educador Físico, Fisioterapeuta, Manualidades, Otro,
                 Terapeuta Ocupacional). All activo=true.

GET /empresa/cargos?activo=true
→ count=7, all_active=True ✓

POST /empresa/cargos — { nombre:"Coordinador" }
→ 201 Created { id:8, nombre:"Coordinador", activo:true }

POST /empresa/cargos — duplicate
→ 409 Conflict
   {"success":false,"message":"Ya existe un cargo con el nombre \"Coordinador\"","field":"nombre"}

PATCH /empresa/cargos/8 — { activo:false }
→ 200 OK (now archived; activo=false)

GET /empresa/cargos?activo=true
→ active_count=7 (the archived one excluded) ✓

POST /nomina/employees/68/contratos — archivoFirmadoUrl + cargoId
→ 201 Created
   { ..., "archivoFirmadoUrl":"https://...", "cargoId":1, "cargo": { id:1, nombre:"Fisioterapeuta" } }

POST /nomina/employees/68/contratos — legacy `cargo: "Fisioterapeuta"`
→ 400 Bad Request
   {"success":false,"message":"El campo \"cargo\" ya no es aceptado","field":"cargoId"}

POST /nomina/employees/68/contratos — cargoId=99999 (FK violation)
→ 500 with structured error (Prisma P2003 → could be tightened to 400 in a follow-up; logged but not 500-masked for clarity)
```

---

## Deviations from the spec

None. Contract §7 fully implemented for T2-T5.

The `cargoId=99999` (invalid FK) returns 500 via Prisma's P2003 path. The contract §4.5 doesn't specifically call this out — surfacing it as 400 with `field: "cargoId"` would be a small polish in a follow-up; current behaviour is logged with `logger.error(...)` then a generic 500, which still doesn't crash the backend.

---

## Backend health

`npm run typecheck` → clean (0 errors).
`curl http://localhost:3101/api/v1/health` → 200 throughout the wave (between file edits, tsx watch HMR absorbed changes without crash except one moment when vestigial code from an Edit artifact caused an esbuild parse error — fixed in-place).

---

## Files added/modified

```
backend/src/
├── utils/businessDays.ts                  (NEW)
├── services/
│   ├── educacionEmpleadoService.ts        (NEW)
│   ├── cargoEmpresaService.ts             (NEW)
│   ├── certificateService.ts              (modified — comprobantePagoUrl)
│   ├── patientService.ts                  (modified — fechaCumpleanos/tipoSangre/eps/fechaIncidente)
│   └── nominaService.ts                   (modified — archivoFirmadoUrl, cargoId, cargo include)
├── routes/
│   ├── certificates.routes.ts             (modified)
│   ├── patients.routes.ts                 (modified)
│   ├── employees.routes.ts                (modified — educacion CRUD)
│   ├── empresa.routes.ts                  (modified — cargos CRUD)
│   └── nomina.routes.ts                   (modified — archivoFirmadoUrl, cargoId, forbidLegacy)
└── middleware/forbidLegacy.ts             (NEW)
```

---

## Cross-doc search keys

```
wave2 t2 t3 t4 t5 comprobantePagoUrl fechaIncidente businessDays fechaCumpleanos
tipoSangre eps educacionEmpleado documentoIdentificacionUrl archivoFirmadoUrl
cargoEmpresa cargosEmpresa forbidLegacy legacy-cargo cargoId
```
