(function (app) {
    'use strict';

    var dom = app.dom;
    var markdown = app.modules.markdown;

    var editor = app.modules.markdownEditor = {};
    var inputEl = null;       // plain textarea
    var toolbarEl = null;     // button bar
    var wrapperEl = null;     // container for all editor elements
    var initialized = false;
    var renderClickBound = false;
    var outsideClickBound = false;

    // ── Textarea helpers ──────────────────────────────────────────────

    function syncToHiddenTextarea() {
        var remarks = dom.qs('#remarks');
        if (remarks && inputEl) { remarks.value = inputEl.value; }
    }

    function insertText(before, after, placeholder) {
        if (!inputEl) { return; }
        inputEl.focus();
        var start = inputEl.selectionStart;
        var end = inputEl.selectionEnd;
        var selected = inputEl.value.substring(start, end);
        var insert = selected || placeholder || '';
        var full = before + insert + (after || '');
        // execCommand preserves undo stack in most browsers
        document.execCommand('insertText', false, full);
        // If we used placeholder, select it for easy replacement
        if (!selected && insert) {
            inputEl.selectionStart = start + before.length;
            inputEl.selectionEnd = start + before.length + insert.length;
        }
    }

    // ── Button bar ────────────────────────────────────────────────────

    var buttons = [
        { label: 'B',  title: 'Bold',           wrap: ['**', '**'],       placeholder: 'bold' },
        { label: 'I',  title: 'Italic',          wrap: ['*', '*'],         placeholder: 'italic' },
        { label: 'H',  title: 'Heading',         wrap: ['## ', ''],        placeholder: 'heading' },
        { label: '\u2022', title: 'Bullet list',  wrap: ['- ', ''],         placeholder: 'item' },
        { label: '1.', title: 'Numbered list',   wrap: ['1. ', ''],        placeholder: 'item' },
        { label: '\uD83D\uDD17', title: 'Link',  wrap: ['[', '](url)'],    placeholder: 'link text' },
        { label: '\u229E', title: 'Table',        insert: '| Col 1 | Col 2 | Col 3 |\n| --- | --- | --- |\n| | | |\n' }
    ];

    function onButtonClick(event) {
        var btn = event.currentTarget;
        var idx = parseInt(btn.getAttribute('data-idx'), 10);
        var def = buttons[idx];
        if (!def) { return; }
        event.preventDefault();
        if (def.wrap) {
            insertText(def.wrap[0], def.wrap[1], def.placeholder);
        } else if (def.insert) {
            insertText(def.insert, '', '');
        }
        syncToHiddenTextarea();
        app.markDirty();
    }

    function createToolbar() {
        if (toolbarEl) { return toolbarEl; }
        toolbarEl = document.createElement('div');
        toolbarEl.className = 'md-toolbar';
        buttons.forEach(function (def, i) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'md-toolbar-btn';
            btn.textContent = def.label;
            btn.title = def.title;
            btn.setAttribute('data-idx', i);
            btn.addEventListener('mousedown', function (e) { e.preventDefault(); });
            btn.addEventListener('click', onButtonClick);
            toolbarEl.appendChild(btn);
        });
        return toolbarEl;
    }

    // ── Visibility helpers ────────────────────────────────────────────

    function refreshRender() {
        var textarea = dom.qs('#remarks');
        var renderEl = dom.qs('#remarks-render');
        if (!textarea || !renderEl) { return; }
        var value = textarea.value || '';
        if (value.trim()) {
            renderEl.innerHTML = markdown.render(value);
        } else if (app.state.mode === 'edit' && !app.state.published) {
            renderEl.innerHTML = '<span class="remarks-placeholder">Click to add remarks</span>';
        } else {
            renderEl.innerHTML = '';
        }
    }

    function showRendered() {
        if (wrapperEl) { wrapperEl.style.display = 'none'; }
        var renderContainer = dom.qs('#remarks-render-container');
        if (renderContainer) { renderContainer.hidden = false; }
        syncToHiddenTextarea();
        refreshRender();
    }

    function showEditor() {
        var renderContainer = dom.qs('#remarks-render-container');
        if (renderContainer) { renderContainer.hidden = true; }
        if (!initialized) { editor.init(); }
        if (wrapperEl) { wrapperEl.style.display = ''; }
        var remarks = dom.qs('#remarks');
        if (remarks && inputEl) {
            inputEl.value = remarks.value || '';
        }
        if (inputEl) { inputEl.focus(); }
    }

    // ── Click-to-edit on rendered preview ─────────────────────────────

    function onRenderClick() {
        if (app.state.mode !== 'edit' || app.state.published) { return; }
        showEditor();
    }

    function bindRenderClick() {
        if (renderClickBound) { return; }
        var renderContainer = dom.qs('#remarks-render-container');
        if (!renderContainer) { return; }
        renderContainer.addEventListener('click', onRenderClick);
        renderClickBound = true;
    }

    function setRenderClickable(clickable) {
        var renderContainer = dom.qs('#remarks-render-container');
        if (!renderContainer) { return; }
        if (clickable) {
            renderContainer.classList.add('remarks-clickable');
        } else {
            renderContainer.classList.remove('remarks-clickable');
        }
    }

    // ── Outside-click collapse ────────────────────────────────────────

    function onDocumentMousedown(event) {
        if (!wrapperEl) { return; }
        if (wrapperEl.style.display === 'none') { return; }
        if (wrapperEl.contains(event.target)) { return; }
        showRendered();
    }

    function bindOutsideClick() {
        if (outsideClickBound) { return; }
        document.addEventListener('mousedown', onDocumentMousedown, true);
        outsideClickBound = true;
    }

    // ── Public API ────────────────────────────────────────────────────

    editor.init = function initEditor() {
        if (initialized) { return; }
        var remarksWrapper = dom.qs('#remarks-wrapper');
        if (!remarksWrapper) { return; }

        wrapperEl = document.createElement('div');
        wrapperEl.id = 'remarks-editor';
        wrapperEl.style.display = 'none';

        wrapperEl.appendChild(createToolbar());

        // Edit area container
        var editArea = document.createElement('div');
        editArea.className = 'md-edit-area';

        // Plain textarea
        inputEl = document.createElement('textarea');
        inputEl.className = 'md-input';
        inputEl.spellcheck = true;
        inputEl.setAttribute('aria-label', 'Remarks');
        editArea.appendChild(inputEl);

        wrapperEl.appendChild(editArea);
        remarksWrapper.appendChild(wrapperEl);

        inputEl.addEventListener('input', function () {
            syncToHiddenTextarea();
            app.markDirty();
        });

        inputEl.addEventListener('keydown', function (e) {
            if (e.key === 'Tab') {
                e.preventDefault();
                document.execCommand('insertText', false, '    ');
            }
        });

        bindOutsideClick();
        initialized = true;
    };

    editor.destroy = function destroyEditor() {
        if (wrapperEl) { wrapperEl.style.display = 'none'; }
        syncToHiddenTextarea();
    };

    editor.showRendered = showRendered;
    editor.showEditor = showEditor;
    editor.refreshRender = refreshRender;
    editor.bindRenderClick = bindRenderClick;
    editor.setRenderClickable = setRenderClickable;

    editor.isActive = function isActive() {
        return initialized && wrapperEl && wrapperEl.style.display !== 'none';
    };

    editor.getValue = function getValue() {
        return inputEl ? inputEl.value : '';
    };

})(window.transmittalApp);
