import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('signature-status-static element', () => {
  test('verifies #signature-status-static is hidden by CSS', async ({ page }) => {
    const htmlPath = path.resolve('/home/user/src/zddc/transmittal/dist/transmittal.html');
    
    // Mock File System Access API
    await page.addInitScript(() => {
      class MockFileHandle {
        constructor(name, content, size) {
          this.kind = 'file';
          this.name = name;
          this._content = content || '';
          this._size = size || (content ? content.length : 0);
        }
        async getFile() {
          const blob = new File([this._content], this.name, {
            lastModified: Date.now(),
            type: this._guessMimeType(),
          });
          if (this._size && this._size !== blob.size) {
            Object.defineProperty(blob, 'size', { value: this._size, writable: false });
          }
          return blob;
        }
        async createWritable() {
          return {
            write(data) { window.__writtenFiles = window.__writtenFiles || {}; window.__writtenFiles[this.name] = data; },
            close() {},
          };
        }
        _guessMimeType() {
          const ext = this.name.split('.').pop().toLowerCase();
          const types = {
            pdf: 'application/pdf',
            html: 'text/html',
            json: 'application/json',
            txt: 'text/plain',
            dwg: 'application/acad',
            md: 'text/markdown',
          };
          return types[ext] || 'application/octet-stream';
        }
      }

      class MockDirectoryHandle {
        constructor(name, entries) {
          this.kind = 'directory';
          this.name = name;
          this._entries = entries || [];
        }
        async *values() { for (const entry of this._entries) yield entry; }
        async *entries() { for (const entry of this._entries) yield [entry.name, entry]; }
        async *keys() { for (const entry of this._entries) yield entry.name; }
        async getFileHandle(name, opts) {
          const found = this._entries.find(e => e.kind === 'file' && e.name === name);
          if (found) return found;
          if (opts && opts.create) {
            const handle = new MockFileHandle(name, '');
            this._entries.push(handle);
            return handle;
          }
          throw new DOMException('A requested file or directory could not be found.', 'NotFoundError');
        }
        async getDirectoryHandle(name, opts) {
          const found = this._entries.find(e => e.kind === 'directory' && e.name === name);
          if (found) return found;
          if (opts && opts.create) {
            const handle = new MockDirectoryHandle(name, []);
            this._entries.push(handle);
            return handle;
          }
          throw new DOMException('A requested file or directory could not be found.', 'NotFoundError');
        }
        async queryPermission() { return 'granted'; }
        async requestPermission() { return 'granted'; }
        async resolve(child) { return child ? [child.name] : null; }
      }

      window.__MockFileHandle = MockFileHandle;
      window.__MockDirectoryHandle = MockDirectoryHandle;
      window.__writtenFiles = {};

      window.__setMockDirectory = function(dirName, files) {
        const entries = (files || []).map(f =>
          new MockFileHandle(f.name, f.content || '', f.size || 0)
        );
        window.__mockRootDirectory = new MockDirectoryHandle(dirName, entries);
      };

      window.showDirectoryPicker = async function(opts) {
        if (!window.__mockRootDirectory) {
          throw new DOMException('The user aborted a request.', 'AbortError');
        }
        return window.__mockRootDirectory;
      };

      window.showOpenFilePicker = async function(opts) {
        if (!window.__mockOpenFiles || window.__mockOpenFiles.length === 0) {
          throw new DOMException('The user aborted a request.', 'AbortError');
        }
        return window.__mockOpenFiles;
      };

      window.showSaveFilePicker = async function(opts) {
        const name = (opts && opts.suggestedName) || 'untitled';
        const handle = new MockFileHandle(name, '');
        window.__lastSaveHandle = handle;
        return handle;
      };
    });

    // Navigate to the HTML file
    await page.goto(`file://${htmlPath}`);
    
    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    
    // Get the signature-status-static element
    const signatureElement = page.locator('#signature-status-static');
    
    // Test 1: Verify element is NOT visible
    await expect(signatureElement).not.toBeVisible();
    
    // Test 2: Verify computed style is display: none
    const computedStyle = await signatureElement.evaluate((el) => {
      return window.getComputedStyle(el).display;
    });
    expect(computedStyle).toBe('none');
    
    // Test 3: Check for console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Wait a bit to capture any console errors
    await page.waitForTimeout(500);
    
    expect(errors).toEqual([]);
  });
});
