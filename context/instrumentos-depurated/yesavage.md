# Escala de Depresión Geriátrica de Yesavage (GDS-15) — v1

- **codigo**: `YESAVAGE`
- **tipo**: `VALORACION`
- **purpose**: Screening de depresión en personas adultas mayores (15 ítems, sí/no, dirección sensible — EMKASA Ficha N° 3d).
- **fuente**: `INSTRUMENTO YESAVAGE EMKASA.docx`

## Campos excluidos (datos del paciente)

| Campo en ficha | Origen | Notas |
|---|---|---|
| Nombre | `Cliente.nombre` + `Cliente.apellido` | Cabecera |
| C.C. | `Cliente.numeroDocumento` | Cabecera |
| Nombre de la Unidad de Atención | `RegistroFichaCompletada` metadata | Cabecera — jornada/unidad |
| Edad (Años, Meses) | `Cliente.fechaNacimiento` | Calculado en cabecera |
| Fecha de aplicación | `RegistroFichaCompletada.fechaCompletado` | Cabecera |
| Aplicado por | `RegistroFichaCompletada.responsable` (Usuario) | Cabecera |
| FIRMA DEL EVALUADOR | `RegistroFichaCompletada.responsable` (Usuario) | Pie |

## Secciones

Una sola sección `depresion_geriátrica` (15 ítems sí/no, dirección sensible).

## Ítems

Consigna general: "Responda a cada una de las siguientes preguntas según como se ha sentido Ud. durante la ÚLTIMA SEMANA". Tiempo de administración: 10–15 minutos.

Cada ítem puntúa 1 punto para la respuesta que indica depresión (la respuesta en **NEGRITA Y MAYÚSCULAS** en la fuente), y 0 puntos para la respuesta opuesta. El puntaje total es la suma de respuestas "depresivas".

| # | Pregunta/Ítem | Tipo | Opciones (label → puntaje) | Requerido |
|---|---|---|---|---|
| 1 | ¿Está Ud. básicamente satisfecho con su vida? | `single-select-scored` | Sí → **0**<br>NO → **1** | sí |
| 2 | ¿Ha disminuido o abandonado muchos de sus intereses o actividades previas? | `single-select-scored` | SI → **1**<br>No → **0** | sí |
| 3 | ¿Siente que su vida está vacía? | `single-select-scored` | SI → **1**<br>No → **0** | sí |
| 4 | ¿Se siente aburrido frecuentemente? | `single-select-scored` | SI → **1**<br>No → **0** | sí |
| 5 | ¿Está Ud. de buen ánimo la mayoría del tiempo? | `single-select-scored` | Sí → **0**<br>NO → **1** | sí |
| 6 | ¿Está preocupado o teme que algo malo le va a pasar? | `single-select-scored` | SI → **1**<br>No → **0** | sí |
| 7 | ¿Se siente feliz la mayor parte del tiempo? | `single-select-scored` | Sí → **0**<br>NO → **1** | sí |
| 8 | ¿Se siente con frecuencia desamparado? | `single-select-scored` | SI → **1**<br>No → **0** | sí |
| 9 | ¿Prefiere Ud. quedarse en casa a salir a hacer cosas nuevas? | `single-select-scored` | SI → **1**<br>No → **0** | sí |
| 10 | ¿Siente Ud. que tiene más problemas con su memoria que otras personas de su edad? | `single-select-scored` | SI → **1**<br>No → **0** | sí |
| 11 | ¿Cree Ud. que es maravilloso estar vivo? | `single-select-scored` | Sí → **0**<br>NO → **1** | sí |
| 12 | ¿Se siente inútil o despreciable como está Ud. actualmente? | `single-select-scored` | SI → **1**<br>No → **0** | sí |
| 13 | ¿Se siente lleno de energía? | `single-select-scored` | Sí → **0**<br>NO → **1** | sí |
| 14 | ¿Se encuentra sin esperanza ante su situación actual? | `single-select-scored` | SI → **1**<br>No → **0** | sí |
| 15 | ¿Cree Ud. que las otras personas están en general mejor que Usted? | `single-select-scored` | SI → **1**<br>No → **0** | sí |

## Puntuación

- **Total** = suma de los puntajes de los 15 ítems (cuenta de respuestas "depresivas").
- **Rango**: 0–15.
- **No hay subtotales por sección** (una sola sección).
- **Máximo total**: 15 ✓ (canónico GDS-15).

## Result-evaluation

| min | max | clasificación |
|-----|-----|---------------|
| 0   | 5   | No depresión |
| 6   | 9   | Probable depresión |
| 10  | 15  | Depresión establecida |

## Notas de extracción

- **Codificación por puntaje-por-opción**: la dirección sensible se modela con un `single-select-scored` y los puntajes invertidos (1↔0) por ítem, **sin** introducir un tipo especial. Esto cumple la regla de la decisión D3: "Yesavage direction-scoring handled via per-option score values". El motor de scoring nunca necesita saber "qué dirección puntúa"; simplemente suma el puntaje de la opción elegida.
- Las etiquetas de las opciones siguen exactamente la capitalización de la fuente (Sí/SI, No/NO) para que la respuesta "depresiva" sea visualmente la que aparece en mayúsculas — fidelidad a la fuente, no preferencia estética.
- La instrucción general ("Responda ... durante la ÚLTIMA SEMANA") y el tiempo de administración (10–15 minutos) se preservan como `instructions` del header del instrumento en el template JSON.
- El "Total" y los "Puntos de corte" del pie del docx son referencias — no se modelan como ítems; viven en `resultEvaluation`.
