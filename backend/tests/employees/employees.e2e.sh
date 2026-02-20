#!/bin/bash

# Mi Empresa App - Employees E2E Tests
# Tests employee CRUD endpoints using curl

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_URL="${API_URL:-http://localhost:3001/api/v1}"
COOKIE_FILE="/tmp/mi-empresa-employees-session.txt"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@miempresa.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123!}"
UNIQUE_DOC="EMP$(date +%s)"
CREATED_EMPLOYEE_ID=""

PASS=0
FAIL=0

# Cleanup
cleanup() {
  rm -f "$COOKIE_FILE"
}
trap cleanup EXIT

# Helpers
print_header() {
  echo ""
  echo -e "${BLUE}======================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}======================================${NC}"
}

print_success() {
  echo -e "${GREEN}  PASS: $1${NC}"
  PASS=$((PASS + 1))
}

print_failure() {
  echo -e "${RED}  FAIL: $1${NC}"
  FAIL=$((FAIL + 1))
}

assert_http() {
  local test_name="$1"
  local expected="$2"
  local actual="$3"
  if [ "$actual" = "$expected" ]; then
    print_success "$test_name (HTTP $actual)"
  else
    print_failure "$test_name (expected HTTP $expected, got HTTP $actual)"
  fi
}

assert_contains() {
  local test_name="$1"
  local body="$2"
  local pattern="$3"
  if echo "$body" | grep -q "$pattern"; then
    print_success "$test_name (found '$pattern')"
  else
    print_failure "$test_name (pattern '$pattern' not found in response)"
    echo "  Response: $body"
  fi
}

