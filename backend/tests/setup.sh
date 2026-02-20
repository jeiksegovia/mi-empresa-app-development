#!/bin/bash

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test environment setup script
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Backend Test Environment Setup${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Get the backend directory (parent of tests/)
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BACKEND_DIR"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo -e "${GREEN}✓${NC} Environment variables loaded"
else
    echo -e "${RED}✗${NC} .env file not found"
    exit 1
fi

# Extract database host and port from DATABASE_URL
# Format: postgresql://user:pass@host:port/dbname
if [ ! -z "$DATABASE_URL" ]; then
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
else
    DB_HOST=${DATABASE_HOST:-localhost}
    DB_PORT=${DATABASE_PORT:-5432}
fi

# Check if PostgreSQL is running
echo -e "\n${YELLOW}Checking PostgreSQL...${NC}"
if pg_isready -h ${DB_HOST} -p ${DB_PORT} > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} PostgreSQL is running on ${DB_HOST}:${DB_PORT}"
elif docker ps | grep postgres > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} PostgreSQL is running in Docker"
else
    echo -e "${RED}✗${NC} PostgreSQL is not running"
    echo -e "${YELLOW}→${NC} Starting PostgreSQL with Docker..."
    npm run db:up
    sleep 5
    if docker ps | grep postgres > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} PostgreSQL started successfully"
    else
        echo -e "${RED}✗${NC} Failed to start PostgreSQL"
        exit 1
    fi
fi

# Check if backend server is running
echo -e "\n${YELLOW}Checking backend server...${NC}"
if curl -s http://localhost:${PORT:-3001}/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Backend server is running on port ${PORT:-3001}"
else
    echo -e "${YELLOW}⚠${NC} Backend server is not running on port ${PORT:-3001}"
    echo -e "${BLUE}→${NC} Please start the server with: npm run dev"
    echo -e "${BLUE}→${NC} Tests will attempt to connect to http://localhost:${PORT:-3001}"
fi

# Export test environment variables
export TEST_API_URL=${TEST_API_URL:-http://localhost:${PORT:-3001}}
export TEST_TIMEOUT=${TEST_TIMEOUT:-30000}
export NODE_ENV=test

echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}✓${NC} Test environment ready!"
echo -e "${BLUE}========================================${NC}\n"
echo -e "Environment variables:"
echo -e "  TEST_API_URL: ${TEST_API_URL}"
echo -e "  TEST_TIMEOUT: ${TEST_TIMEOUT}"
echo -e "  NODE_ENV: ${NODE_ENV}"
echo -e "  Database: ${DB_HOST}:${DB_PORT}\n"

exit 0
