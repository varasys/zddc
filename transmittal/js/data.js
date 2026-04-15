(function (app) {
    'use strict';

    const dom = app.dom;
    const json = app.json;

    const dataModule = app.modules.data = {};

    const STATUS_DISPLAY_MS = 6000;
    let statusTimer = null;

    function qs(selector) {
        return dom.qs(selector);
    }

    function setStatus(message, type) {
        const element = qs('#data-status');
        if (!element) {
            return;
        }
        element.textContent = message || '';
        element.dataset.statusType = type || '';
        element.classList.remove('text-red-600', 'text-green-600');
        if (type === 'success') {
            element.classList.add('text-green-600');
        } else if (type === 'error') {
            element.classList.add('text-red-600');
        }
        if (statusTimer) {
            clearTimeout(statusTimer);
        }
        if (message) {
            statusTimer = setTimeout(function () {
                element.textContent = '';
                element.classList.remove('text-red-600', 'text-green-600');
            }, STATUS_DISPLAY_MS);
        }
    }

    const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]+/g;

    function sanitizeFilenameSegment(value, fallback) {
        const trimmed = (value || '').toString().trim();
        if (!trimmed) {
            return fallback || '';
        }
        return trimmed
            .replace(INVALID_FILENAME_CHARS, '-')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function sanitizeTitle(value) {
        const sanitized = sanitizeFilenameSegment(value, 'Transmittal');
        return sanitized || 'Transmittal';
    }

    function sanitizeTracking(value) {
        const sanitized = sanitizeFilenameSegment(value, 'TRANS');
        return sanitized.replace(/[_\s]+/g, '-');
    }

    function sanitizeStatus(value, fallback) {
        const sanitized = sanitizeFilenameSegment(value, fallback || '');
        const cleaned = sanitized.replace(/[()]/g, '').trim();
        if (cleaned) {
            return cleaned;
        }
        return (fallback || 'Unspecified');
    }

    function sanitizeDate(value) {
        const trimmed = (value || '').toString().trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            return trimmed;
        }
        if (!trimmed) {
            return '0000-00-00';
        }
        return trimmed.replace(/\s+/g, '-');
    }

    // Folder name: DATE_TRACKING (STATUS) - Title  (date first for chronological sort)
    dataModule.buildFolderName = function buildFolderName(payload) {
        const p = payload || {};
        const date = sanitizeDate(p.date || '');
        const tracking = sanitizeTracking(p.trackingNumber || '');
        const status = sanitizeStatus(p.status || p.purpose || '', 'Unspecified');
        const title = sanitizeTitle(p.subject || p.title || '');
        const statusPart = status ? ' (' + status + ')' : '';
        return date + '_' + tracking + statusPart + ' - ' + title;
    };

    // File name: TRACKING_[~]DATE (STATUS) - Subject.ext
    // draft: true → ~DATE (tilde prefix indicates draft)
    dataModule.buildFileName = function buildFileName(payload, options) {
        const p = payload || {};
        const opts = options || {};
        const ext = opts.extension ? opts.extension.replace(/^\.+/, '') : 'json';
        const isDraft = !!opts.draft;
        const tracking = sanitizeTracking(p.trackingNumber || '');
        const date = sanitizeDate(p.date || '');
        const status = sanitizeStatus(p.status || p.purpose || '', 'Unspecified');
        const title = sanitizeTitle(p.subject || p.title || '');
        const statusPart = status ? ' (' + status + ')' : '';
        const datePrefix = isDraft ? '~' : '';
        return tracking + '_' + datePrefix + date + statusPart + ' - ' + title + '.' + ext;
    };

    async function saveFileWithPicker(filename, contents, mime) {
        if (typeof window.showSaveFilePicker !== 'function') {
            app.util.downloadBlob(filename, contents, mime);
            return filename;
        }
        const handle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [
                {
                    description: mime || 'File',
                    accept: { [mime || 'application/octet-stream']: ['.' + (filename.split('.').pop() || '')] }
                }
            ]
        });
        const writable = await handle.createWritable();
        await writable.write(new Blob([contents], { type: mime || 'application/octet-stream' }));
        await writable.close();
        return handle.name || filename;
    }

    async function serializeUiToJson() {
        if (!app.modules.publish || typeof app.modules.publish.syncUiToJson !== 'function') {
            throw new Error('Publish module not ready');
        }
        await app.modules.publish.syncUiToJson({ sign: false, computeDigest: false });
        app.state.dirty = false;
    }

    // ── Extract JSON from an HTML transmittal string ────
    function extractJsonFromHtml(htmlText) {
        var m = htmlText.match(new RegExp('<script\\s+id\\s*=\\s*["\']transmittal-data["\'][^>]*>([\\s\\S]*?)</' + 'script>', 'i'));
        if (!m || !m[1]) { return null; }
        try {
            var data = JSON.parse(m[1]);
            if (data && typeof data === 'object' && data.payload) { return data; }
        } catch (_) { /* not valid JSON */ }
        return null;
    }

    function pickHtmlFile() {
        if (typeof window.showOpenFilePicker === 'function') {
            return window.showOpenFilePicker({
                multiple: false,
                types: [{ description: 'HTML Files', accept: { 'text/html': ['.html', '.htm'] } }]
            }).then(function (handles) {
                var handle = handles[0];
                return handle.getFile().then(function (file) {
                    return { file: file, name: handle.name || file.name || 'import.html' };
                });
            });
        }
        return new Promise(function (resolve, reject) {
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = 'text/html,.html,.htm';
            input.addEventListener('change', function () {
                var file = input.files && input.files[0];
                if (!file) { reject(new Error('No file selected')); return; }
                resolve({ file: file, name: file.name || 'import.html' });
            });
            input.click();
        });
    }

    async function handleImportHtml() {
        try {
            var picked = await pickHtmlFile();
            var text = await picked.file.text();
            var data = extractJsonFromHtml(text);
            if (!data) { throw new Error('No valid transmittal data found in this HTML file'); }
            await applyLoadedData(data, picked.name || 'import.html');
        } catch (err) {
            if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) { return; }
            console.error('[transmittal] import-html failed', err);
            setStatus('Failed to import HTML: ' + (err && err.message ? err.message : err), 'error');
        }
    }

    async function applyLoadedData(data, sourceName) {
        json.setData(data);
        app.modules.files.loadFromJson();
        app.state.mode = 'edit';
        app.state.dirty = false;
        if (app.modules.visibility && app.modules.visibility.applyFieldVisibility) {
            app.modules.visibility.applyFieldVisibility();
        }
        await app.modules.security.verifySignatureIfPresent();
        if (app.modules.security.renderSignaturesList) {
            await app.modules.security.renderSignaturesList();
        }
        app.modules.mode.refresh();
        app.state.apply();
        if (app.modules.liveDigest && app.modules.liveDigest.schedule) {
            app.modules.liveDigest.schedule();
        }
        setStatus('Loaded: ' + sourceName, 'success');
    }

    app.onDirty(function () {
        setStatus('Unsaved changes', 'info');
    });

    async function handleLoadFromClipboard() {
        try {
            var text = await navigator.clipboard.readText();
            if (!text || !text.trim()) {
                setStatus('Clipboard is empty', 'error');
                return;
            }
            var data = JSON.parse(text.trim());
            if (!data || typeof data !== 'object' || !data.payload) {
                throw new Error('Invalid ZDDC JSON data');
            }
            await applyLoadedData(data, 'clipboard');
        } catch (err) {
            console.error('[transmittal] load-from-clipboard failed', err);
            if (err && err.name === 'NotAllowedError') {
                setStatus('Clipboard access denied — please paste manually', 'error');
            } else {
                setStatus('Failed to load from clipboard: ' + (err && err.message ? err.message : err), 'error');
            }
        }
    }

    async function handleCopyJson() {
        try {
            await serializeUiToJson();
            var data = json.parse();
            var text = JSON.stringify(data, null, 2);
            await navigator.clipboard.writeText(text);
            setStatus('JSON copied to clipboard', 'success');
        } catch (err) {
            console.error('[transmittal] copy-json failed', err);
            if (err && err.name === 'NotAllowedError') {
                setStatus('Clipboard access denied', 'error');
            } else {
                setStatus('Failed to copy JSON: ' + (err && err.message ? err.message : err), 'error');
            }
        }
    }

    async function handleSaveHtmlDraft() {
        try {
            var pub = app.modules.publish;
            if (!pub || typeof pub.syncUiToJson !== 'function' || typeof pub.buildHtmlString !== 'function') {
                throw new Error('Publish module not ready');
            }
            await pub.syncUiToJson({ sign: false, computeDigest: false });
            var html = await pub.buildHtmlString();
            var data = json.parse();
            var payload = (data && data.payload) || {};
            var filename = dataModule.buildFileName(payload, { extension: 'html', draft: true });
            await saveFileWithPicker(filename, html, 'text/html');
            setStatus('Saved draft as ' + filename, 'success');
        } catch (err) {
            console.error('[transmittal] save-html-draft failed', err);
            setStatus('Failed to save draft: ' + (err && err.message ? err.message : err), 'error');
        }
    }

    async function handleCopyTable() {
        try {
            var TAB = '\t';
            var NL = '\r\n';
            var esc = app.util.escapeHtml;
            var textStyle = ' style="mso-number-format:\'\\@\'"';
            var headers = ['#', 'TRACKING NUMBER', 'TITLE', 'REVISION', 'STATUS', 'EXT', 'SIZE', 'SHA256'];
            var headerTsv = headers.join(TAB);
            var headerHtml = '<tr>' + headers.map(function (h) { return '<th' + textStyle + '>' + esc(h) + '</th>'; }).join('') + '</tr>';
            var tsvLines = [headerTsv];
            var htmlRows = [headerHtml];

            function addRow(cells) {
                tsvLines.push(cells.join(TAB));
                htmlRows.push('<tr>' + cells.map(function (c) { return '<td' + textStyle + '>' + esc(c) + '</td>'; }).join('') + '</tr>');
            }

            // Row 0: self-entry
            var filesModule = app.modules.files;
            var self = filesModule && filesModule.buildSelfEntry ? filesModule.buildSelfEntry() : null;
            if (self) {
                addRow(['0', self.trackingNumber || '', self.title || '', self.revision || '', self.status || '', 'html', '\u2014', 'see above']);
            }

            // Regular files
            var files = Array.isArray(app.data.files) ? app.data.files : [];
            for (var i = 0; i < files.length; i++) {
                var f = files[i];
                var size = (f.fileSize != null ? f.fileSize : f.size);
                addRow([
                    String(i + 1),
                    f.trackingNumber || '',
                    f.title || '',
                    f.revision || '',
                    f.status || '',
                    (f.extension || '').toLowerCase(),
                    size ? String(size) : '',
                    f.sha256 || ''
                ]);
            }

            var plainText = tsvLines.join(NL);
            var html = '<table>' + htmlRows.join('') + '</table>';
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/plain': new Blob([plainText], { type: 'text/plain' }),
                    'text/html': new Blob([html], { type: 'text/html' })
                })
            ]);
            setStatus('Table copied (' + files.length + ' files)', 'success');
        } catch (err) {
            console.error('[transmittal] copy-table failed', err);
            setStatus('Failed to copy table: ' + (err && err.message ? err.message : err), 'error');
        }
    }

    async function handleRevise() {
        if (!confirm('This will create a new draft from the published transmittal. The digest and signatures will be removed. Continue?')) {
            return;
        }
        var data = json.parse();
        if (!data) { return; }
        // Strip digest and signatures; preserve existing date for user to update
        data.envelope = { version: 1, digestAlgorithm: app.constants.digestAlgorithm, digest: '', digestedAt: '', signatureAlgorithm: app.constants.signatureAlgorithm, signatures: [] };
        json.setData(data);
        app.modules.files.loadFromJson();
        app.state.mode = 'edit';
        app.state.published = false;
        app.state.dirty = true;
        app.modules.mode.refresh();
        setStatus('Created new draft from published transmittal', 'success');
    }

    dataModule.extractJsonFromHtml = extractJsonFromHtml;
    dataModule.setStatus = setStatus;
    dataModule.serializeUiToJson = serializeUiToJson;
    dataModule.handleLoadFromClipboard = handleLoadFromClipboard;
    dataModule.handleCopyJson = handleCopyJson;
    dataModule.handleCopyTable = handleCopyTable;
    dataModule.handleSaveHtmlDraft = handleSaveHtmlDraft;
    dataModule.handleRevise = handleRevise;
    dataModule.handleImportHtml = handleImportHtml;
    dataModule.applyLoadedData = applyLoadedData;
    dataModule.buildFileName = dataModule.buildFileName || buildFileName;

})(window.transmittalApp);
