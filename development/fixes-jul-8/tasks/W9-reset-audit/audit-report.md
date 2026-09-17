# W9 — Modal-reuse-across-rows audit report

**Scope:** every page under `frontend/app/pages/` checked for the leak pattern
where a single dialog component is opened for different list rows on the
same page load AND persists state (file, draft, IDB stash) keyed by anything
OTHER than the row id.

## Confirmed bug — `pacientes/[id]/index.vue`

**Status:** LEAK → FIXED

`stashKey = computed(() => \`ficha:${route.params.id}:file\`)` used the
**patient** id only. Every ficha row on the same patient page shared the
same IDB slot. The `fichaDraftKey` was already ficha-scoped (`fichaForm.id`
in the path), but the IndexedDB stash via `useFileStash` was not.

Root cause: the IDB file stash key is built from `route.params.id`, not
from the currently-open ficha's id. `restoreFile()` therefore returns the
previously-picked file when the user opens a DIFFERENT ficha dialog on
the same patient page.

### Fix

1. **`stashKey` now includes `fichaForm.id`:**
   ```ts
   const stashKey = computed(
     () => `ficha:${route.params.id}:${fichaForm.id || 'new'}:file`
   )
   ```
   Because `fichaForm.id` is set at the top of `openFichaDialog(ficha)`
   before any restore call, the `computed` picks up the new value and the
   IDB write/read for each ficha lands in its own slot.

2. **Explicit reset at the TOP of `openFichaDialog`:** before reading the
   draft or awaiting `restoreFile()`, we now null out:
   ```ts
   uploadedFile.value = null
   uploadedFileName.value = null
   uploadedFileKey.value = null
   ```
   This guarantees that even if a `restoreFile()` promise from a
   previously-closed dialog resolves AFTER the new dialog opens, the
   late-arriving result cannot pollute the new dialog's state.

3. **sessionStorage draft** (`fichaDraftKey`) was already correctly scoped
   (`ficha-form-draft-<patient>-<fichaId>`) and `readFichaDraft()` discards
   drafts whose `parsed.id !== fichaForm.id` — so no further change needed.

### Why this fix is safe for the existing test contract

The previous test (`jul8-fichas-file-stash.spec.ts`) verified that "the
file survives a full page reload on the SAME ficha dialog". The stashKey
change still satisfies that contract — the rehydrated file comes from the
same ficha-scoped slot as before — but tests had to be updated to use the
new key shape:
- `jul8-fichas-file-stash.spec.ts` → stashKey is now
  `ficha:${patientId}:${fichaId}:file`.
- The selector for row pencil buttons was tightened to
  `table button:has(span.pi-pencil)` to exclude the page-header "Editar"
  button (which shares the same `pi-pencil` icon).
- Both the existing and the new test now create a scratch patient so the
  DataTable only contains the test's own fichas — `nth(0)` / `nth(1)` /
  `last()` are deterministic.

## Audit table

Every page under `frontend/app/pages/` was checked. The columns:

- **Pattern** — does the page have a dialog opened for multiple rows?
- **File state** — does the dialog carry file-input / sessionStorage /
  IDB stash state?
- **Key shape** — is the state keyed by the row id, or by a coarser scope?
- **Verdict** — `LEAK` (rows share scoped state) / `LOW` (minor cosmetic)
  / `NO-LEAK` / `N-A` (not applicable).

