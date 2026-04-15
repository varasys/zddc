/**
 * Tests for shared/zddc-filter.js — standardised filter expression engine.
 *
 * Runs against shared/zddc-filter-test.html which loads the parser as a
 * standalone script and exposes window.ZDDCFilter.
 */

import { test, expect } from '@playwright/test';
import * as path from 'path';

const SHIM_PATH = 'file://' + path.resolve('shared/zddc-filter-test.html');

// Helper: parse then matches
async function fm(page, expr, value) {
    return page.evaluate(
        ([expr, value]) => {
            const ast = window.ZDDCFilter.parse(expr);
            return window.ZDDCFilter.matches(value, ast);
        },
        [expr, value]
    );
}

test.beforeEach(async ({ page }) => {
    await page.goto(SHIM_PATH, { waitUntil: 'load' });
    const ok = await page.evaluate(() => typeof window.ZDDCFilter === 'object');
    expect(ok).toBe(true);
});

// ── empty / wildcard-all ──────────────────────────────────────────────────────

test('empty string matches everything', async ({ page }) => {
    expect(await fm(page, '', 'anything')).toBe(true);
    expect(await fm(page, '', '')).toBe(true);
});

test('whitespace-only matches everything', async ({ page }) => {
    expect(await fm(page, '   ', 'anything')).toBe(true);
});

test('bare * matches everything', async ({ page }) => {
    expect(await fm(page, '*', 'hello world')).toBe(true);
    expect(await fm(page, '*', '')).toBe(true);
});

// ── plain term (substring, case-insensitive) ──────────────────────────────────

test('plain term: case-insensitive substring match', async ({ page }) => {
    expect(await fm(page, 'IFA', 'status IFA rev')).toBe(true);
    expect(await fm(page, 'ifa', 'status IFA rev')).toBe(true);
    expect(await fm(page, 'IFA', 'status IFB rev')).toBe(false);
});

test('plain term: substring anywhere in value', async ({ page }) => {
    expect(await fm(page, 'el', '123456-el-spc-2623')).toBe(true);
    expect(await fm(page, 'spc', '123456-el-spc-2623')).toBe(true);
});

// ── ! negation ────────────────────────────────────────────────────────────────

test('!term: excludes values containing term', async ({ page }) => {
    expect(await fm(page, '!draft', 'final document')).toBe(true);
    expect(await fm(page, '!draft', 'draft document')).toBe(false);
});

// ── ^ prefix anchor ───────────────────────────────────────────────────────────

test('^term: only matches at start', async ({ page }) => {
    expect(await fm(page, '^IFA', 'IFA document')).toBe(true);
    expect(await fm(page, '^IFA', 'revision IFA')).toBe(false);
});

// ── $ suffix anchor ───────────────────────────────────────────────────────────

test('term$: only matches at end', async ({ page }) => {
    expect(await fm(page, 'pdf$', 'document.pdf')).toBe(true);
    expect(await fm(page, 'pdf$', 'document.docx')).toBe(false);
});

// ── !^ not-prefix ─────────────────────────────────────────────────────────────

test('!^term: excludes values starting with term', async ({ page }) => {
    expect(await fm(page, '!^~', 'A (IFA) title')).toBe(true);
    expect(await fm(page, '!^~', '~A (DFT) title')).toBe(false);
});

// ── !$ not-suffix ─────────────────────────────────────────────────────────────

test('!term$: excludes values ending with term', async ({ page }) => {
    expect(await fm(page, '!pdf$', 'document.docx')).toBe(true);
    expect(await fm(page, '!pdf$', 'document.pdf')).toBe(false);
});

// ── AND (space-separated) ─────────────────────────────────────────────────────

test('a b: both must match (AND)', async ({ page }) => {
    expect(await fm(page, 'pdf spc', 'spc document.pdf')).toBe(true);
    expect(await fm(page, 'pdf spc', 'spc document.docx')).toBe(false);
    expect(await fm(page, 'pdf spc', 'other document.pdf')).toBe(false);
});

