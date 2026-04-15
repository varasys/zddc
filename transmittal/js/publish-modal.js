(function (app) {
    'use strict';

    if (!app || !app.dom || !app.modules) {
        console.error('[publish-modal] App not properly initialized');
        return;
    }

    var dom = app.dom;
    var util = app.util;

    function qs(sel) { return dom.qs(sel); }

    // ── Date helpers ────────────────────────────────────
    function getTodayIso() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function toIsoDate(str) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) { return str; }
        var d = new Date(str);
        if (isNaN(d.getTime())) { return str; }
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function syncDateWarning() {
        var dateInput = qs('#publish-date-input');
        var warning = qs('#publish-date-warning');
        if (!dateInput || !warning) { return; }
        var val = (dateInput.value || '').trim();
        var today = getTodayIso();
        if (!val || val === today) {
            warning.textContent = '';
            warning.hidden = true;
        } else {
            warning.textContent = '\u26A0 Date differs from today (' + today + ')';
            warning.hidden = false;
        }
    }

    // ── Feedback helpers ────────────────────────────────
    function showFeedback(feedbackEl, message, type) {
        if (!feedbackEl) { return; }
        feedbackEl.textContent = message || '';
        feedbackEl.style.color = type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '';
    }

    // ── Success notification ────────────────────────────
    function showSuccessNotification(filename) {
        var notification = document.createElement('div');
        notification.className = 'publish-notification';
        notification.setAttribute('data-publish-notification', 'true');

        var title = document.createElement('div');
        title.className = 'publish-notification__title';
        title.textContent = '\u2713 Transmittal Published Successfully';

        var file = document.createElement('div');
        file.className = 'publish-notification__file';
        file.textContent = 'Saved as: ' + filename;

        var closeBtn = document.createElement('button');
        closeBtn.className = 'publish-notification__close';
        closeBtn.textContent = 'Close';
        closeBtn.addEventListener('click', function () { notification.remove(); });

        notification.appendChild(title);
        notification.appendChild(file);
        notification.appendChild(closeBtn);
        document.body.appendChild(notification);
        setTimeout(function () { if (notification.parentElement) { notification.remove(); } }, 10000);
    }

    // ── Password dialog ─────────────────────────────────
    function promptForPassword(fingerprint) {
        return new Promise(function (resolve) {
            var dialog = qs('#password-dialog');
            var input = qs('#password-dialog-input');
            var okBtn = qs('#password-dialog-ok');
            var feedback = qs('#password-dialog-feedback');
            var fpEl = qs('#password-dialog-fingerprint');
            if (!dialog || !input || !okBtn) { resolve(null); return; }

            input.value = '';
            showFeedback(feedback, '', '');
            if (fpEl) {
                fpEl.textContent = fingerprint ? 'Key fingerprint: ' + fingerprint : 'This key is password-protected.';
            }
            dialog.showModal();
            input.focus();

            function cleanup() {
                okBtn.removeEventListener('click', onOk);
                dialog.removeEventListener('close', onClose);
            }
            function onOk() {
                var pw = input.value;
                cleanup();
                dialog.close();
                resolve(pw);
            }
            function onClose() {
                cleanup();
                resolve(null);
            }
            okBtn.addEventListener('click', onOk);
            dialog.addEventListener('close', onClose);

            // Enter key submits
            input.addEventListener('keydown', function handler(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    input.removeEventListener('keydown', handler);
                    onOk();
                }
            });
        });
    }

    // ── Key dialog ──────────────────────────────────────
    function openKeyDialog() {
        return new Promise(function (resolve) {
            var dialog = qs('#key-dialog');
            var selectBtn = qs('#key-select-file');
            var generateBtn = qs('#key-generate');
            var generatePanel = qs('#key-generate-panel');
            var genConfirmBtn = qs('#key-generate-confirm');
            var genCancelBtn = qs('#key-generate-cancel');
            var pwInput = qs('#key-password');
            var pwConfirm = qs('#key-password-confirm');
            var feedback = qs('#key-dialog-feedback');
            if (!dialog) { resolve(null); return; }

            // Reset state
            if (generatePanel) { generatePanel.hidden = true; }
            if (pwInput) { pwInput.value = ''; }
            if (pwConfirm) { pwConfirm.value = ''; }
            showFeedback(feedback, '', '');
            dialog.showModal();

            var resolved = false;
            function done(jwk) {
                if (resolved) { return; }
                resolved = true;
                cleanup();
                if (dialog.open) { dialog.close(); }
                resolve(jwk);
            }
            function cleanup() {
                if (selectBtn) { selectBtn.removeEventListener('click', onSelect); }
                if (generateBtn) { generateBtn.removeEventListener('click', onGenerate); }
                if (genConfirmBtn) { genConfirmBtn.removeEventListener('click', onGenConfirm); }
                if (genCancelBtn) { genCancelBtn.removeEventListener('click', onGenCancel); }
                dialog.removeEventListener('close', onDialogClose);
            }

            function onDialogClose() { done(null); }

            async function onSelect() {
                try {
                    var security = app.modules.security;
                    var jwk = await pickKeyFileWithPassword();
                    if (jwk) { done(jwk); }
                } catch (err) {
                    showFeedback(feedback, 'Failed to load key: ' + (err.message || err), 'error');
                }
            }

            function onGenerate() {
                if (generatePanel) { generatePanel.hidden = false; }
                if (generateBtn) { generateBtn.hidden = true; }
                if (selectBtn) { selectBtn.hidden = true; }
            }

            function onGenCancel() {
                if (generatePanel) { generatePanel.hidden = true; }
                if (generateBtn) { generateBtn.hidden = false; }
                if (selectBtn) { selectBtn.hidden = false; }
                if (pwInput) { pwInput.value = ''; }
                if (pwConfirm) { pwConfirm.value = ''; }
            }

            async function onGenConfirm() {
                var pw = pwInput ? pwInput.value : '';
                var pwc = pwConfirm ? pwConfirm.value : '';
                if (pw && pw !== pwc) {
                    showFeedback(feedback, 'Passwords do not match.', 'error');
                    return;
                }
                try {
                    showFeedback(feedback, 'Generating key\u2026', '');
                    var security = app.modules.security;
                    var keys = await window.crypto.subtle.generateKey(
                        { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']
                    );
                    var privateJwk = await window.crypto.subtle.exportKey('jwk', keys.privateKey);
                    var publicJwk = security.derivePublicFromPrivate(privateJwk);
                    var fingerprint = await util.publicKeyFingerprint(publicJwk);

                    var keyFileData;
                    if (pw) {
                        keyFileData = await util.encryptPrivateKey(privateJwk, pw, fingerprint);
                    } else {
                        keyFileData = util.wrapKeyFile(privateJwk, fingerprint);
                    }
                    util.downloadBlob('signing-key.zddc-key', JSON.stringify(keyFileData, null, 2), 'application/json');
                    showFeedback(feedback, 'Key downloaded. Fingerprint: ' + (fingerprint || '(unknown)'), 'success');
                    done(privateJwk);
                } catch (err) {
                    showFeedback(feedback, 'Failed to generate key: ' + (err.message || err), 'error');
                }
            }

            if (selectBtn) { selectBtn.addEventListener('click', onSelect); }
            if (generateBtn) { generateBtn.addEventListener('click', onGenerate); }
            if (genConfirmBtn) { genConfirmBtn.addEventListener('click', onGenConfirm); }
            if (genCancelBtn) { genCancelBtn.addEventListener('click', onGenCancel); }
            dialog.addEventListener('close', onDialogClose);
        });
    }

    // ── Pick key file with automatic password prompt ────
    function pickKeyFileWithPassword() {
        return new Promise(function (resolve, reject) {
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = '.zddc-key';
            input.addEventListener('change', async function () {
                try {
                    var file = input.files && input.files[0];
                    if (!file) { resolve(null); return; }
                    var text = await file.text();
                    var jwk = await util.loadKeyFile(text, promptForPassword);
                    resolve(jwk);
                } catch (err) {
                    reject(err);
                }
            });
            input.click();
        });
    }

    // ── Output checkbox helpers ───────────────────────────
    function readOutputOptions() {
        var saveCb = qs('#publish-save-folder');
        var dlCb = qs('#publish-download-html');
        return {
            saveToFolder: saveCb && saveCb.checked,
            download: dlCb && dlCb.checked
        };
    }

    function syncOutputCheckboxes() {
        var saveCb = qs('#publish-save-folder');
        var dlCb = qs('#publish-download-html');
        var hasDir = !!app.data.selectedDirHandle;
        if (saveCb) { saveCb.checked = hasDir; }
        if (dlCb) { dlCb.checked = !hasDir; }
    }

    function restoreOutputOptions(opts) {
        var saveCb = qs('#publish-save-folder');
        var dlCb = qs('#publish-download-html');
        if (saveCb) { saveCb.checked = !!opts.saveToFolder; }
        if (dlCb) { dlCb.checked = !!opts.download; }
    }

    function feedbackLabel(mode) {
        if (mode === 'draft') { return 'Saving draft'; }
        if (mode === 'signed') { return 'Signing and publishing'; }
        return 'Publishing';
    }

    function setPublishBusy(busy) {
        var btns = [qs('#publish-confirm'), qs('#publish-signed-btn'), qs('#publish-draft-btn')];
        for (var i = 0; i < btns.length; i++) {
            if (!btns[i]) { continue; }
            btns[i].disabled = busy;
            if (busy) { btns[i].classList.add('opacity-60'); }
            else { btns[i].classList.remove('opacity-60'); }
        }
    }

    // ── Core publish execution ──────────────────────────
    async function executePublishFlow(mode, signingKey) {
        var feedback = qs('#publish-modal-feedback');
        var opts = readOutputOptions();

        if (!opts.saveToFolder && !opts.download) {
            throw new Error('Select at least one output option.');
        }

        // Prompt for directory if Save in directory is checked but none selected
        if (opts.saveToFolder && !app.data.selectedDirHandle) {
            try {
                var dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                app.data.selectedDirHandle = dirHandle;
                if (app.modules.files && app.modules.files.updateDirectoryIndicator) {
                    app.modules.files.updateDirectoryIndicator();
                }
            } catch (dirErr) {
                throw new Error('A directory is required to save. Please select a directory.');
            }
        }

        // Sync date from modal back to form
        var dateInput = qs('#publish-date-input');
        var formDate = qs('#date');
        if (dateInput && formDate && dateInput.value) {
            formDate.value = dateInput.value;
        }

        var publishModule = app.modules.publish;
        if (!publishModule || typeof publishModule.executePublish !== 'function') {
            throw new Error('Publish module not ready');
        }

        showFeedback(feedback, feedbackLabel(mode) + '\u2026', '');

        var result = await publishModule.executePublish({
            mode: mode,
            saveToFolder: opts.saveToFolder,
            download: opts.download,
            signingKey: signingKey || null
        });

        return result;
    }

    // ── Publish modal ───────────────────────────────────
    function initPublishModal() {
        var modal = qs('#publish-modal');
        if (!modal) { return; }

        var feedback = qs('#publish-modal-feedback');
        var confirmBtn = qs('#publish-confirm');
        var signedBtn = qs('#publish-signed-btn');
        var draftBtn = qs('#publish-draft-btn');
        var dateInput = qs('#publish-date-input');

        // Close buttons
        modal.querySelectorAll('[data-modal-close]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (modal.open) { modal.close(); }
            });
        });

        // Backdrop click
        modal.addEventListener('click', function (e) {
            if (e.target === modal) { modal.close(); }
        });

        // Date warning
        if (dateInput) { dateInput.addEventListener('input', syncDateWarning); }

        function openModal() {
            showFeedback(feedback, '', '');
            syncOutputCheckboxes();
            // Populate date
            var formDate = qs('#date');
            if (formDate && dateInput) {
                var val = (formDate.value || '').trim();
                dateInput.value = val ? toIsoDate(val) : getTodayIso();
            }
            syncDateWarning();
            // Warn about missing hashes before user commits
            var missingHash = 0;
            (app.data.files || []).forEach(function (f) {
                if (!f.sha256) { missingHash++; }
            });
            if (missingHash > 0) {
                showFeedback(feedback, missingHash + ' file(s) have no SHA-256 hash.', 'error');
            }
            if (!modal.open) { modal.showModal(); }
        }

        function closeAndNotify(result) {
            if (modal.open) { modal.close(); }
            var msg = result.zipFilename ? result.filename + ' + ' + result.zipFilename : result.filename;
            setTimeout(function () { showSuccessNotification(msg); }, 100);
        }

        function handleError(err) {
            showFeedback(feedback, err && err.message ? err.message : 'Publish failed.', 'error');
            if (err && err.focusEl && typeof err.focusEl.focus === 'function') {
                if (modal.open) { modal.close(); }
                err.focusEl.focus();
                if (err.focusEl.scrollIntoView) { err.focusEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            }
        }

        // Publish (unsigned with digest) — primary action
        if (confirmBtn) {
            confirmBtn.addEventListener('click', async function () {
                setPublishBusy(true);
                try {
                    var result = await executePublishFlow('digest');
                    setPublishBusy(false);
                    closeAndNotify(result);
                } catch (err) {
                    setPublishBusy(false);
                    handleError(err);
                }
            });
        }

        // Publish Signed — opens key dialog first
        if (signedBtn) {
            signedBtn.addEventListener('click', async function () {
                // Save user's checkbox selections before closing
                var savedOpts = readOutputOptions();
                if (modal.open) { modal.close(); }

                try {
                    var jwk = await openKeyDialog();
                    if (!jwk) { openModal(); restoreOutputOptions(savedOpts); return; }

                    openModal();
                    restoreOutputOptions(savedOpts);
                    setPublishBusy(true);
                    var result = await executePublishFlow('signed', jwk);
                    setPublishBusy(false);
                    closeAndNotify(result);
                } catch (err) {
                    setPublishBusy(false);
                    openModal();
                    restoreOutputOptions(savedOpts);
                    handleError(err);
                }
            });
        }

        // Save Draft
        if (draftBtn) {
            draftBtn.addEventListener('click', async function () {
                setPublishBusy(true);
                try {
                    var result = await executePublishFlow('draft');
                    setPublishBusy(false);
                    closeAndNotify(result);
                } catch (err) {
                    setPublishBusy(false);
                    handleError(err);
                }
            });
        }

        // Listen for publish requests from the primary action button
        document.addEventListener('transmittal:open-publish', function () {
            openModal();
        });
    }

    // ── Password dialog close buttons ───────────────────
    function initPasswordDialog() {
        var dialog = qs('#password-dialog');
        if (!dialog) { return; }
        dialog.querySelectorAll('[data-modal-close]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (dialog.open) { dialog.close(); }
            });
        });
        dialog.addEventListener('click', function (e) {
            if (e.target === dialog) { dialog.close(); }
        });
    }

    // ── Key dialog close buttons ────────────────────────
    function initKeyDialog() {
        var dialog = qs('#key-dialog');
        if (!dialog) { return; }
        dialog.querySelectorAll('[data-modal-close]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (dialog.open) { dialog.close(); }
            });
        });
        dialog.addEventListener('click', function (e) {
            if (e.target === dialog) { dialog.close(); }
        });
    }

    app.registerInit(function () {
        initPublishModal();
        initPasswordDialog();
        initKeyDialog();
    });
})(window.transmittalApp);
