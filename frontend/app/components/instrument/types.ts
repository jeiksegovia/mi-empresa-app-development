/**
 * TypeScript view of the dynamic-instruments contract.
 *
 * Source of truth: development/instrumentos-dynamic-fichas/orchestration-ctx/
 *   decisions/schema-contract-instrumentos-dynamic-fichas.md
 *
 * Only the strict subset needed by the renderer is typed here. The contract
 * (and not this file) is authoritative — if the contract changes, update
 * these interfaces to match. See §1 / §2 / §5.1.
 */

// ─── §1.1 Top-level definition ────────────────────────────────────────────────
export type TipoInstrumento = 'VALORACION' | 'NUTRICION' | 'MATRICULA' | 'ADMISION'

export interface ScoringShapeA {
  total: 'sum'
  resultEvaluation: ClassificationRange[]
}
export interface ScoringShapeB {
  total: 'none'
  resultEvaluation: []
}
export type Scoring = ScoringShapeA | ScoringShapeB

// ─── §1.2 Section ────────────────────────────────────────────────────────────
export interface Subtotal {
  /** Inclusive ceiling used for the engine's `gapless` validator (display only here). */
  max: number
  /**
   * Classification for THIS section's subtotal.
   * REQUIRED when `condition.skipIf` references this section
   * (provides the classification when the dependent section is skipped,
   * e.g., MNA cribaje 12–14 normal / 8–11 riesgo / 0–7 malnutrición).
   * Otherwise optional.
   */
  resultEvaluation?: ClassificationRange[]
}

export type ConditionOp = '>=' | '<=' | '>' | '<' | '==' | '!='

export interface SkipIfRule {
  sectionId: string
  op: ConditionOp
  value: number
}

export interface SectionCondition {
  skipIf: SkipIfRule
}

export interface ClassificationRange {
  min: number
  max: number
  label: string
}

export interface Section {
  id: string
  titulo: string
  instructions?: string
  /** Omit to mark this section as info-only (no subtotal contribution). */
  subtotal?: Subtotal
  condition?: SectionCondition
  items: Item[]
}

// ─── §1.5 / §1.6 Items ───────────────────────────────────────────────────────
export interface OptionBase {
  value: string
  label: string
}
export interface ScoredOption extends OptionBase {
  score: number | null
}
export interface NumberConstraints {
  min: number
  max: number
}

interface ItemBase {
  id: string
  label: string
  required: boolean
  instructions?: string
}
export interface SingleSelectScoredItem extends ItemBase {
  type: 'single-select-scored'
  options: ScoredOption[]
}
export interface SingleSelectInfoItem extends ItemBase {
  type: 'single-select-info'
  options: ScoredOption[]
}
export interface NumberInfoItem extends ItemBase {
  type: 'number-info'
  constraints?: NumberConstraints
}
export interface TextInfoItem extends ItemBase {
  type: 'text-info'
  placeholder?: string
}
export interface GroupInfoItem extends ItemBase {
  type: 'group-info'
  columns: ScoredOption[]
  rows: OptionBase[]
  /**
   * fixes-jul-22 §4: when `text`, every row×column coordinate stores a free-
   * text string instead of an exclusive column selection. Legacy group-info
   * without this flag keeps the {rowId,columnId}[] selection shape.
   */
  cellInput?: 'text'
}
export type Item =
  | SingleSelectScoredItem
  | SingleSelectInfoItem
  | NumberInfoItem
  | TextInfoItem
  | GroupInfoItem

// ─── §1 Top-level definition ────────────────────────────────────────────────
export interface InstrumentDefinition {
  codigo: string
  nombre: string
  version: number
  tipo: TipoInstrumento
  descripcion?: string
  instructions?: string
  mergeOf?: string[]
  sections: Section[]
  scoring: Scoring
}

// ─── §5.1 / §5.2 Answers payload ────────────────────────────────────────────
export type AnswerValue =
  | string // single-select-scored | single-select-info | text-info
  | number // number-info
  | GroupAnswerPair[] // legacy group-info: one column selection per row
  | GroupTextCellValue[] // fixes-jul-22 §4: text-cell matrix (every row×col)

export interface GroupAnswerPair {
  rowId: string
  columnId: string
}

/**
 * fixes-jul-22 §4: text-cell matrix answer. `cellInput: 'text'` group-info
 * items emit ONE object per row × column coordinate (an N×M matrix → N×M
 * entries). `value` is a string (empty allowed). The text NEVER contributes
 * to scoring — the engine treats it as informational only.
 */
export interface GroupTextCellValue {
  rowId: string
  columnId: string
  value: string
}

/** Flat object per the contract §5.1. */
export type Respuestas = Record<string, AnswerValue | undefined>

// ─── Optimistic UI helper types ────────────────────────────────────────────
export interface SectionScore {
  /** undefined when skipped — per §5.3 backend semantics. */
  subtotal?: number
  classification?: string | null
}

export interface InstrumentScore {
  subtotales: Record<string, number | undefined>
  puntajeTotal: number | null
  clasificacion: string | null
  /** Section ids the UI considers "skippable" given current answers. */
  skippedSectionIds: string[]
}
