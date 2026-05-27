// @ts-check
const { test, expect } = require('@playwright/test');

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';
const ts = Date.now();

const ORG = {
  name: `Organizador ${ts}`,
  email: `org${ts}@test.com`,
  password: 'Test123!',
};

const ARB = {
  name: 'Arbiter Test',
  email: `arb${ts}@test.com`,
  password: 'Arbiter123!',
};

let tournamentId;

// 1. Register
test('01 - Register organizer', async ({ page }) => {
  await page.goto(BASE + '/register');
  await expect(page.locator('h1')).toContainText('Crear Cuenta');
  await page.fill('input[type="text"]', ORG.name);
  await page.fill('input[type="email"]', ORG.email);
  await page.fill('input[type="password"]', ORG.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/pricing', { timeout: 15000 });
  await expect(page.locator('h1')).toContainText('Planes');
});

// 2. Choose membership
test('02 - Select plan', async ({ page }) => {
  await page.goto(BASE + '/pricing');
  const btn = page.locator('button:has-text("Suscribirse")').first();
  await btn.waitFor({ state: 'visible', timeout: 5000 });
  await btn.click();
  await page.waitForTimeout(1500);
});

// 3. Dashboard verification
test('03 - Dashboard shows membership', async ({ page }) => {
  await page.goto(BASE + '/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('text=Básico').first()).toBeVisible({ timeout: 8000 });
});

// 4. Create tournament
test('04 - Create tournament', async ({ page }) => {
  await page.goto(BASE + '/new');
  await page.waitForLoadState('networkidle');
  await page.fill('input[name="name"]', 'Torneo E2E');
  await page.selectOption('select[name="system"]', 'dutch');
  await page.fill('input[name="n_rounds"]', '3');
  await page.fill('input[name="start_date"]', '2026-06-01');
  await page.fill('input[name="end_date"]', '2026-06-03');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/tournament/**', { timeout: 10000 });
  tournamentId = new URL(page.url()).pathname.split('/').pop();
  expect(tournamentId).toBeTruthy();
});

// 5. Add players via API
test('05 - Add players via API', async () => {
  const loginRes = await fetch(BASE.replace(':5173', ':4000') + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ORG.email, password: ORG.password }),
  });
  const { token } = await loginRes.json();

  const api = async (method, path, body) => {
    const res = await fetch(BASE.replace(':5173', ':4000') + path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  };

  const players = [
    { name: 'Ana', last_name: 'García', fide_rating: 2500 },
    { name: 'Luis', last_name: 'Martínez', fide_rating: 2400 },
    { name: 'Carlos', last_name: 'López', fide_rating: 2350 },
    { name: 'Sofía', last_name: 'Ramírez', fide_rating: 2300 },
  ];

  for (const p of players) {
    const player = await api('POST', '/players', p);
    await api('POST', `/tournaments/${tournamentId}/players`, { player_id: player.id });
  }
});

// 6. Generate & close round
test('06 - Generate and close round', async ({ page }) => {
  await page.goto(`${BASE}/tournament/${tournamentId}`);
  await page.waitForLoadState('networkidle');
  await page.click('text=Rondas');
  await page.waitForTimeout(500);
  await page.click('button:has-text("Generar")');
  await page.waitForTimeout(1500);
  const dashBtns = page.locator('button:has-text("-")');
  const count = await dashBtns.count();
  if (count > 0) await dashBtns.first().click();
  await page.waitForTimeout(300);
  for (let i = 1; i < count; i++) {
    const btn = page.locator('button:has-text("½-½")').first();
    if (await btn.isVisible()) await btn.click();
  }
  await page.click('button:has-text("Cerrar")');
  await page.waitForTimeout(1500);
});

// 7. Standings
test('07 - View standings', async ({ page }) => {
  await page.goto(`${BASE}/tournament/${tournamentId}`);
  await page.waitForLoadState('networkidle');
  await page.click('text=Clasificación');
  await page.waitForTimeout(1000);
  await expect(page.locator('table')).toBeVisible({ timeout: 5000 });
});

// 8. Register arbiter + assign
test('08 - Register arbiter and assign', async ({ page }) => {
  await page.goto(BASE + '/register');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="text"]', ARB.name);
  await page.fill('input[type="email"]', ARB.email);
  await page.fill('input[type="password"]', ARB.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/pricing', { timeout: 15000 });
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', ORG.email);
  await page.fill('input[type="password"]', ORG.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(BASE + '/', { timeout: 10000 });
  await page.goto(`${BASE}/tournament/${tournamentId}`);
  await page.waitForLoadState('networkidle');
  await page.click('text=Personalizar');
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 9999));
  const input = page.locator('input[placeholder*="Email"]');
  if (await input.isVisible()) {
    await input.fill(ARB.email);
    await page.click('button:has-text("Añadir")');
    await page.waitForTimeout(1000);
  }
});

// 9. Public tournament page
test('09 - Public tournament page', async ({ page }) => {
  await page.goto(`${BASE}/public/tournament/${tournamentId}`);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('text=Torneo E2E')).toBeVisible({ timeout: 8000 });
});

// 10. Arbiter panel access
test('10 - Arbiter panel access', async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', ARB.email);
  await page.fill('input[type="password"]', ARB.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(BASE + '/', { timeout: 10000 });
  await page.goto(BASE + '/arbiter');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('text=Panel de Árbitro')).toBeVisible({ timeout: 5000 });
});
