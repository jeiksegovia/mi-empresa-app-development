import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  computeScore,
  validateRespuestas,
  type InstrumentDefinition,
  type ItemDef,
  type Respuestas,
} from '../../src/services/instrumentScoringService.js'

/**
 * File-level smokes for fixes-jul-22 instrument definitions.
 * These tests do not need a running API or database.
 */

const TEMPLATE_DIR = fileURLToPath(
  new URL('../../prisma/instrument-templates/', import.meta.url),
)

function loadTemplate(file: string): InstrumentDefinition {
  return JSON.parse(readFileSync(resolve(TEMPLATE_DIR, file), 'utf8')) as InstrumentDefinition
}

function findItem(definition: InstrumentDefinition, itemId: string): ItemDef {
  const item = definition.sections.flatMap((section) => section.items)
    .find((candidate) => candidate.id === itemId)
  expect(item, `missing item ${itemId}`).toBeDefined()
  return item!
}

function maxAnswers(definition: InstrumentDefinition): Respuestas {
  const respuestas: Respuestas = {}
  for (const item of definition.sections.flatMap((section) => section.items)) {
    if (item.type !== 'single-select-scored') continue
    const scoredOptions = (item.options ?? []).filter(
      (option): option is typeof option & { score: number } => typeof option.score === 'number',
    )
    const maximum = scoredOptions.reduce((best, option) => (
      option.score > best.score ? option : best
    ))
    respuestas[item.id] = maximum.value
  }
  return respuestas
}

function textMatrixDefinition(item: ItemDef): InstrumentDefinition {
  return {
    codigo: 'MATRIX_TEST',
    nombre: 'Matrix test',
    version: 1,
    tipo: 'NUTRICION',
    sections: [{ id: 'matrix', titulo: 'Matrix', items: [item] }],
    scoring: { total: 'none', resultEvaluation: [] },
  }
}

function allTextCells(item: ItemDef): Array<{ rowId: string; columnId: string; value: string }> {
  return (item.rows ?? []).flatMap((row) => (
    (item.columns ?? []).map((column) => ({
      rowId: row.id,
      columnId: column.id,
      value: `${row.id}-${column.id}`,
    }))
  ))
}

test.describe('fixes-jul-22 — TINETTI v2 template', () => {
  const v1 = loadTemplate('TINETTI.v1.json')
  const v2 = loadTemplate('TINETTI.v2.json')

  test('publishes immutable v2 with merged item ids only', () => {
    expect(v1.version).toBe(1)
    expect(v2.version).toBe(2)

    const ids = v2.sections.flatMap((section) => section.items.map((item) => item.id))
    expect(ids).toHaveLength(17)
    expect(ids).toContain('eq_vuelta_360')
    expect(ids).toContain('ma_pie_derecho')
    expect(ids).toContain('ma_pie_izquierdo')
    expect(ids).not.toEqual(expect.arrayContaining([
      'eq_vuelta_360_pasos',
      'eq_vuelta_360_estabilidad',
      'ma_pd_sobrepasa',
      'ma_pd_separa',
      'ma_pi_sobrepasa',
      'ma_pi_separa',
    ]))
    expect(v2.sections.flatMap((section) => section.items.map((item) => item.label)).join(' '))
      .not.toMatch(/\b(?:8a|8b|11a|11b|11c|11d)\b/i)
  })

  test('item 8 is one four-option single select scored 0/1/0/1', () => {
    const item = findItem(v2, 'eq_vuelta_360')
    expect(item.type).toBe('single-select-scored')
    expect(item.options).toEqual([
      expect.objectContaining({ value: 'pasos_discontinuos', score: 0 }),
      expect.objectContaining({ value: 'pasos_continuos', score: 1 }),
      expect.objectContaining({ value: 'inestable', score: 0 }),
      expect.objectContaining({ value: 'estable', score: 1 }),
    ])
  })

  test('each item 11 foot has four exclusive combinations scored 0/1/1/2', () => {
    for (const id of ['ma_pie_derecho', 'ma_pie_izquierdo']) {
      const item = findItem(v2, id)
      expect(item.type).toBe('single-select-scored')
      expect(item.options).toHaveLength(4)
      expect(item.options?.map((option) => option.score)).toEqual([0, 1, 1, 2])
    }
  })

  test('max path is coherent at equilibrio=15, marcha=12, total=27', () => {
    expect(v2.sections.find((section) => section.id === 'equilibrio')?.subtotal?.max).toBe(15)
    expect(v2.sections.find((section) => section.id === 'marcha')?.subtotal?.max).toBe(12)

    const result = computeScore(v2, maxAnswers(v2))
    expect(result.subtotales).toEqual({ equilibrio: 15, marcha: 12 })
    expect(result.puntajeTotal).toBe(27)
    expect(result.clasificacion).toBe('Riesgo bajo')
  })
})

