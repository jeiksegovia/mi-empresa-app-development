# Code Review — jul4 delivered code (2026-07-05)

Static review of all files delivered in the jul4 milestones (cert-mejoras 2026-07-04 + jul4-improvements 2026-07-05).
Read-only findings report. No source files were modified.

---

## Files reviewed

### Backend — schema + migrations

| File | Verdict | Notes |
|------|---------|-------|
| `backend/prisma/schema.prisma` | **CLEAN with 3 MED findings** | New models/enums correctly added; phase-marker comments (`// jul4 P3`, `// jul4 P2`, `// jul4`, `// ─── jul4 P4 ───`, `// ─── jul4 P5 ───`, `// ─── jul4 P6 — Nómina foundation ───`) violate the comments-only-for-non-obvious-constraints convention. |
| `backend/prisma/migrations/20260704172546_f1_cert_taxonomy/migration.sql` | CLEAN | Migration is correct. Phase-marker comment in header is acceptable in SQL migrations. |
| `backend/prisma/migrations/20260704172811_f2_vivienda_salario/migration.sql` | CLEAN | OK. |
| `backend/prisma/migrations/20260704173358_f2_cert_empleado_generic/migration.sql` | CLEAN | OK; defensive `information_schema.tables` check is reasonable. |
| `backend/prisma/migrations/20260705000000_jul4_cert_empresa_recurrencia/migration.sql` | CLEAN | In-place ALTER; defensive SET NOT NULL after verified NULL=0. Acceptable. |
| `backend/prisma/migrations/20260705000100_jul4_cert_empleado_archivo/migration.sql` | CLEAN | OK. |
| `backend/prisma/migrations/20260705000200_jul4_hoja_vida/migration.sql` | CLEAN | OK. |
| `backend/prisma/migrations/20260705000300_jul4_pendientes/migration.sql` | CLEAN | OK; uses `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL END $$` for idempotency. |
| `backend/prisma/migrations/20260705000400_jul4_novedades/migration.sql` | CLEAN | OK; same idempotent style as P4. |
| `backend/prisma/migrations/20260705000500_jul4_nomina_foundation/migration.sql` | CLEAN | OK; partial unique index + nullable FK + idempotent guards. |

**Note:** the original task scope said "6 jul4 migrations" — actually 6 are in the `20260705*` set (P1-P6). The 3 `2026070417*` migrations (F1/F2) belong to the prior cert-mejoras milestone and are mostly out of scope but read for cross-context.

### Backend — routes + services

| File | Verdict | Notes |
|------|---------|-------|
| `backend/src/routes/certificates.routes.ts` | **3 findings** (1 LOW, 2 MED) | Minor: inline `// jul4 P1` on the schema field. |
| `backend/src/routes/nomina.routes.ts` (new) | CLEAN | Follows route conventions (Zod top, `validate()`, try/catch, `logger.error`, `{ success, data|message }` envelope). Status on thrown service errors via `error.status`. |
| `backend/src/routes/index.ts` | CLEAN | One-line addition: `router.use('/nomina', nominaRoutes)`. |
| `backend/src/routes/employees.routes.ts` | **3 findings** (1 LOW, 2 MED) | Two inline `// jul4 PX` comments + a section banner. |
| `backend/src/services/certificateService.ts` | **3 findings** (2 LOW, 1 MED) | Three `// jul4 P1 —` narrative comments restate what the code does. |
| `backend/src/services/nominaService.ts` (new) | **2 findings** (1 LOW, 1 MED) | `getContratoActivo` exported but never imported — dead code. |
| `backend/src/services/employeeService.ts` | **6 findings** (1 LOW, 5 HIGH/MED) | Carries `@ts-expect-error` + `try { ... } catch { /* pre-P6 — silently skip */ }` for a `prisma.contrato` access that was a P6 workaround — Contrato model now exists and is generated. |
| `backend/src/services/dashboardService.ts` | CLEAN | No delivery changes beyond the surface; counts and `prisma.certificadoEmpleado.count()` reflect new model. |
| `backend/src/services/s3Service.ts` (new) | CLEAN | Implements the presigned-URL helpers consumed by `/uploads/presigned-url` and `/uploads/download-url`. No findings. |
| `backend/src/routes/uploads.routes.ts` (new) | CLEAN | Zod schema, try/catch, correct envelope. |

