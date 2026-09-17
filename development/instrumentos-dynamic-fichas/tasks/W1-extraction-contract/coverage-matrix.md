# Item-Type Coverage Matrix (Task #12 — T2 output)

## Final item-type set (6 types — minimal, evidence-justified)

| # | Type | Items covered | Justification (≥1 item that no other type covers) |
|---|---|---|---|
| 1 | `boolean-scored` | 45 | Justified by Mini-Mental (30 yes-correcto / no-incorrecto per ítem) — a 2-option radio scored with 1/0. Cannot be `single-select-scored` because that's an N-option select; both options carry distinct scores. |
| 2 | `single-select-scored` | 47 | Justified by Barthel (10 ítems with 2–4 options each, per-option scores 0/5/10/15) and Tinetti (19 ítems with 2–3 options). The general "pick-one-with-score" item. Cannot fold into `boolean-scored` because most ítems have 3–4 mutually exclusive options with distinct scores. |
| 3 | `number-info` | 5 | Justified by MNA F1/F2 (peso kg, talla cm as numeric inputs) and Ficha Nutricional D2/D3/D4 (peso, talla, IMC). Cannot be `text-info` because the renderer needs a numeric input with optional min/max validation. |
| 4 | `text-info` | 11 | Justified by Ficha Nutricional P1/P2/P3 (ENFERMEDADES, ALERGIAS, MEDICAMENTOSAS — long free-text fields). Cannot be `single-select-info` because the answers are open vocabulary, not a fixed dropdown. |
| 5 | `single-select-info` | 3 | Justified by Ficha Nutricional P4/P5/P6 (DIABETES/HTA/CÁNCER as Sí/No, **without score**). Could be `boolean-scored` with score=0 on both, but that would clutter the scoring engine with meaningless zeros; the `*-info` family explicitly carries no score. |
| 6 | `group-info` | 1 | Justified by MNA Cuadro de Alimentos (7 filas × 4 columnas — tabla de frecuencias). The renderer needs a "table of related rows" primitive; folding into 7 `single-select-info` items would lose the table layout fidelity with the source ficha. |

**Total items across 6 instruments**: 45 + 47 + 5 + 11 + 3 + 1 = **112 items**.

## Why a `compound-scored` type was rejected

The MNA "K" ítem (Consume el paciente: 3 sí/no sub-ítems → score 0/0.5/1.0/1.0) was the only candidate for a `compound-scored` type that aggregates sub-ítems. **Decision**: encode K as `single-select-scored` with 4 options (0/1/2/3 síes → 0/0.5/1.0/1.0) and keep the 3 sub-enunciados as text intro above the select. This:

- Adds **zero** new types.
- Matches the 6-type minimal set (boolean-scored, single-select-scored, number-info, text-info, single-select-info, group-info) bounded by the feature plan §1.
- The cost: the evaluator counts the 3 sí/no sub-enunciados manually and selects the option. The source ficha has exactly this UX (the 3 questions are listed, then a single score box).

Documented in MNA spec §"Notas de extracción" for downstream visibility.

## Why a `date-info` type was rejected

Ficha Nutricional D1 ("Fecha") is the only candidate. **Decision**: encode D1 as `text-info` with `placeholder` showing the format hint (DD/MM/AA). The frontend can still render a datepicker that writes to a string field; the scoring engine treats it as opaque text. No new type.

## Coverage matrix (instrument × item-type)

Counts of items per instrument by item type.

| Instrument \ Type | `boolean-scored` | `single-select-scored` | `number-info` | `text-info` | `single-select-info` | `group-info` | Total |
|---|---|---|---|---|---|---|---|
| BARTHEL | 0 | 10 | 0 | 0 | 0 | 0 | **10** |
| MINI_MENTAL | 30 | 0 | 0 | 0 | 0 | 0 | **30** |
| TINETTI | 0 | 20 | 0 | 0 | 0 | 0 | **20** |
| YESAVAGE | 15 | 0 | 0 | 0 | 0 | 0 | **15** |
| MNA_CUADRO | 0 | 18 | 2 | 0 | 0 | 1 | **21** |
| FICHA_NUTRICIONAL | 0 | 0 | 3 | 11 | 3 | 0 | **17** |
| **TOTAL** | **45** | **48** | **5** | **11** | **3** | **1** | **113** |

## Item-type → PrimeVue component suggestion

| Type | PrimeVue component | Notes |
|---|---|---|
| `boolean-scored` | `RadioButton` group (2 options) | Score attached per option |
| `single-select-scored` | `RadioButton` group or `SelectButton` | N options, score per option |
| `number-info` | `InputNumber` | min/max from `constraints`, no score |
| `text-info` | `Textarea` (long) or `InputText` (short) | Decision by length heuristic in renderer |
| `single-select-info` | `RadioButton` group or `Dropdown` | No score |
| `group-info` | `DataTable` with one `Select` column per row | Rows = `single-select-info` per row |

Frontend may deviate via the contract deviations table — these are suggestions, not requirements.

## Per-instrument item-type composition

| Instrument | Scored items | Info items | Max scoring total |
|---|---|---|---|
| BARTHEL | 10 (`single-select-scored`) | 0 | 100 |
| MINI_MENTAL | 30 (`boolean-scored`) | 0 | 30 |
| TINETTI | 19 (`single-select-scored`) | 0 | 28 (16 + 12) |
| YESAVAGE | 15 (`boolean-scored`) | 0 | 15 |
| MNA_CUADRO | 18 (`single-select-scored`) | 3 (2 `number-info` + 1 `group-info`) | 30 (14 + 16, with 0.5 fracciones) |
| FICHA_NUTRICIONAL | 0 | 17 (11 `text-info` + 3 `number-info` + 3 `single-select-info`) | **n/a** (sin scoring) |
| **TOTAL** | **82** | **20** | n/a |
