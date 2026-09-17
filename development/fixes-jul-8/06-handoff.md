# Handoff: fixes-jul-8 — All work streams complete

**Delivered:** 2026-07-09
**Team:** W1 (research), W2 (backend), W3 (frontend-A: fichas/nomina/401), W4 (frontend-B: cert/instr)
**Runtime state:** backend :3101 + frontend :3100 both running with the new code (HMR).
**Not committed** — working tree only, awaiting review.

---

## What each worker delivered

### W1 — Research (`02-research-fixes-jul-8.md`)
Exhaustive read of Prisma schema, backend routes/services, and frontend pages/components for all 5 domains. Established the crucial negative result: **no forced-reload trigger exists in code** — the "SPA reload on Android background" bug is browser tab-unload, mitigated with sessionStorage form persistence instead of a code fix.

### W2 — Backend (`tasks/W2-backend/result.md`)
- **New Prisma model** `CertificadoUpdate` + migration `20260709025844_add_certificado_update` (applied cleanly on local pg :15432)
- **New endpoints**
  - `POST /api/v1/certificates/:id/updates` — append versioned update; mutates parent snapshot + recomputes `estado`
  - `GET /api/v1/certificates/:id/updates` — history, newest-first
- **Instrumentos** — Zod `.refine()` on `rolesPermitidos` against `RolUsuario` enum (`ADMIN`/`EMPLEADO`/`AUDITOR`/`OPERADOR`)
- **Fichas** — Zod schema added to `PATCH /:id/fichas/:fichaId/status`; **`VENCIDO → COMPLETADO` transition now allowed** (per D3)
- **Nomina** — cuenta-de-cobro required for `OPS`/`OBRA_O_LABOR` (validated in service; structured 400 response with `field: 'archivos.CUENTA_COBRO'`); new `tipoContrato` query filter (comma-separated + synthetic `NONE`)
- **Interface contract** at `orchestration-ctx/decisions/schema-contract.md` (332 lines — the single source of truth for W4)

### W3 — Frontend-A (`tasks/W3-frontend/result.md`)
- **`useApi.ts`** — 401 handler now dispatches a DOM event (`session-expired`) instead of calling composables directly, avoiding `inject() outside setup()` warnings
- **`plugins/session-expired.client.ts`** (NEW) — handles auth store clear + toast + `navigateTo('/login')`; skips redirect when already on `/login`
- **`pacientes/[id]/index.vue`** — 3 bugs + persistence:
  - Bug 1 (instrument name): backwards-compat fallback for flat vs nested shape
  - Bug 2 (guardar not saving): `notasObservaciones` `<Textarea>` + `fechaVencimiento` `<DatePicker>` now sent in PATCH body
  - Bug 3 (pencil disabled after VENCIDO): condition switched to `!validTransitions[data.estado]?.length`; `validTransitions[VENCIDO] = ['COMPLETADO']`
  - **Form-state persistence** in `sessionStorage` under key `ficha-form-draft-${patientId}-${fichaId}` — restores on dialog re-open after Android tab-unload; file name shown but user must re-select
- **`nomina/index.vue`** — `MultiSelect` at top (default `['OPS','OBRA_O_LABOR','TERMINO_FIJO','TERMINO_INDEFINIDO']`, `SIN_CONTRATO` maps to wire `NONE`); inline `<Message severity="error">` next to CUENTA_COBRO slot when backend returns `field: 'archivos.CUENTA_COBRO'`

### W4 — Frontend-B (`tasks/W4-frontend-b/result.md`)
- **`certificados/[id].vue`** — new "Historial de actualizaciones" card (from `GET /:id/updates`); "Agregar actualización" `<Dialog>` (file + notas + fechaEmision + fechaVencimiento) posting to `POST /:id/updates`; inline edit restricted to metadata (no file/dates)
- **`certificados/crear.vue`** — optional "Primera actualización" section; on submit runs POST /certificates then POST /certificates/{id}/updates if any update field is set; routes only after both succeed
- **`instrumentos/crear.vue`** — `<MultiSelect>` for roles (`['ADMIN','EMPLEADO','AUDITOR','OPERADOR']`) → submit `roles.join(',')`; plantilla file upload via `useFileUpload().uploadFile(file, 'instrumentos')`
- **`instrumentos/[id]/editar.vue`** (NEW 19,928 bytes) — mirrors crear, populates from GET, submits PUT
- **`instrumentos/[id]/index.vue`** — admin-only "Editar" button linking to editar page

