#!/bin/bash
set -o pipefail

# ============================================================================
# Full-Stack Staging QA — orchestrates all three tiers
# ============================================================================
#   1. DB tier        backend/prisma/test-db/db-staging-qa.sh
#                     (migrations, schema, table structure, QA seed)
#   2. Backend tier   backend/tests/staging/run-staging-qa.sh
#                     (health, origin hardening, CORS, login/session API)
#   3. Frontend tier  frontend/tests/staging/run-staging-qa.sh
#                     (real browser against the deployed SPA: login flow e2e)
#
# Prerequisite (once): backend/prisma/test-db/seed-qa-staging.sh
#
# Usage:
#   ./scripts/qa-staging.sh [--stage staging] [--profile disruptive]
# ============================================================================

STAGE="staging"
PROFILE="disruptive"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

while [[ $# -gt 0 ]]; do
    case $1 in
        --stage)   STAGE="$2";   shift 2 ;;
        --profile) PROFILE="$2"; shift 2 ;;
        *) echo "Unknown argument: $1" >&2; exit 1 ;;
    esac
done

RESULTS=()
run_tier() {
    local name=$1; shift
    echo ""
    echo "════════════════════════════════════════════"
    echo "  TIER: ${name}"
    echo "════════════════════════════════════════════"
    if "$@" --stage "$STAGE" --profile "$PROFILE"; then
        RESULTS+=("✓ ${name}")
    else
        RESULTS+=("✗ ${name} FAILED")
    fi
}

run_tier "DB (schema/migrations/seed)"  "${ROOT_DIR}/backend/prisma/test-db/db-staging-qa.sh"
run_tier "Backend API (smoke)"          "${ROOT_DIR}/backend/tests/staging/run-staging-qa.sh"
run_tier "Frontend browser (e2e)"       "${ROOT_DIR}/frontend/tests/staging/run-staging-qa.sh"

echo ""
echo "════════════════════════════════════════════"
echo "  STAGING QA SUMMARY (stage: ${STAGE})"
echo "════════════════════════════════════════════"
FAILED=0
for r in "${RESULTS[@]}"; do
    echo "  $r"
    [[ "$r" == ✗* ]] && FAILED=$((FAILED+1))
done
echo "════════════════════════════════════════════"
exit $FAILED
