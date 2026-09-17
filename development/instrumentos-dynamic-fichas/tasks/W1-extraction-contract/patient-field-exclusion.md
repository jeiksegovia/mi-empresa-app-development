# Patient-Field Exclusion Table (consolidated, Task #12 — T2 output)

Union of every "Campos excluidos" section across the 6 depurated specs, mapped to source.

## Source mapping legend

- `Cliente.*` — fields on the `Cliente` (patient) model in `backend/prisma/schema.prisma`
- `RegistroFichaCompletada.*` — fields on the ficha-completion row (or its computed metadata)
- `Usuario.*` — fields on the `Usuario` (employee) model, accessed via `RegistroFichaCompletada.responsable` FK
- **ficha metadata** — values that are not on a model but are part of the ficha assignment (e.g., unit/jornada name); they ride on the ficha row and the frontend renders them in the header

## Final exclusion table

| # | Excluded field label (canonical Spanish) | Appears in instruments | Source mapping |
|---|---|---|---|
| 1 | Nombre (del abuelo / paciente) | All 6 | `Cliente.nombre` + `Cliente.apellido` |
| 2 | C.C. / Número de documento | BARTHEL, MINI_MENTAL, YESAVAGE, FICHA_NUTRICIONAL | `Cliente.numeroDocumento` |
| 3 | Tipo de documento (C.C. / OTRO) | FICHA_NUTRICIONAL | `Cliente.tipoDocumento` |
| 4 | Edad (Años / Meses) | MINI_MENTAL, YESAVAGE | `Cliente.fechaNacimiento` (calculated) |
| 5 | Sexo | BARTHEL, TINETTI, MNA_CUADRO, FICHA_NUTRICIONAL | `Cliente.sexo` |
| 6 | Fecha de nacimiento | FICHA_NUTRICIONAL | `Cliente.fechaNacimiento` |
| 7 | Fecha de ingreso | FICHA_NUTRICIONAL | `Cliente.fechaIngreso` (or ficha metadata if not on Cliente) |
| 8 | R.H.G.S. (grupo sanguíneo) | FICHA_NUTRICIONAL | `Cliente.rhgs` (or ficha metadata if not on Cliente) |
| 9 | Fecha de aplicación / evaluación | BARTHEL, MINI_MENTAL, TINETTI, YESAVAGE, MNA_CUADRO | `RegistroFichaCompletada.fechaCompletado` |
| 10 | Aplicado por / Evaluador | BARTHEL, MINI_MENTAL, TINETTI, YESAVAGE | `RegistroFichaCompletada.responsable` → `Usuario` |
| 11 | Nombre de la Unidad de Atención / Jornada | MINI_MENTAL, YESAVAGE | ficha metadata (asignación de unidad/jornada) |
| 12 | NUTRICIONISTA (firma del profesional) | FICHA_NUTRICIONAL | `RegistroFichaCompletada.responsable` → `Usuario` (rol nutricionista) |
| 13 | FIRMA Y SELLO DEL PROFESIONAL — TP | FICHA_NUTRICIONAL | `RegistroFichaCompletada.responsable` → `Usuario` |
| 14 | FIRMA DEL EVALUADOR | BARTHEL, TINETTI, YESAVAGE, MNA_CUADRO | `RegistroFichaCompletada.responsable` → `Usuario` |
| 15 | ASISTIDO/A — VÁLIDO/A (Barthel) | BARTHEL | **Descartado** — etiqueta post-clasificación, no se renderiza como ítem |
| 16 | Puntuación Total / Puntajes parciales | BARTHEL, MINI_MENTAL, TINETTI | **Calculado** — renderizado en `InstrumentResultView` |
| 17 | Apellidos | MNA_CUADRO | `Cliente.apellido` |

## Items NOT excluded (kept as schema items even though they reference patient data)

- **Peso (kg)** in MNA F1 and Ficha D2 → kept as `number-info` because `Cliente` does not carry a current-weight attribute. The frontend captures weight at the time of the ficha.
- **Talla (cm)** in MNA F2 and Ficha D3 → kept as `number-info` for the same reason. The IMC item (MNA F, Ficha D4) needs both for its scoring/entry.

If the project later adds `Cliente.pesoActual` / `Cliente.talla`, these can be re-classified as excluded (pre-loaded from `Cliente`) and the schema item can be removed in a future template version (D1 supports this via the upgrade script).

## Forward note for W2/W3/W4

- The exclusion table is the **canonical** list for the contract §7.
- W3 (frontend) renders these in the ficha header band (above the dynamic form, below the page title).
- W4 (backend) does NOT include these in the answers JSON; only `respuestas` keys for actual instrument items.
- The scoring engine ignores these entirely (they never enter `computeScore`).
