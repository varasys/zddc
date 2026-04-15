import { test, expect } from '@playwright/test';
import { MOCK_FS_INIT_SCRIPT } from './fixtures/mock-fs-api.js';
import * as path from 'path';

const HTML_PATH = path.resolve('mdedit/dist/mdedit.html');

test.describe('Markdown Editor', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(MOCK_FS_INIT_SCRIPT);
    });

    test('loads without errors', async ({ page }) => {
        // Use 'load' rather than 'networkidle' — the bundled Toast UI/Tailwind
        // scripts run inline so there is no external network activity to wait for.
        await page.goto(`file://${HTML_PATH}`, { waitUntil: 'load' });
        await page.waitForSelector('#app', { timeout: 15000 });

        // Welcome screen is shown before any directory is opened
        await expect(page.locator('#welcome-screen')).toBeVisible();

        // Select Directory button is present and enabled
        const selectDirBtn = page.locator('#select-directory');
        await expect(selectDirBtn).toBeVisible();
        await expect(selectDirBtn).not.toBeDisabled();
    });

    test('renders a file tree from a mock directory', async ({ page }) => {
        await page.goto(`file://${HTML_PATH}`, { waitUntil: 'load' });
        await page.waitForSelector('#select-directory', { timeout: 15000 });

        // Set up mock directory before triggering the picker
        await page.evaluate(() => {
            window.__setMockDirectory('notes', [
                { name: 'readme.md', content: '# Hello\n\nWelcome.', size: 30 },
                { name: 'notes.md', content: '# Notes\n\nSome notes.', size: 25 },
            ]);
        });

        await page.locator('#select-directory').click();

        // File tree should populate with the two files
        await page.waitForFunction(
            () => document.querySelector('#file-tree')?.children.length > 0,
            { timeout: 10000 }
        );

        const items = await page.locator('#file-tree *').count();
        expect(items).toBeGreaterThanOrEqual(2);
    });
});
