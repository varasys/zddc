const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Signature Status Element', () => {
  test.beforeEach(async ({ page }) => {
    // Mock file system access API
    await page.addInitScript(() => {
      window.showOpenFilePicker = async () => {
        return [{
          getFile: async () => ({
            name: 'test.html',
            size: 1024,
            type: 'text/html',
            text: async () => '<html><body>test</body></html>'
          })
        }];
      };
      window.showDirectoryPicker = async () => ({
        name: 'test',
        getFileHandle: async () => ({
          getFile: async () => ({
            name: 'test.html',
            size: 1024,
            type: 'text/html',
            text: async () => '<html><body>test</body></html>'
          })
        }),
        getDirectoryHandle: async () => ({
          getDirectoryHandle: async () => ({}),
          getFileHandle: async () => ({})
        }),
        removeEntry: async () => {},
        exists: async () => false
      });
      window.FileSystemHandle = class {};
    });
  });

  test('should check if #signature-status-static is visible by default before JS runs', async ({ page }) => {
    const htmlPath = path.resolve('/home/user/src/zddc/transmittal/dist/transmittal.html');
    await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded' });
    
    // Check initial state - element should be visible before JavaScript runs
    const staticWarning = page.locator('#signature-status-static');
    
    // Before hydration, check if element is visible
    // Note: We need to check computed styles before JS runs, so we check at domcontentloaded
    const isHiddenAttr = await staticWarning.getAttribute('hidden');
    const computedVisibility = await staticWarning.evaluate(el => 
      window.getComputedStyle(el).visibility
    );
    const computedDisplay = await staticWarning.evaluate(el => 
      window.getComputedStyle(el).display
    );
    
    console.log('Initial state (before JS):');
    console.log('  hidden attribute:', isHiddenAttr);
    console.log('  computed visibility:', computedVisibility);
    console.log('  computed display:', computedDisplay);
    
    // The element should NOT have hidden attribute initially (before JS runs)
    // But since we can't truly capture "before JS", we'll check after load
    expect(computedVisibility).not.toBe('hidden');
  });

  test('should check if hydrate() function is executed (console log)', async ({ page }) => {
    const consoleLogs = [];
    
    // Must attach console listener BEFORE page.goto to catch all console messages
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      console.log('[PLAYWRIGHT CONSOLE]', text);
    });
    
    // Also capture page errors
    page.on('pageerror', err => {
      console.log('[PLAYWRIGHT PAGE ERROR]', err.message);
    });
    
    const htmlPath = path.resolve('/home/user/src/zddc/transmittal/dist/transmittal.html');
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
    
    // Wait for hydration to complete
    await page.waitForTimeout(1000);
    
    console.log('=== END OF HYDRATE TEST ===');
    console.log('Total console logs:', consoleLogs.length);
    
    // Check that hydrate ran successfully
    const signatureStatus = page.locator('#signature-status-static');
    const isHidden = await signatureStatus.getAttribute('hidden');
    console.log('After JS runs - hidden attribute:', isHidden);
    
    // Check if any console logs indicate hydrate execution
    const hydrateLogs = consoleLogs.filter(log => log.includes('[hydrate'));
    console.log('Hydrate-related logs:', hydrateLogs.length);
    hydrateLogs.forEach(log => console.log('  ', log));
    
    // Check main.js init execution
    const mainLogs = consoleLogs.filter(log => log.includes('[main.js]') || log.includes('filesModule.loadFromJson'));
    console.log('Main-related logs:', mainLogs.length);
    mainLogs.forEach(log => console.log('  ', log));
  });

  test('should check if element becomes hidden after JS runs', async ({ page }) => {
    const htmlPath = path.resolve('/home/user/src/zddc/transmittal/dist/transmittal.html');
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
    
    // Wait for JavaScript to fully execute
    await page.waitForTimeout(1000);
    
    const staticWarning = page.locator('#signature-status-static');
    
    // Check computed styles directly from the element
    const styles = await staticWarning.evaluate(el => {
      const computedStyle = window.getComputedStyle(el);
      return {
        display: computedStyle.display,
        visibility: computedStyle.visibility,
        opacity: computedStyle.opacity,
        hasHiddenAttribute: el.hasAttribute('hidden'),
        hiddenProperty: el.hidden,
        styleAttribute: el.getAttribute('style'),
        className: el.className
      };
    });
    
    console.log('=== ELEMENT STATE AFTER HYDRATION ===');
    console.log('  display:', styles.display);
    console.log('  visibility:', styles.visibility);
    console.log('  opacity:', styles.opacity);
    console.log('  has hidden attribute:', styles.hasHiddenAttribute);
    console.log('  hidden property:', styles.hiddenProperty);
    console.log('  style attribute:', styles.styleAttribute || '(none)');
    console.log('  className:', styles.className);
    console.log('=====================================');
    
    // The element should be hidden after hydrate() runs
    // Note: .hidden property sets display: none, so display should be 'none'
    expect(styles.display).toBe('none');
  });

  test('should report actual CSS computed style after JS runs', async ({ page }) => {
    const htmlPath = path.resolve('/home/user/src/zddc/transmittal/dist/transmittal.html');
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
    
    // Wait for JavaScript to fully execute
    await page.waitForTimeout(1000);
    
    const staticWarning = page.locator('#signature-status-static');
    
    // Get computed styles
    const styles = await staticWarning.evaluate(el => {
      const computedStyle = window.getComputedStyle(el);
      return {
        visibility: computedStyle.visibility,
        display: computedStyle.display,
        opacity: computedStyle.opacity,
        hidden: el.hidden
      };
    });
    
    console.log('=== FINAL CSS COMPUTED STYLES ===');
    console.log('  visibility:', styles.visibility);
    console.log('  display:', styles.display);
    console.log('  opacity:', styles.opacity);
    console.log('  hidden (property):', styles.hidden);
    console.log('==================================');
    
    expect(styles.display).toBe('none');
    expect(styles.hidden).toBe(true);
  });
});
