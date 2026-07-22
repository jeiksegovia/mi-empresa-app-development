/**
 * W4 — unit spec for `instrumentScoringService`.
 *
 * Loads the REAL seeded definitions from Postgres (instrumento_versiones) so the
 * engine is tested against the contract shapes, not copies. Deterministic fixtures:
 * no random data, no time mocks.
 *
 * Coverage per task #19 acceptance:
 *   - Per instrument — all-min → 0 / worst label; all-max → canonical max / best label.
 *     BARTHEL 100, MINI_MENTAL 30, TINETTI 28, YESAVAGE 15, MNA 30, FICHA_NUTRICIONAL → null/null.
 *   - Every resultEvaluation boundary (min and max of each range hit exactly).
 *   - MNA specials:
 *       - cribaje=11 → evaluación required (validated).
 *       - cribaje=12 + evaluación absent → skipped, clasificacion "Estado nutricional normal", total=12.
 *       - cribaje=12 + evaluación fully answered → global ranges apply.
 *       - cribaje=12 + evaluación partial → INVALID_ANSWER_PAYLOAD.
 *   - Yesavage reverse-scored items (1,5,7,11,13: "no" scores 1).
 *
 * NOT a Playwright HTTP test — runs in-process against the Prisma client. Mirrors the
 * style of W2's seed-definitions.spec.ts.
 */
import { test, expect } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/index.js';

import {
  validateRespuestas,
  computeScore,
  validateAndScore,
  type InstrumentDefinition,
  type Respuestas,
  type OptionDef,
  type SectionDef,
  type ItemDef,
} from '../../src/services/instrumentScoringService.js';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://miempresa:miempresa123@localhost:15432/miempresa_dev';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Helpers — build fixtures from a real definition, picking the score-0 vs the
// max-score option for each single-select-scored item.
// ---------------------------------------------------------------------------

interface ItemFixtures {
  minAnswer: Record<string, string>
  maxAnswer: Record<string, string>
  ranges: Array<{ min: number; max: number; label: string }>
}

function buildFixtures(definition: InstrumentDefinition): ItemFixtures {
  const minAnswer: Record<string, string> = {}
  const maxAnswer: Record<string, string> = {}
  for (const section of definition.sections) {
    for (const item of section.items) {
      if (item.type !== 'single-select-scored' || !item.options) continue
      const scored = item.options.filter((o): o is OptionDef & { score: number } => typeof o.score === 'number')
      if (scored.length === 0) continue
      const minOpt = scored.reduce((a, b) => (a.score < b.score ? a : b))
      const maxOpt = scored.reduce((a, b) => (a.score > b.score ? a : b))
      minAnswer[item.id] = minOpt.value
      maxAnswer[item.id] = maxOpt.value
    }
  }
  const ranges =
    definition.scoring.total === 'sum'
      ? definition.scoring.resultEvaluation
      : []
  return { minAnswer, maxAnswer, ranges }
}

/** Walk every range boundary; return the closest total that lands EXACTLY on each boundary. */
function boundaryAnswers(
  definition: InstrumentDefinition,
  boundaryTotals: number[],
): Record<string, Respuestas> {
  const out: Record<string, Respuestas> = {}
  for (const target of boundaryTotals) {
    out[String(target)] = buildAnswerWithTotal(definition, target)
  }
  return out
}

/** Greedy: pick max-score options first until target reached, then top-up with smaller options. */
function buildAnswerWithTotal(definition: InstrumentDefinition, target: number): Respuestas {
  const answers: Respuestas = {}
  let remaining = target
  // Collect all scored items across sections, ordered by descending max score.
  const pool: Array<{ section: SectionDef; item: ItemDef; opts: (OptionDef & { score: number })[] }> = []
  for (const section of definition.sections) {
    for (const item of section.items) {
      if (item.type !== 'single-select-scored' || !item.options) continue
      const scored = item.options.filter(
        (o): o is OptionDef & { score: number } => typeof o.score === 'number',
      )
      if (scored.length === 0) continue
      pool.push({ section, item, opts: scored })
    }
  }
  // Greedy fill: for each item, pick the highest score <= remaining.
  for (const { item, opts } of pool) {
    const feasible = opts.filter((o) => o.score <= remaining)
    if (feasible.length === 0) {
      // No feasible option — pick 0 to keep total under target.
      const zero = opts.reduce((a, b) => (a.score < b.score ? a : b))
      answers[item.id] = zero.value
      continue
    }
    const best = feasible.reduce((a, b) => (a.score > b.score ? a : b))
    answers[item.id] = best.value
    remaining -= best.score
  }
  return answers
}

