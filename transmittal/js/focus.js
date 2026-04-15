(function (app) {
    'use strict';

    app.registerInit(function () {
        let tabbing = false;

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Tab') {
                tabbing = true;
            }
        }, true);

        document.addEventListener('mousedown', function () {
            tabbing = false;
        }, true);

        document.addEventListener('focusin', function (event) {
            if (!tabbing) {
                return;
            }
            tabbing = false;
            const target = event.target;
            if (!target) {
                return;
            }
            if (target.id === 'remarks') {
                return;
            }
            if (target instanceof HTMLInputElement) {
                try {
                    target.select();
                } catch (_) {
                    // ignore selection issues
                }
                return;
            }
            if (target instanceof HTMLTextAreaElement) {
                return;
            }
            if (target.isContentEditable) {
                try {
                    const selection = window.getSelection && window.getSelection();
                    if (selection && document.createRange) {
                        const range = document.createRange();
                        range.selectNodeContents(target);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                } catch (_) {
                    // ignore
                }
            }
        }, true);
    });
})(window.transmittalApp);
