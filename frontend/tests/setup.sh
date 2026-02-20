#!/bin/bash

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test environment setup script
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Frontend Test Environment Setup${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Get the frontend directory (parent of tests/)
FRONTEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$FRONTEND_DIR"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo -e "${GREEN}✓${NC} Environment variables loaded"
else
    echo -e "${YELLOW}⚠${NC} .env file not found (using defaults)"
fi

# Check if backend API is running
echo -e "\n${YELLOW}Checking backend API...${NC}"
BACKEND_URL=${NUXT_PUBLIC_API_URL:-http://localhost:3001}
if curl -s "$BACKEND_URL/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Backend API is running at $BACKEND_URL"
else
    echo -e "${RED}✗${NC} Backend API is not running at $BACKEND_URL"
    echo -e "${YELLOW}→${NC} Please start the backend server"
    echo -e "${BLUE}→${NC} cd ../backend && npm run dev"
    exit 1
fi

# Check if frontend is running
echo -e "\n${YELLOW}Checking frontend server...${NC}"
FRONTEND_URL=${NUXT_PUBLIC_SITE_URL:-http://localhost:3000}
if curl -s "$FRONTEND_URL" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Frontend is running at $FRONTEND_URL"
else
    echo -e "${YELLOW}⚠${NC} Frontend is not running at $FRONTEND_URL"
    echo -e "${BLUE}→${NC} Please start the frontend server: npm run dev"
    echo -e "${BLUE}→${NC} Tests will attempt to connect to $FRONTEND_URL"
fi

# Export test environment variables
export TEST_FRONTEND_URL=${FRONTEND_URL}
export TEST_BACKEND_URL=${BACKEND_URL}
export TEST_TIMEOUT=${TEST_TIMEOUT:-30000}
export NODE_ENV=test

echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}✓${NC} Test environment ready!"
echo -e "${BLUE}========================================${NC}\n"
echo -e "Environment variables:"
echo -e "  TEST_FRONTEND_URL: ${TEST_FRONTEND_URL}"
echo -e "  TEST_BACKEND_URL: ${TEST_BACKEND_URL}"
echo -e "  TEST_TIMEOUT: ${TEST_TIMEOUT}"
echo -e "  NODE_ENV: ${NODE_ENV}\n"

exit 0
