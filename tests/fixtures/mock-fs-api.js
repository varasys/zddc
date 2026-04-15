/**
 * Reusable File System Access API mock for Playwright tests.
 *
 * Usage in a Playwright test:
 *
 *   import { MOCK_FS_INIT_SCRIPT, buildMockDirectory } from './fixtures/mock-fs-api.js';
 *
 *   test.beforeEach(async ({ page }) => {
 *     await page.addInitScript(MOCK_FS_INIT_SCRIPT);
 *   });
 *
 *   test('loads files', async ({ page }) => {
 *     const files = [
 *       { name: '123456-EL-SPC-2623_A (IFR) - Spec.pdf', content: 'pdf-bytes', size: 45000 },
 *     ];
 *     await page.evaluate((files) => {
 *       window.__setMockDirectory('test-project', files);
 *     }, files);
 *     await page.goto(`file://${htmlPath}`);
 *   });
 */

/**
 * Init script string to inject via page.addInitScript().
 * Defines MockFileHandle, MockDirectoryHandle, and overrides the
 * showDirectoryPicker / showOpenFilePicker / showSaveFilePicker APIs.
 */
export const MOCK_FS_INIT_SCRIPT = `
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
      const name = this.name;
      const chunks = [];
      return {
        write(data) { chunks.push(data); },
        close() {
          window.__writtenFiles = window.__writtenFiles || {};
          window.__writtenFiles[name] = chunks;
        },
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

    async *values() {
      for (const entry of this._entries) {
        yield entry;
      }
    }

    async *entries() {
      for (const entry of this._entries) {
        yield [entry.name, entry];
      }
    }

    async *keys() {
      for (const entry of this._entries) {
        yield entry.name;
      }
    }

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

  // Expose constructors globally for per-test customization
  window.__MockFileHandle = MockFileHandle;
  window.__MockDirectoryHandle = MockDirectoryHandle;
  window.__writtenFiles = {};

  /**
   * Helper to build a mock directory from a flat file list.
   * @param {string} dirName - Root directory name
   * @param {Array<{name: string, content?: string, size?: number}>} files - Flat file list
   */
  window.__setMockDirectory = function(dirName, files) {
    const entries = (files || []).map(f =>
      new MockFileHandle(f.name, f.content || '', f.size || 0)
    );
    window.__mockRootDirectory = new MockDirectoryHandle(dirName, entries);
  };

  /**
   * Helper to build nested mock directories.
   * @param {string} dirName - Root directory name
   * @param {Object} tree - Nested structure: { 'subdir': { 'file.txt': 'content' }, 'root.pdf': 'content' }
   */
  window.__setMockDirectoryTree = function(dirName, tree) {
    function buildEntries(obj) {
      const entries = [];
      for (const [name, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null && !ArrayBuffer.isView(value)) {
          entries.push(new MockDirectoryHandle(name, buildEntries(value)));
        } else {
          entries.push(new MockFileHandle(name, String(value), String(value).length));
        }
      }
      return entries;
    }
    window.__mockRootDirectory = new MockDirectoryHandle(dirName, buildEntries(tree));
  };

  // Override File System Access API pickers
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
`;

/**
 * Helper to build a mock directory structure for page.evaluate().
 * Call this in test code (Node-side), then pass to page.evaluate().
 *
 * @param {string} name - Directory name
 * @param {Array<{name: string, content?: string, size?: number}>} files
 * @returns {Object} Serializable directory description
 */
export function buildMockDirectory(name, files) {
  return { name, files };
}
