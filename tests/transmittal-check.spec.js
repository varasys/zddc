const { test, expect } = require('@playwright/test');

test.describe('Transmittal HTML Check', () => {
  test('should check initial state of transmittal HTML', async ({ page }) => {
    const htmlPath = '/home/user/src/zddc/transmittal/dist/transmittal.html';
    
    // Mock file system API before page load
    await page.addInitScript(() => {
      window.fsMockData = {};
      window.showDirectoryPicker = async () => ({
        getDirectoryHandle: () => ({
          getFileHandle: async () => ({ getFile: async () => ({ text: async () => JSON.stringify({}) }) }),
          setHandle: async () => {}
        }),
        getFilePath: async () => '/mock/path'
      });
      window.showSaveFilePicker = async () => ({
        createWritable: () => ({
          write: async () => {},
          close: async () => {}
        })
      });
      
      // Override File System Access API
      window.FileSystemFileHandle = class {
        constructor(file) { this.file = file; }
        getFile = async () => this.file;
      };
      window.FileSystemDirectoryHandle = class {};
      
      // Store original APIs
      window._originalShowDirectoryPicker = window.showDirectoryPicker;
      window._originalShowSaveFilePicker = window.showSaveFilePicker;
    });
    
    // Open the transmittal HTML file
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
    
    // Check for console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Give page time to load
    await page.waitForTimeout(500);
    
    // 1. Check if "NOT VALIDATED (requires JavaScript)" warning is visible
    const warningLocator = page.locator('text=NOT VALIDATED (requires JavaScript)');
    const warningIsVisible = await warningLocator.isVisible();
    
    // 2. Check signature-status-static element
    const signatureStatus = page.locator('#signature-status-static');
    const signatureHiddenAttr = await signatureStatus.getAttribute('hidden');
    const signatureHiddenProp = await signatureStatus.evaluate(el => el.hidden);
    
    // 3. Check digest-display element content
    const digestContent = await page.locator('#digest-display').evaluate(el => el.textContent.trim());
    
    // 4. Check for additional elements
    const signatureStatusText = await signatureStatus.textContent();
    
    return {
      warningVisible: warningIsVisible,
      signatureStatus: {
        hasHiddenAttr: signatureHiddenAttr !== null,
        isHidden: signatureHiddenProp,
        textContent: signatureStatusText || '(empty)'
      },
      digestDisplay: {
        content: digestContent,
        isEmpty: digestContent === ''
      },
      consoleErrors: errors
    };
  });
});
