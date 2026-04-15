(function (app) {
    'use strict';

    const dom = app.dom;

    const visibility = app.modules.visibility = {};

    // Field visibility rules based on document type
    const FIELD_RULES = {
        'from': ['Transmittal', 'Submittal'],
        'to': ['Transmittal', 'Submittal']
    };

    function getDocumentType() {
        const typeInput = dom.qs('#type');
        return typeInput ? (typeInput.value || 'Transmittal').trim() : 'Transmittal';
    }

    function isFieldVisible(fieldId, docType) {
        const rules = FIELD_RULES[fieldId];
        if (!rules) {
            return true; // No rules = always visible
        }
        return rules.includes(docType);
    }

    function getFieldContainer(fieldId) {
        const input = dom.qs('#' + fieldId);
        if (!input) {
            return null;
        }
        // Find the parent container (the div with col-span-6 or col-span-12)
        let container = input.parentElement;
        while (container && !container.className.includes('col-span-')) {
            container = container.parentElement;
            if (!container || container.tagName === 'FORM') {
                break;
            }
        }
        return container || input.parentElement;
    }

    visibility.applyFieldVisibility = function applyFieldVisibility() {
        const docType = getDocumentType();
        Object.keys(FIELD_RULES).forEach(function(fieldId) {
            const container = getFieldContainer(fieldId);
            if (!container) { return; }
            container.hidden = !isFieldVisible(fieldId, docType);
        });
    };

    visibility.bindTypeInput = function bindTypeInput() {
        const typeInput = dom.qs('#type');
        if (!typeInput) {
            return;
        }

        // Apply visibility on input change
        typeInput.addEventListener('input', function() {
            visibility.applyFieldVisibility();
            if (app.markDirty) {
                app.markDirty();
            }
        });

        typeInput.addEventListener('change', function() {
            visibility.applyFieldVisibility();
        });
    };

    app.registerInit(function () {
        visibility.bindTypeInput();
        visibility.applyFieldVisibility();
    });
})(window.transmittalApp);
