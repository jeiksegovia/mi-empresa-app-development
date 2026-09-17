# Initial-Prompt Fixes — jul-8 — Implemented

**Delivered:** 2026-07-09
**Source plan:** `context/plans/initial-prompt-fixes-jul-8.md`
**Team:** W1 (research), W2 (backend), W3 (frontend fichas/nomina/401), W4 (frontend cert/instr), W5 (QA + tests)
**Status:** ✅ All 5 requirement domains MET · 44 initial cases + 2 reset-audit cases (41+2 pass, 3 environmental skips, 0 fail) · GAP-1/2/3 resolved + follow-ups W8 (CORS/IaC) + W9 (file-reset audit) also complete · **Shipped to staging 2026-07-09** (runbook: `context/implementation-plan/staging-release-jul9-runbook.md`) · Only GAP-4 (pre-existing typecheck env issue) remains.

## Shipped to staging (2026-07-09)
- **Backend**: CodeDeploy `d-M8XBER0HK` to `miempresa-staging` succeeded (1m 8s). Artifact 235 KiB. Migration `20260709025844_add_certificado_update` applied on-instance via `after-install.sh` → `certificados_empresa_updates` table created (0 rows), 14/14 migrations at HEAD.
- **Frontend**: Amplify Job 3 (branch `staging`) succeeded first attempt. Bundle baked with API base `https://miempresa-api-stg.disruptiveexp.com/api/v1`.
- **Post-deploy QA**: 3-tier staging suite 33/33 pass (DB 18 + API 9 + FE 6); jul-8 endpoint authed smoke 8/8 ✓; PM2 online with 0 restarts; error-log scan clean.
- **Safety net**: pg_dump `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul9.sql.gz` (14.7 KiB, SHA256 `ba4f8abd…cadf649`, AES256) preserved for rollback.
- **Prod untouched**: `miempresa-prod` deployment group not enumerated against; no `*-prod-*` resource mutated.

## Follow-up (2026-07-09 later) — CORS invariant + modal-reuse leak audit

### CORS: dev bucket allowlist extended (W8)
User reported CORS 403 when uploading from `http://100.85.193.33:3100` (dev machine on Tailscale). Dev bucket `miempresa-uploads-540657241795-dev` allowlist previously inherited the CFN default (staging domain + localhost 3100/3101/3102) and did not cover LAN dev IPs.

Fix (via IaC — no one-off `put-bucket-cors`):
- `backend/infrastructure/db/scripts/deploy-infrastructure.sh` gained a `DEV_LOCAL_ORIGINS` variable that expands to the six-origin list including `http://100.85.193.33:3100` + `http://10.57.126.228:3100`; conditionally passed as `UploadsCorsAllowedOrigins` override when `STAGE=dev`. Staging/prod paths untouched.
- `backend/.env.example` — added a "CORS INVARIANT" block explaining the rule: **any host in `NUXT_PUBLIC_API_BASE` / frontend serving origin MUST be in the dev bucket CORS allowlist**, otherwise browser PUT preflights 403.
- Redeployed `miempresa-s3-dev` stack (`UPDATE_COMPLETE`). Verified via `aws s3api get-bucket-cors` — 6 origins present.
- CORS preflight from `http://100.85.193.33:3100` now returns 200 with `Access-Control-Allow-Origin` echoed.

### File-state reset audit (W9)
User reported the ficha "actualizar estado" dialog on `pacientes/[id]/index.vue` retained the previously-picked file when switching to a different ficha row.

Root cause: `stashKey = computed(() => \`ficha:${route.params.id}:file\`)` used only the patient id. Every ficha row on the same patient page shared one IDB slot, so `restoreFile(stashKey.value)` returned the previous ficha's file.

Fix:
- `stashKey` now includes `fichaForm.id`: `\`ficha:${route.params.id}:${fichaForm.id || 'new'}:file\``.
- Explicit reset of `uploadedFile`/`uploadedFileName`/`uploadedFileKey` at the top of `openFichaDialog` before any restore, so a late-arriving `restoreFile()` promise from a previously-closed dialog cannot pollute the new dialog's state.
- Playwright regression spec at `frontend/tests/local-qa/jul8-ficha-file-reset.spec.ts` — proves file input is clean when opening a different ficha.

