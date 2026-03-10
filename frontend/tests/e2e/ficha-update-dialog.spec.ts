import { test, expect } from '@playwright/test'

async function login(page: any) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.locator('#email').fill('admin@miempresa.com')
  await page.locator('#password input').fill('password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 15000 })
}

async function goToPacientes(page: any) {
  if (page.url().includes('/pacientes')) return
  await page.locator('aside nav').getByRole('link', { name: 'Pacientes' }).click()
  await page.waitForURL('/pacientes', { timeout: 10000 })
  await page.waitForLoadState('networkidle')
}

async function goToPatientWithFichas(page: any) {
  await goToPacientes(page)
  await page.waitForTimeout(1000)

  // Look for a patient with fichas (Roberto Silva Castro has 1 ficha)
  const rows = page.locator('tbody tr')
  const rowCount = await rows.count()

  // Find patient with fichas count > 0
  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i)
    const fichasCell = row.locator('td').nth(3) // Fichas column
    const fichasText = await fichasCell.textContent()

    if (fichasText && parseInt(fichasText) > 0) {
      // Click the eye icon for this patient
      await row.locator('.pi-eye').click()
      await page.waitForURL(/\/pacientes\/\d+$/, { timeout: 8000 })
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)
      return true
    }
  }

  return false
}

