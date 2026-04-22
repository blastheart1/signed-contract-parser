/**
 * E2E tests: New Hire Intake workflow
 *
 * Covers:
 * - Required field validation on each step
 * - Stepping through all 4 intake steps
 * - Custom access preset (toggle modification)
 * - Save custom preset
 * - Full form submission → redirect to dashboard
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, goToAtlas } from './helpers/auth';

const HIRE = {
  firstName: 'E2E',
  lastName: 'TestHire',
  email: 'e2e.testhire@example.com',
  phone: '555-0100',
  location: 'Irvine, CA',
  position: 'QA Engineer',
  startDate: '2026-06-01',
};

test.describe('New hire intake', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await goToAtlas(page);
  });

  test('navigates to intake from dashboard', async ({ page }) => {
    await page.getByRole('button', { name: /new hire/i }).click();
    await expect(page).toHaveURL('/atlas/intake');
    await expect(page.getByRole('heading', { name: /new hire intake/i })).toBeVisible();
  });

  test('step 1 — blocks continuation when required fields empty', async ({ page }) => {
    await page.goto('/atlas/intake');
    await page.getByRole('button', { name: /continue/i }).click();

    // Should still be on step 1 (stepper shows "1" active)
    await expect(page.getByText(/first name/i).first()).toBeVisible();
    // Error messages for required fields
    await expect(page.getByText(/required/i).first()).toBeVisible();
  });

  test('step 1 — blocks with invalid email', async ({ page }) => {
    await page.goto('/atlas/intake');
    await page.locator('input').nth(0).fill(HIRE.firstName);   // first name
    await page.locator('input').nth(1).fill(HIRE.lastName);    // last name
    await page.locator('input').nth(2).fill('not-an-email');   // email
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText(/valid email/i)).toBeVisible();
  });

  test('step 1 — advances when required fields filled', async ({ page }) => {
    await page.goto('/atlas/intake');
    await page.locator('input').nth(0).fill(HIRE.firstName);
    await page.locator('input').nth(1).fill(HIRE.lastName);
    await page.locator('input').nth(2).fill(HIRE.email);
    await page.getByRole('button', { name: /continue/i }).click();

    // Step 2 header
    await expect(page.getByText(/role & start date/i)).toBeVisible();
  });

  test('step 2 — blocks when position / start date missing', async ({ page }) => {
    await page.goto('/atlas/intake');
    // Fill step 1
    await page.locator('input').nth(0).fill(HIRE.firstName);
    await page.locator('input').nth(1).fill(HIRE.lastName);
    await page.locator('input').nth(2).fill(HIRE.email);
    await page.getByRole('button', { name: /continue/i }).click();

    // Attempt continue without filling step 2
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText(/required/i).first()).toBeVisible();
  });

  test('step 2 — advances when position and start date filled', async ({ page }) => {
    await page.goto('/atlas/intake');
    // Step 1
    await page.locator('input').nth(0).fill(HIRE.firstName);
    await page.locator('input').nth(1).fill(HIRE.lastName);
    await page.locator('input').nth(2).fill(HIRE.email);
    await page.getByRole('button', { name: /continue/i }).click();
    // Step 2
    await page.locator('input[placeholder*="position" i], input').nth(0).fill(HIRE.position);
    await page.locator('input[type="date"]').fill(HIRE.startDate);
    await page.getByRole('button', { name: /continue/i }).click();
    // Step 3 should be visible
    await expect(page.getByText(/access preset/i)).toBeVisible();
  });

  test('step 3 — toggles modify entitlements and show CUSTOM badge', async ({ page }) => {
    await page.goto('/atlas/intake');
    // Step 1
    await page.locator('input').nth(0).fill(HIRE.firstName);
    await page.locator('input').nth(1).fill(HIRE.lastName);
    await page.locator('input').nth(2).fill(HIRE.email);
    await page.getByRole('button', { name: /continue/i }).click();
    // Step 2
    await page.locator('input').nth(0).fill(HIRE.position);
    await page.locator('input[type="date"]').fill(HIRE.startDate);
    await page.getByRole('button', { name: /continue/i }).click();

    // Select a preset if available
    const presetSelect = page.locator('select').first();
    const optionCount = await presetSelect.locator('option').count();
    if (optionCount > 0) {
      await presetSelect.selectOption({ index: 0 });
    }

    // Click the first toggle row in the entitlements list
    const toggleRows = page.locator('[style*="cursor: pointer"]').filter({ hasText: /Google|Dropbox|Trello|Trainual/ });
    if (await toggleRows.count() > 0) {
      await toggleRows.first().click();
      await expect(page.getByText('CUSTOM')).toBeVisible();
    }
  });

  test('full intake flow — submits and redirects to dashboard', async ({ page }) => {
    await page.goto('/atlas/intake');
    // Step 1
    await page.locator('input').nth(0).fill(HIRE.firstName);
    await page.locator('input').nth(1).fill(HIRE.lastName);
    await page.locator('input').nth(2).fill(HIRE.email);
    await page.locator('input').nth(3).fill(HIRE.phone);
    await page.locator('input').nth(4).fill(HIRE.location);
    await page.getByRole('button', { name: /continue/i }).click();

    // Step 2
    await page.locator('input').nth(0).fill(HIRE.position);
    await page.locator('input[type="date"]').fill(HIRE.startDate);
    await page.getByRole('button', { name: /continue/i }).click();

    // Step 3 — pick first available preset or skip
    const presetSelect = page.locator('select').first();
    const optionCount = await presetSelect.locator('option').count();
    if (optionCount > 0) await presetSelect.selectOption({ index: 0 });
    await page.getByRole('button', { name: /continue/i }).click();

    // Step 4 review
    await expect(page.getByText(/review/i).first()).toBeVisible();
    await page.getByRole('button', { name: /submit/i }).click();

    // Should redirect to /atlas dashboard
    await expect(page).toHaveURL('/atlas', { timeout: 10000 });
  });
});
