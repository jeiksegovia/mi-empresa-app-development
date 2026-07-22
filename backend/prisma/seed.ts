/**
 * Mi Empresa App - Database Seed Script
 * Populates database with sample data for development
 *
 * NOTE (W2 — instrumentos-dynamic-fichas, 2026-07-17):
 *   This seed was scoped down to the W2 deliverables. Legacy empleado/nomina/cliente/
 *   registro/nota/finance sections were authored before several schema tightenings
 *   (TipoVivienda enum, certificado consolidation into CertificadoEmpleado) and would
 *   fail with PrismaClientValidationError on a current DB. Those legacy sections are
 *   intentionally NOT recreated here — they are out of W2 scope. The seed now does:
 *     1. Clean slate (dev only)
 *     2. Create 4 users + 1 empresa
 *     3. Create 3 placeholder instruments (FVM-001 / NUT-001 / ADM-001)
 *     4. Upsert 6 dynamic instruments + active v1 (idempotent — re-runnable)
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/index.js';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seed...');

  // Safety guard: refuse to run against deployed stage DBs (staging/prod) unless forced.
  const dbName = new URL(connectionString).pathname;
  if (/(staging|prod)/i.test(dbName) && process.env.FORCE_SEED !== 'true') {
    console.error(`❌ Refusing to seed ${dbName}: it looks like a deployed stage database.`);
    console.error('   This script deletes ALL data first. Set FORCE_SEED=true to override.');
    process.exit(1);
  }

  // Clean existing data in development (rev. ordered to respect FKs)
  if (process.env.NODE_ENV !== 'production') {
    console.log('🧹 Cleaning existing data...');
    const clean = async (label: string, fn: () => Promise<unknown>) => {
      try {
        const r = await fn();
        console.log(`  ✓ ${label}: ${(r as { count?: number })?.count ?? 'ok'}`);
      } catch (e) {
        console.error(`  ✗ ${label} FAILED:`, (e as Error).message);
        throw e;
      }
    };
    await clean('sesion', () => prisma.sesion.deleteMany());
    await clean('notaCliente', () => prisma.notaCliente.deleteMany());
    await clean('registroFichaCompletada', () => prisma.registroFichaCompletada.deleteMany());
    await clean('instrumentoVersion', () => prisma.instrumentoVersion.deleteMany());
    await clean('instrumento', () => prisma.instrumento.deleteMany());
    await clean('certificadoUpdate', () => prisma.certificadoUpdate.deleteMany());
    await clean('certificadoEmpresa', () => prisma.certificadoEmpresa.deleteMany());
    await clean('pendienteEmpleado', () => prisma.pendienteEmpleado.deleteMany());
    await clean('novedadEmpleado', () => prisma.novedadEmpleado.deleteMany());
    await clean('contactoEmergenciaCliente', () => prisma.contactoEmergenciaCliente.deleteMany());
    await clean('prefactura', () => prisma.prefactura.deleteMany());
    await clean('cliente', () => prisma.cliente.deleteMany());
    await clean('egreso', () => prisma.egreso.deleteMany());
    await clean('productoServicio', () => prisma.productoServicio.deleteMany());
    await clean('centroCostos', () => prisma.centroCostos.deleteMany());
    await clean('ausentismo', () => prisma.ausentismo.deleteMany());
    await clean('gestionTiempoVacaciones', () => prisma.gestionTiempoVacaciones.deleteMany());
    await clean('comprobantePago', () => prisma.comprobantePago.deleteMany());
    await clean('beneficio', () => prisma.beneficio.deleteMany());
    await clean('deduccionSalario', () => prisma.deduccionSalario.deleteMany());
    await clean('nomina', () => prisma.nomina.deleteMany());
    await clean('datosMigracion', () => prisma.datosMigracion.deleteMany());
    await clean('vehiculo', () => prisma.vehiculo.deleteMany());
    await clean('educacionIdiomas', () => prisma.educacionIdiomas.deleteMany());
    await clean('experienciaLaboralExterna', () => prisma.experienciaLaboralExterna.deleteMany());
    await clean('cargo', () => prisma.cargo.deleteMany());
    await clean('contactoEmergenciaEmpleado', () => prisma.contactoEmergenciaEmpleado.deleteMany());
    await clean('nucleoFamiliar', () => prisma.nucleoFamiliar.deleteMany());
    await clean('empleado', () => prisma.empleado.deleteMany());
    await clean('usuario', () => prisma.usuario.deleteMany());
    await clean('empresa', () => prisma.empresa.deleteMany());
  }

  // 1. Users
  console.log('👤 Creating users...');
  const passwordHash = await bcrypt.hash('password123', 10);
  const admin = await prisma.usuario.create({
    data: { email: 'admin@miempresa.com', password: passwordHash, rol: 'ADMIN', nombre: 'Admin', apellido: 'Sistema', activo: true },
  });
  const empleado1User = await prisma.usuario.create({
    data: { email: 'empleado@miempresa.com', password: passwordHash, rol: 'EMPLEADO', nombre: 'Carlos', apellido: 'Rodríguez', activo: true },
  });
  const auditor = await prisma.usuario.create({
    data: { email: 'auditor@miempresa.com', password: passwordHash, rol: 'AUDITOR', nombre: 'María', apellido: 'González', activo: true },
  });
  const operador = await prisma.usuario.create({
    data: { email: 'operador@miempresa.com', password: passwordHash, rol: 'OPERADOR', nombre: 'Ana', apellido: 'Martínez', activo: true },
  });
  console.log('  ✓ created 4 users');

  // 2. Default empresa
  console.log('🏢 Creating default empresa...');
  await prisma.empresa.create({
    data: {
      nombre: 'Mi Empresa S.A.S.',
      nit: '900123456-1',
      direccion: 'Calle 100 # 15-20, Bogotá',
      telefono: '6014567890',
      email: 'info@miempresa.com',
      activa: true,
    },
  });
  console.log('  ✓ created 1 empresa');

  // 3. Placeholder legacy instruments (FVM-001, NUT-001, ADM-001) — keep for backwards compat
  //    with W4's API endpoints that may still reference them. NOT a W2 deliverable but harmless.
  console.log('📋 Creating legacy placeholder instruments...');
  const legacyInstruments = [
    { codigo: 'FVM-001', nombreInstrumento: 'Ficha de Valoración Médica Inicial', descripcion: 'Evaluación médica inicial del paciente', tipo: 'VALORACION' as const, periodicidad: 'ANUAL' as const, rolesPermitidos: 'ADMIN,EMPLEADO' },
    { codigo: 'NUT-001', nombreInstrumento: 'Plan Nutricional', descripcion: 'Evaluación y plan nutricional personalizado', tipo: 'NUTRICION' as const, periodicidad: 'TRIMESTRAL' as const, rolesPermitidos: 'ADMIN,EMPLEADO,OPERADOR' },
    { codigo: 'ADM-001', nombreInstrumento: 'Formulario de Admisión', descripcion: 'Proceso de admisión de nuevo paciente', tipo: 'ADMISION' as const, periodicidad: 'UNICA' as const, rolesPermitidos: 'ADMIN,OPERADOR' },
  ];
  for (const li of legacyInstruments) {
    await prisma.instrumento.upsert({
      where: { codigo: li.codigo },
      update: { ...li, estado: 'ACTIVO' },
      create: { ...li, estado: 'ACTIVO', creadoPor: admin.id },
    });
  }
  console.log(`  ✓ upserted ${legacyInstruments.length} legacy placeholder instruments`);

  // ========================================
  // DYNAMIC INSTRUMENTS (W2 T5 — instrumentos-dynamic-fichas)
  // ========================================
  // Upsert the 6 contract codigos (idempotent — safe to re-run without wipe).
  // Contract §6.1: codigo / nombre / tipo / periodicidad per table.
  // Contract §6.3: rolesPermitidos = 'ADMIN,EMPLEADO' for all 6.
  // Schema column drops: plantillaArchivo + versionPlantilla were removed by migration.
  console.log('📋 Upserting dynamic instruments + versions …');

  const DYNAMIC_SEED: Array<{
    codigo: string;
    nombre: string;
    tipo: 'VALORACION' | 'NUTRICION' | 'MATRICULA' | 'ADMISION';
    periodicidad: 'UNICA' | 'ANUAL' | 'MENSUAL' | 'TRIMESTRAL' | 'SEMESTRAL';
  }> = [
    { codigo: 'BARTHEL',           nombre: 'Índice de Barthel',                                tipo: 'VALORACION', periodicidad: 'SEMESTRAL' },
    { codigo: 'MINI_MENTAL',       nombre: 'Mini Examen del Estado Mental',                    tipo: 'VALORACION', periodicidad: 'ANUAL' },
    { codigo: 'TINETTI',           nombre: 'Escala de Tinetti (Marcha y Equilibrio)',          tipo: 'VALORACION', periodicidad: 'SEMESTRAL' },
    { codigo: 'YESAVAGE',          nombre: 'Escala de Depresión Geriátrica de Yesavage',       tipo: 'VALORACION', periodicidad: 'ANUAL' },
    { codigo: 'MNA_CUADRO',        nombre: 'Mini Nutritional Assessment + Cuadro de Alimentos', tipo: 'NUTRICION', periodicidad: 'SEMESTRAL' },
    { codigo: 'FICHA_NUTRICIONAL', nombre: 'Ficha Nutricional 1.8.4',                          tipo: 'NUTRICION', periodicidad: 'SEMESTRAL' },
  ];

  const TEMPLATE_DIR = resolve(process.cwd(), 'prisma/instrument-templates');

  function loadTemplate(codigo: string): { version: number; definition: unknown } {
    const file = readdirSync(TEMPLATE_DIR).find((f) => f.startsWith(`${codigo}.v`) && f.endsWith('.json'));
    if (!file) throw new Error(`Template not found for codigo=${codigo} in ${TEMPLATE_DIR}`);
    const parsed = JSON.parse(readFileSync(join(TEMPLATE_DIR, file), 'utf8'));
    return { version: parsed.version, definition: parsed };
  }

  // Structural deep equality (JSONB normalizes key order on storage, so JSON.stringify
  // round-trip comparison is unreliable).
  function deepEqualJson(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (a === null || b === null) return a === b;
    if (typeof a !== 'object') return a === b;
    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (!deepEqualJson(a[i], b[i])) return false;
      return true;
    }
    if (Array.isArray(b)) return false;
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const akeys = Object.keys(ao).sort();
    const bkeys = Object.keys(bo).sort();
    if (akeys.length !== bkeys.length) return false;
    for (let i = 0; i < akeys.length; i++) {
      if (akeys[i] !== bkeys[i]) return false;
      if (!deepEqualJson(ao[akeys[i]], bo[bkeys[i]])) return false;
    }
    return true;
  }

  for (const d of DYNAMIC_SEED) {
    const inst = await prisma.instrumento.upsert({
      where: { codigo: d.codigo },
      update: {
        nombreInstrumento: d.nombre,
        tipo: d.tipo,
        periodicidad: d.periodicidad,
        rolesPermitidos: 'ADMIN,EMPLEADO',
        estado: 'ACTIVO',
      },
      create: {
        codigo: d.codigo,
        nombreInstrumento: d.nombre,
        tipo: d.tipo,
        periodicidad: d.periodicidad,
        rolesPermitidos: 'ADMIN,EMPLEADO',
        estado: 'ACTIVO',
        creadoPor: admin.id,
      },
    });

    const tpl = loadTemplate(d.codigo);

    // Idempotent version upsert: if exists with same definition, no-op; if differs and NOT
    // referenced, update in place; if differs AND referenced, leave alone (locked).
    const existing = await prisma.instrumentoVersion.findUnique({
      where: { instrumentoId_version: { instrumentoId: inst.id, version: tpl.version } },
    });
    if (!existing) {
      await prisma.$transaction(async (tx) => {
        await tx.instrumentoVersion.updateMany({
          where: { instrumentoId: inst.id, activo: true },
          data: { activo: false },
        });
        await tx.instrumentoVersion.create({
          data: {
            instrumentoId: inst.id,
            version: tpl.version,
            definition: tpl.definition as any,
            activo: true,
            createdBy: admin.id,
          },
        });
      });
      console.log(`  ➕ ${d.codigo} v${tpl.version} inserted (activo=true)`);
    } else {
      // JSONB normalizes key order on storage, so JSON.stringify comparison fails.
      // Use a stable structural comparison instead.
      const same = deepEqualJson(existing.definition, tpl.definition);
      if (!same) {
        const refs = await prisma.registroFichaCompletada.count({ where: { instrumentoVersionId: existing.id } });
        if (refs === 0) {
          await prisma.instrumentoVersion.update({
            where: { id: existing.id },
            data: { definition: tpl.definition as any },
          });
          console.log(`  ✏️  ${d.codigo} v${tpl.version} definition updated (no fichas pinned)`);
        } else {
          console.log(`  🔒 ${d.codigo} v${tpl.version} definition differs but ${refs} ficha(s) reference it — left untouched (run npm run instruments:upgrade to manage)`);
        }
      } else {
        console.log(`  ⏭  ${d.codigo} v${tpl.version} unchanged`);
      }
    }
  }
  console.log(`✅ Upserted ${DYNAMIC_SEED.length} dynamic instruments with active versions`);

  // Suppress unused-variable warnings for users we create but don't reference again.
  void empleado1User; void auditor; void operador;

  console.log('\n✨ Database seed completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   Users: 4 (admin, empleado, auditor, operador)`);
  console.log(`   Empresa: 1 (default)`);
  console.log(`   Instruments: 9 (3 legacy + 6 dynamic)`);
  console.log(`   Active versions: 6 (one per dynamic instrumento)`);
  console.log('\n🔑 Login credentials:');
  console.log('   Admin: admin@miempresa.com / password123');
  console.log('   Empleado: empleado@miempresa.com / password123');
  console.log('   Auditor: auditor@miempresa.com / password123');
  console.log('   Operador: operador@miempresa.com / password123');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });