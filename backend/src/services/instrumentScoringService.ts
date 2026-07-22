/**
 * W4 — Scoring engine + answer validation for the dynamic-instruments feature.
 *
 * Authoritative contract: `orchestration-ctx/decisions/schema-contract-instrumentos-dynamic-fichas.md`
 *   §1.2 / §1.3 / §1.4 / §1.5 / §1.6 / §2 — definition shape, scoring rules, MAY-skip semantics.
 *   §5.3 — recompute algorithm.
 *
 * Pure functions. No HTTP concerns. No Prisma. The service layer (instrumentService / patientService)
 * is the only caller in production; the unit spec consumes it directly with the seeded definitions.
 *
 * Error contract (always thrown as { code, field?, message }):
 *   - INVALID_ANSWER_PAYLOAD — unknown key, partial skipIf section answers, or required missing.
 *   - INVALID_OPTION         — single-select-* value not in options[].value.
 *   - OUT_OF_RANGE           — number-info value outside constraints.min/max.
 */

// ---------------------------------------------------------------------------
// Types — mirror the JSON definition shape from the contract (§1, §2).
// Kept loose on purpose: this is the trust boundary between JSONB and TS.
// ---------------------------------------------------------------------------

export type ItemType =
  | 'single-select-scored'
  | 'single-select-info'
  | 'number-info'
  | 'text-info'
  | 'group-info'

export interface OptionDef {
  value: string
  label: string
  /** `null` for single-select-info; numeric (possibly fractional) otherwise. */
  score: number | null
}

export interface ConstraintsDef {
  min?: number
  max?: number
}

export interface ColumnDef {
  id: string
  label: string
  /** Always `null` on group-info columns per contract §1.6. */
  score: number | null
}

export interface RowDef {
  id: string
  label: string
}

export interface ItemDef {
  id: string
  label: string
  type: ItemType
  required: boolean
  instructions?: string
  placeholder?: string
  options?: OptionDef[]
  constraints?: ConstraintsDef
  columns?: ColumnDef[]
  rows?: RowDef[]
}

export interface RangeDef {
  min: number
  max: number
  label: string
}

export interface ResultEvaluationBlock {
  resultEvaluation?: RangeDef[]
}

export interface SkipIfRule {
  sectionId: string
  op: '>=' | '<=' | '>' | '<' | '==' | '!='
  value: number
}

export interface SectionDef {
  id: string
  titulo: string
  instructions?: string
  subtotal?: { max?: number } & ResultEvaluationBlock
  condition?: { skipIf: SkipIfRule }
  items: ItemDef[]
}

export type ScoringShape =
  | { total: 'sum'; resultEvaluation: RangeDef[] }
  | { total: 'none'; resultEvaluation: [] }

export interface InstrumentDefinition {
  codigo: string
  nombre: string
  version: number
  tipo: 'VALORACION' | 'NUTRICION' | 'MATRICULA' | 'ADMISION'
  descripcion?: string
  instructions?: string
  sections: SectionDef[]
  scoring: ScoringShape
}

export type AnswerValue = string | number | Array<{ rowId: string; columnId: string }>

export type Respuestas = Record<string, AnswerValue>

// ---------------------------------------------------------------------------
// Result types returned by the public API.
// ---------------------------------------------------------------------------

export type ScoringErrorCode =
  | 'INVALID_ANSWER_PAYLOAD'
  | 'INVALID_OPTION'
  | 'OUT_OF_RANGE'

export interface ScoringError {
  code: ScoringErrorCode
  field?: string
  message: string
}

export type ValidationResult =
  | { ok: true; skippedSections: string[] }
  | { ok: false; error: ScoringError }

export interface ScoreResult {
  subtotales: Record<string, number>
  puntajeTotal: number | null
  clasificacion: string | null
  skippedSections: string[]
}

// ---------------------------------------------------------------------------
// Helpers (internal — kept tiny on purpose so the unit spec can introspect).
// ---------------------------------------------------------------------------

