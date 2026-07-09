import { test, expect } from '@playwright/test'

async function login(page: any) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.locator('#email').fill('admin@miempresa.com')
  await page.locator('#password input').fill('password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 15000 })
  await page.waitForLoadState('networkidle')
}

async function goToPacientes(page: any) {
  if (page.url().includes('/pacientes')) return
  await page.locator('aside nav').getByRole('link', { name: 'Pacientes' }).click()
  await page.waitForURL('/pacientes', { timeout: 10000 })
  await page.waitForLoadState('networkidle')
}

/**
 * Navigate to first patient's detail page.
 * Returns false if no patients found.
 */
async function goToFirstPatient(page: any): Promise<boolean> {
  await goToPacientes(page)
  await page.waitForTimeout(1000)

  const rows = page.locator('tbody tr')
  const rowCount = await rows.count()
  if (rowCount === 0) return false

  await page.locator('.pi-eye').first().click()
  await page.waitForURL(/\/pacientes\/\d+$/, { timeout: 8000 })
  await page.waitForLoadState('networkidle')
  await page.locator('.pi-spin').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(500)
  return true
}

/**
 * Navigate to the Fichas & Evaluaciones tab (index 1) on patient detail.
 */
async function clickFichasTab(page: any) {
  // tabs array: index 0 = Información Básica, index 1 = Fichas & Evaluaciones, index 2 = Notas
  await page.getByText('Fichas & Evaluaciones').click()
  await page.waitForTimeout(500)
}

test.describe('Patient - Fichas & Evaluaciones Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await login(page)
  })

  test('Fichas tab is accessible from patient detail', async ({ page }) => {
    const hasData = await goToFirstPatient(page)
    if (!hasData) {
      test.skip(true, 'No patients found — skipping fichas tests')
      return
    }
    // The tab button must be visible
    const fichasTabBtn = page.getByText('Fichas & Evaluaciones')
    await expect(fichasTabBtn).toBeVisible()
  })

  test('should show instrument select/dropdown in assignment card', async ({ page }) => {
    const hasData = await goToFirstPatient(page)
    if (!hasData) {
      test.skip(true, 'No patients found')
      return
    }
    await clickFichasTab(page)

    // PrimeVue Select with placeholder "Seleccionar instrumento"
    const instrumentSelect = page.locator('.p-select').filter({ hasText: /seleccionar instrumento/i })
    await expect(instrumentSelect).toBeVisible({ timeout: 6000 })
  })

  test('should show Asignar Instrumento button', async ({ page }) => {
    const hasData = await goToFirstPatient(page)
    if (!hasData) {
      test.skip(true, 'No patients found')
      return
    }
    await clickFichasTab(page)
    await expect(page.getByRole('button', { name: /asignar instrumento/i })).toBeVisible({ timeout: 6000 })
  })

  test('should show Historial de Fichas section', async ({ page }) => {
    const hasData = await goToFirstPatient(page)
    if (!hasData) {
      test.skip(true, 'No patients found')
      return
    }
    await clickFichasTab(page)
    await expect(page.getByText('Historial de Fichas')).toBeVisible({ timeout: 6000 })
  })

  test('fichas table or empty state is visible', async ({ page }) => {
    const hasData = await goToFirstPatient(page)
    if (!hasData) {
      test.skip(true, 'No patients found')
      return
    }
    await clickFichasTab(page)

    // Either a table (DataTable) or empty state message is shown
    const tableVisible = await page.locator('table').filter({ has: page.getByText(/instrumento/i) }).isVisible().catch(() => false)
    const emptyStateVisible = await page.getByText('No hay fichas registradas').isVisible().catch(() => false)

    expect(tableVisible || emptyStateVisible).toBe(true)
  })

  test('PENDIENTE ficha row has a delete button', async ({ page }) => {
    const hasData = await goToFirstPatient(page)
    if (!hasData) {
      test.skip(true, 'No patients found')
      return
    }
    await clickFichasTab(page)

    // Wait for fichas to load
    await page.waitForTimeout(800)

    // Check if there are any rows in the fichas DataTable
    const fichaRows = page.locator('tbody tr')
    const fichaRowCount = await fichaRows.count()

    if (fichaRowCount === 0) {
      // No fichas — skip this assertion
      test.skip(true, 'No fichas found for this patient')
      return
    }

    // Check for PENDIENTE tag in any row
    const pendienteTag = page.locator('.p-tag').filter({ hasText: 'PENDIENTE' })
    const pendienteCount = await pendienteTag.count()

    if (pendienteCount === 0) {
      // No PENDIENTE fichas — delete button is conditional (v-if) so it won't be present
      // This is expected behavior; test passes
      return
    }

    // A PENDIENTE ficha row should have a trash icon button
    const trashBtn = page.locator('button .pi-trash').first()
    await expect(trashBtn).toBeVisible()
  })

  test('clicking pencil icon on non-VENCIDO ficha opens status change dialog', async ({ page }) => {
    const hasData = await goToFirstPatient(page)
    if (!hasData) {
      test.skip(true, 'No patients found')
      return
    }
    await clickFichasTab(page)
    await page.waitForTimeout(800)

    const fichaRows = page.locator('tbody tr')
    const fichaRowCount = await fichaRows.count()
    if (fichaRowCount === 0) {
      test.skip(true, 'No fichas found for this patient')
      return
    }

    // Find a row that is NOT in VENCIDO state (pencil button is enabled for PENDIENTE/COMPLETADO)
    // The pencil button has v-tooltip "Cambiar estado" and is disabled when VENCIDO
    const enabledPencilBtn = page.locator('button[disabled!=""]').filter({ has: page.locator('.pi-pencil') }).first()
    const pencilBtns = page.locator('button').filter({ has: page.locator('.pi-pencil') })
    const pencilCount = await pencilBtns.count()

    if (pencilCount === 0) {
      test.skip(true, 'No editable fichas found')
      return
    }

    // Click first non-disabled pencil button
    for (let i = 0; i < pencilCount; i++) {
      const btn = pencilBtns.nth(i)
      const isDisabled = await btn.isDisabled()
      if (!isDisabled) {
        await btn.click()
        break
      }
    }

    // Dialog should open with header "Actualizar Estado: ..."
    await page.waitForTimeout(400)
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Dialog header contains "Actualizar Estado"
    await expect(dialog.getByText(/Actualizar Estado/i)).toBeVisible()

    // Estado actual label is shown
    await expect(dialog.getByText('Estado actual:')).toBeVisible()

    // Close dialog without saving
    const cancelBtn = dialog.getByRole('button', { name: /cancelar/i })
    await expect(cancelBtn).toBeVisible()
    await cancelBtn.click()
    await page.waitForTimeout(300)
    await expect(dialog).not.toBeVisible()
  })
})
