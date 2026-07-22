#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# STAGING Database Reset Utility (QA jul-11 I9)
# ============================================================================
# Fully resets the STAGING database when QA data becomes inconsistent:
#   1. Dumps the current DB to the backups bucket (pre-reset safety net)
#   2. Drops and recreates the public schema
#   3. Re-applies all Prisma migrations (prisma migrate deploy)
#   4. Re-seeds via the canonical, idempotent seed path (npm run db:seed):
#        users (incl. an ADMIN) + empresa (id=1) + 3 legacy placeholder
#        instruments + the 6 dynamic instruments each with an active v1
#        definition. The ADMIN user is REQUIRED — Instrumento.creado_por /
#        InstrumentoVersion.creado_por are NOT NULL FKs to usuarios(id).
#   5. Seeds the 7 base cargos for the seeded empresa (db:seed does not create
#      per-empresa cargos, so this preserves the historical empresa+cargos
#      contract of this utility).
#
# SAFETY MODEL — read before running:
#   * STAGING ONLY. The script hard-refuses any DATABASE_URL / STAGE that
#     is not explicitly staging, and refuses anything containing "prod".
#   * DEVELOPER-ONLY, MANUAL-ONLY. Never call this from cron, CI, deploy
#     hooks, or application code. It requires an interactive confirmation
#     phrase, so it cannot run unattended.
#   * Per the project prod-safety rule, a prod equivalent of this script
#     must never exist.
#
# Usage (run from a checkout at the release commit, on the staging instance OR
# locally through an SSH tunnel to the staging DB):
#   STAGE=staging DATABASE_URL='postgresql://...' ./reset-staging-db.sh
#
# NOTE: step 4 needs the dev toolchain (tsx + the generated Prisma client + the
#   prisma/instrument-templates/*.json files). When run on an instance where
#   devDependencies were pruned (npm ci --omit=dev), this script re-installs
#   them for the seed and prunes again afterwards (mirrors after-install.sh).
#   Running from the local repo through a tunnel is preferred: devDeps and the
#   templates are already present, and the migrations replayed are the local
#   (release-commit) set — which is how the 6 dynamic instruments get seeded.
#
# Optional env:
#   BACKUP_BUCKET   S3 bucket for the pre-reset dump
#                   (default: miempresa-backups-540657241795)
#   SKIP_SEED=1     skip BOTH the db:seed and the cargos re-seed (schema-only reset)
# ============================================================================

AWS_REGION="${AWS_REGION:-us-east-1}"
BACKUP_BUCKET="${BACKUP_BUCKET:-miempresa-backups-540657241795}"
TS="$(date +%Y%m%d-%H%M%S)"
DUMP_FILE="/tmp/pre-reset-staging-${TS}.sql.gz"

# ── Guard 1: explicit STAGE=staging required ────────────────────────────────
if [ "${STAGE:-}" != "staging" ]; then
  echo "REFUSED: STAGE must be exactly 'staging' (got: '${STAGE:-<unset>}')."
  exit 1
fi

# ── Guard 2: DATABASE_URL must be set and must not smell like prod ──────────
if [ -z "${DATABASE_URL:-}" ]; then
  echo "REFUSED: DATABASE_URL is not set."
  exit 1
fi
case "$DATABASE_URL" in
  *prod*)
    echo "REFUSED: DATABASE_URL contains 'prod'. This utility is staging-only."
    exit 1
    ;;
esac

# ── Guard 3: interactive confirmation phrase (blocks unattended runs) ───────
DB_HOST_DB="$(echo "$DATABASE_URL" | sed -E 's|.*@([^/]+)/([^?]+).*|\1/\2|')"
echo "=========================================="
echo "STAGING DB RESET — DESTRUCTIVE OPERATION"
echo "=========================================="
echo "Target : $DB_HOST_DB"
echo "Backup : s3://${BACKUP_BUCKET}/pre-resets/pre-reset-staging-${TS}.sql.gz"
echo ""
echo "This DROPS ALL DATA in the staging database, replays all migrations,"
echo "and re-seeds empresa + cargos. A pre-reset dump is taken first."
echo ""
printf "Type exactly 'reset staging' to continue: "
read -r CONFIRM
if [ "$CONFIRM" != "reset staging" ]; then
  echo "Aborted (confirmation mismatch)."
  exit 1
fi

# ── 1. Pre-reset dump to S3 ─────────────────────────────────────────────────
echo ""
echo "[1/4] Dumping current DB to ${DUMP_FILE} ..."
pg_dump "$DATABASE_URL" | gzip > "$DUMP_FILE"
aws s3 cp "$DUMP_FILE" "s3://${BACKUP_BUCKET}/pre-resets/pre-reset-staging-${TS}.sql.gz" --region "$AWS_REGION"
echo "      Backup uploaded."

# ── 2. Drop + recreate schema ───────────────────────────────────────────────
echo "[2/4] Dropping and recreating schema 'public' ..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
SQL