// ---------------------------------------------------------------------------
// Load real definitions once.
// ---------------------------------------------------------------------------

const definitions: Record<string, InstrumentDefinition> = {}
const rangeCases: Array<{
  codigo: string
  ranges: Array<{ min: number; max: number; label: string }>
}> = []

test.beforeAll(async () => {
  const codigos = ['BARTHEL', 'MINI_MENTAL', 'TINETTI', 'YESAVAGE', 'MNA_CUADRO', 'FICHA_NUTRICIONAL']
  for (const codigo of codigos) {
    const inst = await prisma.instrumento.findUnique({ where: { codigo } })
    expect(inst, `Instrumento row missing for codigo=${codigo}`).not.toBeNull()
    const version = await prisma.instrumentoVersion.findFirst({
      where: { instrumentoId: inst!.id, activo: true },
    })
    expect(version, `No active InstrumentoVersion for ${codigo}`).not.toBeNull()
    definitions[codigo] = version!.definition as unknown as InstrumentDefinition
    if (definitions[codigo].scoring.total === 'sum') {
      rangeCases.push({ codigo, ranges: definitions[codigo].scoring.resultEvaluation })
    }
  }
})

test.afterAll(async () => {
  await prisma.$disconnect()
})

// ===========================================================================
// Per-instrument: all-min → worst, all-max → canonical max + best label
// ===========================================================================

test.describe('W4 scoring engine — per-instrument all-min / all-max', () => {
  const allMaxExpectations: Array<{ codigo: string; maxTotal: number; bestLabel: string }> = [
    { codigo: 'BARTHEL', maxTotal: 100, bestLabel: 'Dependencia ligera' },
    { codigo: 'MINI_MENTAL', maxTotal: 30, bestLabel: 'Normal' },
    { codigo: 'TINETTI', maxTotal: 28, bestLabel: 'Riesgo bajo' },
    { codigo: 'YESAVAGE', maxTotal: 15, bestLabel: 'Depresión establecida' },
    { codigo: 'MNA_CUADRO', maxTotal: 30, bestLabel: 'Estado nutricional normal' },
  ]

  for (const { codigo, maxTotal, bestLabel } of allMaxExpectations) {
    test(`${codigo} all-max → total=${maxTotal}, clasificacion="${bestLabel}"`, () => {
      const def = definitions[codigo]
      const { maxAnswer } = buildFixtures(def)
      const result = computeScore(def, maxAnswer)
      expect(result.puntajeTotal).toBe(maxTotal)
      expect(result.clasificacion).toBe(bestLabel)
      expect(result.skippedSections).toEqual([])
    })

    test(`${codigo} all-min → total=0, worst classification`, () => {
      const def = definitions[codigo]
      const { minAnswer, ranges } = buildFixtures(def)
      const result = computeScore(def, minAnswer)
      expect(result.puntajeTotal).toBe(0)
      const worstRange = ranges.find((r) => r.min <= 0 && r.max >= 0)
      expect(worstRange, `${codigo} ranges should include 0`).toBeDefined()
      expect(result.clasificacion).toBe(worstRange!.label)
    })
  }

  test('FICHA_NUTRICIONAL all-filled → puntajeTotal=null, clasificacion=null', () => {
    const def = definitions['FICHA_NUTRICIONAL']
    const all = buildCompleteAnswer(def)
    const validation = validateRespuestas(def, all)
    expect(validation.ok, JSON.stringify(validation)).toBe(true)
    const result = computeScore(def, all)
    expect(result.puntajeTotal).toBeNull()
    expect(result.clasificacion).toBeNull()
    expect(result.skippedSections).toEqual([])
  })
})

// ===========================================================================
// Every resultEvaluation boundary hit exactly.
// ===========================================================================

