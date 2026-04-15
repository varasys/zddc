/**
 * Classifier utilities — delegates ZDDC naming to shared window.zddc library
 */
(function() {
    'use strict';

    /**
     * Compute new filename from file fields.
     * ZDDC format: trackingNumber_revision (status) - title.ext
     */
    function computeNewFilename(file) {
        if (file.manualFilename) {
            return file.manualFilename;
        }

        const formatted = zddc.formatFilename({
            trackingNumber: file.tracking || '',
            revision:       file.revision || '',
            status:         file.status   || '',
            title:          file.title    || '',
            extension:      file.extension || '',
        });

        // Fall back to original filename if any required field is missing
        return formatted || (file.originalFilename + (file.extension || ''));
    }

    /**
     * Get column value from file object
     */
    function getColumnValue(file, columnName) {
        switch (columnName) {
            case 'original':    return file.originalFilename || '';
            case 'extension':   return file.extension || '';
            case 'new':
            case 'newFilename': return file.manualFilename || computeNewFilename(file);
            case 'tracking':    return file.tracking || '';
            case 'revision':    return file.revision || '';
            case 'status':      return file.status || '';
            case 'title':       return file.title || '';
            case 'sha256':      return file.sha256 || '';
            default:            return '';
        }
    }

    /**
     * Parse filename to extract ZDDC components.
     * Returns { tracking, revision, status, title, extension }
     * Note: classifier uses `tracking` not `trackingNumber`.
     */
    function parseFilename(filename) {
        const r = zddc.parseFilename(filename);
        if (!r) {
            return { tracking: '', revision: '', status: '', title: '', extension: '' };
        }
        return {
            tracking:  r.trackingNumber,   // classifier calls it 'tracking'
            revision:  r.revision,
            status:    r.status,
            title:     r.title,
            extension: r.extension ? '.' + r.extension : '',  // classifier stores with leading dot
        };
    }

    window.app.modules.utils = {
        computeNewFilename,
        getColumnValue,
        parseFilename,
    };
})();
