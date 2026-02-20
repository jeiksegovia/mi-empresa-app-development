#!/bin/bash

# Mi Empresa App - Auth E2E Tests
# Tests authentication endpoints using curl

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:3000/api/v1}"
COOKIE_FILE="/tmp/mi-empresa-session.txt"
TEST_EMAIL="admin@miempresa.com"
TEST_PASSWORD="password123"

# Cleanup
cleanup() {
    rm -f "$COOKIE_FILE"
}
trap cleanup EXIT

# Helper functions
print_header() {
    echo ""
    echo -e "${YELLOW}======================================${NC}"
    echo -e "${YELLOW}$1${NC}"
    echo -e "${YELLOW}======================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

test_health() {
    print_header "TEST: Health Check"
    
    response=$(curl -s -w "\n%{http_code}" "$API_URL/health")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        print_success "Health check passed"
        echo "Response: $body"
    else
        print_error "Health check failed (HTTP $http_code)"
        echo "Response: $body"
        exit 1
    fi
}

test_login_success() {
    print_header "TEST: Login con credenciales válidas"
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -c "$COOKIE_FILE" \
        -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        print_success "Login exitoso"
        echo "Response: $body"
        
        # Verify cookie was set
        if [ -f "$COOKIE_FILE" ] && grep -q "session" "$COOKIE_FILE"; then
            print_success "Cookie de sesión guardada"
        else
            print_error "Cookie de sesión no encontrada"
            exit 1
        fi
    else
        print_error "Login falló (HTTP $http_code)"
        echo "Response: $body"
        exit 1
    fi
}

test_login_invalid() {
    print_header "TEST: Login con credenciales inválidas"
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"wrong@example.com","password":"wrongpassword"}')
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "401" ]; then
        print_success "Login correctamente rechazado"
        echo "Response: $body"
    else
        print_error "Login debería haber sido rechazado (HTTP $http_code)"
        echo "Response: $body"
        exit 1
    fi
}

test_login_validation() {
    print_header "TEST: Login con datos inválidos (validación)"
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"invalid-email","password":"123"}')
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "400" ]; then
        print_success "Validación funcionando correctamente"
        echo "Response: $body"
    else
        print_error "Validación debería haber rechazado (HTTP $http_code)"
        echo "Response: $body"
        exit 1
    fi
}

test_me_authenticated() {
    print_header "TEST: Obtener usuario actual (autenticado)"
    
    # First ensure we're logged in
    rm -f "$COOKIE_FILE"
    curl -s -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -c "$COOKIE_FILE" \
        -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" > /dev/null
    
    response=$(curl -s -w "\n%{http_code}" \
        -X GET "$API_URL/auth/me" \
        -b "$COOKIE_FILE")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        print_success "Usuario actual obtenido"
        echo "Response: $body"
    else
        print_error "No se pudo obtener usuario actual (HTTP $http_code)"
        echo "Response: $body"
        exit 1
    fi
}

test_me_unauthenticated() {
    print_header "TEST: Obtener usuario sin autenticación"
    
    # Clear cookies
    rm -f "$COOKIE_FILE"
    
    response=$(curl -s -w "\n%{http_code}" \
        -X GET "$API_URL/auth/me")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "401" ]; then
        print_success "Correctamente rechazado sin autenticación"
        echo "Response: $body"
    else
        print_error "Debería rechazar sin autenticación (HTTP $http_code)"
        echo "Response: $body"
        exit 1
    fi
}

test_refresh() {
    print_header "TEST: Refrescar sesión"
    
    # First ensure we're logged in
    rm -f "$COOKIE_FILE"
    curl -s -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -c "$COOKIE_FILE" \
        -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" > /dev/null
    
    # Wait a moment
    sleep 1
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$API_URL/auth/refresh" \
        -b "$COOKIE_FILE" \
        -c "$COOKIE_FILE")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        print_success "Sesión refrescada"
        echo "Response: $body"
    else
        print_error "No se pudo refrescar sesión (HTTP $http_code)"
        echo "Response: $body"
        exit 1
    fi
}

test_logout() {
    print_header "TEST: Cerrar sesión"
    
    # First ensure we're logged in
    rm -f "$COOKIE_FILE"
    curl -s -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -c "$COOKIE_FILE" \
        -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" > /dev/null
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$API_URL/auth/logout" \
        -b "$COOKIE_FILE")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        print_success "Logout exitoso"
        echo "Response: $body"
        
        # Try to access protected route after logout
        me_response=$(curl -s -w "\n%{http_code}" \
            -X GET "$API_URL/auth/me" \
            -b "$COOKIE_FILE")
        
        me_http_code=$(echo "$me_response" | tail -n1)
        
        if [ "$me_http_code" = "401" ]; then
            print_success "Sesión correctamente invalidada después de logout"
        else
            print_error "Sesión debería estar invalidada (HTTP $me_http_code)"
            exit 1
        fi
    else
        print_error "Logout falló (HTTP $http_code)"
        echo "Response: $body"
        exit 1
    fi
}

test_complete_flow() {
    print_header "TEST: Flujo completo de autenticación"
    
    # Step 1: Login
    print_success "1. Iniciando sesión..."
    rm -f "$COOKIE_FILE"
    login_response=$(curl -s -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -c "$COOKIE_FILE" \
        -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")
    echo "   Login response: $login_response"
    
    # Step 2: Get current user
    print_success "2. Obteniendo usuario actual..."
    me_response=$(curl -s -X GET "$API_URL/auth/me" -b "$COOKIE_FILE")
    echo "   Me response: $me_response"
    
    # Step 3: Refresh
    print_success "3. Refrescando sesión..."
    sleep 1
    refresh_response=$(curl -s -X POST "$API_URL/auth/refresh" \
        -b "$COOKIE_FILE" \
        -c "$COOKIE_FILE")
    echo "   Refresh response: $refresh_response"
    
    # Step 4: Logout
    print_success "4. Cerrando sesión..."
    logout_response=$(curl -s -X POST "$API_URL/auth/logout" -b "$COOKIE_FILE")
    echo "   Logout response: $logout_response"
    
    # Step 5: Verify logout
    print_success "5. Verificando que la sesión fue cerrada..."
    final_response=$(curl -s -w "\n%{http_code}" \
        -X GET "$API_URL/auth/me" \
        -b "$COOKIE_FILE")
    final_http_code=$(echo "$final_response" | tail -n1)
    
    if [ "$final_http_code" = "401" ]; then
        print_success "Flujo completo exitoso"
    else
        print_error "Sesión debería estar cerrada"
        exit 1
    fi
}

# Main execution
main() {
    echo -e "${GREEN}"
    echo "╔════════════════════════════════════════╗"
    echo "║  Mi Empresa - Auth E2E Tests          ║"
    echo "╚════════════════════════════════════════╝"
    echo -e "${NC}"
    echo "API URL: $API_URL"
    echo ""
    
    test_health
    test_login_success
    test_login_invalid
    test_login_validation
    test_me_authenticated
    test_me_unauthenticated
    test_refresh
    test_logout
    test_complete_flow
    
    print_header "RESUMEN"
    echo -e "${GREEN}Todos los tests E2E pasaron exitosamente! ✓${NC}"
}

# Run main
main