Audit of every page under `frontend/app/pages/`:
- **1 leak fixed** — the pacientes ficha dialog (above).
- **2 hygiene touch-ups** — `certificados/[id].vue` (`updateFileInputRef.value.value = ''` on `openAddUpdateDialog`) and `empleados/[id]/editar.vue` (`contratoArchivoInputRef.value.value = ''` in `resetContratoForm`) — clear the underlying HTML `<input type="file">` so the DOM node doesn't retain a stale File reference even though the reactive form was already reset.
- **15 other pages verified NO-LEAK** — full table in `development/fixes-jul-8/tasks/W9-reset-audit/audit-report.md`.
- All `jul8-*.spec.ts` — 17 pass, 2 environmental skips.


### Android tab-discard root cause + fix (W6/W7)
- **Root cause** (W6): Chrome Memory Saver / Android LMK discards the tab during file picker round-trip. **NOT BFCache** (BFCache only applies to history navigation). Full reload wipes JS heap; Pinia state resets; File reference lost.
- **Fix A applied** (W7): new `frontend/app/composables/useFileStash.ts` stashes File blob to IndexedDB on select; restores on dialog re-open. Works because IDB survives tab discard + reload. 24h TTL, namespaced keys.
- **Fix B applied** (W7): `useFileStashTitleGuard` helper updates `document.title` during picker round-trip to signal "tab actively updating" — reduces discard probability (MED confidence, defense-in-depth).
- **Applied to 5 forms**: fichas dialog (primary), cert crear (main + first-update), cert agregar dialog, instrumento crear (plantilla), instrumento editar (plantilla).
- **New test spec**: `frontend/tests/local-qa/jul8-fichas-file-stash.spec.ts` — file survives simulated reload + IDB round-trip contract test. Both pass.

---

## Executive summary

All fixes implemented against a running local stack (backend :3101 + frontend :3100 + pg :15432). Delivery aligns with the user's original 5-domain requirements + the "considerations" note about the Android background-reload behavior. Root cause of the SPA "reload" bug proven to be browser-level tab-unload, not app code — mitigated via `sessionStorage` form persistence on the affected `pacientes/[id]` ficha dialog.

New Prisma model `CertificadoUpdate` + migration `20260709025844_add_certificado_update` shipped and applied. Backend gained versioned certificate history endpoints, roles Zod refinement against `RolUsuario`, ficha status Zod + `VENCIDO → COMPLETADO` transition, nomina cuenta-de-cobro service-layer validation, and `tipoContrato` server-side filter. Frontend gained certificate history UI + Agregar dialog + first-update-in-create flow, instrumento MultiSelect + plantilla upload + new `[id]/editar.vue` page, ficha 3-bug fixes + form-state persistence, nomina filter + inline error, 401 dispatch-plugin split.

**GAP-1 resolved 2026-07-09**: user confirmed D2 as final — dates are only editable through the Agregar Actualización dialog (which creates a `CertificadoUpdate` row). Direct-edit of dates in the metadata form is intentionally not supported to preserve the audit trail. The edit form remains `{ nombre, tipoCertificado, descripcion, estado }`.

---

## Requirement → delivery map

### 1 · Certification flow
| User requirement | Delivered |
|---|---|
| Cert w/ optional first update (file, notas, dates) at creation | `frontend/app/pages/certificados/crear.vue` — optional "Primera actualización" section runs POST /certificates then POST /:id/updates in one flow |
| Cert detalle shows history + "Agregar" | `certificados/[id].vue` — new Historial card + Dialog posting to POST /certificates/:id/updates |
| Edit view = metadata only (no files, no update) | `certificados/[id].vue` editForm = { nombre, tipoCertificado, descripcion, estado } |
| New schema supports updates | Prisma model `CertificadoUpdate` (id, certificadoId, archivoUrl?, notas?, fechaEmision?, fechaVencimiento?, creadoPor, createdAt) |
| Append-only history + snapshot rule | Backend `addCertificateUpdate` mutates parent snapshot + recomputes `estado` from effective `fechaVencimiento` |

**Note**: GAP-1 (dates in edit view) was resolved by keeping D2 — see Executive summary block above.

### 2 · Instrumentos flow
| User requirement | Delivered |
|---|---|
| Roles = predetermined tag selector | `instrumentos/crear.vue` `<MultiSelect :options="['ADMIN','EMPLEADO','AUDITOR','OPERADOR']">` (auto-imported by @primevue/nuxt-module) |
| API casts roles securely | Backend Zod `.refine()` on `rolesPermitidos` — each comma-split value must equal a `RolUsuario` enum literal (case-sensitive). Bogus values 400. |
| Blank template file upload | `plantillaArchivo` field via `useFileUpload().uploadFile(file, 'instrumentos')` in crear.vue + new `[id]/editar.vue` |

