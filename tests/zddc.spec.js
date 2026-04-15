/**
 * Tests for shared/zddc.js — canonical ZDDC naming library.
 *
 * Runs against the compiled dist/zddc-test.html shim (a minimal HTML page
 * that loads shared/zddc.js and exposes window.zddc to the test harness).
 *
 * Fixtures from tests/fixtures/zddc-filenames.js define the canonical
 * expected behaviour for all tools.
 */

import { test, expect } from '@playwright/test';
import { VALID_FILES, INVALID_FILES, VALID_FOLDERS, REVISION_SORT_ORDER }
    from './fixtures/zddc-filenames.js';
import * as path from 'path';

const SHIM_PATH = 'file://' + path.resolve('shared/zddc-test.html');

// ── helpers ──────────────────────────────────────────────────────────────────

async function zddc(page, fn, ...args) {
    return page.evaluate(
        ([fn, args]) => window.zddc[fn](...args),
        [fn, args]
    );
}

// ── setup ─────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
    await page.goto(SHIM_PATH, { waitUntil: 'load' });
    // Confirm the library loaded
    const ok = await page.evaluate(() => typeof window.zddc === 'object');
    expect(ok).toBe(true);
});

// ── parseFilename — valid files ───────────────────────────────────────────────

for (const fixture of VALID_FILES) {
    test(`parseFilename: ${fixture.filename}`, async ({ page }) => {
        const result = await zddc(page, 'parseFilename', fixture.filename);
        expect(result).not.toBeNull();
        expect(result.valid).toBe(true);
        expect(result.trackingNumber).toBe(fixture.parsed.trackingNumber);
        expect(result.revision).toBe(fixture.parsed.revision);
        expect(result.status).toBe(fixture.parsed.status);
        expect(result.title).toBe(fixture.parsed.title);
        expect(result.extension).toBe(fixture.parsed.extension);
    });
}

// ── parseFilename — invalid files ─────────────────────────────────────────────

for (const fixture of INVALID_FILES) {
    test(`parseFilename invalid: ${fixture.filename}`, async ({ page }) => {
        const result = await zddc(page, 'parseFilename', fixture.filename);
        expect(result).not.toBeNull();
        expect(result.valid).toBe(false);
        // Should never throw — returns degraded object
        expect(typeof result.trackingNumber).toBe('string');
        expect(typeof result.extension).toBe('string');
    });
}

// ── parseFilename — edge cases ────────────────────────────────────────────────

test('parseFilename: null returns null', async ({ page }) => {
    const result = await zddc(page, 'parseFilename', null);
    expect(result).toBeNull();
});

test('parseFilename: empty string returns null', async ({ page }) => {
    const result = await zddc(page, 'parseFilename', '');
    expect(result).toBeNull();
});

test('parseFilename: no extension', async ({ page }) => {
    const result = await zddc(page, 'parseFilename', 'just-a-name');
    expect(result.valid).toBe(false);
    expect(result.extension).toBe('');
});

// ── parseFolder — valid folders ───────────────────────────────────────────────

for (const fixture of VALID_FOLDERS) {
    test(`parseFolder: ${fixture.foldername}`, async ({ page }) => {
        const result = await zddc(page, 'parseFolder', fixture.foldername);
        expect(result).not.toBeNull();
        expect(result.valid).toBe(true);
        expect(result.date).toBe(fixture.parsed.date);
        expect(result.trackingNumber).toBe(fixture.parsed.trackingNumber);
        expect(result.status).toBe(fixture.parsed.status);
        expect(result.title).toBe(fixture.parsed.title);
    });
}

test('parseFolder: null returns null', async ({ page }) => {
    const result = await zddc(page, 'parseFolder', null);
    expect(result).toBeNull();
});

test('parseFolder: non-ZDDC name returns valid=false', async ({ page }) => {
    const result = await zddc(page, 'parseFolder', 'random folder name');
    expect(result.valid).toBe(false);
    expect(result.title).toBe('random folder name');
});

// ── formatFilename ────────────────────────────────────────────────────────────

test('formatFilename: round-trips all valid files', async ({ page }) => {
    for (const fixture of VALID_FILES) {
        const ext = fixture.parsed.extension;
        const formatted = await zddc(page, 'formatFilename', {
            trackingNumber: fixture.parsed.trackingNumber,
            revision:       fixture.parsed.revision,
            status:         fixture.parsed.status,
            title:          fixture.parsed.title,
            extension:      ext,
        });
        expect(formatted).toBe(fixture.filename);
    }
});

test('formatFilename: empty required field returns empty string', async ({ page }) => {
    expect(await zddc(page, 'formatFilename', { trackingNumber: '', revision: 'A', status: 'IFR', title: 'T', extension: 'pdf' })).toBe('');
    expect(await zddc(page, 'formatFilename', { trackingNumber: '123', revision: '',  status: 'IFR', title: 'T', extension: 'pdf' })).toBe('');
    expect(await zddc(page, 'formatFilename', { trackingNumber: '123', revision: 'A', status: '',    title: 'T', extension: 'pdf' })).toBe('');
    expect(await zddc(page, 'formatFilename', { trackingNumber: '123', revision: 'A', status: 'IFR', title: '',  extension: 'pdf' })).toBe('');
});

test('formatFilename: extension with leading dot is handled', async ({ page }) => {
    const result = await zddc(page, 'formatFilename', {
        trackingNumber: '123-EL-SPC-0001', revision: 'A', status: 'IFR',
        title: 'Test Title', extension: '.pdf',
    });
    expect(result).toBe('123-EL-SPC-0001_A (IFR) - Test Title.pdf');
});

// ── formatFolder ──────────────────────────────────────────────────────────────

