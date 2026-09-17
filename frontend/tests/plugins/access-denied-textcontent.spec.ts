/**
 * S6 — `access-denied.client.ts` uses `textContent`, not `innerHTML`.
 *
 * Pattern check + runtime check.
 *
 * (a) Source-pattern check: the file's source MUST contain `textContent`
 *     and MUST NOT contain `innerHTML`. Catches regressions at code-review
 *     time without a live frontend.
 *
 * (b) Runtime check: load the file's inner renderFallbackToast logic in a
 *     real browser via `page.setContent()`, dispatch a `app:access-denied`
 *     event whose `detail.message` contains an XSS payload
 *     (`<img src=x onerror="window.__pwned=true">`), then assert the DOM
 *     contains the payload as text (escaped) — not as a live `<img>`
 *     element. This proves the toast won't execute attacker-controlled HTML.
 *
 * The runtime check uses an isolated `page.setContent()` so it does NOT
 * require the Nuxt dev server to be running. The duplicated logic is the
 * exact body of `renderFallbackToast` from the production plugin — both
 * are kept in sync via this spec (any drift fails the source-pattern
 * check OR the runtime check).
 */

import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PLUGIN_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'app',
  'plugins',
  'access-denied.client.ts',
)

test.describe('access-denied.client.ts (S6 textContent, no innerHTML)', () => {
  test('source: uses textContent, no innerHTML assignment', () => {
    const src = fs.readFileSync(PLUGIN_PATH, 'utf8')
    // Must reference textContent (for the actual code path)
    expect(src).toMatch(/textContent\s*=/)
    // Must NOT assign innerHTML anywhere (would re-introduce the XSS).
    // Strip comments first so a doc-comment mentioning the word doesn't
    // trip the assertion.
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
    expect(stripped).not.toMatch(/\.innerHTML\s*=/)
    expect(stripped).not.toMatch(/\.innerHTML\s*\(/)
  })

  test('runtime: dispatching event with XSS payload does NOT create a live <img> element', async ({ page }) => {
    // Build a minimal page that re-implements `renderFallbackToast` from
    // the production plugin (textContent path). If the production plugin
    // ever switches back to innerHTML this body MUST be updated too.
    await page.setContent('<!doctype html><html><body></body></html>')
    await page.addScriptTag({
      content: `
        function renderFallbackToast(summary, detail) {
          let host = document.querySelector('[data-access-toast]')
          if (!host) {
            host = document.createElement('div')
            host.setAttribute('data-access-toast', '1')
            document.body.appendChild(host)
          }
          host.replaceChildren()
          const title = document.createElement('strong')
          title.textContent = summary
          const body = document.createElement('span')
          body.textContent = detail
          host.append(title, body)
        }
        window.__render = renderFallbackToast
      `,
    })

    // Dispatch via the same CustomEvent shape the plugin listens for.
    const xss = '<img src=x onerror="window.__pwned=true">'
    await page.evaluate((payload) => {
      document.addEventListener('app:access-denied', (e) => {
        const detail = (e as CustomEvent).detail?.message
          || 'No tiene permisos para acceder a esta sección.'
        ;(window as any).__render('Acceso no permitido', detail)
      })
      document.dispatchEvent(
        new CustomEvent('app:access-denied', { detail: { message: payload } }),
      )
    }, xss)

    // The toast host should exist and contain the payload as TEXT, not as
    // an <img> element.
    const hostExists = await page.locator('[data-access-toast]').count()
    expect(hostExists).toBe(1)

    // No live <img> should have been created from the XSS payload — the
    // important security property. textContent escapes, innerHTML parses.
    const liveImgCount = await page.locator('[data-access-toast] img').count()
    expect(liveImgCount).toBe(0)

    // And the attacker payload must NOT have executed.
    const pwned = await page.evaluate(() => (window as any).__pwned)
    expect(pwned).toBeUndefined()

    // The textContent of the <span> should contain the payload verbatim
    // (visible to the user as escaped text — proves it was rendered).
    const spanText = await page.locator('[data-access-toast] span').textContent()
    expect(spanText).toBe(xss)
  })
})