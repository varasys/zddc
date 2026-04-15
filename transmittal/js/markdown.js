(function (app) {
    'use strict';

    const markdown = app.modules.markdown = {};
    const dom = app.dom;

    var escapeHtml = app.util.escapeHtml;

    function renderInline(text) {
        if (!text) {
            return '';
        }
        let rendered = escapeHtml(text);
        const codePlaceholders = [];
        rendered = rendered.replace(/`([^`]+)`/g, function (_, code) {
            codePlaceholders.push('<code>' + escapeHtml(code) + '</code>');
            return '\u0000C' + (codePlaceholders.length - 1) + '\u0000';
        });
        rendered = rendered.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, url) {
            const trimmedUrl = url.trim();
            const allowed = /^(https?:\/\/|mailto:|tel:|\/|\.{1,2}\/)/i.test(trimmedUrl);
            if (!allowed) {
                return '[' + label + '](' + url + ')';
            }
            const safeUrl = trimmedUrl.replace(/\s+/g, '%20').replace(/"/g, '%22');
            return '<a href="' + safeUrl + '" target="_blank" rel="noopener">' + escapeHtml(label) + '</a>';
        });
        rendered = rendered.replace(/(^|\s)((https?:\/\/)[^\s<]+)/gi, function (_, prefix, url) {
            const safe = url.replace(/"/g, '%22');
            return prefix + '<a href="' + safe + '" target="_blank" rel="noopener">' + url + '</a>';
        });
        rendered = rendered
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/__([^_]+)__/g, '<strong>$1</strong>')
            .replace(/(^|\W)\*([^*]+)\*(?=\W|$)/g, '$1<em>$2</em>')
            .replace(/(^|\W)_([^_]+)_(?=\W|$)/g, '$1<em>$2</em>')
            .replace(/~~([^~]+)~~/g, '<del>$1</del>');
        rendered = rendered.replace(/\u0000C(\d+)\u0000/g, function (_, index) {
            return codePlaceholders[Number(index)] || '';
        });
        return rendered;
    }

    function leadingIndent(text) {
        const expanded = text.replace(/\t/g, '    ');
        const match = expanded.match(/^(\s*)/);
        return match ? match[1].length : 0;
    }

    markdown.render = function renderMarkdownBasic(markdownText) {
        const lines = (markdownText || '').replace(/\r\n?/g, '\n').split('\n');
        const output = [];
        let inCode = false;
        let codeBuffer = [];
        const listStack = [];
        const tableSeparator = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;

        function flushCode() {
            if (!inCode) {
                return;
            }
            output.push('<pre><code>' + escapeHtml(codeBuffer.join('\n')) + '</code></pre>');
            inCode = false;
            codeBuffer = [];
        }

        function closeListsTo(indent) {
            while (listStack.length && listStack[listStack.length - 1].indent > indent) {
                output.push('</' + listStack.pop().type + '>');
            }
        }

        function closeAllLists() {
            closeListsTo(-1);
        }

        function openList(type, indent) {
            listStack.push({ type, indent });
            output.push('<' + type + '>');
        }

        function splitCells(row) {
            const trimmed = row.trim().replace(/^\|/, '').replace(/\|$/, '');
            return trimmed.split('|').map(function (cell) {
                return cell.trim();
            });
        }

        for (let index = 0; index < lines.length; index += 1) {
            const raw = lines[index];
            const line = raw;
            if (/^```/.test(line)) {
                if (inCode) {
                    flushCode();
                } else {
                    inCode = true;
                    codeBuffer = [];
                }
                continue;
            }
            if (inCode) {
                codeBuffer.push(raw);
                continue;
            }
            if (!line.trim()) {
                closeAllLists();
                continue;
            }
            if (/\|/.test(line) && index + 1 < lines.length && tableSeparator.test(lines[index + 1])) {
                closeAllLists();
                const headerCells = splitCells(line);
                index += 2;
                const body = [];
                while (index < lines.length && /\|/.test(lines[index]) && lines[index].trim()) {
                    body.push(splitCells(lines[index]));
                    index += 1;
                }
                index -= 1;
                const thead = '<thead><tr>' + headerCells.map(function (cell) {
                    return '<th>' + renderInline(cell) + '</th>';
                }).join('') + '</tr></thead>';
                const tbody = '<tbody>' + body.map(function (rowCells) {
                    return '<tr>' + rowCells.map(function (cell) {
                        return '<td>' + renderInline(cell) + '</td>';
                    }).join('') + '</tr>';
                }).join('') + '</tbody>';
                output.push('<table>' + thead + tbody + '</table>');
                continue;
            }
            if (/^\s*(?:---|\*\*\*|___)\s*$/.test(line)) {
                closeAllLists();
                output.push('<hr/>');
                continue;
            }
            if (/^\s*>\s?/.test(line)) {
                closeAllLists();
                const quoteLines = [];
                while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
                    quoteLines.push(lines[index].replace(/^\s*>\s?/, ''));
                    index += 1;
                }
                index -= 1;
                const html = quoteLines.map(function (text) {
                    return '<p>' + renderInline(text) + '</p>';
                }).join('\n');
                output.push('<blockquote>' + html + '</blockquote>');
                continue;
            }
            let match = line.match(/^(#{1,6})\s+(.*)$/);
            if (match) {
                closeAllLists();
                const level = match[1].length;
                const text = renderInline(match[2].trim());
                output.push('<h' + level + '>' + text + '</h' + level + '>');
                continue;
            }
            match = line.match(/^(\s*)[-*+]\s+(.*)$/);
            if (match) {
                const indent = leadingIndent(match[1]);
                const type = 'ul';
                if (!listStack.length || listStack[listStack.length - 1].indent < indent) {
                    openList(type, indent);
                } else {
                    closeListsTo(indent);
                    if (!listStack.length || listStack[listStack.length - 1].type !== type || listStack[listStack.length - 1].indent !== indent) {
                        openList(type, indent);
                    }
                }
                output.push('<li>' + renderInline(match[2].trim()) + '</li>');
                continue;
            }
            match = line.match(/^(\s*)\d+\.\s+(.*)$/);
            if (match) {
                const indent = leadingIndent(match[1]);
                const type = 'ol';
                if (!listStack.length || listStack[listStack.length - 1].indent < indent) {
                    openList(type, indent);
                } else {
                    closeListsTo(indent);
                    if (!listStack.length || listStack[listStack.length - 1].type !== type || listStack[listStack.length - 1].indent !== indent) {
                        openList(type, indent);
                    }
                }
                output.push('<li>' + renderInline(match[2].trim()) + '</li>');
                continue;
            }
            closeAllLists();
            output.push('<p>' + renderInline(line) + '</p>');
        }

        closeAllLists();
        flushCode();
        return output.join('\n');
    };

    markdown.refresh = function refreshPreview() {
        const textarea = dom.qs('#remarks');
        const target = dom.qs('#remarks-render');
        if (!textarea || !target) {
            return;
        }
        target.innerHTML = markdown.render(textarea.value || '');
    };

    markdown.bindRemarksLivePreview = function bindRemarksLivePreview() {
        const textarea = dom.qs('#remarks');
        if (!textarea) {
            return;
        }
        textarea.addEventListener('input', function () {
            if (app.state.mode === 'edit') {
                markdown.refresh();
            }
        });
        markdown.refresh();
    };

    app.registerInit(function () {
        markdown.bindRemarksLivePreview();
    });
})(window.transmittalApp);
