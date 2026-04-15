// ZDDC filename parser — delegates to shared window.zddc library

// Parse ZDDC filename
// Returns { trackingNumber, revision, status, title, extension }
function parseFileName(filename) {
    const r = zddc.parseFilename(filename);
    if (!r) {
        return { trackingNumber: '', revision: '', status: '', title: '', extension: '' };
    }
    return {
        trackingNumber: r.trackingNumber,
        revision:       r.revision,
        status:         r.status,
        title:          r.title,
        extension:      r.extension,
    };
}

// Parse revision to extract base and modifier
// Returns { base, modifier, isDraft, full }
function parseRevision(revision) {
    const r = zddc.parseRevision(revision);
    return {
        base:     r.base,
        modifier: r.modifier,
        isDraft:  r.isDraft,
        full:     r.full,
    };
}

// Compare revisions for sorting
function compareRevisions(a, b) {
    return zddc.compareRevisions(a, b);
}

// Check if folder name matches transmittal naming convention
// Format: YYYY-MM-DD_TRACKINGNUMBER (STATUS) - TITLE
function isTransmittalFolder(name) {
    const pattern = /^\d{4}-\d{2}-\d{2}_[^_\s]+\s*\([^)]+\)\s*-\s*.+$/;
    return pattern.test(name);
}

// Group files by tracking number (archive-specific, not in shared library)
function groupFilesByTrackingNumber(files) {
    const groups = {};

    files.forEach(file => {
        if (!file.trackingNumber) return;

        if (!groups[file.trackingNumber]) {
            groups[file.trackingNumber] = {
                trackingNumber: file.trackingNumber,
                title: file.title,
                revisions: {}
            };
        }

        if (file.title.length > groups[file.trackingNumber].title.length) {
            groups[file.trackingNumber].title = file.title;
        }

        const revKey = `${file.revision}_${file.status}`;
        if (!groups[file.trackingNumber].revisions[revKey]) {
            groups[file.trackingNumber].revisions[revKey] = {
                revision: file.revision,
                status: file.status,
                title: file.title,
                hasModifier: file.revision.includes('+'),
                files: []
            };
        }

        if (file.title.length > groups[file.trackingNumber].revisions[revKey].title.length) {
            groups[file.trackingNumber].revisions[revKey].title = file.title;
        }

        groups[file.trackingNumber].revisions[revKey].files.push(file);
    });

    return groups;
}

// Sort grouped files based on APP_STATE.sortField and APP_STATE.sortDirection
function sortGroupedFiles(groups) {
    const field = APP_STATE.sortField || 'trackingNumber';
    const direction = APP_STATE.sortDirection === 'desc' ? -1 : 1;

    const sorted = Object.values(groups).sort((a, b) => {
        let comparison = 0;

        if (field === 'trackingNumber') {
            comparison = a.trackingNumber.localeCompare(b.trackingNumber);
        } else if (field === 'title') {
            comparison = a.title.localeCompare(b.title);
        } else if (field === 'revisions') {
            const aRevs = Object.keys(a.revisions);
            const bRevs = Object.keys(b.revisions);
            const aLatest = aRevs.length > 0 ? aRevs[aRevs.length - 1] : '';
            const bLatest = bRevs.length > 0 ? bRevs[bRevs.length - 1] : '';
            comparison = zddc.compareRevisions(aLatest, bLatest);
        }

        return comparison * direction;
    });

    sorted.forEach(group => {
        const revisions = Object.values(group.revisions);
        revisions.sort((a, b) => zddc.compareRevisions(b.revision, a.revision));
        group.sortedRevisions = revisions;
    });

    return sorted;
}
