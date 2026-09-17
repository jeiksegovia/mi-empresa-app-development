# task-assignment-wave2-shared-form (W2, wave 2 — NEW-ASSIGNMENT, reused worker)

## Context you already have
You cleaned `certificados/crear.vue` in wave 1 and left the "Primera actualización" card relocation-friendly (`cert-first-update-dropzone`, hookup points intact). Now extract it into a shared component and wire the new `comprobantePagoUrl` field the backend now accepts.

## Task Type
IMPLEMENTATION

## Task ID
`17`. `TaskUpdate(taskId: "17", status: "in_progress")` on start.

## API contract (implemented + curl-verified by W1)
`orchestration-ctx/decisions/schema-contract-jul9.md` — read §1 (CertificadoUpdate now has `comprobantePagoUrl String? (1..500)`) and §5 (JSON shapes). `POST /certificates/:id/updates` accepts `{ archivoUrl?, comprobantePagoUrl?, notas?, fechaEmision?, fechaVencimiento? }` — at least one required (Zod refine).

## Your Task (A4-UI + A5)
1. NEW `frontend/app/components/certificate/CertificateUpdateForm.vue`:
   - Fields: archivo (file upload → `useFileUpload().uploadFile(file, 'certificados')`), comprobante de pago (2nd file upload, same folder), notas (Textarea), fechaEmision (DatePicker), fechaVencimiento (DatePicker)
   - `v-model`-friendly (modelValue object or individual v-models per project convention — check how existing shared components do it)
   - File-stash keys MUST be caller-scoped: accept a `stashKeyPrefix` prop so crear uses `cert-crear:*` and the Agregar dialog uses `cert-agregar:<certId>:*` (row-scoped keys — jul-9 W9 lesson)
   - Dropzones: clickable label + pointer/hover pattern you established in T8
2. `frontend/app/pages/certificados/crear.vue` — replace the inline Primera actualización card body with the shared component; include `comprobantePagoUrl` in the first-update POST when set
3. `frontend/app/pages/certificados/[id].vue` — replace the Agregar actualización dialog body with the shared component; include `comprobantePagoUrl` in POST /updates body; render comprobante link in the historial list items when present (`useFileUpload().downloadFile`)

## Constraints
- Do NOT touch composables, nuxt.config.ts, pacientes/nomina/empleados pages
- Preserve existing sessionStorage draft + IDB stash semantics exactly (scoped keys)
- Preserve `data-testid` attributes used by jul8 specs
- No git commit

## Deliverables
1. New component + 2 page refactors
2. `development/improvements-jul-9/tasks/W2-frontend-a/result-wave2.md` — summary + browser verification (create cert with both files; agregar update with comprobante; historial shows both links)
3. Update completion-report.md with a Wave 2 section

## Acceptance Criteria
1. Both consumers render the same component; no duplicated form logic remains
2. comprobantePagoUrl round-trips: upload → POST → visible in historial
3. Stash keys correctly scoped per consumer (verify in DevTools IDB)
4. jul8 cert specs still pass (`npx playwright test tests/local-qa/jul8-cert-*.spec.ts` with TEST env vars per tests/helpers pattern)
5. No console errors on HMR

## Reporting Protocol
Same as before. On done: `SendMessage(to: "main", "COMPLETE: Shared CertificateUpdateForm + comprobante UI done. See tasks/W2-frontend-a/result-wave2.md", summary: "W2 wave 2 complete")`. Then stay PARKED — shutdown will follow after validation.
