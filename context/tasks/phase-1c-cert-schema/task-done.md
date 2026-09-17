# Task: Add CertificadoEmpresa Schema

## Definition
Add the `CertificadoEmpresa` Prisma model, related enums, and cross-model relations to support company certificate management.

## Plan
1. Read schema.prisma to understand structure and exact line positions
2. Insert `CertificadoEmpresa` model block between Finance and Empresa modules
3. Update `Empresa` model to add `certificados CertificadoEmpresa[]` relation
4. Update `Usuario` model to add `certificadosEmpresaCreados` named relation
5. Append `TipoCertificadoEmpresa` and `EstadoCertificadoEmpresa` enums after existing enums
6. Run migration; fall back to `prisma generate` if DB offline

## Schema Changes Made

### New model: `CertificadoEmpresa` (table: `certificados_empresa`)
- PK: `cert_empresa_id` (Int, autoincrement)
- Fields: `empresa_id`, `tipo_certificado`, `nombre`, `descripcion`, `estado` (default PENDIENTE), `fecha_emision`, `fecha_vencimiento`, `archivo_url`, `creado_por`, `created_at`, `updated_at`
- Relations:
  - `empresa` -> `Empresa` (Cascade delete)
  - `creador` -> `Usuario` named `"CertificadoEmpresaCreador"`
- Indexes: `empresaId`, `estado`, `fechaVencimiento`
- Inserted at line 562 (between Finance module and Empresa module)

### Updated model: `Empresa`
- Added relation field: `certificados CertificadoEmpresa[]`

### Updated model: `Usuario`
- Added relation field: `certificadosEmpresaCreados CertificadoEmpresa[] @relation("CertificadoEmpresaCreador")`

### New enums
- `TipoCertificadoEmpresa`: RUT, CAMARA_COMERCIO, PERMISO_SANITARIO, PAGO_SEGURIDAD_SOCIAL, OTRO
- `EstadoCertificadoEmpresa`: VIGENTE, VENCIDO, PENDIENTE

## Migration Result

**Status: OFFLINE - prisma generate succeeded**

- `npx prisma migrate dev --name add-certificado-empresa` failed with `P1001: Can't reach database server at localhost:15432`
- `npx prisma generate` succeeded (v6.19.2) — schema is syntactically valid, Prisma Client regenerated to `./src/generated/prisma`
- Migration SQL file will be created on next `prisma migrate dev` run when DB is available

## Issues
- None. Schema validated cleanly via `prisma generate`.
- Minor: Prisma recommends migrating from deprecated `package.json#prisma` config to `prisma.config.ts` (not blocking).