function indexSections(definition: InstrumentDefinition): Map<string, SectionDef> {
  const map = new Map<string, SectionDef>()
  for (const s of definition.sections) {
    if (map.has(s.id)) {
      // Defensive: contract §1.2 says section.id is unique within a definition.
      // Duplicates would silently corrupt scoring — surface loudly.
      throw new Error(`Duplicate section id in definition ${definition.codigo}: ${s.id}`)
    }
    map.set(s.id, s)
  }
  return map
}

function indexItemsById(section: SectionDef): Map<string, ItemDef> {
  const map = new Map<string, ItemDef>()
  for (const it of section.items) {
    if (map.has(it.id)) {
      throw new Error(`Duplicate item id in section ${section.id}: ${it.id}`)
    }
    map.set(it.id, it)
  }
  return map
}

function indexOptionsByValue(item: ItemDef): Map<string, number | null> {
  const map = new Map<string, number | null>()
  for (const o of item.options ?? []) {
    map.set(o.value, o.score)
  }
  return map
}

/**
 * Evaluate a single comparison op. Pure numeric.
 * Exported for unit testing and so future rule shapes (none currently
 * supported per contract §1.4) have a single point of extension.
 */
export function evaluateSkipIf(
  triggerSubtotal: number | undefined,
  rule: SkipIfRule,
): boolean {
  if (triggerSubtotal === undefined || Number.isNaN(triggerSubtotal)) {
    // Trigger section was not answered → condition is NOT met.
    return false
  }
  const a = triggerSubtotal
  const b = rule.value
  switch (rule.op) {
    case '>=':
      return a >= b
    case '<=':
      return a <= b
    case '>':
      return a > b
    case '<':
      return a < b
    case '==':
      return a === b
    case '!=':
      return a !== b
  }
}

/**
 * Apply `resultEvaluation` ranges to a total and return the matching label,
 * or `null` if no range matched. Inclusive on both ends; any order tolerated
 * per contract §1.3. Missing ranges → `null` + `console.warn` (never throws).
 */
