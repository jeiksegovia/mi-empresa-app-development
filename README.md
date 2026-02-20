# Mi Empresa App

Sistema de gestión empresarial para el contexto colombiano.

## Quick Start

### Prerequisites
- Node.js 22 LTS
- Docker & Docker Compose

### Setup

```bash
# Install dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
npm install

# Start database
npm run db:up

# Generate Prisma client & run migrations
npm run setup

# Start development servers
npm run dev
```

### Development URLs
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001/api/v1
- **Prisma Studio:** http://localhost:5555 (run `npm run db:studio`)

### Tech Stack
- **Backend:** Express.js + TypeScript + Prisma + PostgreSQL
- **Frontend:** Nuxt 4 + PrimeVue v4 + Tailwind CSS + Pinia
- **Database:** PostgreSQL 16 (Docker)
