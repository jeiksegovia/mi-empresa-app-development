# Team Plan: fixes-jul-8 (REVISED post-W1)

## Objective
Implement all UX/logic fixes from `context/plans/initial-prompt-fixes-jul-8.md` across 5 domains.
Full research at `development/fixes-jul-8/02-research-fixes-jul-8.md`.
Scope decisions at `orchestration-ctx/decisions/scope-decisions.md`.

## Workers

| Worker | Role | Scope | Points |
|--------|------|-------|--------|
| W1 | pt-research-arch | Codebase exploration | ✅ DONE |
| W2 | pt-backend-eng | Schema + migration + all backend changes | ~10 |
| W3 | pt-frontend-eng | Fichas + Nomina + 401 UX + form-persist | ~10 |
| W4 | pt-frontend-eng | Certificados + Instrumentos | ~10 |

## Dependency
- W2 spawns immediately (blocks on W1 only, already done)
- W3 spawns immediately in parallel (no backend dependency for its scope — fichas transitions and nomina filter API contracts are documented in scope-decisions.md)
- W4 spawns AFTER W2 writes `orchestration-ctx/decisions/schema-contract.md` (needs CertificadoUpdate model definition + new endpoints)

## W2 Scope (backend)
1. **Prisma**: add `CertificadoUpdate` model + migration (see D2). Add relation back-reference on `CertificadoEmpresa`.
2. **Backend cert routes/service**: `POST /certificates/:id/updates` + `GET /certificates/:id/updates`; on POST update parent snapshot fields + recompute estado.
3. **Instrumentos Zod**: `.refine()` on roles against `RolUsuario` enum (D6).
4. **Fichas**: change `validTransitions[VENCIDO] = ['COMPLETADO']` in `patients.routes.ts` (D3).
5. **Fichas Zod**: add Zod schema for PATCH /fichas/:id/status (currently missing) — required `estado`, optional `archivoCompletado`, `notasObservaciones`, `fechaVencimiento`.
6. **Nomina service validation**: enforce cuenta-de-cobro when tipoContrato ∈ {OPS, OBRA_O_LABOR} (D4).
7. **Nomina query filter**: `GET /nomina?periodo=X&tipoContrato=comma,list` (D5).
8. Write `orchestration-ctx/decisions/schema-contract.md` with the new `CertificadoUpdate` model and the new endpoint request/response shapes. This unblocks W4.

## W3 Scope (frontend — fichas + nomina + 401 UX)
1. **401 UX** (D1): edit `frontend/app/composables/useApi.ts` — skip redirect when `useRoute().path === '/login'`; add `useToast().add({...})` with "Sesión expirada, redirigiendo…".
2. **Fichas form-state persistence** (D1): in the "actualizar estado" dialog, mirror `fichaForm` + `uploadedFile.name` to `sessionStorage` on every change; restore on dialog mount if `fichaForm.id` matches. Clear on successful save. (uploadedFile itself can't be persisted — only its name, so user knows to re-select if the tab reloaded.)
3. **Fichas 3 bugs**:
   - Bug 1: instrument name — verify backend returns `instrumentoNombre` on `/patients/:id` (W1 says it does). If UI shows blank, add fallback text `data.instrumentoNombre || '—'`. If backend field name is different, coordinate via BLOCKED message.
   - Bug 2: `handleFichaSubmit` — add `notasObservaciones` and `fechaVencimiento` fields to the form + include them in PATCH body.
   - Bug 3: change `validTransitions[VENCIDO] = ['COMPLETADO']` (D3); replace pencil `:disabled="data.estado === 'VENCIDO'"` with `:disabled="!validTransitions[data.estado]?.length"`.
4. **Nomina filter** (D5): add `Select` (single) + `MultiSelect` at top of nomina/index.vue for filter by contract type; default = "with contract (all types)"; also option "sin contrato". Send comma-separated `tipoContrato` param to `GET /nomina`.
5. **Nomina cuenta-de-cobro error** (D4): parse `field` from error response; render inline error next to CUENTA_COBRO slot; toast "Cuenta de cobro requerida".

## W4 Scope (frontend — certificados + instrumentos, blocked on W2)
**Wait for `orchestration-ctx/decisions/schema-contract.md` before starting.**
1. **Certificados Detalle** — refactor `certificados/[id].vue`:
   - Top section shows current snapshot (unchanged behavior for reading)
   - New "Historial de actualizaciones" section listing past updates (from GET /updates)
   - "Agregar actualización" button opens dialog with: optional file, optional notas, optional fechaEmision, optional fechaVencimiento. Submits via POST /updates.
   - "Editar" inline mode = metadata only (nombre, tipoCertificado, descripcion, periodicidad, periodo). Remove file+dates from inline edit form.
2. **Certificados crear** — add optional "primera actualización" fields to the create form (file, notas, fechaEmision, fechaVencimiento). On submit: create cert, then if any update fields present, POST /updates immediately with them.
3. **Instrumentos nuevo** — replace `<InputText v-model="form.rolesPermitidos">` with `<MultiSelect :options="rolUsuarioOptions" v-model="rolesArray">`; on submit `.join(',')`. Add file input for `plantillaArchivo` using `useFileUpload().uploadFile(file, 'instrumentos')`.
4. **Instrumentos [id]/editar.vue** (new file) — mirror crear.vue structure; enable editing all fields including roles MultiSelect + plantilla replace.

## Interface Contract (W2 → W4)
W2 writes `orchestration-ctx/decisions/schema-contract.md` with:
- `CertificadoUpdate` fields (exact names)
- `RolUsuario` enum values (verbatim from schema.prisma)
- `POST /certificates/:id/updates` request body + response body
- `GET /certificates/:id/updates` response body
- Any breaking change to existing endpoints

## Constraints
- Backend: `npm run dev` (tsx watch on port 3101). Local backend already running (PID 47989). Any Prisma migration must run via `npx prisma migrate dev --name <slug>` from `backend/`.
- Frontend: `npm run dev` on 3100. Local frontend already running (PID 56667).
- Never `pkill -f node` or generic patterns. Target specific PIDs.
- Follow existing patterns: Prisma + Express + Zod backend; Nuxt 4 SPA + PrimeVue + Pinia frontend.
- Only commit when explicitly instructed.
- W2 must NOT run `prisma migrate diff --shadow-database-url` (blocked per global CLAUDE.md).
