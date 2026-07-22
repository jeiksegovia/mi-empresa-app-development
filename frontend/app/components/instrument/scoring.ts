/**
 * Optimistic UI-side scoring helper. Mirrors the backend engine per
 * contract §5.3 for the user's perceived immediacy; the server response
 * (or its scoring engine) is the authoritative value. See contract §5.4.
 *
 * Determinism: this module is a pure function over `(definition, respuestas)`.
 * Same inputs → same output. No external state, no side effects.
 *
 * Coverage:
 *   - Per-section subtotal (sum of selected single-select-scored option scores).
 *   - Per-section classification via `subtotal.resultEvaluation` (if defined).
 *   - Total = sum of subtotales of answered sections.
 *   - Global classification via `scoring.resultEvaluation`.
 *   - skipIf evaluation: §1.4 may-skip semantics — condition met ⇒ section
 *     eligible to be skipped. We mark a section as "eligible-skippable" when
 *     the condition is met AND none of its items are present in `respuestas`
 *     (matches backend at §5.3 step 3).
 */

import type {
  ClassificationRange,
  ConditionOp,
  InstrumentDefinition,
  InstrumentScore,
  Item,
  Respuestas,
  Section,
  SingleSelectScoredItem,
} from './types'

/** Sum of selected option scores for one item, or undefined if not scored. */
export function itemScore(item: Item, value: unknown): number | undefined {
  if (item.type !== 'single-select-scored') return undefined
  if (value === undefined || value === null || value === '') return undefined
  const opt = (item as SingleSelectScoredItem).options.find((o) => o.value === value)
  if (!opt) return undefined
  return typeof opt.score === 'number' ? opt.score : undefined
}

/** True when the item id appears as a key in respuestas. */
function hasAnswerFor(respuestas: Respuestas, itemId: string): boolean {
  const v = respuestas[itemId]
  if (v === undefined || v === null) return false
  if (typeof v === 'string' && v === '') return false
  if (Array.isArray(v) && v.length === 0) return false
  return true
}

function compare(a: number, op: ConditionOp, b: number): boolean {
  switch (op) {
    case '>=': return a >= b
    case '<=': return a <= b
    case '>':  return a >  b
    case '<':  return a <  b
    case '==': return a === b
    case '!=': return a !== b
  }
}

function classify(
  ranges: readonly ClassificationRange[] | undefined,
  total: number,
): string | null {
  if (!ranges || ranges.length === 0) return null
  for (const r of ranges) {
    if (total >= r.min && total <= r.max) return r.label
  }
  return null // engine never throws (§1.3); null + log in real backend
}

/** Condition met? `section.subtotal.resultEvaluation` MUST exist on the
 *  referenced section for skipIf to be a valid rule (contract §1.4). */
function skipIfMet(
  section: Section,
  triggerSubtotal: number | undefined,
): boolean {
  if (!section.condition?.skipIf) return false
  const { op, value } = section.condition.skipIf
  if (triggerSubtotal === undefined || triggerSubtotal === null) return false
  return compare(triggerSubtotal, op, value)
}

/**
 * Compute the optimistic InstrumentScore.
 *
 * Skipped-section rule (§1.4 / §5.3): a section is "skipped" iff its
 * skipIf condition is met AND none of its items are answered. When at
 * least one item is answered, the section scores normally and participates
 * in the global total. Partial-but-not-all answers with condition met
 * violates the contract (server returns 400 INVALID_ANSWER_PAYLOAD); the
 * UI surfaces this as a warning before submit.
 */
