# QA Session — Aug 17, 2026 — Cleaned Requirements

**Source raw**: `context/user-feedback/qa-feedbacl-aug-17.md`  
**Cleaned**: 2026-08-17  
**Context**: Follow-up after qa-aug-6 followup shipped to staging (`d-13RWC0Q4L` / Amplify job 15). Resume SSOT: `context/resume-session/summary-2026-08-17.md`.

> **Source note**: `/planify-team` was invoked with `/Users/jeik/fews/saw-planning-dashboard/development/pendo-design-tool/initial-ask.md`. That file is a **Pendo tagging brief for a different product** (design tool / WooCommerce). It is **not** used. Today's mi-empresa transcript is `qa-feedbacl-aug-17.md` (typo in filename kept). Confirm if this substitution is wrong.

> Filtering note: chit-chat, family-file upload, "pajarito", glasses, and already-accepted SIGNOS/BOLETIN v2 walkthrough are **not** new work — see §Confirmed / §Excluded.

---

## Requirements (mi-empresa-app only)

### R1 — Empleados list: default filter = Activos (tabs, not "Todos")
- **Problem**: List opens on **Todos**. User does not want inactivos in the default view; they must remain reachable.
- **Expected**:
  - Default filter = **Activos**.
  - User can switch to **Inactivos** (and optionally back to Todos — confirm Q2).
  - "No los quiero ver" = default hide, not delete/archive.
- **Where**: `frontend/app/pages/empleados/index.vue` — `estadoFilter` currently `ref('')` (Todos). Options already exist (`ACTIVO` / `INACTIVO` / `''`). API already accepts `?estado=`.
- **Roles**: ADMIN and CONTRATOS (same page).
- Raw refs: lines 2–12, 52 ("automáticamente se muestra en estados activos").

### R2 — CONTRATOS cannot GET cargos (403) while editing unlocked empleado  **[BUG]**
- **Problem**: On empleado **editar**, contrato form needs the cargos dropdown. `GET /empresa/cargos` returns **403** `DOMAIN_FORBIDDEN` for qa-contratos. Writes to cargos stay forbidden.
- **Root cause (mapped, not yet patched)**: `empresa.routes.ts` applies `router.use(requireDomain('empresa'))`. Matrix: `CONTRATOS.empresa = false` → **every** empresa route 403s, including GET `/cargos`. POST/PATCH/DELETE cargos already have `requireRole('ADMIN')`.
- **Expected** (user words): CONTRATOS, when the empleado is **unlocked**, can edit all empleado dimensions (datos personales, núcleo familiar, laboral, educación, certificados, contrato) **including reading** available cargos to assign a contract. Write on cargos catalog remains ADMIN-only.
- **Likely fix (confirm Q3)**: allow CONTRATOS **GET** on cargos only (narrow exception), not flip whole `empresa` domain to `true`.
- **Where**: `backend/src/middleware/domainAccess.ts`, `backend/src/routes/empresa.routes.ts`. FE already calls GET cargos; no FE change expected if GET succeeds.
- Raw refs: lines 15–17.

### R3 — Nómina registrar (FIJO / INDEFINIDO): add Bonos; Total ≠ Valor Mensual + Aportes  **[MAIN ITEM]**
- **Problem**: Dialog is `Valor Mensual → Subtotal → Aportes sociales → Total a pagar` where Total = subtotal + aportes. That **induces error**: aportes are paid to entities, never to the employee. "El que paga mal paga dos veces."
- **Expected field order**:
  1. Valor mensual (existing)
  2. **Bonos** (NEW — additional, persisted separately from valor mensual)
  3. Subtotal (= valor mensual + bonos)
  4. Aportes sociales (existing — **reference / accounting only**)
  5. Total a pagar (= **valor mensual + bonos only**; **do not add aportes**)
