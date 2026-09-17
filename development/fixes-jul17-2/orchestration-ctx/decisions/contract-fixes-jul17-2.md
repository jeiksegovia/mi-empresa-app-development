# Contract Addendum — fixes-jul17-2

> Authoritative for W9/W10/W11. Extends (never contradicts) the dynamic-fichas contract
> (`development/instrumentos-dynamic-fichas/orchestration-ctx/decisions/schema-contract-instrumentos-dynamic-fichas.md`).
> Deviations: file under §Deviations at bottom, or TURNING-POINT if breaking.

## §1 RBAC

### §1.1 Enum (R1)
`TipoEmpleado { GERONTOLOGA, CONTRATOS }` — additive migration only.
Developer authorized CLEAN DB RESETS (local now; staging in the final gated task) so roles/data
seed from clean — but the migration itself must still be additive/replayable.

### §1.2 Domains + matrix (single source of truth)
`backend/src/middleware/domainAccess.ts` exports:
```ts
export type Domain = 'pacientes'|'fichas'|'instrumentos'|'empleados'|'nomina'|'certificados'|'empresa'|'notas'
export const DOMAIN_ACCESS: Record<'GERONTOLOGA'|'CONTRATOS', Record<Domain, boolean|'create-only'>>
export function requireDomain(domain: Domain)  // Express middleware
```
Matrix (authoritative; workers verify against real route inventory, deviations filed):

| Domain | GERONTOLOGA | CONTRATOS |
|---|---|---|
| pacientes | true | 'create-only' → GET list/detail + POST create allowed; PUT/DELETE allowed? NO — create-only means: GET list/detail ✓, POST ✓, PUT/PATCH/DELETE ✗ |
| fichas (all /patients/*/fichas* + /patients/fichas/vencimientos + /instruments/records*) | true | false |
| instrumentos (/instruments*) | true | false |
| empleados (incl. educación, contrato-laboral) | false | true |
| nomina | false | true |
| certificados (empleado + empresa) | false | true |
| empresa (datos + cargos) | false | false |
| notas (/patients/*/notas*) | true | false |

### §1.3 requireDomain semantics
1. No auth → 401 (existing). 2. `rol === 'ADMIN'` → allow. 3. `rol !== 'EMPLEADO'` (AUDITOR/
OPERADOR) → fall through to EXISTING behavior (do not add restrictions; keep whatever requireRole
already does on that route). 4. EMPLEADO + `tipoEmpleado null` → allow (legacy, zero regression).
5. EMPLEADO + GERONTOLOGA/CONTRATOS → matrix; 'create-only' per method rule above.
Denied → 403 `{ success:false, message:'Acceso no permitido para su perfil', code:'DOMAIN_FORBIDDEN' }`.
`requireInstrumentWriter` UNCHANGED (runs in addition where already applied).

### §1.4 Session (frontend needs tipoEmpleado)
W9 verifies the login/me payload includes `tipoEmpleado`; if absent, ADD it (non-breaking additive
field) to both login response and /auth/me. W10 consumes it from the session store.

### §1.5 Frontend enforcement (W10)
`frontend/app/composables/useDomainAccess.ts`: mirrors DOMAIN_ACCESS (duplicated constant is
acceptable; QA validates parity), exposes `can(domain)`, `canCreateOnly(domain)`.
- Sidebar (layouts/default.vue): hide forbidden sections.
- Route middleware: prefix→domain map (`/pacientes`→pacientes, `/instrumentos`→instrumentos,
  `/empleados`→empleados, `/nomina`→nomina, `/certificados`→certificados, `/empresa`→empresa);
  forbidden → redirect `/` + toast "Acceso no permitido".
- In pacientes detail: fichas & evaluaciones tab + asignar/llenar controls require `can('fichas')`;
  notas section requires `can('notas')`; edit/delete controls require full pacientes (not create-only).

## §2 QA seeding (R4/R5)

