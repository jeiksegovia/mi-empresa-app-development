#!/bin/bash
# backend/tests/serverless/smoke.test.sh
# Infrastructure-level smoke tests for deployed Lambda endpoint
# Usage: TEST_API_URL=https://xxx... bash tests/serverless/smoke.test.sh
# Default: http://localhost:3001

API_URL="${TEST_API_URL:-http://localhost:3001}"
PASS=0
FAIL=0

echo "=== Serverless Smoke Tests ==="
echo "Target: ${API_URL}"
echo ""

check() {
  local DESC="$1"
  local URL="$2"
  local EXPECTED_STATUS="$3"
  shift 3
  # Remaining args are extra curl flags
  ACTUAL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$@" "${URL}" 2>/dev/null)

  if [ "${ACTUAL_STATUS}" = "${EXPECTED_STATUS}" ]; then
    echo "  PASS: ${DESC} (${ACTUAL_STATUS})"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: ${DESC} (expected ${EXPECTED_STATUS}, got ${ACTUAL_STATUS})"
    FAIL=$((FAIL + 1))
  fi
}

check "Health check returns 200" \
  "${API_URL}/api/v1/health" "200"

check "Unknown route returns 404" \
  "${API_URL}/api/v1/nonexistent-route-xyz" "404"

check "Employees requires auth (401)" "${API_URL}/api/v1/employees" "401"
check "Patients requires auth (401)" "${API_URL}/api/v1/patients" "401"
check "Dashboard requires auth (401)" "${API_URL}/api/v1/dashboard/stats" "401"

check "Invalid login returns 401" \
  "${API_URL}/api/v1/auth/login" "401" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid@test.com","password":"wrongpassword123"}'

echo ""
echo "=== Results: ${PASS} passed, ${FAIL} failed ==="

if [ "${FAIL}" -gt 0 ]; then
  exit 1
fi

exit 0
