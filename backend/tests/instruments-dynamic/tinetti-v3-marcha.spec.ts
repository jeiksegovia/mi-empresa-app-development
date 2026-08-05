import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  computeScore,
  validateRespuestas,
  type InstrumentDefinition,
} from '../../src/services/instrumentScoringService.js'

/**
 * qa-session-jul-31 followup (aug-04): TINETTI v3 gait fix (file-level, no DB).
 *
 * Gerontóloga flagged that v2 item 11 "pie derecho" mixed the left foot into the
 * right-foot item and did not match the originals. v3 fix:
 *  - two per-foot gait items, each with 4 options whose wording corresponds to
 *    the SAME foot named in the header (no cross-foot reference);
 *  - gait items renumbered 10..17 (unique labels);
 *  - total score unchanged vs v2 (risk thresholds stay valid).
 */

const TEMPLATE_DIR = fileURLToPath(new URL('../../prisma/instrument-templates/', import.meta.url))
const load = (f: string): InstrumentDefinition =>
  JSON.parse(readFileSync(resolve(TEMPLATE_DIR, f), 'utf8'))

const v3 = load('TINETTI.v3.json')
const v2 = load('TINETTI.v2.json')

function item(def: InstrumentDefinition, id: string) {
  return def.sections.flatMap((s: any) => s.items).find((i: any) => i.id === id)
}

test('v3 is version 3 with 2 sections', () => {
  expect(v3.version).toBe(3)
  expect(v3.sections.length).toBe(2)
})

test('items 11 (pie derecho) and 12 (pie izquierdo) each have 4 options', () => {
  const pd = item(v3, 'ma_pie_derecho')
  const pi = item(v3, 'ma_pie_izquierdo')
  expect(pd.label).toContain('11.')
  expect(pd.label).toContain('pie derecho')
  expect(pi.label).toContain('12.')
  expect(pi.label).toContain('pie izquierdo')
  expect(pd.options).toHaveLength(4)
  expect(pi.options).toHaveLength(4)
})

test('each foot item options correspond to its OWN foot (no cross-foot mix)', () => {
  const pd = item(v3, 'ma_pie_derecho')
  const pi = item(v3, 'ma_pie_izquierdo')
  for (const o of pd.options) {
    expect(o.label).toContain('derecho')
    expect(o.label).not.toContain('izquierdo')
  }
  for (const o of pi.options) {
    expect(o.label).toContain('izquierdo')
    expect(o.label).not.toContain('derecho')
  }
})

test('gait item labels are uniquely numbered 10..17', () => {
  const gait = v3.sections.find((s: any) => s.id === 'marcha') as any
  const nums = gait.items.map((i: any) => i.label.split('.')[0].trim())
  expect(nums).toEqual(['10', '11', '12', '13', '14', '15', '16', '17'])
})

test('v3 total max score equals v2 (risk thresholds preserved)', () => {
  function maxOf(def: InstrumentDefinition): number {
    const respuestas: Record<string, string> = {}
    for (const it of def.sections.flatMap((s: any) => s.items)) {
      if (it.type !== 'single-select-scored') continue
      const best = it.options.reduce((b: any, o: any) => (o.score > b.score ? o : b))
      respuestas[it.id] = best.value
    }
    validateRespuestas(def, respuestas)
    return computeScore(def, respuestas).total
  }
  expect(maxOf(v3)).toBe(maxOf(v2))
})
