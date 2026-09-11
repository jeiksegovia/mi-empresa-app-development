# Plan: sep-11 GERONTOLOGA cert files + CONTRATOS paciente save

**Path**: `context/implementation-plan/sep-11-geronto-cert-contratos-paciente-plan.md`  
**Date**: 2026-09-11  
**Status**: implementing locally. Staging/prod deploys after tests. Profile `disruptive`. Prod logs: read-only.

## Prod evidence (pm2 `/opt/miempresa/logs/pm2-0.log`)

### A. GERONTOLOGA certificados empty after create
`gerontologa@miempresa.com` 16:10 login.

| time | call | status |
|---|---|---|
| 16:11:41 | POST `/uploads/presigned-url` | **200** (S3 ok) |
| 16:12:11 | POST `/certificates` | **201** (shell created) |
| 16:12:11 | POST `/certificates/1/updates` | **403** (file not attached) |
| 16:26:01 | same pattern on cert 2 | 201 then 403 |

Upload is auth-only (`uploads.routes.ts`). Create is matrix `create-only` (dirty tree already dropped ADMIN on POST `/`). Attach is still `requireRole('ADMIN')` on POST `/:id/updates`. FE `crear.vue` POSTs the shell then the first update; on 403 it toasts "Certificado creado, pero falló la primera actualización".

Root: qa-aug-27 F1 set GERONTOLOGA certificados **read-only** + ADMIN on writes. qa-sep-2 F1 flipped matrix to **create-only** and opened POST `/` but **left `/updates` ADMIN**. Prod zip shipped that hole.

Decision: GERONTOLOGA may POST `/certificates/:id/updates` (first attach and later renewals use the same POST). PUT/DELETE cert stay ADMIN. CONTRATOS stays read-only (matrix 403 on any POST).

### B. CONTRATOS cannot save paciente
`contratos@miempresa.com` 15:18 login. Six `POST /patients` **400** (15:51–16:19), Zod `email` invalid_string. Not DOMAIN_FORBIDDEN. Matrix `CONTRATOS.pacientes = create-only` already allows POST.

Schema: `z.string().email().optional().or(z.literal(''))`. Empty string is ok; `"  "`, `"correo"`, `"ejemplo@"` fail. Create form only sends email if `trim()` is non-empty, so a leftover/partial value went on the wire.

Decision: trim; blank or no `@` → omit (undefined); real emails still validated.

## Permission map (certificados)

```
FE crear.vue
  POST /certificates            requireDomain(certificados)  [create-only → POST ok]
  POST /uploads/presigned-url   auth only                    [200]
  POST /certificates/:id/updates requireDomain + requireRole(ADMIN)  [403 GERONTO]
```

GERONTOLOGA create-only: GET+POST allowed; PUT/PATCH/DELETE 403. `/updates` is POST so matrix already allows it once ADMIN gate is removed.

## Pacientes

```
FE crear.vue → POST /patients
  requireDomain(pacientes)  CONTRATOS create-only → POST ok
  validate(createPatientSchema)  email Zod 400
```

## Implementation

1. `certificates.routes.ts`: drop `requireRole('ADMIN')` on POST `/:id/updates`. Keep it on PUT/DELETE.
2. `patients.routes.ts`: coerce email (trim, empty/no-@ → undefined, else `.email()`).
3. FE crear: do not send email without `@`.
4. Tests: GERONTO POST `/updates` 201; CONTRATOS POST `/updates` 403; GERONTO PUT still 403. CONTRATOS POST patient with `email: "  "`, `"correo"`, omitted → 201; `"not-an-email@"` still 400 if invalid format after @ present.

## Out of scope

Unrelated dirty tree (centro-costos, notes CRUD, valoracion v2 already committed `d49573f`). Commit this fix scoped. Working-tree zip still ride-alongs (same as prior staging/prod).
