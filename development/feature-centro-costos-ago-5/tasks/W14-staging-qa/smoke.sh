#!/usr/bin/env bash
# Live smoke QA for centro-costos staging. Writes results to results.log.
# Uses curl + cookie jar per role.
set -u

API="https://miempresa-api-stg.disruptiveexp.com/api/v1"
JAR_DIR="/tmp/w14-jars"
mkdir -p "$JAR_DIR"

ADMIN_JAR="$JAR_DIR/admin.jar"
CONT_JAR="$JAR_DIR/contratos.jar"
GER_JAR="$JAR_DIR/gerontologa.jar"
ADMIN_EMAIL="qa-admin@miempresa.com"
ADMIN_PASS="6TOArEh3bIa2X8vuEtXCcslF"
CONT_EMAIL="qa-contratos@miempresa.com"
CONT_PASS="GTjxMJrghFWaLv7MVj5MqH4p"
GER_EMAIL="qa-gerontologa@miempresa.com"
GER_PASS="PxttqWuNQZzcwxiUgCs4v9IS"

# Bogotá today YYYY-MM-DD and YYYY-MM
TODAY=$(TZ='America/Bogota' date +%Y-%m-%d)
YYYYMM=$(echo "$TODAY" | cut -c1-7)
echo "Bogotá today: $TODAY ($YYYYMM)"

PASS=0
FAIL=0
SKIP=0
TOTAL=0

ok() { echo "[OK]   $1"; PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); }
no() { echo "[FAIL] $1"; FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); }
sk() { echo "[SKIP] $1"; SKIP=$((SKIP+1)); TOTAL=$((TOTAL+1)); }

# ----- Login -----
login() {
  local jar="$1" email="$2" pass="$3"
  curl -sS -c "$jar" -b "$jar" -X POST "$API/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$pass\"}" -o /dev/null -w "%{http_code}"
}
echo "== LOGIN =="
A_LOGIN=$(login "$ADMIN_JAR" "$ADMIN_EMAIL" "$ADMIN_PASS")
echo "admin login: $A_LOGIN"
C_LOGIN=$(login "$CONT_JAR" "$CONT_EMAIL" "$CONT_PASS")
echo "contratos login: $C_LOGIN"
G_LOGIN=$(login "$GER_JAR" "$GER_EMAIL" "$GER_PASS")
echo "gerontologa login: $G_LOGIN"

# Helper: status code from a curl call
st() {
  curl -sS -o /tmp/w14-body -w "%{http_code}" -b "$1" "$2" ${@:3}
}
st_body() {
  curl -sS -b "$1" -X "$2" "$3" -H 'Content-Type: application/json' -d "$4" -o /tmp/w14-body -w "%{http_code}"
}

# =================================================================
# R18 — Catalog: 8 INGRESOS D12 names; no exact Transporte; 6 EGRESOS
# =================================================================
echo ""
echo "== R18 CATALOG =="
S=$(st "$ADMIN_JAR" "$API/centro-costos?tipo=INGRESOS")
ING_JSON=$(cat /tmp/w14-body)
NAMES=$(echo "$ING_JSON" | python3 -c 'import json,sys;d=json.load(sys.stdin)["data"];print("\n".join(c["nombre"] for c in d))')
ORDEN=$(echo "$ING_JSON" | python3 -c 'import json,sys;d=json.load(sys.stdin)["data"];print(",".join(str(c["orden"]) for c in d))')
COUNT=$(echo "$ING_JSON" | python3 -c 'import json,sys;d=json.load(sys.stdin)["data"];print(len(d))')
[ "$COUNT" = "8" ] && ok "INGRESOS count=8" || no "INGRESOS count=$COUNT (want 8)"
[ "$ORDEN" = "1,2,3,4,5,6,7,8" ] && ok "INGRESOS orden=1..8" || no "INGRESOS orden=$ORDEN"
EXPECTED=("Mensualidades completas" "Mensualidad por 4 días" "Mensualidad por 3 días" "Mensualidades por día" "Transporte completo" "Transporte por 3 días" "Ingresos adicionales" "Valoraciones")
EXP_STR=$(printf '%s\n' "${EXPECTED[@]}")
if [ "$NAMES" = "$EXP_STR" ]; then ok "INGRESOS D12 names"; else no "INGRESOS names mismatch"; echo "GOT:"; echo "$NAMES"; echo "WANT:"; echo "$EXP_STR"; fi
if echo "$NAMES" | grep -qx "Transporte"; then no "exact Transporte still present"; else ok "no exact Transporte"; fi

