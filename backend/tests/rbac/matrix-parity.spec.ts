/**
 * matrix-parity.spec.ts — fixes-jul17-2 W11 QA validation, Step 2.
 *
 * CELL-BY-CELL parity check between the backend authoritative matrix
 * (`backend/src/middleware/domainAccess.ts → DOMAIN_ACCESS`) and the
 * frontend mirror (`frontend/app/composables/useDomainAccess.ts → DOMAIN_ACCESS`).
 *
 * Contract §1.2: the matrix is FROZEN; the contract explicitly allows the
 * frontend to duplicate the constant — but the QA worker validates parity so a
 * silent drift cannot ship.
 *
 * This test READS both source files as text. It does NOT modify source. If a
 * mismatch is found it is reported as a BUG with the exact cells and filed in
 * gap-report.md.
 */

import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Backend authoritative source — W9 built this. Repo-relative path is
// stable because playwright runs from backend/.
const BACKEND_MATRIX_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'src',
  'middleware',
  'domainAccess.ts',
)

// Frontend mirror — W10 built this. Two levels up out of backend/, then into
// frontend/app/composables/.
const FRONTEND_MATRIX_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'frontend',
  'app',
  'composables',
  'useDomainAccess.ts',
)

/**
 * Pull a flat { profile → { domain → value } } record out of the matrix
 * block in either source file. The block looks like:
 *   export const DOMAIN_ACCESS = {
 *     GERONTOLOGA: { ... },
 *     CONTRATOS:   { ... },
 *   }
 * OR (frontend) a `Record<TipoEmpleado, Record<Domain, DomainAccessValue>>` type
 * annotation. We just extract the inner content between the outer `{` and `}`.
 */
function extractMatrix(src: string): Record<string, Record<string, string>> {
  const start = src.indexOf('export const DOMAIN_ACCESS')
  if (start < 0) throw new Error('DOMAIN_ACCESS export not found')
  // Find the first `{` (the outer block).
  const open = src.indexOf('{', start)
  if (open < 0) throw new Error('DOMAIN_ACCESS opening { not found')
  // Walk to the matching closing brace.
  let depth = 1
  let i = open + 1
  while (i < src.length && depth > 0) {
    const c = src[i]
    if (c === '{') depth++
    else if (c === '}') depth--
    i++
  }
  if (depth !== 0) throw new Error('DOMAIN_ACCESS closing } not found')
  const block = src.slice(open + 1, i - 1)
  // Now parse profile → { domain → value } lines.
  // Profile entry starts at column 2 (after `  `). Each profile contains
  // exactly 8 domain lines. Comment lines start with `//`.
  const profileRe = /^\s{2}(GERONTOLOGA|CONTRATOS):\s*{([\s\S]*?)\}/gm
  const out: Record<string, Record<string, string>> = {}
  let m: RegExpExecArray | null
  while ((m = profileRe.exec(block)) !== null) {
    const profile = m[1]
    const inner = m[2]
    const lines = inner.split('\n')
    const domains: Record<string, string> = {}
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('//')) continue
      const sep = trimmed.indexOf(':')
      if (sep < 0) continue
      const key = trimmed.slice(0, sep).trim()
      let val = trimmed.slice(sep + 1).trim()
      // strip trailing comma
      if (val.endsWith(',')) val = val.slice(0, -1).trim()
      domains[key] = val
    }
    out[profile] = domains
  }
  return out
}

