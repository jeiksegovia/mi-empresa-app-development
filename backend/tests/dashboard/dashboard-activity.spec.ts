import { test, expect } from '@playwright/test';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3001';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

let sessionCookie: string;

async function loginAndGetCookie(request: any): Promise<string> {
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(response.status()).toBe(200);
  const setCookie = response.headers()['set-cookie'];
  expect(setCookie).toBeDefined();
  const match = setCookie.match(/session=([^;]+)/);
  expect(match).toBeTruthy();
  return setCookie;
}

test.describe.configure({ mode: 'serial' });

test.describe('Dashboard Activity API', () => {
  test.beforeAll(async ({ request }) => {
    sessionCookie = await loginAndGetCookie(request);
  });

  test.afterAll(async ({ request }) => {
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: sessionCookie },
    });
  });

  test('GET /dashboard/activity requires authentication', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/dashboard/activity`);
    expect(response.status()).toBe(401);
  });

  test('GET /dashboard/activity returns array of activity items for admin', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/dashboard/activity`, {
      headers: { Cookie: sessionCookie },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('each activity item has required shape: type, date, description', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/dashboard/activity`, {
      headers: { Cookie: sessionCookie },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    const activities: any[] = body.data;

    activities.forEach((item: any) => {
      expect(item).toHaveProperty('type');
      expect(item).toHaveProperty('date');
      expect(item).toHaveProperty('description');
      expect(typeof item.type).toBe('string');
      expect(typeof item.description).toBe('string');
    });
  });

  test('activity types are valid known types when data is non-empty', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/dashboard/activity`, {
      headers: { Cookie: sessionCookie },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    const activities: any[] = body.data;

    const knownTypes = ['ficha_completada', 'patient_created', 'employee_created'];

    if (activities.length > 0) {
      // All types must be one of the known types
      activities.forEach((item: any) => {
        expect(knownTypes).toContain(item.type);
      });

      // At least one of the known types should be present
      const presentTypes = new Set(activities.map((a: any) => a.type));
      const hasKnownType = knownTypes.some((t) => presentTypes.has(t));
      expect(hasKnownType).toBe(true);
    }
  });

  test('response contains at most 20 activity items', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/dashboard/activity`, {
      headers: { Cookie: sessionCookie },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    // Service slices to top 20
    expect(body.data.length).toBeLessThanOrEqual(20);
  });

  test('activity items are sorted by date descending (newest first)', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/dashboard/activity`, {
      headers: { Cookie: sessionCookie },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    const activities: any[] = body.data;

    if (activities.length > 1) {
      for (let i = 0; i < activities.length - 1; i++) {
        const dateA = new Date(activities[i].date).getTime();
        const dateB = new Date(activities[i + 1].date).getTime();
        expect(dateA).toBeGreaterThanOrEqual(dateB);
      }
    }
  });
});
