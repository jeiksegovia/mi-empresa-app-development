# Mini Examen del Estado Mental (MMSE Folstein) — v1

- **codigo**: `MINI_MENTAL`
- **tipo**: `VALORACION`
- **purpose**: Evaluar orientación, memoria, atención, lenguaje y capacidades visuoconstructivas como cribado de deterioro cognitivo (Folstein et al. 1975, EMKASA Ficha N° 3c).
- **fuente**: `INSTRUMENTO MINI MENTAL EMKASA.docx`

## Campos excluidos (datos del paciente)

| Campo en ficha | Origen | Notas |
|---|---|---|
| Nombre del Abuelo | `Cliente.nombre` + `Cliente.apellido` | Cabecera |
| c.c. | `Cliente.numeroDocumento` | Cabecera |
| Edad (Años, Meses) | `Cliente.fechaNacimiento` | Calculado en cabecera |
| Jornada de Atención | `RegistroFichaCompletada` metadata | Unidad/jornada del día (no es ítem del instrumento) |
| Fecha de aplicación | `RegistroFichaCompletada.fechaCompletado` | Cabecera |
| Aplicado por | `RegistroFichaCompletada.responsable` (Usuario) | Cabecera |

## Secciones

Once secciones; las primeras diez puntúan; la última es sólo referencia (rango de clasificación).

| id | título | subtotal máximo |
|---|---|---|
| `orientacion_tiempo` | Orientación en el tiempo | 5 |
| `orientacion_espacio` | Orientación en el espacio | 5 |
| `memoria` | Memoria (fijación) | 3 |
| `atencion_calculo` | Atención y cálculo | 5 |
| `memoria_diferida` | Memoria diferida (recuerdo) | 3 |
| `denominacion` | Denominación | 2 |
| `repeticion` | Repetición de una frase | 1 |
| `comprension_orden` | Comprensión – ejecución de orden | 3 |
| `lectura` | Lectura | 1 |
| `escritura` | Escritura | 1 |
| `copia_dibujo` | Copia de un dibujo | 1 |

## Ítems

### Sección `orientacion_tiempo` (subtotal máx 5)

| # | Pregunta/Ítem | Tipo | Opciones (label → puntaje) | Requerido |
|---|---|---|---|---|
| 1 | ¿En qué día estamos (fecha)? | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |
| 2 | ¿En qué mes? | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |
| 3 | ¿En qué año? | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |
| 4 | ¿En qué día de la semana? | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |
| 5 | ¿Qué hora es aproximadamente? | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |

### Sección `orientacion_espacio` (subtotal máx 5)

| # | Pregunta/Ítem | Tipo | Opciones (label → puntaje) | Requerido |
|---|---|---|---|---|
| 6 | ¿En qué lugar estamos ahora? | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |
| 7 | ¿En qué piso o departamento estamos ahora? | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |
| 8 | ¿Qué barrio o parroquia es este? | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |
| 9 | ¿En qué ciudad estamos? | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |
| 10 | ¿En qué país estamos? | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |

### Sección `memoria` (subtotal máx 3)

Consigna: "Le voy a decir el nombre de tres objetos, cuando yo termine quiero que por favor usted los repita". Puntuar sólo el primer ensayo.

| # | Pregunta/Ítem | Tipo | Opciones (label → puntaje) | Requerido |
|---|---|---|---|---|
| 11 | Papel | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |
| 12 | Bicicleta | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |
| 13 | Cuchara | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |

### Sección `atencion_calculo` (subtotal máx 5)

Consigna: "Le voy a pedir que reste de 7 en 7 a partir del 100". Otorgue 1 punto por cada respuesta correcta (93, 86, 79, 72, 65).

| # | Pregunta/Ítem | Tipo | Opciones (label → puntaje) | Requerido |
|---|---|---|---|---|
| 14 | 93 | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |
| 15 | 86 | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |
| 16 | 79 | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |
| 17 | 72 | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |
| 18 | 65 | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |

### Sección `memoria_diferida` (subtotal máx 3)

Consigna: "Dígame los 3 objetos que le mencioné al principio".

