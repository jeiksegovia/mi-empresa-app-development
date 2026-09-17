# task-assignment-wave2-api (W1, wave 2 — NEW-ASSIGNMENT, reused worker)

## Context you already have
You wrote the migrations and `orchestration-ctx/decisions/schema-contract-jul9.md` — implement the API exactly to that contract (§7 endpoint inventory is your spec). Team plan unchanged: `orchestration-ctx/team-plan-improvements-jul-9.md`.

## Task Type
IMPLEMENTATION

## Task IDs (work in this order)
- `10` — T2: certificados comprobantePagoUrl
- `11` — T3: notas fechaIncidente + businessDays util
- `12` — T4: cliente fields + empleado educación/documento CRUD
- `13` — T5: contrato archivoFirmado + CargoEmpresa CRUD
`TaskUpdate` each to in_progress/completed as you go.

## Scope per task

### T2 (#10) — certificados
- `backend/src/routes/certificates.routes.ts`: extend `addCertificateUpdateSchema` with `comprobantePagoUrl` (optional, 1..500)
- `backend/src/services/certificateService.ts`: passthrough in `addCertificateUpdate` (history row only — parent snapshot fields unchanged for comprobante unless contract says otherwise)
- Curl-verify: POST /certificates/:id/updates with comprobantePagoUrl → 201, field round-trips on GET /updates

### T3 (#11) — notas fechaIncidente
- NEW `backend/src/utils/businessDays.ts`: `isWeekday(d)`, `businessDaysBetween(from, to)` (weekday-only per L6, `TODO(holidays)` comment)
- Notas create route (find it — likely `patients.routes.ts` or a notas route): require `fechaIncidente` (date string), reject with `400 { success:false, message:'La fecha del incidente debe estar dentro de los últimos 2 días hábiles', field:'fechaIncidente' }` when future OR >2 business days back (L3 hard block)
- Curl-verify: today ✓, yesterday-if-weekday ✓, 5 days back ✗ 400, future ✗ 400. Use fixed dates in verification notes so results are reproducible.

### T4 (#12) — cliente + empleado
- Cliente routes/Zod: accept `fechaCumpleanos?`, `tipoSangre?` (enum, 8 values), `eps?` on create + update; return them on GET
- Empleado routes/Zod: accept `documentoIdentificacionUrl?`; make `nivelEscritura` optional in Zod (column now nullable)
- NEW CRUD: `GET/POST /empleados/:id/educacion`, `PUT/DELETE /empleados/:id/educacion/:eduId` per contract §3 — follow the service→route pattern (new `educacionService` or fold into existing empleado service per codebase convention; check first)
- Curl-verify each endpoint

### T5 (#13) — contrato + cargos
- Contrato routes/Zod: accept `archivoFirmadoUrl?` + `cargoId?` (number, FK) — reject legacy `cargo: string` (documented break)
- NEW: `GET /empresa/cargos?activo=true|false|all`, `POST /empresa/cargos {nombre}` (dedupe on unique → 409 or friendly 400), `PATCH /empresa/cargos/:id` (archive `activo:false`) per contract §4
- Curl-verify: list (8 seeded), create new, create duplicate → error with clear message, archive, contrato create with cargoId

## Constraints (unchanged from wave 1)
- Follow service→route + Zod-at-top patterns; structured 400 with `field` key where field-specific
- Never blanket-kill processes; tsx watch handles reloads
- No git commit; no staging/prod
- If any route file conflicts with what W2 is editing (frontend only — should be zero overlap), flag COMM-REQUEST instead of proceeding

## Deliverables
1. Source changes for T2–T5
2. Update `schema-contract-jul9.md` ONLY if implementation deviates from §7 (note deviations in §8)
3. `development/improvements-jul-9/tasks/W1-backend/result-wave2.md` — endpoints + curl verification outputs
4. `development/improvements-jul-9/tasks/W1-backend/completion-report.md` — UPDATE the existing file with a Wave 2 section

## Progress Reporting
Append to `development/improvements-jul-9/tasks/W1-backend/progress-report.md` (section per task).

## Acceptance Criteria
1. All 4 task curl-verification suites pass (documented with commands + outputs)
2. Zod rejections return structured errors (message + field where applicable)
3. Backend healthy on :3101 throughout
4. Contract §7 fully implemented or deviations documented in §8

## Reporting Protocol
Same as wave 1. On all done: `SendMessage(to: "main", "COMPLETE: API wave done (T2-T5). See tasks/W1-backend/result-wave2.md", summary: "W1 wave 2 complete")`. Then stay PARKED — QA wave may send fix-ups.
