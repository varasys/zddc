import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import * as path from 'path';

const HTML_PATH = fileURLToPath(new URL('file://' + path.resolve('transmittal/dist/transmittal.html')));

test.describe('signature-status-static element check', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(`
            // Add console logging for hydrate function
            window.addEventListener('DOMContentLoaded', () => {
                console.log('[hydrate] Called');
            });
        `);
    });

    test('check signature-status-static element initial state', async ({ page }) => {
        const consoleLogs = [];
        page.on('console', msg => {
            consoleLogs.push({ type: msg.type(), text: msg.text() });
        });

        await page.goto(`file://${HTML_PATH}`, { waitUntil: 'networkidle' });
        
        // Wait for page to stabilize after hydration
        await page.waitForTimeout(500);

        console.log('=== ACTUAL VALUES OBSERVED ===');
        
        // 1. Check if element exists
        const elementExists = await page.locator('#signature-status-static').count();
        console.log('Element exists:', Boolean(elementExists > 0));

        // 2. Check initial visibility
        const isVisible = await page.locator('#signature-status-static').isVisible();
        console.log('Is visible:', isVisible);

        // 3. Check hidden attribute
        const hiddenAttr = await page.locator('#signature-status-static').getAttribute('hidden');
        console.log('Has hidden attribute:', hiddenAttr !== null);
        console.log('Hidden attribute value:', hiddenAttr);

        // 4. Check hidden property
        const hiddenProp = await page.locator('#signature-status-static').evaluate(el => el.hidden);
        console.log('Hidden property:', hiddenProp);

        // 5. Check computed CSS - display
        const displayValue = await page.locator('#signature-status-static').evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.display;
        });
        console.log('Computed display:', displayValue);

        // 6. Check computed CSS - visibility
        const visibilityValue = await page.locator('#signature-status-static').evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.visibility;
        });
        console.log('Computed visibility:', visibilityValue);

        // 7. Check console logs for hydrate messages
        const hasHydrateLog = consoleLogs.some(log => log.text.includes('[hydrate] Called'));
        console.log('Console log "[hydrate] Called" present:', hasHydrateLog);

        // 8. data-hydrate-hide attribute check
        const dataHydrateHide = await page.locator('#signature-status-static').getAttribute('data-hydrate-hide');
        console.log('data-hydrate-hide attribute:', dataHydrateHide);
        
        console.log('=== END ACTUAL VALUES ===');
    });
});
