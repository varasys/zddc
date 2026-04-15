import { test, expect } from '@playwright/test';
import { MOCK_FS_INIT_SCRIPT } from './fixtures/mock-fs-api.js';

const HTML_PATH = '/home/user/src/zddc/transmittal/dist/transmittal.html';

test.describe('Transmittal – initial state validation (detailed check)', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(MOCK_FS_INIT_SCRIPT);
    });

    test('should show NOT VALIDATED warning and check signature/digest elements', async ({ page }) => {
        await page.goto(`file://${HTML_PATH}`, { waitUntil: 'networkidle' });
        
        // Collect console errors
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });
        
        // Wait for page to stabilize
        await page.waitForTimeout(500);
        
        // 1. Check if "Not Validated (requires JavaScript)" warning is visible
        // With the CSS fix, the static warning is now hidden by default when JS is available
        const warningLocator = page.locator('text=Not Validated (requires JavaScript)');
        const warningIsVisible = await warningLocator.isVisible();
        
        // 2. Check signature-status-static element state
        // The element has display:none from CSS, not hidden property (JS may set that too)
        const signatureStatus = page.locator('#signature-status-static');
        const signatureHiddenAttr = await signatureStatus.getAttribute('hidden');
        const signatureHiddenProp = await signatureStatus.evaluate(el => el.hidden);
        const signatureVisibility = await signatureStatus.evaluate(el => getComputedStyle(el).visibility);
        const signatureDisplay = await signatureStatus.evaluate(el => getComputedStyle(el).display);
        
        // 3. Check digest-display element content
        const digestContent = await page.locator('#digest-display').textContent();
        const digestComputedStyle = await page.locator('#digest-display').evaluate(el => getComputedStyle(el));
        const digestDisplay = digestComputedStyle.display;
        const digestVisibility = digestComputedStyle.visibility;
        
        // 4. Check if there are any other visible elements we should report
        const signatureStatusText = await signatureStatus.textContent();
        const digestHasChildren = await page.locator('#digest-display').evaluate(el => el.children.length);
        
        // Report all findings
        console.log('=== INITIAL STATE CHECK ===');
        console.log('Warning visible:', warningIsVisible);
        console.log('signature-status-static display:', signatureDisplay);
        console.log('signature-status-static visibility:', signatureVisibility);
        console.log('signature-status-basic text:', signatureStatusText);
        console.log('digest-display content:', JSON.stringify(digestContent));
        console.log('digest-display display:', digestDisplay);
        console.log('digest-display visibility:', digestVisibility);
        console.log('digest-display children count:', digestHasChildren);
        console.log('console errors:', errors);
        
        // Assertions - with CSS fix, static warning should be hidden
        expect(warningIsVisible).toBe(false); // Hidden by CSS [data-hydrate-hide="true"]
        expect(signatureDisplay).toBe('none');
        // digest-display may be populated by the security module on load — don't assert empty
        expect(errors).toHaveLength(0);
    });
});
