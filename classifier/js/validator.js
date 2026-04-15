/**
 * ZDDC Validation Module
 * Validates file names against ZDDC conventions using the shared zddc library.
 */

(function() {
    'use strict';

    /**
     * Validate a filename and return a detailed result.
     * Delegates ZDDC pattern checking to the shared zddc.parseFilename() library.
     */
    function validateFilename(filename) {
        const errors = [];
        const warnings = [];

        if (!filename) {
            errors.push('Filename is empty.');
            return { isValid: false, warnings, errors };
        }

        const parsed = zddc.parseFilename(filename);
        if (!parsed || !parsed.valid) {
            errors.push('Filename does not match ZDDC format: trackingNumber_revision (status) - title.ext');
        } else if (!zddc.isValidStatus(parsed.status)) {
            errors.push('Invalid status code "' + parsed.status + '". Valid codes: ' + zddc.STATUSES.join(', '));
        }

        if (filename.length > 255) {
            warnings.push('Filename is very long (>255 characters)');
        }

        const invalidChars = /[<>:"|?*]/;
        if (invalidChars.test(filename)) {
            errors.push('Filename contains invalid characters: < > : " | ? *');
        }

        return {
            isValid: errors.length === 0,
            warnings,
            errors
        };
    }

    window.app.modules.validator = {
        validateFilename
    };
})();
