(function (app) {
    'use strict';

    const json = app.json = app.json || {};

    const SCRIPT_ID = 'transmittal-data';

    json.getScriptElement = function getScriptElement() {
        return document.getElementById(SCRIPT_ID);
    };

    json.getRawText = function getRawText() {
        const el = json.getScriptElement();
        return el && typeof el.textContent === 'string' ? el.textContent : '';
    };

    json.setData = function setData(obj) {
        const el = json.getScriptElement();
        if (!el) {
            return;
        }
        try {
            el.textContent = JSON.stringify(obj, null, 2);
        } catch (err) {
            console.error('[transmittal] failed to serialize JSON', err);
        }
    };

    json.parse = function parse() {
        try {
            const raw = json.getRawText();
            if (raw && raw.trim().length) {
                return JSON.parse(raw);
            }
        } catch (err) {
            console.error('[transmittal] failed to parse JSON store', err);
        }
        return app.util.createEmptyData('');
    };
})(window.transmittalApp);
