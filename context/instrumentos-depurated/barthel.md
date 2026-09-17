# Índice de Barthel — v1

- **codigo**: `BARTHEL`
- **tipo**: `VALORACION`
- **purpose**: Evaluar el nivel de independencia funcional del abuelo/a en actividades básicas de la vida diaria (ABVD).
- **fuente**: `INSTRUMENTO DE BARTHEL.xlsx` (EMKASA Abuelitos Felices)

## Campos excluidos (datos del paciente)

| Campo en ficha | Origen | Notas |
|---|---|---|
| NOMBRE | `Cliente.nombre` + `Cliente.apellido` | Renderizado desde la cabecera del paciente |
| C.C. | `Cliente.numeroDocumento` | Renderizado desde la cabecera del paciente |
| ASISTIDO/A — VÁLIDO/A | Categorización global | **Descartado del schema** (no es un ítem del instrumento; es una etiqueta post-puntuación) |
| Puntuación Total | calculado | Renderizado en el `InstrumentResultView` (no es campo a llenar) |
| FIRMA DEL EVALUADOR | `RegistroFichaCompletada.responsable` (Usuario) | Header de la ficha, no ítem |

## Secciones

Una sola sección `abvd` (actividades básicas de la vida diaria). No hay subtotal por sección distinto del total global.

## Ítems

| # | Pregunta/Ítem | Tipo | Opciones (label → puntaje) | Requerido |
|---|---|---|---|---|
| 1 | Comida | `single-select-scored` | Independiente: capaz de comer por sí solo en un tiempo razonable → **10**<br>Necesita ayuda para cortar la carne, extender la mantequilla, pero es capaz de comer sólo/a → **5**<br>Dependiente: necesita ser alimentado por otra persona → **0** | sí |
| 2 | Lavado de manos | `single-select-scored` | Independiente: capaz de lavarse, entrar y salir del baño con ayuda mínima → **5**<br>Dependiente: necesita algún tipo de ayuda o supervisión → **0** | sí |
| 3 | Vestido | `single-select-scored` | Independiente: capaz de ponerse y quitarse la ropa sin ayuda → **10**<br>Necesita ayuda: realiza sin ayuda más de la mitad en un tiempo razonable → **5**<br>Dependiente: necesita ayuda para las mismas → **0** | sí |
| 4 | Arreglo personal (para salir) | `single-select-scored` | Independiente: realiza todas las actividades personales sin ayuda alguna (complementos provistos por otra persona) → **5**<br>Dependiente: necesita alguna ayuda → **0** | sí |
| 5 | Deposición | `single-select-scored` | Continente: no presenta episodios de incontinencia → **10**<br>Accidente ocasional: menos de una vez por semana o necesita ayuda para enemas/supositorios → **5**<br>Incontinente: más de un episodio semanal → **0** | sí |
| 6 | Micción | `single-select-scored` | Continente: no presenta episodios → **10**<br>Accidente ocasional: máximo un episodio en 24 horas o requiere ayuda para sondas → **5**<br>Incontinente: más de un episodio en 24 horas → **0** | sí |
| 7 | Ir al retrete | `single-select-scored` | Independiente: entra y sale solo → **10**<br>Necesita ayuda: capaz de manejarse con pequeña ayuda → **5**<br>Dependiente: incapaz de acceder o utilizarlo sin ayuda mayor → **0** | sí |
| 8 | Transferencia (traslado mesa/sillón) | `single-select-scored` | Independiente: no requiere ayuda para sentarse/levantarse → **15**<br>Mínima ayuda: incluye supervisión o pequeña ayuda física → **10**<br>Gran ayuda: precisa ayuda de persona fuerte/entrenada → **5**<br>Dependiente: necesita grúa o dos personas → **0** | sí |
| 9 | Deambulación | `single-select-scored` | Independiente: 50m sin ayuda/supervisión (cualquier ayuda mecánica excepto andador; sí bastón) → **15**<br>Necesita ayuda: supervisión o pequeña ayuda física, o usa andador → **10**<br> Independiente en silla de ruedas: no requiere ayuda/supervisión permanente → **5**<br>Dependiente → **0** | sí |
| 10 | Subir y bajar desniveles | `single-select-scored` | Independiente: capaz sin ayuda ni supervisión → **10**<br>Necesita ayuda o supervisión → **5**<br>Dependiente: incapaz de salvar escalones → **0** | sí |

## Puntuación

- **Total** = suma de los puntajes de los 10 ítems.
- **Rango**: 0–100.
- **No hay subtotales por sección** (una sola sección `abvd`).
- **Máximo total**: 100 ✓ (canónico).

## Result-evaluation

| min | max | clasificación |
|-----|-----|---------------|
| 0   | 44  | Dependencia severa |
| 45  | 59  | Dependencia grave |
| 60  | 79  | Dependencia moderada |
| 80  | 100 | Dependencia ligera |

## Notas de extracción

- **Deviación EMKASA resuelta**: la fuente define `Moderada: 60-80` y `Ligera: 80-100` (solapan en 80). Se adopta la versión gapless canónica: `Moderada: 60-79` y `Ligera: 80-100`. La etiqueta original "Ligera" se conserva como "Dependencia ligera" para alinearse con la terminología clínica habitual (severity continua). El comportamiento del motor contra la versión overlap del Excel sería indistinguible para 79 (Moderada) y 81 (Ligera); solo el 80 cambia de clase. Documentado aquí para que QA (W5) verifique.
- Los puntajes `5.0`/`10.0`/`15.0` del Excel se representan como enteros `5`/`10`/`15` en el contrato (la grilla de puntajes no usa fracciones).
- El campo "ASISTIDO/A | VÁLIDO/A" del pie del Excel se descarta: es una etiqueta post-clasificación, no un ítem.
- No hay ítems informativos (D4 sí permite, pero Barthel no los requiere).