# -----------------------------------------------------------------------
do_login() {
  print_header "Setup: Login como administrador"
  rm -f "$COOKIE_FILE"
  response=$(curl -s -w "\n%{http_code}" \
    -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -c "$COOKIE_FILE" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
  http_code=$(echo "$response" | tail -n1)
  if [ "$http_code" = "200" ]; then
    print_success "Login exitoso"
  else
    print_failure "Login fallido (HTTP $http_code) - tests requieren autenticación"
    echo "  Response: $(echo "$response" | head -n-1)"
    exit 1
  fi
}

# -----------------------------------------------------------------------
test_list_unauthenticated() {
  print_header "TEST: GET /employees sin autenticación"
  response=$(curl -s -w "\n%{http_code}" "$API_URL/employees")
  http_code=$(echo "$response" | tail -n1)
  assert_http "Debe retornar 401" "401" "$http_code"
}

test_list_authenticated() {
  print_header "TEST: GET /employees autenticado"
  response=$(curl -s -w "\n%{http_code}" \
    -b "$COOKIE_FILE" \
    "$API_URL/employees")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  assert_http "Debe retornar 200" "200" "$http_code"
  assert_contains "Debe tener success:true" "$body" '"success":true'
  assert_contains "Debe tener campo data" "$body" '"data":'
  assert_contains "Debe tener campo total" "$body" '"total":'
  assert_contains "Debe tener campo totalPages" "$body" '"totalPages":'
}

test_list_pagination() {
  print_header "TEST: GET /employees con paginación"
  response=$(curl -s -w "\n%{http_code}" \
    -b "$COOKIE_FILE" \
    "$API_URL/employees?page=1&limit=5")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  assert_http "Debe retornar 200" "200" "$http_code"
  assert_contains "Debe tener page:1" "$body" '"page":1'
  assert_contains "Debe tener limit:5" "$body" '"limit":5'
}

test_list_filter_estado() {
  print_header "TEST: GET /employees?estado=ACTIVO"
  response=$(curl -s -w "\n%{http_code}" \
    -b "$COOKIE_FILE" \
    "$API_URL/employees?estado=ACTIVO")
  http_code=$(echo "$response" | tail -n1)
  assert_http "Debe retornar 200" "200" "$http_code"
}

test_list_search() {
  print_header "TEST: GET /employees?search=juan"
  response=$(curl -s -w "\n%{http_code}" \
    -b "$COOKIE_FILE" \
    "$API_URL/employees?search=juan")
  http_code=$(echo "$response" | tail -n1)
  assert_http "Debe retornar 200 con búsqueda" "200" "$http_code"
}

# -----------------------------------------------------------------------
test_create_unauthenticated() {
  print_header "TEST: POST /employees sin autenticación"
  response=$(curl -s -w "\n%{http_code}" \
    -X POST "$API_URL/employees" \
    -H "Content-Type: application/json" \
    -d '{"nombre":"Test","apellido":"User","tipoDocumento":"CC","numeroDocumento":"123","genero":"M","fechaNacimiento":"1990-01-01"}')
  http_code=$(echo "$response" | tail -n1)
  assert_http "Debe retornar 401" "401" "$http_code"
}

test_create_validation_missing_fields() {
  print_header "TEST: POST /employees con campos faltantes"
  response=$(curl -s -w "\n%{http_code}" \
    -b "$COOKIE_FILE" \
    -X POST "$API_URL/employees" \
    -H "Content-Type: application/json" \
    -d '{"nombre":"Solo nombre"}')
  http_code=$(echo "$response" | tail -n1)
  assert_http "Debe retornar 400 por validación" "400" "$http_code"
}

test_create_validation_invalid_tipo_documento() {
  print_header "TEST: POST /employees con tipoDocumento inválido"
  response=$(curl -s -w "\n%{http_code}" \
    -b "$COOKIE_FILE" \
    -X POST "$API_URL/employees" \
    -H "Content-Type: application/json" \
    -d "{\"nombre\":\"Test\",\"apellido\":\"User\",\"tipoDocumento\":\"INVALID\",\"numeroDocumento\":\"123\",\"genero\":\"M\",\"fechaNacimiento\":\"1990-01-01\"}")
  http_code=$(echo "$response" | tail -n1)
  assert_http "Debe retornar 400 tipoDocumento inválido" "400" "$http_code"
}

test_create_success() {
  print_header "TEST: POST /employees creación exitosa"
  response=$(curl -s -w "\n%{http_code}" \
    -b "$COOKIE_FILE" \
    -X POST "$API_URL/employees" \
    -H "Content-Type: application/json" \
    -d "{
      \"nombre\": \"Carlos\",
      \"apellido\": \"Ramirez\",
      \"tipoDocumento\": \"CC\",
      \"numeroDocumento\": \"$UNIQUE_DOC\",
      \"genero\": \"MASCULINO\",
      \"fechaNacimiento\": \"1988-11-10\",
      \"telefono\": \"3009876543\",
      \"email\": \"carlos.ramirez@test.com\"
    }")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  assert_http "Debe retornar 201" "201" "$http_code"
  assert_contains "Debe tener success:true" "$body" '"success":true'
  assert_contains "Nombre debe ser Carlos" "$body" '"nombre":"Carlos"'
  assert_contains "Estado debe ser ACTIVO" "$body" '"estado":"ACTIVO"'

  # Extract created ID
  CREATED_EMPLOYEE_ID=$(echo "$body" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
  if [ -n "$CREATED_EMPLOYEE_ID" ]; then
    print_success "Employee ID creado: $CREATED_EMPLOYEE_ID"
  else
    print_failure "No se pudo extraer el ID del empleado creado"
  fi
}

test_create_with_relations() {
  print_header "TEST: POST /employees con relaciones (cargo + contacto)"
  local unique_doc2="EMP2$(date +%s)"
  response=$(curl -s -w "\n%{http_code}" \
    -b "$COOKIE_FILE" \
    -X POST "$API_URL/employees" \
    -H "Content-Type: application/json" \
    -d "{
      \"nombre\": \"Laura\",
      \"apellido\": \"Gomez\",
      \"tipoDocumento\": \"PASAPORTE\",
      \"numeroDocumento\": \"$unique_doc2\",
      \"genero\": \"FEMENINO\",
      \"fechaNacimiento\": \"1992-04-25\",
      \"cargos\": [{
        \"fechaIngreso\": \"2022-03-01\",
        \"nombreCargo\": \"Analista\",
        \"ubicacion\": \"Medellin\"
      }],
      \"contactosEmergencia\": [{
        \"nombre\": \"Pedro\",
        \"apellido\": \"Gomez\",
        \"telefono\": \"3001122334\",
        \"parentesco\": \"PADRE\"
      }]
    }")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  assert_http "Debe retornar 201 con relaciones" "201" "$http_code"
  assert_contains "Debe tener cargos" "$body" '"nombreCargo":"Analista"'
  assert_contains "Debe tener contactos" "$body" '"parentesco":"PADRE"'
}

