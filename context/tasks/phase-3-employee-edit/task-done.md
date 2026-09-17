# Task: Employee Edit Page - 5-Tab Structure

**Date**: 2026-03-10
**File**: `frontend/app/pages/empleados/[id]/editar.vue`

## Task Definition

Rewrite the employee edit page from a single-section Datos Personales form into a 5-tab structure that mirrors the creation wizard (`nuevo.vue`).

## Plan

Replace the existing single-card form (only Datos Personales) with a full tab-based layout covering all sub-resources exposed by the new backend endpoints.

### Tabs implemented

| Tab | Label | Sub-resources |
|-----|-------|--------------|
| 0 | Datos Personales | `PUT /employees/:id` |
| 1 | Nucleo Familiar | `PUT /employees/:id/nucleo-familiar` |
| 2 | Info. Laboral | `PUT /employees/:id/cargos`, `/contactos-emergencia`, `/experiencias-laborales` |
| 3 | Educacion | `PUT /employees/:id/educacion-idiomas`, `/vehiculos` |
| 4 | Certificados | `PUT /employees/:id/certificados`, `/datos-migracion` |

## Output Summary

### Changes made

- **Replaced** the entire `editar.vue` file.
- Removed single `saving` ref and single `save()` function.
- Added `activeTab` ref and `tabs` array driving a custom underline tab bar (scrollable on small screens, violet active indicator).
- Added per-tab saving refs (`saving1`–`saving5`) so each section saves independently without blocking other tabs.
- **Tab 1 - Datos Personales**: Preserved all existing fields and validation logic. `savePersonal()` calls `PUT /employees/:id`. After save stays on page (toast only, no redirect). Added `employeeFullName` computed for the page header title.
- **Tab 2 - Nucleo Familiar**: Dynamic list of `FamilyMemberForm` items with add/remove. `saveNucleo()` calls `PUT /employees/:id/nucleo-familiar` with filtered valid rows.
- **Tab 3 - Info. Laboral**: Three cards (Cargos, Contactos de Emergencia, Experiencias Laborales). `saveLaboral()` fires three `apiFetch` calls in `Promise.all`.
- **Tab 4 - Educacion**: Two cards (Educacion e Idiomas, Vehiculos). `saveEducacion()` fires two calls in `Promise.all`.
- **Tab 5 - Certificados**: Three cards (Certificado de Alturas, Certificado Riesgo Electrico, Datos de Migracion). Each card is toggled via a Checkbox `.enabled` flag. `saveCertificados()` only includes certs with `enabled === true` and valid dates; only sends the request if the payload is non-empty.
- **`fetchEmployee()`** loads all sub-resource arrays from the API response and hydrates all tab state in a single call on mount. Dates are normalized to `YYYY-MM-DD` via `toISOString().split('T')[0]`.

### Key decisions

- Used `v-show` instead of `v-if` for tab panels so reactive state is not destroyed when switching tabs.
- Inline filtering before save (e.g. `familyMembers.value.filter(...)`) avoids sending rows with empty required fields rather than blocking with per-row validation errors.
- Tab 3 save uses `Promise.all` for the three sub-resources to minimize latency.
- The header action button was changed from "Cancelar" to "Ver Perfil" since each tab saves independently and there is no global unsaved state to cancel.

### No deviations from spec

All 9 new backend endpoints are wired up exactly as described in the task context.