// ── OR ────────────────────────────────────────────────────────────────────────

test('a | b: either matches (OR)', async ({ page }) => {
    expect(await fm(page, 'IFA | IFB', 'status IFA')).toBe(true);
    expect(await fm(page, 'IFA | IFB', 'status IFB')).toBe(true);
    expect(await fm(page, 'IFA | IFB', 'status IFC')).toBe(false);
});

test('(a | b): grouped OR', async ({ page }) => {
    expect(await fm(page, '(IFA | IFB)', 'status IFA')).toBe(true);
    expect(await fm(page, '(IFA | IFB)', 'status IFB')).toBe(true);
    expect(await fm(page, '(IFA | IFB)', 'status IFC')).toBe(false);
});

test('^IFA | ^IFB: prefix OR', async ({ page }) => {
    expect(await fm(page, '^IFA | ^IFB', 'IFA document')).toBe(true);
    expect(await fm(page, '^IFA | ^IFB', 'IFB document')).toBe(true);
    expect(await fm(page, '^IFA | ^IFB', 'IFC document')).toBe(false);
});

// ── regex patterns (the new capability replacing glob) ────────────────────────

test('regex: .* spans characters within a term', async ({ page }) => {
    // el.*spc matches "123456-el-spc-2623" because it's a substring regex
    expect(await fm(page, 'el.*spc', '123456-el-spc-2623')).toBe(true);
    expect(await fm(page, 'el.*spc', '123456-me-spc-2623')).toBe(false);
});

test('regex: ^el.*spc anchored to start', async ({ page }) => {
    expect(await fm(page, '^el.*spc', 'el-spc-2623')).toBe(true);
    expect(await fm(page, '^el.*spc', '123456-el-spc-2623')).toBe(false);
});

test('regex: character class [ei]fa', async ({ page }) => {
    expect(await fm(page, '[ei]fa', 'status efa')).toBe(true);
    expect(await fm(page, '[ei]fa', 'status ifa')).toBe(true);
    expect(await fm(page, '[ei]fa', 'status ofa')).toBe(false);
});

test('regex: invalid regex falls back to literal match', async ({ page }) => {
    // "[unclosed" is invalid regex — should fall back and treat as literal
    // It won't crash, just won't match normally
    const result = await page.evaluate(() => {
        try {
            const ast = window.ZDDCFilter.parse('[unclosed');
            window.ZDDCFilter.matches('test', ast);
            return 'no-crash';
        } catch (e) {
            return 'crashed: ' + e.message;
        }
    });
    expect(result).toBe('no-crash');
});

// ── regression: hyphen in tracking number is literal ─────────────────────────

test('hyphen in tracking number is literal (not an operator)', async ({ page }) => {
    expect(await fm(page, '123456-EL-SPC', '123456-EL-SPC-2623')).toBe(true);
    expect(await fm(page, '123456-EL-SPC', '654321-EL-SPC-9999')).toBe(false);
});

// ── AND + NOT combined ────────────────────────────────────────────────────────

test('pdf !draft: AND with exclusion', async ({ page }) => {
    expect(await fm(page, 'pdf !draft', 'final.pdf')).toBe(true);
    expect(await fm(page, 'pdf !draft', 'draft.pdf')).toBe(false);
    expect(await fm(page, 'pdf !draft', 'final.docx')).toBe(false);
});

// ── complex real-world expressions ───────────────────────────────────────────

test('!^~ !^[0-9]: excludes drafts and numeric revisions', async ({ page }) => {
    expect(await fm(page, '!^~ !^[0-9]', 'A (IFA) title')).toBe(true);
    expect(await fm(page, '!^~ !^[0-9]', '~A (DFT) title')).toBe(false);
    expect(await fm(page, '!^~ !^[0-9]', '0 (IFC) title')).toBe(false);
});
