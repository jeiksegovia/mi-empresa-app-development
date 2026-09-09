# Plan: actividades list shows empleado name + cargo (sep-8)

**Path**: `context/implementation-plan/sep-8-actividades-empleado-name-cargo.md`  
**Date**: 2026-09-08  
**Status**: implemented locally, not committed / not staged.

## Ask
Registro de actividades list: show empleado name and cargo. Remove empleado id from the view.

## Change
- BE `actividadService` GET/POST/PUT include `empleado.nombre/apellido` plus cargo:
  1. active contrato → `cargo.nombre` (`CargoEmpresa`)
  2. else latest legacy `Cargo.nombreCargo`
- DTO adds `empleadoNombre`, `empleadoCargo`. `empleadoId` stays on the API (ACL).
- FE table: Empleado = name, Cargo = cargo. No `#id`.

## Tests
- `backend/tests/actividades/registro-actividades-acl.spec.ts` — POST/GET carry name + cargo.
- `frontend/tests/local-qa/aug17-qa-frontend.spec.ts` — mocked list shows name/cargo, not `#395`.
