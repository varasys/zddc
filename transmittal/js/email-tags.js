(function (app) {
    'use strict';

    var dom = app.dom;
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function escapeAttr(str) {
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    }

    // Split on semicolons/commas but respect quoted strings
    function splitRecipients(raw) {
        var parts = [];
        var current = '';
        var inQuote = false;
        for (var i = 0; i < raw.length; i++) {
            var ch = raw[i];
            if (ch === '"') {
                inQuote = !inQuote;
                current += ch;
            } else if ((ch === ';' || ch === ',') && !inQuote) {
                var trimmed = current.trim();
                if (trimmed) { parts.push(trimmed); }
                current = '';
            } else {
                current += ch;
            }
        }
        var last = current.trim();
        if (last) { parts.push(last); }
        return parts;
    }

    // Extract email from entries like "Display Name <email@host.com>" or bare email
    function extractEmail(entry) {
        var angleMatch = entry.match(/<([^>]+)>/);
        if (angleMatch && EMAIL_RE.test(angleMatch[1])) {
            return angleMatch[1];
        }
        if (EMAIL_RE.test(entry)) {
            return entry;
        }
        return null;
    }

    function renderRecipient(entry) {
        var email = extractEmail(entry);
        if (email) {
            return '<a href="mailto:' + escapeAttr(email) + '" class="to-mailto">' + escapeHtml(entry) + '</a>';
        }
        return '<span>' + escapeHtml(entry) + '</span>';
    }

    function renderToField() {
        var input = dom.qs('#to');
        var render = dom.qs('#to-render');
        if (!input || !render) { return; }

        var raw = input.value || '';
        var parts = splitRecipients(raw);
        if (!parts.length) {
            render.innerHTML = '';
            return;
        }

        var html = parts.map(renderRecipient).join('<span class="to-sep">; </span>');
        render.innerHTML = html;
    }

    function renderFromField() {
        var input = dom.qs('#from');
        var render = dom.qs('#from-render');
        if (!input || !render) { return; }

        var raw = (input.value || '').trim();
        if (!raw) {
            render.innerHTML = '';
            return;
        }

        var email = extractEmail(raw);
        if (email) {
            render.innerHTML = '<a href="mailto:' + escapeAttr(email) + '" class="from-mailto">' + escapeHtml(raw) + '</a>';
        } else {
            render.innerHTML = '<span>' + escapeHtml(raw) + '</span>';
        }
    }

    function init() {
        var toInput = dom.qs('#to');
        if (toInput) {
            toInput.addEventListener('input', renderToField);
            toInput.addEventListener('change', renderToField);
            renderToField();
        }
        var fromInput = dom.qs('#from');
        if (fromInput) {
            fromInput.addEventListener('input', renderFromField);
            fromInput.addEventListener('change', renderFromField);
            renderFromField();
        }
    }

    app.modules.emailTags = {
        render: renderToField,
        renderFrom: renderFromField
    };

    app.registerInit(init);
})(window.transmittalApp);
