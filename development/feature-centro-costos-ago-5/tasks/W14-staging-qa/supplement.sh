#!/usr/bin/env bash
# Supplementary smoke — fill remaining cover.
set -u
API="https://miempresa-api-stg.disruptiveexp.com/api/v1"
JAR_DIR="/tmp/w14-jars"
ADMIN_JAR="$JAR_DIR/admin.jar"
CONT_JAR="$JAR_DIR/contratos.jar"
GER_JAR="$JAR_DIR/gerontologa.jar"

PASS=0; FAIL=0; SKIP=0; TOTAL=0
ok() { echo "[OK]   $1"; PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); }
no() { echo "[FAIL] $1"; FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); }
sk() { echo "[SKIP] $1"; SKIP=$((SKIP+1)); TOTAL=$((TOTAL+1)); }

st() { curl -sS -o /tmp/w14-body -w "%{http_code}" -b "$1" "$2"; }
st_body() { curl -sS -b "$1" -X "$2" "$3" -H 'Content-Type: application/json' -d "$4" -o /tmp/w14-body -w "%{http_code}"; }

echo "== GERONTOLOGA 403 (all centro-costos routes) =="
S=$(st "$GER_JAR" "$API/centro-costos")
BODY=$(cat /tmp/w14-body)
CODE=$(echo "$BODY" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("code",""))' 2>/dev/null)
[ "$S" = "403" ] && [ "$CODE" = "DOMAIN_FORBIDDEN" ] && ok "GERONTOLOGA GET / → 403 DOMAIN_FORBIDDEN" || no "GERONTOLOGA GET / → $S code=$CODE"

S=$(st "$GER_JAR" "$API/centro-costos?tipo=INGRESOS")
[ "$S" = "403" ] && ok "GERONTOLOGA GET /?tipo=INGRESOS → 403" || no "GERONTOLOGA /?tipo=INGRESOS → $S"

S=$(st "$GER_JAR" "$API/centro-costos/balance?periodo=2026-08")
[ "$S" = "403" ] && ok "GERONTOLOGA /balance → 403" || no "GERONTOLOGA /balance → $S"

S=$(st "$GER_JAR" "$API/centro-costos/items?periodo=2026-08")
[ "$S" = "403" ] && ok "GERONTOLOGA /items?periodo= → 403" || no "GERONTOLOGA /items?periodo= → $S"

echo ""
echo "== CONTRATOS matrix access (root GET) =="
S=$(st "$CONT_JAR" "$API/centro-costos")
[ "$S" = "200" ] && ok "CONTRATOS GET /centro-costos → 200 (matrix:true)" || no "CONTRATOS GET / → $S"
S=$(st "$CONT_JAR" "$API/centro-costos?tipo=EGRESOS")
[ "$S" = "200" ] && ok "CONTRATOS GET /?tipo=EGRESOS → 200" || no "CONTRATOS /?tipo=EGRESOS → $S"

echo ""
echo "== ADMIN balance read =="
S=$(st "$ADMIN_JAR" "$API/centro-costos/balance?periodo=2026-08")
if [ "$S" = "200" ]; then
  BODY=$(cat /tmp/w14-body)
  HAS_FIELDS=$(echo "$BODY" | python3 -c 'import json,sys;d=json.load(sys.stdin)["data"];print("yes" if all(k in d for k in ["totalIngresos","totalEgresos","balance","porCentro","periodo"]) else "no")')
  [ "$HAS_FIELDS" = "yes" ] && ok "ADMIN /balance has all expected fields" || no "ADMIN /balance missing fields"
  INVARIANT=$(echo "$BODY" | python3 -c 'import json,sys;d=json.load(sys.stdin)["data"];ti=float(d["totalIngresos"]);te=float(d["totalEgresos"]);b=float(d["balance"]);print("yes" if abs(b-(ti-te))<0.01 else "no")')
  [ "$INVARIANT" = "yes" ] && ok "balance = totalIngresos - totalEgresos" || no "balance invariant"
else
  no "ADMIN /balance → $S"
fi

