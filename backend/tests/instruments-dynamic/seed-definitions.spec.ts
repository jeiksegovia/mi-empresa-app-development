import { test, expect } from '@playwright/test';

/**
 * W2 smoke spec — verifies the 6 dynamic instruments have been seeded with active v1 versions.
 *
 * Direct-prisma style: imports PrismaClient directly and asserts on the seed results.
 * This is an integration test that runs against the local DB; if the seed has not been
 * applied yet, it fails loudly with the specific missing instruments.
 *
 * Coverage (per task #15 acceptance):
 *   - 6 Instrumento rows present with the contract codigos
 *   - 6 active InstrumentoVersion rows (one per codigo, version=1, activo=true)
 *   - Each `definition` JSON parses and has the expected number of sections:
 *       BARTHEL=1, MINI_MENTAL=11, TINETTI=2, YESAVAGE=1, MNA_CUADRO=3, FICHA_NUTRICIONAL=4
 *   - Partial unique index ensures exactly ONE active version per codigo
 *
 * NOTE: This spec is NOT marked as `.skip` even though W2's migration is gated. Running it
 * before migration/seed will fail with a clear "missing codigo" assertion. That's intentional.
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/index.js';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://miempresa:miempresa123@localhost:15432/miempresa_dev';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const EXPECTED: Array<{ codigo: string; sectionCount: number }> = [
  { codigo: 'BARTHEL', sectionCount: 1 },
  { codigo: 'MINI_MENTAL', sectionCount: 11 },
  { codigo: 'TINETTI', sectionCount: 2 },
  { codigo: 'YESAVAGE', sectionCount: 1 },
  { codigo: 'MNA_CUADRO', sectionCount: 3 },
  { codigo: 'FICHA_NUTRICIONAL', sectionCount: 4 },
];

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe('W2 — dynamic instruments seed (6 codigos with active v1)', () => {
  test('all 6 Instrumento rows exist with the contract codigos', async () => {
    for (const { codigo } of EXPECTED) {
      const inst = await prisma.instrumento.findUnique({ where: { codigo } });
      expect(inst, `Instrumento row missing for codigo=${codigo}`).not.toBeNull();
    }
  });

  test('each codigo has exactly one active InstrumentoVersion row (v1)', async () => {
    for (const { codigo } of EXPECTED) {
      const inst = await prisma.instrumento.findUnique({ where: { codigo } });
      expect(inst, `codigo=${codigo} missing`).not.toBeNull();

      const activeVersions = await prisma.instrumentoVersion.findMany({
        where: { instrumentoId: inst!.id, activo: true },
      });
      expect(
        activeVersions.length,
        `codigo=${codigo}: expected exactly 1 active version, got ${activeVersions.length}`,
      ).toBe(1);
      expect(activeVersions[0].version).toBe(1);
    }
  });

  test('each definition JSON parses and has the expected section count', async () => {
    for (const { codigo, sectionCount } of EXPECTED) {
      const inst = await prisma.instrumento.findUnique({ where: { codigo } });
      const active = await prisma.instrumentoVersion.findFirst({
        where: { instrumentoId: inst!.id, activo: true },
      });
      expect(active, `codigo=${codigo}: no active version`).not.toBeNull();

      const def = active!.definition as unknown as { sections: unknown[] };
      expect(
        Array.isArray(def.sections),
        `codigo=${codigo}: definition.sections is not an array`,
      ).toBe(true);
      expect(
        def.sections.length,
        `codigo=${codigo}: expected ${sectionCount} sections, got ${def.sections.length}`,
      ).toBe(sectionCount);
    }
  });

  test('partial unique index: only ONE activo=true row per instrumentoId', async () => {
    // This test verifies the partial unique index by attempting to create a SECOND active row
    // for an existing instrumento — must throw a unique-violation.
    const sample = await prisma.instrumentoVersion.findFirst({
      where: { activo: true },
    });
    expect(sample, 'no active versions exist (seed not run?)').not.toBeNull();

    let threw = false;
    try {
      await prisma.instrumentoVersion.create({
        data: {
          instrumentoId: sample!.instrumentoId,
          version: 9999,
          definition: { codigo: 'TEST', sections: [], scoring: { total: 'none', resultEvaluation: [] } },
          activo: true,
          createdBy: sample!.createdBy,
        },
      });
    } catch (err) {
      threw = true;
      // Postgres unique_violation SQLSTATE 23505
      expect(String((err as Error).message)).toMatch(/23501|23505|unique/i);
    } finally {
      // Cleanup if it somehow got created (should not happen due to the index)
      await prisma.instrumentoVersion.deleteMany({
        where: { instrumentoId: sample!.instrumentoId, version: 9999 },
      });
    }
    expect(threw, 'partial unique index did NOT block a second activo=true row').toBe(true);
  });
});