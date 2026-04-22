import { Page } from '@playwright/test';

export async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/username/i).fill('admin');
  await page.getByLabel(/password/i).fill('admin123');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL('/dashboard');
}

export async function goToAtlas(page: Page) {
  await page.goto('/atlas');
  await page.waitForLoadState('networkidle');
}
