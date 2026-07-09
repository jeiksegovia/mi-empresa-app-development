/**
 * Mi Empresa App - Dev/Test Users for Deployed Stages
 *
 * Idempotently upserts the well-known dev users (matching prisma/seed.ts
 * identities so local muscle memory and UI assertions keep working) on a
 * stage database. No deletes, no other data touched.
 *
 * ⚠ SECURITY TRADEOFF (developer-approved July 4, 2026): these are weak,
 * publicly-known credentials on a public API. Intended for STAGING only.
 * The companion shell script flips SSM /miempresa/<stage>/qa/DEV_USERS_ENABLED
 * to "true" so the QA suite expects them to work; on stages without that flag
 * the QA suite asserts these logins FAIL.
 *
 * Env:
 *   DATABASE_URL          (via tunnel, set by create-users-staging.sh)
 *   DEV_USERS_PASSWORD    (default: password123)
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/index.js';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const PASSWORD = process.env.DEV_USERS_PASSWORD || 'password123';

const USERS = [
  { email: 'admin@miempresa.com',    rol: 'ADMIN'    as const, nombre: 'Admin',  apellido: 'Sistema' },
  { email: 'empleado@miempresa.com', rol: 'EMPLEADO' as const, nombre: 'Carlos', apellido: 'Rodríguez' },
];

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  for (const u of USERS) {
    const user = await prisma.usuario.upsert({
      where: { email: u.email },
      update: { password: passwordHash, activo: true },
      create: { ...u, password: passwordHash, activo: true },
    });
    console.log(`✅ ${user.email} ready (id=${user.id}, rol=${user.rol})`);
  }
}

main()
  .catch((e) => {
    console.error('❌ create-users failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
