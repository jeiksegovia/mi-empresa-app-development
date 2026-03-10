import { test, expect } from '@playwright/test'

const API_URL = 'http://localhost:3001/api/v1'

test.describe.configure({ mode: 'serial' })

test.describe('Patient Notes API', () => {
  let cookieValue: string
  let patientId: number

  test.beforeAll(async ({ request }) => {
    // Login as admin to get session cookie
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: {
        email: 'admin@miempresa.com',
        password: 'password123',
      },
    })
    expect(loginRes.ok()).toBeTruthy()

    const setCookieHeader = loginRes.headers()['set-cookie']
    expect(setCookieHeader).toBeDefined()
    cookieValue = setCookieHeader!

    // Get first patient from list
    const patientsRes = await request.get(`${API_URL}/patients?limit=1`, {
      headers: { cookie: cookieValue },
    })
    expect(patientsRes.ok()).toBeTruthy()
    const patientsData = await patientsRes.json()
    expect(patientsData.data.length).toBeGreaterThan(0)
    patientId = patientsData.data[0].id
  })

  test('should create note for patient', async ({ request }) => {
    const noteData = {
      tipo: 'POSITIVA',
      prioridad: 'MEDIA',
      contenido: 'Paciente presenta mejoría en síntomas',
    }

    const res = await request.post(`${API_URL}/patients/${patientId}/notes`, {
      headers: { cookie: cookieValue },
      data: noteData,
    })

    expect(res.status()).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toBeDefined()
    expect(json.data.id).toBeDefined()
    expect(json.data.tipoNota).toBe(noteData.tipo)
    expect(json.data.prioridad).toBe(noteData.prioridad)
    expect(json.data.contenido).toBe(noteData.contenido)
    expect(json.data.clienteId).toBe(patientId)
  })

  test('should return 404 for non-existent patient', async ({ request }) => {
    const noteData = {
      tipo: 'NEUTRAL',
      prioridad: 'BAJA',
      contenido: 'Test content',
    }

    const res = await request.post(`${API_URL}/patients/999999/notes`, {
      headers: { cookie: cookieValue },
      data: noteData,
    })

    expect(res.status()).toBe(404)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.message).toBe('Patient not found')
  })

  test('should require authentication', async ({ request }) => {
    const noteData = {
      tipo: 'NEUTRAL',
      prioridad: 'BAJA',
      contenido: 'Test content',
    }

    const res = await request.post(`${API_URL}/patients/${patientId}/notes`, {
      data: noteData,
    })

    expect(res.status()).toBe(401)
  })

  test('should validate required fields', async ({ request }) => {
    const invalidData = {
      tipo: '',
      prioridad: 'INVALID',
      contenido: '',
    }

    const res = await request.post(`${API_URL}/patients/${patientId}/notes`, {
      headers: { cookie: cookieValue },
      data: invalidData,
    })

    expect(res.status()).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
