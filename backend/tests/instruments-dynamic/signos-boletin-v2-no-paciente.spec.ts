import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * qa-session-aug-6: SIGNOS_VITALES.v2 + BOLETIN_ANUAL.v2 drop patient personal fields
 * (cédula, nombre, edad, sexo) — those live on the paciente entity.
 */

const DIR = fileURLToPath(new URL('../../prisma/instrument-templates/', import.meta.url))
const load = (f: string) => JSON.parse(readFileSync(resolve(DIR, f), 'utf8'))

const personalIdHints = [
  'paciente_tipo_documento',
  'paciente_documento_otro',
  'paciente_nombre_completo',
  'paciente_edad',
  'paciente_sexo',
  'boletin_tipo_documento',
  'boletin_documento_otro',
  'boletin_numero_documento',
  'boletin_nombre_apellido',
  'boletin_edad',
  'boletin_sexo',
]

function allItemIds(def: any): string[] {
  return def.sections.flatMap((s: any) => (s.items || []).map((i: any) => i.id))
}

test('SIGNOS_VITALES.v2 has no paciente personal section/items', () => {
  const v2 = load('SIGNOS_VITALES.v2.json')
  expect(v2.version).toBe(2)
  expect(v2.sections.map((s: any) => s.id)).not.toContain('paciente')
  const ids = allItemIds(v2)
  for (const bad of personalIdHints) {
    expect(ids, `SIGNOS should not include ${bad}`).not.toContain(bad)
  }
  expect(ids).toContain('mediciones')
  expect(v2.scoring.total).toBe('none')
})

test('BOLETIN_ANUAL.v2 keeps periodo/componentes/autor; drops personal fields', () => {
  const v2 = load('BOLETIN_ANUAL.v2.json')
  expect(v2.version).toBe(2)
  expect(v2.sections.map((s: any) => s.id)).toEqual(['periodo', 'componentes', 'autor'])
  const ids = allItemIds(v2)
  for (const bad of personalIdHints) {
    expect(ids, `BOLETIN should not include ${bad}`).not.toContain(bad)
  }
  expect(ids).toContain('boletin_periodo_anio')
  expect(ids).toContain('boletin_psicologia')
  expect(ids).toContain('boletin_autor')
  expect(v2.scoring.total).toBe('none')
})