test.describe('Matrix parity (fixes-jul17-2 §1.2, §1.5)', () => {
  test('DOMAIN_ACCESS cells match between backend and frontend, cell-by-cell', () => {
    const backendSrc = readFileSync(BACKEND_MATRIX_PATH, 'utf-8')
    const frontendSrc = readFileSync(FRONTEND_MATRIX_PATH, 'utf-8')

    const backendMatrix = extractMatrix(backendSrc)
    const frontendMatrix = extractMatrix(frontendSrc)

    // Sanity: both exports must contain the same profile keys.
    expect(Object.keys(backendMatrix).sort()).toEqual(['CONTRATOS', 'GERONTOLOGA'])
    expect(Object.keys(frontendMatrix).sort()).toEqual(['CONTRATOS', 'GERONTOLOGA'])

    // The full set of domains per §1.2.
    const expectedDomains = [
      'pacientes',
      'fichas',
      'instrumentos',
      'empleados',
      'nomina',
      'certificados',
      'empresa',
      'notas',
    ]

    const mismatches: string[] = []

    for (const profile of ['GERONTOLOGA', 'CONTRATOS'] as const) {
      for (const domain of expectedDomains) {
        const backendVal = backendMatrix[profile][domain]
        const frontendVal = frontendMatrix[profile][domain]
        if (!backendVal) {
          mismatches.push(`${profile}.${domain} → backend MISSING`)
          continue
        }
        if (!frontendVal) {
          mismatches.push(`${profile}.${domain} → frontend MISSING`)
          continue
        }
        if (backendVal !== frontendVal) {
          mismatches.push(
            `${profile}.${domain} → backend='${backendVal}' ≠ frontend='${frontendVal}'`,
          )
        }
      }
    }

    if (mismatches.length > 0) {
      // Per W11 rules: report as BUG with exact cells, do not silently mask.
      throw new Error(
        `Matrix parity FAILED (file BUG — fix the source, not the test):\n  - ${mismatches.join('\n  - ')}`,
      )
    }
    expect(mismatches).toEqual([])
  })

  test('Backend matrix has all 8 contract §1.2 domains for every profile', () => {
    const backendSrc = readFileSync(BACKEND_MATRIX_PATH, 'utf-8')
    const backendMatrix = extractMatrix(backendSrc)
    const expectedDomains = [
      'pacientes',
      'fichas',
      'instrumentos',
      'empleados',
      'nomina',
      'certificados',
      'empresa',
      'notas',
    ]
    for (const profile of ['GERONTOLOGA', 'CONTRATOS'] as const) {
      const domains = Object.keys(backendMatrix[profile]).sort()
      expect(domains, `${profile} backend domain set`).toEqual([...expectedDomains].sort())
    }
  })

  test('Frontend matrix has all 8 contract §1.2 domains for every profile', () => {
    const frontendSrc = readFileSync(FRONTEND_MATRIX_PATH, 'utf-8')
    const frontendMatrix = extractMatrix(frontendSrc)
    const expectedDomains = [
      'pacientes',
      'fichas',
      'instrumentos',
      'empleados',
      'nomina',
      'certificados',
      'empresa',
      'notas',
    ]
    for (const profile of ['GERONTOLOGA', 'CONTRATOS'] as const) {
      const domains = Object.keys(frontendMatrix[profile]).sort()
      expect(domains, `${profile} frontend domain set`).toEqual([...expectedDomains].sort())
    }
  })

  test('Verbatim matrix contents match contract §1.2', () => {
    // Authoritative cell-by-cell lock against the contract table. If this
    // test fails the contract has been violated; report as BUG.
    const backendSrc = readFileSync(BACKEND_MATRIX_PATH, 'utf-8')
    const frontendSrc = readFileSync(FRONTEND_MATRIX_PATH, 'utf-8')
    const backendMatrix = extractMatrix(backendSrc)
    const frontendMatrix = extractMatrix(frontendSrc)

    const expected: Record<string, Record<string, 'true' | 'false' | "'create-only'">> = {
      GERONTOLOGA: {
        pacientes: 'true',
        fichas: 'true',
        instrumentos: 'true',
        empleados: 'false',
        nomina: 'false',
        certificados: 'false',
        empresa: 'false',
        notas: 'true',
      },
      CONTRATOS: {
        pacientes: "'create-only'",
        fichas: 'false',
        instrumentos: 'false',
        empleados: 'true',
        nomina: 'true',
        certificados: 'true',
        empresa: 'false',
        notas: 'false',
      },
    }

    for (const profile of ['GERONTOLOGA', 'CONTRATOS'] as const) {
      for (const [domain, expectedVal] of Object.entries(expected[profile])) {
        expect(backendMatrix[profile][domain], `backend ${profile}.${domain}`).toBe(expectedVal)
        expect(frontendMatrix[profile][domain], `frontend ${profile}.${domain}`).toBe(expectedVal)
      }
    }
  })
})
