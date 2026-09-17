# Handoff: instrumentos-dynamic-fichas (2026-07-17)

Feature complete on LOCAL dev, all waves validated. Staging deploy is NOT part of this cycle.

## What each worker delivered (all independently validated by orchestrator, all SHUTDOWN)

| Worker | Deliverables |
|---|---|
| W1 research-arch | 6 depurated specs (`context/instrumentos-depurated/`), schema contract, 6 base template JSONs. G2 orchestrator review applied 10 fixes on top (critical: MNA skip-classification, Float totals, may-skip, 5-type collapse) |
| W2 data-schema | Migration `20260717045038_instrumentos_dynamic_fichas` (InstrumentoVersion + JSONB ficha columns + partial unique activo index + D2 hard reset WITHOUT cascade — notas preserved 52→52), `backend/prisma/instrument-templates/*.v1.json`, seed (6 instruments + active v1), `npm run instruments:upgrade` (skip/insert/VERSION_LOCKED) |
| W3 frontend-eng | `frontend/app/components/instrument/` (DynamicInstrumentForm + Section/ItemField/GroupInfoField + InstrumentResultView + scoring.ts/types.ts), `/dev/instrument-preview` route, patient-page fill flow, file-UI removal, schema↔render + fill-flow specs |
| W4 backend-eng | `instrumentScoringService.ts` (pure engine), evolved `POST /patients/:id/fichas` (respuestas optional), NEW `GET /instruments/:codigo/definition` + `PATCH .../:fichaId/completar` + `GET .../:fichaId`, file-flow removal, 26 scoring + 9 API specs. G2-11 (server-resolved version) |
| W5 test-quality | qa-contract spec (G2-11, 403, boundary sweeps), browser E2E (4 instruments, both MNA paths), real-backend fill-flow, 4 legacy specs modernized to the new contract, gap report (3 BUGs) |
| W6 fullstack-impl | Fixed BUG-W5-01/02/03 + G2-12 (versionRegistro optional, server-derived `v{n}`), removed QA test workarounds so specs drive real UI paths |

## Final test state (independently re-run at convergence)
- `backend/tests/instruments-dynamic/` **48/48** (scoring 26, api-fichas 9, qa-contract 9, seed 4)
- `frontend/tests/instruments-dynamic/` **17/17** (schema-render 7, e2e 6, fill-flow 4 incl. real-UI path)
- Modernized legacy: ficha-single-step 2/2, jul11-date-normalization 4/4, patient-fichas 8/8, instruments 44/44
- Known pre-existing, unrelated, untouched: `certificates.spec.ts:108` (GET filter 500) + 4 fixture-chain skips in instruments.spec.ts

## Run / verify
```bash
cd backend  && TEST_API_URL=http://localhost:3101 npx playwright test tests/instruments-dynamic/
cd frontend && TEST_FRONTEND_URL=http://100.85.193.33:3100 TEST_API_URL=http://100.85.193.33:3101/api/v1 \
               npx playwright test tests/instruments-dynamic/
npm run db:seed              # idempotent; 6 instruments + active v1
npm run instruments:upgrade  # no-op unless a template version bumped; refuses VERSION_LOCKED
```

## Authoritative references
- Contract (post G2-12): `orchestration-ctx/decisions/schema-contract-instrumentos-dynamic-fichas.md`
- Decisions: intake D1–D4, `g2-orchestrator-template-rearchitecture.md` (G2-1…G2-10), `g1-migration-approval.md`, G2-11/G2-12 in contract §4.3
- Gap report (all closed except noted pre-existing): `tasks/W5-qa-validation/gap-report.md`

## Deferred / follow-ups
1. **Staging release** — future gated cycle: replay migration (hard reset applies to staging ficha rows — re-confirm with user), deploy backend+frontend per existing runbooks, run `frontend/tests/staging` canary. Migration has no hardcoded IDs.
2. Pre-existing certificates filter 500 (TEST-ENV-W5-01) — separate ticket.
3. Print CSS for InstrumentResultView (structure is print-ready).
4. Legacy `records/by-instrument` endpoint kept as-is; instrument crear/editar pages still manage legacy metadata fields only.
5. `TipoInstrumento` enum unchanged (MNA_CUADRO + FICHA_NUTRICIONAL = NUTRICION); revisit only if finer classification needed.