test.describe('W4 scoring engine — resultEvaluation boundaries', () => {
  for (const { codigo, ranges } of rangeCases) {
    for (const range of ranges) {
      test(`${codigo}: hitting min=${range.min} → label="${range.label}"`, () => {
        const def = definitions[codigo]
        const answers = buildAnswerWithTotal(def, range.min)
        const result = computeScore(def, answers)
        expect(result.puntajeTotal).toBe(range.min)
        expect(result.clasificacion).toBe(range.label)
      })

      test(`${codigo}: hitting max=${range.max} → label="${range.label}"`, () => {
        const def = definitions[codigo]
        const answers = buildAnswerWithTotal(def, range.max)
        const result = computeScore(def, answers)
        expect(result.puntajeTotal).toBe(range.max)
        expect(result.clasificacion).toBe(range.label)
      })
    }
  }
})

// ===========================================================================
// MNA specials — cribaje/evaluación conditional logic
// ===========================================================================

test.describe('W4 scoring engine — MNA MAY-skip semantics', () => {
  test('cribaje=11 → evaluación required (validation fails if absent)', () => {
    const def = definitions['MNA_CUADRO']
    const cribaje = mnaCribajeAnswer(11)
    const validation = validateRespuestas(def, cribaje)
    // 11 < 12 → condición NO cumplida → evaluación required → sin respuestas para evaluación → INVALID_ANSWER_PAYLOAD
    expect(validation.ok).toBe(false)
    if (!validation.ok) {
      expect(validation.error.code).toBe('INVALID_ANSWER_PAYLOAD')
    }
  })

  test('cribaje=12 + evaluación absent → skipped, clasificacion "Estado nutricional normal", total=12', () => {
    const def = definitions['MNA_CUADRO']
    const cribaje = mnaCribajeAnswer(12)
    const cuadro = mnaCuadroAlimentosAnswer()
    const payload = { ...cribaje, ...cuadro }

    const validation = validateRespuestas(def, payload)
    expect(validation.ok, JSON.stringify(validation)).toBe(true)
    if (validation.ok) {
      expect(validation.skippedSections).toContain('evaluacion')
    }

    const result = computeScore(def, payload)
    expect(result.skippedSections).toContain('evaluacion')
    expect(result.subtotales['evaluacion']).toBeUndefined()
    expect(result.puntajeTotal).toBe(12)
    expect(result.clasificacion).toBe('Estado nutricional normal')
  })

  test('cribaje=12 + evaluación fully answered → global ranges apply', () => {
    const def = definitions['MNA_CUADRO']
    const cribaje = mnaCribajeAnswer(12)
    const evaluacion = mnaEvaluacionMaxAnswer() // 16 points
    const cuadro = mnaCuadroAlimentosAnswer()
    const payload = { ...cribaje, ...evaluacion, ...cuadro }

    const validation = validateRespuestas(def, payload)
    expect(validation.ok, JSON.stringify(validation)).toBe(true)
    if (validation.ok) {
      expect(validation.skippedSections).not.toContain('evaluacion')
    }

    const result = computeScore(def, payload)
    // 12 + 16 = 28 → "Estado nutricional normal" (24-30 range, global)
    expect(result.puntajeTotal).toBe(28)
    expect(result.clasificacion).toBe('Estado nutricional normal')
  })

  test('cribaje=12 + evaluación partial → INVALID_ANSWER_PAYLOAD', () => {
    const def = definitions['MNA_CUADRO']
    const cribaje = mnaCribajeAnswer(12)
    const cuadro = mnaCuadroAlimentosAnswer()
    // Answer only the FIRST item of evaluación (g_vive_independiente) → partial → INVALID.
    const evaluacionPartial: Respuestas = { g_vive_independiente: 'si' }
    const payload = { ...cribaje, ...evaluacionPartial, ...cuadro }

    const validation = validateRespuestas(def, payload)
    expect(validation.ok).toBe(false)
    if (!validation.ok) {
      expect(validation.error.code).toBe('INVALID_ANSWER_PAYLOAD')
    }
  })
})

// ===========================================================================
// Yesavage reverse-scored items (1, 5, 7, 11, 13: "no" scores 1)
// ===========================================================================

