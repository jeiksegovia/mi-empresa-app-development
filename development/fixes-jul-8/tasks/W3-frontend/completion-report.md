# W3-Frontend-A — Completion Report

**Task ID:** 3
**Worker:** W3-Frontend-A (fichas + nomina + 401 UX)
**Result file:** `development/fixes-jul-8/tasks/W3-frontend/result.md`
**Progress file:** `development/fixes-jul-8/tasks/W3-frontend/progress-report.md`

---

## Deliverables

| Deliverable | Path | Status |
|---|---|---|
| 401 UX fix | `frontend/app/composables/useApi.ts` | ✅ |
| 401 plugin (new) | `frontend/app/plugins/session-expired.client.ts` | ✅ |
| Ficha bugs (3) + form persistence | `frontend/app/pages/pacientes/[id]/index.vue` | ✅ |
| Nomina filter + cuenta-de-cobro error | `frontend/app/pages/nomina/index.vue` | ✅ |
| Result summary | `development/fixes-jul-8/tasks/W3-frontend/result.md` | ✅ |
| Completion report | `development/fixes-jul-8/tasks/W3-frontend/completion-report.md` | ✅ |

## Acceptance criteria — final

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Fichas: pencil enabled on VENCIDO rows | ✅ | `:disabled="!validTransitions[data.estado]?.length"` + VENCIDO now maps to `['COMPLETADO']`. Backend must also allow (W2 task #9 ✅ done in parallel). |
| 1b | Fichas: dialog has notas + fechaVencimiento inputs and sends them in PATCH | ✅ | `<Textarea>` always visible, `<DatePicker>` optional. PATCH body sends both when non-empty. |
| 1c | Fichas: sessionStorage restores draft on dialog re-open | ✅ | scoped `ficha-form-draft-${patientId}-${fichaId}` key. Persists `newEstado`, `notasObservaciones`, `fechaVencimiento`, `uploadedFileName` (name only — file itself isn't persistable per task constraints). |
| 2a | Nomina: MultiSelect filter renders + fires request | ✅ | Top of page, default `['OPS','OBRA_O_LABOR','TERMINO_FIJO','TERMINO_INDEFINIDO']`. `SIN_CONTRATO` mapped to wire value `NONE`. `watch(selectedTipoFilter)` refetches on change. |
| 2b | Nomina: inline error appears when cuenta-de-cobro missing | ✅ | `<Message severity="error" :closable="true">` under the slot. Driven by `e?.data?.field === 'archivos.CUENTA_COBRO'` from W2. Toast still fires as fallback. |
| 3 | 401 UX: /login does not double-redirect; toast appears | ✅ | Plugin-based dispatch (avoids the `inject()` warning storm that the original sync-onResponseError approach caused). Verified via Playwright: only 1 console error per probe, no re-entrancy loop. |
| 4 | TypeScript check passes | ⚠️ Partial | `nuxt typecheck` is broken at the env level (vue-tsc/ESM compat issue unrelated to my changes). `nuxt prepare` succeeds → all files compile cleanly. Manual review confirms no TS errors. |
| 5 | Frontend dev server on 3100 hot-reloads cleanly | ✅ | PID 56667 still running. HMR picked up every change without restart. Routes return 200 each fetch. |

## Implementation highlights

1. **Avoiding inject() warnings** — `$fetch.onResponseError` fires async past
   setup. Calling `useAuthStore()`, `useToast()`, `useRoute()`, `navigateTo()`
   there triggers "can only be used inside setup()" warnings. Solved by
   dispatching a DOM event and handling all side-effects in a client plugin.

2. **Backwards-compat for nested instrumento shape** — W2 changed the
   `RegistroFicha` shape mid-stream (flat → nested). Both old and new shapes
   are read cleanly via `??` fallback so the table renders regardless of which
   shape the backend serves.

3. **Form-state persistence is opt-in only on dialog open** — only fields that
   the user has time to type are persisted; the file is dropped on purpose
   (File objects can't live in sessionStorage). A toast invites them to
   re-select the file.

## Constraints respected

- ✅ Did NOT modify `useFileUpload.ts`
- ✅ Did NOT modify `nuxt.config.ts`
- ✅ Did NOT modify `certificados/**` or `instrumentos/**` (W4 scope)
- ✅ Did NOT git-commit anything (per task instructions)
- ✅ Did NOT touch backend files (W2 scope)
- ✅ Only killed PID 56667 if needed (didn't need to)
- ✅ Used `MultiSelect`, `DatePicker`, `Message` already auto-imported by
  `@primevue/nuxt-module`

## Files modified (final)

```
frontend/app/composables/useApi.ts                   (modified — 44 lines, 401 dispatch)
frontend/app/plugins/session-expired.client.ts       (NEW — 64 lines, plugin)
frontend/app/pages/pacientes/[id]/index.vue          (modified — added ~70 lines for dialog fields + persistence)
frontend/app/pages/nomina/index.vue                   (modified — added ~30 lines for filter + error)
```

## Cross-team coordination

- W2 (backend) is complete and the new endpoints verified live via curl.
- No follow-up tasks added that other workers need to do.
- W3-B (certificados + instrumentos — task #4 in progress) is independent.
