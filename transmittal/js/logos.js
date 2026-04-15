(function (app) {
    'use strict';

    const dom = app.dom;
    const logosModule = app.modules.logos = {};

    // Read an image file and apply it as a logo.
    // imgId: 'left-logo' or 'right-logo'
    async function applyLogoFile(imgId, file) {
        if (!file) { return; }
        var img = dom.qs('#' + imgId);
        if (!img) { return; }
        try {
            var dataUrl = await new Promise(function (resolve, reject) {
                var reader = new FileReader();
                reader.onload = function () { resolve(reader.result); };
                reader.onerror = function () { reject(reader.error); };
                reader.readAsDataURL(file);
            });
            img.src = dataUrl;
            // Mark logo-cell as having a logo so placeholder is hidden
            var cell = img.closest('[data-drop-zone]');
            if (cell) { cell.classList.add('has-logo'); }
            app.state.apply();
        } catch (err) {
            console.error('[transmittal] logo apply failed', err);
            alert('Failed to load logo: ' + (err && err.message ? err.message : err));
        }
    }

    logosModule.applyLogoFile = applyLogoFile;

    app.registerInit(function () {
        // Nothing to wire here — drag-and-drop is handled by drop-zones.js.
        // Keep the has-logo class in sync with existing logo src on load.
        ['left-logo', 'right-logo'].forEach(function (imgId) {
            var img = dom.qs('#' + imgId);
            if (!img) { return; }
            var cell = img.closest('[data-drop-zone]');
            if (cell && img.src && img.src !== window.location.href) {
                cell.classList.add('has-logo');
            }
        });
    });
})(window.transmittalApp);
