# W1 Progress Report — Extraction Contract

## Subtask 1 (T1.1) — Barthel extraction ✅

**Source**: `context/instrumentos-raw/INSTRUMENTO DE BARTHEL.xlsx` (53 rows, 11 cols)
**Method**: openpyxl → plain text dump to `sources/barthel.txt`

**Extracted 10 scored items, 3-option (n=7) or 4-option (n=2)**:
- Comida (3 options: 10/5/0)
- Lavado de manos (2 options: 5/0)
- Vestido (3 options: 10/5/0)
- Arreglo personal (2 options: 5/0)
- Deposición (3 options: 10/5/0)
- Micción (3 options: 10/5/0)
- Ir al retrete (3 options: 10/5/0)
- Transferencia (4 options: 15/10/5/0)
- Deambulación (4 options: 15/10/5/0)
- Subir/bajar desniveles (3 options: 10/5/0)

**Max total**: 100 ✓ canonical
**Excluded fields**: NOMBRE, C.C., FIRMA DEL EVALUADOR, ASISTIDO/A | VÁLIDO/A, Puntuación Total
**Deviation noted**: classification has EMKASA overlap "60-80" + "80-100"; resolved to gapless:
Severa (0-44), Grave (45-59), Moderada (60-79), Ligera (80-100)

## Subtask 1 (T1.2) — Mini Mental extraction ✅

**Source**: `context/instrumentos-raw/INSTRUMENTO MINI MENTAL EMKASA.docx` (4.4MB)
**Method**: python-docx → table-aware extraction to `sources/mini-mental.txt`

**Extracted 11 sections (10 scored + 1 reference)** with per-item yes/no scoring:
- Orientación en el tiempo (5 items, max 5)
- Orientación en el espacio (5 items, max 5)
- Memoria (3 items, max 3)
- Atención y cálculo (5 items, max 5)
- Memoria diferida (3 items, max 3)
- Denominación (2 items, max 2)
- Repetición de una frase (1 item, max 1)
- Comprensión - ejecución de orden (3 items, max 3)
- Lectura (1 item, max 1)
- Escritura (1 item, max 1)
- Copia de un dibujo (1 item, max 1)
Total = 30 ✓ canonical

**Excluded fields**: Nombre del Abuelo, c.c., Edad (Años/Meses), Jornada de Atención, Fecha de aplicación, Aplicado por

**Deviation noted**: source classification table only goes down to 9-11 ("Demencia"), no row for 0-8. Gapless resolution adds "Deterioro severo" (0-8).

## Subtask 1 (T1.3) — Tinetti extraction ✅

**Source**: `context/instrumentos-raw/INSTRUMENTO TINETTI EMKASA.docx` (50KB)
**Method**: python-docx → `sources/tinetti.txt`

**2 sections, 9 + 7 = 16 items total**:
- Equilibrio (max 16) — items 1-9: Equilibrio sentado, Levantarse, Intentos para levantarse, Equilibrio bipedestación inmediata, Equilibrio bipedestación, Empujar, Ojos cerrados, Vuelta 360°, Sentarse
- Marcha (max 12) — items 10-16: Iniciación, Longitud-altura paso (4 subitems: derecho/izquierdo × sobrepasa/separa), Simetría, Fluidez, Trayectoria, Tronco, Postura

Total = 28 ✓ canonical

**Excluded**: Nombre, Edad, Sexo, Fecha de evaluación, Evaluador

**Classification**: 25-28 bajo, 19-24 moderado, 0-18 alto riesgo de caídas
(note: source OCR had "celdas" — corrected to "caídas" as canonical)

## Subtask 1 (T1.4) — Yesavage extraction ✅

**Source**: `context/instrumentos-raw/INSTRUMENTO YESAVAGE EMKASA.docx` (4.2MB)
**Method**: python-docx → `sources/yesavage.txt`

**15 items, all boolean-scored with direction-sensitive scoring**:
Each item has 2 options (SI/NO). Per-item scores: the depression-direction answer = 1 pt, opposite = 0.

Items 1, 5, 7, 11, 13: NO=1, SI=0
Items 2, 3, 4, 6, 8, 9, 10, 12, 14, 15: SI=1, NO=0

Total max = 15 ✓ canonical GDS-15
Classification: 0-5 No depresión, 6-9 Probable depresión, 10-15 Depresión establecida ✓ gapless

**Excluded**: Nombre, C.C., Nombre de la Unidad de Atención, Edad (Años/Meses), Fecha de aplicación, Aplicado por

