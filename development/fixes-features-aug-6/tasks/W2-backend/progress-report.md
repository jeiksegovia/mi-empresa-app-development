# W2 progress report — fixes-features-aug-6

## Context
- Role: pt-backend-eng (worker-2)
- Cycle: 4-item wave (S1 new roles PROFESORES/AUXILIARES · S2 2 new instruments · S3 GERONTOLOGA certificados · S4 gerontologa-create bug)
- Local backend: `:3101` (tsx watch). DB: `:15432` (docker).
- Contract: `development/fixes-features-aug-6/orchestration-ctx/decisions/contract-fixes-features-aug-6.md` is authoritative — do not re-read schema.prisma for facts.

## Plan
- T4 (id 4): domainAccess.ts — `read-only` value + branch; PROFESORES + AUXILIARES rows; GERONTOLOGA certificados true; MATRIX_TIPOS = 4-value allow-list.
- T5 (id 5): REPRODUCE gerontologa bug locally (login qa-gerontologa, POST /instruments with TINETTI, capture failures) → fix actual root cause (definition/version attachment + rolesPermitidos intersection) → harden rolesPermitidos per contract §3.
- T6 (id 6): Notes privacy — add `GET /patients/:id/notes` LIST endpoint with autor filter for PROFESORES/AUXILIARES; add PUT/DELETE that 403 for new roles.
- T7 (id 7): Backend Playwright specs covering all of the above + 2 new instruments upgrade.

## Subtask log

### T4 — RBAC matrix (DONE)
- `backend/src/middleware/domainAccess.ts`:
  - Extend `DomainAccessValue = boolean | 'create-only' | 'read-only'`.
  - Add `MATRIX_TIPOS` allow-list (GERONTOLOGA, CONTRATOS, PROFESORES, AUXILIARES).
  - Add PROFESORES + AUXILIARES rows to DOMAIN_ACCESS (identical, per contract §2.2).
  - Flip GERONTOLOGA certificados false → true.
  - Add `'read-only'` branch in `requireDomain()`: GET allowed, any other method → 403 DOMAIN_FORBIDDEN with identical envelope to create-only 403.

### T5 — Gerontologa bug REPRO + ROOT CAUSE (in_progress)
- **Reproduction attempts on local :3101 against :15432:**
  - qa-gerontologa-rbac@miempresa.local login OK (rol=EMPLEADO, tipoEmpleado=GERONTOLOGA).
  - **Repro A (the contract's claim):** POST /instruments with `templateCodigo:'TINETTI'` + codigo → 201 + activeVersion.id=81 attached. GET /instruments/TINETTI_GERONTO_REPRO_1785988860/definition → **200** (not 403). GET seeded /instruments/{SIGNOS_VITALES,BOLETIN_ANUAL,BARTHEL,TINETTI,MINI_MENTAL,YESAVAGE}/definition → **all 200**.
- **TRUE root cause (revised):** The contract §3.1 hypothesis is **incorrect for the current seed**. The caller CSV `[EMPLEADO,GERONTOLOGA]` **does intersect** `[ADMIN,EMPLEADO]` on the `EMPLEADO` token — so GET definition passes today. The contract's bug as stated doesn't reproduce on local. The "instrument created WITHOUT definition / 'no instrument selected'" symptom in the user's report is more likely:
  - (a) a frontend issue (FE creating from template without `codigo` → definition.codigo=null → FE can't fetch by codigo), OR
  - (b) the FUTURE state where the new 2 instruments have `rolesPermitidos: ADMIN,GERONTOLOGA,PROFESORES,AUXILIARES` and a plain (null-tipoEmpleado) EMPLEADO cannot read them — by design.
- **However**, the contract §3.2 hardening is still the right thing to ship:
  1. Explicit ADMIN bypass in `getInstrumentDefinition` (defense-in-depth).
  2. Recognize PROFESORES/AUXILIARES tokens in CSV matching.
  3. Default `rolesPermitidos` on instrument create must include creator's tokens so a non-ADMIN creator can immediately fill.
  4. `instruments-upgrade.ts` must read `rolesPermitidos` from template top-level (so the 2 new templates get the correct CSV at insert).
- **Next:** implement §3.2 hardening in `instrumentService.ts` + extend `instruments-upgrade.ts` to honor template top-level `rolesPermitidos`.

