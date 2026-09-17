# W2 Frontend Wave — Progress Report

**Worker:** W2 (pt-frontend-eng) · **Tasks:** 29 (T5), 30 (T6) · **Date:** 2026-07-10

Grep keys: `W2 progress jul10 single-step ficha C1 C2 C3 E1 uppercase tipoEmpleado`

---

## Timeline

1. **Read context** — task assignment, contract §4/§5, qa-session §3.1–3.3/§5.1,
   and the full `pacientes/[id]/index.vue` (most-patched file) before editing.
   Mapped jul-8/jul-9 behaviors that must survive (sessionStorage draft, IDB
   `useFileStash` row-scoped keys, VENCIDO renewal, title-guard).
2. **Recon** — confirmed the list endpoint returns `versionPlantilla` but not
   `plantillaArchivo` → decision: fetch `GET /instruments/:id` on select.
   Identified jul-8/jul-9 spec selectors (all renewal-dialog: `#newEstado`,
   `#notasObservaciones`, `ficha-file-input`, `pi-pencil`) → confirmed the
   renewal dialog must stay untouched. Confirmed no usuarios UI exists.
3. **T5 (#29)** — added Instrument interface fields; single-step state +
   handlers (`onInstrumentSelected`, `openSingleStepDialog`,
   `onSingleStepFileSelected`, `downloadPlantillaRenamed`, `handleSingleStepSubmit`);
   replaced assign card (removed the button, select `@change` opens dialog with
   create-shortcut option); added the `ficha-single-step-dialog` template. Kept
   the B6 renewal dialog byte-for-byte.
4. **T6 (#30)** — `crear.vue` return-param handling; E1 uppercase on 8 files via
   `:model-value` + `@update:model-value` (no composable added); tipoEmpleado
   → documented API-only.
5. **Verification** — logged in via the same-IP host (cookie fix), browser-tested
   all 7 acceptance criteria on patient 85; ran jul-8/jul-9 regression (6 pass /
   2 skip); wrote + ran a new jul10 spec (3 pass); updated the obsolete e2e test.

---

## Status per task

| Task | State | Notes |
|---|---|---|
| #29 T5 | ✅ completed | single-step dialog + descargar plantilla, browser-verified |
| #30 T6 | ✅ completed | C3 + E1 (8 files) + tipoEmpleado API-only, browser-verified |

## Blockers encountered / resolved
- **Auth cookie cross-site (SameSite=Strict, external-IP apiBase):** browser at
  `localhost:3100` got 401s. Resolved for verification by loading the frontend
  from the same host as the API (`100.85.193.33:3100`) — matches the local-qa
  specs' documented env vars. No config touched.
- **None outstanding.**

## Next
PARKED for QA fix-ups (W3 / T7 #31).
