import { test, expect } from '@playwright/test';
import * as path from 'path';

const HTML_PATH = path.resolve('classifier/dist/classifier.html');

test.describe('Classifier', () => {

    test('loads without errors', async ({ page }) => {
        await page.goto(`file://${HTML_PATH}`, { waitUntil: 'domcontentloaded' });

        // Wait for app initialisation
        await page.waitForFunction(() => typeof window.app !== 'undefined' && window.app.modules, { timeout: 15000 });

        // Core modules should be registered
        const moduleNames = await page.evaluate(() => Object.keys(window.app.modules));
        expect(moduleNames).toContain('store');
        expect(moduleNames).toContain('spreadsheet');
        expect(moduleNames).toContain('validator');
    });

    test('files injected into store are parsed and produce valid computed filenames', async ({ page }) => {
        await page.goto(`file://${HTML_PATH}`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof window.app !== 'undefined' && window.app.modules?.store, { timeout: 15000 });

        // Inject files via the store API. The main app panel stays hidden until a real
        // directory is opened via showDirectoryPicker, so we verify through the store
        // and spreadsheet module APIs rather than the DOM table.
        const result = await page.evaluate(() => {
            // File objects must match the shape the scanner produces:
            // `tracking` (not trackingNumber), `originalFilename`, `extension` (with dot)
            const files = [
                { tracking: '123456-EL-SPC-2623', title: 'Specification For Switchgear',
                  revision: 'A', status: 'IFC', extension: '.pdf',
                  originalFilename: '123456-EL-SPC-2623_A (IFC) - Specification For Switchgear',
                  name: '123456-EL-SPC-2623_A (IFC) - Specification For Switchgear.pdf',
                  path: 'test-project/123456-EL-SPC-2623_A (IFC) - Specification For Switchgear.pdf',
                  size: 45000, isDirectory: false },
                { tracking: '123456-EL-DRW-0001', title: 'Electrical Arrangement',
                  revision: 'B', status: 'IFR', extension: '.dwg',
                  originalFilename: '123456-EL-DRW-0001_B (IFR) - Electrical Arrangement',
                  name: '123456-EL-DRW-0001_B (IFR) - Electrical Arrangement.dwg',
                  path: 'test-project/123456-EL-DRW-0001_B (IFR) - Electrical Arrangement.dwg',
                  size: 120000, isDirectory: false },
            ];
            const tree = [{ path: 'test-project', name: 'test-project', files, children: [] }];
            window.app.modules.store.setFolderTree(tree);
            window.app.modules.store.setSelectedFolders(['test-project']);

            const displayFiles = window.app.modules.store.getDisplayFiles();
            const computed = displayFiles.map(f =>
                window.app.modules.spreadsheet.computeNewFilename(f, 0) || ''
            );
            return { count: displayFiles.length, computed };
        });

        // Both files should be in the store
        expect(result.count).toBe(2);

        // Each computed filename should contain its tracking number
        // (sort order may vary, so check both filenames contain a tracking number)
        const allFilenames = result.computed.join('\n');
        expect(allFilenames).toContain('123456-EL-SPC-2623');
        expect(allFilenames).toContain('123456-EL-DRW-0001');
    });
});