- **Persist**: bonos must be stored on the nómina period row (not folded into valor mensual or total). Aportes stay on the row as a peso referent for "cuánto pagamos a entidades", but they do **not** enter Total a pagar.
- **Legal note from user**: only salario / prima / intereses cesantías are paid to the employee; aportes never are.
- **Where**:
  - FE: `frontend/app/pages/nomina/index.vue` (`usaValorMensual` dialog)
  - BE: `nomina.routes.ts` Zod `nominaPeriodoSchema`, `nominaService.resolveCalcFields` (today: `total = (valorMensual ?? 0) + aportes`)
  - Schema: `NominaPeriodo` — new `bonos` Decimal nullable (same pattern as `aportesSociales`)
- **OBRA**: same valorMensual UI as FIJO/INDEF (jul-31 D1) but **no aportes**. Confirm whether **bonos** apply to OBRA (Q4).
- **OPS**: unchanged (medias × valor jornada). Confirm no bonos on OPS (Q4).
- Raw refs: lines 28–48.

### R4 — POST `/nomina/periodos` 400 on Término Fijo (valorJornada / medias not required)
- **Problem**: Paying / registering nómina for TERMINO_FIJO hits `POST /api/v1/nomina/periodos` **400**. User suspects the API still requires `valorJornada` / `mediasJornadas` (OPS fields).
- **Expected**: required fields **depend on tipoContrato**. FIJO / INDEFINIDO (and OBRA per jul-31): valor mensual (+ new bonos) — **not** valorJornada / mediasJornadas.
- **Mapped code (to verify in impl, do not assume)**:
  - Zod `nominaPeriodoSchema`: both fields already `.optional()`.
  - `resolveCalcFields` / create path still has jul-18 "valorJornada required on CREATE" comments — diagnose live 400 body.
  - **Also**: `POST/PUT /nomina/periodos` still `requireRole('ADMIN')`. If the tester was CONTRATOS, they would see **403**, not 400 — so the reported 400 is a **validation** issue, but CONTRATOS write on periodos may still be blocked (separate from this 400). Confirm Q5.
- Raw refs: line 52.

### R5 — SIGNOS_VITALES / BOLETIN_ANUAL without patient personal fields
- **Status**: **ALREADY SHIPPED** (qa-aug-6 followup, templates v2, staging smoke PASS). User re-walked the forms and said "este ya quedó como es. Perfecto." Periodo + nombre profesional stay on boletín (intentional "signature").
- **Action this cycle**: none unless a regression is found. Keep as verification-only.
- Raw refs: lines 54–58.

### R6 — Activity log for PROFESORES + AUXILIARES  **[NEW MODULE]**
- **What**: Daily (or occasional) **log de actividades** for **only** `PROFESORES` and `AUXILIARES` ("auxiliar de enfermería"). Other roles do not get this module.
- **Shape** (user: "muy sencillo"): **fecha + campo de texto**, related to the employee/user. No extra structure recalled.
- **Placement**: sub-module **parallel to asistencia** (daily-ish, optional cadence: daily / every 2–3 days). Used to **cross-check** asistencia: present+log = consistent; present+no log or absent+log = flag (reporting later — confirm Q6).
- **Write rule**: **today only** (same spirit as asistencia PUT). Backfill → email admin to justify (out of app for v1).
- **RBAC already true**: those tipos have `pacientes=read-only`, `notas=create-only`, `fichas=create-only`, `asistencia=false`. New domain or nest under asistencia — confirm Q7.
- **No QA users** yet for PROFESORES/AUXILIARES on staging (resume §9).
- Raw refs: lines 59–74.

---

## Confirmed working (no new work)
- SIGNOS = mediciones only; BOLETIN = periodo + components + autor name (v2).
- Contrato types OPS / OBRA / FIJO / INDEF on empleado edit (aside from cargos 403).
- Jul-31 valor mensual branch on registrar is the right starting point; this cycle **changes the total formula** and **adds bonos**.

## Excluded
- Pendo design-tool tagging (`initial-ask.md` in saw-planning-dashboard).
- Family-file upload chatter, jokes, bird, glasses.
- Operational "informe de actividades" Google-Drive / paid-storage aside (lines 59–62) — not an app ticket.
- Email-the-admin backfill workflow (process, not v1 UI).

## Needs decision (confirmation questions)
See intake `00-intake-qa-session-aug-17.md` Q1–Q8.
