# task-assignment-frontend (W2 — fichas dialog + UI polish wave)

## Plan File
`development/next-release-jul-10/orchestration-ctx/team-plan-next-release-jul-10.md` — read first.
**API contract (your spec)**: `orchestration-ctx/decisions/schema-contract-jul10.md` §5 — C1/C4/C7/C6 endpoints implemented + curl-verified. Never open schema.prisma.
Origins: `context/user-feedback/qa-session-jul-9-reinterpreted.md` §3.1–3.3 (transcript lines 210–286), §5.1 (E1, lines 55–62).

## Task Type
IMPLEMENTATION

## Task IDs (in order)
- `29` — T5: fichas single-step dialog + descargar plantilla (C1+C2)
- `30` — T6: C3 shortcut + E1 uppercase inputs + tipoEmpleado field

## T5 (#29) — Fichas single-step dialog
Target: `frontend/app/pages/pacientes/[id]/index.vue` (the most-patched file in the repo — read it FULLY first; jul-8/jul-9 behaviors MUST survive: sessionStorage draft, IDB `useFileStash` row-scoped keys, VENCIDO→COMPLETADO renewal path, title-guard).

User flow (transcript line 262, verbatim consolidated spec):
1. In "Fichas y evaluaciones" tab, user picks an instrumento from the assign dropdown → **immediately opens** the combined dialog (no separate assign step).
2. Dialog top: "Descargar plantilla en blanco" button (visible when the instrumento has `plantillaArchivo`) → downloads via `useFileUpload().downloadFile`; the saved file must be renamed `{nombreInstrumento}_{pacienteNombre}.{ext}` — implement client-side (fetch blob from the presigned URL + `<a download="...">` trick, or document why not feasible and fall back to opening with a toast telling the rename convention).
3. Fields: archivo (REQUIRED — this is a completed evaluation), notasObservaciones (optional), fechaVencimiento (optional).
4. Submit → `POST /patients/:id/fichas` with `{ instrumentoId, versionRegistro, archivoCompletado, notasObservaciones?, fechaVencimiento? }` per contract §5.A → ficha appears as COMPLETADO immediately.
5. RENEWALS unchanged: existing rows keep the pencil → status dialog (PATCH) flow.
6. VENCIDO estados now arrive from the backend truthfully (C4 lazy flip) — remove any frontend-only staleness workaround if present.

## T6 (#30) — polish wave
1. **C3**: in the instrument dropdown of the new dialog (and/or the assign UI), last option "➕ Crear instrumento nuevo" → `navigateTo('/instrumentos/crear?return=' + route.fullPath)`. In `instrumentos/crear.vue`: after successful create, if `return` query param present → navigate back to it.
2. **E1 frontend**: uppercase-as-you-type on entity nombre inputs — `certificados/crear.vue` (nombre), `instrumentos/crear.vue` + `[id]/editar.vue` (nombreInstrumento), `pacientes/crear.vue` + `[id]/editar.vue` (nombre), `empleados/nuevo.vue` + `[id]/editar.vue` (nombre, apellido), `empresa/editar.vue` (nombre). Pattern: input handler `e => form.x = e.target.value.toUpperCase()` or a tiny shared directive/composable — follow whatever is cheapest and consistent. Backend already transforms — this is display-consistency while typing. Do NOT touch descripcion/notas fields.
3. **tipoEmpleado field**: wherever usuarios are created/edited in the UI (search for the user-management surface; if none exists, add the Select to the empleado form ONLY IF it maps to usuario — otherwise report in result.md that user-management UI doesn't exist yet and the field is API-only). Select options: `[{label:'Gerontóloga', value:'GERONTOLOGA'}]`, clearable, only enabled when rol=EMPLEADO.

## Constraints
- Frontend :3100 HMR live; backend :3101 with all endpoints — do NOT restart
- Preserve ALL `data-testid` attributes (jul8/jul9 specs depend on them); ADD testids for new elements (`ficha-single-step-dialog`, `ficha-descargar-plantilla`, `instrumento-crear-shortcut`)
- Do NOT touch composables, nuxt.config.ts
- No git commit
- Admin creds local: admin@miempresa.com/<redacted>

## Deliverables
1. Source changes T5+T6
2. `tasks/W2-frontend/result.md` — per-task + browser verification notes
3. `completion-report.md`, `progress-report.md`

## Acceptance Criteria
1. Selecting an instrumento opens the combined dialog; submit creates a COMPLETADO ficha in one step (browser-verified)
2. Descargar plantilla downloads with the renamed filename (or documented fallback)
3. Renewal (pencil) flow still works incl. VENCIDO→COMPLETADO
4. jul8/jul9 fichas specs still pass (`jul8-fichas-*.spec.ts`, `jul9-nota-*.spec.ts` — run with matching-host env vars)
5. Uppercase-as-you-type live on all listed nombre inputs
6. C3 shortcut round-trips (crear → back to patient)
7. No console errors

## Reporting
Standard. On all done: `SendMessage(to: "main", "COMPLETE: Frontend wave done (T5+T6). See tasks/W2-frontend/result.md", summary: "W2 complete")`. Stay PARKED for QA fix-ups.
