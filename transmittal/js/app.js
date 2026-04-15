(function (global) {
    'use strict';

    if (global.transmittalApp) {
        return;
    }

    const app = {
        state: {
            mode: 'edit',
            published: false,
            dirty: false
        },
        data: {
            files: [],
            selectedDirHandle: null,
            selectedDirName: ''
        },
        constants: {
            viewableExts: ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'txt', 'html', 'htm', 'md'],
            digestAlgorithm: 'SHA-256',
            signatureAlgorithm: 'ECDSA-P256-SHA256',
            SELF_HASH: 'self:payload-digest'
        },
        modules: {},
        initCallbacks: [],
        registerInit(fn) {
            if (typeof fn === 'function') {
                app.initCallbacks.push(fn);
            }
        },
        dirtyListeners: [],
        onDirty(fn) {
            if (typeof fn === 'function') {
                app.dirtyListeners.push(fn);
            }
        },
        markDirty() {
            app.state.dirty = true;
            app.dirtyListeners.forEach(function (fn) {
                try { fn(); } catch (err) { console.error('[transmittal] dirtyListener error', err); }
            });
        },
        ready(fn) {
            if (typeof fn !== 'function') {
                return;
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', fn, { once: true });
            } else {
                fn();
            }
        },
        start() {
            if (app._started) {
                return;
            }
            app._started = true;
            const run = function () {
                app.initCallbacks.forEach(function (fn) {
                    try {
                        fn();
                    } catch (err) {
                        console.error('[transmittal] init error', err);
                    }
                });
            };
            app.ready(run);
        }
    };

    global.transmittalApp = app;
})(window);
