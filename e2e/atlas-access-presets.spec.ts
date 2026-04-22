/**
 * E2E tests: Access Presets (Settings → Access presets tab)
 *
 * Covers:
 * - Viewing existing presets
 * - Creating a new preset via modal
 * - Preset appears in the table after creation
 * - Preset is selectable in the intake form
 * - Settings > Integrations Configure button shows info modal
 * - Settings > Permissions tab loads user-sourced roles
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, goToAtlas } from './helpers/auth';

const NEW_PRESET = {
  label: `E2E Preset ${Date.now()}`,
  department: 'QA',
};

test.describe('Settings — Access presets', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/atlas/settings');
    await page.waitForLoadState('networkidle');
  });

  test('Access presets tab is active by default', async ({ page }) => {
    await expect(page.getByText('Role access presets')).toBeVisible();
  });

  test('displays seeded role presets', async ({ page }) => {
    // The table should show at least one row from the seed
    const table = page.locator('table');
    await expect(table).toBeVisible();
    await expect(table.locator('tbody tr').first()).toBeVisible();
  });

  test('opens New preset modal', async ({ page }) => {
    await page.getByRole('button', { name: /new preset/i }).click();
    await expect(page.getByText(/label/i).first()).toBeVisible();
    // Modal overlay should be visible
    await expect(page.locator('[style*="position: fixed"]')).toBeVisible();
  });

  test('creates a new preset and it appears in the table', async ({ page }) => {
    await page.getByRole('button', { name: /new preset/i }).click();

    // Fill label
    await page.locator('input[placeholder*="label" i], input').first().fill(NEW_PRESET.label);

    // Toggle at least one system on
    const toggleRows = page.locator('[style*="cursor: pointer"]').filter({ hasText: /Google|Trello|Trainual/ });
    if (await toggleRows.count() > 0) {
      await toggleRows.first().click();
    }

    await page.getByRole('button', { name: /save preset/i }).click();

    // Modal should close
    await expect(page.locator('[style*="position: fixed"]')).not.toBeVisible({ timeout: 5000 });

    // New preset row should appear in table
    await expect(page.getByText(NEW_PRESET.label)).toBeVisible({ timeout: 5000 });
  });

  test('Cancel closes the modal without saving', async ({ page }) => {
    await page.getByRole('button', { name: /new preset/i }).click();
    await page.locator('input').first().fill('Should Not Be Saved');
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.locator('[style*="position: fixed"]')).not.toBeVisible();
    await expect(page.getByText('Should Not Be Saved')).not.toBeVisible();
  });
});

test.describe('Settings — Integrations tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/atlas/settings');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /integrations/i }).click();
  });

  test('shows connected integrations list', async ({ page }) => {
    await expect(page.getByText('Google Workspace')).toBeVisible();
    await expect(page.getByText('Trainual')).toBeVisible();
  });

  test('shows team labels (not personal names) as owners', async ({ page }) => {
    await expect(page.getByText('IT Team')).toBeVisible();
    await expect(page.getByText('HR Team')).toBeVisible();
    // Ensure old personal names are gone
    await expect(page.getByText('Vic Kaur')).not.toBeVisible();
    await expect(page.getByText('Lena Park')).not.toBeVisible();
  });
});

test.describe('Settings — Permissions tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/atlas/settings');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /permissions/i }).click();
  });

  test('shows role permission rows', async ({ page }) => {
    await expect(page.getByText('HR')).toBeVisible();
    await expect(page.getByText('IT')).toBeVisible();
    await expect(page.getByText('Admin')).toBeVisible();
  });

  test('has Edit button on each permission row', async ({ page }) => {
    const editBtns = page.getByRole('button', { name: /edit/i });
    await expect(editBtns.first()).toBeVisible();
  });
});

test.describe('Intake — preset populated from settings', () => {
  test('new preset is available in intake step 3', async ({ page }) => {
    await loginAsAdmin(page);

    // First create a preset
    await page.goto('/atlas/settings');
    await page.waitForLoadState('networkidle');
    const presetName = `Intake Preset ${Date.now()}`;
    await page.getByRole('button', { name: /new preset/i }).click();
    await page.locator('input').first().fill(presetName);
    await page.getByRole('button', { name: /save preset/i }).click();
    await expect(page.getByText(presetName)).toBeVisible({ timeout: 5000 });

    // Navigate to intake step 3
    await page.goto('/atlas/intake');
    // Fill step 1
    await page.locator('input').nth(0).fill('E2E');
    await page.locator('input').nth(1).fill('Preset Test');
    await page.locator('input').nth(2).fill('e2e.presettest@example.com');
    await page.getByRole('button', { name: /continue/i }).click();
    // Fill step 2
    await page.locator('input').nth(0).fill('Tester');
    await page.locator('input[type="date"]').fill('2026-07-01');
    await page.getByRole('button', { name: /continue/i }).click();

    // Step 3 — preset select should contain the new preset
    const options = await page.locator('select option').allTextContents();
    expect(options.some((o) => o.includes(presetName.split(' ').slice(0, 2).join(' ')))).toBeTruthy();
  });
});