test.describe('fixes-jul-22 — MNA_CUADRO v2 text cells', () => {
  const v1 = loadTemplate('MNA_CUADRO.v1.json')
  const v2 = loadTemplate('MNA_CUADRO.v2.json')
  const v1Item = findItem(v1, 'frecuencia_grupos')
  const v2Item = findItem(v2, 'frecuencia_grupos')

  test('v1 remains select-style and v2 declares cellInput=text', () => {
    expect(v1.version).toBe(1)
    expect(v1Item.cellInput).toBeUndefined()
    expect(v2.version).toBe(2)
    expect(v2Item.cellInput).toBe('text')
    expect(v2Item.rows).toHaveLength(7)
    expect(v2Item.columns).toHaveLength(4)
  })

  test('accepts and preserves all 28 row×column string cells', () => {
    const cells = allTextCells(v2Item)
    expect(cells).toHaveLength(28)
    const validation = validateRespuestas(textMatrixDefinition(v2Item), {
      [v2Item.id]: cells,
    })
    expect(validation).toEqual({ ok: true, skippedSections: [] })
  })

  test('rejects a missing coordinate', () => {
    const cells = allTextCells(v2Item).slice(1)
    const validation = validateRespuestas(textMatrixDefinition(v2Item), {
      [v2Item.id]: cells,
    })
    expect(validation.ok).toBe(false)
    if (!validation.ok) {
      expect(validation.error.code).toBe('INVALID_ANSWER_PAYLOAD')
      expect(validation.error.field).toBe('respuestas.frecuencia_grupos')
      expect(validation.error.message).toContain('Falta la celda')
    }
  })

  test('rejects unknown row and column coordinates', () => {
    const cells = allTextCells(v2Item)
    const unknownRow = cells.map((cell, index) => (
      index === 0 ? { ...cell, rowId: 'unknown-row' } : cell
    ))
    const rowValidation = validateRespuestas(textMatrixDefinition(v2Item), {
      [v2Item.id]: unknownRow,
    })
    expect(rowValidation.ok).toBe(false)
    if (!rowValidation.ok) {
      expect(rowValidation.error).toMatchObject({
        code: 'INVALID_ANSWER_PAYLOAD',
        field: 'respuestas.frecuencia_grupos',
      })
    }

    const unknownColumn = cells.map((cell, index) => (
      index === 0 ? { ...cell, columnId: 'unknown-column' } : cell
    ))
    const columnValidation = validateRespuestas(textMatrixDefinition(v2Item), {
      [v2Item.id]: unknownColumn,
    })
    expect(columnValidation.ok).toBe(false)
    if (!columnValidation.ok) {
      expect(columnValidation.error).toMatchObject({
        code: 'INVALID_ANSWER_PAYLOAD',
        field: 'respuestas.frecuencia_grupos',
      })
    }
  })

  test('rejects duplicate coordinates and non-string values', () => {
    const cells = allTextCells(v2Item)
    const duplicateValidation = validateRespuestas(textMatrixDefinition(v2Item), {
      [v2Item.id]: [...cells, cells[0]],
    })
    expect(duplicateValidation.ok).toBe(false)

    const badValue = cells.map((cell, index) => (
      index === 0 ? { ...cell, value: 3 as unknown as string } : cell
    ))
    const valueValidation = validateRespuestas(textMatrixDefinition(v2Item), {
      [v2Item.id]: badValue,
    })
    expect(valueValidation.ok).toBe(false)
  })
})

test.describe('fixes-jul-22 — VALORACION_INTEGRAL v1 template', () => {
  const definition = loadTemplate('VALORACION_INTEGRAL.v1.json')

  test('matches first-sheet scope with 11 sections and 47 unique items', () => {
    expect(definition).toMatchObject({
      codigo: 'VALORACION_INTEGRAL',
      nombre: 'Valoración Integral',
      version: 1,
      tipo: 'VALORACION',
      scoring: { total: 'none', resultEvaluation: [] },
    })
    expect(definition.sections.map((section) => section.id)).toEqual([
      'datos_generales',
      'informe_diagnostico',
      'antecedentes',
      'antecedentes_familiares',
      'estado_cognitivo',
      'estado_emocional_espiritual',
      'estado_social',
      'cuerpo',
      'diagnostico_plan_evoluciones',
      'acudiente_principal',
      'firma_profesional',
    ])

    const items = definition.sections.flatMap((section) => section.items)
    expect(items).toHaveLength(47)
    expect(new Set(items.map((item) => item.id)).size).toBe(47)
    expect(items.map((item) => item.id)).toEqual(expect.arrayContaining([
      'tipo_documento',
      'diagnostico_actual',
      'antecedentes_patologicos',
      'cognitivo_tiempo_espacio',
      'emocional_depresion',
      'social_integracion',
      'cuerpo_torax_abdomen',
      'diagnostico_integral',
      'plan_integral',
      'evoluciones',
      'acudiente_telefono',
      'firma_sello_profesional',
    ]))
  })

  test('uses informational item types only and null option scores', () => {
    const items = definition.sections.flatMap((section) => section.items)
    expect(items.some((item) => item.type === 'single-select-scored')).toBe(false)
    expect(new Set(items.map((item) => item.type))).toEqual(new Set([
      'text-info',
      'number-info',
      'single-select-info',
    ]))
    for (const item of items) {
      if (item.type === 'single-select-info') {
        expect(item.options?.length).toBeGreaterThanOrEqual(2)
        expect(item.options?.every((option) => option.score === null)).toBe(true)
      }
    }
  })

  test('valid required-field payload scores to null/null', () => {
    const respuestas: Respuestas = {}
    for (const item of definition.sections.flatMap((section) => section.items)) {
      if (!item.required) continue
      if (item.type === 'single-select-info') {
        respuestas[item.id] = item.options?.[0]?.value ?? ''
      } else if (item.type === 'number-info') {
        respuestas[item.id] = item.constraints?.min ?? 0
      } else if (item.type === 'text-info') {
        respuestas[item.id] = 'Dato de prueba'
      }
    }

    const validation = validateRespuestas(definition, respuestas)
    expect(validation).toEqual({ ok: true, skippedSections: [] })
    const score = computeScore(definition, respuestas)
    expect(score.puntajeTotal).toBeNull()
    expect(score.clasificacion).toBeNull()
  })
})
