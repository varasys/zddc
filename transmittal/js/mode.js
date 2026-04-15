(function (app) {
    'use strict';

    const dom = app.dom;
    const json = app.json;
    const state = app.state;

    function computePublishedState() {
        const data = json.parse();
        const digest = (data.envelope && data.envelope.digest) || '';
        state.published = !!digest;
        return state.published;
    }

    function setMode(mode) {
        if (mode !== 'edit' && mode !== 'view') {
            return;
        }
        if (state.published && mode === 'edit') {
            mode = 'view';
        }
        state.mode = mode;
    }

    var _previousMode = state.mode;

    function refresh() {
        const wasPublished = state.published;
        const nowPublished = computePublishedState();
        if (nowPublished && !wasPublished) {
            state.mode = 'view';
        }
        // Re-render file table only when mode actually changes (edit↔view)
        if (state.mode !== _previousMode) {
            _previousMode = state.mode;
            if (app.modules.files && typeof app.modules.files.render === 'function') {
                app.modules.files.render();
            }
        }
        if (app.modules.files && app.modules.files.updateToolbars) {
            app.modules.files.updateToolbars();
        }
    }

    app.modules.mode = {
        setMode,
        refresh
    };

    app.registerInit(function () {
        computePublishedState();
        if (state.published) {
            state.mode = 'view';
        } else {
            state.mode = 'edit';
        }
    });
})(window.transmittalApp);