| Page | Pattern | File state | Key shape | Verdict | Notes / fix |
|------|---------|------------|-----------|---------|-------------|
| `pacientes/[id]/index.vue` | Dialog opened per ficha row | IDB stash + draft | `ficha:<patient>:file` (un-scoped) | **LEAK → FIXED** | Stash now includes fichaForm.id + explicit reset at top of openFichaDialog. Draft was already scoped. |
| `pacientes/crear.vue` | Single form, no dialogs | None | n/a | NO-LEAK | No file inputs at all. |
| `pacientes/[id]/editar.vue` | Single form, no dialogs | None | n/a | NO-LEAK | No file inputs. |
| `nomina/index.vue` | Dialog opened per empleado row | Files via `dialogForm.archivos` (reactive ref) | In-memory ref; reset in `closeDialog` and `openDialog` | NO-LEAK | `closeDialog()` clears `dialogForm.archivos = []` and `cuentaCobroError`. `openDialog()` overwrites with the row's own archivos. The HTML `<input type="file">` resets via `input.value = ''` after each upload. |
| `certificados/[id].vue` | Single cert per page; one dialog | IDB stash scoped by cert id | `cert-agregar:<certId>:file` | NO-LEAK | Open dialog is for THIS cert only. Added `updateFileInputRef.value.value = ''` in `openAddUpdateDialog` for symmetry / hygiene. |
| `certificados/index.vue` | List page; delete dialog only | No file state | n/a | NO-LEAK | Delete dialog has no file input. |
| `certificados/crear.vue` | Single creation page | IDB stash + draft | `cert-crear:file`, `cert-crear:comprobante`, `cert-crear:update-file` (page-scoped, wiped on submit) | NO-LEAK | One page → one creation. Clear on submit. |
| `empleados/[id]/index.vue` | Single empleado per page; novedad + pendiente dialogs | Files via `novedadForm.archivos` | In-memory; reset in `resetNovedadForm` | NO-LEAK | One empleado per page → no row reuse. |
| `empleados/[id]/editar.vue` | Contrato dialog per contrato row | Reactive form + HTML file input | In-memory form; reset via `resetContratoForm` | LOW (cosmetic) | `resetContratoForm` already cleared `archivoUrl = ''`. Added explicit `contratoArchivoInputRef.value.value = ''` so the underlying `<input>` doesn't retain a previously picked File. |
| `empleados/index.vue` | List page only | None | n/a | NO-LEAK | List page with no dialogs. |
| `empleados/nuevo.vue` | Single creation form | None | n/a | NO-LEAK | No file inputs. |
| `empleados/[id]/historial.vue` | Read-only display | None | n/a | NO-LEAK | Read-only. |
| `instrumentos/crear.vue` | Single creation page | IDB stash + draft | `instrumento-crear:plantilla` (page-scoped, cleared on submit) | NO-LEAK | One creation page. |
| `instrumentos/[id]/editar.vue` | Single instrumento per page; plantilla upload | IDB stash scoped by instrumento id | `instrumento-editar:<id>:plantilla` | NO-LEAK | Key includes `route.params.id`. Draft key also per-instrumento. |
| `instrumentos/index.vue` | List page only | None | n/a | NO-LEAK | No dialogs. |
| `instrumentos/[id]/index.vue` | Detail page | None | n/a | NO-LEAK | Read-only display; no upload on this page. |
| `empresa/editar.vue` / `empresa/index.vue` | Single empresa | None (other than separate perfil form) | n/a | NO-LEAK | No file dialogs. |
| `index.vue` (root) | Dashboard | None | n/a | NO-LEAK | Stats only. |
| `login.vue` | n/a | None | n/a | NO-LEAK | n/a |

### Summary

- **1 leak fixed** (`pacientes/[id]/index.vue`).
- **2 minor cosmetic touch-ups** added: clearing the HTML `<input type="file">`
  ref on dialog open/reset for `certificados/[id].vue` (`updateFileInputRef`)
  and `empleados/[id]/editar.vue` (`contratoArchivoInputRef`).
- **All other pages** verified clean.

## New playwright spec — `jul8-ficha-file-reset.spec.ts`

Two tests, both pass on a fresh scratch patient:

1. **`opening ficha #2 dialog does not leak ficha #1 file`** — the regression
   spec for this bug. Creates 2 fichas, picks a file in ficha-A's dialog,
   closes, opens ficha-B's dialog, asserts:
   - ficha-A's filename is NOT visible in ficha-B's dialog
   - the file input shows the "Seleccionar archivo" placeholder
   - IDB has NO entry under the old un-scoped key `ficha:<patient>:file`
   - IDB has exactly ONE entry under the new scoped keys, in the ficha
     that was opened first (order-dependent, not asserted which one).
2. **`verify stashKey change: openFichaDialog clears uploaded state before restore`** —
   sanity test that opening two ficha dialogs on a fresh patient (without
   picking files) leaves both with a clean "Seleccionar archivo" label.

## Result of running all `jul8-*.spec.ts`

```
Running 19 tests using 1 worker
✓ 17 passed (2 pre-existing skips)
```

The 2 skips are unrelated:
- `jul8-fichas-persistence.spec.ts` — requires a fresh ficha (skipped when
  no PENDIENTE ficha exists in seed at run-time).
- `jul8-fichas-vencido-to-completado.spec.ts` frontend test — same condition.

## Files touched

- `frontend/app/pages/pacientes/[id]/index.vue` — main fix.
- `frontend/app/pages/empleados/[id]/editar.vue` — clear HTML `<input>`
  ref in `resetContratoForm()`.
- `frontend/app/pages/certificados/[id].vue` — clear HTML `<input>` ref
  in `openAddUpdateDialog()`.
- `frontend/tests/local-qa/jul8-ficha-file-reset.spec.ts` — NEW regression spec.
- `frontend/tests/local-qa/jul8-fichas-file-stash.spec.ts` — updated to
  use the new stashKey shape + scratch patient + scoped selector.
