# Ficha Nutricional (1.8.4) — v1

- **codigo**: `FICHA_NUTRICIONAL`
- **tipo**: `NUTRICION`
- **purpose**: Recopilar información nutricional del abuelo/a: patologías, antecedentes familiares, restricciones, antropometría y recomendaciones generales. **Sin scoring** (D4: instrumento puramente informacional).
- **fuente**: `1.8.4 FICHA NUTRICIONAL.xlsx - FICHA NUTRICIONAL.pdf`

## Campos excluidos (datos del paciente)

| Campo en ficha | Origen | Notas |
|---|---|---|
| TIPO DE DOCUMENTO (C.C. / OTRO) | `Cliente.tipoDocumento` | Cabecera |
| NÚMERO | `Cliente.numeroDocumento` | Cabecera |
| NOMBRE Y APELLIDO | `Cliente.nombre` + `Cliente.apellido` | Cabecera |
| FECHA DE NACIMIENTO (DD/MM/AA) | `Cliente.fechaNacimiento` | Cabecera |
| EDAD | `Cliente.fechaNacimiento` (calculado) | Cabecera |
| SEXO (F/M) | `Cliente.sexo` | Cabecera |
| FECHA DE INGRESO (DD/MM/AA) | `Cliente.fechaIngreso` o ficha metadata | Cabecera |
| R.H.G.S. | `Cliente.rhgs` (si existe) o ficha metadata | Cabecera — grupo sanguíneo |
| NUTRICIONISTA | `RegistroFichaCompletada.responsable` (Usuario con rol nutricionista) | Pie — firma |
| FIRMA Y SELLO DEL PROFESIONAL — TP | `RegistroFichaCompletada.responsable` (Usuario) | Pie |

## Secciones

| id | título | subtotal máximo | notas |
|---|---|---|---|
| `patologias` | Patologías y antecedentes | 0 | Informacional |
| `restricciones` | Restricciones alimentarias — dieta actual | 0 | Informacional |
| `datos_actuales` | Datos importantes actuales | 0 | Informacional |
| `recomendaciones` | Recomendaciones generales nutricionales | 0 | Informacional |
| `anexo_soportes` | Anexo de soportes | 0 | Informacional (lista de documentos anexos) |

## Ítems

### Sección `patologias` (subtotal máx 0 — informacional)

| # | Pregunta/Ítem | Tipo | Opciones (label → puntaje) | Requerido |
|---|---|---|---|---|
| P1 | Enfermedades | `text-info` | — (campo de texto largo; sin puntaje) | sí |
| P2 | Alergias alimentarias | `text-info` | — | sí |
| P3 | Alergias medicamentosas | `text-info` | — | sí |
| P4 | Antecedentes familiares — Diabetes | `single-select-info` | Sí → **—**<br>No → **—** | sí |
| P5 | Antecedentes familiares — HTA | `single-select-info` | Sí → **—**<br>No → **—** | sí |
| P6 | Antecedentes familiares — Cáncer | `single-select-info` | Sí → **—**<br>No → **—** | sí |
| P7 | Antecedentes familiares — Otro | `text-info` | — (especificar) | no |

### Sección `restricciones` (subtotal máx 0 — informacional)

| # | Pregunta/Ítem | Tipo | Opciones (label → puntaje) | Requerido |
|---|---|---|---|---|
| R1 | Restricciones alimentarias — Dieta actual | `text-info` | — (descripción de la dieta) | sí |

### Sección `datos_actuales` (subtotal máx 0 — informacional)

| # | Pregunta/Ítem | Tipo | Opciones (label → puntaje) | Requerido |
|---|---|---|---|---|
| D1 | Fecha | `text-info` | — (fecha del control, formato libre — la ficha física usa DD/MM/AA; el frontend puede restringir a tipo fecha si se desea) | sí |
| D2 | Peso (kg) | `number-info` | — (kilogramos, decimal permitido) | sí |
| D3 | Talla (cm) | `number-info` | — (centímetros, decimal permitido) | sí |
| D4 | IMC | `number-info` | — (índice; calculado o capturado, sin validación cruzada automática) | sí |
| D5 | Concepto | `text-info` | — (interpretación del IMC / estado) | sí |

### Sección `recomendaciones` (subtotal máx 0 — informacional)

