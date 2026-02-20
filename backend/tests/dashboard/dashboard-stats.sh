#!/usr/bin/env bash
# Test: GET /api/v1/dashboard/stats
# Verifies the dashboard stats endpoint returns correct structure and requires auth.

set -euo pipefail

BASE_URL="http://localhost:3001/api/v1"
COOKIE_FILE="/tmp/test_cookies_dashboard.txt"
PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

echo "=== Dashboard Stats Endpoint Tests ==="

# --- Test 1: Unauthenticated request should be rejected ---
echo ""
echo "1. Unauthenticated access is rejected"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/dashboard/stats")
if [ "$STATUS" = "401" ]; then
  pass "Returns 401 Unauthorized without cookie"
else
  fail "Expected 401, got $STATUS"
fi

# --- Test 2: Login ---
echo ""
echo "2. Login to obtain session"
LOGIN_BODY=$(curl -s -c "$COOKIE_FILE" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@miempresa.com","password":"password123"}')

if echo "$LOGIN_BODY" | grep -q '"email"'; then
  pass "Login succeeded"
else
  fail "Login failed: $LOGIN_BODY"
fi

# --- Test 3: Authenticated request returns 200 ---
echo ""
echo "3. Authenticated request returns 200"
RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/dashboard/stats")
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/dashboard/stats")

if [ "$HTTP_STATUS" = "200" ]; then
  pass "Returns 200 OK"
else
  fail "Expected 200, got $HTTP_STATUS"
fi

# --- Test 4: Response has success: true ---
echo ""
echo "4. Response body has success: true"
if echo "$RESPONSE" | grep -q '"success":true'; then
  pass "success field is true"
else
  fail "Missing success:true in response: $RESPONSE"
fi

# --- Test 5: Response has all required stat fields ---
echo ""
echo "5. Response data contains all required fields"
for FIELD in empleados pacientes instrumentos certificados; do
  if echo "$RESPONSE" | grep -q "\"$FIELD\""; then
    pass "Field '$FIELD' present"
  else
    fail "Field '$FIELD' missing in response: $RESPONSE"
  fi
done

# --- Test 6: All stat values are non-negative integers (macOS-compatible) ---
echo ""
echo "6. All stat values are non-negative integers"
# Use node to parse JSON and validate numeric fields
NODE_CHECK=$(node -e "
  const r = JSON.parse('$RESPONSE');
  const fields = ['empleados','pacientes','instrumentos','certificados'];
  const valid = fields.every(f => typeof r.data[f] === 'number' && r.data[f] >= 0);
  console.log(valid ? 'ok' : 'fail');
" 2>/dev/null || echo "fail")

if [ "$NODE_CHECK" = "ok" ]; then
  pass "All 4 stat fields are non-negative integers"
else
  fail "Stat fields are not valid non-negative integers in: $RESPONSE"
fi

# --- Summary ---
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
rm -f "$COOKIE_FILE"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