### Frontend — pages + components + config

| File | Verdict | Notes |
|------|---------|-------|
| `frontend/app/app.config.ts` | CLEAN | New sidebar entry `{ label: 'Nomina', ..., to: '/nomina' }`. Follows existing sidebar shape. |
| `frontend/app/components/EmpleadoCertificadosEditor.vue` (new) | **2 findings** (1 MED, 1 LOW) | Upload logic is a re-implementation; phase-marker comments restate what the code does. |
| `frontend/app/pages/certificados/index.vue` | **4 findings** (1 MED, 3 LOW) | Comment noise: 6 inline `// jul4 P1` markers, two `formatPeriodo` arrays of month abbreviations duplicated. |
| `frontend/app/pages/certificados/[id].vue` | **4 findings** (1 MED, 3 LOW) | `tipoLabels` map contains **stale** old enum values (`RUT`, `CAMARA_COMERCIO`, `PERMISO_SANITARIO`, `PAGO_SEGURIDAD_SOCIAL`) that no longer exist in the new taxonomy (F1 migration replaced them with `TRIBUTARIOS`/`REGISTRO_MERCANTIL`/`SECRETARIAS`/`OTRO`). Type also has stale `tipoCertificado` types in `tipoOptions`. |
| `frontend/app/pages/certificados/crear.vue` | **5 findings** (4 MED, 1 LOW) | Two near-identical file-upload blocks (`uploadFile` vs `uploadComprobante`) drift only in toast labels and folder name; `formatPeriodo` months array duplicated from index. Phase-marker comments. |
| `frontend/app/pages/empleados/nuevo.vue` | **1 LOW finding** | Comment restates that the wizard step 5 uses a shared component. |
| `frontend/app/pages/empleados/[id]/editar.vue` | **5 findings** (1 MED, 1 HIGH, 3 LOW) | HIGH: fetches `empleado.archivoCertAlturas`-style fields that no longer exist (handled via `?? ''` fallbacks, so quietly empty — no breakage). MED: 2 distinct `filenameFromKey` definitions + repeated `apiFetch + fetch(presigned)` upload pipeline (4 places). LOW: phase markers. |
| `frontend/app/pages/empleados/[id]/index.vue` | **2 HIGH findings + 4 LOW** | **HIGH-1 (BUG):** `EmployeeDetail` TypeScript type still references `certificadoAlturas` and `certificadoRiesgoElectrico` 1:1 fields that were replaced by a generic `certificados[]` array in F2.3. Rendered UI in TAB 2 silently renders "No tiene certificado de alturas registrado" / "…de riesgo eléctrico registrado" because the fields don't exist on the GET /employees/:id payload. **HIGH-2:** `console.error` in three data-fetch blocks bypasses the project's toast-based error convention. |
| `frontend/app/pages/nomina/index.vue` (new) | **2 findings** (1 MED, 1 LOW) | Upload pipeline duplicated; phase-marker comments restate functionality. |
| `frontend/app/pages/pacientes/crear.vue` | **1 LOW finding** | Phase-marker `// (P0 jul4)` (note: `P0` is non-existent — off-naming). |
| `frontend/app/pages/pacientes/[id]/editar.vue` | **1 LOW finding** | Same as above + inline `// Hydrate genero select + custom (P0 jul4)` narrative. |

### Specs

| File | Verdict | Notes |
|------|---------|-------|
| `frontend/tests/local-qa/jul4-p1-cert-recurrente.spec.ts` | **1 MED finding** | `login()` helper duplicated identically in 6 jul4 specs. |
| `frontend/tests/local-qa/jul4-p2-cert-empleado-archivo.spec.ts` | **1 MED finding** | Same `login()`. |
| `frontend/tests/local-qa/jul4-p3-hoja-vida.spec.ts` | **1 MED finding** | Same `login()`. |
| `frontend/tests/local-qa/jul4-p4-pendientes.spec.ts` | **1 MED finding** | Same `login()`. |
| `frontend/tests/local-qa/jul4-p5-novedades.spec.ts` | **1 MED finding** | Same `login()`. |
| `frontend/tests/local-qa/jul4-p6-nomina.spec.ts` | **1 MED finding** | Same `login()` (2 identical copies — line 13 in one test, plus `await login(page)` called inside each `test()`). |

