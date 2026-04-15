(function (app) {
    'use strict';

    const dom = app.dom;
    const util = app.util;
    const json = app.json;

    const security = app.modules.security = {};

    // ── Verify-card DOM helpers ────────────────────────
    function makeCard(variant) {
        var el = document.createElement('div');
        el.className = 'verify-card verify-card--' + variant;
        return el;
    }
    function makeStatus(text, variant) {
        var el = document.createElement('div');
        el.className = 'verify-card__status verify-card__status--' + variant;
        el.textContent = text;
        return el;
    }
    function makeDetail(html) {
        var el = document.createElement('div');
        el.className = 'verify-card__detail';
        el.innerHTML = html;
        return el;
    }

    security.renderSignaturesList = async function renderSignaturesList() {
        var digestEl = dom.qs('#digest-display');
        var container = dom.qs('#signatures-list');
        var addButton = dom.qs('#add-signature-btn');
        if (!container) { return; }

        var data = json.parse();
        var envelope = data.envelope || {};
        var signatures = Array.isArray(envelope.signatures) ? envelope.signatures : [];
        var hasDigest = !!(envelope.digest);
        var dv = app.data.digestVerified;
        var results = app.data.signatureVerificationResults || [];

        // ── Digest card ──
        if (digestEl) {
            digestEl.innerHTML = '';
            if (hasDigest && dv) {
                var unavailable = dv.unavailable;
                var cardType = unavailable ? 'info' : (dv.match ? 'ok' : 'fail');
                var dCard = makeCard(cardType);
                if (unavailable) {
                    dCard.appendChild(makeStatus('Digest Present \u2014 verification unavailable', 'info'));
                } else {
                    dCard.appendChild(makeStatus(
                        (dv.match ? '\u2713 Digest Verified' : '\u2717 Digest Failed'),
                        dv.match ? 'ok' : 'fail'
                    ));
                }
                dCard.appendChild(makeDetail('SHA-256: <code>' + envelope.digest + '</code>'));
                if (envelope.digestedAt) {
                    dCard.appendChild(makeDetail(util.formatISOWithTZ(envelope.digestedAt)));
                }
                if (unavailable) {
                    dCard.appendChild(makeDetail('<em>Open from file:// or https:// to verify integrity</em>'));
                }
                digestEl.appendChild(dCard);
            }
        }

        // ── Signature cards ──
        container.innerHTML = '';
        if (!hasDigest) {
            if (addButton) { addButton.hidden = true; }
            return;
        }

        if (signatures.length === 0) {
            var note = makeCard('info');
            note.appendChild(makeStatus('No signatures \u2014 digest only', 'info'));
            container.appendChild(note);
        }

        var cryptoUnavailable = dv && dv.unavailable;
        for (var i = 0; i < signatures.length; i++) {
            var sig = signatures[i];
            var fingerprint = await util.publicKeyFingerprint(sig.publicKeyJwk);
            var signedAt = sig.signedAt ? util.formatISOWithTZ(sig.signedAt) : 'Unknown';
            var result = results.find(function (r) { return r.index === i; });
            var ok = result ? result.valid : false;
            var digestBad = dv && !dv.match && !cryptoUnavailable;
            var pass = ok && !digestBad;

            var sigLabel = sig.label || ('Signature ' + (i + 1));
            var cardType = cryptoUnavailable ? 'info' : (pass ? 'ok' : 'fail');
            var sCard = makeCard(cardType);
            if (cryptoUnavailable) {
                sCard.appendChild(makeStatus(sigLabel + ' \u2014 verification unavailable', 'info'));
            } else {
                sCard.appendChild(makeStatus(
                    (pass ? '\u2713 ' + sigLabel + ' Verified' : '\u2717 ' + sigLabel + ' Failed Verification'),
                    pass ? 'ok' : 'fail'
                ));
            }
            sCard.appendChild(makeDetail('Key: <code>' + (fingerprint || 'Unknown') + '</code>'));
            sCard.appendChild(makeDetail(signedAt));
            container.appendChild(sCard);
        }

        if (addButton) { addButton.hidden = false; }
    };

    security.deleteSignature = async function deleteSignature(index) {
        if (!confirm('Delete this signature?')) { return; }
        try {
            var data = json.parse();
            var envelope = data.envelope || {};
            var signatures = Array.isArray(envelope.signatures) ? envelope.signatures : [];
            signatures.splice(index, 1);
            envelope.signatures = signatures;
            json.setData({ envelope: envelope, payload: data.payload, presentation: data.presentation });
            await security.verifySignatureIfPresent();
            if (app.modules.data && app.modules.data.setStatus) {
                app.modules.data.setStatus('Signature deleted', 'success');
            }
        } catch (err) {
            console.error('[transmittal] failed to delete signature', err);
            alert('Failed to delete signature: ' + (err && err.message ? err.message : err));
        }
    };

    security.addSignature = async function addSignature(options) {
        var opts = options || {};
        var label = opts.label || '';
        try {
            var data = json.parse();
            var envelope = data.envelope || {};
            var payload = data.payload || {};

            if (!envelope.digest) {
                alert('Cannot add signature: document must be published first (needs digest).');
                return;
            }

            var jwk = await security.pickSigningKey();
            if (!jwk || jwk.kty !== 'EC') { return; }

            var sigResult = await util.signEnvelope(envelope, jwk);
            var publicJwk = security.derivePublicFromPrivate(jwk);

            var sigEntry = {
                signature: sigResult.signature,
                signedAt: sigResult.signedAt,
                publicKeyJwk: publicJwk
            };
            if (label) { sigEntry.label = label; }

            var signatures = Array.isArray(envelope.signatures) ? envelope.signatures : [];
            signatures.push(sigEntry);

            envelope.signatures = signatures;
            json.setData({ envelope: envelope, payload: payload, presentation: data.presentation });
            await security.verifySignatureIfPresent();

            // Persist by downloading updated HTML
            var publish = app.modules.publish;
            if (publish && publish.buildHtmlString) {
                var html = await publish.buildHtmlString();
                var dataModule = app.modules.data;
                var filename = dataModule && dataModule.buildFileName
                    ? dataModule.buildFileName(payload, { extension: 'html' })
                    : 'transmittal.html';
                util.downloadBlob(filename, new Blob([html], { type: 'text/html' }), 'text/html');
            }

            var statusMsg = (label ? label : 'Signature') + ' added \u2014 download triggered';
            if (app.modules.data && app.modules.data.setStatus) {
                app.modules.data.setStatus(statusMsg, 'success');
            }
        } catch (err) {
            console.error('[transmittal] failed to add signature', err);
            alert('Failed to add signature: ' + (err && err.message ? err.message : err));
        }
    };

    security.verifyPayloadSignature = async function verifyPayloadSignature(payloadStr, signatureB64, publicJwk) {
        if (!signatureB64 || !publicJwk) {
            return false;
        }
        try {
            const key = await window.crypto.subtle.importKey(
                'jwk',
                publicJwk,
                { name: 'ECDSA', namedCurve: 'P-256' },
                false,
                ['verify']
            );
            const signatureBuffer = util.base64ToArrayBuffer(signatureB64);
            const ok = await window.crypto.subtle.verify(
                { name: 'ECDSA', hash: { name: 'SHA-256' } },
                key,
                signatureBuffer,
                new TextEncoder().encode(payloadStr)
            );
            return !!ok;
        } catch (err) {
            console.warn('[transmittal] verify error', err);
            return false;
        }
    };

    security.verifySignatureIfPresent = async function verifySignatureIfPresent() {
        try {
            var data = json.parse();
            var envelope = data.envelope || {};
            var payload = data.payload || {};
            var signatures = Array.isArray(envelope.signatures) ? envelope.signatures : [];
            var hasDigest = !!(envelope.digest);

            if (!hasDigest) {
                app.data.digestVerified = null;
                app.data.signatureVerificationResults = [];
                await security.renderSignaturesList();
                return;
            }

            if (!util.hasCrypto()) {
                app.data.digestVerified = { match: false, unavailable: true };
                app.data.signatureVerificationResults = [];
                await security.renderSignaturesList();
                return;
            }

            // Verify digest matches payload
            var payloadStr = util.canonicalStringify(payload);
            var computedDigest = await util.hashString(payloadStr);
            var digestMatch = envelope.digest && computedDigest &&
                (String(envelope.digest).toLowerCase() === computedDigest.toLowerCase());

            app.data.digestVerified = {
                match: digestMatch,
                expected: envelope.digest,
                computed: computedDigest
            };

            if (!digestMatch || signatures.length === 0) {
                app.data.signatureVerificationResults = [];
                await security.renderSignaturesList();
                return;
            }

            // Reconstruct the envelope that was signed (without signatures)
            var envelopeToVerify = {
                version: envelope.version || 1,
                digestAlgorithm: envelope.digestAlgorithm || app.constants.digestAlgorithm,
                digest: envelope.digest,
                digestedAt: envelope.digestedAt,
                signatureAlgorithm: envelope.signatureAlgorithm || app.constants.signatureAlgorithm
            };
            var envelopeStr = util.canonicalStringify(envelopeToVerify);

            var results = [];
            for (var i = 0; i < signatures.length; i++) {
                var sig = signatures[i];
                var signatureOk = await security.verifyPayloadSignature(envelopeStr, sig.signature, sig.publicKeyJwk);
                results.push({
                    index: i,
                    valid: signatureOk,
                    publicKey: sig.publicKeyJwk,
                    signedAt: sig.signedAt
                });
            }

            app.data.signatureVerificationResults = results;
            await security.renderSignaturesList();
        } catch (err) {
            console.error('[transmittal] signature verification failed', err);
            app.data.digestVerified = { match: false, error: true };
            app.data.signatureVerificationResults = [];
            await security.renderSignaturesList();
        }
    };

    security.derivePublicFromPrivate = function derivePublicFromPrivate(jwk) {
        if (!jwk) {
            return null;
        }
        if (jwk.x && jwk.y) {
            return {
                kty: jwk.kty || 'EC',
                crv: jwk.crv || 'P-256',
                x: jwk.x,
                y: jwk.y,
                ext: true
            };
        }
        return null;
    };

    security.pickSigningKey = function pickSigningKey() {
        return new Promise(function (resolve, reject) {
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = '.zddc-key';
            input.addEventListener('change', async function () {
                try {
                    var file = input.files && input.files[0];
                    if (!file) { resolve(null); return; }
                    var text = await file.text();
                    var jwk = await util.loadKeyFile(text, security.promptForPassword);
                    resolve(jwk);
                } catch (err) {
                    reject(err);
                }
            });
            input.click();
        });
    };

    security.promptForPassword = function promptForPassword(fingerprint) {
        return new Promise(function (resolve) {
            var pw = window.prompt(
                fingerprint
                    ? 'Enter password for key ' + fingerprint + ':'
                    : 'Enter key password:'
            );
            resolve(pw);
        });
    };

    app.registerInit(function () {
        const addSigButton = dom.qs('#add-signature-btn');
        if (addSigButton) {
            addSigButton.addEventListener('click', function() {
                security.addSignature();
            });
        }
    });
})(window.transmittalApp);
