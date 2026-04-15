(function (app) {
    'use strict';

    const filters = app.modules.filters = {};
    const dom = app.dom;

    filters.fieldString = function fieldString(file, field) {
        let value = '';
        switch (field) {
            case 'trackingNumber': value = file.trackingNumber || ''; break;
            case 'title': value = file.title || ''; break;
            case 'revision': value = file.revision || ''; break;
            case 'status': value = file.status || ''; break;
            case 'extension': value = file.extension || ''; break;
            case 'sha256': value = file.sha256 || ''; break;
            default: value = '';
        }
        return String(value).toLowerCase();
    };

    filters.getActiveFilters = function getActiveFilters() {
        const active = {};
        const inputs = document.querySelectorAll('thead input[data-filter-field]');
        inputs.forEach(function (input) {
            const field = input.getAttribute('data-filter-field');
            const query = (input.value || '').trim();
            if (!query) return;
            active[field] = window.ZDDCFilter.parse(query);
        });
        return active;
    };

    filters.fileMatchesFilters = function fileMatchesFilters(file, activeFilters) {
        const fields = Object.keys(activeFilters);
        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];
            const ast = activeFilters[field];
            const value = filters.fieldString(file, field);
            if (!window.ZDDCFilter.matches(value, ast)) {
                return false;
            }
        }
        return true;
    };

    filters.refreshPlaceholders = function refreshPlaceholders() {
        const inputs = document.querySelectorAll('thead input[data-filter-field]');
        inputs.forEach(function (input) {
            const empty = !(input.value || '').trim().length;
            input.toggleAttribute('data-empty', empty);
        });
    };

    filters.bindFilters = function bindFilters() {
        const head = document.querySelector('thead');
        if (!head) return;

        head.addEventListener('input', function (event) {
            const target = event.target;
            if (target && target.getAttribute && target.getAttribute('data-filter-field')) {
                filters.refreshPlaceholders();
                if (app.modules.files && typeof app.modules.files.render === 'function') {
                    app.modules.files.render();
                }
            }
        });

        head.addEventListener('keydown', function (event) {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            if (!target.getAttribute || !target.getAttribute('data-filter-field')) return;
            if (event.key === 'Escape') {
                target.value = '';
                filters.refreshPlaceholders();
                if (app.modules.files && typeof app.modules.files.render === 'function') {
                    app.modules.files.render();
                }
                event.preventDefault();
            } else if (event.key === 'Enter') {
                event.preventDefault();
                const inputs = Array.from(head.querySelectorAll('input[data-filter-field]'));
                const index = inputs.indexOf(target);
                if (index !== -1) {
                    const next = inputs[(index + 1) % inputs.length];
                    if (next && typeof next.focus === 'function') next.focus();
                }
            }
        });

        filters.refreshPlaceholders();
    };

    app.registerInit(function () {
        filters.bindFilters();
    });
})(window.transmittalApp);
