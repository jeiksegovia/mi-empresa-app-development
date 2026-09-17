# Scope Decisions — fixes-jul-8 (post W1 research)

## D1 — "SPA reload on background/foreground" is NOT a code bug
**Evidence**: W1 exhaustive search — 0 hits for `location.reload`, `visibilitychange`, `document.hidden`, `window.location`, `router.go(0)` in frontend/. Only forced nav is `navigateTo('/login')` on 401 in `useApi.ts`.

**Decision**: This is browser-level tab-unload on backgrounded Android Chrome tabs (OS memory reclamation). Cannot be prevented at app level.

**Mitigation** (W3 scope):
- Persist ficha-form state to `sessionStorage` when dialog opens; restore on mount if present. If reload happens mid-upload, user sees their in-progress state.
- Improve 401 UX in `useApi.ts`: skip redirect when already on `/login`; add toast explaining "sesión expirada".

## D2 — CertificadoUpdate model IS needed
**User quote**: "the other old certificate updates appeared below, in case user need to validate any old file updates or note updated previously added"

This requires versioned history. Current model is a single row with `updatedAt` only — no audit trail.

**Decision** (W2 scope): Add `CertificadoUpdate` model with:
- `id`, `certificadoId` (FK), `archivoUrl?`, `notas?`, `fechaEmision?`, `fechaVencimiento?`, `creadoPor`, `createdAt`
- One-to-many: `CertificadoEmpresa` → `CertificadoUpdate[]`
- The **current** `archivoUrl`/`fechaEmision`/`fechaVencimiento` on `CertificadoEmpresa` are the latest snapshot; the history table is append-only.
- New endpoints: `POST /certificates/:id/updates` (add update), `GET /certificates/:id/updates` (list, ordered by createdAt desc).
- On POST /updates: update the parent cert's snapshot fields with any non-null values from the update; recompute `estado` from the new `fechaVencimiento` (VIGENTE if future, VENCIDO if past).

## D3 — VENCIDO → COMPLETADO transition MUST be allowed
**User quote**: "User should be able to edit it and change status from vencido to completado with an attached file."

Current: `validTransitions[VENCIDO] = []` in BOTH frontend (`pacientes/[id]/index.vue:105-109`) and backend (`patients.routes.ts` `validTransitions` map). Backend rejects with 400.

**Decision**:
- W2: change backend `validTransitions[VENCIDO] = ['COMPLETADO']`.
- W3: change frontend map identically. Remove `:disabled="data.estado === 'VENCIDO'"` on pencil button; use `availableTransitions.length > 0` instead (which will now be > 0 for VENCIDO).

## D4 — Nomina cuenta-de-cobro validation lives in service layer
**Reason**: The requirement is conditional on `tipoContrato` (only OPS/OBRA_O_LABOR need it). Zod schema doesn't know the empleado's active contrato — that's resolved inside `nominaService.createNominaPeriodo`.

**Decision** (W2 scope):
- Add validation inside `nominaService.createNominaPeriodo` after fetching active contrato: if `tipoContrato ∈ {OPS, OBRA_O_LABOR}` AND `!archivos?.some(a => a.tipoArchivo === 'CUENTA_COBRO')`, throw a typed error → route returns `400 { success: false, message: 'Cuenta de cobro requerida para contratos OPS/OBRA_O_LABOR', field: 'archivos.CUENTA_COBRO' }`.
- W3: render `field`-level error inline next to the missing slot.

## D5 — Nomina empleado filter — server-side query params
**Requirement**: Filter by "has contract"/tipoContrato/"no contract".

**Decision** (W2 scope):
- `GET /nomina?periodo=X&tipoContrato=OPS,OBRA_O_LABOR,TERMINO_FIJO,TERMINO_INDEFINIDO,NONE` — accept comma-separated list; `NONE` = empleado without active contract.
- Default (no `tipoContrato` param): only empleados WITH active contract (backwards-incompatible with current "all active empleados" — but user explicitly requested this default).
- W3: add filter UI at top of nomina/index.vue; default filter = "with contract (all types)".

## D6 — Instrumentos roles: comma-string preserved on the wire, MultiSelect on the UI
**Current**: `rolesPermitidos String @db.VarChar(255)` — comma-separated. Not changing schema (avoid migration risk).

**Decision**:
- W2: `.refine()` on Zod to validate each comma-split value ∈ `RolUsuario` enum. Enum values found in Prisma: check `RolUsuario`. (W2 must read schema and report exact enum values in schema-contract.md.)
- W3: MultiSelect with `RolUsuario` values as options; on submit, `.join(',')` back to string.

## D7 — Instrumentos edit page
**Current**: no `/instrumentos/[id]/editar.vue`; detail is read-only.

**Decision** (W3 scope): create `instrumentos/[id]/editar.vue` following the pattern of `certificados/[id].vue` inline-edit OR the empleado editar pattern (whichever exists — worker chooses based on existing code style). Include plantilla file upload via `useFileUpload().uploadFile(file, 'instrumentos')`.