S=$(st "$ADMIN_JAR" "$API/centro-costos?tipo=EGRESOS")
EG_JSON=$(cat /tmp/w14-body)
EG_COUNT=$(echo "$EG_JSON" | python3 -c 'import json,sys;d=json.load(sys.stdin)["data"];print(len(d))')
EG_ORDEN=$(echo "$EG_JSON" | python3 -c 'import json,sys;d=json.load(sys.stdin)["data"];print(",".join(str(c["orden"]) for c in d))')
[ "$EG_COUNT" = "6" ] && ok "EGRESOS count=6" || no "EGRESOS count=$EG_COUNT"
[ "$EG_ORDEN" = "9,10,11,12,13,14" ] && ok "EGRESOS orden=9..14" || no "EGRESOS orden=$EG_ORDEN"

# =================================================================
# R21 — CONTRATOS POST/PUT/DELETE centro 403
# =================================================================
echo ""
echo "== R21 CONTRATOS CENTRO MUTATIONS =="
S=$(st_body "$CONT_JAR" POST "$API/centro-costos" '{"nombre":"Should fail","tipo":"EGRESOS"}')
[ "$S" = "403" ] && ok "CONTRATOS POST / → 403" || no "CONTRATOS POST / → $S"

ING_ID=$(echo "$ING_JSON" | python3 -c 'import json,sys;d=json.load(sys.stdin)["data"];print(d[0]["id"])')
S=$(st_body "$CONT_JAR" PUT "$API/centro-costos/$ING_ID" '{"descripcion":"x"}')
[ "$S" = "403" ] && ok "CONTRATOS PUT /:id → 403" || no "CONTRATOS PUT /:id → $S"

S=$(st_body "$CONT_JAR" DELETE "$API/centro-costos/$ING_ID" '')
[ "$S" = "403" ] && ok "CONTRATOS DELETE /:id → 403" || no "CONTRATOS DELETE /:id → $S"

# =================================================================
# R22 — CONTRATOS no /balance; /items?periodo= non-current 403
# =================================================================
echo ""
echo "== R22 CONTRATOS BALANCE + NON-CURRENT ITEMS =="
S=$(st "$CONT_JAR" "$API/centro-costos/balance?periodo=$YYYYMM")
[ "$S" = "403" ] && ok "CONTRATOS /balance?periodo=current → 403" || no "CONTRATOS /balance → $S"

S=$(st "$CONT_JAR" "$API/centro-costos/items?periodo=1999-01")
BODY=$(cat /tmp/w14-body)
if [ "$S" = "403" ]; then
  CODE=$(echo "$BODY" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("code",""))' 2>/dev/null)
  FIELD=$(echo "$BODY" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("field",""))' 2>/dev/null)
  if [ "$FIELD" = "periodo" ]; then
    ok "CONTRATOS /items?periodo=1999-01 → 403 field=periodo (D14 route-level)"
  elif [ "$CODE" = "DOMAIN_FORBIDDEN" ]; then
    no "CONTRATOS /items?periodo=1999-01 → 403 DOMAIN_FORBIDDEN (matrix says true — D14 not running!)"
    echo "  body: $BODY"
  else
    no "CONTRATOS /items?periodo=1999-01 → 403 unknown: $BODY"
  fi
else
  no "CONTRATOS /items?periodo=1999-01 → $S (want 403)"
fi

# =================================================================
# R24 — ADMIN POST EGRESOS with fecha=today → periodo YYYY-MM-01; then DELETE
# =================================================================
echo ""
echo "== R24 ADMIN EGRESOS CREATE+DELETE =="
EG_ID=$(echo "$EG_JSON" | python3 -c 'import json,sys;d=json.load(sys.stdin)["data"];print(d[0]["id"])')
S=$(st_body "$ADMIN_JAR" POST "$API/centro-costos/$EG_ID/items" "{\"nombre\":\"W14 egreso\",\"valorUnitario\":42,\"cantidad\":1,\"fecha\":\"$TODAY\"}")
if [ "$S" = "201" ]; then
  R24_ITEM=$(cat /tmp/w14-body | python3 -c 'import json,sys;d=json.load(sys.stdin)["data"];print(d["id"])')
  PER=$(cat /tmp/w14-body | python3 -c 'import json,sys;d=json.load(sys.stdin)["data"];print(d["periodo"])')
  FEC=$(cat /tmp/w14-body | python3 -c 'import json,sys;d=json.load(sys.stdin)["data"];print(d["fecha"])')
  if [ "$PER" = "${YYYYMM}-01" ]; then ok "EGRESOS create periodo=${YYYYMM}-01"; else no "EGRESOS create periodo=$PER"; fi
  [ "$FEC" = "$TODAY" ] && ok "EGRESOS create fecha=$TODAY" || no "EGRESOS create fecha=$FEC"
  # Cleanup
  S=$(st_body "$ADMIN_JAR" DELETE "$API/centro-costos/items/$R24_ITEM" '')
  [ "$S" = "204" ] && ok "EGRESOS item DELETE 204" || no "EGRESOS item DELETE → $S"