| # | Pregunta/Ítem | Tipo | Opciones (label → puntaje) | Requerido |
|---|---|---|---|---|
| REC1 | Recomendaciones generales nutricionales | `text-info` | — (recomendaciones del nutricionista) | sí |

### Sección `anexo_soportes` (subtotal máx 0 — informacional)

| # | Pregunta/Ítem | Tipo | Opciones (label → puntaje) | Requerido |
|---|---|---|---|---|
| AS1 | MNA (Mini Nutritional Assessment) | `text-info` | — (referencia al anexo; en este instrumento la valoración MNA es el instrumento `MNA_CUADRO`, así que esta fila puede quedar como nota informativa o eliminarse — ver nota de extracción) | no |
| AS2 | Ficha Nutricional | `text-info` | — (referencia; este mismo instrumento; redundante — ver nota) | no |
| AS3 | Ficha Cualitativa | `text-info` | — (referencia a ficha cualitativa, fuera del alcance de esta entrega) | no |

## Puntuación

**No aplica.** Este instrumento es de recolección de datos nutricionales; no produce puntaje total ni clasificación. El motor de scoring debe reconocer esta condición mediante:

- `scoring.total = "none"` (nuevo valor de la regla, permitido por la decisión D4 que admite instrumentos sin scoring)
- `scoring.resultEvaluation: []` (lista vacía)

Y el modelo `RegistroFichaCompletada.puntajeTotal` / `clasificacion` quedan en `null` cuando se completa este instrumento.

## Result-evaluation

**No aplica.** No hay rangos de clasificación.

## Notas de extracción

- **Sin scoring (D4)**: la fuente es una ficha de recolección. No hay columnas de puntaje, ni clasificación, ni rangos. Esto fuerza la regla `scoring.total = "none"` en el contrato (nueva constante del enum `scoringTotal`, sumada a `"sum"`). Documentada en el contrato §1.
- **Sub-ítems de Antecedentes familiares**: la fuente usa el formato "DIABETES: __ / HTA: __ / CÁNCER: __ / OTRO: __" con líneas separadas. Se decidió modelar Diabetes/HTA/Cáncer como `single-select-info` (Sí/No) para facilitar el reporte estructurado, y "Otro" como `text-info` libre.
- **Anexo de soportes**: la fuente lista "MNA, FICHA NUTRICIONAL, FICHA CUALITATIVA" como anexos físicos. En esta versión digital, el anexo MNA vive en su propio instrumento (`MNA_CUADRO`) y "Ficha Nutricional" es redundante con este mismo instrumento. Estos ítems se preservan como `text-info` opcionales a modo de placeholder; el frontend puede ocultarlos u omitirlos sin perder fidelidad.
- **IMC (D4)**: la fuente lo presenta como un campo a llenar manualmente (no como fórmula). Se captura como `number-info`; no se calcula automáticamente desde peso/talla. El nutricionista transcribe el valor.
- **Frecuencia de control**: la nota al pie del PDF indica "Datos que se actualizarán con control de seguimiento cada seis meses por parte de la profesional". Esto se traduce en una periodicidad `SEMESTRAL` del instrumento (a aplicar en el campo `Instrumento.periodicidad` al sembrar; no afecta al schema del definition).
- **Campos de fecha en la sección `datos_actuales`**: la ficha física usa `DD/MM/AA`. El schema usa `text-info` libre para mantener fidelidad; si el frontend quiere mostrar un datepicker, debe formatear la captura a ese formato.
- **No aplica regla condicional (skipIf)**: ningún ítem depende del resultado de otro. El motor no evalúa `condition` en este instrumento.

## G2 — Ajustes de re-arquitectura (orquestador, 2026-07-17)
- Ítem `D1 Fecha` eliminado del template: es metadato de la ficha (`fechaCompletado`).
- Sección `anexo_soportes` eliminada del template (3 ítems placeholder que referencian otros
  instrumentos, no datos). Se preserva aquí como registro de fidelidad de la fuente.
- Campo de la fuente **"OBSERVACIÓN IMPORTANTE A TENER EN CUENTA"** (bloque datos generales,
  omitido en la extracción original — verificado contra el PDF) se mapea a
  `RegistroFichaCompletada.notasObservaciones`, no es ítem del schema.
- Ítems del template: 13 (7 patologías/antecedentes + 1 restricciones + 4 datos actuales + 1 recomendaciones).