# Empty-month behavior: 200 with zeros, never 404
S=$(st "$ADMIN_JAR" "$API/centro-costos/balance?periodo=2099-12")
BODY=$(cat /tmp/w14-body)
if [ "$S" = "200" ]; then
  ok "ADMIN /balance?periodo=2099-12 → 200 (empty month, not 404)"
  ZEROS=$(echo "$BODY" | python3 -c 'import json,sys;d=json.load(sys.stdin)["data"];print("yes" if d["totalIngresos"]=="0.00" and d["totalEgresos"]=="0.00" and d["balance"]=="0.00" and d["porCentro"]==[] else "no")')
  [ "$ZEROS" = "yes" ] && ok "empty month zeros shape" || no "empty month shape"
else
  no "ADMIN /balance?periodo=2099-12 → $S"
fi

echo ""
echo "== D14 route-level vs DOMAIN_FORBIDDEN — classification =="
# CONTRATOS /balance should give route-level 403, NOT DOMAIN_FORBIDDEN (matrix says true)
S=$(st "$CONT_JAR" "$API/centro-costos/balance?periodo=2026-08")
BODY=$(cat /tmp/w14-body)
CODE=$(echo "$BODY" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("code",""))' 2>/dev/null)
MSG=$(echo "$BODY" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("message",""))' 2>/dev/null)
if [ "$S" = "403" ] && [ -z "$CODE" ] && echo "$MSG" | grep -q "CONTRATOS no tiene acceso al balance"; then
  ok "CONTRATOS /balance → 403 route-level (no code, correct message)"
elif [ "$S" = "403" ] && [ "$CODE" = "DOMAIN_FORBIDDEN" ]; then
  no "CONTRATOS /balance → 403 DOMAIN_FORBIDDEN (matrix says true; D14 not running)"
else
  no "CONTRATOS /balance → $S code=$CODE msg=$MSG"
fi

# CONTRATOS POST / → 403 should also be route-level (no DOMAIN_FORBIDDEN)
S=$(st_body "$CONT_JAR" POST "$API/centro-costos" '{"nombre":"x","tipo":"EGRESOS"}')
BODY=$(cat /tmp/w14-body)
CODE=$(echo "$BODY" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("code",""))' 2>/dev/null)
MSG=$(echo "$BODY" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("message",""))' 2>/dev/null)
if [ "$S" = "403" ] && [ -z "$CODE" ] && echo "$MSG" | grep -q "CONTRATOS no puede crear"; then
  ok "CONTRATOS POST / → 403 route-level (no code)"
elif [ "$S" = "403" ] && [ "$CODE" = "DOMAIN_FORBIDDEN" ]; then
  no "CONTRATOS POST / → 403 DOMAIN_FORBIDDEN (matrix says true; D14 not running)"
else
  no "CONTRATOS POST / → $S code=$CODE msg=$MSG"
fi

echo ""
echo "== Missing periodo on /balance =="
S=$(st "$ADMIN_JAR" "$API/centro-costos/balance")
BODY=$(cat /tmp/w14-body)
if [ "$S" = "400" ]; then
  F=$(echo "$BODY" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("field",""))')
  [ "$F" = "periodo" ] && ok "missing periodo on /balance → 400 field=periodo" || no "/balance 400 field=$F"
else
  no "/balance no periodo → $S"
fi

echo ""
echo "== Missing fecha on POST /:id/items =="
EG_ID=$(st "$ADMIN_JAR" "$API/centro-costos?tipo=EGRESOS" >/dev/null; curl -sS -b "$ADMIN_JAR" "$API/centro-costos?tipo=EGRESOS" | python3 -c 'import json,sys;print(json.load(sys.stdin)["data"][0]["id"])')
S=$(st_body "$ADMIN_JAR" POST "$API/centro-costos/$EG_ID/items" '{"nombre":"no fecha","valorUnitario":1}')
BODY=$(cat /tmp/w14-body)
if [ "$S" = "400" ]; then
  F=$(echo "$BODY" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("field",""))')
  [ "$F" = "fecha" ] && ok "POST /:id/items missing fecha → 400 field=fecha" || no "POST no fecha → 400 field=$F"
else
  no "POST no fecha → $S"
fi

echo ""
echo "================================"
echo "TOTAL: $TOTAL  PASS: $PASS  FAIL: $FAIL  SKIP: $SKIP"
echo "================================"
[ "$FAIL" = "0" ] && exit 0 || exit 1
