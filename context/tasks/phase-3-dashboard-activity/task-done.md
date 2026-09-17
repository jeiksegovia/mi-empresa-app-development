# Task B2 — Dashboard Activity Feed Frontend

## Task Definition
Replace the hardcoded `recentActivities` array in `frontend/app/pages/index.vue` with a live fetch from `GET /api/v1/dashboard/activity`.

## Plan
1. Read existing `index.vue` to understand structure.
2. Add `useApi()` composable usage to fetch `/dashboard/activity` on `onMounted`.
3. Implement type-based icon/color helpers.
4. Add loading spinner, empty state ("Sin actividad reciente"), and the live activity list.
5. Format dates with `toLocaleDateString('es-CO')`.

## Changes Made
**File:** `frontend/app/pages/index.vue`

### Removed
- Static `recentActivities` array (4 hardcoded entries with dummy titles/subtitles).

### Added
- `ActivityItem` TypeScript interface with fields: `type`, `date`, `description`, `actorName`.
- `activities` ref (`ActivityItem[]`) and `loadingActivities` ref (`boolean`).
- `fetchActivities()` async function using `apiFetch('/dashboard/activity')`, called in `onMounted`.
- Helper functions:
  - `activityIcon(type)` — maps type to PrimeIcons class string.
  - `activityIconColor(type)` — maps type to hex color.
  - `activityIconBg(type)` — maps type to rgba background.
  - `formatDate(dateStr)` — uses `toLocaleDateString('es-CO')` with day/month/year/hour/minute options.
- Template updates:
  - Loading state: centered `pi-spin pi-spinner` shown while `loadingActivities` is true.
  - Empty state: `pi-inbox` icon + "Sin actividad reciente" text when array is empty.
  - Activity list: iterates `activities`, renders dynamic icon/color via helpers, shows `description` as title and `actorName · formatted date` as subtitle.

## Icon/Color Mapping
| Type              | Icon             | Color     |
|-------------------|------------------|-----------|
| ficha_completada  | pi-file-check    | green-500 |
| patient_created   | pi-user          | blue-500  |
| employee_created  | pi-user-plus     | violet-500|

## Pattern Used
Follows the same `useApi()` / `apiFetch` pattern already used in other pages in this codebase. No new dependencies introduced.

## Deviations / Notes
- Used array index as `:key` since the API response items have no unique `id` field.
- `formatDate` includes time (hour + minute) in addition to date for better context in activity items.
