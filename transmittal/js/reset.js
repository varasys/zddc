(function (app) {
    'use strict';

    var dom = app.dom;
    var json = app.json;
    var filesModule = app.modules.files;
    var security = app.modules.security;

    function originalEmptyData() {
        return {
            envelope: {
                version: 1,
                digestAlgorithm: app.constants.digestAlgorithm,
                digest: '',
                digestedAt: '',
                signatureAlgorithm: app.constants.signatureAlgorithm,
                signatures: []
            },
            payload: {
                version: 1,
                type: 'Transmittal',
                title: '',
                client: '',
                project: '',
                projectNumber: '',
                date: '',
                trackingNumber: '',
                from: '',
                to: '',
                purpose: '',
                responseDue: '',
                subject: '',
                remarks: '',
                files: []
            },
            presentation: {
                leftLogo: '',
                rightLogo: '',
                theme: 'default',
                customCss: ''
            }
        };
    }

    async function handleReset() {
        if (!confirm('Reset will clear all data. Continue?')) {
            return;
        }
        json.setData(originalEmptyData());

        // Clear logos in DOM
        var leftLogo = dom.qs('#left-logo');
        var rightLogo = dom.qs('#right-logo');
        if (leftLogo) { leftLogo.src = ''; }
        if (rightLogo) { rightLogo.src = ''; }

        // Clear runtime state
        app.data.files = [];
        app.data.selectedDirHandle = null;
        app.data.selectedDirName = '';

        filesModule.loadFromJson();
        app.state.mode = 'edit';
        app.state.published = false;
        app.state.dirty = false;
        if (security.renderSignaturesList) {
            security.renderSignaturesList();
        }
        if (app.modules.mode && app.modules.mode.refresh) {
            app.modules.mode.refresh();
        }
        app.state.apply();
        if (app.modules.liveDigest && app.modules.liveDigest.schedule) {
            app.modules.liveDigest.schedule();
        }
    }

    app.modules.reset = {
        handleReset: handleReset
    };
})(window.transmittalApp);