### §2.1 Users
| SSM prefix (/miempresa/staging/qa/) | Email default | rol | tipoEmpleado |
|---|---|---|---|
| qa-admin/ | qa-admin@miempresa.com | ADMIN | null |
| qa-gerontologa/ | qa-gerontologa@miempresa.com | EMPLEADO | GERONTOLOGA |
| qa-contratos/ | qa-contratos@miempresa.com | EMPLEADO | CONTRATOS |
Each prefix: `EMAIL` (String) + `PASSWORD` (SecureString, generated on first run, never printed to
SSM logs). Legacy `/qa/QA_USER_EMAIL|PASSWORD` kept as ALIAS of qa-admin (same values, updated
together). seed-qa.ts: three idempotent upserts (update rewrites password/rol/tipoEmpleado/activo),
never touches other rows. Works for local dev too (env-driven).
get-qa-creds.sh prints all three profiles (+ login URL + the same cross-site warning).

### §2.2 Deployment docs (R6 — manual step, no automation)
- reset-staging-db.sh: prints an UNMISSABLE final block: "REQUIRED NEXT STEP: ./seed-qa-staging.sh
  --stage staging ... (idempotent) — QA users are NOT part of db:seed".
- `context/implementation-plan/staging-release-jul17-runbook.md`: OP-7 note added (required step).
- New reusable checklist `context/implementation-plan/staging-deploy-checklist.md` (short): build →
  deploy → migrate/seed → **seed-qa-staging.sh (REQUIRED, idempotent)** → canary QA with get-qa-creds users.

## §3 Crear-from-template (§4.7 of the base contract, R7/R8)

### §3.1 API
`POST /instruments` body gains OPTIONAL `templateCodigo: string` (one of BARTHEL, MINI_MENTAL,
TINETTI, YESAVAGE, MNA_CUADRO, FICHA_NUTRICIONAL). Behavior when present (single transaction):
1. Resolve template instrument by codigo + its ACTIVE InstrumentoVersion → else 404
   `TEMPLATE_NOT_FOUND` / `NO_ACTIVE_VERSION`.
2. Deep-copy `definition`; rewrite `definition.codigo` = new instrument's codigo,
   `definition.nombre` = new nombreInstrumento, `definition.version` = 1. Everything else verbatim.
3. Create Instrumento (caller's metadata: nombre, codigo, tipo, periodicidad, rolesPermitidos…) +
   InstrumentoVersion v1 `activo:true` (creadoPor = caller).
4. Source template rows NEVER mutated (VERSION_LOCKED semantics untouched).
Response: existing create shape + `activeVersion {id, version, activo}`.
Without `templateCodigo`: legacy metadata-only creation (allowed; instrument is "sin definición").

### §3.2 Frontend (R8)
Crear page: selector "Tipo de instrumento (plantilla)" — options = the 6 templates with summary
(nº ítems, puntaje máx or "informativo") fetched from `GET /instruments/:codigo/definition`;
plus "Sin plantilla (solo metadatos)". Sin-definición instruments: badge "Sin definición — no
llenable" on list + details; excluded/disabled in the patient assign/llenar picker.

## §4 Audit view + dry-run (R9/R10, frontend-only)
- `InstrumentAuditView.vue`: input = definition JSON (from GET definition). Renders: per section —
  titulo, subtotal max, skip rule ("Se omite si <sección> ≥ N — opcional"), section-level ranges;
  per item — label, tipo, required, options table (label → puntaje); global resultEvaluation table.
  Print-friendly. Expandable from instrumento details.
- Dry-run: "Probar sin guardar" button (details page) opens dialog with `DynamicInstrumentForm` +
  client `scoring.ts` live totals + banner "Vista de prueba — resultado no oficial, no se guarda".
  NO network writes (QA asserts zero POST/PATCH during dry-run).

## §5 Clean-DB directive (developer, 2026-07-17)
Local: W9 may `prisma migrate reset` the local dev DB (dev-only, seeds restore). Staging: clean
reset + deploy happens ONLY in the final gated task (#38) after QA, using reset-staging-db.sh +
wipe utility runbook pattern + the NEW seed-qa step — separately checkpointed.

## Deviations
### W9 (backend)
*(empty)*
### W10 (frontend)
*(empty)*