test.describe('W4 scoring engine — Yesavage reverse-scoring', () => {
  test('reverse-scored items: "no" answers contribute 1 each', () => {
    const def = definitions['YESAVAGE']
    // Answer "no" to every item → expect 5 points (items 1,5,7,11,13).
    const answers: Respuestas = {}
    for (const item of def.sections[0].items) {
      answers[item.id] = 'no'
    }
    const result = computeScore(def, answers)
    expect(result.puntajeTotal).toBe(5)
    expect(result.clasificacion).toBe('No depresión')
  })

  test('forward-scored items: "si" answers contribute 1 each', () => {
    const def = definitions['YESAVAGE']
    // Answer "si" to every item → expect 10 points (items 2,3,4,6,8,9,10,12,14,15).
    const answers: Respuestas = {}
    for (const item of def.sections[0].items) {
      answers[item.id] = 'si'
    }
    const result = computeScore(def, answers)
    expect(result.puntajeTotal).toBe(10)
    expect(result.clasificacion).toBe('Depresión establecida')
  })
})

// ===========================================================================
// Validation: invalid inputs
// ===========================================================================

test.describe('W4 scoring engine — validation failures', () => {
  test('unknown key → INVALID_ANSWER_PAYLOAD', () => {
    const def = definitions['BARTHEL']
    const { maxAnswer } = buildFixtures(def)
    const result = validateRespuestas(def, { ...maxAnswer, fantasma: 'independiente' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_ANSWER_PAYLOAD')
      expect(result.error.field).toBe('respuestas.fantasma')
    }
  })

  test('INVALID_OPTION on a single-select-scored item', () => {
    const def = definitions['BARTHEL']
    const { maxAnswer } = buildFixtures(def)
    const bad = { ...maxAnswer, comida: 'opcion_inexistente' }
    const result = validateRespuestas(def, bad)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_OPTION')
      expect(result.error.field).toBe('respuestas.comida')
    }
  })

  test('OUT_OF_RANGE on number-info outside constraints', () => {
    const def = definitions['MNA_CUADRO']
    const payload: Respuestas = {
      ...mnaCribajeAnswer(12),
      ...mnaCuadroAlimentosAnswer(),
      f1_peso: 19, // below min 20
      f2_talla: 165,
    }
    const result = validateRespuestas(def, payload)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('OUT_OF_RANGE')
      expect(result.error.field).toBe('respuestas.f1_peso')
    }
  })

  test('missing required item → INVALID_ANSWER_PAYLOAD', () => {
    const def = definitions['BARTHEL']
    const { maxAnswer } = buildFixtures(def)
    const { comida: _omit, ...withoutComida } = maxAnswer
    const result = validateRespuestas(def, withoutComida)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_ANSWER_PAYLOAD')
      expect(result.error.field).toBe('respuestas.comida')
    }
  })

  test('group-info: missing a row → INVALID_ANSWER_PAYLOAD', () => {
    const def = definitions['MNA_CUADRO']
    const cuadroItem = def.sections.find((s) => s.id === 'cuadro_alimentos')!.items[0]
    const partialGroup = cuadroItem.rows!.slice(0, 3).map((r) => ({
      rowId: r.id,
      columnId: 'diario',
    }))
    const payload: Respuestas = {
      ...mnaCribajeAnswer(12),
      [cuadroItem.id]: partialGroup,
    }
    const result = validateRespuestas(def, payload)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_ANSWER_PAYLOAD')
    }
  })

  test('group-info: invalid columnId → INVALID_ANSWER_PAYLOAD', () => {
    const def = definitions['MNA_CUADRO']
    const cuadroItem = def.sections.find((s) => s.id === 'cuadro_alimentos')!.items[0]
    const allRows = cuadroItem.rows!.map((r) => ({
      rowId: r.id,
      columnId: 'no_existe',
    }))
    const payload: Respuestas = {
      ...mnaCribajeAnswer(12),
      [cuadroItem.id]: allRows,
    }
    const result = validateRespuestas(def, payload)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_ANSWER_PAYLOAD')
    }
  })

  test('text-info: number value rejected', () => {
    const def = definitions['FICHA_NUTRICIONAL']
    const payload = buildCompleteAnswer(def, { p1_enfermedades: 42 as unknown as string })
    const result = validateRespuestas(def, payload)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_ANSWER_PAYLOAD')
    }
  })
})

