# instrumentos-dynamic-fichas — implemented (2026-07-17)

grep hooks: instrumentos-dynamic-fichas dynamic-forms json-schema InstrumentoVersion respuestas puntajeTotal clasificacion skipIf resultEvaluation G2-11 G2-12 instrumentScoringService DynamicInstrumentForm instrument-templates instruments-upgrade MNA_CUADRO BARTHEL MINI_MENTAL TINETTI YESAVAGE FICHA_NUTRICIONAL hard-reset 20260717045038

## High-level overview
Breaking change: instrumentos are no longer files. Instrument definitions are versioned JSONB
documents in Postgres (`instrumentos_versiones`, immutable once referenced, one `activo` per
instrument via partial unique index). Fichas store `respuestas` JSONB + server-computed
`subtotales`/`puntajeTotal(Float)`/`clasificacion`. Frontend renders any definition dynamically
(`DynamicInstrumentForm.vue`, zero instrument-specific code); results shown in
`InstrumentResultView` (total + classification badge + per-section breakdown). 6 seeded
instruments from `context/instrumentos-raw` (depurated specs in `context/instrumentos-depurated/`):
Barthel(100), Mini-Mental(30), Tinetti(16+12=28), Yesavage GDS-15(15), MNA+Cuadro de Alimentos
merged(30, conditional), Ficha Nutricional (informational, no scoring). File flow
(plantillaArchivo/archivoCompletado) fully removed; estado machine, lazy VENCIDO flip, vencimientos,
requireInstrumentWriter preserved. Orchestrated via planify-team: 6 fresh workers, 3 waves + fix-up,
all deliverables independently validated; final 48/48 backend + 17/17 frontend dynamic suites,
4 legacy suites modernized to the new contract.

## Key decisions
- D1 seed-only versioned definitions; base templates `backend/prisma/instrument-templates/*.v1.json`;
  `npm run instruments:upgrade` upserts new versions, refuses mutating referenced versions (VERSION_LOCKED).
- D2 hard reset local dev (126 legacy ficha rows truncated; migration `20260717045038`; NO CASCADE —
  notas_clientes FK dropped/re-added + nullified, notes preserved 52→52; no hardcoded IDs → staging-safe).
- D3/D4 scoring model: sections + subtotals + ONE conditional shape `skipIf {sectionId, op, value}`;
  score-less item types allowed; minimal type set = 5 (`single-select-scored`, `number-info`,
  `text-info`, `single-select-info`, `group-info`) — boolean collapsed into 2-option select (G2-1).
- MNA fidelity (G2-2/G2-3, verified against the Nestlé form image embedded in the docx): cribaje
  carries its own `subtotal.resultEvaluation` (12–14 normal / 8–11 riesgo / 0–7 malnutrición);
  skipIf = MAY-skip (evaluación optional at cribaje ≥ 12); classification-source rule — skipped →
  classify by cribaje ranges, answered → global 0–30 (24–30 / 17–23.5 / 0–16.5, 0.5 steps → Float).
- G2-11: `instrumentoVersionId` server-resolved (client value ignored); G2-12: `versionRegistro`
  optional, server-derived `v{version}` (fixed HIGH UI bug class).
- API: `GET /instruments` (+activeVersion), `GET /instruments/:codigo/definition` (403 by
  rolesPermitidos CSV of RolUsuario values), `POST /patients/:id/fichas` (respuestas optional —
  absent = PENDIENTE assign kept), NEW `PATCH /patients/:id/fichas/:fichaId/completar`,
  `GET .../:fichaId` with scores. Backend recomputes everything; client scores never trusted.

## Issues resolved during implementation (from task reports)
- G2 orchestrator review of W1 extraction: 10 fixes (G2-1…G2-10) incl. the MNA skip-classification
  bug (skipped total 12–14 would have classified as "Malnutrición" under global ranges),
  puntajeTotal Int→Float, missed raw field "OBSERVACIÓN IMPORTANTE" → notasObservaciones,
  invented role names → RolUsuario CSV, restored PENDIENTE assign flow.
- G1 migration gate caught `TRUNCATE ... CASCADE` that would have wiped ALL patient notes.
- QA (W5) found 3 bugs, fixed by W6: BUG-W5-01 HIGH patient-page POST 400 (versionRegistro missing →
  solved via G2-12 server default), BUG-W5-02 result dialog required prior form-dialog open
  (dedicated resultDefinition fetch by codigo), BUG-W5-03 dead plantillaArchivo/versionPlantilla
  remnants. W5 also modernized legacy specs: ficha-single-step 2/2, jul11-date-normalization 4/4,
  patient-fichas rewritten 8/8, instruments 44/44.
- Test-env traps handled: PrimeVue RadioButton needs page.evaluate click in Playwright; sameSite=strict
  requires TEST_FRONTEND_URL=http://100.85.193.33:3100 + origin-aware auth helper; instrument list
  limit + activeVersion filtering against seed pollution.

## Not done / follow-ups
Staging release (gated, future cycle — hard reset would drop staging ficha rows, re-confirm);
pre-existing certificates filter 500 (unrelated); print CSS for result view.

## References
`development/instrumentos-dynamic-fichas/06-handoff.md` · contract:
`development/instrumentos-dynamic-fichas/orchestration-ctx/decisions/schema-contract-instrumentos-dynamic-fichas.md`
· specs: `context/instrumentos-depurated/*.md`

## Staging release jul-17 (appended 2026-07-17)
grep hooks: staging-release-jul17 d-XIPRCXIMK amplify-job-8 wipe-staging-s3 pre-reset-staging-20260717-101934 uploads-staging-jul17 B27-B33 OP-3-canonical-credentials

Deployed to staging via checkpoint-gated release (runbook `context/implementation-plan/staging-release-jul17-runbook.md`, 8 phases R0–R7, developer-approved with amendments A-1 backend-deploy-from-working-tree + A-2 S3 byte backup):
DB hard reset (21/21 migrations + canonical seed incl. 6 dynamic instruments; pre-reset dump `pre-resets/pre-reset-staging-20260717-101934.sql.gz`); uploads bucket wiped 47→0 (recoverable: byte backup `pre-releases/s3-objects/uploads-staging-jul17/` 47/68,824,703 + manifest); backend CodeDeploy `d-XIPRCXIMK` Succeeded; frontend Amplify job 8 SUCCEED; credential architecture intact; R7 QA 6/6 (BARTHEL 75 → "Dependencia moderada" e2e in browser; MNA skip + full paths verified live).
New utilities: `backend/infrastructure/scripts/wipe-staging-s3.sh` (destructive-action guard rails: staging-only regex, prod refuse, TTY + typed WIPE-STAGING-S3, dry-run default, manifest) and extended `reset-staging-db.sh` (FORCE_SEED canonical path).
Operator notes OP-1–OP-6 + issues B27–B33 in the runbook — HIGH: after any destructive reset use canonical seed credentials, not SSM QA values (B31/OP-3); future hardening: TTY-guard on reset-staging-db.sh (B32).