### 3 · Paciente historial de fichas
| Bug | Fix |
|---|---|
| Instrument name doesn't render | Dual-shape read `data.instrumento?.nombreInstrumento ?? data.instrumentoNombre ?? '—'` — backward-compat for W2's nested shape change |
| "Guardar cambios" silently no-op | `handleFichaSubmit` now includes `notasObservaciones` + `fechaVencimiento` in PATCH body when non-empty; backend Zod schema added |
| Pencil disabled after VENCIDO | Frontend `:disabled="!validTransitions[data.estado]?.length"`; frontend + backend transitions map now `VENCIDO → ['COMPLETADO']` |

Additional: **form-state persistence in `sessionStorage`** under `ficha-form-draft-${patientId}-${fichaId}` restores draft on dialog re-open (Android background-reload mitigation per D1). Only file-name persisted (File object cannot be serialized) — UX shows "Vuelve a seleccionar" hint after restore.

### 4 · Nomina
| User requirement | Delivered |
|---|---|
| Filter empleados by contract; default only-with-contract | Frontend `MultiSelect` default `['OPS','OBRA_O_LABOR','TERMINO_FIJO','TERMINO_INDEFINIDO']`; backend default (no `tipoContrato` param) returns empleados with any active contract |
| Filter by contract type + "no contract" | `SIN_CONTRATO` UI option maps to wire `NONE` (synthetic value on the API) |
| Clear error when cuenta de cobro missing on OPS | Backend service throws `{ status: 400, field: 'archivos.CUENTA_COBRO' }`; frontend renders inline `<Message>` under the CUENTA_COBRO slot |

### 5 · Considerations (SPA reload)
- **Root cause**: exhaustive frontend search (W1) found no `location.reload`, no `visibilitychange` listener, no PWA, no service worker. The perceived reload is Android Chrome tab-unload of backgrounded tabs (OS-level, non-fixable at app level).
- **Mitigation applied**: sessionStorage draft persistence on the ficha status dialog; 401 UX rewritten (single redirect, skip if already on /login, toast).
- **401 refactor**: `useApi.ts` now dispatches DOM event `app:session-expired` instead of calling `useAuthStore()`/`useToast()`/`navigateTo()` directly inside `$fetch.onResponseError` — this avoids the `inject() outside setup()` warning-storm loop and the double-redirect races.

---

## Files delivered

### Backend (8 files + 1 migration)
```
backend/prisma/schema.prisma                             (CertificadoUpdate model + relations)
backend/prisma/migrations/20260709025844_add_certificado_update/migration.sql   (NEW)
backend/src/services/certificateService.ts               (addCertificateUpdate, listCertificateUpdates, CertificateError)
backend/src/routes/certificates.routes.ts                (POST/GET /:id/updates, addCertificateUpdateSchema)
backend/src/routes/instruments.routes.ts                 (refineRolesPermitidos)
backend/src/routes/patients.routes.ts                    (Zod on PATCH fichas, VENCIDO→COMPLETADO)
backend/src/services/nominaService.ts                    (cuenta-cobro check, tipoContrato filter)
backend/src/routes/nomina.routes.ts                      (query param passthrough, field on 400)
```

### Frontend (9 files: 2 new)
```
frontend/app/composables/useApi.ts                        (401 dispatches session-expired event)
frontend/app/plugins/session-expired.client.ts            (NEW — plugin owns auth clear + toast + navigate)
frontend/app/pages/pacientes/[id]/index.vue               (3 bug fixes + sessionStorage persistence)
frontend/app/pages/nomina/index.vue                       (MultiSelect filter + inline CUENTA_COBRO error)
frontend/app/pages/certificados/[id].vue                  (Historial + Agregar dialog + metadata-only edit)
frontend/app/pages/certificados/crear.vue                 (optional Primera actualización section)
frontend/app/pages/instrumentos/crear.vue                 (MultiSelect roles + plantilla file upload)
frontend/app/pages/instrumentos/[id]/editar.vue           (NEW — 19,928 bytes)
frontend/app/pages/instrumentos/[id]/index.vue            (admin-only Editar button)
```