# ── 3. Re-apply migrations (safe, forward-only; NEVER migrate diff/reset) ───
echo "[3/5] Applying Prisma migrations ..."
BACKEND_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$BACKEND_DIR"
npx prisma migrate deploy

# ── 4. Canonical re-seed (users + empresa + 3 legacy + 6 dynamic instruments
#       + 6 active v1 versions) via the tested, idempotent seed path. ─────────
if [ "${SKIP_SEED:-0}" = "1" ]; then
  echo "[4/5] SKIP_SEED=1 — skipping db:seed (users/empresa/instruments)."
  echo "[5/5] SKIP_SEED=1 — skipping cargos seed."
else
  echo "[4/5] Seeding users + empresa + 6 dynamic instruments (npm run db:seed) ..."

  # The seed needs the dev toolchain (tsx) + the generated Prisma client.
  # On an instance where devDependencies were pruned, install them just for the
  # seed and prune again afterwards (mirrors after-install.sh lines 95-97).
  INSTALLED_DEV=0
  if [ ! -x "node_modules/.bin/tsx" ]; then
    echo "      tsx absent — installing dev dependencies temporarily ..."
    npm install --include=dev --no-audit --no-fund
    INSTALLED_DEV=1
  fi
  if [ ! -d "src/generated/prisma" ]; then
    echo "      generated Prisma client absent — running prisma generate ..."
    npx prisma generate
  fi

  # FORCE_SEED=true: seed.ts refuses staging/prod DB names unless forced. The
  # schema was just dropped + migrated above, so seed.ts runs against an EMPTY
  # schema (its NODE_ENV!=production clean-slate step is a harmless no-op here);
  # instrument upserts + version inserts are idempotent by design.
  FORCE_SEED=true npm run db:seed

  if [ "$INSTALLED_DEV" = "1" ]; then
    echo "      Restoring production-only dependency tree (npm prune --omit=dev) ..."
    npm prune --omit=dev
  fi

  # ── 5. Seed cargos_empresa for the seeded empresa (idempotent). db:seed does
  #       not create per-empresa cargos, so this preserves this utility's
  #       historical "empresa (id=1) + 7 cargos" contract. ────────────────────
  echo "[5/5] Seeding 7 base cargos for the seeded empresa ..."
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO cargos_empresa (empresa_id, nombre, activo, created_at, updated_at)
SELECT e.id, c.nombre, true, NOW(), NOW()
FROM empresas e
CROSS JOIN (VALUES
  ('GERONTÓLOGA'), ('AUXILIAR DE ENFERMERÍA'), ('ENFERMERA JEFE'),
  ('COCINERA'), ('SERVICIOS GENERALES'), ('ADMINISTRADOR'), ('OTRO')
) AS c(nombre)
WHERE NOT EXISTS (
  SELECT 1 FROM cargos_empresa x WHERE x.empresa_id = e.id AND x.nombre = c.nombre
);
SQL
fi

rm -f "$DUMP_FILE"
echo ""
echo "Staging DB reset complete: $(date)"
echo "Pre-reset dump: s3://${BACKUP_BUCKET}/pre-resets/pre-reset-staging-${TS}.sql.gz"
echo "Remember: create the admin user via the app's seed/bootstrap flow if needed."

# ============================================================================
# fixes-jul17-2 §2.2 — REQUIRED NEXT STEP (unmissable)
# ============================================================================
echo ""
echo "╔════════════════════════════════════════════════════════════════════════════════╗"
echo "║  ⚠  REQUIRED NEXT STEP — DO NOT SKIP                                          ║"
echo "║                                                                                ║"
echo "║  Reset re-applies db:seed (users + 6 dynamic instruments) but DOES NOT         ║"
echo "║  re-create the dedicated QA users. QA users are NOT part of db:seed.           ║"
echo "║                                                                                ║"
echo "║  Run:                                                                          ║"
echo "║     cd backend && ./prisma/test-db/seed-qa-staging.sh --stage ${STAGE} \\      ║"
echo "║          --region ${REGION} --profile <your-aws-profile>                       ║"
echo "║                                                                                ║"
echo "║  This is idempotent — safe to re-run. It upserts 3 users:                      ║"
echo "║     - qa-admin       (ADMIN,        tipoEmpleado=null)                         ║"
echo "║     - qa-gerontologa (EMPLEADO,     tipoEmpleado=GERONTOLOGA)                  ║"
echo "║     - qa-contratos   (EMPLEADO,     tipoEmpleado=CONTRATOS)                    ║"
echo "║  Credentials live in SSM at /miempresa/${STAGE}/qa/<profile>/{EMAIL,PASSWORD}. ║"
echo "║  Print them with: ./prisma/test-db/get-qa-creds.sh --stage ${STAGE}            ║"
echo "╚════════════════════════════════════════════════════════════════════════════════╝"