---

## Findings

Severity legend: **HIGH** = real bug, broken contract, or material duplication · **MED** = pattern drift, stale reference, or copy-paste with cosmetic cost · **LOW** = comment noise / minor convention deviation.

### Category A — Stale types & dead code (HIGH)

| # | Severity | File:line | Issue | Suggested fix |
|---|----------|-----------|-------|---------------|
| A1 | **HIGH** | `frontend/app/pages/empleados/[id]/index.vue:36-52, 660-718` | `EmployeeDetail` TypeScript interface still declares `certificadoAlturas: CertificadoFecha \| null` and `certificadoRiesgoElectrico: CertificadoFecha \| null` (lines 49-50). The F2.3 migration replaced the two 1:1 tables with a single 1:N `certificados[]` (each entry has `tipo: 'ALTURAS' \| 'RIESGO_ELECTRICO' \| …`). The template still references `employee.certificadoAlturas` (line 660, 666, 670-678) and `employee.certificadoRiesgoElectrico` (line 695, 700, 703-714). Because these fields do not exist on the `GET /employees/:id` response, both cards always render the "No tiene certificado de alturas/riesgo eléctrico registrado" empty-state. The new generic certificados list is NOT rendered anywhere on the detail page. | Drop `certificadoAlturas` + `certificadoRiesgoElectrico` from `EmployeeDetail`. Replace the two cards in TAB 2 with a single "Certificados del empleado" card that iterates `employee.certificados` (the data is already returned via `ALL_RELATIONS.certificados` in `employeeService.getEmployee`). Promote the existing `EmpleadoCertificadosEditor` (read-only mode) or a minimal read-only card. |
| A2 | **HIGH** | `backend/src/services/employeeService.ts:504-521` | `listPendientes` has a `try { // @ts-expect-error — Contrato model only exists after P6 migration … const activo = await prisma.contrato?.findFirst?.({ where: { empleadoId, activo: true } }) … } catch { // pre-P6 — silently skip }`. P6 has landed and the Contrato model is generated; the entire `try/catch/@ts-expect-error` is removable. The current shape (`prisma.contrato?.findFirst?.()` with optional chaining + silent catch) will *swallow* a real error after P6 — an infrastructure failure would now silently leave a phantom "Sin contrato activo" pendiente in production. | Replace with: `const activo = await prisma.contrato.findFirst({ where: { empleadoId, activo: true } }); if (!activo) { derivados.push({ … 'SIN_CONTRATO_ACTIVO' … }) }`. Let the surrounding handler catch real errors. |
| A3 | **MED** | `backend/src/services/nominaService.ts:34-37` | `getContratoActivo(empleadoId)` is exported but never imported anywhere (`grep -rn getContratoActivo backend/src` returns only the definition). Dead code shipped. | Delete the function. |
| A4 | **MED** | `frontend/app/pages/certificados/[id].vue:55-70` | `tipoLabels` map and `tipoOptions` array still contain the **old** `TipoCertificadoEmpresa` enum values (`RUT`, `CAMARA_COMERCIO`, `PERMISO_SANITARIO`, `PAGO_SEGURIDAD_SOCIAL`) that the F1 migration renamed/replaced. Editing a certificate on the detail page can therefore set an invalid `tipoCertificado` value (the backend Zod schema accepts the new values only; old ones are silently filtered out by `updateCertificateSchema.partial()` and the affected column then mismatches the rendered label). | Replace map and options with the new taxonomy: `ALCALDIA`, `GOBERNACION`, `SECRETARIAS`, `TRIBUTARIOS`, `REGISTRO_MERCANTIL`, `OTRO` — matching `frontend/app/pages/certificados/index.vue:73-91`. |
| A5 | **MED** | `backend/src/routes/employees.routes.ts:154-160, 178-182` | `createEmployee` and `updateEmployee` translate Prisma's `P2002` to a 409 "Número de documento ya registrado", but this misleads the client when the unique-conflict is on a *different* unique (e.g. `empleadoId` on `datosMigracion` (`@unique` per schema.prisma:233), or future unique constraints from the new modules). | Map by `error.meta?.target` when present: `if (error.code === 'P2002' && error.meta?.target?.includes('numero_documento')) { 409 'Número de documento ya registrado' } else if (error.code === 'P2002') { 409 'Registro duplicado' }`. |