| # | Pregunta/Ítem | Tipo | Opciones (label → puntaje) | Requerido |
|---|---|---|---|---|
| 19 | Papel | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |
| 20 | Bicicleta | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |
| 21 | Cuchara | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |

### Sección `denominacion` (subtotal máx 2)

| # | Pregunta/Ítem | Tipo | Opciones (label → puntaje) | Requerido |
|---|---|---|---|---|
| 22 | Mostrarle un lápiz o un bolígrafo y preguntar ¿qué es esto? | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |
| 23 | Mostrarle un reloj y preguntar ¿qué es esto? | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |

### Sección `repeticion` (subtotal máx 1)

Consigna: "Ahora le voy a decir una frase que tendrá que repetir después de mí. Solo se la puedo decir una vez, así que ponga mucha atención". Frase: "ni sí, ni no, ni pero".

| # | Pregunta/Ítem | Tipo | Opciones (label → puntaje) | Requerido |
|---|---|---|---|---|
| 24 | Repetición de la frase "ni sí, ni no, ni pero" | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |

### Sección `comprension_orden` (subtotal máx 3)

Consigna: "Le voy a dar unas instrucciones. Por favor sígalas en el orden en que las voy a decir. Solo las puedo decir una vez": "TOME ESTE PAPEL CON LA MANO DERECHA, DÓBLELO POR LA MITAD Y DÉJELO EN EL SUELO".

| # | Pregunta/Ítem | Tipo | Opciones (label → puntaje) | Requerido |
|---|---|---|---|---|
| 25 | Tome este papel con la mano derecha | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |
| 26 | Dóblelo por la mitad | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |
| 27 | Déjelo en el suelo | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |

### Sección `lectura` (subtotal máx 1)

| # | Pregunta/Ítem | Tipo | Opciones (label → puntaje) | Requerido |
|---|---|---|---|---|
| 28 | Escriba legiblemente en un papel "cierre los ojos". Pídale a la persona adulta mayor que lo lea y que haga lo que dice la frase | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |

### Sección `escritura` (subtotal máx 1)

| # | Pregunta/Ítem | Tipo | Opciones (label → puntaje) | Requerido |
|---|---|---|---|---|
| 29 | Consigna: "Quiero que por favor escriba una frase que diga un mensaje" | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |

### Sección `copia_dibujo` (subtotal máx 1)

| # | Pregunta/Ítem | Tipo | Opciones (label → puntaje) | Requerido |
|---|---|---|---|---|
| 30 | Consigna: "Copie por favor este dibujo tal como está" | `single-select-scored` | Correcto → **1**, Incorrecto → **0** | sí |

## Puntuación

- **Subtotales por sección**: ver tabla de secciones.
- **Total** = suma de los 11 subtotales = 5 + 5 + 3 + 5 + 3 + 2 + 1 + 3 + 1 + 1 + 1 = **30** ✓ (canónico).

## Result-evaluation

| min | max | clasificación |
|-----|-----|---------------|
| 27  | 30  | Normal |
| 24  | 26  | Sospecha patológica |
| 12  | 23  | Deterioro |
| 9   | 11  | Demencia |
| 0   | 8   | Deterioro severo |

## Notas de extracción

- **Deviación EMKASA resuelta**: la tabla de referencia de la fuente define `27-30`, `24-26`, `12-23`, `9-11` y deja sin clasificar el rango `0-8`. Se agrega el tramo gapless `0-8 → Deterioro severo` para mantener cobertura continua; cualquier puntuación completada debe caer en uno de los cinco rangos. La fila adicional se documenta como extensión para gapless, no como corrección de la EMKASA original.
- Cada ítem es un `single-select-scored` con valores `correcto/incorrecto`. La etiqueta visible para el usuario debe ser "Correcto / Incorrecto" (no sí/no) porque el evaluador decide si la respuesta coincide con la consigna.
- Las **consignas** de cada sección (texto en cursiva en el docx) se preservan como `instructions` del header de sección en el template JSON; el frontend las renderiza como ayuda contextual, no como ítems a puntuar.
- Los nombres "PUNTUACIÓN (máx. N)" son filas informativas dentro de la tabla Word; en el schema JSON son subtotales calculados, no ítems.