export function classify(
  ranges: RangeDef[] | undefined,
  total: number,
  context: string,
): string | null {
  if (!ranges || ranges.length === 0) return null
  for (const r of ranges) {
    if (total >= r.min && total <= r.max) {
      return r.label
    }
  }
  // Per contract §1.3 — must not happen for valid definitions; warn loudly.
  console.warn(
    `[instrumentScoringService] ${context}: total=${total} did not match any range in resultEvaluation.`,
  )
  return null
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a respuestas payload against the definition.
 *
 * Per contract §5.3 step 2:
 *   - Required items must be present (unless section is skipped via skipIf).
 *   - Option values must match options[*].value.
 *   - Number values must satisfy constraints.
 *   - Group-info answer must have exactly one entry per rows[*].id.
 *
 * Per §1.4 — skipIf means MAY-skip:
 *   - condition met + ZERO items answered → section treated as skipped (no error).
 *   - condition met + SOME items answered → ALL required items required (partial → INVALID_ANSWER_PAYLOAD).
 *   - condition NOT met → section fully required.
 */
export function validateRespuestas(
  definition: InstrumentDefinition,
  respuestas: Respuestas,
): ValidationResult {
  const sectionsById = indexSections(definition)
  const skippedSections: string[] = []

  // Pass 1: compute subtotals for sections that come BEFORE any with a skipIf
  // referencing them. The trigger section is always fully answered when its
  // dependent section is being validated, by induction: skipIf only references
  // earlier sections (contract §1.4), so by the time we reach the dependent
  // section the trigger's items have already been provided.
  //
  // We compute partial subtotals as we go so the skipIf rule can evaluate.
  const partialSubtotales: Record<string, number> = {}

  for (const section of definition.sections) {
    const itemsById = indexItemsById(section)

    // 1.1 unknown keys (in respuestas) not present as any item id in this section —
    //     we'll do the global check after the loop, but we need per-section knowledge
    //     of valid item ids to know what counts as "required missing".
    const itemsInRespuestas = Object.keys(respuestas).filter((k) => itemsById.has(k))

    // 1.2 MAY-skip evaluation: triggers are always earlier sections (contract §1.4).
    let isSkipped = false
    if (section.condition?.skipIf) {
      const rule = section.condition.skipIf
      const triggerSection = sectionsById.get(rule.sectionId)
      if (!triggerSection) {
        return {
          ok: false,
          error: {
            code: 'INVALID_ANSWER_PAYLOAD',
            field: `sections.${section.id}.condition.skipIf.sectionId`,
            message: `La sección referenciada por skipIf no existe en la definición: ${rule.sectionId}`,
          },
        }
      }
      const triggerSubtotal = partialSubtotales[rule.sectionId]
      const conditionMet = evaluateSkipIf(triggerSubtotal, rule)

      if (conditionMet) {
        if (itemsInRespuestas.length === 0) {
          // MAY-skip taken — nothing required.
          isSkipped = true
          skippedSections.push(section.id)
        } else {
          // MAY-skip declined — user chose to fill it, so ALL required items must be present.
          // Fall through to required-item check.
        }
      }
      // condition NOT met → fall through to required-item check (section is fully required).
    }

    if (!isSkipped) {
      // Required-item check
      for (const item of section.items) {
        const present = Object.prototype.hasOwnProperty.call(respuestas, item.id)
        if (item.required && !present) {
          return {
            ok: false,
            error: {
              code: 'INVALID_ANSWER_PAYLOAD',
              field: `respuestas.${item.id}`,
              message: `Falta la respuesta requerida: ${item.id}`,
            },
          }
        }
      }
    }

    // Per-item value validation (only for items that appear in respuestas).
    for (const itemId of itemsInRespuestas) {
      const item = itemsById.get(itemId)!
      const value = respuestas[itemId]
      const error = validateItemValue(item, value)
      if (error) {
        return { ok: false, error }
      }
    }

    // 1.3 compute partial subtotal for THIS section so downstream skipIf rules can evaluate.
    //     Only scored items contribute; info-only items (number/text/single-select-info/group-info)
    //     contribute 0 per contract §5.3 step 3.
    let subtotal = 0
    for (const item of section.items) {
      if (item.type !== 'single-select-scored') continue
      if (!Object.prototype.hasOwnProperty.call(respuestas, item.id)) continue
      const value = respuestas[item.id]
      if (typeof value !== 'string') continue
      const options = indexOptionsByValue(item)
      const score = options.get(value)
      if (typeof score === 'number') {
        subtotal += score
      }
    }
    partialSubtotales[section.id] = subtotal
  }

  // 2. Unknown-key check across the whole definition (every item id in the definition).
  const allItemIds = new Set<string>()
  for (const section of definition.sections) {
    for (const item of section.items) {
      allItemIds.add(item.id)
    }
  }
  for (const key of Object.keys(respuestas)) {
    if (!allItemIds.has(key)) {
      return {
        ok: false,
        error: {
          code: 'INVALID_ANSWER_PAYLOAD',
          field: `respuestas.${key}`,
          message: `La clave "${key}" no corresponde a ningún ítem del instrumento`,
        },
      }
    }
  }

  return { ok: true, skippedSections }
}

function validateItemValue(item: ItemDef, value: AnswerValue): ScoringError | null {
  switch (item.type) {
    case 'single-select-scored':
    case 'single-select-info': {
      if (typeof value !== 'string') {
        return {
          code: 'INVALID_OPTION',
          field: `respuestas.${item.id}`,
          message: `El valor debe ser una cadena de texto`,
        }
      }
      const options = item.options ?? []
      if (!options.some((o) => o.value === value)) {
        return {
          code: 'INVALID_OPTION',
          field: `respuestas.${item.id}`,
          message: `Valor "${value}" no está en las opciones del ítem`,
        }
      }
      return null
    }
    case 'number-info': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return {
          code: 'OUT_OF_RANGE',
          field: `respuestas.${item.id}`,
          message: `El valor debe ser un número`,
        }
      }
      const c = item.constraints
      if (c?.min !== undefined && value < c.min) {
        return {
          code: 'OUT_OF_RANGE',
          field: `respuestas.${item.id}`,
          message: `Valor ${value} está por debajo del mínimo permitido (${c.min})`,
        }
      }
      if (c?.max !== undefined && value > c.max) {
        return {
          code: 'OUT_OF_RANGE',
          field: `respuestas.${item.id}`,
          message: `Valor ${value} está por encima del máximo permitido (${c.max})`,
        }
      }
      return null
    }
    case 'text-info': {
      if (typeof value !== 'string') {
        return {
          code: 'INVALID_ANSWER_PAYLOAD',
          field: `respuestas.${item.id}`,
          message: `El valor debe ser texto`,
        }
      }
      return null
    }
    case 'group-info': {
      if (!Array.isArray(value)) {
        return {
          code: 'INVALID_ANSWER_PAYLOAD',
          field: `respuestas.${item.id}`,
          message: `El valor debe ser una lista de {rowId, columnId}`,
        }
      }
      const rowIds = new Set((item.rows ?? []).map((r) => r.id))
      const columnIds = new Set((item.columns ?? []).map((c) => c.id))
      const seenRows = new Set<string>()
      for (const entry of value) {
        if (
          !entry ||
          typeof entry !== 'object' ||
          typeof (entry as { rowId?: unknown }).rowId !== 'string' ||
          typeof (entry as { columnId?: unknown }).columnId !== 'string'
        ) {
          return {
            code: 'INVALID_ANSWER_PAYLOAD',
            field: `respuestas.${item.id}`,
            message: `Cada entrada debe tener rowId y columnId como cadenas`,
          }
        }
        const e = entry as { rowId: string; columnId: string }
        if (!rowIds.has(e.rowId)) {
          return {
            code: 'INVALID_ANSWER_PAYLOAD',
            field: `respuestas.${item.id}`,
            message: `rowId "${e.rowId}" no existe en las filas del ítem`,
          }
        }
        if (!columnIds.has(e.columnId)) {
          return {
            code: 'INVALID_ANSWER_PAYLOAD',
            field: `respuestas.${item.id}`,
            message: `columnId "${e.columnId}" no existe en las columnas del ítem`,
          }
        }
        if (seenRows.has(e.rowId)) {
          return {
            code: 'INVALID_ANSWER_PAYLOAD',
            field: `respuestas.${item.id}`,
            message: `Fila "${e.rowId}" contestada más de una vez`,
          }
        }
        seenRows.add(e.rowId)
      }
      // If the group is required, every row must be answered.
      if (item.required) {
        for (const rowId of rowIds) {
          if (!seenRows.has(rowId)) {
            return {
              code: 'INVALID_ANSWER_PAYLOAD',
              field: `respuestas.${item.id}`,
              message: `Falta la fila "${rowId}" en el grupo`,
            }
          }
        }
      }
      return null
    }
  }
}