else
  no "ADMIN POST EGRESOS item → $S (want 201)"
  cat /tmp/w14-body
fi

# =================================================================
# R25/R26 — INGRESOS missing pagador → 400; unpriced centro → 400 precioUnitario
# =================================================================
echo ""
echo "== R25/R26 INGRESOS VALIDATION =="
# Find first INGRESOS with precioUnitario null
UNPRICED_ID=$(echo "$ING_JSON" | python3 -c 'import json,sys;d=json.load(sys.stdin)["data"];ids=[c["id"] for c in d if c.get("precioUnitario") in (None,"null","")];print(ids[0] if ids else "")')
PRICED_ID=$(echo "$ING_JSON" | python3 -c 'import json,sys;d=json.load(sys.stdin)["data"];ids=[c["id"] for c in d if c.get("precioUnitario") not in (None,"null","")];print(ids[0] if ids else "")')
echo "unpriced INGRESOS id: ${UNPRICED_ID:-none}  priced INGRESOS id: ${PRICED_ID:-none}"

if [ -n "$UNPRICED_ID" ]; then
  # Need a cliente id for beneficiario (since precioUnitario check should run before beneficiario? contract order: pagador then beneficiario then precioUnitario)
  CLI_JSON=$(curl -sS -b "$ADMIN_JAR" "$API/patients?limit=1")
  CLI_ID=$(echo "$CLI_JSON" | python3 -c 'import json,sys;d=json.load(sys.stdin).get("data") or [];print(d[0]["id"] if d else "")')
  echo "first cliente id: ${CLI_ID:-none}"
  if [ -n "$CLI_ID" ]; then
    S=$(st_body "$ADMIN_JAR" POST "$API/centro-costos/$UNPRICED_ID/items" "{\"nombre\":\"no precio\",\"cantidad\":1,\"fecha\":\"$TODAY\",\"pagador\":\"X\",\"beneficiarioClienteId\":$CLI_ID,\"medioPago\":\"EFECTIVO\"}")
    BODY=$(cat /tmp/w14-body)
    if [ "$S" = "400" ]; then
      F=$(echo "$BODY" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("field",""))')
      [ "$F" = "precioUnitario" ] && ok "unpriced centro → 400 field=precioUnitario" || no "unpriced → 400 field=$F (want precioUnitario)"
    else
      no "unpriced centro → $S (want 400)"
      echo "$BODY"
    fi
  else
    sk "no cliente to test precioUnitario"
  fi
else
  sk "no unpriced INGRESOS to test (D11 satisfied for all)"
fi

if [ -n "$PRICED_ID" ]; then
  CLI_JSON=$(curl -sS -b "$ADMIN_JAR" "$API/patients?limit=1")
  CLI_ID=$(echo "$CLI_JSON" | python3 -c 'import json,sys;d=json.load(sys.stdin).get("data") or [];print(d[0]["id"] if d else "")')
  if [ -n "$CLI_ID" ]; then
    S=$(st_body "$ADMIN_JAR" POST "$API/centro-costos/$PRICED_ID/items" "{\"nombre\":\"no pagador\",\"cantidad\":1,\"fecha\":\"$TODAY\",\"beneficiarioClienteId\":$CLI_ID,\"medioPago\":\"EFECTIVO\"}")
    BODY=$(cat /tmp/w14-body)
    if [ "$S" = "400" ]; then
      F=$(echo "$BODY" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("field",""))')
      [ "$F" = "pagador" ] && ok "missing pagador → 400 field=pagador" || no "missing pagador → 400 field=$F (want pagador)"
    else
      no "missing pagador → $S (want 400)"
      echo "$BODY"
    fi
  else
    sk "no cliente to test pagador"
  fi
else
  sk "no priced INGRESOS to test pagador"
fi

