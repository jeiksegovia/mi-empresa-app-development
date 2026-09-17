# Team Plan: next-release-jul-10

**Scope**: 3 of the 4 deferred groups from `context/plan-implemented/improvements-jul-9-implemented.md` §Deferred + `context/user-feedback/improvements-jul-9-insights.md` §Deferred.
**Excluded**: Group 3 (C5 TipoInstrumento enum) — externally blocked on client Excel samples ("El martes que llegue Liana…"). Revisit when data arrives.
**Baseline**: local dev with improvements-jul-9 applied (22 migrations, backend :3101, frontend :3100). Not committed.

## Groups in scope

### Group 1 — Fichas release (origin: qa-session-jul-9 transcript §3, lines 210–286)
- **C1** Single-step ficha assign + first update — one transaction: assign instrumento + upload + estado COMPLETADO. New endpoint + dialog rewrite.
- **C2** "Descargar plantilla en blanco" button in the dialog; downloaded file renamed `{plantillaNombre}_{pacienteNombre}.{ext}` client-side.
- **C3** Inline "➕ Crear instrumento" option in the instrument dropdown (nav with returnUrl).
- **C4** PENDIENTE → VENCIDO truth: **lazy on-read flip** (decision D-C4 below) — no cron infra.
- **C6** `TipoEmpleado` enum (`GERONTOLOGA`) on `Usuario` per locked L2; gate `/instruments/*` writes: ADMIN OR (EMPLEADO + GERONTOLOGA).
- **C7** Weekly vencimientos endpoint (fichas due/overdue within N days) — the reporting payoff of C4.

### Group 2 — Hardening pack (origin: qa-report-jul-9 §6 + d7-cargo-migration-approval.md)
- jul4 suite origin migration: 22 pre-existing TEST-ENV failures — replace hardcoded `http://localhost:3101` with `getApiOrigin()`/`TEST_API_URL` helper pattern.
- `tests/dashboard/*` + `tests/auth/auth-empleado-link.spec.ts` port-3001 fix (same pattern).
- D3 dedicated spec: `documentoIdentificacionUrl` round-trip (~30 lines).
- D7 follow-up: `Contrato.cargoId` → NOT NULL (data-check → backfill NULLs to empresa's "Otro" → SET NOT NULL) + Zod requires cargoId on create.

### Group 4 — E1 auto-uppercase (origin: qa-session-jul-9 transcript lines 55–62)
- Server-side: Zod `.transform(v => v.trim().toUpperCase())` on entity **nombre** fields: CertificadoEmpresa, Instrumento, Cliente, Empleado (nombre+apellido), Empresa. NOT on descriptions/notas/textareas (explicit user spec, line 60–62).
- Frontend: uppercase-as-you-type on the same inputs so display matches storage.
- Historical rows: left as-is (user decision jul-9).

## Decisions

- **D-C4 (lazy flip, no cron)**: estado flip PENDIENTE→VENCIDO happens on-read inside the fichas list/detail service path + inside the C7 endpoint. Rationale: no new infra, always truthful at the moment of viewing, and the weekly report computes from dates anyway. A cron can be added later if a push-notification use-case appears.
- **D-C1 (one endpoint)**: `POST /patients/:id/fichas` extended (or sibling route per existing pattern — W1 chooses) to atomically create the RegistroFicha + first archivo + estado COMPLETADO in a single Prisma transaction. Old two-step PATCH stays for renewals.
- **D7-tighten**: safe now — wave-3 UI (jul-9) made cargo selection part of the contrato form.

## Existing Patterns Used
Same as improvements-jul-9 (service→route, Zod-at-top, structured 400 with `field`, PrimeVue auto-import, useFileUpload/useFileStash row-scoped keys, origin-aware test helpers, `jul10-*.spec.ts` naming next).

## Workers & Waves (max 3 concurrent; reuse per worker-reuse.md gates)

| Wave | Worker | Role | Mode | Tasks |
|------|--------|------|------|-------|
| 1 | W1 | pt-backend-eng | FRESH | T1: migrations (TipoEmpleado, D7 NOT NULL) + E1 backend transforms + contract update |
| 1 ∥ | W3 | pt-test-quality | FRESH | T4: hardening pack (jul4 origin fix, port-3001, D3 spec) — test-only, zero source-code overlap |
| 2 | W1 | pt-backend-eng | REUSE | T2: C1 endpoint + C4 lazy flip + C7 report · T3: C6 gating + usuario tipoEmpleado |
| 3 | W2 | pt-frontend-eng | FRESH | T5: fichas dialog rewrite (C1+C2) · T6: C3 shortcut + E1 frontend + tipoEmpleado field |
| 4 | W3 | pt-test-quality | REUSE | T7: jul10 specs (fichas flow, gating, uppercase, D7) + full regression + qa-report |

Reuse rationale: W1 API consumes its own migrations/contract (G1+G4 max). W3's wave-4 QA reuses its wave-1 context (it just repaired the test infra it will now run). W2 fresh — fichas dialog is `pacientes/[id]/index.vue`, no prior-worker context exists this session.
Shutdown: session-end sweep after convergence.

## Interface Contract (W1 → W2/W3)
W1 appends to `orchestration-ctx/decisions/schema-contract-jul10.md`:
- TipoEmpleado enum + Usuario field + where it's set (usuario create/update API)
- C1 endpoint: path, request body (instrumentoId, archivoCompletado, notas?, fechaVencimiento?), response, transaction semantics
- C4: which read paths flip; C7: endpoint + response shape
- E1: exact list of fields transformed
- D7: NOT NULL confirmed + Zod required

## Complexity budget
W1: wave1 8 · wave2 13 — OK. W2: T5 10 + T6 4 (sequential waves) — OK. W3: wave1 5 · wave4 9 — OK.

## Risks
- C1 dialog rewrite touches the most-patched file of the repo (`pacientes/[id]/index.vue` — ficha stash, drafts, VENCIDO recovery). W2 must preserve jul-8/jul-9 behaviors (sessionStorage draft, IDB stash row-scoped keys, VENCIDO→COMPLETADO renewal path).
- D7 NOT NULL: if playwright junk contratos have NULL cargoId, backfill maps them to that empresa's "Otro" cargo — verify count in migration output.
- E1 uppercase could break specs asserting mixed-case names — W3 wave-4 owns reconciling test fixtures (uppercase expected values), NOT loosening assertions.