export function computeScore(
  definition: InstrumentDefinition,
  respuestas: Respuestas,
): InstrumentScore {
  const subtotales: Record<string, number | undefined> = {}
  const skippedSectionIds: string[] = []

  // First pass — compute each section's subtotal (or detect skippable).
  for (const section of definition.sections) {
    const anyAnswered = section.items.some((it) => hasAnswerFor(respuestas, it.id))

    if (section.condition?.skipIf) {
      // Resolve trigger subtotal by id (already computed into `subtotales`
      // above because triggers always come before dependents per §1.4).
      const triggerId = section.condition.skipIf.sectionId
      const trigger = definition.sections.find((s) => s.id === triggerId)
      if (!trigger) continue
      const triggerSubtotal = subtotales[triggerId]
      const met = skipIfMet(section, triggerSubtotal)

      if (met && !anyAnswered) {
        // Eligible-skippable ⇒ no subtotal entry.
        skippedSectionIds.push(section.id)
        continue
      }
      // Either condition not met (section required), or user opted-in to
      // answer some items anyway ⇒ score normally.
    }

    let sum = 0
    let anyScored = false
    for (const item of section.items) {
      const s = itemScore(item, respuestas[item.id])
      if (s !== undefined) {
        sum += s
        anyScored = true
      }
    }
    subtotales[section.id] = anyScored ? sum : undefined
  }

  // Total + classification.
  let puntajeTotal: number | null = null
  let clasificacion: string | null = null
  if (definition.scoring.total === 'none') {
    puntajeTotal = null
    clasificacion = null
  } else {
    let total = 0
    let anySection = false
    for (const section of definition.sections) {
      const sub = subtotales[section.id]
      if (typeof sub === 'number') {
        total += sub
        anySection = true
      }
    }
    puntajeTotal = anySection ? total : null

    if (skippedSectionIds.length > 0) {
      // §1.3 classification-source rule: when ANY section was skipped,
      // the classification comes from the trigger section's ranges
      // applied to that section's subtotal.
      const firstSkipped = definition.sections.find(
        (s) => s.id === skippedSectionIds[0],
      )
      if (firstSkipped?.condition?.skipIf) {
        const triggerId = firstSkipped.condition.skipIf.sectionId
        const trigger = definition.sections.find((s) => s.id === triggerId)
        const triggerSubtotal = subtotales[triggerId]
        if (trigger && typeof triggerSubtotal === 'number') {
          clasificacion = classify(trigger.subtotal?.resultEvaluation, triggerSubtotal)
        } else {
          clasificacion = null
        }
      } else {
        clasificacion = classify(definition.scoring.resultEvaluation, total)
      }
    } else {
      clasificacion = classify(definition.scoring.resultEvaluation, total)
    }
  }

  return { subtotales, puntajeTotal, clasificacion, skippedSectionIds }
}

/**
 * UI-side helper: a section is REQUIRED when:
 *  - It has no skipIf rule, OR
 *  - Its skipIf condition is NOT met, OR
 *  - Its skipIf condition IS met AND the user has already answered at
 *    least one of its items (the all-or-nothing opt-in).
 */
export function isSectionRequired(
  definition: InstrumentDefinition,
  section: Section,
  respuestas: Respuestas,
  triggerSubtotal: number | undefined,
): boolean {
  if (!section.condition?.skipIf) return true
  const met = skipIfMet(section, triggerSubtotal)
  if (!met) return true
  const anyAnswered = section.items.some((it) => hasAnswerFor(respuestas, it.id))
  return anyAnswered // §1.4: condition met + any answer ⇒ all required
}

/**
 * §1.4 partial-answer guard: condition met + SOME-but-not-ALL required
 * items answered. The server returns 400 INVALID_ANSWER_PAYLOAD. We
 * surface a warning before submit and disable it.
 */
export function hasPartialAnswers(
  definition: InstrumentDefinition,
  section: Section,
  respuestas: Respuestas,
  triggerSubtotal: number | undefined,
): boolean {
  if (!section.condition?.skipIf) return false
  const met = skipIfMet(section, triggerSubtotal)
  if (!met) return false
  const requiredItems = section.items.filter((it) => it.required)
  const answered = requiredItems.filter((it) => hasAnswerFor(respuestas, it.id)).length
  return answered > 0 && answered < requiredItems.length
}