test.describe('Ficha Update Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await login(page)
  })

  test('should open ficha update dialog when clicking eye icon', async ({ page }) => {
    const found = await goToPatientWithFichas(page)
    expect(found).toBeTruthy()

    // Click on Fichas & Evaluaciones tab
    await page.getByRole('button', { name: /fichas.*evaluaciones/i }).click()
    await page.waitForTimeout(500)

    // Verify the Historial de Fichas section is visible
    await expect(page.getByText('Historial de Fichas')).toBeVisible()

    // Click the eye icon in the actions column
    const eyeButton = page.locator('table tbody tr').first().locator('button').filter({ hasText: '' })
    await eyeButton.click()
    await page.waitForTimeout(500)

    // Verify dialog is open
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Actualizar: Ficha')).toBeVisible()
  })

  test('should display all form fields in the dialog', async ({ page }) => {
    const found = await goToPatientWithFichas(page)
    expect(found).toBeTruthy()

    // Navigate to Fichas & Evaluaciones tab
    await page.getByRole('button', { name: /fichas.*evaluaciones/i }).click()
    await page.waitForTimeout(500)

    // Open the dialog
    const eyeButton = page.locator('table tbody tr').first().locator('button').filter({ hasText: '' })
    await eyeButton.click()
    await page.waitForTimeout(500)

    // Verify all fields are present
    await expect(page.getByText('Estado *')).toBeVisible()
    await expect(page.getByText('Fecha Completado')).toBeVisible()
    await expect(page.getByText('Fecha Vencimiento')).toBeVisible()
    await expect(page.getByText('Notas / Observaciones')).toBeVisible()

    // Verify buttons
    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Guardar Cambios' })).toBeVisible()
  })

  test('should allow changing Estado field', async ({ page }) => {
    const found = await goToPatientWithFichas(page)
    expect(found).toBeTruthy()

    // Navigate to Fichas & Evaluaciones tab and open dialog
    await page.getByRole('button', { name: /fichas.*evaluaciones/i }).click()
    await page.waitForTimeout(500)

    const eyeButton = page.locator('table tbody tr').first().locator('button').filter({ hasText: '' })
    await eyeButton.click()
    await page.waitForTimeout(500)

    // Click on Estado dropdown
    const estadoCombobox = page.locator('#estado')
    await estadoCombobox.click()
    await page.waitForTimeout(300)

    // Verify options are visible
    await expect(page.getByRole('option', { name: 'Completado' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Pendiente' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Vencido' })).toBeVisible()

    // Select Pendiente
    await page.getByRole('option', { name: 'Pendiente' }).click()
    await page.waitForTimeout(300)

    // Verify the selection changed
    const selectedValue = await estadoCombobox.textContent()
    expect(selectedValue).toContain('Pendiente')
  })

  test('should allow adding text to Notas/Observaciones field', async ({ page }) => {
    const found = await goToPatientWithFichas(page)
    expect(found).toBeTruthy()

    // Navigate to Fichas & Evaluaciones tab and open dialog
    await page.getByRole('button', { name: /fichas.*evaluaciones/i }).click()
    await page.waitForTimeout(500)

    const eyeButton = page.locator('table tbody tr').first().locator('button').filter({ hasText: '' })
    await eyeButton.click()
    await page.waitForTimeout(500)

    // Add text to Notas/Observaciones
    const notasTextbox = page.getByRole('textbox', { name: 'Notas / Observaciones' })
    const testNote = 'Esta es una prueba de actualización de ficha'
    await notasTextbox.fill(testNote)

    // Verify the text was entered
    const value = await notasTextbox.inputValue()
    expect(value).toBe(testNote)
  })

  test('should close dialog when clicking Cancelar', async ({ page }) => {
    const found = await goToPatientWithFichas(page)
    expect(found).toBeTruthy()

    // Navigate to Fichas & Evaluaciones tab and open dialog
    await page.getByRole('button', { name: /fichas.*evaluaciones/i }).click()
    await page.waitForTimeout(500)

    const eyeButton = page.locator('table tbody tr').first().locator('button').filter({ hasText: '' })
    await eyeButton.click()
    await page.waitForTimeout(500)

    // Verify dialog is open
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()

    // Click Cancelar
    await page.getByRole('button', { name: 'Cancelar' }).click()
    await page.waitForTimeout(300)

    // Verify dialog is closed
    await expect(dialog).not.toBeVisible()
  })

  test('should close dialog when clicking X button', async ({ page }) => {
    const found = await goToPatientWithFichas(page)
    expect(found).toBeTruthy()

    // Navigate to Fichas & Evaluaciones tab and open dialog
    await page.getByRole('button', { name: /fichas.*evaluaciones/i }).click()
    await page.waitForTimeout(500)

    const eyeButton = page.locator('table tbody tr').first().locator('button').filter({ hasText: '' })
    await eyeButton.click()
    await page.waitForTimeout(500)

    // Verify dialog is open
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()

    // Click Close button (X)
    await page.getByRole('button', { name: 'Close' }).click()
    await page.waitForTimeout(300)

    // Verify dialog is closed
    await expect(dialog).not.toBeVisible()
  })

  test('should successfully update ficha and refresh table', async ({ page }) => {
    const found = await goToPatientWithFichas(page)
    expect(found).toBeTruthy()

    // Navigate to Fichas & Evaluaciones tab
    await page.getByRole('button', { name: /fichas.*evaluaciones/i }).click()
    await page.waitForTimeout(500)

    // Get the current estado from the table
    const firstRow = page.locator('table tbody tr').first()
    const estadoCellBefore = firstRow.locator('td').nth(1) // Estado column
    const estadoTextBefore = await estadoCellBefore.textContent()

    // Open dialog
    const eyeButton = firstRow.locator('button').filter({ hasText: '' })
    await eyeButton.click()
    await page.waitForTimeout(500)

    // Change Estado to a different value
    const estadoCombobox = page.locator('#estado')
    await estadoCombobox.click()
    await page.waitForTimeout(300)

    // Select a different estado (if current is COMPLETADO, select PENDIENTE, else select COMPLETADO)
    if (estadoTextBefore?.includes('COMPLETADO')) {
      await page.getByRole('option', { name: 'Pendiente' }).click()
    } else {
      await page.getByRole('option', { name: 'Completado' }).click()
    }
    await page.waitForTimeout(300)

    // Add note
    const notasTextbox = page.getByRole('textbox', { name: 'Notas / Observaciones' })
    await notasTextbox.fill('Actualización de prueba automatizada')

    // Click Guardar Cambios
    await page.getByRole('button', { name: 'Guardar Cambios' }).click()
    await page.waitForTimeout(1000)

    // Verify dialog is closed
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).not.toBeVisible()

    // Verify the estado changed in the table
    const estadoCellAfter = firstRow.locator('td').nth(1)
    const estadoTextAfter = await estadoCellAfter.textContent()

    // The estado should have changed
    expect(estadoTextAfter).not.toBe(estadoTextBefore)
  })

  test('should persist estado changes after reopening dialog', async ({ page }) => {
    const found = await goToPatientWithFichas(page)
    expect(found).toBeTruthy()

    // Navigate to Fichas & Evaluaciones tab
    await page.getByRole('button', { name: /fichas.*evaluaciones/i }).click()
    await page.waitForTimeout(500)

    const firstRow = page.locator('table tbody tr').first()
    const eyeButton = firstRow.locator('button').filter({ hasText: '' })

    // Open dialog
    await eyeButton.click()
    await page.waitForTimeout(500)

    // Change Estado to PENDIENTE
    const estadoCombobox = page.locator('#estado')
    await estadoCombobox.click()
    await page.waitForTimeout(300)
    await page.getByRole('option', { name: 'Pendiente' }).click()
    await page.waitForTimeout(300)

    // Save changes
    await page.getByRole('button', { name: 'Guardar Cambios' }).click()
    await page.waitForTimeout(1000)

    // Reopen dialog
    await eyeButton.click()
    await page.waitForTimeout(500)

    // Verify Estado is still PENDIENTE
    const estadoValue = await estadoCombobox.textContent()
    expect(estadoValue).toContain('Pendiente')

    // Close dialog
    await page.getByRole('button', { name: 'Close' }).click()
  })
})
