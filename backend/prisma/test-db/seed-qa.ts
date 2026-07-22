/**
 * Mi Empresa App — QA Seed (staging-safe, fixes-jul17-2 §2.1)
 *
 * Creates/updates THREE dedicated QA users. Idempotent upserts — never
 * delete or touch any other data, so it is safe against deployed stages.
 *
 * Credentials come from the environment (populated from SSM by
 * backend/prisma/test-db/seed-qa-staging.sh). For each of the three profiles
 * a pair of (EMAIL, PASSWORD) env vars is required:
 *
 *   QA_ADMIN_EMAIL       / QA_ADMIN_PASSWORD        (rol=ADMIN,      tipoEmpleado=null)
 *   QA_GERONTOLOGA_EMAIL / QA_GERONTOLOGA_PASSWORD  (rol=EMPLEADO,   tipoEmpleado=GERONTOLOGA)
 *   QA_CONTRATOS_EMAIL   / QA_CONTRATOS_PASSWORD    (rol=EMPLEADO,   tipoEmpleado=CONTRATOS)
 *
 * Defaults are provided for EMAILs but NOT for passwords — passwords must
 * come from SSM (SecureString), so the script fails fast if any are missing.
 *
 * Legacy aliases (kept for backward compat with old docs/scripts):
 *   QA_USER_EMAIL / QA_USER_PASSWORD are honored as the QA_ADMIN pair if
 *   set and QA_ADMIN_EMAIL/PASSWORD are not, so a pre-existing caller that
 *   uses the single-user layout keeps working. Seed-qa-staging.sh always
 *   writes BOTH layouts to SSM in lockstep (admin email/password mirror).
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/index.js';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

interface QaProfile {
  /** env-var key suffix used to read email/password */
  key: 'QA_ADMIN' | 'QA_GERONTOLOGA' | 'QA_CONTRATOS';
  email: string;
  password: string;
  rol: 'ADMIN' | 'EMPLEADO';
  tipoEmpleado: 'GERONTOLOGA' | 'CONTRATOS' | null;
  nombre: string;
  apellido: string;
}

function pickEmail(primary: string | undefined, fallback: string, legacyPrimary?: string): string {
  return primary || legacyPrimary || fallback;
}

async function main() {
  // ----- Resolve the 3 profiles from env ------------------------------------
  const profiles: QaProfile[] = [
    {
      key: 'QA_ADMIN',
      email: pickEmail(
        process.env.QA_ADMIN_EMAIL,
        'qa-admin@miempresa.com',
        process.env.QA_USER_EMAIL, // legacy alias
      ),
      password: process.env.QA_ADMIN_PASSWORD || process.env.QA_USER_PASSWORD || '',
      rol: 'ADMIN',
      tipoEmpleado: null,
      nombre: 'QA',
      apellido: 'Admin',
    },
    {
      key: 'QA_GERONTOLOGA',
      email: pickEmail(
        process.env.QA_GERONTOLOGA_EMAIL,
        'qa-gerontologa@miempresa.com',
      ),
      password: process.env.QA_GERONTOLOGA_PASSWORD || '',
      rol: 'EMPLEADO',
      tipoEmpleado: 'GERONTOLOGA',
      nombre: 'QA',
      apellido: 'Gerontóloga',
    },
    {
      key: 'QA_CONTRATOS',
      email: pickEmail(
        process.env.QA_CONTRATOS_EMAIL,
        'qa-contratos@miempresa.com',
      ),
      password: process.env.QA_CONTRATOS_PASSWORD || '',
      rol: 'EMPLEADO',
      tipoEmpleado: 'CONTRATOS',
      nombre: 'QA',
      apellido: 'Contratos',
    },
  ];

  // ----- Validate passwords are set (emails have safe defaults) --------------
  for (const p of profiles) {
    if (!p.password) {
      console.error(
        `❌ ${p.key}_PASSWORD is required (fetch it from SSM /miempresa/<stage>/qa/${p.key.toLowerCase().replace('qa_', 'qa-')}/PASSWORD)`,
      );
      process.exit(1);
    }
  }

  // ----- Idempotent upserts --------------------------------------------------
  console.log('🌱 Seeding QA users (3 profiles, idempotent upserts)...');

  for (const p of profiles) {
    const passwordHash = await bcrypt.hash(p.password, 10);
    const user = await prisma.usuario.upsert({
      where: { email: p.email },
      update: {
        password: passwordHash,
        rol: p.rol,
        tipoEmpleado: p.tipoEmpleado as any,
        activo: true,
      },
      create: {
        email: p.email,
        password: passwordHash,
        rol: p.rol,
        tipoEmpleado: p.tipoEmpleado as any,
        nombre: p.nombre,
        apellido: p.apellido,
        activo: true,
      },
    });
    console.log(
      `  ✓ ${p.key.padEnd(15)} → id=${user.id} email=${user.email} rol=${user.rol} tipoEmpleado=${user.tipoEmpleado ?? 'null'}`,
    );
  }

  console.log(`\n✅ 3 QA users ready (or updated — runs are idempotent).`);
  console.log('   No other rows were touched (staging-safe).');
}

main()
  .catch((e) => {
    console.error('❌ QA seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
