# Requirements: fixes-jul17-2

## Functional Requirements

| ID | Requirement | Acceptance Criterion |
|----|-------------|----------------------|
| R1 | `TipoEmpleado` gains `CONTRATOS` (additive enum migration) | Migration applies cleanly; existing rows untouched; enum used by seed + guards |
| R2 | Domain-access model (backend) | Guard middleware maps tipoEmpleado → allowed domains per the access matrix (plan §Matrix). ADMIN bypass. `tipoEmpleado=null` EMPLEADO = unchanged current access (no regression). Blocked domain → 403 `{code:"DOMAIN_FORBIDDEN"}` |
| R3 | Domain-access (frontend) | Sidebar/nav hides forbidden sections per profile; direct-URL navigation to a forbidden route shows a clean 403 page/redirect; fichas tab hidden inside pacientes for CONTRATOS |
| R4 | seed-qa multi-user | `seed-qa.ts` upserts qa-admin (ADMIN), qa-gerontologa (EMPLEADO+GERONTOLOGA), qa-contratos (EMPLEADO+CONTRATOS); idempotent; never touches other rows. `seed-qa-staging.sh` ensures SSM params `/miempresa/staging/qa/{qa-admin,qa-gerontologa,qa-contratos}/{EMAIL,PASSWORD}` (SecureString, generated on first run); legacy `qa/QA_USER_*` params kept as alias of qa-admin |
| R5 | `get-qa-creds.sh` lists all three users (stage/URL/email/password per profile) |
| R6 | Deployment docs (manual step) | reset-staging-db.sh prints a mandatory post-reset reminder; jul-17 runbook + a reusable release-checklist note gain "run seed-qa-staging.sh (idempotent) after any deploy/reset" as a REQUIRED step |
| R7 | Crear-from-template (backend) | `POST /instruments` accepts optional `templateCodigo` (one of the 6); when present, server copies that template's ACTIVE definition as the NEW instrument's v1 (definition.codigo/nombre rewritten to the new instrument), creates `InstrumentoVersion` activo — instrument immediately fillable + scorable. Copy is a snapshot (no link to source template). Zod + contract §-addendum |
| R8 | Crear-from-template (frontend) | crear page gains a template selector ("Tipo de instrumento") with per-template summary (items, max score); created instrument lands fillable; instruments WITHOUT definition show a clear "Sin definición — no llenable" state (list + details + patient assign picker excludes/disables them) |
| R9 | Audit view | Instrumento details: expandable read-only audit rendering the ACTIVE definition — every section (subtotal max, skip rule), every item with type + every option WITH its score, result-evaluation ranges tables (global + section-level) — Spanish, clean, print-friendly |
| R10 | Dry-run ("Probar sin guardar") | From details: interactive fill using the real renderer with live subtotals/total/classification, clearly marked as prueba, NOTHING persisted; works for all 6 seeded instruments + template-created ones |
| R11 | Tests | Backend: RBAC 403/200 matrix spec per profile per domain; crear-from-template spec (copy semantics, fillable end-to-end). Frontend: nav-gating spec per QA profile; audit-view spec (BARTHEL scores visible); dry-run spec (fill → live score, no POST). Legacy suites still green |
| R12 | Existing behavior preserved | `requireInstrumentWriter` semantics unchanged for existing users; auditor/operador untouched; local dev seed users unaffected |

## Access Matrix (authoritative draft — workers verify against the real route inventory and file deviations)

| Domain (routes/nav) | ADMIN | GERONTOLOGA | CONTRATOS | EMPLEADO (tipoEmpleado null) |
|---|---|---|---|---|
| pacientes (CRUD) | ✓ | ✓ | view+create (no fichas tab) | ✓ (today's behavior) |
| fichas & evaluaciones (incl. vencimientos) | ✓ | ✓ | ✗ | ✓ |
| instrumentos (view + write per requireInstrumentWriter) | ✓ | ✓ | ✗ | view (today's behavior) |
| empleados (incl. educación, contratos-laborales) | ✓ | ✗ | ✓ | ✓ |
| nómina | ✓ | ✗ | ✓ | ✓ |
| certificados (empleado + empresa) | ✓ | ✗ | ✓ | ✓ |
| empresa (datos, cargos) | ✓ | ✗ | ✗ | ✓ |
| notas clientes | ✓ | ✓ | ✗ | ✓ |

## Non-Functional
- Spanish UI; existing conventions; enum migration additive only (no destructive steps).
- SSM: staging namespace only; SecureString; no prod, no IAM changes.
- Worker output < 127k tokens; reports per project rules.

## Out of Scope
- Form-builder/definition editing (D1 locked); permission tables / per-user ACLs; after-install
  seeding automation (developer chose manual); prod anything; staging deploy of this cycle.