test('formatFolder: round-trips all valid folders', async ({ page }) => {
    for (const fixture of VALID_FOLDERS) {
        const formatted = await zddc(page, 'formatFolder', fixture.parsed);
        expect(formatted).toBe(fixture.foldername);
    }
});

test('formatFolder: empty required field returns empty string', async ({ page }) => {
    expect(await zddc(page, 'formatFolder', { date: '', trackingNumber: '123', status: 'IFR', title: 'T' })).toBe('');
    expect(await zddc(page, 'formatFolder', { date: '2025-01-01', trackingNumber: '',  status: 'IFR', title: 'T' })).toBe('');
    expect(await zddc(page, 'formatFolder', { date: '2025-01-01', trackingNumber: '123', status: '', title: 'T' })).toBe('');
    expect(await zddc(page, 'formatFolder', { date: '2025-01-01', trackingNumber: '123', status: 'IFR', title: '' })).toBe('');
});

// ── parseRevision ─────────────────────────────────────────────────────────────

test('parseRevision: plain letter revision', async ({ page }) => {
    const r = await zddc(page, 'parseRevision', 'A');
    expect(r.base).toBe('A');
    expect(r.isDraft).toBe(false);
    expect(r.modifier).toBe('');
    expect(r.modifierType).toBe('');
    expect(r.modifierNumber).toBe(0);
    expect(r.full).toBe('A');
});

test('parseRevision: draft revision ~A', async ({ page }) => {
    const r = await zddc(page, 'parseRevision', '~A');
    expect(r.base).toBe('A');
    expect(r.isDraft).toBe(true);
    expect(r.modifier).toBe('');
});

test('parseRevision: revision with modifier A+C1', async ({ page }) => {
    const r = await zddc(page, 'parseRevision', 'A+C1');
    expect(r.base).toBe('A');
    expect(r.isDraft).toBe(false);
    expect(r.modifier).toBe('+C1');
    expect(r.modifierType).toBe('C');
    expect(r.modifierNumber).toBe(1);
    expect(r.modifierIsDraft).toBe(false);
});

test('parseRevision: draft modifier A+~C1', async ({ page }) => {
    const r = await zddc(page, 'parseRevision', 'A+~C1');
    expect(r.base).toBe('A');
    expect(r.isDraft).toBe(false);
    expect(r.modifier).toBe('+~C1');
    expect(r.modifierType).toBe('C');
    expect(r.modifierNumber).toBe(1);
    expect(r.modifierIsDraft).toBe(true);
});

test('parseRevision: numeric base 0', async ({ page }) => {
    const r = await zddc(page, 'parseRevision', '0');
    expect(r.base).toBe('0');
    expect(r.isDraft).toBe(false);
    expect(r.modifier).toBe('');
});

test('parseRevision: all modifier types', async ({ page }) => {
    const cases = [
        ['A+B1', 'B', 1],
        ['A+C2', 'C', 2],
        ['A+N1', 'N', 1],
        ['A+Q1', 'Q', 1],
    ];
    for (const [rev, type, num] of cases) {
        const r = await zddc(page, 'parseRevision', rev);
        expect(r.modifierType).toBe(type);
        expect(r.modifierNumber).toBe(num);
    }
});

// ── compareRevisions — canonical REVISION_SORT_ORDER ─────────────────────────

test('compareRevisions: canonical sort order matches fixture', async ({ page }) => {
    // For every adjacent pair in the expected order, a < b
    for (let i = 0; i < REVISION_SORT_ORDER.length - 1; i++) {
        const a = REVISION_SORT_ORDER[i];
        const b = REVISION_SORT_ORDER[i + 1];
        const cmp = await zddc(page, 'compareRevisions', a, b);
        expect(cmp).toBeLessThan(0);
    }
});

test('compareRevisions: equal revisions return 0', async ({ page }) => {
    for (const rev of REVISION_SORT_ORDER) {
        const cmp = await zddc(page, 'compareRevisions', rev, rev);
        expect(cmp).toBe(0);
    }
});

test('compareRevisions: reverse order is > 0', async ({ page }) => {
    for (let i = 0; i < REVISION_SORT_ORDER.length - 1; i++) {
        const a = REVISION_SORT_ORDER[i];
        const b = REVISION_SORT_ORDER[i + 1];
        const cmp = await zddc(page, 'compareRevisions', b, a);
        expect(cmp).toBeGreaterThan(0);
    }
});

test('compareRevisions: sort() produces canonical order', async ({ page }) => {
    // Shuffle the order and sort with zddc.compareRevisions, expect canonical result
    const shuffled = [...REVISION_SORT_ORDER].reverse();
    const sorted = await page.evaluate((revisions) => {
        return revisions.slice().sort((a, b) => window.zddc.compareRevisions(a, b));
    }, shuffled);
    expect(sorted).toEqual(REVISION_SORT_ORDER);
});

// ── isValidStatus ─────────────────────────────────────────────────────────────

test('isValidStatus: accepts all known statuses', async ({ page }) => {
    const statuses = await page.evaluate(() => window.zddc.STATUSES);
    for (const s of statuses) {
        const ok = await zddc(page, 'isValidStatus', s);
        expect(ok).toBe(true);
    }
});

test('isValidStatus: rejects unknown codes', async ({ page }) => {
    const bad = ['IFX', 'ABC', '', 'ifr', 'rsa'];
    for (const s of bad) {
        const ok = await zddc(page, 'isValidStatus', s);
        expect(ok).toBe(false);
    }
});

test('isValidStatus: --- is valid (unknown status)', async ({ page }) => {
    const ok = await zddc(page, 'isValidStatus', '---');
    expect(ok).toBe(true);
});
