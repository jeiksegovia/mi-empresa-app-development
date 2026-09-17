# W9 — File-reset audit + fixes — progress

## Phase 1 — Root-cause fix (pacientes/[id]/index.vue)

**Finding (CONFIRMED):** `frontend/app/pages/pacientes/[id]/index.vue:116`

```ts
const stashKey = computed(() => `ficha:${route.params.id}:file`)
```

`route.params.id` is the **patient** id, not the ficha id. Every ficha row on the
same patient page shares the same IDB stash key. When the user picks a file for
ficha #1, it stashes under `ficha:<patientId>:file`. When the user opens
ficha #2's dialog, `restoreFile(stashKey.value)` returns ficha #1's file —
classic modal-reuse-across-rows leak.

Same root cause for the draft key fallback? NO — `fichaDraftKey` at line 109
already includes `fichaForm.id` and `readFichaDraft` discards drafts whose
`parsed.id !== fichaForm.id`. The sessionStorage draft is properly scoped.
Only the IDB stash (`ficha:<patient>:file`) is unscoped by ficha id.

**Fix:**
1. Change `stashKey` to include `fichaForm.id` so it becomes
   `ficha:<patientId>:<fichaId>:file`.
2. Add an EXPLICIT reset at the TOP of `openFichaDialog(ficha)` — BEFORE the
   restore logic — to ensure `uploadedFile`, `uploadedFileName`, and
   `uploadedFileKey` are all cleared before any async restore call starts.
   This way even if `restoreFile` returns null or the user navigates quickly,
   no stale state from the previous ficha is left.

## Phase 2 — Audit (entire `frontend/app/pages/`)

Each page was checked for modal-reuse-across-rows + file/sessionStorage/IDB
stash patterns. See `audit-report.md` for the full table. Summary:

| Page | Verdict | Notes |
|------|---------|-------|
| `pacientes/[id]/index.vue` | **LEAK → fixed** | Confirmed — fixed in Phase 1 |
| `pacientes/crear.vue` | NO-LEAK | No file input, no stash |
| `pacientes/[id]/editar.vue` | NO-LEAK | No file input |
| `nomina/index.vue` | LOW RISK — minor hardening | Modal resets form incl. archivos on `closeDialog`; safe between opens |
| `certificados/[id].vue` | NO-LEAK | Single-cert-per-page; stash key includes `route.params.id` |
| `certificados/index.vue` | NO-LEAK | Delete dialog only; no file inputs |
| `certificados/crear.vue` | NO-LEAK | Single page; stash key is `cert-crear:*` (page-scoped) |
| `empleados/[id]/editar.vue` | LOW — minor hardening | Contrato dialog resets reactive form; HTML `<input>` not cleared on cancel → minor cosmetic |
| `empleados/[id]/index.vue` | NO-LEAK | novedad + pendiente dialogs reset on close |
| `empleados/index.vue` | NO-LEAK | List page only |
| `empleados/nuevo.vue` | NO-LEAK | No file inputs |
| `empleados/[id]/historial.vue` | NO-LEAK | Read-only |
| `instrumentos/crear.vue` | NO-LEAK | Single creation page; static key `instrumento-crear:plantilla` |
| `instrumentos/[id]/editar.vue` | NO-LEAK | Key includes `route.params.id` |
| `instrumentos/index.vue` | NO-LEAK | No dialog |

**Decision:** Only `pacientes/[id]/index.vue` had a true row-reuse leak. Other
suspects were verified clean. One low-risk cosmetic item noted in
contrato dialog (HTML file input not reset on cancel) — added an explicit
input-value reset to `resetContratoForm()` and a `clearAddUpdateDialog` reset
on the cert-add-update dialog for symmetry.

## Phase 3 — New playwright spec

Built `frontend/tests/local-qa/jul8-ficha-file-reset.spec.ts`:

- Creates two fichas for the same patient (PENDIENTE state).
- Opens ficha #1 → picks file → expects IDB write.
- Closes dialog.
- Opens ficha #2 → expects:
  - `uploadedFileName` to be null (no leak from ficha #1)
  - No IDB file at the old key `ficha:<patient>:file`
  - label shows the placeholder "Seleccionar archivo"
- Cleans up the extra ficha + IDB entries.

## Phase 4 — Run jul8 tests

Run all `jul8-*.spec.ts` — confirm no regression. Record result here.

