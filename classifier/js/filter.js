/**
 * Filter Module
 * Column filter UI: initialises static inputs in thead, wires events.
 */
(function() {
    'use strict';

    /**
     * Initialize filtering — wire delegated events on thead.
     * Filter inputs already exist in the static template; no dynamic injection needed.
     */
    function init() {
        const thead = window.app.dom.spreadsheet
            ? window.app.dom.spreadsheet.querySelector('thead')
            : document.querySelector('#spreadsheet thead');
        if (!thead) return;

        thead.addEventListener('input', (e) => {
            if (e.target.matches('.column-filter[data-filter-field]')) {
                e.stopPropagation();
                const field = e.target.getAttribute('data-filter-field');
                const raw = e.target.value.trim();
                const ast = window.ZDDCFilter.parse(raw);
                window.app.modules.store.setFilter(field, raw, ast);
            }
        });

        thead.addEventListener('keydown', (e) => {
            if (!e.target.matches('.column-filter[data-filter-field]')) return;
            if (e.key === 'Escape') {
                e.target.value = '';
                const field = e.target.getAttribute('data-filter-field');
                window.app.modules.store.setFilter(field, '', null);
                e.preventDefault();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const inputs = Array.from(thead.querySelectorAll('.column-filter'));
                const idx = inputs.indexOf(e.target);
                if (idx !== -1) inputs[(idx + 1) % inputs.length].focus();
            }
        });

        thead.addEventListener('click', (e) => {
            if (e.target.matches('.column-filter')) {
                e.stopPropagation();
            }
        });
    }

    /**
     * Clear all filters — reset inputs and store.
     */
    function clearFilters() {
        document.querySelectorAll('.column-filter').forEach(input => {
            input.value = '';
        });
        window.app.modules.store.setAllFilters({});
    }

    window.app.modules.filter = {
        init,
        clearFilters
    };
})();