/**
 * Compute subtotales / puntajeTotal / clasificacion for an already-validated payload.
 *
 * Caller is expected to have invoked validateRespuestas first; computeScore does
 * NOT re-validate the payload (it does still iterate items so a malformed payload
 * just yields a subtotal of 0 for unparseable items).
 */
export function computeScore(
  definition: InstrumentDefinition,
  respuestas: Respuestas,
): ScoreResult {
  const sectionsById = indexSections(definition)
  const subtotales: Record<string, number> = {}
  const skippedSections: string[] = []

  // Walk sections in order so each section can reference the prior trigger's subtotal.
  const computedSubtotals: Record<string, number> = {}
  for (const section of definition.sections) {
    let isSkipped = false
    if (section.condition?.skipIf) {
      const rule = section.condition.skipIf
      const triggerSection = sectionsById.get(rule.sectionId)
      // Trust validation: triggerSection exists.
      const triggerSubtotal = computedSubtotals[rule.sectionId]
      const conditionMet = evaluateSkipIf(triggerSubtotal, rule)
      if (conditionMet) {
        const itemsInRespuestas = section.items.some((it) =>
          Object.prototype.hasOwnProperty.call(respuestas, it.id),
        )
        if (!itemsInRespuestas) {
          isSkipped = true
          skippedSections.push(section.id)
        }
      }
    }

    if (isSkipped) {
      computedSubtotals[section.id] = 0
      continue
    }

    let subtotal = 0
    for (const item of section.items) {
      if (item.type !== 'single-select-scored') continue
      if (!Object.prototype.hasOwnProperty.call(respuestas, item.id)) continue
      const value = respuestas[item.id]
      if (typeof value !== 'string') continue
      const options = indexOptionsByValue(item)
      const score = options.get(value)
      if (typeof score === 'number') {
        subtotal += score
      }
    }
    subtotales[section.id] = subtotal
    computedSubtotals[section.id] = subtotal
  }

  // Compute puntajeTotal + clasificacion.
  // Informational instruments (D4): puntajeTotal=null, clasificacion=null.
  if (definition.scoring.total === 'none') {
    return {
      subtotales,
      puntajeTotal: null,
      clasificacion: null,
      skippedSections,
    }
  }

  // Per §1.3 / §5.3 step 5: skipIf sources classification from the TRIGGER
  // section's subtotal.resultEvaluation; otherwise use the global ranges.
  //
  // The trigger section is the section whose subtotal caused the skip — there
  // is exactly one (the first section referenced by a `condition.skipIf.sectionId`
  // among the skipped sections). In the seeded data (MNA) there is only one
  // such section. We pick the first one encountered in document order to stay
  // deterministic; the contract allows multiple skipIf chains in future versions.
  let clasificacion: string | null = null
  if (skippedSections.length > 0) {
    const firstSkipped = skippedSections[0]
    const skipped = sectionsById.get(firstSkipped)!
    const rule = skipped.condition?.skipIf
    if (rule) {
      const triggerSection = sectionsById.get(rule.sectionId)
      const triggerSubtotal = computedSubtotals[rule.sectionId] ?? 0
      const ranges = triggerSection?.subtotal?.resultEvaluation
      clasificacion = classify(ranges, triggerSubtotal, `${definition.codigo}/trigger(${rule.sectionId})`)
    }
  } else {
    const puntajeTotal = Object.values(subtotales).reduce((a, b) => a + b, 0)
    clasificacion = classify(
      definition.scoring.resultEvaluation,
      puntajeTotal,
      `${definition.codigo}/global`,
    )
    return {
      subtotales,
      puntajeTotal,
      clasificacion,
      skippedSections,
    }
  }

  const puntajeTotal = Object.values(subtotales).reduce((a, b) => a + b, 0)
  return {
    subtotales,
    puntajeTotal,
    clasificacion,
    skippedSections,
  }
}

// ---------------------------------------------------------------------------
// Convenience: validate-then-score in one call.
// Throws ScoringError on validation failure; returns ScoreResult otherwise.
// ---------------------------------------------------------------------------

export class InstrumentScoringError extends Error {
  readonly code: ScoringErrorCode
  readonly field?: string
  constructor(error: ScoringError) {
    super(error.message)
    this.name = 'InstrumentScoringError'
    this.code = error.code
    this.field = error.field
  }
}

export function validateAndScore(
  definition: InstrumentDefinition,
  respuestas: Respuestas,
): ScoreResult {
  const validation = validateRespuestas(definition, respuestas)
  if (!validation.ok) {
    throw new InstrumentScoringError(validation.error)
  }
  return computeScore(definition, respuestas)
}