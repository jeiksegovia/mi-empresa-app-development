# Mini Nutritional Assessment (MNA) + Cuadro de Alimentos — v1

- **codigo**: `MNA_CUADRO`
- **tipo**: `NUTRICION`
- **purpose**: Evaluar el estado nutricional del abuelo/a mediante cribaje + evaluación (MNA completo de Nestlé Nutrition Institute) y registrar la frecuencia de consumo por grupo de alimentos (Cuadro de Alimentos EMKASA) en un solo instrumento.
- **fuente**: `INSTRUMENTO NUTRICIONAL MNA.docx` (imagen embebida, OCR con tesseract eng) + `CUADRO DE ALIMENTOS.pdf` (texto vía pypdf).
- **justificación del merge**: ambos instrumentos comparten `tipo=NUTRICION` y se aplican juntos en una sola consulta nutricional. Decisión D-locked del intake (2026-07-16).

## Campos excluidos (datos del paciente)

| Campo en ficha | Origen | Notas |
|---|---|---|
| Apellidos | `Cliente.apellido` | Cabecera |
| Nombre | `Cliente.nombre` | Cabecera |
| Sexo | `Cliente.sexo` | Cabecera |
| Edad | `Cliente.fechaNacimiento` | Calculado en cabecera |
| Peso (kg) | **NO excluido** — es el ítem `imc_peso` de la sección Cribaje | Ver sección cribaje, ítem #6a |
| Altura / Talla (cm) | **NO excluido** — es el ítem `imc_talla` de la sección Cribaje | Ver sección cribaje, ítem #6b |
| Fecha | `RegistroFichaCompletada.fechaCompletado` | Cabecera |

Nota: Peso y Talla **sí** son ítems del MNA porque alimentan el cálculo del IMC (ítem F). No se toman de `Cliente` (no hay atributos canónicos de peso/talla en el modelo `Cliente` actual). El frontend los captura como parte del formulario.

## Secciones

| id | título | subtotal máximo | notas |
|---|---|---|---|
| `cribaje` | Cribaje (screening) | 14 | Si subtotal ≥ 12 → `evaluacion` es **skippable** (regla canónica MNA) |
| `evaluacion` | Evaluación | 16 | Se omite si cribaje ≥ 12 (skipIf) |
| `cuadro_alimentos` | Cuadro de Alimentos | 0 (informacional) | Frecuencia de consumo por grupo — sin puntaje |

## Ítems

### Sección `cribaje` (subtotal máx 14)

| # | Pregunta/Ítem | Tipo | Opciones (label → puntaje) | Requerido |
|---|---|---|---|---|
| A | ¿Ha perdido el apetito? ¿Ha comido menos por falta de apetito, problemas digestivos, dificultades de masticación o deglución en los últimos 3 meses? | `single-select-scored` | Ha comido mucho menos → **0**<br>Ha comido menos → **1**<br>Ha comido igual → **2** | sí |
| B | Pérdida reciente de peso (<3 meses) | `single-select-scored` | Pérdida de peso > 3 kg → **0**<br>No lo sabe → **1**<br>Pérdida de peso entre 1 y 3 kg → **2**<br>No ha habido pérdida de peso → **3** | sí |
| C | Movilidad | `single-select-scored` | De la cama al sillón → **0**<br>Autonomía en el interior → **1**<br>Sale del domicilio → **2** | sí |
| D | ¿Ha tenido una enfermedad aguda o situación de estrés psicológico en los últimos 3 meses? | `single-select-scored` | Sí → **0**<br>No → **2** | sí |
| E | Problemas neuropsicológicos | `single-select-scored` | Demencia o depresión grave → **0**<br>Demencia leve → **1**<br>Sin problemas psicológicos → **2** | sí |
| F1 | Peso en kg (para cálculo de IMC) | `number-info` | — (informacional; sin puntaje) | sí |
| F2 | Talla en cm (para cálculo de IMC) | `number-info` | — (informacional; sin puntaje) | sí |
| F | Índice de masa corporal (IMC) = peso en kg / (talla en m)² | `single-select-scored` | IMC < 19 → **0**<br>19 ≤ IMC < 21 → **1**<br>21 ≤ IMC < 23 → **2**<br>IMC ≥ 23 → **3** | sí |

**Subtotal `cribaje`** = A + B + C + D + E + F (las opciones F1 y F2 son inputs sin puntaje; el IMC es seleccionado por el evaluador a partir de F1/F2). El motor acepta puntuar F con el valor elegido por el evaluador; los campos F1/F2 persisten en `respuestas` para auditoría.

### Sección `evaluacion` (subtotal máx 16) — *skippable si cribaje ≥ 12*

