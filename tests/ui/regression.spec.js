const { test, expect } = require('@playwright/test');

/** Базовий URL API (глобальний setup піднімає сервер на :3000). */
const API_ROOT = process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:3000';

test.describe('UI: основні сценарії SPA', () => {
  test('вхід адміністратора і дашборд', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('auth-login-submit')).toBeVisible();
    await page.getByTestId('auth-login-email').fill('admin@sto.local');
    await page.getByTestId('auth-login-password').fill('Admin123!');
    await page.getByTestId('auth-login-submit').click();
    await expect(page.getByRole('heading', { name: 'Дашборд', level: 2 })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: 'Вийти' })).toBeVisible();
  });

  test('перехід до календаря записів і канбану', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('auth-login-email').fill('admin@sto.local');
    await page.getByTestId('auth-login-password').fill('Admin123!');
    await page.getByTestId('auth-login-submit').click();
    await expect(page.getByRole('heading', { name: 'Дашборд', level: 2 })).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: 'Онлайн-запис' }).click();
    await expect(page.getByRole('heading', { name: 'Календар записів', level: 3 })).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'Замовлення (Канбан)' }).click();
    await expect(page.getByRole('heading', { name: 'Канбан замовлень', level: 2 })).toBeVisible({ timeout: 15000 });
  });

  test('реєстрація клієнта з привʼязкою до картки за телефоном', async ({ page, request }) => {
    const phone = `+38095${Date.now().toString().slice(-7)}`;
    const loginRes = await request.post(`${API_ROOT}/api/auth/login`, {
      data: { email: 'admin@sto.local', password: 'Admin123!' },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { token } = await loginRes.json();

    const clientRes = await request.post(`${API_ROOT}/api/clients`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { full_name: 'Картка перед реєстрацією', phone, notes: '' },
    });
    expect(clientRes.ok()).toBeTruthy();
    const created = await clientRes.json();

    await page.goto('/');
    await page.getByTestId('auth-tab-register').click();
    await page.getByTestId('auth-register-fullname').fill('Імʼя у формі');
    await page.getByTestId('auth-register-phone').fill(phone);
    await page.getByTestId('auth-register-email').fill(`pw-${Date.now()}@sto.local`);
    await page.getByTestId('auth-register-password').fill('Client123!');
    await page.getByTestId('auth-register-submit').click();

    await expect(page.getByRole('heading', { name: 'Кабінет клієнта', level: 2 })).toBeVisible({ timeout: 25000 });

    const profileRes = await request.get(`${API_ROOT}/api/client/profile`, {
      headers: { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('sto_token'))}` },
    });
    expect(profileRes.ok()).toBeTruthy();
    const body = await profileRes.json();
    expect(body.profile?.id).toBe(created.id);
  });
});
