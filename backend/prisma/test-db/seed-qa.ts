/**
 * Mi Empresa App - QA Seed Script (staging-safe)
 *
 * Creates/updates ONE dedicated QA admin user. Idempotent upsert — never
 * deletes or touches any other data, so it is safe against deployed stages.
 *
 * Credentials come from the environment (populated from SSM by
 * infrastructure/db/tests/seed-qa-staging.sh):
 *   QA_USER_EMAIL     (default: qa@miempresa.com)
 *   QA_USER_PASSWORD  (required — no default on purpose)
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/index.js';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.QA_USER_EMAIL || 'qa@miempresa.com';
  const password = process.env.QA_USER_PASSWORD;

  if (!password) {
    console.error('❌ QA_USER_PASSWORD is required (fetch it from SSM /miempresa/<stage>/qa/QA_USER_PASSWORD)');
    process.exit(1);
  }

  console.log(`🌱 Upserting QA user ${email}...`);
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.usuario.upsert({
    where: { email },
    update: { password: passwordHash, activo: true },
    create: {
      email,
      password: passwordHash,
      rol: 'ADMIN',
      nombre: 'QA',
      apellido: 'Staging',
      activo: true,
    },
  });

  console.log(`✅ QA user ready: id=${user.id} email=${user.email} rol=${user.rol}`);
}

main()
  .catch((e) => {
    console.error('❌ QA seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
