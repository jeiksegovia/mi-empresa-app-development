# W2 Progress Report — instrumentos-dynamic-fichas

> Worker: W2 (data-schema). Date: 2026-07-16.

## Status

- [x] Read assignment + contract §1-§7 (§3.1, §3.2, §3.3, §3.4, §6, §1.7 G2-1..10)
- [x] Inspected existing `backend/prisma/schema.prisma` (current `Instrumento`, `RegistroFichaCompletada`)
- [x] Inspected existing `backend/prisma/seed.ts` (instrumentos seeded as 3 placeholder rows: FVM-001, NUT-001, ADM-001)
- [x] G1 evidence collection — `psql` counts: `instrumentos=81`, `registros_fichas_completadas=126` (PENDIENTE=49, COMPLETADO=48, VENCIDO=29)
- [x] **PLAN-APPROVAL sent** to team-lead — awaiting approval for destructive migration step
- [x] Non-destructive file work begun (templates copied, upgrade script written, smoke spec written)
- [ ] Destructive migration apply (BLOCKED on PLAN-APPROVAL)
- [ ] Idempotent seed extension (ready to apply after migration)
- [ ] Acceptance criteria #1-5 verification

## Files written so far

| File | Purpose | Status |
|---|---|---|
| `backend/prisma/instrument-templates/*.v1.json` (6 files) | Verbatim copy from W1 dir | OK (all 6 pass W1 checker; section counts BARTHEL=1, MINI_MENTAL=11, TINETTI=2, YESAVAGE=1, MNA_CUADRO=3, FICHA_NUTRICIONAL=4) |
| `backend/scripts/instruments-upgrade.ts` | Apply template JSON changes to DB (D1) | Written, ready to run after migration |
| `backend/tests/instruments-dynamic/seed-definitions.spec.ts` | Smoke spec — 6 codigos + active v1 + section counts + partial unique index | Written, ready to run after seed |
| `backend/prisma/seed.ts` | Added dynamic-instrument upsert block (idempotent), removed dropped-column refs from legacy 3 rows | Ready to run after migration |
| `backend/package.json` | Added `"instruments:upgrade": "tsx scripts/instruments-upgrade.ts"` | Done |
| `development/.../tasks/W2-schema-seed/proposed-plan.md` | G1 evidence + migration plan + rollback note | Sent to team-lead |

## Pending — awaiting G1 approval

1. Edit `backend/prisma/schema.prisma`:
   - Drop `plantillaArchivo` + `versionPlantilla` from `Instrumento` (§3.2)
   - Drop `archivoCompletado` from `RegistroFichaCompletada` (§3.3)
   - Add `InstrumentoVersion` model (§3.1) with `@@unique([instrumentoId, version])`
   - Add new relation `versiones InstrumentoVersion[]` on `Instrumento`
   - Add `InstrumentoVersionCreador` relation on `Usuario`
   - Add to `RegistroFichaCompletada`: `instrumentoVersionId` FK, `respuestas Json?`, `puntajeTotal Float?`, `subtotales Json?`, `clasificacion String? @db.VarChar(100)`, and `instrumentoVersion InstrumentoVersion?` relation
2. Run `npx prisma migrate dev --name instrumentos_dynamic_fichas` from `backend/`
3. Manually prepend `TRUNCATE TABLE registros_fichas_completadas RESTART IDENTITY CASCADE;` to the migration SQL
4. Verify partial unique index is present in generated SQL
5. Run `npx prisma generate`
6. Extend `backend/prisma/seed.ts` to upsert the 6 instruments + 6 active v1 versions (idempotent)
7. Run `npm run db:seed` → 6 instruments + 6 active v1 versions
8. Run smoke spec → `npx playwright test tests/instruments-dynamic/seed-definitions.spec.ts` → all green
9. Run `npm run instruments:upgrade` → expect "skip" log for all 6 (idempotency)
10. Mutation test: bump one template `version` → rerun upgrade → expect `insert` + activo flip
11. Lock test: mutate referenced v1 template content → rerun upgrade → expect `VERSION_LOCKED`, non-zero exit
12. Write `completion-report.md` with verbatim command + output for each acceptance criterion

## Decisions / Deviations

None yet. All contract §3 names will be matched verbatim; the partial unique index, `@@unique([instrumentoId, version])`, and `Float?` puntajeTotal type are followed per the contract.

## Communication log

- 2026-07-16: PLAN-APPROVAL sent to team-lead (destructive migration ready). Awaiting response.