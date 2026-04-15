(function (app) {
    'use strict';

    const util = app.util = app.util || {};

    util.hasCrypto = function hasCrypto() {
        return !!(window.crypto && window.crypto.subtle && typeof window.crypto.subtle.digest === 'function');
    };

    util.canonicalStringify = function canonicalStringify(input) {
        if (input === null) {
            return 'null';
        }
        const type = typeof input;
        if (type === 'number' || type === 'boolean' || type === 'string') {
            return JSON.stringify(input);
        }
        if (Array.isArray(input)) {
            return '[' + input.map(util.canonicalStringify).join(',') + ']';
        }
        const keys = Object.keys(input).sort();
        return '{' + keys.map(function (key) {
            return JSON.stringify(key) + ':' + util.canonicalStringify(input[key]);
        }).join(',') + '}';
    };

    util.hashString = async function hashString(str) {
        if (!window.crypto || !window.crypto.subtle || typeof window.crypto.subtle.digest !== 'function') {
            throw new Error('Web Crypto SubtleCrypto is required');
        }
        const encoder = new TextEncoder();
        const bytes = encoder.encode(str);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', bytes);
        return util.arrayBufferToHex(hashBuffer);
    };

    util.arrayBufferToHex = function arrayBufferToHex(buffer) {
        return Array.from(new Uint8Array(buffer), function (byte) {
            return byte.toString(16).padStart(2, '0');
        }).join('');
    };

    util.base64ToArrayBuffer = function base64ToArrayBuffer(base64Value) {
        if (!base64Value) {
            return new ArrayBuffer(0);
        }
        const binaryString = atob(base64Value);
        const length = binaryString.length;
        const bytes = new Uint8Array(length);
        for (let index = 0; index < length; index += 1) {
            bytes[index] = binaryString.charCodeAt(index);
        }
        return bytes.buffer;
    };

    util.arrayBufferToBase64 = function arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let output = '';
        for (let index = 0; index < bytes.length; index += 1) {
            output += String.fromCharCode(bytes[index]);
        }
        return btoa(output);
    };

    // Revision comparison delegates to shared zddc library
    util.compareRevisionPriority = function compareRevisionPriority(aRevision, bRevision) {
        return zddc.compareRevisions(aRevision, bRevision);
    };

    util.compareFilesByTrackingRevision = function compareFilesByTrackingRevision(a, b) {
        const trackingA = (a && a.trackingNumber ? String(a.trackingNumber) : '').toLowerCase();
        const trackingB = (b && b.trackingNumber ? String(b.trackingNumber) : '').toLowerCase();
        if (trackingA < trackingB) {
            return -1;
        }
        if (trackingA > trackingB) {
            return 1;
        }

        const revisionCompare = util.compareRevisionPriority(a && a.revision, b && b.revision);
        if (revisionCompare !== 0) {
            return revisionCompare;
        }

        const extA = (a && a.extension ? String(a.extension) : '').toLowerCase();
        const extB = (b && b.extension ? String(b.extension) : '').toLowerCase();
        if (extA < extB) {
            return -1;
        }
        if (extA > extB) {
            return 1;
        }

        return 0;
    };

    util.canonicalizePublicJwk = function canonicalizePublicJwk(pk) {
        if (!pk) {
            return { kty: 'EC', crv: 'P-256', x: '', y: '' };
        }
        return {
            kty: pk.kty || 'EC',
            crv: pk.crv || 'P-256',
            x: pk.x || '',
            y: pk.y || ''
        };
    };

    util.publicKeyFingerprint = async function publicKeyFingerprint(pk) {
        try {
            if (!pk) {
                return '';
            }
            if (!util.hasCrypto()) {
                return null;
            }
            const canonical = util.canonicalizePublicJwk(pk);
            const canonicalStr = util.canonicalStringify(canonical);
            const hash = await util.hashString(canonicalStr);
            return (hash || '').slice(0, 12);
        } catch (err) {
            console.error('[transmittal] publicKeyFingerprint error', err);
            return '';
        }
    };

    var HASH_CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB chunks

    util.hashFile = async function hashFile(file, onProgress) {
        if (!window.crypto || !window.crypto.subtle || typeof window.crypto.subtle.digest !== 'function') {
            throw new Error('Web Crypto SubtleCrypto is required');
        }
        // For small files or missing stream support, use single-shot
        if (file.size < HASH_CHUNK_SIZE * 2 || typeof file.stream !== 'function') {
            if (onProgress) { onProgress(file.size, file.size); }
            var buffer = await file.arrayBuffer();
            var hash = await window.crypto.subtle.digest('SHA-256', buffer);
            return util.arrayBufferToHex(hash);
        }
        // Chunked streaming hash for large files
        var reader = file.stream().getReader();
        var loaded = 0;
        var chunks = [];
        var yieldCounter = 0;
        while (true) {
            var result = await reader.read();
            if (result.done) { break; }
            chunks.push(result.value);
            loaded += result.value.byteLength;
            yieldCounter++;
            if (onProgress && yieldCounter % 4 === 0) {
                onProgress(loaded, file.size);
                await new Promise(function (r) { setTimeout(r, 0); });
            }
        }
        // Concatenate chunks and digest
        var total = new Uint8Array(loaded);
        var offset = 0;
        for (var i = 0; i < chunks.length; i++) {
            total.set(chunks[i], offset);
            offset += chunks[i].byteLength;
        }
        var digest = await window.crypto.subtle.digest('SHA-256', total.buffer);
        if (onProgress) { onProgress(file.size, file.size); }
        return util.arrayBufferToHex(digest);
    };

    util.escapeHtml = function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    };

    util.escapeHtmlAttribute = function escapeHtmlAttribute(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;');
    };

    util.downloadBlob = function downloadBlob(filename, contents, mime) {
        var blob = (contents instanceof Blob)
            ? contents
            : new Blob([contents], { type: mime || 'application/octet-stream' });
        var anchor = document.createElement('a');
        anchor.href = URL.createObjectURL(blob);
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        setTimeout(function () {
            URL.revokeObjectURL(anchor.href);
            anchor.remove();
        }, 0);
    };

    util.createEmptyData = function createEmptyData(date) {
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
                date: date || '',
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
    };

    util.fetchTrustedTime = function fetchTrustedTime() {
        return new Date().toISOString();
    };

    util.formatISOWithTZ = function formatISOWithTZ(isoStr) {
        if (!isoStr) { return 'Unknown'; }
        var d = new Date(isoStr);
        if (isNaN(d.getTime())) { return isoStr; }
        try {
            return d.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                timeZoneName: 'short'
            });
        } catch (_) {
            return d.toLocaleString();
        }
    };

    util.signEnvelope = async function signEnvelope(envelope, jwk) {
        if (!jwk || jwk.kty !== 'EC') {
            throw new Error('A valid EC private key (JWK) is required to sign.');
        }
        var envelopeToSign = {
            version: envelope.version || 1,
            digestAlgorithm: envelope.digestAlgorithm || app.constants.digestAlgorithm,
            digest: envelope.digest,
            digestedAt: envelope.digestedAt,
            signatureAlgorithm: envelope.signatureAlgorithm || app.constants.signatureAlgorithm
        };
        var envelopeStr = util.canonicalStringify(envelopeToSign);
        var key = await window.crypto.subtle.importKey(
            'jwk',
            jwk,
            { name: 'ECDSA', namedCurve: 'P-256' },
            false,
            ['sign']
        );
        var raw = await window.crypto.subtle.sign(
            { name: 'ECDSA', hash: { name: 'SHA-256' } },
            key,
            new TextEncoder().encode(envelopeStr)
        );
        return {
            signature: util.arrayBufferToBase64(raw),
            signedAt: util.fetchTrustedTime()
        };
    };


    util.formatShortHash = function formatShortHash(hex) {
        const normalized = (hex || '').trim();
        if (!normalized) {
            return '';
        }
        if (normalized.length <= 20) {
            return normalized;
        }
        return normalized.slice(0, 12) + '\u2026' + normalized.slice(-8);
    };

    util.formatShortFileHash = function formatShortFileHash(hex) {
        const normalized = (hex || '').trim();
        if (!normalized) {
            return '';
        }
        if (normalized.length <= 12) {
            return normalized;
        }
        return normalized.slice(0, 6) + '\u2026' + normalized.slice(-5);
    };

    util.formatFileSize = function formatFileSize(bytes) {
        const num = Number(bytes) || 0;
        if (num === 0) {
            return '0 B';
        }
        if (num < 1024) {
            return num + ' B';
        }
        if (num < 1024 * 1024) {
            return (num / 1024).toFixed(1) + ' KB';
        }
        if (num < 1024 * 1024 * 1024) {
            return (num / (1024 * 1024)).toFixed(1) + ' MB';
        }
        return (num / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    };

    util.fileToImage = function fileToImage(file) {
        return new Promise(function (resolve, reject) {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = function () {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = function (err) {
                URL.revokeObjectURL(url);
                reject(err);
            };
            img.src = url;
        });
    };

    util.imageFileToPngDataUrl = async function imageFileToPngDataUrl(file, maxWidth, maxHeight) {
        const img = await util.fileToImage(file);
        const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        return canvas.toDataURL('image/png');
    };

    // ── ZDDC Signing Key utilities ─────────────────────────
    var KEY_FORMAT = 'zddc-signing-key-v1';
    var KDF_ITERATIONS = 100000;

    function deriveWrappingKey(password, salt) {
        var enc = new TextEncoder();
        return window.crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
            .then(function (baseKey) {
                return window.crypto.subtle.deriveKey(
                    { name: 'PBKDF2', salt: salt, iterations: KDF_ITERATIONS, hash: 'SHA-256' },
                    baseKey,
                    { name: 'AES-GCM', length: 256 },
                    false,
                    ['encrypt', 'decrypt']
                );
            });
    }

    util.encryptPrivateKey = async function encryptPrivateKey(jwk, password, publicFingerprint) {
        var plaintext = new TextEncoder().encode(JSON.stringify(jwk));
        var salt = window.crypto.getRandomValues(new Uint8Array(16));
        var iv = window.crypto.getRandomValues(new Uint8Array(12));
        var wrappingKey = await deriveWrappingKey(password, salt);
        var ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, wrappingKey, plaintext);
        return {
            format: KEY_FORMAT,
            publicFingerprint: publicFingerprint || '',
            encrypted: true,
            kdf: 'PBKDF2-SHA256',
            iterations: KDF_ITERATIONS,
            salt: util.arrayBufferToBase64(salt),
            iv: util.arrayBufferToBase64(iv),
            ciphertext: util.arrayBufferToBase64(ciphertext)
        };
    };

    util.decryptPrivateKey = async function decryptPrivateKey(keyData, password) {
        var salt = util.base64ToArrayBuffer(keyData.salt);
        var iv = util.base64ToArrayBuffer(keyData.iv);
        var ciphertext = util.base64ToArrayBuffer(keyData.ciphertext);
        var wrappingKey = await deriveWrappingKey(password, salt);
        var plaintext = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, wrappingKey, ciphertext);
        return JSON.parse(new TextDecoder().decode(plaintext));
    };

    util.wrapKeyFile = function wrapKeyFile(jwk, publicFingerprint) {
        return {
            format: KEY_FORMAT,
            publicFingerprint: publicFingerprint || '',
            encrypted: false,
            key: jwk
        };
    };

    util.loadKeyFile = async function loadKeyFile(text, promptForPassword) {
        var data = JSON.parse(text);
        // ZDDC key format
        if (data.format === KEY_FORMAT) {
            if (data.encrypted) {
                if (typeof promptForPassword !== 'function') {
                    throw new Error('Password required but no prompt available.');
                }
                var password = await promptForPassword(data.publicFingerprint);
                if (!password && password !== '') { return null; } // user cancelled
                return util.decryptPrivateKey(data, password);
            }
            return data.key;
        }
        throw new Error('Unrecognized key file format. Expected a .zddc-key file.');
    };

    util.cloneDocumentHtml = function cloneDocumentHtml() {
        // Temporarily remove inline scripts from the LIVE DOM so that
        // outerHTML produces a clean string with zero script bodies.
        // We never create a clone via innerHTML because the HTML parser
        // would corrupt the JSON block if base64 data contains a close-script tag.
        var scripts = document.querySelectorAll('script:not([src])');
        var saved = [];
        for (var i = 0; i < scripts.length; i++) {
            var el = scripts[i];
            saved.push({
                el: el,
                parent: el.parentNode,
                next: el.nextSibling,
                body: el.textContent || '',
                attrs: ''
            });
            for (var a = 0; a < el.attributes.length; a++) {
                var attr = el.attributes[a];
                saved[i].attrs += ' ' + attr.name + '="' +
                    attr.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"';
            }
            el.parentNode.removeChild(el);
        }

        var html = document.documentElement.outerHTML;

        // Restore every script element to the live DOM immediately
        for (var r = 0; r < saved.length; r++) {
            saved[r].parent.insertBefore(saved[r].el, saved[r].next);
        }

        // Build each script tag as a safe string and insert before </body>
        var scriptStrings = '';
        for (var j = 0; j < saved.length; j++) {
            var s = saved[j];
            var safeBody = s.body;
            var scriptType = (s.el.getAttribute('type') || '').toLowerCase();
            if (scriptType === 'application/json') {
                // Re-serialize from parsed data so we control the output.
                // \u003c is valid JSON; JSON.parse converts it back to <
                var jsonData = app.json.parse();
                safeBody = JSON.stringify(jsonData, null, 2).replace(/</g, '\\u003c');
            }
            scriptStrings += '\n<script' + s.attrs + '>' + safeBody +
                '</' + 'script>';
        }

        // Insert scripts before closing </body>
        var bodyClose = html.lastIndexOf('</' + 'body>');
        if (bodyClose !== -1) {
            html = html.substring(0, bodyClose) + scriptStrings + '\n' +
                html.substring(bodyClose);
        } else {
            html += scriptStrings;
        }

        return '<!DOCTYPE html>\n' + html;
    };

    /**
     * Fetch the current page's own source HTML and replace only the
     * transmittal-data JSON block with the supplied data object.
     *
     * This is the preferred save mechanism for drafts because it produces
     * an exact copy of the source file with only the data changed, rather
     * than a DOM snapshot that may contain stale or mutated content.
     *
     * @param {object} jsonData - The data object to embed as JSON.
     * @returns {Promise<string>} The patched HTML string.
     * @throws {Error} If the fetch fails or the JSON block is not found.
     */
    util.fetchAndPatchHtml = async function fetchAndPatchHtml(jsonData) {
        var response = await fetch(location.href, { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error('fetch failed with status ' + response.status);
        }
        var html = await response.text();
        // \u003c is valid JSON; JSON.parse converts it back to <
        var jsonStr = JSON.stringify(jsonData, null, 2).replace(/</g, '\\u003c');
        // Replace the transmittal-data script body. The non-greedy [\s\S]*? stops
        // at the first close-script tag, which is safe because < is escaped above.
        var patched = html.replace(
            new RegExp(
                '(<script\\b[^>]*\\bid\\s*=\\s*["\']transmittal-data["\'][^>]*>)[\\s\\S]*?(<\\/' + 'script>)',
                'i'
            ),
            '$1\n' + jsonStr + '\n$2'
        );
        if (patched === html) {
            throw new Error('transmittal-data script block not found in fetched HTML');
        }
        return patched;
    };
})(window.transmittalApp);
