import { test, expect } from '@playwright/test';
import { MOCK_FS_INIT_SCRIPT } from './fixtures/mock-fs-api.js';
import * as path from 'path';

const HTML_PATH = path.resolve('archive/dist/archive.html');

test.describe('Archive Browser', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(MOCK_FS_INIT_SCRIPT);
    });

    test('loads without errors', async ({ page }) => {
        await page.goto(`file://${HTML_PATH}`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#app', { timeout: 15000 });

        // Page title contains "Archive"
        await expect(page).toHaveTitle(/Archive/i);

        // No-directory message is shown before any directory is opened
        await expect(page.locator('#noDirectoryMessage')).toBeVisible();

        // The open-directory button is present
        await expect(page.locator('#addDirectoryBtn')).toBeVisible();
    });

    test('scans a mock directory tree and displays files', async ({ page }) => {
        await page.goto(`file://${HTML_PATH}`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#addDirectoryBtn', { timeout: 15000 });

        // The archive expects a two-level structure: root → transmittal-folder → files.
        // Flat files at the root are not counted — they must be inside subdirectories.
        await page.evaluate(() => {
            window.__setMockDirectoryTree('test-project', {
                '2025-01-15_123456-EM-TRN-0001 (IFC) - First Transmittal': {
                    '123456-EL-SPC-2623_A (IFC) - Specification.pdf': '%PDF',
                    '123456-EL-DRW-0001_B (IFR) - Drawing.dwg':        'DWG',
                },
                '2025-02-10_123456-EM-TRN-0002 (IFC) - Second Transmittal': {
                    '789012-ME-CAL-0001_A (IFA) - Calculation.pdf': '%PDF',
                },
            });
        });

        await page.locator('#addDirectoryBtn').click();

        // Main UI should appear once scanning completes
        await expect(page.locator('.main-container')).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(500);

        // Select all grouping folders so files are included in the file list
        await page.evaluate(() => {
            const cb = document.getElementById('selectAllGroupingCheckbox');
            if (cb && !cb.checked) cb.click();
        });
        await page.waitForTimeout(500);

        // The files table should have at least one data row
        const rowCount = await page.locator('#filesTableBody tr').count();
        expect(rowCount).toBeGreaterThanOrEqual(1);

        // Status bar should show files were found (any non-empty text is fine)
        const fileCountText = await page.locator('#fileCount').textContent();
        expect(fileCountText).toBeTruthy();
    });
});
