# Decision: G2 expanded — orchestrator deep re-architecture of templates (user directive, 2026-07-16)

## Directive (verbatim intent)
Once W1 creates the instrument templates, the ORCHESTRATOR (superior model) must revisit and
re-architect them with detailed analysis so the structure is well designed, flexible, and follows
every raw instrument's logic. Apply fixes if necessary. This is an explicit user authorization for
the orchestrator to edit these specific artifacts directly (exception to the no-implementation rule,
scoped ONLY to: contract doc, template JSONs, depurated specs).

## Expanded G2 protocol (runs at W1 COMPLETE, before unblocking #14/#16)
1. Standard validation: deliverables on disk, checker output, JSON parse.
2. **Deep review — per instrument, against RAW source (not just W1's specs)**:
   - Re-extract/verify item-by-item: every question, option, score present and correct
   - Verify section subtotals + max totals vs canonical (Barthel 100, MMSE 30, Tinetti 16+12=28,
     GDS-15 15, MNA 14+16=30) or documented EMKASA deviation
   - Verify result-evaluation ranges: gapless, non-overlapping, correct thresholds
   - Yesavage: per-item score direction correct (reverse-scored items 1,5,7,11,13 in GDS-15)
   - MNA: skipIf rule faithful (cribaje ≥ 12 → evaluación skippable); merge with Cuadro coherent
3. **Structure re-architecture pass**: is the definition format flexible enough for all 6 without
   special cases? IDs stable/semantic? types minimal but sufficient? scoring/conditional model
   generalizes? validation constraints expressible? i18n-safe (labels vs keys)?
4. Apply fixes DIRECTLY to: contract doc, `tasks/W1-extraction-contract/templates/*.v1.json`,
   and depurated specs if wrong. Log every fix in this file's §Fixes Applied.
5. Only then unblock wave 2; W2/W3 assignments cite the POST-review contract as authoritative.

## Fixes Applied (2026-07-17)

**Verification performed** (against RAW sources, not W1's specs): Cuadro de Alimentos PDF read
visually (7×4 table confirmed, W1's "no information loss" claim TRUE); MNA official Nestlé form
read visually from the docx-embedded JPEG (all A–R items, 0.5 scores, D={0,2}, thresholds
confirmed); Ficha Nutricional PDF read visually; Barthel xlsx, Tinetti/Yesavage/Mini-Mental docx
extractions cross-checked line-by-line (items, option scores, subtotals 16+12/30/15/100, ranges,
Yesavage reverse items 1,5,7,11,13, Tinetti 8a/8b + 11a–d splits — all faithful).

| # | Fix | Files touched |
|---|-----|---------------|
| G2-1 | Collapsed `boolean-scored` into `single-select-scored` (minimal set = 5 types; 2-option rendering decided by `options.length`) | MINI_MENTAL + YESAVAGE templates, all 6 specs, contract §2/§5.2, checker |
| G2-2 | **MNA skip-classification bug (critical)**: cribaje section now carries `subtotal.resultEvaluation` (12–14 normal / 8–11 riesgo / 0–7 malnutrición); classification-source rule added — skipped evaluación → classify by cribaje ranges. Without this, a skipped total of 12–14 hit the global 0–16.5 range = "Malnutrición" | MNA template, contract §1.2/§1.3, checker (new mandatory rule) |
| G2-3 | `skipIf` = MAY-skip semantics (optional continuation per official form); all-or-nothing answering of optional sections | contract §1.4/§5.3, MNA template instructions |
| G2-4 | `puntajeTotal Int?` → `Float?` (MNA 0.5-step totals, e.g. 23.5) | contract §3.3 |
| G2-5 | PENDIENTE assign flow restored: `respuestas` optional in POST; new `PATCH .../:fichaId/completar` | contract §4.3/§4.3b/§4.6 |
| G2-6 | FICHA_NUTRICIONAL: dropped `d1_fecha` + `anexo_soportes` (17→13 items) | template, spec, contract §7 |
| G2-7 | Missed raw field "OBSERVACIÓN IMPORTANTE A TENER EN CUENTA" → `notasObservaciones` mapping | contract §7 row 18, spec |
| G2-8 | rolesPermitidos corrected to real `RolUsuario` CSV convention (`ADMIN,EMPLEADO`); W1's names were invented | contract §6.3 |
| G2-9 | §5.4 label-matching rejection replaced by structural unknown-key rejection | contract §5.4 |
| G2-10 | Checker: types updated, `_check_ranges` reused for section-level ranges, skipIf-target-must-have-resultEvaluation rule, removed dead `cuadro_alimentos` hardcode | check_template.py |

**Post-fix validation**: `check_template.py` on all 6 templates → OK (no errors, no warnings);
`python3 -m json.tool` clean on all 6.

**Minor W1 protocol deviations noted (no action)**: helper scripts landed in
`development/instrumentos-dynamic-fichas/scripts/` instead of repo-root `scripts/`;
coverage-matrix.md + patient-field-exclusion.md as extra task-dir files instead of
progress-report sections.

## Status
EXECUTED — wave 2 unblocked against the post-review contract.
