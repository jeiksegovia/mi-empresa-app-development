# Certificados / Empleados / Clientes — Bug Analysis & Improvements Plan

**Date**: July 4, 2026
**Status**: 📋 Analysis complete (bugs reproduced locally with evidence) — implementation pending
**Validation policy**: LOCAL ONLY (docker postgres :15432, backend :3101, frontend :3100) until fixes land; staging QA re-runs after deploy
**Evidence spec**: `frontend/tests/local-qa/bug-validation.spec.ts` (browser repro, both bugs)

---

## 1. Bug Analysis (reproduced, root causes confirmed)

### BUG-1 — Certificate creation is blocked ❌ CONFIRMED (hard blocker)

**Repro (browser + API, local)**: fill `/certificados/crear`, submit →
`POST /api/v1/certificates` → **400** `{"errors":{"empresaId":["Required"]}}` → error toast, nothing created. This matches the developer's staging report exactly.

**Root cause**: `frontend/app/pages/certificados/crear.vue` builds the payload with `nombre/tipoCertificado/descripcion/fechas/archivoUrl` but **never includes `empresaId`**, while the backend schema (`backend/src/routes/certificates.routes.ts:13`) requires `empresaId: z.number().int().positive()`. Every creation attempt has always failed — the feature never worked.

**Secondary findings**:
- With a *wrong* `empresaId`, Prisma throws an FK violation and the route returns a generic **500** — should be a 4xx with a clear message.
- **Why QA missed it**: `frontend/tests/e2e/certificado-crear.spec.ts` covers rendering, client-side validation and cancel — it **never submits a valid form**. No happy-path test existed at any tier for certificate creation.

**Fix (recommended)**: backend derives `empresaId` server-side (single-tenant app — use the sole `empresas` row) and makes it optional in the schema; frontend unchanged. Fallback alternative: frontend fetches `/empresa` and sends the id — more moving parts for the same result. Also: map FK violations to 400/404.

### BUG-2 — "Edit empleado does not allow to create certificates" ⚠ PARTIALLY REPRODUCED — it's a capability-parity/UX gap, not a broken endpoint

**Evidence (browser, local)**: the edit page's *Certificados* tab → enable Alturas + dates → save → `PUT /employees/:id/certificados` → **200**, success toast, row created. The mechanism works.

**The real gap** (what the report is about): both wizard step 5 and edit tab 5 only offer **two fixed toggles** (Alturas, Riesgo Eléctrico). There is no "add certificate" affordance, no other types, and the tab is easy to read as view-only. The feedback below redesigns this flow entirely — BUG-2's resolution **is** feedback item F3.

---

## 2. Feedback Implementation Plan

### F1 — Certificados de empresa: new taxonomy + wizard order

**Schema** (`TipoCertificadoEmpresa` enum replacement + migration):

| New enum value | Label | Examples (help text in UI) |
|---|---|---|
| `ALCALDIA` | Alcaldía | uso de suelos; certificados específicos por empresa |
| `GOBERNACION` | Gobernación | (pendiente) |
| `SECRETARIAS` | Secretarías | secretaría de salud, desinfección tanques agua potable |
| `TRIBUTARIOS` | Tributarios | RUT |
| `REGISTRO_MERCANTIL` | Registro Mercantil | cámara de comercio, bomberos, SAYCO y Acinpro |
| `OTRO` | Otro | — |

Data migration mapping for existing rows: `RUT→TRIBUTARIOS`, `CAMARA_COMERCIO→REGISTRO_MERCANTIL`, `PERMISO_SANITARIO→SECRETARIAS`, `PAGO_SEGURIDAD_SOCIAL→OTRO`, `OTRO→OTRO`. (Only dev/test data exists anywhere — low risk.)

**Form order** (`certificados/crear.vue` + edit): 1️⃣ tipo (with example help text per option) → 2️⃣ nombre → 3️⃣ vigencia (fechaEmision/fechaVencimiento, unchanged widgets) → 4️⃣ descripción (optional, unchanged) → 5️⃣ archivo (existing presigned-URL upload).

**F1.1 — 30-day expiry warning**: derived status `POR_VENCER` when `fechaVencimiento - today ≤ 30 calendar days` (computed in the list/detail serializers + badge in `certificados/index.vue` + card on dashboard). No email — SMTP isn't configured; revisit as a nomina-era enhancement. `estado` recompute happens on read (no cron needed).

### F2 — Empleados (nuevo + editar in parity)

