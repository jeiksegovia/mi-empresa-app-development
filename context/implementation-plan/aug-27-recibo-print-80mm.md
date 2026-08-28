# Recibo print — 80mm small-format (centro-costos)

## Task

Validate `habilitarRecibo` print receipts. Existing smoke only checked F6 field text (AC#7). No print-area / alignment / overflow coverage.

## What changed

- Recibo page is an 80mm ticket (`@page size: 80mm auto`, 4mm pad, dashed rows, TOTAL band, empresa header).
- Reprint printer icon on ítems of INGRESOS centros with `habilitarRecibo`.
- Empty `beneficiario` omits the row. All ticket ink is `#000`.
- Print CSS collapses app chrome / `min-h-screen` so the sheet hugs the ticket.

## Print in a new tab (2026-08-28)

Chrome blocks delayed `window.open` (setTimeout / after fetch). Plan:

1. Keep `/centro-costos` in the current tab (accordion, month, scroll).
2. On the user click (`Imprimir recibo` after create, or the row printer icon) call `window.open('/centro-costos/recibo/:id?popup=1', '_blank')` in the same stack.
3. If the popup is blocked, fall back to in-tab `navigateTo` without `?popup=1`.
4. Recibo **Volver**: if `window.opener` is open **or** `?popup=1`, `window.close()`; else `history.back()`; else `/centro-costos`. `?popup=1` covers Chromium builds that drop `opener`.

Files:

- `frontend/app/pages/centro-costos/index.vue` — `openReciboTab`
- `frontend/app/pages/centro-costos/recibo/[itemId].vue` — `goBack`
- `frontend/tests/centro-costos/recibo-print.spec.ts` — new-tab + Volver close
- `frontend/tests/centro-costos/centro-costos-smoke.spec.ts` — after-create CTA opens a tab

## Tests

`cd frontend && npx playwright test tests/centro-costos/recibo-print.spec.ts tests/centro-costos/centro-costos-smoke.spec.ts --grep 'AC#6|AC#7|80mm|reprint|empty beneficiario|new tab'`

## Previews

`frontend/tests/centro-costos/previews/recibo-YYYY-MM-DD-*.webp`
`.playwright-mcp/recibo-*.webp`

## Imprimir retry (2026-08-28)

First `window.print()` works. After Cancel / idle, a second click did nothing (browser treats overlapping print() as a no-op).

`requestPrint()` on the recibo page:

- 1.5s cooldown on the click itself
- button disabled while locked
- `window.focus()` then `print()` after 50ms
- auto-print on load uses the same path

## GET /empresa permission fix (2026-08-28)

Root cause of the missing recibo header for CONTRATOS: `GET /empresa` was
`requireDomain('empresa') + requireRole('ADMIN')`, so any non-ADMIN got 403
and the recibo page's `.catch(() => null)` silently dropped the header.

Fix — read is public-to-authenticated, write stays ADMIN-only:

- `backend/src/services/empresaService.ts` — `EmpresaPublic` (`id, nombre,
  nit, direccion`) + `toPublicEmpresa()`. nombre/nit/direccion are the
  company's own info, not personal data — safe for every logged-in role.
  `telefono`, `email`, `limitarFechaContratos`, `activa` stay ADMIN-only.
- `backend/src/routes/empresa.routes.ts` — `GET /` drops
  `requireDomain('empresa')` + `requireRole('ADMIN')` (only
  `authMiddleware()` from `router.use` applies). Handler returns the full
  `EmpresaDetail` for `rol === 'ADMIN'`, `EmpresaPublic` otherwise.
  `POST /` and `PUT /:id` unchanged (still ADMIN-only).
- Domain matrix (`DOMAIN_ACCESS.*.empresa`) is untouched — `/empresa/cargos`
  writes and any future `empresa`-gated route still follow it. This mirrors
  the existing `/empresa/cargos` GET+POST CONTRATOS exception (contract D1):
  a route-level carve-out, not a matrix flip.

### Tests updated

- `backend/tests/rbac/domain-access.spec.ts` — removed `GET /api/v1/empresa`
  from the GERONTOLOGA/CONTRATOS 403 lists; added `GET /empresa: non-ADMIN
  gets 200 with public fields only (no telefono/email)`.
- `backend/tests/rbac/qa-profiles-five.spec.ts` — removed `/empresa` from
  the PROFESORES/AUXILIARES 403 loop; added `GET /empresa → 200, public
  fields only`.
- `backend/tests/empresa/empresa.spec.ts` / `empresa-bootstrap.spec.ts` —
  unchanged, still assert the ADMIN full-record path.

Verified live against the local API (:3101): ADMIN gets the full record;
`qa-contratos@miempresa.com` gets `{id, nombre, nit, direccion}` only.

`cd backend && TEST_API_URL=http://127.0.0.1:3101 npx playwright test tests/rbac/domain-access.spec.ts tests/rbac/qa-profiles-five.spec.ts tests/empresa/empresa.spec.ts tests/empresa/empresa-bootstrap.spec.ts` → 25/26 (1 unrelated pre-existing cargo-catalog-name failure from local DB drift).

## LAN print (local seed)

WiFi IP `192.168.4.26`. Open `http://192.168.4.26:3100` (not localhost) so the session cookie matches the API. Seed items: `#127` with beneficiario, `#128` without, centro 17 `habilitarRecibo` on.
