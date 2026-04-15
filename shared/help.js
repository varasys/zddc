/**
 * ZDDC shared help panel — open/close logic.
 * Works with all four tools regardless of their module pattern.
 * Expects: #help-btn, #help-panel, #help-panel-close in the DOM.
 */
(function () {
    'use strict';

    function init() {
        var helpBtn   = document.getElementById('help-btn');
        var panel     = document.getElementById('help-panel');
        var closeBtn  = document.getElementById('help-panel-close');

        if (!helpBtn || !panel) { return; }

        function isOpen() { return !panel.hidden; }

        function openPanel() {
            panel.hidden = false;
            document.body.classList.add('help-open');
        }

        function closePanel() {
            panel.hidden = true;
            document.body.classList.remove('help-open');
        }

        helpBtn.addEventListener('click', function () {
            if (isOpen()) { closePanel(); } else { openPanel(); }
        });

        if (closeBtn) {
            closeBtn.addEventListener('click', closePanel);
        }

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && isOpen()) { closePanel(); }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
