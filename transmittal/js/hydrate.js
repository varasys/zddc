(function (app) {
    'use strict';

    const dom = app.dom;
    const json = app.json;
    const util = app.util;

    /**
     * Hydrates static HTML content with data from JSON.
     * Called on page load to hide static placeholders and show dynamic content.
     */
    function hydrate() {
        // Hide static "Not Validated" warning (will be replaced by dynamic validation)
        const staticWarning = dom.qs('#signature-status-static');
        if (staticWarning) {
            staticWarning.hidden = true;
        }
        
        // Digest will be populated by security.renderSignaturesList()
        // which is called after signature verification
    }

    /**
     * Populates static HTML before saving/publishing.
     * This ensures the page displays content even without JavaScript.
     */
    async function populateStatic() {
        const data = json.parse();
        const envelope = data.envelope || {};
        const payload = data.payload || {};
        const signatures = Array.isArray(envelope.signatures) ? envelope.signatures : [];
        const files = Array.isArray(payload.files) ? payload.files : [];
        
        // Populate all form fields with actual values
        const fields = {
            '#type': payload.type || 'Transmittal',
            '#title': payload.title || '',
            '#owner-name': payload.client || '',
            '#project-name': payload.project || '',
            '#project-number': payload.projectNumber || '',
            '#tracking-number': payload.trackingNumber || '',
            '#date': payload.date || '',
            '#from': payload.from || '',
            '#to': payload.to || '',
            '#purpose': payload.purpose || '',
            '#response-due': payload.responseDue || '',
            '#subject': payload.subject || '',
            '#remarks': payload.remarks || ''
        };
        
        Object.keys(fields).forEach(function(selector) {
            const el = dom.qs(selector);
            if (el) {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    el.value = fields[selector];
                    el.setAttribute('value', fields[selector]);
                } else {
                    el.textContent = fields[selector];
                }
            }
        });
        var typeDisp = dom.qs('#type-display');
        if (typeDisp) { typeDisp.textContent = fields['#type']; }
        
        // Render markdown for static display
        if (app.modules.markdown && payload.remarks) {
            const remarksRender = dom.qs('#remarks-render');
            if (remarksRender) {
                remarksRender.innerHTML = app.modules.markdown.render(payload.remarks);
            }
        }
        
        // Populate table with file data
        const SELF_HASH = app.constants.SELF_HASH;
        const tbody = dom.qs('.table-wrapper tbody');
        if (tbody) {
            let html = '';
            let rowNum = 0;
            // Separate self-entry from regular files
            var selfFile = null;
            var regularFiles = [];
            files.forEach(function(file) {
                if (file.sha256 === SELF_HASH) {
                    selfFile = file;
                } else {
                    regularFiles.push(file);
                }
            });
            // If no explicit self-entry in JSON, synthesize one from payload header
            if (!selfFile) {
                selfFile = {
                    trackingNumber: payload.trackingNumber || '',
                    title: payload.subject || payload.title || '',
                    revision: payload.date || '',
                    status: payload.purpose || '',
                    extension: 'html',
                    fileSize: 0,
                    sha256: SELF_HASH
                };
            }
            // Build self-link filename from payload fields
            var selfFilename = '';
            var dataModule = app.modules.data;
            if (dataModule && dataModule.buildFileName) {
                selfFilename = dataModule.buildFileName(payload, { extension: 'html' });
            }
            var selfHref = selfFilename ? encodeURI('./' + selfFilename) : '';
            var selfTrackingHtml = selfHref
                ? '<a href="' + selfHref + '" class="text-gray-500 hover:underline" target="_blank" rel="noopener">' + util.escapeHtml(selfFile.trackingNumber || '') + '</a>'
                : util.escapeHtml(selfFile.trackingNumber || '');
            // Row 0: self-entry
            html += '<tr class="self-entry">' +
                '<td class="px-2 py-1 text-center text-gray-400">0</td>' +
                '<td class="px-2 py-1 text-gray-500 font-mono">' + selfTrackingHtml + '</td>' +
                '<td class="px-2 py-1 text-gray-500">' + util.escapeHtml(selfFile.title || '') + '</td>' +
                '<td class="px-2 py-1 text-center text-gray-500 font-mono">' + util.escapeHtml(selfFile.revision || '') + '</td>' +
                '<td class="px-2 py-1 text-center text-gray-500">' + util.escapeHtml(selfFile.status || '') + '</td>' +
                '<td class="px-2 py-1 text-center text-gray-500">html</td>' +
                '<td class="px-2 py-1 text-right text-gray-400">\u2014</td>' +
                '<td class="px-2 py-1 font-mono text-[9px] text-gray-400 italic">see above</td>' +
                '</tr>';
            // Remaining files
            regularFiles.forEach(function(file) {
                rowNum++;
                var isUnmatched = !file.sha256 && !file.fileSize;
                var formattedSize = isUnmatched ? '\u2014' : (file.fileSize ? util.formatFileSize(file.fileSize) : '');
                var sizeClass = isUnmatched ? 'px-2 py-1 text-right text-gray-400' : 'px-2 py-1 text-right';
                var hashContent = isUnmatched ? '<span class="italic text-gray-400">pending</span>' : (file.sha256 ? util.formatShortFileHash(file.sha256) : '');
                html += '<tr>' +
                    '<td class="px-2 py-1 text-center text-gray-400">' + rowNum + '</td>' +
                    '<td class="px-2 py-1">' + (file.trackingNumber || '') + '</td>' +
                    '<td class="px-2 py-1">' + (file.title || '') + '</td>' +
                    '<td class="px-2 py-1 text-center">' + (file.revision || '') + '</td>' +
                    '<td class="px-2 py-1 text-center">' + (file.status || '') + '</td>' +
                    '<td class="px-2 py-1 text-center">' + (file.extension || '') + '</td>' +
                    '<td class="' + sizeClass + '">' + formattedSize + '</td>' +
                    '<td class="px-2 py-1 font-mono text-[9px]">' + hashContent + '</td>' +
                    '</tr>';
            });
            tbody.innerHTML = html || '<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>';
        }
        
        // Populate digest card (static fallback using verify-card format)
        const digestDisplay = dom.qs('#digest-display');
        if (digestDisplay && envelope.digest) {
            const digestedAt = envelope.digestedAt ? new Date(envelope.digestedAt).toLocaleString() : 'Unknown';
            digestDisplay.innerHTML =
                '<div class="verify-card verify-card--info">' +
                '<div class="verify-card__status verify-card__status--info">Digest (SHA-256)</div>' +
                '<div class="verify-card__detail"><code>' + envelope.digest + '</code></div>' +
                '<div class="verify-card__detail">' + digestedAt + '</div>' +
                '</div>';
        }

        // Populate digest in Advanced section
        const digestEl = dom.qs('#digest-info');
        if (digestEl && envelope.digest) {
            const digestedAt = envelope.digestedAt ? new Date(envelope.digestedAt).toLocaleString() : 'Unknown';
            digestEl.innerHTML = '<div class="flex flex-col gap-0.5">' +
                '<div><strong>Digest (SHA-256):</strong></div>' +
                '<code class="text-[9px] break-all bg-gray-100 px-1 py-0.5 rounded">' + envelope.digest + '</code>' +
                '<div class="text-gray-500">Created: ' + digestedAt + '</div>' +
                '</div>';
        }

        // Populate static signature cards
        const sigList = dom.qs('#signatures-list');
        if (sigList && signatures.length > 0) {
            let html = '';
            for (let i = 0; i < signatures.length; i++) {
                const sig = signatures[i];
                const fingerprint = await util.publicKeyFingerprint(sig.publicKeyJwk);
                const fpDisplay = fingerprint === null ? 'unavailable' : (fingerprint || 'Unknown');
                const signedAt = sig.signedAt ? new Date(sig.signedAt).toLocaleString() : 'Unknown';
                html += '<div class="verify-card verify-card--info">' +
                    '<div class="verify-card__status verify-card__status--info">Signature ' + (i + 1) + '</div>' +
                    '<div class="verify-card__detail">Key: <code>' + fpDisplay + '</code></div>' +
                    '<div class="verify-card__detail">' + signedAt + '</div>' +
                    '</div>';
            }
            sigList.innerHTML = html;
        }

        // Show static warning
        const staticWarning = dom.qs('#signature-status-static');
        if (staticWarning) {
            staticWarning.hidden = !(envelope.digest || signatures.length > 0);
        }
    }

    /**
     * Populates form fields from current JSON data at runtime.
     * Used by verification mode to hydrate the form with loaded data.
     */
    function hydrateForm() {
        const data = json.parse();
        const payload = data.payload || {};
        const files = Array.isArray(payload.files) ? payload.files : [];

        var fields = {
            '#type': payload.type || 'Transmittal',
            '#title': payload.title || '',
            '#owner-name': payload.client || '',
            '#project-name': payload.project || '',
            '#project-number': payload.projectNumber || '',
            '#tracking-number': payload.trackingNumber || '',
            '#date': payload.date || '',
            '#from': payload.from || '',
            '#to': payload.to || '',
            '#purpose': payload.purpose || '',
            '#response-due': payload.responseDue || '',
            '#subject': payload.subject || '',
            '#remarks': payload.remarks || ''
        };

        Object.keys(fields).forEach(function (selector) {
            var el = dom.qs(selector);
            if (el) {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    el.value = fields[selector];
                } else {
                    el.textContent = fields[selector];
                }
            }
        });
        var typeDisp2 = dom.qs('#type-display');
        if (typeDisp2) { typeDisp2.textContent = fields['#type']; }

        // Render markdown
        if (app.modules.markdown && payload.remarks) {
            var remarksRender = dom.qs('#remarks-render');
            if (remarksRender) {
                remarksRender.innerHTML = app.modules.markdown.render(payload.remarks);
            }
        }

        // Render email fields
        if (app.modules.emailTags) {
            if (app.modules.emailTags.render) { app.modules.emailTags.render(); }
            if (app.modules.emailTags.renderFrom) { app.modules.emailTags.renderFrom(); }
        }

        // Visibility
        if (app.modules.visibility && app.modules.visibility.applyFieldVisibility) {
            app.modules.visibility.applyFieldVisibility();
        }
    }

    app.modules.hydrate = {
        hydrate: hydrate,
        hydrateForm: hydrateForm,
        populateStatic: populateStatic
    };

    app.registerInit(function () {
        hydrate();
    });
})(window.transmittalApp);