## Subtask 1 (T1.5) — MNA + Cuadro de Alimentos extraction ✅

**Source**: `context/instrumentos-raw/INSTRUMENTO NUTRICIONAL MNA.docx` (900KB) + `CUADRO DE ALIMENTOS.pdf` (220KB)
**Method**: docx contained mostly embedded JPEG — confirmed textutil/python-docx failure (only "FIRMA DEL EVALUADOR:" extracted). Extracted image1.jpg via zipfile, ran tesseract (eng, no spa tessdata) on `/tmp/mna_img1.jpg` → `sources/mna-ocr.txt`. Cuadro de Alimentos PDF text-extracted via pypdf successfully (table header + 7 food groups).

**18 scored items (6 screening + 12 evaluation)** + 1 informational Cuadro section

Screening (Cribaje, max 14):
- A: Pérdida apetito 3m (0/1/2)
- B: Pérdida peso <3m (0/1/2/3)
- C: Movilidad (0/1/2)
- D: Enfermedad aguda 3m (0=si/2=no)
- E: Problemas neuropsicológicos (0/1/2)
- F: IMC (0/1/2/3)

Evaluation (Evaluación, max 16):
- G: Vive independiente (1/0)
- H: +3 medicamentos/día (0/1)
- I: Úlceras/lesiones cutáneas (0/1)
- J: Comidas completas/día (0/1/2)
- K: Consume (3 sí/no subitems → 0/0.5/1.0/1.0) ← `compound-scored`
- L: Frutas/verduras 2+/día (0/1)
- M: Vasos líquido/día (0.0/0.5/1.0)
- N: Forma de alimentarse (0/1/2)
- O: Se considera bien nutrido (0/1/2)
- P: Estado de salud vs edad (0/0.5/1.0/2.0)
- Q: Circunferencia braquial CB (0.0/0.5/1.0)
- R: Circunferencia pantorrilla CP (0/1)

Cuadro de Alimentos: 7 rows (food groups) × 4 cols (DIARIO/SEMANAL/MENSUAL/NUNCA), score-less — `group-info` table.

Total MNA max = 14 + 16 = 30 ✓ canonical
Classification: 24-30 normal, 17-23.5 riesgo malnutrición, <17 malnutrición ✓ gapless

**Conditional**: Cribaje ≥ 12 → Evaluación skippable (locked D3 rule shape `skipIf`).

**Excluded**: Apellidos, Nombre, Sexo, Edad, Peso, Altura, Fecha

## Subtask 1 (T1.6) — Ficha Nutricional extraction ✅

**Source**: `context/instrumentos-raw/1.8.4 FICHA NUTRICIONAL.xlsx - FICHA NUTRICIONAL.pdf` (58KB PDF)
**Method**: pypdf text extraction → `sources/ficha-nutricional.txt`

**No scoring — purely informational data-collection**. Sections:

1. **Datos del abuelo (excluded)**: nombre, c.c., fecha nacimiento, edad, sexo, fecha ingreso, R.H.G.S.
2. **Patologías actuales**: ENFERMEDADES (text-info), ALERGIAS ALIMENTARIAS (text-info), MEDICAMENTOSAS (text-info), ANTECEDENTES FAMILIARES (DIABETES/HTA/CÁNCER/OTRO as 4 boolean-info subitems), RESTRICCIONES ALIMENTARIAS - DIETA ACTUAL (text-info)
3. **Datos importantes actuales**: FECHA (text-info or date), PESO kg (number-info), TALLA cm (number-info), IMC (number-info), CONCEPTO (text-info)
4. **Recomendaciones generales nutricionales**: NUTRICIONISTA (text-info), FIRMA Y SELLO DEL PROFESIONAL - TP (ficha metadata, excluded)
5. **Anexo de soportes**: informational text — informational item

Puntuación: no aplica
Result-evaluation: no aplica

## Subtask 1 (T1.7) — Item-type matrix (preview for T2) 🟡 in progress

Initial item-type inventory:
- boolean-scored: Yesavage(15), MNA-K-subitems(3) — 18 items
- single-select-scored: Barthel(10), MNA-screening(6), MNA-eval-no-K(11) — 27 items
- compound-scored: MNA-K(1) — 1 item
- number-info: Ficha(3), MNA info — 4 items
- text-info: Ficha(5+) — 5+ items
- single-select-info: Ficha-antecedentes(4) — 4 items
- group-info: Cuadro de Alimentos(1) — 1 item

Will finalize in T2 with full coverage matrix.

## Strategy Request
None currently — all 6 raw files extracted successfully (MNA required OCR workaround).
