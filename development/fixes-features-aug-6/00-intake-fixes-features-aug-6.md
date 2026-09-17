# Intake: fixes-features-aug-6

## Objective
Four work items on mi-empresa-app:
1. **New empleado roles PROFESORES + AUXILIARES** — general-purpose limited role. NO access to empleados/nomina/certificados. Limited pacientes: add notes + view basic paciente info + fill *allowed* instrumentos (e.g. Signos Vitales, Boletín Anual). Notes are private per author (save-only; can't view others' notes, can't edit/delete).
2. **Two new instrumentos** — Boletín Anual (yearly narrative report) + Signos Vitales (repeatable vitals table), extracted from the raw PDFs in `context/instrumentos-raw/`.
3. **Grant GERONTOLOGA read+write access to certificados empresariales** (legal requirement) — flip DOMAIN_ACCESS `certificados` cell + tests.
4. **Bug**: qa-gerontologa cannot create an instrument with a definition — after selecting a template (e.g. TINETTI) and creating, the instrument has no definition ("no instrument selected" / "no puede ser llenado").

## Assumptions
- Roles are new `TipoEmpleado` enum values (like GERONTOLOGA/CONTRATOS) with matrix rows in `domainAccess.ts` + frontend mirror `useDomainAccess.ts`.
- The 2 instruments are **non-scored / informational** (text-info + group-info), like FICHA_NUTRICIONAL/VALORACION_INTEGRAL. Applied via `instruments:upgrade` (versioned templates), not migration.
- Notes privacy for the new roles is best done via **RBAC filtering by `autor`** + blocking PUT/DELETE, not a schema change (no "own-author" VisibilidadNota value exists).
- Certificados-for-gerontologa = matrix cell flip (`false`→`true`) in BOTH mirrors + updated RBAC tests.

## PDF field extraction (draft — to confirm)
**Signos Vitales**: header {tipoDocumento, nombreCompleto, edad, sexo(F/M)} + repeatable group "medición" rows {fecha/hora, o2, presionArterial(P/A), fc, fr, temperatura, observaciones}. Non-scored.
**Boletín Anual (Informe del Usuario)**: header {tipoDocumento, numeroDocumento, nombreApellido, periodoAño, edad, sexo} + free-text components {psicologia, deporte, terapiaOcupacional, fisioterapia, componenteSocial, conceptoEnfermeria}, each optionally with an author name. Non-scored.

## Open Questions (confirm before Phase 1)
- [confirm-with-user] PROFESORES vs AUXILIARES — two distinct enum values with identical access, or different? (Q1)
- [confirm-with-user] How to gate which instrumentos a role may fill — schema field on Instrumento vs codigo allowlist? Is {Signos Vitales, Boletín Anual} exhaustive or extensible? (Q2)
- [confirm-with-user] Notes privacy — RBAC filter by autor (no schema change) vs new visibility value; who else sees these notes (admin/gerontologa)? (Q3)
- [confirm-with-user] Confirm the extracted instrument fields + that both are informational; Signos Vitales as a dynamic repeatable table. (Q4)

## Known Constraints
- Follow contract-first + existing patterns (domainAccess matrix mirrored FE/BE; instruments versioned via templates + instruments:upgrade; Playwright tests).
- Minimal DB impact. No prod. Additive migrations only.

## Input Source
Task description (this /planify-team invocation) + PDFs `context/instrumentos-raw/{SIGNOS VITALES,BOLETIN ANUAL USUARIOS}_*.pdf`.