| # | Pregunta/Ítem | Tipo | Opciones (label → puntaje) | Requerido |
|---|---|---|---|---|
| G | El paciente vive independiente (en su casa, no en una residencia) | `single-select-scored` | Sí → **1**<br>No → **0** | sí (si sección activa) |
| H | ¿Toma más de 3 medicamentos al día? | `single-select-scored` | Sí → **0**<br>No → **1** | sí (si sección activa) |
| I | ¿Úlceras o lesiones cutáneas? | `single-select-scored` | Sí → **0**<br>No → **1** | sí (si sección activa) |
| J | ¿Cuántas comidas completas toma al día? | `single-select-scored` | 1 comida → **0**<br>2 comidas → **1**<br>3 comidas → **2** | sí (si sección activa) |
| K | Consume el paciente: *(ver sub-ítems abajo; el evaluador cuenta el total de "Sí" y elige la opción)* | `single-select-scored` | 0 sí → **0**<br>1 sí → **0.5**<br>2 sí → **1**<br>3 sí → **1** | sí (si sección activa) |
| L | ¿Consume frutas o verduras al menos 2 veces al día? | `single-select-scored` | No → **0**<br>Sí → **1** | sí (si sección activa) |
| M | ¿Cuántos vasos de agua u otros líquidos toma al día? (agua, zumo, café, té, leche, vino, cerveza...) | `single-select-scored` | Menos de 3 vasos → **0**<br>De 3 a 5 vasos → **0.5**<br>Más de 5 vasos → **1** | sí (si sección activa) |
| N | Forma de alimentarse | `single-select-scored` | Necesita ayuda → **0**<br>Se alimenta solo con dificultad → **1**<br>Se alimenta solo sin dificultad → **2** | sí (si sección activa) |
| O | ¿Se considera el paciente que está bien nutrido? | `single-select-scored` | Malnutrición grave → **0**<br>No lo sabe o malnutrición moderada → **1**<br>Sin problemas de nutrición → **2** | sí (si sección activa) |
| P | En comparación con las personas de su edad, ¿cómo encuentra el paciente su estado de salud? | `single-select-scored` | Peor → **0**<br>No lo sabe → **0.5**<br>Igual → **1**<br>Mejor → **2** | sí (si sección activa) |
| Q | Circunferencia braquial (CB en cm) | `single-select-scored` | CB < 21 → **0**<br>21 ≤ CB < 22 → **0.5**<br>CB ≥ 22 → **1** | sí (si sección activa) |
| R | Circunferencia de la pantorrilla (CP en cm) | `single-select-scored` | CP < 31 → **0**<br>CP ≥ 31 → **1** | sí (si sección activa) |

#### Sub-ítems informativos de K (texto de apoyo, no se responden individualmente)

Estos 3 enunciados aparecen como texto introductorio del ítem K en el renderer; el evaluador los lee y luego selecciona la opción K (0/1/2/3 síes):

1. ¿Productos lácteos al menos una vez al día? (sí/no — orientativo)
2. ¿Huevos o legumbres 1 o 2 veces a la semana? (sí/no — orientativo)
3. ¿Carne, pescado o aves diariamente? (sí/no — orientativo)

Estos no se modelan como ítems separados en el schema (sería un `compound-scored` con 3 booleanos → score, que añadiría un tipo nuevo sin beneficio: el motor no necesita los 3 sub-valores para calcular el puntaje total). El evaluador cuenta manualmente.

### Sección `cuadro_alimentos` (subtotal máx 0 — informacional)

Registra la frecuencia de consumo de cada grupo de alimentos (Diario / Semanal / Mensual / Nunca). Es información nutricional complementaria; no aporta al puntaje MNA.

Se modela como un solo ítem `group-info` con 7 filas (grupos de alimentos) × 4 columnas (frecuencia). El motor no extrae puntaje; el renderer muestra una tabla donde cada fila es un `single-select-info` con las 4 opciones de frecuencia.

| # | Pregunta/Ítem | Tipo | Opciones (label → puntaje) | Requerido |
|---|---|---|---|---|
| CA | Frecuencia de consumo por grupo de alimentos | `group-info` | ver filas abajo | sí |

#### Filas (informativas, no son ítems separados)

Cada fila del `group-info` es un `single-select-info` con las mismas 4 opciones:

1. Cereales y RTP's
2. Frutas
3. Verduras
4. Carnes y sustitutos
5. Lácteos y sustitutos
6. Grasas
7. Dulces

Opciones de cada fila: **Diario / Semanal / Mensual / Nunca** (sin puntaje).

## Puntuación