test_create_duplicate_document() {
  print_header "TEST: POST /employees con documento duplicado"
  # Use the same UNIQUE_DOC from test_create_success
  response=$(curl -s -w "\n%{http_code}" \
    -b "$COOKIE_FILE" \
    -X POST "$API_URL/employees" \
    -H "Content-Type: application/json" \
    -d "{
      \"nombre\": \"Otro\",
      \"apellido\": \"Persona\",
      \"tipoDocumento\": \"CC\",
      \"numeroDocumento\": \"$UNIQUE_DOC\",
      \"genero\": \"FEMENINO\",
      \"fechaNacimiento\": \"1995-01-01\"
    }")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  assert_http "Debe retornar 409 por duplicado" "409" "$http_code"
  assert_contains "Debe indicar documento ya registrado" "$body" "documento"
}

# -----------------------------------------------------------------------
test_get_unauthenticated() {
  print_header "TEST: GET /employees/:id sin autenticación"
  response=$(curl -s -w "\n%{http_code}" "$API_URL/employees/1")
  http_code=$(echo "$response" | tail -n1)
  assert_http "Debe retornar 401" "401" "$http_code"
}

test_get_invalid_id() {
  print_header "TEST: GET /employees/abc ID inválido"
  response=$(curl -s -w "\n%{http_code}" \
    -b "$COOKIE_FILE" \
    "$API_URL/employees/abc")
  http_code=$(echo "$response" | tail -n1)
  assert_http "Debe retornar 400 ID inválido" "400" "$http_code"
}

test_get_not_found() {
  print_header "TEST: GET /employees/999999999 no existe"
  response=$(curl -s -w "\n%{http_code}" \
    -b "$COOKIE_FILE" \
    "$API_URL/employees/999999999")
  http_code=$(echo "$response" | tail -n1)
  assert_http "Debe retornar 404" "404" "$http_code"
}

test_get_success() {
  print_header "TEST: GET /employees/:id exitoso"
  if [ -z "$CREATED_EMPLOYEE_ID" ]; then
    echo "  SKIP: No hay ID de empleado creado"
    return
  fi
  response=$(curl -s -w "\n%{http_code}" \
    -b "$COOKIE_FILE" \
    "$API_URL/employees/$CREATED_EMPLOYEE_ID")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  assert_http "Debe retornar 200" "200" "$http_code"
  assert_contains "Debe tener success:true" "$body" '"success":true'
  assert_contains "Debe tener relaciones nucleoFamiliar" "$body" '"nucleoFamiliar":'
  assert_contains "Debe tener relaciones cargos" "$body" '"cargos":'
  assert_contains "Debe tener relaciones vehiculos" "$body" '"vehiculos":'
}

# -----------------------------------------------------------------------
test_update_unauthenticated() {
  print_header "TEST: PUT /employees/:id sin autenticación"
  response=$(curl -s -w "\n%{http_code}" \
    -X PUT "$API_URL/employees/1" \
    -H "Content-Type: application/json" \
    -d '{"nombre":"Updated"}')
  http_code=$(echo "$response" | tail -n1)
  assert_http "Debe retornar 401" "401" "$http_code"
}

test_update_not_found() {
  print_header "TEST: PUT /employees/999999999 no existe"
  response=$(curl -s -w "\n%{http_code}" \
    -b "$COOKIE_FILE" \
    -X PUT "$API_URL/employees/999999999" \
    -H "Content-Type: application/json" \
    -d '{"nombre":"Updated"}')
  http_code=$(echo "$response" | tail -n1)
  assert_http "Debe retornar 404" "404" "$http_code"
}

test_update_success() {
  print_header "TEST: PUT /employees/:id actualización exitosa"
  if [ -z "$CREATED_EMPLOYEE_ID" ]; then
    echo "  SKIP: No hay ID de empleado creado"
    return
  fi
  response=$(curl -s -w "\n%{http_code}" \
    -b "$COOKIE_FILE" \
    -X PUT "$API_URL/employees/$CREATED_EMPLOYEE_ID" \
    -H "Content-Type: application/json" \
    -d '{
      "nombre": "CarlosActualizado",
      "direccion": "Carrera 7 # 10-20, Bogota",
      "estadoCivil": "SOLTERO"
    }')
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  assert_http "Debe retornar 200" "200" "$http_code"
  assert_contains "Nombre actualizado" "$body" '"nombre":"CarlosActualizado"'
}

