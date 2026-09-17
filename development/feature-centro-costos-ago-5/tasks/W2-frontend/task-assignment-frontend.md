# Task Assignment — W2 `pt-frontend-eng` · Centro de Costos UI

**Task type**: IMPLEMENTATION (frontend source + spec)
**Your task IDs**: `5` → `6` (sequential; the harness unblocks `6` when you complete `5`)
**Your worker name**: `worker-2`
**Working directory**: `/Users/jeik/ws/mi-empresa-app-development` (project root — all paths relative to it)

---

## Worker Self-Check (run BEFORE any work)

```bash
pwd                                    # MUST print the project root above. If not → BLOCKED immediately.
ls frontend/app/pages/nomina/index.vue # MUST exist — this is your structural exemplar
```
If `pwd` is a subdirectory, send `BLOCKED: spawned with cwd=<path>` and STOP — your permissions will
not load and every file write will hang.

---

## THE ONE RULE THAT MATTERS MOST

**Your specification is the contract document:**
`development/feature-centro-costos-ago-5/orchestration-ctx/decisions/contract-schema-centro-costos-ago-5.md`

It is **authoritative**. Read it completely before writing a line.

**Do NOT open any backend file** — not `schema.prisma`, not `centroCostosService.ts`, not
`centroCostos.routes.ts`, not `domainAccess.ts`. If the contract does not answer a question, **ask the
orchestrator** (`SendMessage(to: "main", ...)`). Do not guess a field name from the backend, and do
not go looking for it. This rule has produced zero integration name-mismatches across three prior
cycles in this repo; you are not the exception.

The backend is being built in parallel by worker-1 **from the same contract**. If the running API
disagrees with the contract, that is a finding to report — not a reason to change your code to match
the API.

---

## Background

The user wants to organize company ingresos and egresos into cost centers, so a monthly
`total ingresos − total egresos = balance` is visible. Cost centers are typed INGRESOS or EGRESOS and
hold ítems that all share one shape (`nombre`, `notas`, `cantidad`, `valorUnitario`, `valorTotal`,
`periodo`), plus three optional invoice fields used on egresos.

Scope for this cycle is deliberately **minimal CRUD + balance**. The user explicitly deferred
reporting: *"la visualización … tener reportes independientes, pero eso está fuera del scope por el
momento."* Build the working surface, not a reporting module.

---

## Locked decisions — do NOT re-litigate

| ID | Decision |
|---|---|
| D2 | Scope = minimal CRUD UI. **No** reports, no export, no month-over-month comparison, no charts. |
| D4 | RBAC: ADMIN + CONTRATOS see the module; GERONTOLOGA does not. |
| D5 | `cantidad` is a positive **integer**. |
| D6 | `valorTotal` is computed by the server. **Never send it, never let the user type it** — display it read-only. |
| D7 | `periodo` is monthly; the server normalizes to day 1. |
| D8 | A centro with ítems cannot be deleted — the API returns 409. Surface that message; offer "desactivar" instead. |

---

## Source Files to Modify (your exclusive ownership)

- `frontend/app/pages/centro-costos/index.vue` (new)
- `frontend/app/composables/useDomainAccess.ts`
- `frontend/app/app.config.ts`
- `frontend/tests/centro-costos/**` (new)

## Explicit non-goals — do NOT touch

- ❌ **Anything under `backend/`** — worker-1 owns it, and you must not even read it (see THE ONE RULE)
- ❌ Any other page, component, or composable not listed above
- ❌ `frontend/app/components/**` — if you need a component, define it locally inside your page
- ❌ Existing tests outside `frontend/tests/centro-costos/`
- ❌ Reporting / charts / export — out of scope (D2)

---

## Key files to read first (ordered, with why)

| File | Why | Focus |
|---|---|---|
| The **contract** (path above) | Your spec. Field names, wire types, endpoints, error shapes, RBAC row | ALL of it, especially §1.2 wire types and §2.3 shapes |
| `frontend/app/pages/nomina/index.vue` | **Structural exemplar.** `definePageMeta`, `useApi()`, `useToast()`, local `interface` declarations, and — importantly — how it already types money as `number \| string` | first ~60 lines for the shape; then how it renders money |
| `frontend/app/composables/useDomainAccess.ts` | You add one domain key + one prefix-map entry. The header comment explains why the matrix is duplicated on purpose — **do not "simplify" it** | whole file, it is short |
| `frontend/app/app.config.ts` | Sidebar items live here | `sidebar.items` array |
| `frontend/app/components/AppSidebar.vue` | Shows how items are filtered by `domainForPath` + `can()` — you do not edit this, just understand it | `filteredMenuItems` |

---

## Pre-loaded traps (instructions, not discoveries)

1. **`v-model` on a `const reactive()` object silently drops child emits.** This has bitten this repo
   before. Use `:model-value` + `Object.assign` for dialog form state. Your spec must then actually
   drive the DatePicker and fill optional fields, or it will pass against a broken form.
2. **Money arrives as a STRING.** Prisma serializes `Decimal` as `"1500.00"`, not `1500`. Type money
   fields `number | string` (exactly as `nomina/index.vue` already does) and convert with `Number()`
   **only at the render/arithmetic point**. If you sum them without converting you will get string
   concatenation — `"100" + "200" = "100200"` — and the balance will be silently, spectacularly wrong.