- **Subtotal `cribaje`**: A + B + C + D + E + F. Máximo **14**.
- **Subtotal `evaluacion`**: G + H + I + J + K + L + M + N + O + P + Q + R. Máximo **16** (admite puntajes fraccionarios 0.5 en K, M, P, Q).
- **Subtotal `cuadro_alimentos`**: 0 (informacional, no suma).
- **Total MNA** = `cribaje` + `evaluacion` (si `evaluacion` no fue saltada). Máximo **30** ✓ (canónico: 14 + 16).

### Regla condicional (`skipIf`)

Forma única y bloqueada por contrato (D3): el motor omite la sección `evaluacion` cuando `cribaje >= 12`. La forma JSON es:

```json
{
  "id": "evaluacion",
  "condition": {
    "skipIf": { "sectionId": "cribaje", "op": ">=", "value": 12 }
  }
}
```

- Si la sección `evaluacion` es omitida, su subtotal es 0 y el total se calcula sólo con `cribaje` (rango 0–14).
- Cuando la sección es omitida, el frontend no requiere sus respuestas; el backend acepta `respuestas` sin claves para ítems de esa sección y marca `skippedSections: ["evaluacion"]` en el resultado.

## Result-evaluation

| min | max | clasificación |
|-----|-----|---------------|
| 24  | 30  | Estado nutricional normal |
| 17  | 23.5 | Riesgo de malnutrición |
| 0   | 16.5 | Malnutrición |

## Notas de extracción

- **Extracción del docx**: el archivo MNA.docx contiene casi todo su contenido embebido como imagen JPEG (image1.jpg, 877 KB); el texto "nativo" sólo trae "FIRMA DEL EVALUADOR:". Se extrajo la imagen, se exportó a JPG plano y se ejecutó tesseract (eng, único idioma disponible en este entorno) sobre `/tmp/mna_img1.jpg` para obtener el texto OCR → `tasks/W1-extraction-contract/sources/mna-ocr.txt`. La versión final del schema se contrastó con la documentación canónica del MNA Nestlé Nutrition Institute (Rubenstein 2001, Vellas 2006) para verificar puntajes y estructura.
- **Sub-ítems de K**: la fuente presenta K como tres preguntas sí/no con puntaje agregado 0/0.5/1.0/1.0 según cuántos "Sí" reporta el evaluador. Se eligió modelar K como `single-select-scored` con 4 opciones (cuenta de síes) en vez de introducir un tipo nuevo `compound-scored`. Los sub-enunciados sí/no se preservan como texto introductorio del ítem (renderer los muestra arriba del select). Justificación en §T2.
- **Campos Peso/Talla (F1/F2)**: se decidió NO excluirlos del schema porque (a) no existen atributos canónicos de peso/talla en el modelo `Cliente`, y (b) el IMC requiere ambos para que el evaluador seleccione la opción F. Se persisten en `respuestas` como `number-info` (sin puntaje, D4).
- **Puntajes fraccionarios (0.5, 1.0, 2.0)**: el motor de scoring y el schema JSON deben aceptar números (no sólo enteros) en `score` por opción. Documentado en el contrato §1.
- **Referencias bibliográficas del docx**: las 4 citas (Vellas 2006, Rubenstein 2001, Guigoz 2006, Nestlé 1994/2009) se omiten del schema (no son operativas); pueden vivir en el header del instrumento (`instrucciones` o `notes` no funcionales) si el frontend las quiere mostrar.
- **Tolerancia de error OCR**: el OCR del ítem M salió como `0.0 = menos de 3 vasos`, `0.5 = de 3 a 5 vasos`, `1.0 = más de 5 vasos` — consistente con la literatura canónica MNA. Sin desviación EMKASA.
- **Sección `cuadro_alimentos` separada**: el Cuadro de Alimentos tiene vida propia en la ficha física pero no puntúa para el MNA. Se incluye como sección dentro del mismo instrumento (decisión D-locked: "MNA + Cuadro de Alimentos merge into ONE instrument"), pero con subtotal 0 y `items` sin `score`. Esto preserva el flujo de "una sola consulta nutricional" sin contaminar la clasificación global.

## G2 — Ajustes de re-arquitectura (orquestador, 2026-07-17)
- La sección `cribaje` ahora declara `subtotal.resultEvaluation` con la clasificación oficial del
  cribaje (12–14 normal / 8–11 riesgo / 0–7 malnutrición, verificada contra el formulario Nestlé
  MNA embebido en el docx). Cuando `evaluacion` se omite (cribaje ≥ 12), la clasificación del
  registro proviene de estos rangos — los rangos globales 0–30 solo aplican si la evaluación fue
  completada.
- `skipIf` tiene semántica de **omisión opcional**: con cribaje ≥ 12 la evaluación puede omitirse
  o completarse ("para una evaluación más detallada, continúe con las preguntas G-R").
- Tipo `boolean-scored` colapsado en `single-select-scored` (set mínimo de 5 tipos).
