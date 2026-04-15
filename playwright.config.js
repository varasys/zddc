import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  reporter: [['line'], ['html', { open: 'never' }]],

  use: {
    // Chromium only -- File System Access API requires it,
    // and the ZDDC tools target "any modern Chromium-based browser"
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'archive',
      testMatch: 'archive.spec.js',
    },
    {
      name: 'transmittal',
      testMatch: 'transmittal.spec.js',
    },
    {
      name: 'transmittal-init',
      testMatch: 'transmittal-init-check.spec.js',
    },
    {
      name: 'transmittal-drag-drop',
      testMatch: 'transmittal-drag-drop.spec.js',
    },
    {
      name: 'signature-status',
      testMatch: 'check-signature-status.spec.js',
    },
    {
      name: 'classifier',
      testMatch: 'classifier.spec.js',
    },
    {
      name: 'mdedit',
      testMatch: 'mdedit.spec.js',
    },
    {
      name: 'zddc',
      testMatch: 'zddc.spec.js',
    },
    {
      name: 'zddc-filter',
      testMatch: 'zddc-filter.spec.js',
    },
  ],
});