3. **`cantidad` is an integer.** Use an integer-constrained input; sending `2.5` gets a 400.
4. **Never send `valorTotal`.** The server computes and ignores it. Show it as derived/read-only.
5. Frontend dev server :3100, backend :3101. **Never** `pkill node` / `pkill -f tsx` — a production
   service may sit on :4142. Target a specific PID from `lsof -i :3100` if you must restart.
6. FE e2e is host-sensitive: `TEST_FRONTEND_URL` / `TEST_API_URL` must match the host the cookies were
   issued for (bare `localhost` vs IP mismatches break auth).
7. Test creds: `admin@miempresa.com` / `<redacted>`; also `qa-contratos@` and `qa-gerontologa@`
   (same password).

---

## Task 5 — Page + RBAC mirror + nav

**Do the smallest piece first** to flush environment problems cheaply:

1. **RBAC mirror** — in `useDomainAccess.ts`: add `'centro-costos'` to the `Domain` union, add one
   cell to **each** profile in `DOMAIN_ACCESS` (`GERONTOLOGA: false`, `CONTRATOS: true`), and add
   `{ prefix: '/centro-costos', domain: 'centro-costos' }` to `DOMAIN_PREFIX_MAP`. Values come from
   contract §3. This must be **cell-for-cell** identical to the backend matrix — W3 tests parity.
2. **Nav** — in `app.config.ts`, add `{ label: 'Centro de Costos', icon: 'pi pi-chart-pie', to: '/centro-costos' }`
   to `sidebar.items`, positioned after Nomina. The sidebar filters it automatically via `domainForPath`.
3. **Page** — `frontend/app/pages/centro-costos/index.vue`:
   - `definePageMeta({ middleware: 'auth', layout: 'default' })`
   - **Month selector** driving all loads (default: current month, `YYYY-MM`).
   - Two sections, **Ingresos** and **Egresos**, each listing its centros with that centro's ítems
     in a table (`nombre`, `notas`, `cantidad`, `valorUnitario`, `valorTotal`) and a **subtotal**.
   - A **balance summary**: `totalIngresos`, `totalEgresos`, and `balance` — visually distinguish
     positive from negative.
   - **Add / edit / delete ítem** via a dialog. The three invoice fields (`numeroFactura`,
     `proveedor`, `fechaFactura`) render **only when the parent centro is EGRESOS**.
   - On a 409 from deleting a centro, show the server's message and suggest deactivating instead.
   - Empty month → render the centros with zero subtotals and a zero balance. It is **not** an error
     state; the API returns 200 with empty groups.

**Acceptance criteria** (demonstrate each):
1. `/centro-costos` loads for `admin@miempresa.com` and lists all 11 seeded centros under the right sections.
2. Changing the month re-fetches and re-renders (network call observable).
3. Creating an ítem persists and updates both the centro subtotal and the balance **without a manual page reload**.
4. Displayed `balance` equals the API's `balance` field exactly — verify against a month where ingresos ≠ egresos, so a string-concatenation bug cannot hide.
5. Egreso-only fields appear for an EGRESOS centro's dialog and are absent for an INGRESOS one.
6. Sidebar shows "Centro de Costos" for ADMIN, and **not** for `qa-gerontologa@miempresa.com`.
7. Frontend typecheck passes (`npm run typecheck` or the project's equivalent — check `package.json`).

---

## Task 6 — Frontend smoke spec

`frontend/tests/centro-costos/centro-costos-smoke.spec.ts`, following the structure of the specs in
`frontend/tests/local-qa/`. Cover: page loads · month selector drives a reload · create an ítem
through the dialog · balance updates. Heed traps 1 and 2 — drive the DatePicker explicitly and fill
optional fields rather than relying on defaults.

Run it, and paste the **verbatim** output into your completion report.

---

## Deviation protocol

If reality contradicts this assignment or the contract: state it as
**"contract said X / reality is Y / therefore Z"**, attach evidence (the actual response body, a
screenshot path), then:
- **Breaking** (a contract field name or shape is wrong) → `TURNING-POINT-BREAKING:` and **WAIT**.
  Do NOT reshape your code to match a running API that disagrees with the contract.
- **Non-breaking** → proceed and note it in your completion report.

## Error budget

**MAX 2 distinct self-repair attempts** per error, then STOP and send `TURNING-POINT-STRATEGY:` with
the exact error, both attempts and their results, and the hypotheses you ruled out. Do not spin.

`BLOCKED:` template — exact problem / what you attempted / what would unblock you. Then WAIT.

## Reporting protocol

- `TaskUpdate → in_progress` on start, `→ completed` when acceptance criteria pass.
- Keep `tasks/W2-frontend/progress-report.md` current — intermediate findings go in **sections of
  that file**, never as extra standalone files.
- Final: `tasks/W2-frontend/completion-report.md` with verbatim commands + outputs for every
  acceptance criterion, and a BUG / TEST-ENV / FLAKE classification for every failure observed —
  zero unclassified.
- Message `main` only on: `COMPLETE:` per task, `BLOCKED:`, `TURNING-POINT-*`. Silent after the final `COMPLETE:`.
- **Never** message another worker directly.