### Category B — Cross-file duplication (MED/HIGH)

| # | Severity | File:line (copy count) | Issue | Suggested fix |
|---|----------|------------------------|-------|---------------|
| B1 | **MED** (warrants `useFileUpload`) | `frontend/app/pages/certificados/crear.vue:86-124` (1) + `frontend/app/pages/certificados/crear.vue:143-174` (2) + `frontend/app/components/EmpleadoCertificadosEditor.vue:77-105` (3) + `frontend/app/pages/nomina/index.vue:118-129` (4) + `frontend/app/pages/empleados/[id]/index.vue:307-331` (5) + `frontend/app/pages/empleados/[id]/editar.vue:123-158` (6) + `frontend/app/pages/empleados/[id]/editar.vue:381-405` (7) | Presigned-URL → PUT → store-key pipeline reimplemented **7 times** across delivered files, with three observable drift points: different folder names (`certificados`, `certificados-empleado`, `nomina`, `novedades`, `hojas-vida`, `contratos`), three different progress shapes (`uploadProgress` enum vs `uploading*` boolean ref vs inline `try/finally`), and three different error-handling styles (silently `null`, toast with `e?.data?.message`, toast with hard-coded "No se pudo subir"). | Extract a `useFileUpload()` composable: `app/composables/useFileUpload.ts` exporting `uploadFile(file, folder, { onSuccess?, onError? }) → Promise<{ key: string }>`. Centralises progress bookkeeping, error toast, and S3 key shape. Same applies to download: `useFileDownload(key) → Promise<void>` for `window.open(downloadUrl, '_blank')` (currently reimplemented in `EmpleadoCertificadosEditor.vue:void`, `certificados/[id].vue:122-137,139-151`, `empleados/[id]/index.vue:346-355`, `empleados/[id]/editar.vue:185-200,407-417`, `nomina/index.vue:196-200` = **6 copies**). |
| B2 | **MED** | `frontend/app/pages/empleados/[id]/index.vue:180-184` (1) + `frontend/app/pages/empleados/[id]/editar.vue:419-423` (2) + `frontend/app/components/EmpleadoCertificadosEditor.vue:116-120` (3) + `frontend/app/pages/empleados/[id]/editar.vue:180-184` (4) | `filenameFromKey(key)` defined 4 times (identical implementation: `if (!key) return ''; const parts = key.split('/'); return parts[parts.length-1] \|\| key;`). | One-liner — move to `app/composables/useFile.ts` next to the upload helper, or inline into `useFileDownload`. |
| B3 | **MED** | `frontend/app/pages/certificados/index.vue:204-211` (long: `'short'`) + `frontend/app/pages/certificados/[id].vue:87-94` (long: `'long'`) + `frontend/app/pages/certificados/crear.vue` (no formatter, uses `form.fechaEmision` directly) + `frontend/app/pages/empleados/[id]/index.vue:93-98,100-105,425-460` (mix of long/short) + `frontend/app/pages/empleados/[id]/editar.vue:425-430` (short) + `frontend/app/pages/nomina/index.vue` (no formatter, uses `<input type="month">`) | `formatDate(dateStr, style)` is reimplemented 7+ times with drifting `'long' \| 'short'` variants and inconsistent `null`/`undefined`/`isNaN` handling. | Single helper in `app/utils/date.ts`: `formatDate(value: string \| Date \| null, style?: 'long' \| 'short' \| 'iso', locale = 'es-CO'): string`. |
| B4 | **MED** | `frontend/app/pages/certificados/index.vue:218-222` + `frontend/app/pages/certificados/[id].vue:158-162` | `formatPeriodo(periodo)` duplicates the month-abbreviations array `['ene','feb','mar',…'dic']` literally identical in both files. | Move the constant + function to `app/utils/date.ts` (the same one suggested in B3) or extend the existing one. |
| B5 | **MED** | `frontend/tests/local-qa/jul4-p1, p2, p3, p4, p5, p6-nomina.spec.ts` (6 files) | `async function login(page)` is byte-for-byte identical (`await page.goto('/login')`, fill admin email/password, submit, `expect(page).toHaveURL('/') { timeout: 15000 }`). Plus 5 of those specs call it identically inside every test. | Extract `frontend/tests/helpers/auth.ts` exporting `loginAsAdmin(page)`. Import in all 6 specs. Saved ~70 lines and removes drift risk. |
| B6 | **MED** | `frontend/tests/local-qa/jul4-p1-cert-recurrente.spec.ts:23-32` | `todayIso()` and `currentPeriodoDate()` are defined but only `currentPeriodoDate` is used. `todayIso` is dead code (1 dead helper). | Delete `todayIso()` or extract both into `tests/helpers/dates.ts`. |
| B7 | **LOW** | `frontend/app/pages/empleados/[id]/index.vue:165,255` + `frontend/app/pages/empleados/[id]/editar.vue:258` + `frontend/app/pages/certificados/index.vue:140,151` | `console.error('Error fetching …:', e)` in 5 data-fetch blocks. Pre-existing pattern in repo accepts console.error in fetch failures, BUT the new code uses it in pages where a `toast` is already imported (e.g. `empleados/[id]/index.vue:56` already calls `const toast = useToast()` but the fetchers don't use it). | Replace each with `toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar …' })` for parity with the other `try/catch`es in the same file (e.g. `empleados/[id]/index.vue:184-217`). |

### Category C — Comment noise (LOW)

Project convention: comments only for non-obvious constraints; no narrative / phase-marker / PR-review-speak.

| # | Severity | File:line | Issue | Suggested fix |
|---|----------|-----------|-------|---------------|
| C1 | LOW | `backend/prisma/schema.prisma:40-42` | `// jul4 P4`, `// jul4 P5` inline annotations on `PendienteEmpleado`/`NovedadEmpleado` relations. | Delete — schema.prisma doesn't carry change-log. |
| C2 | LOW | `backend/prisma/schema.prisma:88, 103, 219, 273, 291, 324, 683-685` | Banner comments `// ─── jul4 P4 ───`, `// ─── jul4 P5 ───`, `// ─── jul4 P6 — Nómina foundation ───` and inline `// jul4 P1` / `// jul4 P2` / `// jul4 P3` / `// jul4`. Inconsistent style — three different forms for the same purpose. | Drop all phase markers. Module separators without `jul4` prefix are acceptable if needed (the existing `// ============` module banners already serve that purpose). |
| C3 | LOW | `backend/src/routes/certificates.routes.ts:21` | `// jul4 P1` on `periodicidad` schema field. | Delete. |
| C4 | LOW | `backend/src/routes/employees.routes.ts:30,94,450,464,539` | Inline `// jul4 P3`, `// jul4 P2`, `// jul4 P2`, plus banner `// ─── jul4 P4 ───` and `// ─── jul4 P5 ───`. | Delete all five. |
| C5 | LOW | `backend/src/services/certificateService.ts:36,91,129,177` | Comments `// jul4 P1` (4 occurrences) + `/** * jul4 P1 — Duplicate an existing certificate for a new period. * Copies tipo/nombre/descripcion/periodicidad from source. Estado is forced to PENDIENTE … */` (JSDoc) + `// jul4 P1 — duplicate flow short-circuits the normal create`. The third is a narration of what `if (input.duplicateFromId) return duplicateCertificate(...)` already says. | Keep the JSDoc on `duplicateCertificate` if the WHY is non-obvious (it's not — function name says it). Drop the inline `// jul4 P1` markers. |
| C6 | LOW | `backend/src/services/employeeService.ts:431,520,559` | `// ─── jul4 P4 — Pendientes ────────`, `// pre-P6 — silently skip`, `// ─── jul4 P5 — Novedades ────────`. The pre-P6 comment will go away entirely once the `@ts-expect-error` block (A2) is removed. | Delete the two banners. (The pre-P6 comment goes with finding A2.) |
| C7 | LOW | `frontend/app/components/EmpleadoCertificadosEditor.vue:3-15,25,74,209` | JSDoc `/** * EmpleadoCertificadosEditor — shared component (F2.3) used by both … * jul4 P2 — adds per-row archivo upload via the existing presigned-URL flow. */` + inline `// jul4 P2 — presigned key (not raw URL)` + `// jul4 P2 — per-row upload helpers` + `<!-- jul4 P2 — per-row archivo upload -->`. | Strip the phase-marker lines; keep at most one comment block if `v-model:certificados` semantics are non-obvious (they are obvious). |
| C8 | LOW | `frontend/app/pages/certificados/index.vue:20,39,93,213,225,235,282` | Inline `// jul4 P1` (5 places) + `// ─── F1.1 — POR_VENCER badge logic (≤30 days from today, not VENCIDO) ────` banner + `<!-- jul4 P1 — Missing-month alert -->` HTML comment. | Keep the `F1.1` banner if useful (it documents the math), drop the rest. |
| C9 | LOW | `frontend/app/pages/certificados/[id].vue:21,139,153,373` | Four `// jul4 P1` markers. | Delete. |
| C10 | LOW | `frontend/app/pages/certificados/crear.vue:18,33,62,126,201,215,358,450` | Eight phase-marker comments. | Delete. |
| C11 | LOW | `frontend/app/pages/empleados/[id]/index.vue:68,70,133,221,754,867` | Three inline `// jul4 PX` + two `<!-- TAB X: jul4 PX -->` HTML comments. | Delete the comments; rename the tab labels if needed (P4 → "Pendientes", P5 → "Novedades"). |
| C12 | LOW | `frontend/app/pages/empleados/[id]/editar.vue:119,206,569,823,887` | Five phase-marker comments. | Delete. |
| C13 | LOW | `frontend/app/pages/nomina/index.vue:3-9` | Header JSDoc `/** * jul4 P6 — /nomina page (Nómina foundation). * - Month picker (default current). * Table of empleados × month with contrato activo … */` restates what the template already shows. | Delete. |
| C14 | LOW | `frontend/app/pages/pacientes/crear.vue:25,27,95` | `// Género uses Select + inline "OTRO" custom text input (P0 jul4)` (NB: no `P0` in the actual roadmap) + `// Hydrate genero select + custom (P0 jul4)` (only the parent process knows `P0`). | Delete — the code is self-evident; drop the bogus `P0` reference. |

### Category D — Cross-cutting inconsistencies (LOW/MED)

| # | Severity | File:line(s) | Issue | Suggested fix |
|---|----------|--------------|-------|---------------|
| D1 | **MED** | `frontend/app/pages/certificados/crear.vue:80-83` + `frontend/app/components/EmpleadoCertificadosEditor.vue:107-110` + `frontend/app/pages/nomina/index.vue:131-149` + `frontend/app/pages/empleados/[id]/index.vue:307-330` | Date input change handlers inconsistently handle the `input.value = ''` reset: present in `EmpleadoCertificadosEditor` and `empleados/[id]/index.vue` (good — avoids re-uploading the same file twice), absent in `nomina/index.vue` (risk: selecting the same file again will not trigger `@change`). | Adopt the `input.value = ''` reset everywhere. Even better, put it inside `useFileUpload`. |
| D2 | **MED** | `frontend/app/pages/certificados/crear.vue:13-21` + `frontend/app/pages/nomina/index.vue:46-83` + `frontend/app/pages/empleados/[id]/index.vue:46-72` | Three different "period" representations coexist: `periodo: string` in YYYY-MM (from `<input type="month">`), `periodo: string` in YYYY-MM-DD (YYYY-MM-01 from API normalisation), and `periodo: Date` (in [id].vue parses it as ISO). All three round-trip OK but the page-level typing is misleading. | Pick one (`'YYYY-MM-DD'` string) and validate at the boundary. The Zod schema on the backend already normalises — TypeScript can match. |
| D3 | **LOW** | `frontend/app/pages/empleados/[id]/editar.vue:76,109,320,455,486,528` | Toast `life: 3000` for success / `life: 5000` for error. Other delivered files use a mix: `3000`, `3500`, `4000`, `5000` (`grep -h 'life: ' … \| sort -u` → `3500`, `4000`, `5000` only across certificados pages; `empleados/[id]/editar.vue` uses all four). | Standardise on two constants: `TOAST_LIFE.success = 3000`, `TOAST_LIFE.error = 5000`. Import from a shared module. |
| D4 | **LOW** | `frontend/app/pages/empleados/nuevo.vue:772` | Inline comment `<!-- Certificados genéricos (F2.3) — shared editor used by wizard + edit page -->` restates that the next component is the shared editor. | Delete. |
| D5 | **LOW** | `frontend/app/pages/empleados/[id]/index.vue:49-52` interface | `EmployeeDetail` interface still declares `certificadoAlturas: CertificadoFecha \| null` and `certificadoRiesgoElectrico: CertificadoFecha \| null` even though the API no longer returns those fields (related to A1 — listed here for the type-staleness surface). | See A1. |
| D6 | **LOW** | `frontend/app/pages/pacientes/crear.vue:14,19-23` | `tipoDocumento` enum widened to include `'REGISTRO_CIVIL'` but the API list for `TipoDocumentoCliente` (per `backend/prisma/schema.prisma:747`) is `CC \| CE \| PASAPORTE \| REGISTRO_CIVIL`. The frontend typing is correct, but the prior code may have only supported `CC \| CE \| PASAPORTE`. Verify the patient routes accept `REGISTRO_CIVIL` (they should — the enum was always there). | Confirm and add a `/local-qa` spec. |
| D7 | **LOW** | `backend/prisma/migrations/20260705000300_jul4_pendientes/migration.sql:1` | Header comment: `-- jul4 P4: Pendientes section (manual admin actions) + enums + Novedad types (declared alongside for migration packaging)`. Then it ALSO declares the `TipoNovedad` enum (lines 10-14). P4 and P5 are therefore coupled: P5's enum creation is a no-op IF P4 already ran. This is acceptable for sequential production deploys, BUT the comment bundle is confusing when the two migrations are cherry-picked or hot-fixed independently. | Extract the enum declarations to a separate migration (`20260705000250_jul4_shared_enums`) or document the dependency in `.md`. |
| D8 | **LOW** | `backend/prisma/migrations/20260705000400_jul4_novedades/migration.sql` (entire file) vs `20260705000300_jul4_pendientes/migration.sql` | The two migrations both wrap their CREATE TABLE in `CREATE TABLE IF NOT EXISTS` (idempotent), but the F-series migrations (`f2_cert_empleado_generic`) deliberately DO NOT use IF NOT EXISTS because they expect a clean transition. Inconsistent idempotency strategy across the 6 jul4 migrations. | Document the standard: jul4 migrations in `20260705*` are idempotent (safe to re-run on staging); F-series migrations are not. Add this convention to `backend/prisma/README.md` (if it exists). |

### Category E — Migration SQL hygiene (LOW)

| # | Severity | File:line | Issue | Suggested fix |
|---|----------|-----------|-------|---------------|
| E1 | LOW | All `20260705*` migration.sql files | Header comment uses `jul4 PX:` identifier pattern. Acceptable for a migration dir, but the included DRIFT-1 commentary (`20260705000000`: "Also fixes DRIFT-1: certificados_empresa.tipo_certificado was nullable in live DB…") is the kind of incident-style explanation that belongs in the commit message, not in the SQL file that will execute on prod. | Replace header with a single sentence describing the schema change (no incident narrative). Move DRIFT-1 detail to `backend/prisma/README.md` or commit body. |
| E2 | LOW | `20260704173358_f2_cert_empleado_generic/migration.sql:35-48` | Uses `DO $$ BEGIN IF EXISTS … END $$` for data copy. Reasonable choice given the old-table defensive guard, but inconsistent with the rest of the migration dir (which uses standard `INSERT … SELECT`). | Acceptable. Document the `DO $$ BEGIN IF EXISTS` pattern as the standard for destructive migrations in the README. |

### Category F — Other patterns (LOW)

| # | Severity | File:line | Issue | Suggested fix |
|---|----------|-----------|-------|---------------|
| F1 | LOW | `backend/prisma/schema.prisma:88` | `// jul4 P3` on `hojaVidaUrl` column inline. | Delete (see C2). |
| F2 | LOW | `backend/prisma/migrations/20260705000500_jul4_nomina_foundation/migration.sql:86-90` | Comment `the service also enforces this rule (defense in depth)` on the partial unique index. Acceptable context. | Keep. |
| F3 | LOW | `frontend/app/pages/empleados/[id]/index.vue:107-114` | `isCertExpired` / `isCertExpiringSoon` reimplemented locally with a 60-day threshold — but `employeeService.listPendientes` uses a 30-day threshold (`employeeService.ts:482`). Threshold drift between two consumers. | Centralise threshold in one constant (e.g. `CERT_POR_VENCER_DAYS = 30`). |
| F4 | LOW | `frontend/app/pages/empleados/[id]/index.vue:74` + `frontend/app/pages/empleados/[id]/index.vue:78` etc. | After-fetch `error.value = '…'` uses Spanish strings inline. Acceptable, but several other pages mix English (e.g. `'Network error'`, `'Error'`) and Spanish. | Pick one convention (Spanish, per UI language) and stick to it. |

---

## Cleanup summary — prioritized action list (grep-ready)

> Use `grep -nE "<pattern>" $(git ls-files)` to confirm each cleanup before committing.

1. **Drop stale schema UI references in `frontend/app/pages/certificados/[id].vue`** — `tipoLabels`/`tipoOptions` use obsolete enum values. Fixes MED #A4. Search: `grep -n "RUT\|CAMARA_COMERCIO\|PERMISO_SANITARIO\|PAGO_SEGURIDAD_SOCIAL" frontend/app/pages/certificados/\[id\].vue`.

2. **Replace pre-P6 `@ts-expect-error` workaround in `backend/src/services/employeeService.ts:504-521`** — the silent `try/catch` block hides real errors in production. Fixes HIGH #A2.

3. **Rebuild `frontend/app/pages/empleados/[id]/index.vue` TAB 2 (Certificates)** — current template references fields that the F2.3 migration removed (`certificadoAlturas`, `certificadoRiesgoElectrico`). The page silently renders empty-state cards. Fixes HIGH #A1.

4. **Extract `frontend/app/composables/useFileUpload.ts` + `useFileDownload.ts`** — replaces 7 uploads and 6 downloads. Biggest MED #B1 cleanup. File count: `grep -rln "uploads/presigned-url\|uploads/download-url" frontend/app`.

5. **Extract `frontend/tests/helpers/auth.ts`** — replaces 6 duplicate `login()` helpers. Fixes MED #B5. File count: `grep -c "async function login" frontend/tests/local-qa/jul4-*.spec.ts`.

6. **Extract `frontend/app/utils/date.ts`** — centralised `formatDate` + `formatPeriodo` + month-abbreviations array. Fixes MED #B3 and MED #B4.

7. **Delete `getContratoActivo` in `backend/src/services/nominaService.ts:34`** — dead code. Fixes MED #A3.

8. **Bulk-strip `// jul4 PX` phase markers** — 70+ occurrences across schema.prisma, routes, services, pages, components. See Categories C above. Use: `grep -rn "// jul4 P[1-6]" backend/ frontend/`. After confirming, do a one-pass removal with `sed`.

9. **Replace `console.error` with toast in data-fetchers** — fixes MED #B7. `grep -rn "console.error" frontend/app/pages`. Pair with finding B1.

10. **Standardise toast `life` constants** — fixes D3. Introduce `app/composables/useToast.ts` constants; replace all literals.

11. **Unify `EmployeeDetail.type` with backend payload** — once A1 is fixed, generate the type from the OpenAPI schema or hand-sync to match `EmployeeDetail` in `employeeService.ts:35-109`. Currently the type is duplicated in the frontend (5 places) and drifts from the service.

12. **Tighten `error.code === 'P2002'` mapping in `employees.routes.ts`** — fixes MED #A5. Add `error.meta?.target` discrimination.

13. **Threshold inconsistency** — `CERT_POR_VENCER_DAYS` centralised. Fixes F3.

14. **Idempotency convention doc** — write `backend/prisma/README.md` documenting when to use `DO $$ ... EXCEPTION WHEN duplicate_object` (jul4+ only) vs straight `ALTER TABLE`. Fixes D8 / E2.

