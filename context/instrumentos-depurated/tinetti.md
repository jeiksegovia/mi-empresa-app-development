# Escala de Tinetti (Marcha y Equilibrio) — v1

- **codigo**: `TINETTI`
- **tipo**: `VALORACION`
- **purpose**: Evaluar el equilibrio y la marcha del abuelo/a para determinar riesgo de caídas.
- **fuente**: `INSTRUMENTO TINETTI EMKASA.docx`

## Campos excluidos (datos del paciente)

| Campo en ficha | Origen | Notas |
|---|---|---|
| Nombre | `Cliente.nombre` + `Cliente.apellido` | Cabecera |
| Edad | `Cliente.fechaNacimiento` | Cabecera |
| Sexo | `Cliente.sexo` | Cabecera |
| Fecha de evaluación | `RegistroFichaCompletada.fechaCompletado` | Cabecera |
| Evaluador | `RegistroFichaCompletada.responsable` (Usuario) | Cabecera |
| FIRMA DEL EVALUADOR | `RegistroFichaCompletada.responsable` (Usuario) | Pie — firma visible |
| Puntaje obtenido en equilibrio | calculado | Renderizado en `InstrumentResultView` (subtotal sección) |
| Puntaje obtenido en marcha | calculado | Renderizado en `InstrumentResultView` (subtotal sección) |
| Puntaje total | calculado | Renderizado en `InstrumentResultView` |

## Secciones

| id | título | subtotal máximo |
|---|---|---|
| `equilibrio` | Equilibrio | 16 |
| `marcha` | Marcha | 12 |

## Ítems

### Sección `equilibrio` (subtotal máx 16)

Consigna: el paciente está sentado en una silla dura sin apoyar brazos.

| # | Pregunta/Ítem | Tipo | Opciones (label → puntaje) | Requerido |
|---|---|---|---|---|
| 1 | 1. Equilibrio sentado | `single-select-scored` | Se inclina o se desliza en la silla → **0**<br>Se mantiene seguro → **1** | sí |
| 2 | 2. Levantarse | `single-select-scored` | Imposible sin ayuda → **0**<br>Capaz, pero usa los brazos para ayudarse → **1**<br>Capaz sin usar los brazos → **2** | sí |
| 3 | 3. Intentos para levantarse | `single-select-scored` | Incapaz sin ayuda → **0**<br>Capaz, pero necesita más de un intento → **1**<br>Capaz de levantarse con sólo un intento → **2** | sí |
| 4 | 4. Equilibrio en bipedestación inmediata (los primeros 5 segundos) | `single-select-scored` | Inestable (se tambalea, mueve los pies), marcado balanceo del tronco → **0**<br>Estable, pero usa el andador, bastón o se agarra a otro objeto para mantenerse → **1**<br>Estable sin andador, bastón u otros soportes → **2** | sí |
| 5 | 5. Equilibrio en bipedestación | `single-select-scored` | Inestable → **0**<br>Estable, pero con apoyo amplio (talones separados más de 10 cm) o un bastón u otro soporte → **1**<br>Estable, sin usar bastón u otros soportes por 10 segundos, no requiere ayuda → **2** | sí |
| 6 | 6. Empujar (en bipedestación con tronco erecto y pies juntos; examinador empuja suavemente el esternón 3 veces) | `single-select-scored` | Empieza a caerse → **0**<br>Se tambalea, se agarra, pero se mantiene → **1**<br>Estable → **2** | sí |
| 7 | 7. Ojos cerrados (en posición del punto 6) | `single-select-scored` | Inestable → **0**<br>Estable → **1** | sí |
| 8a | 8a. Vuelta de 360 grados — pasos | `single-select-scored` | Pasos discontinuos → **0**<br>Continuos → **1** | sí |
| 8b | 8b. Vuelta de 360 grados — estabilidad | `single-select-scored` | Inestable (se tambalea, se agarra) → **0**<br>Estable → **1** | sí |
| 9 | 9. Sentarse | `single-select-scored` | Inseguro, calcula mal la distancia, cae en la silla → **0**<br>Usa los brazos o el movimiento es brusco → **1**<br>Seguro, movimiento suave → **2** | sí |

### Sección `marcha` (subtotal máx 12)

Consigna: el paciente permanece de pie con el examinador, camina por el pasillo (unos 8 metros) a paso normal y regresa a paso rápido pero seguro.