# =================================================================
# R31 — GET /items/:id 200 shape; CONTRATOS historical 403
# =================================================================
echo ""
echo "== R31 GET /items/:id + CONTRATOS HISTORICAL =="
# Create a historical ítem (1999-01-15) then verify GET shape and CONTRATOS 403.
S=$(st_body "$ADMIN_JAR" POST "$API/centro-costos/$EG_ID/items" "{\"nombre\":\"W14 historical\",\"valorUnitario\":10,\"fecha\":\"1999-01-15\",\"numeroFactura\":\"W14H\",\"proveedor\":\"W14 prov\"}")
if [ "$S" = "201" ]; then
  HIST_ID=$(cat /tmp/w14-body | python3 -c 'import json,sys;print(json.load(sys.stdin)["data"]["id"])')
  ok "created historical ítem id=$HIST_ID"
  # GET shape
  S=$(st "$ADMIN_JAR" "$API/centro-costos/items/$HIST_ID")
  if [ "$S" = "200" ]; then
    ok "ADMIN GET /items/$HIST_ID 200"
    BODY=$(cat /tmp/w14-body)
    HAS_CENTRO=$(echo "$BODY" | python3 -c 'import json,sys;d=json.load(sys.stdin)["data"];print("yes" if "centro" in d and "id" in d["centro"] else "no")')
    HAS_BENEF=$(echo "$BODY" | python3 -c 'import json,sys;d=json.load(sys.stdin)["data"];print("yes" if "beneficiario" in d else "no")')
    [ "$HAS_CENTRO" = "yes" ] && ok "GET /items/:id has centro.id" || no "GET /items/:id missing centro"
    [ "$HAS_BENEF" = "yes" ] && ok "GET /items/:id has beneficiario (nullable OK)" || no "GET /items/:id missing beneficiario"
  else
    no "ADMIN GET /items/$HIST_ID → $S"
  fi
  # CONTRATOS GET historical
  S=$(st "$CONT_JAR" "$API/centro-costos/items/$HIST_ID")
  BODY=$(cat /tmp/w14-body)
  if [ "$S" = "403" ]; then
    F=$(echo "$BODY" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("field",""))')
    [ "$F" = "fecha" ] && ok "CONTRATOS historical /items/:id → 403 field=fecha" || no "CONTRATOS historical → 403 field=$F (want fecha)"
  else
    no "CONTRATOS historical /items/:id → $S (want 403)"
  fi
  # Cleanup historical ítem
  S=$(st_body "$ADMIN_JAR" DELETE "$API/centro-costos/items/$HIST_ID" '')
  [ "$S" = "204" ] && ok "historical ítem DELETE 204" || no "historical ítem DELETE → $S"
else
  no "ADMIN POST historical EGRESOS → $S (want 201)"
fi

# =================================================================
# D14 — CONTRATOS GET item current month 200
# =================================================================
echo ""
echo "== D14 CONTRATOS CURRENT MONTH =="
S=$(st_body "$ADMIN_JAR" POST "$API/centro-costos/$EG_ID/items" "{\"nombre\":\"W14 current\",\"valorUnitario\":10,\"fecha\":\"$TODAY\"}")
if [ "$S" = "201" ]; then
  CUR_ID=$(cat /tmp/w14-body | python3 -c 'import json,sys;print(json.load(sys.stdin)["data"]["id"])')
  S=$(st "$CONT_JAR" "$API/centro-costos/items/$CUR_ID")
  [ "$S" = "200" ] && ok "CONTRATOS GET current-month item → 200" || no "CONTRATOS GET current item → $S"
  S=$(st_body "$CONT_JAR" PUT "$API/centro-costos/items/$CUR_ID" '{"notas":"contratos updated"}')
  [ "$S" = "200" ] && ok "CONTRATOS PUT current-month item → 200" || no "CONTRATOS PUT current item → $S"
  S=$(st_body "$ADMIN_JAR" DELETE "$API/centro-costos/items/$CUR_ID" '')
  [ "$S" = "204" ] && ok "ADMIN DELETE current item 204 (cleanup)" || no "ADMIN DELETE → $S"
else
  no "ADMIN POST current EGRESOS → $S"
fi

# =================================================================
# FE pages — custom domain
# =================================================================
echo ""
echo "== FE PAGES =="
FE="https://miempresa-stg.disruptiveexp.com"
for p in /login /centro-costos /empleados /nomina /asistencia /pacientes / ; do
  S=$(curl -sS -o /dev/null -w "%{http_code}" "$FE$p")
  if [ "$S" = "200" ]; then ok "FE $p → 200"; else no "FE $p → $S"; fi
done

echo ""
echo "==========================="
echo "TOTAL: $TOTAL  PASS: $PASS  FAIL: $FAIL  SKIP: $SKIP"
echo "==========================="
[ "$FAIL" = "0" ] && exit 0 || exit 1
