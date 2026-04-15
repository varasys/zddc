import { test, expect } from '@playwright/test';
import { MOCK_FS_INIT_SCRIPT } from './fixtures/mock-fs-api.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const HTML_PATH = path.resolve('transmittal/dist/transmittal.html');

// Tab-separated clipboard data simulating a paste from a document register
const PASTED_FILE_TEXT = [
    '123456-EL-SPC-2623\tMaterial Specification\tA\tIFC\tpdf',
    '123456-EL-SPC-2624\tInstallation Drawing\tB\tIFR\tdwg',
].join('\n');

test.describe('Transmittal – pasted files survive a save/load cycle', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(MOCK_FS_INIT_SCRIPT);
    });

    test('files pasted from clipboard appear after opening the saved draft', async ({ page }) => {
        // ── 1. Load the app ──────────────────────────────────────────────────
        await page.goto(`file://${HTML_PATH}`, { waitUntil: 'networkidle' });

        // ── Wait for table tbody ──────────────────────────────────────────────
        await page.waitForSelector('table tbody', { timeout: 30000 });

        // ── 2. Inject pasted files directly into app state ───────────────────
        // Simulates what "Paste Append Rows" does without needing real clipboard.
        await page.evaluate((clipText) => {
            const app = window.transmittalApp;
            // Parse through the app's own paste parser
            const result = app.modules.files._parseClipboardTextForTest
                ? app.modules.files._parseClipboardTextForTest(clipText)
                : null;

            // Direct injection: build the same structure columnsToFileRow produces
            const rows = clipText.trim().split('\n').map(line => {
                const cols = line.split('\t');
                return {
                    trackingNumber: cols[0] || '',
                    title: cols[1] || '',
                    revision: cols[2] || '',
                    status: cols[3] || '',
                    extension: (cols[4] || '').toLowerCase(),
                    path: '', name: '', size: 0, fileSize: 0, sha256: ''
                };
            });
            app.data.files = rows;
            app.modules.files.updateFilesInJson(app.data.files);
            app.modules.files.render();
        }, PASTED_FILE_TEXT);

        // Verify the files are visible in the table
        const rowsBefore = await page.locator('table tbody tr').count();
        // Self-entry row (row 0) + 2 pasted files
        expect(rowsBefore).toBeGreaterThanOrEqual(3);

        // ── 3. Sync UI to JSON and build the draft HTML ──────────────────────
        const draftHtml = await page.evaluate(async () => {
            const pub = window.transmittalApp.modules.publish;
            await pub.syncUiToJson({ sign: false, computeDigest: false });
            return pub.buildHtmlString();
        });

        expect(typeof draftHtml).toBe('string');
        expect(draftHtml.length).toBeGreaterThan(1000);

        // The draft HTML must contain the tracking numbers in the JSON block
        expect(draftHtml).toContain('123456-EL-SPC-2623');
        expect(draftHtml).toContain('123456-EL-SPC-2624');

        // ── 4. Write the draft to a temp file and open it in a new page ──────
        const tmp = path.join(os.tmpdir(), `transmittal-draft-test-${Date.now()}.html`);
        fs.writeFileSync(tmp, draftHtml, 'utf8');
        try {
            const draftPage = await page.context().newPage();
            await draftPage.addInitScript(MOCK_FS_INIT_SCRIPT);
            await draftPage.goto(`file://${tmp}`);
            await draftPage.waitForSelector('table tbody');

            // ── 5. Assert files survived the round-trip ───────────────────────
            const rowsAfter = await draftPage.locator('table tbody tr').count();
            // Self-entry + 2 pasted files
            expect(rowsAfter).toBeGreaterThanOrEqual(3);

            // Check that the tracking numbers are visible in the table
            await expect(draftPage.locator('table tbody')).toContainText('123456-EL-SPC-2623');
            await expect(draftPage.locator('table tbody')).toContainText('123456-EL-SPC-2624');

            // Check the in-memory data too
            const appFiles = await draftPage.evaluate(() => window.transmittalApp.data.files);
            expect(appFiles.length).toBe(2);
            expect(appFiles[0].trackingNumber).toBe('123456-EL-SPC-2623');
            expect(appFiles[1].trackingNumber).toBe('123456-EL-SPC-2624');

            // Files must have usable names even though path/filename are empty
            expect(appFiles[0].name).toBeTruthy();
            expect(appFiles[1].name).toBeTruthy();

            await draftPage.close();
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    test('files selected from filesystem survive a save/load cycle', async ({ page }) => {
        // ── 1. Load the app ──────────────────────────────────────────────────
        await page.goto(`file://${HTML_PATH}`, { waitUntil: 'networkidle' });
        await page.waitForSelector('table tbody', { state: 'attached' });
        await page.waitForTimeout(300);

        // ── 2. Inject filesystem-style files (have real path + sha256) ───────
        await page.evaluate(() => {
            const app = window.transmittalApp;
            app.data.files = [
                {
                    trackingNumber: '123456-EL-SPC-0001', title: 'Spec One',
                    revision: 'A', status: 'IFC', extension: 'pdf',
                    path: 'project-dir/123456-EL-SPC-0001_A (IFC) - Spec One.pdf',
                    name: '123456-EL-SPC-0001_A (IFC) - Spec One.pdf',
                    size: 10000, fileSize: 10000,
                    sha256: 'aabbccddeeff001122334455667788990011223344556677889900aabbccddee'
                },
                {
                    trackingNumber: '123456-EL-DRW-0002', title: 'Drawing Two',
                    revision: 'B', status: 'IFR', extension: 'dwg',
                    path: 'project-dir/123456-EL-DRW-0002_B (IFR) - Drawing Two.dwg',
                    name: '123456-EL-DRW-0002_B (IFR) - Drawing Two.dwg',
                    size: 20000, fileSize: 20000,
                    sha256: 'ffeeddccbbaa998877665544332211ffeeddccbbaa998877665544332211ffee'
                },
            ];
            app.modules.files.updateFilesInJson(app.data.files);
            app.modules.files.render();
        });
        await page.waitForTimeout(300);

        const rowsBefore = await page.locator('table tbody tr').count();
        expect(rowsBefore).toBeGreaterThanOrEqual(3);

        // ── 3. Build the draft HTML ──────────────────────────────────────────
        const draftHtml = await page.evaluate(async () => {
            const pub = window.transmittalApp.modules.publish;
            await pub.syncUiToJson({ sign: false, computeDigest: false });
            return pub.buildHtmlString();
        });

        expect(draftHtml).toContain('123456-EL-SPC-0001');
        expect(draftHtml).toContain('123456-EL-DRW-0002');

        // ── 4. Open draft and verify ─────────────────────────────────────────
        const tmp = path.join(os.tmpdir(), `transmittal-draft-fs-${Date.now()}.html`);
        fs.writeFileSync(tmp, draftHtml, 'utf8');
        try {
            const draftPage = await page.context().newPage();
            await draftPage.addInitScript(MOCK_FS_INIT_SCRIPT);
            await draftPage.goto(`file://${tmp}`);
            await draftPage.waitForSelector('table tbody');

            const rowsAfter = await draftPage.locator('table tbody tr').count();
            expect(rowsAfter).toBeGreaterThanOrEqual(3);

            await expect(draftPage.locator('table tbody')).toContainText('123456-EL-SPC-0001');
            await expect(draftPage.locator('table tbody')).toContainText('123456-EL-DRW-0002');

            const appFiles = await draftPage.evaluate(() => window.transmittalApp.data.files);
            expect(appFiles.length).toBe(2);

            await draftPage.close();
        } finally {
            fs.unlinkSync(tmp);
        }
    });
});
