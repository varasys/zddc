import { test, expect } from '@playwright/test';
import { MOCK_FS_INIT_SCRIPT } from './fixtures/mock-fs-api.js';

const HTML_PATH = '/home/user/src/zddc/transmittal/dist/transmittal.html';

test.describe('drag-drop zones', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(MOCK_FS_INIT_SCRIPT);
    });

    test('dragenter with directory MIME (empty type) makes file-table eligible', async ({ page }) => {
        await page.goto(`file://${HTML_PATH}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);

        // Dispatch dragenter with relatedTarget: null and directory MIME (empty string)
        await page.evaluate(() => {
            const dt = {
                items: [{ kind: 'file', type: '' }],
                files: [],
                types: ['Files']
            };
            const event = new Event('dragenter', { bubbles: true });
            Object.defineProperty(event, 'dataTransfer', { value: dt, writable: false });
            Object.defineProperty(event, 'relatedTarget', { value: null, writable: false });
            document.dispatchEvent(event);
        });

        await page.waitForTimeout(300);

        // Verify file-table zone is visible and eligible
        const fileTableZone = page.locator('[data-drop-zone="file-table"]');
        await expect(fileTableZone).toHaveClass(/dz-visible/);
        await expect(fileTableZone).toHaveClass(/dz-eligible/);

        // Verify logo-left zone is NOT eligible (image-only zone, no image dropped)
        const logoLeftZone = page.locator('[data-drop-zone="logo-left"]');
        await expect(logoLeftZone).not.toHaveClass(/dz-eligible/);
    });

    test('dragleave with relatedTarget: null removes dz-visible from zones', async ({ page }) => {
        await page.goto(`file://${HTML_PATH}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);

        // First show zones with dragenter
        await page.evaluate(() => {
            const dt = {
                items: [{ kind: 'file', type: '' }],
                files: [],
                types: ['Files']
            };
            const event = new Event('dragenter', { bubbles: true });
            Object.defineProperty(event, 'dataTransfer', { value: dt, writable: false });
            Object.defineProperty(event, 'relatedTarget', { value: null, writable: false });
            document.dispatchEvent(event);
        });

        await page.waitForTimeout(300);

        // Verify zones are visible
        const fileTableZone = page.locator('[data-drop-zone="file-table"]');
        await expect(fileTableZone).toHaveClass(/dz-visible/);

        // Now dispatch dragleave with relatedTarget: null
        await page.evaluate(() => {
            const dt = {
                items: [{ kind: 'file', type: '' }],
                files: [],
                types: ['Files']
            };
            const event = new Event('dragleave', { bubbles: true });
            Object.defineProperty(event, 'dataTransfer', { value: dt, writable: false });
            Object.defineProperty(event, 'relatedTarget', { value: null, writable: false });
            document.dispatchEvent(event);
        });

        await page.waitForTimeout(300);

        // Verify zones no longer have dz-visible class
        await expect(fileTableZone).not.toHaveClass(/dz-visible/);
    });

    test('dragenter with image MIME makes logo zones eligible and file-table ineligible', async ({ page }) => {
        await page.goto(`file://${HTML_PATH}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);

        // Dispatch dragenter with image MIME
        await page.evaluate(() => {
            const dt = {
                items: [{ kind: 'file', type: 'image/png' }],
                files: [],
                types: ['Files']
            };
            const event = new Event('dragenter', { bubbles: true });
            Object.defineProperty(event, 'dataTransfer', { value: dt, writable: false });
            Object.defineProperty(event, 'relatedTarget', { value: null, writable: false });
            document.dispatchEvent(event);
        });

        await page.waitForTimeout(300);

        // App starts in edit mode — logo zones accept image drops and should be eligible
        const logoLeftZone = page.locator('[data-drop-zone="logo-left"]');
        await expect(logoLeftZone).toHaveClass(/dz-eligible/);

        // File-table zone does not accept pure-image drops — should be ineligible
        const fileTableZone = page.locator('[data-drop-zone="file-table"]');
        await expect(fileTableZone).toHaveClass(/dz-ineligible/);
    });
});
