(function (app) {
    'use strict';

    const dom = app.dom;
    const util = app.util;
    const json = app.json;

    let debounceTimer = null;
    const DEBOUNCE_MS = 300; // 300ms debounce

    async function updateLiveDigest() {
        var digestDisplay = dom.qs('#digest-display');
        if (!digestDisplay) { return; }

        // Published — let renderSignaturesList handle the display
        var data = json.parse();
        var envelope = (data && data.envelope) || {};
        if (envelope.digest) { return; }

        // Only compute live digest in edit mode
        if (app.state && app.state.mode !== 'edit') { return; }

        try {
            // Sync form-field values to JSON only after the app has fully
            // initialised (i.e. loadFromJson has run and app.data.files is
            // populated). Calling syncUiToJson before that would overwrite
            // the saved-draft JSON with the empty in-memory state.
            if (app._initialized && app.modules.files && app.modules.files.syncUiToJson) {
                app.modules.files.syncUiToJson();
                // Re-read after sync so the digest reflects the updated payload.
                data = json.parse();
            }
            var payload = (data && data.payload) || {};
            var payloadStr = util.canonicalStringify(payload);
            var digest = await util.hashString(payloadStr);
            var now = new Date().toLocaleString();

            // Render draft verify-card
            digestDisplay.innerHTML = '';
            var card = document.createElement('div');
            card.className = 'verify-card verify-card--draft';

            var status = document.createElement('div');
            status.className = 'verify-card__status verify-card__status--draft';
            status.textContent = 'DRAFT';
            card.appendChild(status);

            var detail = document.createElement('div');
            detail.className = 'verify-card__detail';
            detail.innerHTML = 'Digest (SHA-256): <code>' + digest + '</code>';
            card.appendChild(detail);

            var time = document.createElement('div');
            time.className = 'verify-card__detail';
            time.textContent = 'Live \u2014 ' + now;
            card.appendChild(time);

            digestDisplay.appendChild(card);
        } catch (err) {
            console.error('[live-digest] Failed to calculate digest:', err);
        }
    }

    function scheduleDigestUpdate() {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(updateLiveDigest, DEBOUNCE_MS);
    }

    function bindFormChanges() {
        const form = dom.qs('#transmittal-form');
        if (!form) {
            return;
        }

        // Listen to all input changes
        form.addEventListener('input', scheduleDigestUpdate);
        form.addEventListener('change', scheduleDigestUpdate);
    }

    function subscribeToStateChanges() {
        // Subscribe to reactive state changes
        if (app.state && app.state.subscribe) {
            app.state.subscribe(function(property, newValue, oldValue) {
                scheduleDigestUpdate();
            });
        }
    }

    app.onDirty(function () {
        scheduleDigestUpdate();
    });

    app.modules.liveDigest = {
        update: updateLiveDigest,
        schedule: scheduleDigestUpdate
    };

    app.registerInit(function () {
        bindFormChanges();
        subscribeToStateChanges();
        // Calculate initial digest
        updateLiveDigest();
    });
})(window.transmittalApp);
