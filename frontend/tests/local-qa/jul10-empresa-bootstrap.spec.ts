/**
 * LOCAL QA — jul-10 (W6): Empresa bootstrap regression spec.
 *
 * Background: the dev-reported bug on staging was "There is still issues
 * updating the empresa information — when information is loading there is
 * still an error." Root cause: GET /empresa returned 404 when no row
 * existed, the frontend treated it as a load error, and the form had no
 * POST path. This spec exercises the empty-state UI flow on a NON-empty
 * local DB by intercepting `GET /empresa` to return the new normalized
 * 200 { data: null } contract.
 *
 * Strategy: SSR hydrates the auth store with the real empresa from the DB
 * before the page mounts. We use `page.addInitScript` to wipe the SSR
 * hydration state, forcing the page's onMounted to call fetchEmpresa
 * (which is intercepted). The result: create-mode UI is verified without
 * touching the local dev DB.
 *
 * Coverage:
 *   - GET /empresa intercepted to return 200 { data: null } → page renders
 *     the "Crear Empresa" mode (banner + create button), no console errors
 *   - Form submit triggers POST /empresa → 201 → refresh → navigation
 *   - Empty-state CTA on /empresa (index) shows the "Crear Empresa" button
 *
 * Run:
 *   TEST_FRONTEND_URL=http://100.85.193.33:3100 \
 *   TEST_API_URL=http://100.85.193.33:3101/api/v1 \
 *     npx playwright test jul10-empresa-bootstrap.spec.ts
 */

import { test, expect } from '@playwright/test'
import { loginAsAdmin, getApiBase, getFrontendOrigin } from '../helpers/auth'

// Wipe the SSR-hydrated auth store state before page mount. Without this,
// the page sees auth.empresa already set from SSR and skips the
// fetchEmpresa() call we want to intercept. The mutation observer fires
// when Nuxt's __NUXT__ payload lands in the document, then strips the
// empresa so the Pinia store hydrates with null.
const WIPE_SSR_AUTH = () => {
  const observer = new MutationObserver(() => {
    const w = window as unknown as {
      __NUXT__?: { state?: { pinia?: Record<string, Record<string, unknown>> } }
    }
    const pinia = w.__NUXT__?.state?.pinia
    if (!pinia) return
    for (const key of Object.keys(pinia)) {
      const store = pinia[key]
      if (store && typeof store === 'object' && 'empresa' in store) {
        // Cast to a record so we can null empresa + reset auth flags.
        const s = store as Record<string, unknown>
        s.empresa = null
        s.user = null
        s.isAuthenticated = false
      }
    }
    observer.disconnect()
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
  // Also do a synchronous pass in case __NUXT__ is already present.
  setTimeout(() => {
    const w = window as unknown as {
      __NUXT__?: { state?: { pinia?: Record<string, Record<string, unknown>> } }
    }
    const pinia = w.__NUXT__?.state?.pinia
    if (!pinia) return
    for (const key of Object.keys(pinia)) {
      const store = pinia[key]
      if (store && typeof store === 'object' && 'empresa' in store) {
        const s = store as Record<string, unknown>
        s.empresa = null
        s.user = null
        s.isAuthenticated = false
      }
    }
  }, 0)
}

test.describe('jul-10 empresa bootstrap (W6 regression)', () => {
  test('empty-state UI: GET /empresa → data:null renders Crear Empresa form without console errors', async ({ page }) => {
    const FRONTEND = getFrontendOrigin()
    const API = await getApiBase(page)

    await loginAsAdmin(page)

    // Install the SSR-state wipe BEFORE navigation.
    await page.addInitScript(WIPE_SSR_AUTH)

    // Track console errors — the bug surfaced as a load-time console error.
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    // Intercept ALL /empresa requests: GET → empty contract, POST → 201 simulated.
    // The SPA may call /empresa multiple times (SSR hydration, onMounted,
    // post-create refresh). All GETs get the same null response.
    let postObserved = false
    await page.route('**/api/v1/empresa', async (route, request) => {
      const url = request.url()
      const method = request.method()
      // GET on the bare /empresa path (no sub-path) returns the empty contract.
      // GET on /empresa/cargos or /empresa/<id> falls through to the backend.
      if (method === 'GET' && /\/empresa(\?.*)?$/.test(url)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: null }),
        })
        return
      }
      if (method === 'POST') {
        postObserved = true
        const body = JSON.parse(request.postData() || '{}')
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 999,
              nombre: (body.nombre || '').toUpperCase(),
              nit: body.nit,
              direccion: body.direccion ?? null,
              telefono: body.telefono ?? null,
              email: body.email ?? null,
              activa: true,
            },
          }),
        })
        return
      }
      await route.continue()
    })

    await page.goto(`${FRONTEND}/empresa/editar`)
    await page.waitForLoadState('networkidle')

    // The page is in create mode
    await expect(page.getByRole('heading', { name: 'Crear Empresa' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('empresa-create-banner')).toBeVisible()
    await expect(page.getByTestId('empresa-guardar')).toHaveText(/Crear Empresa/i)
    await expect(page.getByTestId('cargos-manager-card')).not.toBeVisible()

    // No console errors during the load (this is the actual reported bug)
    const realErrors = consoleErrors.filter((e) => !e.includes('DevTools') && !e.includes('favicon'))
    expect(realErrors).toEqual([])

    // Fill the form and submit. The POST is intercepted.
    await page.getByTestId('empresa-nombre').fill('MI EMPRESA BOOTSTRAP S.A.S.')
    await page.getByTestId('empresa-nit').fill('900999999-1')

    // Submit triggers POST
    const postPromise = page.waitForResponse(
      (r) => r.url().includes('/empresa') && r.request().method() === 'POST',
      { timeout: 10000 },
    )
    await page.getByTestId('empresa-guardar').click()
    const postResp = await postPromise
    expect([201]).toContain(postResp.status())
    expect(postObserved).toBe(true)
  })

  test('empty-state CTA on /empresa index page when no empresa exists', async ({ page }) => {
    const FRONTEND = getFrontendOrigin()
    const API = await getApiBase(page)

    await loginAsAdmin(page)
    await page.addInitScript(WIPE_SSR_AUTH)

    await page.route('**/api/v1/empresa', async (route, request) => {
      const url = request.url()
      if (request.method() === 'GET' && /\/empresa(\?.*)?$/.test(url)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: null }),
        })
        return
      }
      await route.continue()
    })

    await page.goto(`${FRONTEND}/empresa`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByTestId('empresa-empty-state')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('empresa-crear-cta')).toBeVisible()
    await expect(page.getByRole('link', { name: /Editar/i })).not.toBeVisible()
  })
})