---

## Files touched

### Backend
```
backend/prisma/schema.prisma
backend/prisma/migrations/20260709025844_add_certificado_update/migration.sql   (NEW)
backend/src/services/certificateService.ts
backend/src/routes/certificates.routes.ts
backend/src/routes/instruments.routes.ts
backend/src/routes/patients.routes.ts
backend/src/services/nominaService.ts
backend/src/routes/nomina.routes.ts
```

### Frontend
```
frontend/app/composables/useApi.ts                     (401 dispatch)
frontend/app/plugins/session-expired.client.ts          (NEW)
frontend/app/pages/pacientes/[id]/index.vue             (fichas 3 bugs + persistence)
frontend/app/pages/nomina/index.vue                     (filter + inline error)
frontend/app/pages/certificados/[id].vue                (historial + agregar dialog)
frontend/app/pages/certificados/crear.vue               (first-update section)
frontend/app/pages/instrumentos/crear.vue               (MultiSelect + plantilla)
frontend/app/pages/instrumentos/[id]/editar.vue         (NEW)
frontend/app/pages/instrumentos/[id]/index.vue          (Editar button)
```

---

## How to verify manually (browser)

1. **Login** at `http://localhost:3100/login` (or `http://100.85.193.33:3100/login` from another machine — CORS + Vite allowedHosts already set for that IP earlier in the session).
2. **Certificados** → `/certificados` → click any cert → verify "Historial de actualizaciones" card renders; click "Agregar actualización", fill file+notas+fechaVencimiento, submit → parent snapshot + history list update.
3. **Certificados crear** → new cert with optional first-update fields filled → verify one create + one update POST fire, then route to /certificados/{newId}.
4. **Instrumentos crear** → verify MultiSelect for roles; try to submit "SUPERHEROE" via API — should 400 with clear error.
5. **Instrumentos editar** → `/instrumentos/{id}/editar` → change roles + upload new plantilla → PUT succeeds.
6. **Pacientes fichas** → open a patient with a `VENCIDO` ficha → pencil icon is enabled → open modal → select COMPLETADO + upload file → save → **backend actually receives the PATCH** (previously silently failed).
7. **Fichas persistence** → open modal, type notes, switch tab briefly on Android (or blur+refresh manually) → reopen modal → notes are still there.
8. **Nomina** → verify contract-type MultiSelect at top; register nomina entry for an OPS empleado WITHOUT cuenta-de-cobro → see inline error under the CUENTA_COBRO slot.
9. **401 UX** → let JWT expire (or clear cookie), trigger any API call → single redirect to /login with toast, no double-nav, no console warning storm.

---

## Deferred / not done

- **Certificados: `periodicidad`, `periodo`** — W4 chose to leave these out of the inline edit form (W1 flagged them originally). If you want them editable, add to `saveEdit` payload + editForm state in `certificados/[id].vue`.
- **Instrumentos: `plantillaArchivo` display** — the editar page allows replacement, but the detail page does not surface a "download plantilla" link. Follow-up.
- **`nuxt typecheck`** — broken at environment level (vue-tsc/ESM compat, pre-existing). `nuxt prepare` succeeds. If you want CI type-check, that env issue must be fixed first.
- **No git commit** — working tree only, per instructions.

---

## Runtime state at handoff

- **Backend** on port 3101 — restarted by W2 after Prisma client regen. Process alive; `/api/v1/health` returns 200.
- **Frontend** on port 3100 (PID 56667/56771 — reused across HMR reloads). No manual restart needed.
- **DB** on port 15432 — one manual cleanup done by W2 to remove a stuck failed row in `_prisma_migrations` (`20260704173358_f2_cert_empleado_generic`) predating this session. Documented in W2 completion-report.

---

## Decisions log
`orchestration-ctx/decisions/scope-decisions.md` — 7 decisions (D1–D7) covering SPA-reload mitigation strategy, schema shape, transition rules, roles on-the-wire format, and edit-page pattern.
`orchestration-ctx/decisions/schema-contract.md` — API interface contract W2→W4.
