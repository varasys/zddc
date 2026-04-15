/**
 * ZDDC — shared naming convention library
 *
 * Canonical implementation of all ZDDC filename, folder name, tracking number,
 * revision, and status logic.  Included in every tool's build via shared/zddc.js.
 *
 * Exposed as window.zddc (plain global) so it works with every tool's module
 * pattern (archive globals, classifier IIFE, transmittal IIFE, mdedit globals).
 *
 * Public API
 * ----------
 *   zddc.parseFilename(str)        → ParsedFile | null
 *   zddc.parseFolder(str)          → ParsedFolder | null
 *   zddc.parseRevision(str)        → ParsedRevision
 *   zddc.formatFilename(parts)     → string
 *   zddc.formatFolder(parts)       → string
 *   zddc.compareRevisions(a, b)    → number  (-1 | 0 | 1)
 *   zddc.isValidStatus(str)        → boolean
 *   zddc.STATUSES                  → string[]
 *
 * ParsedFile   { trackingNumber, revision, status, title, extension }
 * ParsedFolder { date, trackingNumber, status, title }
 * ParsedRevision { base, modifier, modifierType, modifierNumber, isDraft, full }
 */

(function (root) {
    'use strict';

    // ── Valid status codes ───────────────────────────────────────────────────

    /**
     * Complete list of valid ZDDC document status codes.
     * '---' denotes an unknown or not-yet-assigned status.
     */
    var STATUSES = [
        '---',
        'DFT',
        'IFA', 'IFB', 'IFC', 'IFD', 'IFI', 'IFP', 'IFR', 'IFU',
        'REC',
        'RSA', 'RSB', 'RSC', 'RSD', 'RSI',
    ];

    var STATUS_SET = {};
    for (var _i = 0; _i < STATUSES.length; _i++) {
        STATUS_SET[STATUSES[_i]] = true;
    }

    function isValidStatus(str) {
        return !!STATUS_SET[str];
    }

    // ── Filename parsing ─────────────────────────────────────────────────────

    /**
     * Canonical file regex.
     * Matches: TRACKING_REVISION (STATUS) - TITLE.EXT
     *
     * Tracking number: no underscores, no whitespace.
     * Revision:        no whitespace, no parentheses.
     * Status:          anything inside parentheses (validated separately).
     * Title:           everything up to the last dot.
     * Extension:       after the last dot (lowercased by parseFilename).
     */
    var FILE_RE = /^([^_\s]+)_([^\s()_]+)\s*\(([^)]+)\)\s*-\s*(\S.*\S|\S)\.\s*([^\s.]+)$/;

    /**
     * Parse a ZDDC filename.
     *
     * @param {string} filename
     * @returns {{ trackingNumber: string, revision: string, status: string,
     *             title: string, extension: string, valid: boolean } | null}
     *   null only if filename is falsy.
     *   `valid` is true when all fields matched the ZDDC pattern.
     */
    function parseFilename(filename) {
        if (!filename) { return null; }

        var match = filename.match(FILE_RE);

        if (!match) {
            var lastDot = filename.lastIndexOf('.');
            return {
                trackingNumber: '',
                revision:       '',
                status:         '',
                title:          lastDot > 0 ? filename.substring(0, lastDot) : filename,
                extension:      lastDot > 0 ? filename.substring(lastDot + 1).toLowerCase() : '',
                valid:          false,
            };
        }

        return {
            trackingNumber: match[1].trim(),
            revision:       match[2].trim(),
            status:         match[3].trim(),
            title:          match[4].trim(),
            extension:      match[5].toLowerCase(),
            valid:          true,
        };
    }

    // ── Folder name parsing ──────────────────────────────────────────────────

    /**
     * Transmittal folder regex.
     * Matches: YYYY-MM-DD_TRACKING (STATUS) - TITLE
     */
    var FOLDER_RE = /^(\d{4}-\d{2}-\d{2})_([^_\s(]+)\s*\(([^)]+)\)\s*-\s*(.+)$/;

    /**
     * Parse a ZDDC transmittal folder name.
     *
     * @param {string} foldername
     * @returns {{ date: string, trackingNumber: string, status: string,
     *             title: string, valid: boolean } | null}
     *   null only if foldername is falsy.
     */
    function parseFolder(foldername) {
        if (!foldername) { return null; }

        var match = foldername.match(FOLDER_RE);

        if (!match) {
            return {
                date:            '',
                trackingNumber:  '',
                status:          '',
                title:           foldername,
                valid:           false,
            };
        }

        return {
            date:           match[1],
            trackingNumber: match[2].trim(),
            status:         match[3].trim(),
            title:          match[4].trim(),
            valid:          true,
        };
    }

    // ── Revision parsing ─────────────────────────────────────────────────────

    /**
     * Modifier sub-regex: +LETTER DIGITS  e.g. +C1, +B2, +N1, +Q1
     * The draft prefix (~) may appear inside the modifier: A+~C1
     */
    var MODIFIER_RE = /^\+(~?)([A-Za-z])(\d+)$/;

    /**
     * Parse a ZDDC revision string.
     *
     * Revision grammar:
     *   revision     = ['~'] base ['+' ['~'] modifier_letter modifier_number]
     *   base         = letter(s) | digit(s) | date(YYYY-MM-DD)
     *   modifier     = letter + digits   e.g. C1, B2, N1, Q1
     *
     * @param {string} revision
     * @returns {{
     *   base: string,
     *   modifier: string,       full modifier string e.g. '+C1', '' if none
     *   modifierType: string,   modifier letter e.g. 'C', '' if none
     *   modifierNumber: number, modifier number e.g. 1, 0 if none
     *   modifierIsDraft: boolean,
     *   isDraft: boolean,       true if base revision starts with ~
     *   full: string,           original input
     * }}
     */
    function parseRevision(revision) {
        var raw = (revision || '').toString();

        // Split on '+' to separate base from optional modifier
        var plusIdx = raw.indexOf('+');
        var basePart     = plusIdx === -1 ? raw : raw.substring(0, plusIdx);
        var modifierPart = plusIdx === -1 ? ''  : raw.substring(plusIdx);

        // Draft flag on the base part
        var isDraft = basePart.startsWith('~');
        var base    = isDraft ? basePart.substring(1) : basePart;

        // Parse modifier
        var modifier        = '';
        var modifierType    = '';
        var modifierNumber  = 0;
        var modifierIsDraft = false;

        if (modifierPart) {
            var mMatch = modifierPart.match(MODIFIER_RE);
            if (mMatch) {
                modifierIsDraft = mMatch[1] === '~';
                modifierType    = mMatch[2].toUpperCase();
                modifierNumber  = parseInt(mMatch[3], 10);
                modifier        = modifierPart;
            } else {
                // Unrecognised modifier — preserve as-is
                modifier = modifierPart;
            }
        }

        return {
            base:           base,
            modifier:       modifier,
            modifierType:   modifierType,
            modifierNumber: modifierNumber,
            modifierIsDraft: modifierIsDraft,
            isDraft:        isDraft,
            full:           raw,
        };
    }

    // ── Revision comparison ──────────────────────────────────────────────────

    /**
     * Classify a base revision string into a sort tier:
     *   0 = date (YYYY-MM-DD)
     *   1 = letter(s)   A, B, AA …
     *   2 = number(s)   0, 1, 2, 1.5 …
     *   3 = other
     */
    function _baseTier(base) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(base)) { return 0; }
        if (/^[A-Za-z]+$/.test(base))          { return 1; }
        if (/^\d+(\.\d+)?$/.test(base))         { return 2; }
        return 3;
    }

    /**
     * Compare two base revision strings.
     * Sort order: dates < letters < numbers < other.
     */
    function _compareBase(a, b) {
        var ta = _baseTier(a);
        var tb = _baseTier(b);
        if (ta !== tb) { return ta - tb; }

        if (ta === 0) { return a < b ? -1 : a > b ? 1 : 0; }       // date lexicographic = chronological
        if (ta === 1) { return a.toUpperCase() < b.toUpperCase() ? -1 : a.toUpperCase() > b.toUpperCase() ? 1 : 0; }
        if (ta === 2) { return parseFloat(a) - parseFloat(b); }
        return a.localeCompare(b);
    }

    /**
     * Compare two ZDDC revision strings for sort ordering.
     *
     * Canonical order (ascending = older → newer):
     *   ~A  <  A  <  A+B1  <  A+C1  <  A+~C2  <  A+C2  <  A+N1  <  A+Q1
     *   <  ~B  <  B  < … < 0 < 1 < 2
     *
     * Rules:
     *   1. Compare base revisions first (dates < letters < numbers).
     *   2. For equal bases, draft (isDraft=true) comes before final.
     *   3. For equal base+draft, no-modifier < has-modifier.
     *   4. For equal base+draft+modifier presence:
     *      a. modifier draft comes before modifier final (modifierIsDraft).
     *      b. Sort modifier by type letter then by number.
     *
     * @param {string} a
     * @param {string} b
     * @returns {number}  negative if a < b, 0 if equal, positive if a > b
     */
    function compareRevisions(a, b) {
        var pa = parseRevision(a);
        var pb = parseRevision(b);

        // 1. Base revision
        var baseCmp = _compareBase(pa.base, pb.base);
        if (baseCmp !== 0) { return baseCmp; }

        // 2. Draft before final (for same base)
        if (pa.isDraft !== pb.isDraft) { return pa.isDraft ? -1 : 1; }

        // 3. No modifier before any modifier
        var aHasMod = pa.modifier !== '';
        var bHasMod = pb.modifier !== '';
        if (aHasMod !== bHasMod) { return aHasMod ? 1 : -1; }

        if (!aHasMod) { return 0; } // both have no modifier

        // 4. Compare modifiers: type → number → draft (draft is a tie-breaker only)
        // 4a. Modifier type letter (B < C < N < Q …)
        if (pa.modifierType !== pb.modifierType) {
            return pa.modifierType < pb.modifierType ? -1 : 1;
        }

        // 4b. Modifier number (1 < 2 …)
        if (pa.modifierNumber !== pb.modifierNumber) {
            return pa.modifierNumber - pb.modifierNumber;
        }

        // 4c. Draft of a modifier comes before the final modifier (same type+number)
        if (pa.modifierIsDraft !== pb.modifierIsDraft) {
            return pa.modifierIsDraft ? -1 : 1;
        }

        return 0;
    }

    // ── Filename / folder formatting ─────────────────────────────────────────

    /**
     * Build a ZDDC filename from its components.
     *
     * @param {{ trackingNumber: string, revision: string, status: string,
     *           title: string, extension: string }} parts
     * @returns {string}  e.g. "123456-EL-SPC-2623_A (IFR) - Specification.pdf"
     */
    function formatFilename(parts) {
        var tn  = (parts.trackingNumber || '').trim();
        var rev = (parts.revision       || '').trim();
        var st  = (parts.status         || '').trim();
        var ttl = (parts.title          || '').trim();
        var ext = (parts.extension      || '').replace(/^\./, '');

        if (!tn || !rev || !st || !ttl) { return ''; }

        var name = tn + '_' + rev + ' (' + st + ') - ' + ttl;
        return ext ? name + '.' + ext : name;
    }

    /**
     * Build a ZDDC transmittal folder name from its components.
     *
     * @param {{ date: string, trackingNumber: string, status: string,
     *           title: string }} parts
     * @returns {string}  e.g. "2025-10-31_123456-EM-SUB-0001 (IFR) - Title"
     */
    function formatFolder(parts) {
        var dt  = (parts.date           || '').trim();
        var tn  = (parts.trackingNumber || '').trim();
        var st  = (parts.status         || '').trim();
        var ttl = (parts.title          || '').trim();

        if (!dt || !tn || !st || !ttl) { return ''; }

        return dt + '_' + tn + ' (' + st + ') - ' + ttl;
    }

    // ── Public API ───────────────────────────────────────────────────────────

    root.zddc = {
        STATUSES:         STATUSES,
        isValidStatus:    isValidStatus,
        parseFilename:    parseFilename,
        parseFolder:      parseFolder,
        parseRevision:    parseRevision,
        formatFilename:   formatFilename,
        formatFolder:     formatFolder,
        compareRevisions: compareRevisions,
    };

}(typeof window !== 'undefined' ? window : this));