| # | Pregunta/Ítem | Tipo | Opciones (label → puntaje) | Requerido |
|---|---|---|---|---|
| 10 | 10. Iniciación de la marcha (inmediatamente después de decir que ande) | `single-select-scored` | Algunas vacilaciones o múltiples intentos para empezar → **0**<br>No vacila → **1** | sí |
| 11 | 11a. Movimiento del pie derecho — sobrepasa al izquierdo | `single-select-scored` | No sobrepasa al pie izquierdo con el paso → **0**<br>Sobrepasa al pie izquierdo → **1** | sí |
| 12 | 11b. Movimiento del pie derecho — se separa del suelo | `single-select-scored` | El pie derecho no se separa completamente del suelo → **0**<br>El pie derecho se separa completamente del suelo → **1** | sí |
| 13 | 11c. Movimiento del pie izquierdo — sobrepasa al derecho | `single-select-scored` | No sobrepasa al pie derecho con el paso → **0**<br>Sobrepasa al pie derecho → **1** | sí |
| 14 | 11d. Movimiento del pie izquierdo — se separa del suelo | `single-select-scored` | El pie izquierdo no se separa completamente del suelo → **0**<br>El pie izquierdo se separa completamente del suelo → **1** | sí |
| 15 | 12. Simetría del paso | `single-select-scored` | La longitud de los pasos con los pies izquierdo y derecho no es igual → **0**<br>La longitud parece igual → **1** | sí |
| 16 | 13. Fluidez del paso | `single-select-scored` | Paradas entre los pasos → **0**<br>Los pasos parecen continuos → **1** | sí |
| 17 | 14. Trayectoria (trazado de un pie durante unos 3 metros) | `single-select-scored` | Desviación grave de la trayectoria → **0**<br>Leve/moderada desviación o usa ayuda para mantener la trayectoria → **1**<br>Sin desviación o ayudas → **2** | sí |
| 18 | 15. Tronco | `single-select-scored` | Balanceo marcado o usa ayuda → **0**<br>No se balancea, pero flexiona las rodillas o la espalda o separa los brazos al caminar → **1**<br>No se balancea, no se flexiona, ni utiliza otras ayudas → **2** | sí |
| 19 | 16. Postura al caminar | `single-select-scored` | Talones separados → **0**<br>Talones casi juntos al caminar → **1** | sí |

## Puntuación

- **Subtotal `equilibrio`**: ítems 1–9. Máximo 16.
- **Subtotal `marcha`**: ítems 10–19. Máximo 12.
- **Total** = `equilibrio` + `marcha`. Máximo **28** ✓ (canónico: 16 + 12).

## Result-evaluation

| min | max | clasificación |
|-----|-----|---------------|
| 25  | 28  | Riesgo bajo |
| 19  | 24  | Riesgo moderado |
| 0   | 18  | Alto riesgo de caídas |

## Notas de extracción

- **OCR / typo de fuente**: la tabla final de la fuente indica "Alto riesgo de celdas" (texto del docx);显然是 OCR/tipografía defectuosa — la etiqueta clínica canónica es "Alto riesgo de **caídas**" (Tinetti POMA). Se adopta "caídas" en el schema. La fila aparece como "Alto riesgo de caídas" en el resultado.
- **Deviación EMKASA resuelta (ítem 8)**: la fuente EMKASA agrupa la Vuelta de 360° en una sola celda con 4 opciones en dos pares 0/1/0/1 (Discontinuos/Continuos + Inestable/Estable). Esta agrupación colapsa dos sub-puntuaciones canónicas independientes del POMA en un solo ítem, lo que reduce el máximo posible del equilibrio de 16 a 15. **Decisión**: se modela como dos ítems `single-select-scored` independientes (8a pasos + 8b estabilidad), preservando el máximo canónico de 16 puntos en `equilibrio`. El cambio afecta a la fuente EMKASA (que pierde 1 punto por la fusión), no a la lógica clínica. El QA (W5) verificará que el motor sume correctamente ambos subítems.
- Cada ítem de la sección `marcha` 11a–11d es **independiente** (no un sub-ítem obligatorio de "11"): un evaluador puede puntuar cada aspecto del paso por separado. Esto difiere de algunas versiones publicadas del POMA que agrupan 11 en un solo puntaje combinado; se respeta la granularidad de la EMKASA.
- Las **consignas / instrucciones** de cada sección se preservan como `instructions` del header de sección en el template JSON (texto explicativo, no ítems a puntuar).
- La aplicación requiere **dos personas**: una da instrucciones y otra cuida que el paciente no sufra accidentes. Esta nota va como `instructions` a nivel de instrumento.
