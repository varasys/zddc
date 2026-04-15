(function (app) {
    'use strict';

    const filesModule = app.modules.files;
    const security = app.modules.security;
    const mode = app.modules.mode;

    // Global handler: close parent <dialog> when any [data-modal-close] button is clicked
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-modal-close]');
        if (!btn) { return; }
        var dlg = btn.closest('dialog');
        if (dlg && dlg.open) { dlg.close(); }
    });

    // ── Date field + calendar picker wiring ────────────
    function toIso(str) {
        if (!str || !str.trim()) { return ''; }
        var t = str.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(t)) { return t; }
        var d = new Date(t);
        if (!isNaN(d.getTime())) {
            var y = d.getFullYear();
            var m = String(d.getMonth() + 1).padStart(2, '0');
            var day = String(d.getDate()).padStart(2, '0');
            return y + '-' + m + '-' + day;
        }
        return t;
    }

    function wireDatePicker(textId, pickerId) {
        var dateText = app.dom.qs(textId);
        var datePicker = app.dom.qs(pickerId);
        if (!dateText || !datePicker) { return; }

        dateText.addEventListener('click', function () {
            var iso = toIso(dateText.value);
            datePicker.value = (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) ? iso : '';
            datePicker.showPicker();
        });

        datePicker.addEventListener('change', function () {
            if (datePicker.value) {
                dateText.value = datePicker.value;
                dateText.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });

        dateText.addEventListener('blur', function () {
            var iso = toIso(dateText.value);
            if (iso !== dateText.value) {
                dateText.value = iso;
                dateText.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    }

    wireDatePicker('#date', '#date-picker-hidden');
    wireDatePicker('#response-due', '#response-due-picker-hidden');

    app.registerInit(async function () {
        // ── Type combo dropdown wiring ───────────────────────
        (function () {
            var typeHidden = app.dom.qs('#type');
            var typeDisplay = app.dom.qs('#type-display');
            var menu = app.dom.qs('#type-menu');
            if (!typeHidden || !typeDisplay || !menu) { return; }

            function syncToHidden() {
                var text = (typeDisplay.textContent || '').trim();
                typeHidden.value = text;
                typeHidden.dispatchEvent(new Event('input', { bubbles: true }));
                if (app.state && app.state.apply) { app.state.apply(); }
            }

            function isOpen() { return !menu.classList.contains('hidden'); }
            function closeMenu() { menu.classList.add('hidden'); }

            typeDisplay.addEventListener('input', syncToHidden);

            typeDisplay.addEventListener('blur', syncToHidden);

            typeDisplay.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    typeDisplay.blur();
                }
            });

            typeDisplay.addEventListener('paste', function (e) {
                e.preventDefault();
                var text = (e.clipboardData || window.clipboardData).getData('text/plain');
                document.execCommand('insertText', false, text.replace(/\n/g, ' '));
            });

            typeDisplay.addEventListener('click', function () {
                if (app.state.mode !== 'edit') { return; }
                if (isOpen()) { closeMenu(); } else { menu.classList.remove('hidden'); }
            });

            menu.addEventListener('click', function (e) {
                var opt = e.target.closest('[data-value]');
                if (!opt) { return; }
                var val = opt.getAttribute('data-value');
                typeDisplay.textContent = val;
                typeHidden.value = val;
                typeHidden.dispatchEvent(new Event('input', { bubbles: true }));
                closeMenu();
                if (app.state && app.state.apply) { app.state.apply(); }
            });

            document.addEventListener('click', function (e) {
                if (isOpen() && !menu.contains(e.target) && e.target !== typeDisplay) {
                    closeMenu();
                }
            });
        })();
        filesModule.loadFromJson();
        app._initialized = true;
        app.state.updateHiddenFields();
        app.state.apply();
        await security.verifySignatureIfPresent();
        mode.refresh();
        
        // Ensure Advanced panel state is correct after all initialization
        if (app.modules.advanced && app.modules.advanced.updateAdvancedSection) {
            app.modules.advanced.updateAdvancedSection();
        }
    });

    app.ready(function () {
        app.start();
    });
})(window.transmittalApp);