- **F2.1 tipoVivienda**: enum `CASA/APARTAMENTO/LOTE` → **`PROPIA/ARRENDADA/FAMILIAR`** (fixed Select in both forms). Migration: existing values map to `PROPIA` (semantic reset — old values described the dwelling, new ones describe tenure; only test data exists).
- **F2.2 salario on Cargo**: add `salario Decimal? @db.Decimal(12,2)` to `Cargo`; input below the fecha fields in both wizard step 3 and edit tab 3. Marked "se extraerá de nómina cuando el módulo esté activo" in help text.
- **F2.3 certificados flow (resolves BUG-2)**: replace the two 1:1 tables (`CertificadoAlturas`, `CertificadoRiesgoElectrico`) with a generic collection:
  ```prisma
  model CertificadoEmpleado {
    id              Int      @id @default(autoincrement())
    empleadoId      Int
    tipo            TipoCertificadoEmpleado   // ALTURAS | RIESGO_ELECTRICO | MANIPULACION_ALIMENTOS | OTRO
    nombre          String?                   // required in UI when tipo = OTRO
    fechaExpedicion DateTime @db.Date
    fechaVencimiento DateTime @db.Date
    ...
  }
  ```
  Migration copies existing alturas/riesgo rows into the new table. UI: shared component `EmpleadoCertificadosEditor.vue` ("Agregar nuevo certificado" → tipo Select → fechas → remove/add rows) used by **both** wizard step 5 and edit tab 5 — the shared component is what guarantees the parity the developer asked for, permanently. Backend: `PUT /employees/:id/certificados` accepts the list shape (replace-all semantics like cargos).

### F3 — Gestión clientes (pacientes pages)

- **F3.1 género**: free-text `InputText` (placeholder "Masculino, Femenino, Otro") → **Select** `MASCULINO/FEMENINO/OTRO` in crear + editar. Backend `genero` stays string; Zod narrows to the three values.
- **F3.2 parentesco** (contactos de emergencia): free text → **Select** `PADRE/MADRE/HIJO/OTRO`, and when `OTRO` an inline `InputText` "¿Cuál?" (stored in the same `parentesco` column as the custom text — no schema change).

## 3. Decisions Taken Autonomously (flag if you disagree)

1. **`empresaId` derived server-side** (single-tenant) rather than sent by the frontend.
2. Old→new certificate-type mapping and `tipoVivienda→PROPIA` reset as tabled above — justified because no production data exists.
3. Expiry warning is **UI-only** (badge + dashboard) for now; email needs SMTP creds that aren't configured on any stage.
4. `CertificadoEmpleado.nombre` optional except `tipo=OTRO` (UI-enforced).
5. Salario stored as `Decimal(12,2)` COP, no currency column until nómina defines it.

## 4. Execution Phases (local-first, per testing policy)

| Phase | Work | Gate |
|---|---|---|
| P1 | BUG-1 fix (backend empresaId default + FK→4xx) + flip `local-qa/bug-validation.spec.ts` expectation 400→201 | local spec green |
| P2 | F1 + F1.1 (schema migration, taxonomy, form order, POR_VENCER badge) | new local e2e: full happy-path create incl. file-less + with-file |
| P3 | F2.1 + F2.2 (vivienda enum, salario) — small, one migration | local e2e wizard + edit |
| P4 | F2.3 shared certificados editor + migration (biggest item) | parity spec: same component asserted on both pages |
| P5 | F3 clientes selects | local e2e |
| P6 | Deploy to staging (CodeDeploy + `deploy-frontend.sh`), re-run `scripts/qa-staging.sh`, extend staging smoke with a certificate-creation happy path | staging QA green |

Each phase = schema migration (if any) + backend + frontend + tests in one slice, following existing route/service/page patterns.

## 5. QA Strategy Additions (root-cause driven)

1. **Happy-path submissions are mandatory** in e2e specs — the certificate bug shipped because the existing spec stopped at client-side validation. Rule: every "crear X" page gets at least one test that submits and asserts the 2xx + navigation.
2. `frontend/tests/local-qa/` is the new home for local bug-repro/regression specs (runs against localhost only; `bug-validation.spec.ts` is the first — flip its BUG-1 expectation when fixed).
3. Selector learning baked in: tabbed pages use `v-show` — hidden inputs stay in the DOM; always scope to `:visible`.
4. After P6, add one certificate-creation smoke test to `backend/tests/staging/` (API, self-cleaning via DELETE) so stage config drift (e.g., missing empresa row — **staging currently has NO empresa row**, which would have been the *next* bug after empresaId) is caught by the suite.
5. Staging prerequisite for P6: seed the empresa row on staging (extend `prisma/test-db/` with an idempotent `seed-empresa.ts`, same pattern as create-users).

## 6. Reference Patterns Used

Route+Zod+service: `certificates.routes.ts` / `certificateService.ts` · list-PUT semantics: `employees/:id/cargos` · form pages: `pacientes/crear.vue` · shared upload: `useApi` + `/uploads/presigned-url` · plan/QA docs: `qa-stage-procedure.md`, TASK_*_COMPLETION.md naming for the eventual completion report.
