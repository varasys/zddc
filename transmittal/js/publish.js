(function (app) {
    'use strict';

    const dom = app.dom;
    const util = app.util;
    const json = app.json;
    const security = app.modules.security;
    const validation = app.modules.validation;
    const filesModule = app.modules.files;
    const dataModule = app.modules.data;
    const mode = app.modules.mode;

    async function syncUiToJson(options) {
        const sign = !!(options && options.sign);
        const computeDigest = !!(options && options.computeDigest);
        
        // First, sync UI to JSON to ensure JSON is up-to-date
        filesModule.syncUiToJson();
        
        // Now use JSON as single source of truth
        const data = json.parse();
        const previousEnvelope = (data && data.envelope) || {};
        const payload = (data && data.payload) || {};
        const previousPresentation = (data && data.presentation) || {};
        const payloadStr = util.canonicalStringify(payload);
        const previousPayloadStr = util.canonicalStringify(payload);
        const payloadChanged = false; // Always false since we just synced

        let digest = previousEnvelope.digest || '';
        let digestedAt = previousEnvelope.digestedAt || '';
        let signatures = Array.isArray(previousEnvelope.signatures) ? previousEnvelope.signatures.slice() : [];

        let computedDigest = '';
        if (sign || computeDigest || payloadChanged || !digest) {
            try {
                computedDigest = await util.hashString(payloadStr);
            } catch (err) {
                computedDigest = '';
            }
        }

        if (sign || computeDigest) {
            if (!computedDigest) {
                throw new Error('Unable to compute digest.');
            }
            digest = computedDigest;
            digestedAt = util.fetchTrustedTime();
        }
        
        if (sign) {
            const jwk = options && options.signingKey;
            if (!jwk || jwk.kty !== 'EC') {
                throw new Error('A valid EC private key (JWK) is required to sign this transmittal.');
            }
            const envelopeForSigning = {
                version: 1,
                digestAlgorithm: app.constants.digestAlgorithm,
                digest: digest,
                digestedAt: digestedAt,
                signatureAlgorithm: app.constants.signatureAlgorithm
            };
            const sigResult = await util.signEnvelope(envelopeForSigning, jwk);
            const publicJwk = security.derivePublicFromPrivate(jwk);
            signatures.push({
                signature: sigResult.signature,
                signedAt: sigResult.signedAt,
                publicKeyJwk: publicJwk
            });
        }

        const envelope = {
            version: 1,
            digestAlgorithm: app.constants.digestAlgorithm,
            digest: digest,
            digestedAt: digestedAt,
            signatureAlgorithm: app.constants.signatureAlgorithm,
            signatures: signatures
        };
        const presentation = previousPresentation;
        json.setData({ envelope: envelope, payload: payload, presentation: presentation });
        if (computeDigest || sign) {
            try {
                await security.verifySignatureIfPresent();
            } catch (_) {
                // ignore
            }
            app.state.apply();
        }
        app.state.dirty = false;
    }

    async function buildHtmlString() {
        // Hide editor before cloning so its markup is not in the output
        var mdEditor = app.modules.markdownEditor;
        var editorWasActive = mdEditor && mdEditor.isActive();
        if (editorWasActive) { mdEditor.destroy(); }

        // ── Preferred path: fetch the page's own source and patch the JSON ──
        // This produces an exact copy of the original file with only the data
        // changed, avoiding DOM-snapshot drift. Falls back to the DOM-snapshot
        // approach when the page cannot fetch itself (e.g. opaque origins).
        try {
            var jsonData = app.json.parse();
            var html = await util.fetchAndPatchHtml(jsonData);
            if (editorWasActive && mdEditor && typeof mdEditor.showRendered === 'function') {
                mdEditor.showRendered();
            }
            return html;
        } catch (fetchErr) {
            console.warn('[transmittal] fetch-based save unavailable, falling back to DOM snapshot:', fetchErr.message);
        }

        // ── Fallback path: DOM snapshot ─────────────────────────────────────
        // Populate static content before cloning for progressive enhancement
        if (app.modules.hydrate && app.modules.hydrate.populateStatic) {
            await app.modules.hydrate.populateStatic();
        }

        // Remove any existing success notifications
        var notifications = document.querySelectorAll('[data-publish-notification]');
        notifications.forEach(function (notif) { notif.remove(); });

        // Hide workflow edit-only steps before cloning (viewers shouldn't see them)
        var workflowEditSteps = dom.qsa('.workflow-step[data-edit-only], .workflow-tools');
        var wasVisible = [];
        workflowEditSteps.forEach(function (el) {
            wasVisible.push(!el.hidden);
            el.hidden = true;
        });

        // Re-hide bottom menu and restore no-js notice before cloning
        var bottomMenu = dom.qs('#bottom-menu');
        var bottomMenuWasVisible = bottomMenu && !bottomMenu.hidden;
        if (bottomMenu) { bottomMenu.hidden = true; }
        var noJsNotice = dom.qs('#no-js-notice');
        var addedNotice = false;
        if (!noJsNotice && bottomMenu && bottomMenu.parentNode) {
            noJsNotice = document.createElement('span');
            noJsNotice.id = 'no-js-notice';
            noJsNotice.className = 'text-gray-400 text-xs italic';
            noJsNotice.textContent = 'JavaScript not available';
            bottomMenu.parentNode.insertBefore(noJsNotice, bottomMenu.nextSibling);
            addedNotice = true;
        }

        // Close any open dialogs before cloning (they get reopened after)
        var openDialogs = Array.from(document.querySelectorAll('dialog[open]'));
        openDialogs.forEach(function (dlg) { dlg.close(); });

        var snapshotHtml = util.cloneDocumentHtml();

        // Restore bottom menu visibility
        if (bottomMenu && bottomMenuWasVisible) { bottomMenu.hidden = false; }
        if (noJsNotice) { dom.show(noJsNotice, false); }

        // Reopen dialogs that were open
        openDialogs.forEach(function (dlg) { dlg.showModal(); });

        // Restore workflow elements
        workflowEditSteps.forEach(function (el, i) {
            if (wasVisible[i]) { el.hidden = false; }
        });

        // Re-hydrate to restore dynamic state after cloning
        if (app.modules.hydrate && app.modules.hydrate.hydrate) {
            app.modules.hydrate.hydrate();
        }

        // Show rendered preview again (editor loads on next click)
        if (mdEditor) { mdEditor.showRendered(); }

        return snapshotHtml;
    }

    function requireDirectoryHandle() {
        if (!app.data.selectedDirHandle) {
            throw new Error('Select a directory before saving.');
        }
        return app.data.selectedDirHandle;
    }

    async function writeHtmlToDirectory(filename, html) {
        requireDirectoryHandle();
        await filesModule.writeFileToSelectedDir(filename, html, 'text/html');
    }

    function loadSigningKey(providedKey) {
        if (providedKey) { return providedKey; }
        throw new Error('A signing key is required. Select or generate one first.');
    }

    async function executePublish(config) {
        const modeSelection = (config && config.mode) || 'digest';
        const wantDownload = !!(config && config.download);
        const wantSaveToFolder = !!(config && config.saveToFolder);

        const validationResult = validation.validateBeforePublish();
        if (!validationResult.ok) {
            const error = new Error(validationResult.message || 'Validation failed before publishing.');
            error.focusEl = validationResult.focusEl || null;
            throw error;
        }

        if (wantSaveToFolder) {
            requireDirectoryHandle();
        }

        const shouldSign = modeSelection === 'signed';
        const shouldComputeDigest = modeSelection === 'signed' || modeSelection === 'digest';
        const isDraft = modeSelection === 'draft';

        let signingKey = null;
        if (shouldSign) {
            signingKey = await loadSigningKey(config && config.signingKey);
        }

        await syncUiToJson({
            sign: shouldSign,
            computeDigest: shouldComputeDigest,
            signingKey: signingKey
        });

        mode.refresh();
        const html = await buildHtmlString();
        const data = json.parse();
        const payload = (data && data.payload) || {};
        const filename = dataModule.buildFileName(payload, { extension: 'html', draft: isDraft });

        if (wantSaveToFolder) {
            await writeHtmlToDirectory(filename, html);
            // If publishing (not draft), delete the draft file from the directory
            if (!isDraft) {
                var draftName = dataModule.buildFileName(payload, { extension: 'html', draft: true });
                if (draftName !== filename) {
                    try {
                        await app.data.selectedDirHandle.removeEntry(draftName);
                    } catch (_) {
                        // Draft file may not exist — that's fine
                    }
                }
            }
        }
        if (wantDownload) {
            util.downloadBlob(filename, new Blob([html], { type: 'text/html' }), 'text/html');
        }
        mode.refresh();
        dataModule.setStatus('Published HTML as ' + filename, 'success');

        return {
            filename: filename,
            mode: modeSelection
        };
    }

    app.modules.publish = {
        syncUiToJson,
        buildHtmlString,
        executePublish
    };
})(window.transmittalApp);
