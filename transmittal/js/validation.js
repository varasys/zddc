(function (app) {
    'use strict';

    const dom = app.dom;

    const validation = app.modules.validation = {};

    validation.bindTrackingNumberValidation = function bindTrackingNumberValidation() {
        const input = dom.qs('#tracking-number');
        if (!input) {
            return;
        }
        function isInvalid(value) {
            return /\s/.test(value) || /_/.test(value);
        }
        function apply() {
            const value = input.value || '';
            const bad = isInvalid(value);
            input.setAttribute('aria-invalid', bad ? 'true' : 'false');
            if (bad) {
                input.classList.add('ring-1', 'ring-red-400', 'border-red-500');
            } else {
                input.classList.remove('ring-1', 'ring-red-400', 'border-red-500');
            }
        }
        input.addEventListener('input', apply);
        input.addEventListener('blur', apply);
        apply();
    };

    validation.validateBeforePublish = function validateBeforePublish() {
        const errors = [];
        let focusEl = null;
        const trackingInput = dom.qs('#tracking-number');
        if (trackingInput) {
            const value = trackingInput.value || '';
            if (/\s/.test(value) || /_/.test(value)) {
                errors.push('Tracking Number must not contain spaces or underscores.');
                if (!focusEl) {
                    focusEl = trackingInput;
                }
            }
        }
        (app.data.files || []).forEach(function (file, index) {
            if (file.trackingNumber && (/\s/.test(file.trackingNumber) || /_/.test(file.trackingNumber))) {
                errors.push('Row ' + (index + 1) + ': File tracking number must not contain spaces or underscores.');
            }
            if (file.revision && /\s/.test(file.revision)) {
                errors.push('Row ' + (index + 1) + ': Revision must not contain spaces.');
            }
        });
        return {
            ok: errors.length === 0,
            focusEl: focusEl,
            message: errors.join('\n')
        };
    };

    app.registerInit(function () {
        validation.bindTrackingNumberValidation();
    });
})(window.transmittalApp);
