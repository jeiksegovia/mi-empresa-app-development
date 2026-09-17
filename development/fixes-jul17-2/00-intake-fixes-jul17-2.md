# Intake: fixes-jul17-2

## Objective
Post-release follow-up cycle (staging shipped jul-17). Three work areas:

1. **QA seeding + role-aware QA users (RBAC refinement)** — evolve `seed-qa-staging.sh`/`seed-qa.ts`
   from one ADMIN QA user to THREE role-profiled users, each with own SSM SecureString creds under
   `/miempresa/staging/qa/<name>/{EMAIL,PASSWORD}`:
   - `qa-admin` — full admin access
   - `qa-gerontologa` — pacientes CRUD + instrumentos + fichas/evaluaciones; NO nómina, NO
     empleados, NO empresa, NO certificados-empresa
   - `qa-contratos` — empleados, nómina, certificados, create pacientes; NO fichas & evaluaciones,
     NO instrumentos (view or access)
   Evaluate whether role changes are required at DB level (prisma.schema), helper scripts, and QA
   unit tests (user directive). `get-qa-creds.sh` must list all three.
2. **Staging deployment seeding instructions (manual-step decision)** — runbooks + reset-staging-db.sh
   document a MANDATORY "run seed-qa-staging.sh (idempotent)" step on every staging deploy/reset.
   No after-install automation, no IAM changes (developer chose documented-manual).
3. **Instrumentos UX/backend**:
   a. `instrumentos/crear` (+ related component/backend): select an "instrumento type" = one of the
      6 template definitions; the created instrument COPIES the chosen template as its own v1
      definition (name/periodicidad/roles editable; items/scores fixed) → immediately fillable +
      scorable. (D1 no-builder stays locked.)
   b. Instrumento details: expandable AUDIT VIEW (every section/item/option WITH scores, subtotal
      maxima, result-evaluation ranges, skip rule) + "Probar sin guardar" interactive DRY-RUN with
      live scoring (not persisted) — so the gerontóloga can validate items/scores/logic.

## Assumptions
- Current auth: `RolUsuario {ADMIN, EMPLEADO, AUDITOR, OPERADOR}` + `TipoEmpleado {GERONTOLOGA}`
  (sub-role of EMPLEADO); `requireInstrumentWriter` = ADMIN bypass or gerontóloga EMPLEADO.
- The qa-contratos profile has NO existing representation → likely additive enum value
  `TipoEmpleado.CONTRATOS` + domain-access guards (backend) + nav/route gating (frontend).
- Non-QA existing users must not regress: `tipoEmpleado = null` EMPLEADO keeps today's access;
  restrictions apply only when a restricted tipoEmpleado is set. (Confirm in requirements.)
- Dynamic-fichas contract (post G2-12) remains authoritative for instrument/definition shapes;
  crear-from-template extends it (new §: create-with-template API + copy semantics).
- Dry-run can reuse `DynamicInstrumentForm` + `scoring.ts` optimistic engine (client-side, marked
  "vista previa — no oficial") or call a non-persisting server compute; decide in plan.
- All work local-first; staging deploy of this cycle is a later gated release.

## Open Questions
- [resolved-by-plan] Enum vs permission-table for the contratos profile → additive enum value is
  the minimal pattern-consistent choice; permission tables are out of scope.
- [resolved-by-plan] Exact route→domain access matrix (drafted in plan; workers verify against real
  route inventory and file deviations).

## Known Constraints
- Fresh workers per wave (user directive; no parked reuse). Max 2 concurrent.
- Schema change (enum) = migration → plan-approval gate (additive, non-destructive).
- No git commits. Tests mandatory (backend/frontend Playwright per project rules).
- SSM writes limited to `/miempresa/staging/qa/*` (staging namespace only; no prod).

## Input Source
User message "Additional fixes jul 17-2" + AskUserQuestion answers (3-users profile definition,
crear-from-template, audit+dry-run, documented-manual deploy step) 2026-07-17.