// ===========================================================================
// Helpers: MNA-specific answer fixtures
// ===========================================================================

function mnaCribajeAnswer(target: number): Respuestas {
  // Choose the option with score 2 wherever possible (a_apetito="igual", b_peso="sin_perdida"=3, …).
  // We construct a cribaje that lands on EXACTLY `target`.
  const cribaje = definitions['MNA_CUADRO'].sections.find((s) => s.id === 'cribaje')!
  const answers: Respuestas = {}
  // f1_peso + f2_talla are required to satisfy validation but contribute 0 to subtotal.
  answers['f1_peso'] = 70
  answers['f2_talla'] = 165
  let remaining = target
  for (const item of cribaje.items) {
    if (!item.options) continue
    if (item.id === 'f1_peso' || item.id === 'f2_talla') continue
    const scored = item.options.filter(
      (o): o is OptionDef & { score: number } => typeof o.score === 'number',
    )
    const feasible = scored.filter((o) => o.score <= remaining)
    const pick = feasible.length > 0
      ? feasible.reduce((a, b) => (a.score > b.score ? a : b))
      : scored.reduce((a, b) => (a.score < b.score ? a : b))
    answers[item.id] = pick.value
    remaining -= pick.score
  }
  return answers
}

function mnaEvaluacionMaxAnswer(): Respuestas {
  const evalSec = definitions['MNA_CUADRO'].sections.find((s) => s.id === 'evaluacion')!
  const answers: Respuestas = {}
  for (const item of evalSec.items) {
    if (!item.options) continue
    const scored = item.options.filter(
      (o): o is OptionDef & { score: number } => typeof o.score === 'number',
    )
    const best = scored.reduce((a, b) => (a.score > b.score ? a : b))
    answers[item.id] = best.value
  }
  return answers
}

function mnaCuadroAlimentosAnswer(): Respuestas {
  const cuadroItem = definitions['MNA_CUADRO'].sections.find((s) => s.id === 'cuadro_alimentos')!.items[0]
  return {
    [cuadroItem.id]: cuadroItem.rows!.map((r) => ({ rowId: r.id, columnId: 'diario' })),
  }
}

function buildCompleteAnswer(def: InstrumentDefinition, overrides: Respuestas = {}): Respuestas {
  const answers: Respuestas = {}
  for (const section of def.sections) {
    for (const item of section.items) {
      if (overrides[item.id] !== undefined) {
        answers[item.id] = overrides[item.id]
        continue
      }
      switch (item.type) {
        case 'single-select-scored':
        case 'single-select-info':
          answers[item.id] = item.options?.[0]?.value ?? ''
          break
        case 'number-info': {
          const c = item.constraints ?? {}
          const min = c.min ?? 0
          const max = c.max ?? 100
          const mid = (min + max) / 2
          answers[item.id] = mid
          break
        }
        case 'text-info':
          answers[item.id] = 'texto de prueba'
          break
        case 'group-info':
          answers[item.id] = (item.rows ?? []).map((r) => ({
            rowId: r.id,
            columnId: item.columns?.[0]?.id ?? '',
          }))
          break
      }
    }
  }
  return answers
}

// ===========================================================================
// validateAndScore: convenience wrapper
// ===========================================================================

test.describe('W4 scoring engine — validateAndScore wrapper', () => {
  test('valid payload returns ScoreResult', () => {
    const def = definitions['BARTHEL']
    const { maxAnswer } = buildFixtures(def)
    const result = validateAndScore(def, maxAnswer)
    expect(result.puntajeTotal).toBe(100)
  })

  test('invalid payload throws InstrumentScoringError', () => {
    const def = definitions['BARTHEL']
    const { maxAnswer } = buildFixtures(def)
    const bad = { ...maxAnswer, comida: 'fantasma' }
    let caught: unknown = null
    try {
      validateAndScore(def, bad)
    } catch (e) {
      caught = e
    }
    expect(caught).not.toBeNull()
    expect((caught as { code: string }).code).toBe('INVALID_OPTION')
    expect((caught as { field: string }).field).toBe('respuestas.comida')
  })
})