test_update_invalid_tipo_vivienda() {
  print_header "TEST: PUT /employees/:id tipoVivienda inválido"
  if [ -z "$CREATED_EMPLOYEE_ID" ]; then
    echo "  SKIP: No hay ID de empleado creado"
    return
  fi
  response=$(curl -s -w "\n%{http_code}" \
    -b "$COOKIE_FILE" \
    -X PUT "$API_URL/employees/$CREATED_EMPLOYEE_ID" \
    -H "Content-Type: application/json" \
    -d '{"tipoVivienda":"MANSION"}')
  http_code=$(echo "$response" | tail -n1)
  assert_http "Debe retornar 400 tipoVivienda inválida" "400" "$http_code"
}

# -----------------------------------------------------------------------
test_delete_unauthenticated() {
  print_header "TEST: DELETE /employees/:id sin autenticación"
  response=$(curl -s -w "\n%{http_code}" \
    -X DELETE "$API_URL/employees/1")
  http_code=$(echo "$response" | tail -n1)
  assert_http "Debe retornar 401" "401" "$http_code"
}

test_delete_not_found() {
  print_header "TEST: DELETE /employees/999999999 no existe"
  response=$(curl -s -w "\n%{http_code}" \
    -b "$COOKIE_FILE" \
    -X DELETE "$API_URL/employees/999999999")
  http_code=$(echo "$response" | tail -n1)
  assert_http "Debe retornar 404" "404" "$http_code"
}

test_delete_success() {
  print_header "TEST: DELETE /employees/:id soft delete (INACTIVO)"
  if [ -z "$CREATED_EMPLOYEE_ID" ]; then
    echo "  SKIP: No hay ID de empleado creado"
    return
  fi
  # Soft delete
  response=$(curl -s -w "\n%{http_code}" \
    -b "$COOKIE_FILE" \
    -X DELETE "$API_URL/employees/$CREATED_EMPLOYEE_ID")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  assert_http "Debe retornar 200" "200" "$http_code"
  assert_contains "Mensaje de desactivación" "$body" "deactivated"

  # Verify status is INACTIVO
  get_response=$(curl -s \
    -b "$COOKIE_FILE" \
    "$API_URL/employees/$CREATED_EMPLOYEE_ID")
  assert_contains "Estado debe ser INACTIVO" "$get_response" '"estado":"INACTIVO"'
}

# -----------------------------------------------------------------------
main() {
  echo ""
  echo -e "${GREEN}"
  echo "╔════════════════════════════════════════════╗"
  echo "║  Mi Empresa - Employees CRUD E2E Tests    ║"
  echo "╚════════════════════════════════════════════╝"
  echo -e "${NC}"
  echo "API URL: $API_URL"

  do_login

  # List tests
  test_list_unauthenticated
  test_list_authenticated
  test_list_pagination
  test_list_filter_estado
  test_list_search

  # Create tests
  test_create_unauthenticated
  test_create_validation_missing_fields
  test_create_validation_invalid_tipo_documento
  test_create_success
  test_create_with_relations
  test_create_duplicate_document

  # Get by ID tests
  test_get_unauthenticated
  test_get_invalid_id
  test_get_not_found
  test_get_success

  # Update tests
  test_update_unauthenticated
  test_update_not_found
  test_update_success
  test_update_invalid_tipo_vivienda

  # Delete tests
  test_delete_unauthenticated
  test_delete_not_found
  test_delete_success

  echo ""
  echo -e "${YELLOW}======================================${NC}"
  echo -e "${YELLOW}RESUMEN DE TESTS${NC}"
  echo -e "${YELLOW}======================================${NC}"
  echo -e "${GREEN}  PASARON: $PASS${NC}"
  if [ "$FAIL" -gt 0 ]; then
    echo -e "${RED}  FALLARON: $FAIL${NC}"
    exit 1
  else
    echo -e "${GREEN}  FALLARON: 0${NC}"
    echo -e "${GREEN}Todos los tests pasaron exitosamente!${NC}"
  fi
}

main