### Tests (13 specs + 1 helper — added by W5, satisfies CLAUDE.md "NEVER skip writing tests" rule)
```
backend/tests/certificates/updates.spec.ts               (6 cases)
backend/tests/instruments/roles-refinement.spec.ts       (6 cases)
backend/tests/patients/ficha-transitions.spec.ts         (3 cases)
backend/tests/nomina/cuenta-cobro-required.spec.ts       (4 cases, 1 env-skip)
backend/tests/nomina/tipo-contrato-filter.spec.ts        (8 cases)
frontend/tests/local-qa/jul8-cert-updates.spec.ts         (1 case)
frontend/tests/local-qa/jul8-cert-crear-with-update.spec.ts (2 cases)
frontend/tests/local-qa/jul8-instrumentos-multiselect.spec.ts (2 cases)
frontend/tests/local-qa/jul8-instrumentos-editar.spec.ts (2 cases)
frontend/tests/local-qa/jul8-fichas-vencido-to-completado.spec.ts (2 cases)
frontend/tests/local-qa/jul8-fichas-persistence.spec.ts  (1 case)
frontend/tests/local-qa/jul8-nomina-filter.spec.ts       (3 cases, 2 env-skips)
frontend/tests/local-qa/jul8-nomina-cuenta-cobro-error.spec.ts (2 cases)
frontend/tests/helpers/auth.ts                            (origin-aware login helper — unblocks all tests when apiBase is external IP)
```
**Aggregate: 42 cases · 39 pass · 3 environmental skips · 0 fail.**

---

## Key decisions

Full detail at `development/fixes-jul-8/orchestration-ctx/decisions/scope-decisions.md`.

| # | Decision | Why | Where applied |
|---|---|---|---|
| D1 | SPA reload = browser tab-unload, not code | W1 exhaustive search: 0 `location.reload`, 0 `visibilitychange` | Mitigation via sessionStorage + 401 refactor |
| D2 | Add `CertificadoUpdate` model; parent snapshot recomputed on POST /updates | User asks for versioned history ("old certificate updates appeared below") | Prisma + `certificateService.ts` + `certificados/[id].vue` |
| D3 | Enable `VENCIDO → COMPLETADO` transition (backend + frontend) | User explicitly requested reversibility | `patients.routes.ts` + `pacientes/[id]/index.vue` |
| D4 | Nomina cuenta-cobro validation lives in service layer with structured `field` response | Zod schema can't see `tipoContrato` (needs runtime contract lookup) | `nominaService.ts` + `nomina.routes.ts` |
| D5 | `GET /nomina` default = only empleados with active contract | User explicitly requested this default | `nominaService.ts` — backwards-incompatible; documented in schema-contract.md |
| D6 | Roles stays comma-string on the wire; Zod refined; MultiSelect on UI | Avoid migration risk on `rolesPermitidos String @db.VarChar(255)` | `instruments.routes.ts` + `instrumentos/crear.vue` + `[id]/editar.vue` |
| D7 | Instrumentos gets a dedicated `[id]/editar.vue` page | Detail was read-only; no way to edit post-create | New page + Editar button on detail |

---

## Runtime state at delivery

- Backend :3101 healthy (`/api/v1/health` 200). Post-migration Prisma client regenerated.
- Frontend :3100 HMR-live.
- Database on :15432: one manual cleanup was necessary — removed a stuck failed row (`20260704173358_f2_cert_empleado_generic`) from `_prisma_migrations`; documented in W2 completion report if it recurs.
- No git commits (per CLAUDE.md "Only commit when explicitly instructed").

---

## Open items (from QA report §7)

| # | Severity | Item |
|---|---|---|
| GAP-1 | ✅ RESOLVED | Kept D2 — dates history-managed only. Documented above. |
| GAP-2 | ✅ RESOLVED | W7: "Descargar plantilla" button added on `instrumentos/[id]/index.vue` |
| GAP-3 | ✅ RESOLVED | W7: IDB file-stash + sessionStorage draft applied to cert crear/agregar + instrumento crear/editar (per W6 root-cause fix) |
| GAP-4 | LOW | `nuxt typecheck` broken at env level (vue-tsc/ESM compat — pre-existing, not a jul-8 regression) |
| CORS invariant | ✅ NEW RULE | Any origin serving the frontend MUST be in S3 dev bucket CORS allowlist — added as inline comment in `backend/.env.example` |
| Modal-reuse file leak | ✅ RESOLVED | W9 fixed `stashKey` scope + audited 18 pages; regression spec added |

---

## Grep hooks

`fixes-jul-8 CertificadoUpdate schema-contract session-expired session-expired.client.ts refineRolesPermitidos rolesPermitidos MultiSelect validTransitions VENCIDO COMPLETADO ficha-form-draft sessionStorage cuenta-de-cobro CUENTA_COBRO tipoContrato NONE SIN_CONTRATO plantillaArchivo instrumentos editar historial agregar actualizacion primera-actualizacion GAP-1 D2 D3 D5 D6`
